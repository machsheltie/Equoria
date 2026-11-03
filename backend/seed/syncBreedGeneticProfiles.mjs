/**
 * syncBreedGeneticProfiles.mjs (Equoria-hxhqk)
 *
 * Copies each breed's genetic profile from the breed data files into
 * `breeds.breedGeneticProfile` for breeds that ALREADY EXIST in the target
 * database. By default it touches nothing else:
 *   - updates only the `breedGeneticProfile` column,
 *   - never inserts a breed, never deletes a breed,
 *   - never changes `name`, `description` or `defaultTrait`,
 *   - skips rows whose stored profile already equals the file profile
 *     (jsonb equality), so a second run changes 0 rows.
 *
 * --insert-missing (Equoria-rd1ed): production's breeds table was filled from
 * an older breed-name list, not from these files, so three file breeds never
 * got a row (Pony Of The Americas, Taishū horse — prod had the ASCII
 * 'Taishu horse' — and Tennessee Walking Horse), and this update-only sync
 * could not add them. With the flag, a file breed with no row is inserted with
 * the file's name, default_trait and profile (ON CONFLICT DO NOTHING, so a
 * second run inserts 0). A file breed whose name matches an existing row once
 * accents and case are folded is NOT inserted; it is reported as a near
 * duplicate for a person to resolve.
 *
 * --remove-retired (Equoria-rd1ed, owner ruling q337 2026-11-03: "keep
 * 'Tennessee Walking Horse' and remove the duplicate 'Tennessee Walking'"):
 * deletes the DB rows for the breed names in retiredBreedNames. A retired name
 * that still has a .txt file is refused (the files must go first), and a row
 * that any horse still points at is never deleted; it is reported instead.
 * The delete is one guarded statement, so a second run deletes 0.
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
 *   Also insert file breeds that have no DB row (dry run, then apply):
 *     node backend/seed/syncBreedGeneticProfiles.mjs --insert-missing --dry-run
 *     node backend/seed/syncBreedGeneticProfiles.mjs --insert-missing --apply
 *   Remove the retired duplicate breed rows (dry run, then apply):
 *     node backend/seed/syncBreedGeneticProfiles.mjs --remove-retired --dry-run
 *     node backend/seed/syncBreedGeneticProfiles.mjs --remove-retired --apply
 *   (--dry-run is the default and is accepted to make the intent explicit;
 *   it wins if both --dry-run and --apply are given.)
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
 * @returns {{ name: string, defaultTrait: string, profile: object }}
 */
export function parseBreedSourceFile(rawSql, fileLabel) {
  const sql = sanitizeSql(rawSql);
  const nameMatch = sql.match(/VALUES\s*\(\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'/);
  if (!nameMatch) {
    throw new Error(
      `${fileLabel}: no INSERT ... VALUES ('<name>', '<default_trait>', ...) row found`,
    );
  }
  const name = nameMatch[1].replace(/''/g, "'");
  const defaultTrait = nameMatch[2].replace(/''/g, "'");
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
  return { name, defaultTrait, profile };
}

/**
 * Read every breed .txt file in a directory.
 *
 * @param {string} [dataDir]
 * @returns {Promise<Map<string, object>>} breed name -> full profile
 */
export async function loadBreedSourceProfiles(dataDir = defaultBreedDataDir) {
  const rows = await loadBreedSourceRows(dataDir);
  return new Map([...rows].map(([name, row]) => [name, row.profile]));
}

/**
 * Read every breed .txt file in a directory, keeping its default_trait.
 *
 * @param {string} [dataDir]
 * @returns {Promise<Map<string, { defaultTrait: string, profile: object }>>}
 */
export async function loadBreedSourceRows(dataDir = defaultBreedDataDir) {
  const files = (await readdir(dataDir))
    .filter(f => f.endsWith('.txt') && !skipFiles.has(f))
    .sort();
  const rows = new Map();
  for (const file of files) {
    const { name, defaultTrait, profile } = parseBreedSourceFile(
      await readFile(join(dataDir, file), 'utf8'),
      file,
    );
    if (rows.has(name)) {
      throw new Error(`${file}: breed "${name}" is defined by more than one file`);
    }
    rows.set(name, { defaultTrait, profile });
  }
  return rows;
}

/** Fold a breed name for near-duplicate detection: accents and case removed. */
export function foldBreedName(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
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
 * @param {boolean} [opts.insertMissing=false] - also insert file breeds with no row
 * @param {Map<string, string>} [opts.defaultTraits] - breed name -> default_trait,
 *   required for every breed insertMissing would insert
 * @returns {Promise<{
 *   apply: boolean,
 *   sourceCount: number,
 *   changed: string[],        // updated (apply) or would update (dry run)
 *   alreadyInSync: number,
 *   missingInDb: string[],    // file breeds with no DB row after this run
 *   inserted: string[],       // inserted (apply) or would insert (dry run)
 *   nearDuplicates: Array<{ file: string, db: string }>, // not inserted: name clash
 *   dbWithoutSource: string[] // DB breeds with no file (left untouched)
 * }>}
 */
export async function syncBreedGeneticProfiles(
  db,
  { profiles, apply = false, insertMissing = false, defaultTraits = new Map() },
) {
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
  let missingInDb = names.filter(n => !existingNames.has(n)).sort();

  const inserted = [];
  const nearDuplicates = [];
  if (insertMissing && missingInDb.length > 0) {
    const allDbNames = (await db.$queryRawUnsafe('SELECT name FROM breeds')).map(r => r.name);
    const dbByFold = new Map(allDbNames.map(n => [foldBreedName(n), n]));
    const toInsert = [];
    for (const name of missingInDb) {
      const clash = dbByFold.get(foldBreedName(name));
      if (clash !== undefined) {
        nearDuplicates.push({ file: name, db: clash });
        continue;
      }
      const defaultTrait = defaultTraits.get(name);
      if (typeof defaultTrait !== 'string' || defaultTrait.length === 0) {
        throw new Error(`insertMissing: no defaultTrait for "${name}"`);
      }
      toInsert.push({ name, defaultTrait, profile: profiles.get(name) });
    }
    if (apply && toInsert.length > 0) {
      const rows = await db.$queryRawUnsafe(
        `INSERT INTO breeds (name, "defaultTrait", "breedGeneticProfile")
         SELECT r->>'name', r->>'defaultTrait', r->'profile'
           FROM jsonb_array_elements($1::jsonb) AS r
         ON CONFLICT (name) DO NOTHING
         RETURNING name`,
        JSON.stringify(toInsert),
      );
      inserted.push(...rows.map(r => r.name));
      const insertedNames = new Set(inserted);
      missingInDb = missingInDb.filter(n => !insertedNames.has(n));
    } else {
      inserted.push(...toInsert.map(r => r.name));
    }
    inserted.sort();
  }

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
    inserted,
    nearDuplicates,
    dbWithoutSource: others.map(r => r.name),
  };
}

/**
 * Breed names the owner has retired. Their seed files and JSON entries are
 * already gone; --remove-retired deletes any DB row still carrying the name.
 * q337 (2026-11-03): 'Tennessee Walking' duplicated 'Tennessee Walking Horse'.
 */
export const retiredBreedNames = Object.freeze(['Tennessee Walking']);

/**
 * Delete the DB rows of retired breed names that no horse references.
 *
 * @param {object} db - a Prisma client (or interactive transaction client)
 * @param {object} opts
 * @param {Map<string, object>} opts.profiles - the current source breeds; a
 *   retired name still among them is refused
 * @param {boolean} [opts.apply=false] - false = report only, delete nothing
 * @param {readonly string[]} [opts.retiredNames=retiredBreedNames]
 * @returns {Promise<{
 *   apply: boolean,
 *   removed: string[],                              // deleted (apply) or would delete (dry run)
 *   inUse: Array<{ name: string, horses: number }>, // kept: horses still point at it
 * }>}
 */
export async function removeRetiredBreeds(
  db,
  { profiles, apply = false, retiredNames = retiredBreedNames },
) {
  if (!(profiles instanceof Map) || profiles.size === 0) {
    throw new Error('removeRetiredBreeds requires a non-empty Map of breed profiles');
  }
  const stillInFiles = retiredNames.filter(n => profiles.has(n));
  if (stillInFiles.length > 0) {
    throw new Error(
      `removeRetiredBreeds: retired breed(s) still have a .txt file: ${stillInFiles.join(', ')}`,
    );
  }
  const names = [...retiredNames];
  const rows = await db.$queryRawUnsafe(
    `SELECT b.name, (SELECT count(*)::int FROM horses h WHERE h."breedId" = b.id) AS horses
       FROM breeds b WHERE b.name = ANY($1::text[]) ORDER BY b.name`,
    names,
  );
  const inUse = rows.filter(r => r.horses > 0).map(r => ({ name: r.name, horses: r.horses }));
  let removed;
  if (apply) {
    const deleted = await db.$queryRawUnsafe(
      `DELETE FROM breeds b
        WHERE b.name = ANY($1::text[])
          AND NOT EXISTS (SELECT 1 FROM horses h WHERE h."breedId" = b.id)
        RETURNING b.name`,
      names,
    );
    removed = deleted.map(r => r.name);
  } else {
    removed = rows.filter(r => r.horses === 0).map(r => r.name);
  }
  return { apply, removed: removed.sort(), inUse };
}

function describeTarget() {
  const url = process.env.DATABASE_URL ?? '';
  const match = url.match(/@([^/?]+)\/([^?]*)/);
  return match ? `${match[1]}/${match[2]}` : '(DATABASE_URL not parsed)';
}

async function main() {
  const apply = process.argv.includes('--apply') && !process.argv.includes('--dry-run');
  const insertMissing = process.argv.includes('--insert-missing');
  const removeRetired = process.argv.includes('--remove-retired');
  const rows = await loadBreedSourceRows();
  const profiles = new Map([...rows].map(([name, row]) => [name, row.profile]));
  const defaultTraits = new Map([...rows].map(([name, row]) => [name, row.defaultTrait]));
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
    if (removeRetired) {
      const gone = await removeRetiredBreeds(prisma, { profiles, apply });
      console.log(
        `  retired breed rows ${apply ? 'deleted' : 'would delete'}: ${gone.removed.length}`,
      );
      gone.removed.forEach(n => console.log(`    x ${n}`));
      console.log(`  retired breed rows kept, horses still use them: ${gone.inUse.length}`);
      gone.inUse.forEach(u => console.log(`    ! ${u.name} (${u.horses} horses)`));
    }
    const r = await syncBreedGeneticProfiles(prisma, {
      profiles,
      apply,
      insertMissing,
      defaultTraits,
    });
    console.log(`  ${apply ? 'updated' : 'would update'}: ${r.changed.length}`);
    console.log(`  already in sync: ${r.alreadyInSync}`);
    if (insertMissing) {
      console.log(`  ${apply ? 'inserted' : 'would insert'}: ${r.inserted.length}`);
      r.inserted.forEach(n => console.log(`    + ${n}`));
      console.log(
        `  not inserted, name matches a DB row apart from accents/case: ${r.nearDuplicates.length}`,
      );
      r.nearDuplicates.forEach(d => console.log(`    ! file "${d.file}" vs DB "${d.db}"`));
    }
    console.log(
      `  file breeds with no DB row${insertMissing ? '' : ' (not inserted; see --insert-missing)'}: ${r.missingInDb.length}`,
    );
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
