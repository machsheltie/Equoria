/**
 * breedSourceGaitsTemperament.sentinel.test.mjs (Equoria-4xwj1)
 *
 * SOURCE-COMPLETENESS sentinel for the 312 breed source files in
 * backend/data/breeds/*.txt — SIBLING of
 * breedSourceConformationRegions.sentinel.test.mjs (Equoria-9cpop). Where
 * 9cpop guards the 8 conformation regions, this file guards two MORE required
 * source sections: `rating_profiles.gaits` and `temperament_weights`.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * The runtime validateProfile() in backend/seed/breedProfileValidator.mjs
 * only runs against the 12 hand-authored canonical .mjs profiles (via
 * breedGeneticProfiles.test.mjs) — NOT against the 312 .txt source files that
 * actually seed the canonical DB through populateBreedsFromSql.mjs. So nothing
 * asserts the .txt files KEEP their full gait set and 11-key temperament map.
 * A future hand-edit (a find/replace gone wrong, a new breed authored from a
 * stale template, a re-mirror that drops a gait) could silently strip a gait
 * or a temperament weight from one or more of the 312 files; the seed would
 * import an incomplete profile and no test would notice until a horse
 * generated from that breed scored wrong on the missing gait, or its
 * temperament rolled against an incomplete distribution.
 *
 * This sentinel closes that gap. For EVERY .txt source file it asserts:
 *   1. rating_profiles.gaits carries ALL 4 core gaits (walk/trot/canter/
 *      gallop), each with a finite mean and finite std_dev.
 *   2. The optional 5th gait key `gaiting` is consistent with
 *      is_gaited_breed: a gaited breed has a scored gaiting object (finite
 *      mean) plus a non-empty gaited_gait_registry; a non-gaited breed has
 *      gaiting === null. (This mirrors validateProfile()'s own is_gaited
 *      branch, so the source files are held to the same contract the runtime
 *      validator enforces on the canonical-12.)
 *   3. temperament_weights carries EXACTLY the 11 canonical keys, each an
 *      integer, summing to 100.
 *
 * ── Parse approach ─────────────────────────────────────────────────────────
 * Identical to the 9cpop sibling: each .txt is a single idempotent SQL INSERT
 * whose JSONB payload is dollar-quoted with the `$json$ … $json$` tag. We
 * extract the text between the single `$json$ … $json$` block and JSON.parse
 * it. The gaits/temperament blocks contain no Pearl/Brindle allele tokens, so
 * the importer's normalizeLocusAlleleCase / sanitizeSql transforms are
 * irrelevant here and are intentionally NOT applied — we read the raw
 * conformation/gaits/temperament exactly as it sits on disk.
 *
 * ── Canonical lists ────────────────────────────────────────────────────────
 * Imported from breedProfileValidator.mjs (EXPECTED_GAITS,
 * EXPECTED_TEMPERAMENT_WEIGHT_KEYS, EXPECTED_TEMPERAMENT_WEIGHT_SUM) so the
 * sentinel and the runtime validator share ONE source of truth. If a 5th core
 * gait or a 12th temperament category is added later, both update together —
 * the test does not hardcode a private copy of the strings (that copy would
 * itself be the drift hazard the sentinel exists to catch).
 *
 * NO MOCKS: this reads the real source files off disk. There is no DB and no
 * network — it is a pure filesystem + parse + assert sentinel.
 *
 * @module __tests__/breedSourceGaitsTemperament.sentinel
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  EXPECTED_GAITS,
  EXPECTED_TEMPERAMENT_WEIGHT_KEYS,
  EXPECTED_TEMPERAMENT_WEIGHT_SUM,
} from '../../../seed/breedProfileValidator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// backend/modules/horses/__tests__ → backend/data/breeds is up 3, then data/breeds.
const BREED_DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'breeds');

// Meta/reference files the importer (populateBreedsFromSql.mjs SKIP_FILES)
// never seeds. None are currently present in backend/data/breeds, but we
// filter them so a future re-mirror that drops a meta file here cannot make
// this sentinel try to JSON-parse a non-INSERT file. Mirrors the 9cpop sibling.
const SKIP_FILES = new Set([
  'seed.sql',
  'populate_breed_ratings.sql',
  'populate_breed_temperaments.sql',
  'generichorse.txt',
  '_breed-list.txt',
  '_gait-registry.txt',
]);

/**
 * Extract and parse the breed_genetic_profile JSON from a single breed .txt
 * file body. The payload is dollar-quoted as `$json$ … $json$`.
 *
 * @param {string} sql - raw .txt file body
 * @returns {object} the parsed profile object
 * @throws {Error} if no $json$ block is present or the JSON is malformed
 */
function extractProfileJson(sql) {
  const m = sql.match(/\$json\$([\s\S]*?)\$json\$/);
  if (!m) {
    throw new Error('no $json$ … $json$ dollar-quoted JSON block found');
  }
  return JSON.parse(m[1]);
}

/**
 * Gait-completeness assertion. Returns an array of human-readable failure
 * strings — empty means the gait block is complete and gaiting is consistent
 * with is_gaited_breed.
 *
 * @param {object} profile - parsed breed profile
 * @returns {string[]}
 */
function findGaitErrors(profile) {
  const errors = [];
  const rp = profile?.rating_profiles;
  if (rp === null || rp === undefined || typeof rp !== 'object') {
    errors.push('rating_profiles is missing or not an object');
    return errors;
  }

  const gaits = rp.gaits;
  if (gaits === null || gaits === undefined || typeof gaits !== 'object' || Array.isArray(gaits)) {
    errors.push('rating_profiles.gaits is missing or not an object');
    return errors;
  }

  for (const gait of EXPECTED_GAITS) {
    const g = gaits[gait];
    if (g === null || g === undefined || typeof g !== 'object') {
      errors.push(`missing gait: ${gait}`);
      continue;
    }
    const { mean, std_dev: stdDev } = g;
    if (!Number.isFinite(mean)) {
      errors.push(`gaits.${gait}.mean is not a finite number (got ${JSON.stringify(mean)})`);
    } else if (mean < 0 || mean > 100) {
      errors.push(`gaits.${gait}.mean out of range [0,100] (got ${mean})`);
    }
    if (!Number.isFinite(stdDev)) {
      errors.push(`gaits.${gait}.std_dev is not a finite number (got ${JSON.stringify(stdDev)})`);
    }
  }

  // gaiting (the optional 5th gait) must be consistent with is_gaited_breed —
  // same contract validateProfile() enforces on the canonical-12.
  const isGaited = rp.is_gaited_breed === true;
  const gaiting = gaits.gaiting;
  if (isGaited) {
    if (gaiting === null || gaiting === undefined || typeof gaiting !== 'object') {
      errors.push('gaited breed must have a scored gaiting object');
    } else if (!Number.isFinite(gaiting.mean)) {
      errors.push(`gaited breed gaiting.mean is not a finite number (got ${JSON.stringify(gaiting.mean)})`);
    }
    if (!Array.isArray(rp.gaited_gait_registry) || rp.gaited_gait_registry.length === 0) {
      errors.push('gaited breed must have a non-empty gaited_gait_registry');
    }
  } else if (gaiting !== null && gaiting !== undefined) {
    errors.push(`non-gaited breed must have null gaiting score (got ${JSON.stringify(gaiting)})`);
  }

  return errors;
}

/**
 * Temperament-weights completeness assertion. Returns an array of
 * human-readable failure strings — empty means the map carries exactly the 11
 * canonical keys, each an integer, summing to the expected total.
 *
 * @param {object} profile - parsed breed profile
 * @returns {string[]}
 */
function findTemperamentErrors(profile) {
  const errors = [];
  const tw = profile?.temperament_weights;
  if (tw === null || tw === undefined || typeof tw !== 'object' || Array.isArray(tw)) {
    errors.push('temperament_weights is missing or not an object');
    return errors;
  }

  // Every canonical key present and an integer.
  for (const key of EXPECTED_TEMPERAMENT_WEIGHT_KEYS) {
    if (!(key in tw)) {
      errors.push(`missing temperament weight: ${key}`);
      continue;
    }
    if (!Number.isInteger(tw[key])) {
      errors.push(`temperament_weights.${key} is not an integer (got ${JSON.stringify(tw[key])})`);
    }
  }

  // No EXTRA keys beyond the canonical 11 (a stray key would shift the
  // distribution and is exactly the kind of stale-template drift this guards).
  for (const key of Object.keys(tw)) {
    if (!EXPECTED_TEMPERAMENT_WEIGHT_KEYS.includes(key)) {
      errors.push(`unexpected temperament weight key: ${key}`);
    }
  }

  // Sum-to-expected (only meaningful when all values are integers; if a value
  // was non-integer we already flagged it above, but still compute the sum so
  // a clean-integer-but-wrong-total file is caught).
  let sum = 0;
  for (const v of Object.values(tw)) {
    if (typeof v === 'number') {
      sum += v;
    }
  }
  if (sum !== EXPECTED_TEMPERAMENT_WEIGHT_SUM) {
    errors.push(`temperament weights sum to ${sum}, expected ${EXPECTED_TEMPERAMENT_WEIGHT_SUM}`);
  }

  return errors;
}

describe('breed source files — gaits + temperament completeness sentinel (Equoria-4xwj1)', () => {
  /** @type {{ file: string, profile: object }[]} */
  let parsed = [];

  beforeAll(async () => {
    const entries = await readdir(BREED_DATA_DIR);
    const txtFiles = entries.filter(f => f.endsWith('.txt') && !SKIP_FILES.has(f)).sort();
    parsed = [];
    for (const file of txtFiles) {
      const body = await readFile(join(BREED_DATA_DIR, file), 'utf8');
      // Parse failures are real failures — let them throw out of beforeAll so a
      // malformed source file is loud, not silently skipped.
      const profile = extractProfileJson(body);
      parsed.push({ file, profile });
    }
  });

  it('finds the full 312-breed roster of source .txt files', () => {
    // Locks the count so a wholesale deletion / move of source files is caught
    // (the completeness checks would otherwise vacuously pass over an empty set).
    expect(parsed.length).toBe(312);
  });

  it('every breed .txt has all 4 core gaits (finite mean 0-100 + finite std_dev) with consistent gaiting', () => {
    const failures = [];
    for (const { file, profile } of parsed) {
      const errs = findGaitErrors(profile);
      if (errs.length > 0) {
        failures.push(`${file}: ${errs.join('; ')}`);
      }
    }
    // Assert against the empty array so the failure message lists EVERY bad
    // file at once (not just the first), making a real regression actionable.
    expect(failures).toEqual([]);
  });

  it('every breed .txt has exactly the 11 temperament_weights keys, integer, summing to 100', () => {
    const failures = [];
    for (const { file, profile } of parsed) {
      const errs = findTemperamentErrors(profile);
      if (errs.length > 0) {
        failures.push(`${file}: ${errs.join('; ')}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('the canonical gait list under test is exactly the 4 core gaits', () => {
    // Guards the assumption this sentinel rests on. If EXPECTED_GAITS is
    // widened/narrowed, this fails and forces a deliberate update rather than
    // silent drift. `gaiting` is intentionally excluded (optional 5th key).
    expect([...EXPECTED_GAITS].sort()).toEqual(['canter', 'gallop', 'trot', 'walk'].sort());
  });

  it('the canonical temperament-weight key list under test is exactly the 11 expected keys', () => {
    expect([...EXPECTED_TEMPERAMENT_WEIGHT_KEYS].sort()).toEqual(
      [
        'Aggressive',
        'Bold',
        'Calm',
        'Independent',
        'Lazy',
        'Nervous',
        'Playful',
        'Reactive',
        'Spirited',
        'Steady',
        'Stubborn',
      ].sort(),
    );
    expect(EXPECTED_TEMPERAMENT_WEIGHT_SUM).toBe(100);
  });

  // ── Sentinel-POSITIVE proof ───────────────────────────────────────────────
  // These do NOT just confirm the check passes when clean — they prove it
  // FIRES on a synthetic profile that drops / corrupts a gait or temperament
  // weight. Without these, the real-file tests above could be vacuously green
  // (e.g. if the parser silently returned an empty roster or a check no-oped).
  describe('SENTINEL-POSITIVE: detectors fire on planted defects', () => {
    /** Build a complete, valid non-gaited profile (4 gaits + null gaiting + 11 TW). */
    function fullNonGaitedProfile() {
      const gaits = { gaiting: null };
      for (const gait of EXPECTED_GAITS) {
        gaits[gait] = { mean: 70, std_dev: 8 };
      }
      const temperament_weights = {};
      // 11 keys: give the first key the remainder so the total is exactly 100.
      const per = Math.floor(EXPECTED_TEMPERAMENT_WEIGHT_SUM / EXPECTED_TEMPERAMENT_WEIGHT_KEYS.length);
      let assigned = 0;
      EXPECTED_TEMPERAMENT_WEIGHT_KEYS.forEach((k, i) => {
        const isLast = i === EXPECTED_TEMPERAMENT_WEIGHT_KEYS.length - 1;
        const v = isLast ? EXPECTED_TEMPERAMENT_WEIGHT_SUM - assigned : per;
        temperament_weights[k] = v;
        assigned += v;
      });
      return { rating_profiles: { is_gaited_breed: false, gaits }, temperament_weights };
    }

    /** Build a complete, valid gaited profile (4 gaits + scored gaiting + registry). */
    function fullGaitedProfile() {
      const p = fullNonGaitedProfile();
      p.rating_profiles.is_gaited_breed = true;
      p.rating_profiles.gaits.gaiting = { mean: 85, std_dev: 7 };
      p.rating_profiles.gaited_gait_registry = ['Tölt'];
      return p;
    }

    // ── Negative controls ──
    it('a clean non-gaited synthetic profile produces ZERO gait + temperament errors', () => {
      const p = fullNonGaitedProfile();
      expect(findGaitErrors(p)).toEqual([]);
      expect(findTemperamentErrors(p)).toEqual([]);
    });

    it('a clean gaited synthetic profile produces ZERO gait errors', () => {
      expect(findGaitErrors(fullGaitedProfile())).toEqual([]);
    });

    // ── Gait detector fires ──
    it('gait detector FIRES when a core gait (canter) is missing', () => {
      const p = fullNonGaitedProfile();
      delete p.rating_profiles.gaits.canter;
      const errs = findGaitErrors(p);
      expect(errs).toContain('missing gait: canter');
      expect(errs.length).toBeGreaterThan(0);
    });

    it('gait detector FIRES when a core gait (walk) is missing', () => {
      const p = fullNonGaitedProfile();
      delete p.rating_profiles.gaits.walk;
      expect(findGaitErrors(p)).toContain('missing gait: walk');
    });

    it('gait detector FIRES when a gait mean is non-finite', () => {
      const p = fullNonGaitedProfile();
      p.rating_profiles.gaits.trot.mean = 'oops';
      const errs = findGaitErrors(p);
      expect(errs.some(e => e.startsWith('gaits.trot.mean is not a finite number'))).toBe(true);
    });

    it('gait detector FIRES when a gait mean is out of range', () => {
      const p = fullNonGaitedProfile();
      p.rating_profiles.gaits.gallop.mean = 150;
      const errs = findGaitErrors(p);
      expect(errs.some(e => e.startsWith('gaits.gallop.mean out of range'))).toBe(true);
    });

    it('gait detector FIRES when a gait std_dev is non-finite', () => {
      const p = fullNonGaitedProfile();
      delete p.rating_profiles.gaits.canter.std_dev;
      const errs = findGaitErrors(p);
      expect(errs.some(e => e.startsWith('gaits.canter.std_dev is not a finite number'))).toBe(true);
    });

    it('gait detector FIRES when gaits block is absent entirely', () => {
      expect(findGaitErrors({ rating_profiles: { is_gaited_breed: false } })).toContain(
        'rating_profiles.gaits is missing or not an object',
      );
    });

    it('gait detector FIRES when a gaited breed has null gaiting', () => {
      const p = fullGaitedProfile();
      p.rating_profiles.gaits.gaiting = null;
      expect(findGaitErrors(p)).toContain('gaited breed must have a scored gaiting object');
    });

    it('gait detector FIRES when a gaited breed has an empty registry', () => {
      const p = fullGaitedProfile();
      p.rating_profiles.gaited_gait_registry = [];
      expect(findGaitErrors(p)).toContain('gaited breed must have a non-empty gaited_gait_registry');
    });

    it('gait detector FIRES when a non-gaited breed has a non-null gaiting score', () => {
      const p = fullNonGaitedProfile();
      p.rating_profiles.gaits.gaiting = { mean: 80, std_dev: 6 };
      const errs = findGaitErrors(p);
      expect(errs.some(e => e.startsWith('non-gaited breed must have null gaiting score'))).toBe(true);
    });

    // ── Temperament detector fires ──
    it('temperament detector FIRES when a weight key (Spirited) is missing', () => {
      const p = fullNonGaitedProfile();
      delete p.temperament_weights.Spirited;
      const errs = findTemperamentErrors(p);
      expect(errs).toContain('missing temperament weight: Spirited');
      // Removing a key also breaks the sum — both signals fire.
      expect(errs.length).toBeGreaterThan(0);
    });

    it('temperament detector FIRES when a weight is non-integer', () => {
      const p = fullNonGaitedProfile();
      p.temperament_weights.Calm = 3.5;
      const errs = findTemperamentErrors(p);
      expect(errs.some(e => e.startsWith('temperament_weights.Calm is not an integer'))).toBe(true);
    });

    it('temperament detector FIRES on an unexpected extra key', () => {
      const p = fullNonGaitedProfile();
      // Take 5 off an existing key so the sum stays 100 — isolate the extra-key signal.
      p.temperament_weights.Bold -= 5;
      p.temperament_weights.Bogus = 5;
      const errs = findTemperamentErrors(p);
      expect(errs).toContain('unexpected temperament weight key: Bogus');
    });

    it('temperament detector FIRES when weights do not sum to 100', () => {
      const p = fullNonGaitedProfile();
      p.temperament_weights.Calm += 7; // total now 107
      const errs = findTemperamentErrors(p);
      expect(errs.some(e => e.startsWith('temperament weights sum to 107'))).toBe(true);
    });

    it('temperament detector FIRES when temperament_weights block is absent entirely', () => {
      expect(findTemperamentErrors({ rating_profiles: {} })).toContain(
        'temperament_weights is missing or not an object',
      );
    });

    it('the extractProfileJson parser FIRES on a $json$-less file body', () => {
      expect(() => extractProfileJson("INSERT INTO breeds (name) VALUES ('X');")).toThrow(/no \$json\$/);
    });
  });
});
