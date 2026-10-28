/**
 * syncBreedGeneticProfiles.mjs (Equoria-hxhqk)
 *
 * Copies each breed's genetic profile from the breed data files into
 * `breeds.breedGeneticProfile` for breeds that ALREADY EXIST in the target
 * database. It touches nothing else:
 *   - updates only the `breedGeneticProfile` column,
 *   - never inserts a breed, never deletes a breed,
 *   - never changes `name`, `description` or `defaultTrait`,
 *   - skips rows whose stored profile already equals the file profile
 *     (jsonb equality), so a second run changes 0 rows.
 *
 * Source of the profile: backend/data/breeds/*.txt — the files
 * populateBreedsFromSql.mjs loads into the DB locally. They carry the FULL
 * profile (color genetics + ratingProfiles + temperamentWeights). The
 * backend/data/breedProfiles.json file carries only the ratingProfiles +
 * temperamentWeights subset, so it cannot be the copy source on its own; it is
 * read as a cross-check instead. Owner ruling 2026-10-22: one breed data set
 * across the seed .txt, the JSON and the DB. If any breed's ratingProfiles or
 * temperamentWeights differ between a .txt file and the JSON (or a breed is in
 * one and not the other) the script refuses to run and writes nothing.
 *
 * The Pearl / Brindle allele-case normalization that populateBreedsFromSql
 * applies is reused (sanitizeSql), so the synced profile is byte-for-byte what
 * a local `npm run seed:breeds` stores.
 *
 * Usage (from the repository root; DATABASE_URL in the environment wins over
 * backend/.env):
 *   Dry run (default, writes nothing):
 *     node backend/seed/syncBreedGeneticProfiles.mjs
 *   Apply:
 *     node backend/seed/syncBreedGeneticProfiles.mjs --apply
 *
 * Output: counts of breeds that would update / updated, already in sync,
 * file breeds with no DB row (never inserted), and DB breeds with no file.
 */

import { readFileSync } from 'fs';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sanitizeSql } from './populateBreedsFromSql.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const defaultBreedDataDir = join(__dirname, '..', 'data', 'breeds');
export const defaultBreedProfilesJson = join(__dirname, '..', 'data', 'breedProfiles.json');

// Same meta/template exclusions as the populateBreedsFromSql.mjs skip list.
const skipFiles = new Set(['generichorse.txt', '_breed-list.txt', '_gait-registry.txt']);

/**
 * Parse one breed .txt file into { name, profile }.
 * Throws on any file that is not a single-breed INSERT with a $json$ profile.
 *
 * @param {string} rawSql
 * @param {string} fileLabel - used in error messages
 * @returns {{ name: string, profile: object }}
 */
export function parseBreedSourceFile(rawSql, fileLabel) {
  const sql = sanitizeSql(rawSql);
  const nameMatch = sql.match(/VALUES\s*\(\s*'((?:[^']|'')*)'/);
  if (!nameMatch) {
    throw new Error(`${fileLabel}: no INSERT ... VALUES ('<name>', ...) row found`);
  }
  const name = nameMatch[1].replace(/''/g, "'");
  const start = sql.indexOf('$json$');
  const end = start === -1 ? -1 : sql.indexOf('$json$', start + '$json$'.length);
  if (start === -1 || end === -1) {
    throw new Error(`${fileLabel}: no $json$ ... $json$ profile found`);
  }
  let profile;
  try {
    profile = JSON.parse(sql.slice(start + '$json$'.length, end));
  } catch (err) {
    throw new Error(`${fileLabel}: profile JSON does not parse: ${err.message}`, { cause: err });
  }
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`${fileLabel}: profile is not a JSON object`);
  }
  if (!profile.ratingProfiles || !profile.temperamentWeights) {
    throw new Error(`${fileLabel}: profile lacks ratingProfiles or temperamentWeights`);
  }
  return { name, profile };
}

/**
 * Read every breed .txt file in a directory.
 *
 * @param {string} [dataDir]
 * @returns {Promise<Map<string, object>>} breed name -> full profile
 */
export async function loadBreedSourceProfiles(dataDir = defaultBreedDataDir) {
  const files = (await readdir(dataDir))
    .filter(f => f.endsWith('.txt') && !skipFiles.has(f))
    .sort();
  const profiles = new Map();
  for (const file of files) {
    const { name, profile } = parseBreedSourceFile(
      await readFile(join(dataDir, file), 'utf8'),
      file,
    );
    if (profiles.has(name)) {
      throw new Error(`${file}: breed "${name}" is defined by more than one file`);
    }
    profiles.set(name, profile);
  }
  return profiles;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Cross-check the .txt profiles against breedProfiles.json. Returns a list of
 * human-readable problems; an empty list means the two agree.
 *
 * @param {Map<string, object>} sourceProfiles
 * @param {Record<string, object>} profilesJson
 * @returns {string[]}
 */
export function findSourceJsonDrift(sourceProfiles, profilesJson) {
  const problems = [];
  for (const [name, profile] of sourceProfiles) {
    const entry = profilesJson[name];
    if (!entry) {
      problems.push(`"${name}" has a .txt file but no breedProfiles.json entry`);
      continue;
    }
    for (const key of ['ratingProfiles', 'temperamentWeights']) {
      if (canonicalJson(profile[key]) !== canonicalJson(entry[key])) {
        problems.push(`"${name}" ${key} differs between its .txt file and breedProfiles.json`);
      }
    }
  }
  for (const name of Object.keys(profilesJson)) {
    if (!sourceProfiles.has(name)) {
      problems.push(`"${name}" is in breedProfiles.json but has no .txt file`);
    }
  }
  return problems;
}

/**
 * Sync `breeds.breedGeneticProfile` from the given profiles. Only rows whose
 * name matches a profile AND whose stored profile differs are touched; the
 * update is one statement, so it applies to all of them or none.
 *
 * @param {object} db - a Prisma client (or interactive transaction client)
 * @param {object} opts
 * @param {Map<string, object>} opts.profiles - breed name -> full profile
 * @param {boolean} [opts.apply=false] - false = report only, write nothing
 * @returns {Promise<{
 *   apply: boolean,
 *   sourceCount: number,
 *   changed: string[],        // updated (apply) or would update (dry run)
 *   alreadyInSync: number,
 *   missingInDb: string[],    // file breeds with no DB row (never inserted)
 *   dbWithoutSource: string[] // DB breeds with no file (left untouched)
 * }>}
 */
export async function syncBreedGeneticProfiles(db, { profiles, apply = false }) {
  if (!(profiles instanceof Map) || profiles.size === 0) {
    throw new Error('syncBreedGeneticProfiles requires a non-empty Map of breed profiles');
  }
  const payload = JSON.stringify(Object.fromEntries(profiles));
  const names = [...profiles.keys()];

  const existing = await db.$queryRawUnsafe(
    'SELECT name FROM breeds WHERE name = ANY($1::text[])',
    names,
  );
  const existingNames = new Set(existing.map(r => r.name));
  const missingInDb = names.filter(n => !existingNames.has(n)).sort();

  const changedRows = apply
    ? await db.$queryRawUnsafe(
        `WITH src AS (SELECT key AS name, value AS profile FROM jsonb_each($1::jsonb))
         UPDATE breeds b SET "breedGeneticProfile" = src.profile
           FROM src
          WHERE b.name = src.name
            AND b."breedGeneticProfile" IS DISTINCT FROM src.profile
         RETURNING b.name`,
        payload,
      )
    : await db.$queryRawUnsafe(
        `WITH src AS (SELECT key AS name, value AS profile FROM jsonb_each($1::jsonb))
         SELECT b.name FROM breeds b JOIN src ON b.name = src.name
          WHERE b."breedGeneticProfile" IS DISTINCT FROM src.profile`,
        payload,
      );
  const changed = changedRows.map(r => r.name).sort();

  const others = await db.$queryRawUnsafe(
    'SELECT name FROM breeds WHERE NOT (name = ANY($1::text[])) ORDER BY name',
    names,
  );

  return {
    apply,
    sourceCount: profiles.size,
    changed,
    alreadyInSync: existingNames.size - changed.length,
    missingInDb,
    dbWithoutSource: others.map(r => r.name),
  };
}

function describeTarget() {
  const url = process.env.DATABASE_URL ?? '';
  const match = url.match(/@([^/?]+)\/([^?]*)/);
  return match ? `${match[1]}/${match[2]}` : '(DATABASE_URL not parsed)';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const profiles = await loadBreedSourceProfiles();
  const drift = findSourceJsonDrift(
    profiles,
    JSON.parse(readFileSync(defaultBreedProfilesJson, 'utf8')),
  );
  if (drift.length > 0) {
    console.error(
      `Refusing to sync: ${drift.length} breed(s) differ between the .txt files and breedProfiles.json:`,
    );
    drift.forEach(p => console.error(`  - ${p}`));
    process.exitCode = 1;
    return;
  }

  const { default: prisma } = await import('../../packages/database/prismaClient.mjs');
  try {
    console.log(
      `breedGeneticProfile sync — target ${describeTarget()} — ${apply ? 'APPLY' : 'DRY RUN (no writes)'}`,
    );
    console.log(`  source breeds (.txt, agree with breedProfiles.json): ${profiles.size}`);
    const r = await syncBreedGeneticProfiles(prisma, { profiles, apply });
    console.log(`  ${apply ? 'updated' : 'would update'}: ${r.changed.length}`);
    console.log(`  already in sync: ${r.alreadyInSync}`);
    console.log(`  file breeds with no DB row (not inserted): ${r.missingInDb.length}`);
    r.missingInDb.forEach(n => console.log(`    - ${n}`));
    console.log(`  DB breeds with no file (left untouched): ${r.dbWithoutSource.length}`);
    r.dbWithoutSource.forEach(n => console.log(`    - ${n}`));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('syncBreedGeneticProfiles failed:', err);
    process.exitCode = 1;
  });
}
