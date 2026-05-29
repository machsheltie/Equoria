/**
 * populateBreedsFromSql.mjs
 *
 * Reads all 312 breed SQL files from backend/data/breeds/ and executes them
 * against the database via Prisma $executeRawUnsafe.
 *
 * Equoria-26qjf.3 (2026-05-28): files were moved from samples/Breeds/ →
 * backend/data/breeds/ so the importer reads its actual data location. The
 * 3 meta/reference files (_breed-list.txt, _gait-registry.txt, generichorse.txt)
 * stay in samples/Breeds/ and are belt-and-braces filtered by SKIP_FILES below.
 *
 * Each .txt file is an idempotent INSERT ... ON CONFLICT (name) DO UPDATE
 * statement containing the full breed genetic profile (JSONB).
 *
 * Sanitization performed before execution:
 *   - breed_genetic_profile  →  "breedGeneticProfile"  (actual column name)
 *   - default_trait          →  "defaultTrait"          (actual column name)
 *   - updated_at = NOW()     →  removed (column does not exist)
 *
 * Skipped files: seed.sql, populate_breed_ratings.sql,
 *                populate_breed_temperaments.sql
 * (these are legacy update scripts superseded by the individual .txt files)
 *
 * Usage:
 *   node backend/seed/populateBreedsFromSql.mjs
 *   npm run seed:breeds  (from backend/)
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve path relative to backend/ (one level up from backend/seed/).
// Equoria-26qjf.3 (2026-05-28): operational seed data lives in backend/data/breeds/
// (next to backend/data/breedProfiles.json) — not docs/, not samples/.
const BREED_DATA_DIR = join(__dirname, '..', 'data', 'breeds');

// Non-breed SQL files to skip
const SKIP_FILES = new Set([
  'seed.sql',
  'populate_breed_ratings.sql',
  'populate_breed_temperaments.sql',
  // Equoria-26qjf.3: generichorse.txt is the editable template, NOT a real breed.
  // (A stale copy historically inserted a duplicate 'Lusitano' row.) Never seed it.
  'generichorse.txt',
  // Equoria-iswx5: defense-in-depth — _breed-list.txt and _gait-registry.txt are
  // meta/registry files in samples/Breeds, NOT idempotent INSERT statements.
  // 26qjf.3 already excluded all _*-prefixed files during the copy to docs/BreedData
  // (i.e. they are NOT in BREED_DATA_DIR today), but we list them here so any
  // future re-copy / re-mirror that forgets to filter `_*` cannot silently feed a
  // non-breed meta file into prisma.$executeRawUnsafe. The meta files live in
  // samples/Breeds (the editable source-of-truth + auditor home) and never need
  // to land in the seed directory.
  '_breed-list.txt',
  '_gait-registry.txt',
]);

/**
 * Pearl + Brindle allele-case normalization (Equoria-26qjf.3 / .1).
 *
 * The 312 breed data files spell the Pearl (Prl_Pearl) and Brindle (BR1_Brindle1)
 * alleles in UPPERCASE ('N/N', 'N/Prl', 'Prl/Prl', 'N/BR1', 'BR1/BR1', 'BR1/Y'),
 * but phenotypeCalculationService keys these loci off the LOWERCASE canonical
 * forms ('prl/prl', 'prl/n', 'n/prl', and `br1 !== 'n/n'`). Seeding the raw
 * uppercase data would make every generated horse render as Brindle (because
 * `'N/N' !== 'n/n'`) and never render Pearl colors. We normalize ONLY these two
 * loci's tokens to the engine's canonical case at import time, leaving every
 * other locus untouched (e.g. MFSD12_Mushroom legitimately uses uppercase
 * 'N/N'/'M/N', E_Extension uses 'E/e', etc.).
 *
 * Token map (exhaustive for the vocabulary present in the data):
 *   N/N    → n/n      (wild-type, both loci)
 *   N/Prl  → prl/n    (Pearl carrier — engine recognises 'prl/n'/'n/prl')
 *   Prl/Prl→ prl/prl  (Pearl homozygous)
 *   Cr/Prl → Cr/prl   (Cream+Pearl compound; Cr stays uppercase, Prl→prl. Weight
 *                      is 0.0 everywhere so it is never generated, but normalize
 *                      for consistency.)
 *   N/BR1  → br1/n    (Brindle carrier — engine only checks `!== 'n/n'`)
 *   BR1/BR1→ br1/br1  (Brindle homozygous)
 *   BR1/Y  → br1/y    (Brindle hemizygous, sex-linked)
 *
 * The transform is scoped to the JSON value position of each locus key so it can
 * never corrupt an unrelated 'N/N' belonging to MFSD12_Mushroom.
 */
function normalizeLocusAlleleCase(profileJson, locusKey, tokenMap) {
  // Match the locus key and the (array or object) value that follows it, and
  // rewrite ONLY the quoted allele-pair tokens inside that value span.
  const keyRe = new RegExp(`("${locusKey}"\\s*:\\s*)(\\[[^\\]]*\\]|\\{[^}]*\\})`, 'g');
  return profileJson.replace(keyRe, (match, prefix, valueSpan) => {
    let rewritten = valueSpan;
    for (const [from, to] of Object.entries(tokenMap)) {
      // Replace the quoted token exactly (e.g. "Prl/Prl" → "prl/prl").
      rewritten = rewritten.split(`"${from}"`).join(`"${to}"`);
    }
    return prefix + rewritten;
  });
}

const PEARL_TOKEN_MAP = {
  'N/N': 'n/n',
  'N/Prl': 'prl/n',
  'Prl/Prl': 'prl/prl',
  'Cr/Prl': 'Cr/prl',
};

const BRINDLE_TOKEN_MAP = {
  'N/N': 'n/n',
  'N/BR1': 'br1/n',
  'BR1/BR1': 'br1/br1',
  'BR1/Y': 'br1/y',
};

/**
 * Sanitize a raw SQL string from the breed data files.
 *
 * The files reference snake_case column names and an updated_at column that
 * do not match the current Prisma schema. This function normalises them.
 *
 * @param {string} sql - Raw SQL from a .txt breed file
 * @returns {string} - Sanitized SQL ready for execution
 */
export function sanitizeSql(sql) {
  let out = sql
    // Rename snake_case columns to match Prisma-generated camelCase columns
    .replace(/\bbreed_genetic_profile\b/g, '"breedGeneticProfile"')
    .replace(/\bdefault_trait\b/g, '"defaultTrait"')
    // Remove trailing updated_at assignment from ON CONFLICT DO UPDATE SET
    // Handles both:  ,\n  updated_at = NOW()   and   , updated_at = NOW()
    .replace(/,\s*updated_at\s*=\s*NOW\(\)/gi, '');

  // Equoria-26qjf.3: normalize Pearl/Brindle allele case to the engine's
  // canonical lowercase (scoped to those two loci only — see comment above).
  out = normalizeLocusAlleleCase(out, 'Prl_Pearl', PEARL_TOKEN_MAP);
  out = normalizeLocusAlleleCase(out, 'BR1_Brindle1', BRINDLE_TOKEN_MAP);

  return out;
}

// ─── Equoria-i8vt8 — breed-starter-stats sync helpers ──────────────────────
//
// The 22y89 fix added 13 missing breed entries to breedStarterStats.json
// after the 26qjf.3 import drift surfaced. The root cause: breedStarterStats.json
// is hand-curated while the breeds table is data-imported — they drift, and the
// marketplace buyStoreHorse flow throws 500 on any missing breed name. This
// helper closes that loop by inspecting the import dir AFTER a successful
// import and appending a default starter-stats profile for any breed name that
// isn't already in the JSON. Existing curated entries are PRESERVED — sync
// adds, never overwrites.
//
// Pure, no DB. Tests at backend/modules/horses/__tests__/syncBreedStarterStats.test.mjs.

/**
 * Canonical 12 stat keys that every breed starter-stats profile must contain.
 * Mirrors the keys used in backend/services/horseStarterStats.mjs and the
 * shape every existing breedStarterStats.json entry already has.
 */
export const DEFAULT_STARTER_STAT_KEYS = Object.freeze([
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'intelligence',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'endurance',
  'strength',
]);

const DEFAULT_STARTER_STAT_MEAN_RANGE = Object.freeze([14, 18]);
const DEFAULT_STARTER_STAT_STD = 3;

// Deterministic per-stat default means in [14, 18], cycling through the range
// so the generated profile matches the visual shape of an existing curated
// entry (mixed means across the 5-wide window, not flat 16/16/16). Pin to a
// fixed sequence so repeat imports never produce drift on the same input.
const DEFAULT_STARTER_STAT_MEANS = Object.freeze({
  speed: 14,
  stamina: 18,
  agility: 16,
  balance: 16,
  precision: 15,
  intelligence: 18,
  boldness: 17,
  flexibility: 15,
  obedience: 16,
  focus: 16,
  endurance: 18,
  strength: 16,
});

/**
 * Return a default starter-stats profile of the canonical shape:
 *   { speed: {mean, std}, stamina: {mean, std}, ... } for all 12 stats.
 *
 * Means are integers in [14, 18] (matches the curated baseline) and std is
 * 3 (matches every existing entry in backend/data/breedStarterStats.json).
 *
 * Deterministic: same call → same output, so repeat imports don't drift the
 * file's contents.
 *
 * @returns {Record<string, {mean: number, std: number}>}
 */
export function generateDefaultStarterStats() {
  const profile = {};
  for (const stat of DEFAULT_STARTER_STAT_KEYS) {
    const mean = DEFAULT_STARTER_STAT_MEANS[stat];
    // Defensive — would only ever trip if the canonical key list and the
    // mean lookup drift in this file. Fail loud so the next contributor
    // doesn't silently ship an undefined mean.
    if (
      !Number.isInteger(mean) ||
      mean < DEFAULT_STARTER_STAT_MEAN_RANGE[0] ||
      mean > DEFAULT_STARTER_STAT_MEAN_RANGE[1]
    ) {
      throw new Error(
        `generateDefaultStarterStats: missing or out-of-range mean for stat '${stat}'`,
      );
    }
    profile[stat] = { mean, std: DEFAULT_STARTER_STAT_STD };
  }
  return profile;
}

/**
 * Extract the breed name from a single breed SQL .txt file body.
 *
 * Format (per backend/data/breeds/*.txt):
 *   INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES
 *   ('<NAME>', 'Trait', $json${ ... }$json$::JSONB)
 *
 * SQL escapes a single quote inside the literal by doubling it (O''Brien).
 * We collapse `''` → `'` so callers see the JSON-/JS-level form ('O\'Brien').
 *
 * @param {string} sql - The raw .txt file body
 * @returns {string|null} - The breed name, or null if no INSERT row could be parsed.
 */
function parseBreedNameFromSql(sql) {
  // Match `VALUES\n('Some Name',` (the very first row literal). Use a
  // non-greedy capture stopping at the first un-doubled single quote.
  const match = sql.match(/VALUES\s*\(\s*'((?:[^']|'')*)'/);
  if (!match) return null;
  return match[1].replace(/''/g, "'");
}

/**
 * Walk a directory of breed SQL .txt files and return the breed names found
 * inside, sorted lexicographically. Skips the same meta/reference files the
 * importer skips (SKIP_FILES).
 *
 * Fail-loud: a .txt file whose body does NOT contain a parseable INSERT
 * throws. We do not silently drop the file — that would re-introduce the
 * exact silent-drift class this helper exists to prevent.
 *
 * @param {string} dataDir - Path to the breeds directory (e.g. backend/data/breeds)
 * @returns {Promise<string[]>}
 */
export async function extractBreedNamesFromSqlDir(dataDir) {
  const entries = await readdir(dataDir);
  const txtFiles = entries.filter(f => f.endsWith('.txt')).sort();

  const names = [];
  for (const file of txtFiles) {
    if (SKIP_FILES.has(file)) continue;
    const body = await readFile(join(dataDir, file), 'utf8');
    const name = parseBreedNameFromSql(body);
    if (name === null) {
      throw new Error(
        `extractBreedNamesFromSqlDir: could not parse breed name from ${file} ` +
          `(no INSERT … VALUES ('<name>', …) row found)`,
      );
    }
    names.push(name);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

/**
 * Sync breedStarterStats.json so it has an entry for every breed name found
 * in the import directory. Existing entries are PRESERVED (the file is hand-
 * curated for known breeds — we only fill gaps). Returns the audit so the
 * caller can log what changed.
 *
 * Writes the file only when at least one entry was added — a clean run is
 * byte-identical (no spurious diff churn). When `dryRun: true`, no write
 * happens at all.
 *
 * @param {object} opts
 * @param {string} opts.dataDir - Path to the breeds directory
 * @param {string} opts.jsonPath - Path to backend/data/breedStarterStats.json
 * @param {boolean} [opts.dryRun] - If true, do not write the JSON file.
 * @returns {Promise<{ added: string[], missingBefore: string[], missingAfter: string[] }>}
 */
export async function syncBreedStarterStatsJson({ dataDir, jsonPath, dryRun = false }) {
  const sqlNames = await extractBreedNamesFromSqlDir(dataDir);

  const existingRaw = await readFile(jsonPath, 'utf8');
  const existing = JSON.parse(existingRaw);

  const presentSet = new Set(Object.keys(existing));
  const missingBefore = sqlNames.filter(n => !presentSet.has(n));

  if (missingBefore.length === 0) {
    return { added: [], missingBefore: [], missingAfter: [] };
  }

  const next = { ...existing };
  for (const name of missingBefore) {
    next[name] = generateDefaultStarterStats();
  }

  // Sort keys lexicographically so the file diff stays small and predictable
  // across imports. Existing files do not enforce this, but a stable order
  // is the conservative choice when we ARE rewriting.
  const sortedNext = {};
  for (const key of Object.keys(next).sort((a, b) => a.localeCompare(b))) {
    sortedNext[key] = next[key];
  }

  if (!dryRun) {
    await writeFile(jsonPath, JSON.stringify(sortedNext, null, 2) + '\n', 'utf8');
  }

  // Sanity check: after the sync, no SQL-side names should still be missing
  // unless the dry-run flag suppressed the write. For dry-run, the on-disk
  // state is unchanged so we report the same set in both fields — the audit
  // describes WHAT WOULD BE missing if the writer had run, which is the empty
  // set per design.
  const missingAfter = sqlNames.filter(n => !Object.prototype.hasOwnProperty.call(sortedNext, n));

  return { added: missingBefore.slice(), missingBefore, missingAfter };
}

/**
 * Populate the breeds table from all .txt files in docs/BreedData/.
 *
 * Runs each file as an idempotent upsert. Already-existing breeds are updated;
 * new breeds are inserted.  Errors in individual files are collected and
 * returned rather than aborting the whole run.
 *
 * @param {object} [prismaClient] - Optional Prisma client (injected for testing)
 * @returns {Promise<{processed: number, skipped: number, errors: Array, totalBreeds: number, success: boolean}>}
 */
export async function populateBreedsFromSql(prismaClient) {
  // Allow dependency injection for testing; fall back to real client
  let prisma = prismaClient;
  let ownPrisma = false;

  if (!prisma) {
    const { default: defaultPrisma } = await import('../../packages/database/prismaClient.mjs');
    prisma = defaultPrisma;
    ownPrisma = true;
  }

  const errors = [];
  let processed = 0;
  let skipped = 0;

  try {
    const allFiles = await readdir(BREED_DATA_DIR);

    const breedFiles = allFiles.filter(f => f.endsWith('.txt')).sort();

    for (const file of breedFiles) {
      if (SKIP_FILES.has(file)) {
        skipped++;
        continue;
      }

      const filePath = join(BREED_DATA_DIR, file);

      try {
        const rawSql = await readFile(filePath, 'utf8');
        const sql = sanitizeSql(rawSql);
        await prisma.$executeRawUnsafe(sql);
        processed++;
      } catch (err) {
        errors.push({ file, error: err.message });
      }
    }

    const totalBreeds = await prisma.breed.count();

    // Equoria-i8vt8: close the breedStarterStats.json drift class. After a
    // successful import (errors.length === 0), ensure every breed name we
    // just imported has a starter-stats entry; append defaults for any gap.
    // On error we skip the sync because the imported breed set is unreliable
    // — we'd rather rerun cleanly than half-sync.
    let starterStatsSync = null;
    if (errors.length === 0) {
      try {
        starterStatsSync = await syncBreedStarterStatsJson({
          dataDir: BREED_DATA_DIR,
          jsonPath: join(__dirname, '..', 'data', 'breedStarterStats.json'),
        });
      } catch (syncErr) {
        // Fail loud — a sync failure indicates a malformed .txt or JSON file
        // and silently swallowing it would re-introduce the very drift class
        // this helper exists to prevent. Surface as an import-level error
        // so callers see it in the same `errors` channel.
        errors.push({ file: 'breedStarterStats.json', error: `sync failed: ${syncErr.message}` });
      }
    }

    return {
      processed,
      skipped,
      errors,
      totalBreeds,
      starterStatsSync,
      success: errors.length === 0,
    };
  } finally {
    if (ownPrisma) {
      await prisma.$disconnect();
    }
  }
}

// Allow running directly as a script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  populateBreedsFromSql()
    .then(result => {
      console.log('✅ Breed population complete');
      console.log(`   Processed : ${result.processed}`);
      console.log(`   Skipped   : ${result.skipped}`);
      console.log(`   Total rows: ${result.totalBreeds}`);
      if (result.starterStatsSync) {
        console.log(
          `   Starter stats sync: ${result.starterStatsSync.added.length} new entry/entries ` +
            `(missing-before=${result.starterStatsSync.missingBefore.length}, ` +
            `missing-after=${result.starterStatsSync.missingAfter.length})`,
        );
      }
      if (result.errors.length > 0) {
        console.error(`   Errors (${result.errors.length}):`);
        result.errors.forEach(e => console.error(`     ${e.file}: ${e.error}`));
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
