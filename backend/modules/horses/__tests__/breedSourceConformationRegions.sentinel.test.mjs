/**
 * breedSourceConformationRegions.sentinel.test.mjs (Equoria-9cpop)
 *
 * SOURCE-COMPLETENESS sentinel for the 312 breed source files in
 * backend/data/breeds/*.txt.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * Equoria-f8qew (2026-06-02) added the 8th conformation region (`topline`)
 * to all 312 source .txt files (head / neck / shoulders / back /
 * hindquarters / legs / hooves / topline). After that change the DB profile
 * is a strict superset of the JSON fallback, and breedProfileLoader returns
 * the DB row directly on a cache hit.
 *
 * BUT: the runtime validateProfile() in backend/seed/breedProfileValidator.mjs
 * only runs against the 12 hand-authored canonical .mjs profiles (via
 * breedGeneticProfiles.test.mjs) — NOT against the 312 .txt source files that
 * actually seed the canonical DB through populateBreedsFromSql.mjs. So nothing
 * asserts the .txt files KEEP all 8 regions. A future hand-edit (or a
 * find/replace gone wrong, or a new breed file authored from a stale template)
 * could silently drop a region from one or more of the 312 files; the seed
 * would import an incomplete conformation block and no test would notice until
 * a horse generated from that breed rendered with a missing region score.
 *
 * This sentinel closes that gap: it parses EVERY .txt source file and asserts
 * each one's rating_profiles.conformation carries ALL 8 canonical regions,
 * each with a finite mean in [0,100] and a finite std_dev.
 *
 * ── Parse approach ─────────────────────────────────────────────────────────
 * Each .txt file is a single idempotent SQL INSERT whose JSONB payload is
 * dollar-quoted with the `$json$ … $json$` tag (see backend/data/breeds/*.txt
 * and the importer's parseBreedNameFromSql + executeRawUnsafe path in
 * backend/seed/populateBreedsFromSql.mjs). We extract the text between the
 * single `$json$ … $json$` block and JSON.parse it. The conformation block
 * contains no Pearl/Brindle allele tokens, so the importer's
 * normalizeLocusAlleleCase / sanitizeSql transforms are irrelevant to the
 * region check and are intentionally NOT applied here — we read the raw,
 * un-normalized conformation exactly as it sits on disk.
 *
 * ── Canonical region list ──────────────────────────────────────────────────
 * Imported from breedProfileValidator.mjs (EXPECTED_CONFORMATION_REGIONS) so
 * the sentinel and the runtime validator share ONE source of truth. If a 9th
 * region is added later, both update together — the test does not hardcode a
 * private copy of the eight strings (that copy would itself be a drift hazard).
 *
 * NO MOCKS: this reads the real source files off disk. There is no DB and no
 * network — it is a pure filesystem + parse + assert sentinel.
 *
 * @module __tests__/breedSourceConformationRegions.sentinel
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EXPECTED_CONFORMATION_REGIONS } from '../../../seed/breedProfileValidator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// backend/modules/horses/__tests__ → backend/data/breeds is up 3, then data/breeds.
const BREED_DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'breeds');

// Meta/reference files the importer (populateBreedsFromSql.mjs SKIP_FILES)
// never seeds. None are currently present in backend/data/breeds, but we
// filter them so a future re-mirror that drops a meta file here cannot make
// this sentinel try to JSON-parse a non-INSERT file.
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
 * Region-completeness assertion shared by the real-file loop and the
 * sentinel-positive synthetic case. Returns an array of human-readable
 * failure strings — empty means the conformation block is complete.
 *
 * @param {object} profile - parsed breed profile
 * @returns {string[]}
 */
function findConformationRegionErrors(profile) {
  const errors = [];
  const conformation = profile?.rating_profiles?.conformation;
  if (conformation === null || conformation === undefined || typeof conformation !== 'object') {
    errors.push('rating_profiles.conformation is missing or not an object');
    return errors;
  }
  for (const region of EXPECTED_CONFORMATION_REGIONS) {
    const reg = conformation[region];
    if (reg === null || reg === undefined || typeof reg !== 'object') {
      errors.push(`missing conformation region: ${region}`);
      continue;
    }
    const { mean, std_dev: stdDev } = reg;
    if (!Number.isFinite(mean)) {
      errors.push(`conformation.${region}.mean is not a finite number (got ${JSON.stringify(mean)})`);
    } else if (mean < 0 || mean > 100) {
      errors.push(`conformation.${region}.mean out of range [0,100] (got ${mean})`);
    }
    if (!Number.isFinite(stdDev)) {
      errors.push(`conformation.${region}.std_dev is not a finite number (got ${JSON.stringify(stdDev)})`);
    }
  }
  return errors;
}

describe('breed source files — conformation completeness sentinel (Equoria-9cpop)', () => {
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
    // (the 8-region check would otherwise vacuously pass over an empty set).
    expect(parsed.length).toBe(312);
  });

  it('every breed .txt has all 8 conformation regions with finite mean (0-100) + finite std_dev', () => {
    const failures = [];
    for (const { file, profile } of parsed) {
      const errs = findConformationRegionErrors(profile);
      if (errs.length > 0) {
        failures.push(`${file}: ${errs.join('; ')}`);
      }
    }
    // Assert against the empty array so the failure message lists EVERY bad
    // file at once (not just the first), making a real regression actionable.
    expect(failures).toEqual([]);
  });

  it('the canonical region list under test is exactly the 8 expected regions', () => {
    // Guards the assumption this whole sentinel rests on: that we are checking
    // 8 regions including topline. If the shared constant is widened/narrowed,
    // this fails and forces a deliberate update rather than silent drift.
    expect([...EXPECTED_CONFORMATION_REGIONS].sort()).toEqual(
      ['back', 'head', 'hindquarters', 'hooves', 'legs', 'neck', 'shoulders', 'topline'].sort(),
    );
  });

  // ── Sentinel-POSITIVE proof ───────────────────────────────────────────────
  // These do NOT just confirm the check passes when clean — they prove it
  // FIRES on a synthetic profile that drops / corrupts a region. Without these,
  // the test above could be vacuously green (e.g. if the parser silently
  // returned an empty roster or the region check no-oped).
  describe('SENTINEL-POSITIVE: detector fires on a planted defect', () => {
    /** Build a complete, valid conformation block (all 8 regions). */
    function fullConformationProfile() {
      const conformation = {};
      for (const region of EXPECTED_CONFORMATION_REGIONS) {
        conformation[region] = { mean: 80, std_dev: 7 };
      }
      return { rating_profiles: { conformation } };
    }

    it('a clean synthetic profile produces ZERO errors (negative control)', () => {
      expect(findConformationRegionErrors(fullConformationProfile())).toEqual([]);
    });

    it('FIRES when a region (topline) is missing', () => {
      const profile = fullConformationProfile();
      delete profile.rating_profiles.conformation.topline;
      const errs = findConformationRegionErrors(profile);
      expect(errs).toContain('missing conformation region: topline');
      expect(errs.length).toBeGreaterThan(0);
    });

    it('FIRES when a region (head) is missing', () => {
      const profile = fullConformationProfile();
      delete profile.rating_profiles.conformation.head;
      expect(findConformationRegionErrors(profile)).toContain('missing conformation region: head');
    });

    it('FIRES when a region mean is non-finite', () => {
      const profile = fullConformationProfile();
      profile.rating_profiles.conformation.back.mean = 'oops';
      const errs = findConformationRegionErrors(profile);
      expect(errs.some(e => e.startsWith('conformation.back.mean is not a finite number'))).toBe(true);
    });

    it('FIRES when a region mean is out of range', () => {
      const profile = fullConformationProfile();
      profile.rating_profiles.conformation.legs.mean = 150;
      const errs = findConformationRegionErrors(profile);
      expect(errs.some(e => e.startsWith('conformation.legs.mean out of range'))).toBe(true);
    });

    it('FIRES when a region std_dev is non-finite', () => {
      const profile = fullConformationProfile();
      delete profile.rating_profiles.conformation.neck.std_dev;
      const errs = findConformationRegionErrors(profile);
      expect(errs.some(e => e.startsWith('conformation.neck.std_dev is not a finite number'))).toBe(true);
    });

    it('FIRES when conformation block is absent entirely', () => {
      expect(findConformationRegionErrors({ rating_profiles: {} })).toContain(
        'rating_profiles.conformation is missing or not an object',
      );
    });

    it('the extractProfileJson parser FIRES on a $json$-less file body', () => {
      expect(() => extractProfileJson("INSERT INTO breeds (name) VALUES ('X');")).toThrow(/no \$json\$/);
    });
  });
});
