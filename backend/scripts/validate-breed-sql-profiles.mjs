#!/usr/bin/env node
/**
 * Equoria-mxhpi: dry-run validator for breed SQL profile files.
 *
 * Scans samples/Breeds/**\/*.txt looking for INSERT INTO breeds (...) VALUES
 * statements with a $json$ ... $json$ body, parses each one, validates the
 * structural shape of the genetic profile JSONB, and cross-references each
 * breed name against the live `breeds` table to categorize INSERT vs UPDATE.
 *
 * READ-ONLY. NO DB WRITES.
 *
 * Exit codes:
 *   0 — all files validated, summary printed
 *   1 — at least one file failed structural validation
 *   2 — operational error (DB unavailable, samples dir missing, etc.)
 *
 * Output format: per-file status line + final summary with category counts
 * and the list of malformed files. The summary is the input the operator
 * uses to decide whether to authorize the actual import.
 *
 * Current state at landing: only 2 of the expected 311 breed SQL profile
 * files are present in the repo (samples/Breeds/generichorse.txt and
 * samples/Breeds/Saddlebred/AmericanSaddlebred.txt). The validator runs
 * cleanly against both. The other 309 will need to be added before the
 * actual import can happen — this script is then re-run end-to-end against
 * the full set.
 *
 * Run:
 *   node backend/scripts/validate-breed-sql-profiles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SAMPLES_DIR = path.join(REPO_ROOT, 'samples', 'Breeds');

const REQUIRED_TOP_LEVEL_KEYS = ['allowed_alleles', 'allele_weights', 'shade_bias', 'marking_bias'];
const OPTIONAL_TOP_LEVEL_KEYS = [
  'disallowed_combinations',
  'boolean_modifiers_prevalence',
  'advanced_markings_bias',
];

// Match INSERT INTO breeds (...) VALUES ('name', 'trait', $json$ … $json$::TYPE)
// The trait value can be a quoted literal; the JSONB body is wrapped in $json$
// dollar-quoting and may be followed by a ::JSONB cast before the closing paren.
const INSERT_RE =
  /INSERT\s+INTO\s+breeds\s*\([^)]+\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*\$json\$([\s\S]+?)\$json\$(?:::\w+)?\s*\)/i;

function findSqlFiles(dir, acc = []) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      findSqlFiles(full, acc);
    } else if (e.isFile() && e.name.endsWith('.txt') && !e.name.startsWith('_')) {
      // Skip _breed-list.txt and _gait-registry.txt — they are not profiles.
      acc.push(full);
    }
  }
  return acc;
}

function parseFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(INSERT_RE);
  if (!m) {
    return { kind: 'no_insert', filePath };
  }
  const [, breedName, defaultTrait, jsonBody] = m;
  let parsed;
  try {
    parsed = JSON.parse(jsonBody);
  } catch (err) {
    return { kind: 'bad_json', filePath, breedName, error: err.message };
  }
  return { kind: 'ok', filePath, breedName, defaultTrait, profile: parsed };
}

function validateProfile(profile) {
  const errors = [];

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in profile)) {
      errors.push(`missing required key: ${key}`);
    }
  }

  // Validate allele_weights sums (each locus's probabilities should sum to ~1.0).
  if (profile.allele_weights && typeof profile.allele_weights === 'object') {
    for (const [locus, weights] of Object.entries(profile.allele_weights)) {
      if (!weights || typeof weights !== 'object') {
        errors.push(`allele_weights[${locus}] is not an object`);
        continue;
      }
      const sum = Object.values(weights).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      if (Math.abs(sum - 1) > 0.001) {
        errors.push(`allele_weights[${locus}] sums to ${sum.toFixed(4)}, expected 1.0`);
      }
    }
  }

  // Validate every allele in allele_weights exists in allowed_alleles.
  if (
    profile.allele_weights &&
    profile.allowed_alleles &&
    typeof profile.allele_weights === 'object' &&
    typeof profile.allowed_alleles === 'object'
  ) {
    for (const locus of Object.keys(profile.allele_weights)) {
      const allowed = new Set(profile.allowed_alleles[locus] ?? []);
      if (allowed.size === 0) {
        errors.push(`locus ${locus}: allele_weights present but allowed_alleles missing`);
        continue;
      }
      for (const allele of Object.keys(profile.allele_weights[locus])) {
        if (!allowed.has(allele)) {
          errors.push(`locus ${locus}: weight for "${allele}" not in allowed_alleles`);
        }
      }
    }
  }

  return errors;
}

async function main() {
  const sqlFiles = findSqlFiles(SAMPLES_DIR);
  if (sqlFiles.length === 0) {
    console.error(`[mxhpi] no SQL profile files found under ${SAMPLES_DIR}`);
    process.exit(2);
  }

  // Pre-load the live breeds table so we can categorize INSERT vs UPDATE.
  let liveBreeds;
  try {
    liveBreeds = await prisma.breed.findMany({ select: { id: true, name: true } });
  } catch (err) {
    console.error(`[mxhpi] DB lookup failed: ${err.message}`);
    process.exit(2);
  }
  const liveNames = new Set(liveBreeds.map(b => b.name));

  const results = {
    ok_insert: [],
    ok_update: [],
    bad_json: [],
    bad_structure: [],
    no_insert: [],
  };

  for (const file of sqlFiles) {
    const rel = path.relative(REPO_ROOT, file);
    const parsed = parseFile(file);

    if (parsed.kind === 'no_insert') {
      console.log(`  [no-insert]   ${rel}`);
      results.no_insert.push(rel);
      continue;
    }
    if (parsed.kind === 'bad_json') {
      console.log(`  [bad-json]    ${rel}  ←  ${parsed.error}`);
      results.bad_json.push({ rel, error: parsed.error });
      continue;
    }

    const structErrors = validateProfile(parsed.profile);
    if (structErrors.length > 0) {
      console.log(`  [bad-struct]  ${rel}  (breed: ${parsed.breedName})`);
      for (const e of structErrors) {
        console.log(`                  - ${e}`);
      }
      results.bad_structure.push({ rel, breedName: parsed.breedName, errors: structErrors });
      continue;
    }

    const exists = liveNames.has(parsed.breedName);
    const tag = exists ? 'UPDATE' : 'INSERT';
    console.log(`  [${tag}]      ${rel}  (breed: ${parsed.breedName})`);
    if (exists) {
      results.ok_update.push({ rel, breedName: parsed.breedName });
    } else {
      results.ok_insert.push({ rel, breedName: parsed.breedName });
    }
  }

  console.log('\n=== mxhpi dry-run summary ===');
  console.log(`files scanned:     ${sqlFiles.length}`);
  console.log(`would INSERT:      ${results.ok_insert.length}`);
  console.log(`would UPDATE:      ${results.ok_update.length}`);
  console.log(`malformed JSON:    ${results.bad_json.length}`);
  console.log(`bad structure:     ${results.bad_structure.length}`);
  console.log(`no INSERT stmt:    ${results.no_insert.length}`);
  console.log(`live breeds table: ${liveBreeds.length} rows`);

  const failed = results.bad_json.length + results.bad_structure.length;
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[mxhpi] FATAL:', err);
  process.exit(2);
});
