/**
 * syncBreedStarterStats.test.mjs — Equoria-i8vt8
 *
 * Pure-function coverage for the breed-starter-stats sync helpers
 * exported by `backend/seed/populateBreedsFromSql.mjs`. These helpers
 * close the drift class that prompted Equoria-22y89: hand-curated
 * `breedStarterStats.json` vs. data-imported `breeds` table drift —
 * the marketplace `buyStoreHorse` flow throws 500 when a breed name
 * is missing from the JSON.
 *
 * Sentinel-positive: the test PLANTS a missing breed name into the
 * temp data dir, runs the sync, and asserts the function appends a
 * default profile of the correct shape. Then removes the plant and
 * confirms no change. The detector must fire on a real violation.
 *
 * NO MOCKS. Uses real fs against a per-test tmpdir.
 *
 * @module __tests__/syncBreedStarterStats
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  extractBreedNamesFromSqlDir,
  generateDefaultStarterStats,
  syncBreedStarterStatsJson,
  DEFAULT_STARTER_STAT_KEYS,
} from '../../../seed/populateBreedsFromSql.mjs';

describe('Equoria-i8vt8 — breed-starter-stats sync helpers', () => {
  let workDir;
  let breedsDir;
  let jsonPath;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), 'i8vt8-'));
    breedsDir = join(workDir, 'breeds');
    mkdirSync(breedsDir);
    jsonPath = join(workDir, 'breedStarterStats.json');
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // generateDefaultStarterStats — shape contract
  // -------------------------------------------------------------------------
  describe('generateDefaultStarterStats', () => {
    it('returns a profile with all 12 canonical stat keys', () => {
      const profile = generateDefaultStarterStats();
      const keys = Object.keys(profile).sort();
      expect(keys).toEqual([...DEFAULT_STARTER_STAT_KEYS].sort());
      expect(keys).toHaveLength(12);
    });

    it('every stat has integer mean in [14, 18] and std = 3', () => {
      const profile = generateDefaultStarterStats();
      for (const [stat, entry] of Object.entries(profile)) {
        expect(Number.isInteger(entry.mean)).toBe(true);
        expect(entry.mean).toBeGreaterThanOrEqual(14);
        expect(entry.mean).toBeLessThanOrEqual(18);
        expect(entry.std).toBe(3);
      }
    });
  });

  // -------------------------------------------------------------------------
  // extractBreedNamesFromSqlDir — parses real SQL .txt format
  // -------------------------------------------------------------------------
  describe('extractBreedNamesFromSqlDir', () => {
    const sqlBody = breedName =>
      'INSERT INTO breeds (name, default_trait, breed_genetic_profile) VALUES\n' +
      `('${breedName}', 'Trait', $json$\n{}\n$json$::JSONB)\n` +
      'ON CONFLICT (name) DO UPDATE SET breed_genetic_profile = EXCLUDED.breed_genetic_profile;';

    it('extracts the name from a single well-formed .txt file', async () => {
      writeFileSync(join(breedsDir, 'Abaga.txt'), sqlBody('Abaga'), 'utf8');
      const names = await extractBreedNamesFromSqlDir(breedsDir);
      expect(names).toEqual(['Abaga']);
    });

    it('extracts multiple names sorted lexicographically', async () => {
      writeFileSync(join(breedsDir, 'B.txt'), sqlBody('Bashkir Curly'), 'utf8');
      writeFileSync(join(breedsDir, 'A.txt'), sqlBody('Akhal-Teke'), 'utf8');
      writeFileSync(join(breedsDir, 'C.txt'), sqlBody('Cayuse'), 'utf8');
      const names = await extractBreedNamesFromSqlDir(breedsDir);
      expect(names).toEqual(['Akhal-Teke', 'Bashkir Curly', 'Cayuse']);
    });

    it('skips meta files and non-.txt files', async () => {
      writeFileSync(join(breedsDir, '_breed-list.txt'), sqlBody('NotReal'), 'utf8');
      writeFileSync(join(breedsDir, '_gait-registry.txt'), sqlBody('NotReal'), 'utf8');
      writeFileSync(join(breedsDir, 'generichorse.txt'), sqlBody('NotReal'), 'utf8');
      writeFileSync(join(breedsDir, 'README.md'), 'unrelated', 'utf8');
      writeFileSync(join(breedsDir, 'Arabian.txt'), sqlBody('Arabian'), 'utf8');
      const names = await extractBreedNamesFromSqlDir(breedsDir);
      expect(names).toEqual(['Arabian']);
    });

    it("handles SQL where the name is escaped with two single quotes (O''Brien)", async () => {
      writeFileSync(join(breedsDir, 'OB.txt'), sqlBody("O''Brien"), 'utf8');
      const names = await extractBreedNamesFromSqlDir(breedsDir);
      // sanitizeSql leaves these alone; for the sync flow we want the
      // SQL-level escape collapsed to the JSON-level single literal apostrophe.
      expect(names).toEqual(["O'Brien"]);
    });

    it('throws on a .txt file with no parseable INSERT (fail-loud, no silent drop)', async () => {
      writeFileSync(join(breedsDir, 'Broken.txt'), 'garbage with no INSERT statement', 'utf8');
      await expect(extractBreedNamesFromSqlDir(breedsDir)).rejects.toThrow(/Broken\.txt/);
    });
  });

  // -------------------------------------------------------------------------
  // syncBreedStarterStatsJson — the sentinel-positive end-to-end shape
  // -------------------------------------------------------------------------
  describe('syncBreedStarterStatsJson', () => {
    const sqlBody = n => `INSERT INTO breeds (name) VALUES ('${n}');`;

    it('appends a default profile for every breed missing from the JSON (sentinel-positive)', async () => {
      writeFileSync(join(breedsDir, 'A.txt'), sqlBody('Arabian'), 'utf8');
      writeFileSync(join(breedsDir, 'B.txt'), sqlBody('Bashkir'), 'utf8');
      writeFileSync(join(breedsDir, 'C.txt'), sqlBody('NewBreed'), 'utf8');

      // JSON has Arabian + Bashkir but NOT NewBreed.
      writeFileSync(
        jsonPath,
        JSON.stringify(
          {
            Arabian: generateDefaultStarterStats(),
            Bashkir: generateDefaultStarterStats(),
          },
          null,
          2,
        ),
        'utf8',
      );

      const result = await syncBreedStarterStatsJson({
        dataDir: breedsDir,
        jsonPath,
      });

      expect(result.added).toEqual(['NewBreed']);
      expect(result.missingBefore).toEqual(['NewBreed']);
      expect(result.missingAfter).toEqual([]);

      const after = JSON.parse(readFileSync(jsonPath, 'utf8'));
      expect(Object.keys(after).sort()).toEqual(['Arabian', 'Bashkir', 'NewBreed']);
      // Default profile shape preserved on the appended entry.
      expect(Object.keys(after.NewBreed).sort()).toEqual([...DEFAULT_STARTER_STAT_KEYS].sort());
    });

    it('no-ops cleanly when the JSON already covers every breed (no spurious writes)', async () => {
      writeFileSync(join(breedsDir, 'A.txt'), sqlBody('Arabian'), 'utf8');
      const baseline = { Arabian: generateDefaultStarterStats() };
      writeFileSync(jsonPath, JSON.stringify(baseline, null, 2), 'utf8');
      const before = readFileSync(jsonPath, 'utf8');

      const result = await syncBreedStarterStatsJson({ dataDir: breedsDir, jsonPath });

      expect(result.added).toEqual([]);
      expect(result.missingBefore).toEqual([]);
      expect(result.missingAfter).toEqual([]);
      // Byte-identical: do not rewrite the file when nothing changed.
      expect(readFileSync(jsonPath, 'utf8')).toBe(before);
    });

    it('preserves existing curated entries — only ADDS, never overwrites', async () => {
      writeFileSync(join(breedsDir, 'A.txt'), sqlBody('Arabian'), 'utf8');
      // Plant a non-default profile for Arabian — verify the sync does not clobber it.
      const customArabian = {
        speed: { mean: 99, std: 1 },
        stamina: { mean: 99, std: 1 },
        agility: { mean: 99, std: 1 },
        balance: { mean: 99, std: 1 },
        precision: { mean: 99, std: 1 },
        intelligence: { mean: 99, std: 1 },
        boldness: { mean: 99, std: 1 },
        flexibility: { mean: 99, std: 1 },
        obedience: { mean: 99, std: 1 },
        focus: { mean: 99, std: 1 },
        endurance: { mean: 99, std: 1 },
        strength: { mean: 99, std: 1 },
      };
      writeFileSync(jsonPath, JSON.stringify({ Arabian: customArabian }, null, 2), 'utf8');

      await syncBreedStarterStatsJson({ dataDir: breedsDir, jsonPath });

      const after = JSON.parse(readFileSync(jsonPath, 'utf8'));
      expect(after.Arabian.speed.mean).toBe(99);
      expect(after.Arabian.speed.std).toBe(1);
    });

    it('dryRun=true reports what WOULD be added but does not modify the file', async () => {
      writeFileSync(join(breedsDir, 'A.txt'), sqlBody('Arabian'), 'utf8');
      writeFileSync(join(breedsDir, 'N.txt'), sqlBody('NewBreed'), 'utf8');
      writeFileSync(jsonPath, JSON.stringify({ Arabian: generateDefaultStarterStats() }, null, 2), 'utf8');
      const before = readFileSync(jsonPath, 'utf8');

      const result = await syncBreedStarterStatsJson({
        dataDir: breedsDir,
        jsonPath,
        dryRun: true,
      });

      expect(result.added).toEqual(['NewBreed']);
      expect(result.missingBefore).toEqual(['NewBreed']);
      // dryRun does NOT touch the file.
      expect(readFileSync(jsonPath, 'utf8')).toBe(before);
    });
  });
});
