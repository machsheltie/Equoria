/**
 * breedCountSentinel.test.mjs (Equoria-oau0u)
 *
 * Real-DB regression gate for the 312-breed roster landed by Equoria-26qjf.3.
 *
 * Asserts that every breed file in the canonical source directory
 * (`backend/data/breeds/`, where `populateBreedsFromSql.mjs` reads from
 * post-26qjf.3) has a corresponding `breeds` row with:
 *   - a non-null breedGeneticProfile JSONB column, AND
 *   - a `shade_bias` key inside that profile.
 *
 * Why this exists:
 *   The Equoria-c3kb6 DB-nuke incident (2026-05-28) silently wiped the breeds
 *   table to 3 rows mid-suite — exactly the failure mode that would have
 *   tripped this sentinel and surfaced the regression at test time rather
 *   than at first-player-render time. The earlier 100%-standard-shade
 *   investigation (see Equoria-mxhpi) found the same class of defect: data
 *   missing from DB → engine silently degrades, no test catches it.
 *
 * Pattern: pure comparison function + real-DB invariant check.
 *   `findMissingBreedNames(expected, dbWithShadeBias)` is unit-tested with
 *   synthetic input so the comparison logic is independently provable; the
 *   real-DB test calls the same function so any regression surfaces via the
 *   same error path.
 */

import { readdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import prisma from '../../packages/database/prismaClient.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Canonical breed source directory. Must match `BREED_DATA_DIR` in
// backend/seed/populateBreedsFromSql.mjs — if the importer moves, this path
// moves with it (so the sentinel keeps measuring the right thing).
const BREED_DATA_DIR = resolve(__dirname, '..', 'data', 'breeds');

// Files in BREED_DATA_DIR that are NOT breed inserts. Mirrors the importer's
// SKIP_FILES so the sentinel never falsely flags a meta file as a missing
// breed.
const SKIP_FILES = new Set([
  'seed.sql',
  'populate_breed_ratings.sql',
  'populate_breed_temperaments.sql',
  'generichorse.txt',
  '_breed-list.txt',
  '_gait-registry.txt',
]);

// Lower bound landed by Equoria-26qjf.3. Asserted as `>=` (not `==`) so the
// roster can grow without breaking the gate; only contraction below 312
// (i.e. a real regression) trips this assertion.
const EXPECTED_MIN_BREEDS = 312;

/**
 * Strip .txt and unescape SQL-doubled apostrophes from a breed filename so
 * it matches the canonical breed name as inserted by the SQL files.
 * (e.g. `M''Par.txt` on disk becomes `M'Par` in DB.)
 */
function breedNameFromFile(filename) {
  return filename.slice(0, -'.txt'.length).replace(/''/g, "'");
}

/**
 * Build the set of expected breed names by listing the canonical source dir
 * and filtering out non-breed files. Pure I/O — no DB.
 */
async function expectedBreedNamesFromFiles() {
  const all = await readdir(BREED_DATA_DIR);
  const names = new Set();
  for (const file of all) {
    if (!file.endsWith('.txt')) {
      continue;
    }
    if (SKIP_FILES.has(file)) {
      continue;
    }
    names.add(breedNameFromFile(file));
  }
  return names;
}

/**
 * Pure comparison: which expected breed names are NOT in the DB-with-shade-bias
 * set? Independently unit-testable; the real-DB test calls the same function so
 * a regression surfaces through the same code path that the sentinel-positive
 * proof exercises.
 *
 * @param {Set<string>} expected
 * @param {Set<string>} dbWithShadeBias
 * @returns {string[]} sorted list of names present in `expected` but missing
 *   from `dbWithShadeBias`
 */
export function findMissingBreedNames(expected, dbWithShadeBias) {
  const missing = [];
  for (const name of expected) {
    if (!dbWithShadeBias.has(name)) {
      missing.push(name);
    }
  }
  return missing.sort();
}

describe('breed-count sentinel (Equoria-oau0u — post-26qjf.3 regression gate)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it(`every breed in ${BREED_DATA_DIR} has a DB row with shade_bias`, async () => {
    const expected = await expectedBreedNamesFromFiles();

    // Defense-in-depth: catch a future glob/path regression that would
    // silently produce an empty expected set (and then trivially "pass").
    expect(expected.size).toBeGreaterThanOrEqual(EXPECTED_MIN_BREEDS);

    const rows = await prisma.breed.findMany({
      select: { name: true, breedGeneticProfile: true },
    });

    const dbWithShadeBias = new Set();
    for (const r of rows) {
      const p = r.breedGeneticProfile;
      // JSONB column can arrive as null/primitive/array/object — enforce the
      // four-part guard (see CONTRIBUTING.md "JSONB type guard").
      if (
        p !== null &&
        p !== undefined &&
        typeof p === 'object' &&
        !Array.isArray(p) &&
        p.shade_bias !== undefined &&
        p.shade_bias !== null
      ) {
        dbWithShadeBias.add(r.name);
      }
    }

    const missing = findMissingBreedNames(expected, dbWithShadeBias);

    // Custom error surface: list the actual delta so a tester reading the
    // failure can immediately see which breed(s) regressed (file present vs
    // DB absent). Capped to avoid log spam if the breeds table got wiped.
    if (missing.length > 0) {
      const preview = missing.slice(0, 20).join(', ');
      const suffix = missing.length > 20 ? ` (... +${missing.length - 20} more)` : '';
      throw new Error(
        `[breedCountSentinel] ${missing.length} breed(s) present in ${BREED_DATA_DIR} ` +
          `but missing from DB (or missing shade_bias on their profile): ${preview}${suffix}. ` +
          `Run \`npm run seed:breeds\` from backend/ to re-import.`,
      );
    }

    expect(dbWithShadeBias.size).toBeGreaterThanOrEqual(expected.size);
  });
});

describe('breed-count sentinel — comparison helper (Equoria-oau0u sentinel-positive)', () => {
  it('findMissingBreedNames returns the expected delta when a breed is missing', () => {
    const expected = new Set(['BreedA', 'BreedB', 'BreedC', 'BreedD']);
    const dbHas = new Set(['BreedA', 'BreedC']);
    expect(findMissingBreedNames(expected, dbHas)).toEqual(['BreedB', 'BreedD']);
  });

  it('findMissingBreedNames returns [] when DB is a superset of expected', () => {
    const expected = new Set(['BreedA', 'BreedB']);
    const dbHas = new Set(['BreedA', 'BreedB', 'BreedC']);
    expect(findMissingBreedNames(expected, dbHas)).toEqual([]);
  });

  it('findMissingBreedNames returns the full expected list when DB is empty', () => {
    const expected = new Set(['BreedA', 'BreedB']);
    expect(findMissingBreedNames(expected, new Set())).toEqual(['BreedA', 'BreedB']);
  });

  it('findMissingBreedNames returns [] when both sets are empty', () => {
    expect(findMissingBreedNames(new Set(), new Set())).toEqual([]);
  });

  it('findMissingBreedNames handles apostrophe-bearing breed names', () => {
    const expected = new Set(["M'Par", "M'Bayar"]);
    const dbHas = new Set(["M'Par"]);
    expect(findMissingBreedNames(expected, dbHas)).toEqual(["M'Bayar"]);
  });
});
