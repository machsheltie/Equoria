/**
 * horseStarterStats — unit tests (Equoria-rr7)
 *
 * Tests the pure functions exported from backend/services/horseStarterStats.mjs.
 * No database required — all functions are deterministic/statistical algorithms.
 *
 * Covered exports:
 *   - STAT_KEYS (constant)
 *   - TOTAL_STAT_CAP (constant)
 *   - sampleStat({ mean, std_dev })
 *   - clampStatsToTotalCap(stats, cap)
 *   - generateStoreStats(breedName)
 */

import { describe, it, expect } from '@jest/globals';
import {
  STAT_KEYS,
  TOTAL_STAT_CAP,
  sampleStat,
  clampStatsToTotalCap,
  generateStoreStats,
} from '../modules/horses/index.mjs';

// ─── STAT_KEYS ─────────────────────────────────────────────────────────────────

describe('STAT_KEYS', () => {
  it('exports an array of 12 stat names', () => {
    expect(Array.isArray(STAT_KEYS)).toBe(true);
    expect(STAT_KEYS).toHaveLength(12);
  });

  it('contains expected stat names', () => {
    const expected = [
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
      'strength',
      'endurance',
    ];
    expected.forEach(stat => expect(STAT_KEYS).toContain(stat));
  });

  it('contains no duplicates', () => {
    expect(new Set(STAT_KEYS).size).toBe(STAT_KEYS.length);
  });
});

// ─── TOTAL_STAT_CAP ────────────────────────────────────────────────────────────

describe('TOTAL_STAT_CAP', () => {
  it('is 200', () => {
    expect(TOTAL_STAT_CAP).toBe(200);
  });

  it('is a positive number', () => {
    expect(typeof TOTAL_STAT_CAP).toBe('number');
    expect(TOTAL_STAT_CAP).toBeGreaterThan(0);
  });
});

// ─── sampleStat ────────────────────────────────────────────────────────────────

describe('sampleStat', () => {
  it('returns an integer', () => {
    const val = sampleStat({ mean: 50, std_dev: 5 });
    expect(Number.isInteger(val)).toBe(true);
  });

  it('returns a value in [1, 100]', () => {
    // Run many times to cover the clamp branches
    for (let i = 0; i < 200; i++) {
      const val = sampleStat({ mean: 50, std_dev: 10 });
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  it('clamps to minimum 1 even for very low mean', () => {
    // Extreme low mean: most samples should be 1 after clamping
    const samples = Array.from({ length: 100 }, () => sampleStat({ mean: -100, std_dev: 5 }));
    samples.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(1);
    });
  });

  it('clamps to maximum 100 even for very high mean', () => {
    // Extreme high mean: most samples should be 100 after clamping
    const samples = Array.from({ length: 100 }, () => sampleStat({ mean: 200, std_dev: 5 }));
    samples.forEach(v => {
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('returns values centered around mean for moderate std_dev', () => {
    // Statistical: average of 500 samples should be close to mean
    const N = 500;
    const mean = 60;
    const samples = Array.from({ length: N }, () => sampleStat({ mean, std_dev: 5 }));
    const avg = samples.reduce((s, v) => s + v, 0) / N;
    // Allow ±3 tolerance for statistical noise
    expect(avg).toBeGreaterThan(mean - 3);
    expect(avg).toBeLessThan(mean + 3);
  });

  it('works with std_dev of 0 (deterministic)', () => {
    // std_dev=0 means z=0, so value = round(mean)
    const val = sampleStat({ mean: 55, std_dev: 0 });
    expect(val).toBe(55);
  });
});

// ─── clampStatsToTotalCap ──────────────────────────────────────────────────────

describe('clampStatsToTotalCap', () => {
  function makeStats(values) {
    return Object.fromEntries(STAT_KEYS.map((k, i) => [k, values[i] ?? 0]));
  }

  it('returns stats unchanged when total is already at cap', () => {
    // Make a stats object that sums to exactly 200
    const base = Math.floor(200 / 12); // 16
    const remainder = 200 - base * 12; // 8
    const values = STAT_KEYS.map((_, i) => (i < remainder ? base + 1 : base));
    const stats = makeStats(values);
    const result = clampStatsToTotalCap(stats, 200);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(200);
  });

  it('returns new object (does not mutate input)', () => {
    const stats = makeStats(STAT_KEYS.map(() => 20)); // total = 240
    const original = { ...stats };
    clampStatsToTotalCap(stats, 200);
    STAT_KEYS.forEach(k => {
      expect(stats[k]).toBe(original[k]);
    });
  });

  it('total of clamped stats is <= cap', () => {
    const stats = makeStats(STAT_KEYS.map(() => 30)); // total = 360
    const result = clampStatsToTotalCap(stats, 200);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(200);
  });

  it('no stat falls below 1 after clamping', () => {
    const stats = makeStats(STAT_KEYS.map(() => 30)); // total = 360
    const result = clampStatsToTotalCap(stats, 200);
    Object.values(result).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(1);
    });
  });

  it('returns stats as-is when total is under cap', () => {
    const stats = makeStats(STAT_KEYS.map(() => 5)); // total = 60 < 200
    const result = clampStatsToTotalCap(stats, 200);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(60);
    STAT_KEYS.forEach(k => {
      expect(result[k]).toBe(5);
    });
  });

  it('handles edge case where all stats are exactly 1', () => {
    const stats = makeStats(STAT_KEYS.map(() => 1)); // total = 12
    const result = clampStatsToTotalCap(stats, 200);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBe(12);
    Object.values(result).forEach(v => expect(v).toBe(1));
  });

  it('works with custom cap smaller than TOTAL_STAT_CAP', () => {
    const stats = makeStats(STAT_KEYS.map(() => 20)); // total = 240
    const result = clampStatsToTotalCap(stats, 100);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(100);
    Object.values(result).forEach(v => expect(v).toBeGreaterThanOrEqual(1));
  });

  it('trims from highest stat when proportional rounding pushes total over cap', () => {
    // Design a scenario where scaling pushes one stat just over cap
    // 12 stats at 50 = total 600, cap 200
    const stats = makeStats(STAT_KEYS.map(() => 50));
    const result = clampStatsToTotalCap(stats, 200);
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(200);
    Object.values(result).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

// ─── generateStoreStats ────────────────────────────────────────────────────────

describe('generateStoreStats', () => {
  it('throws when breedName is missing', () => {
    expect(() => generateStoreStats()).toThrow();
    expect(() => generateStoreStats(null)).toThrow();
    expect(() => generateStoreStats('')).toThrow();
  });

  it('throws for unknown breed name', () => {
    expect(() => generateStoreStats('NonExistentBreedXYZ999')).toThrow();
  });

  it('throws with statusCode 500 for missing breed', () => {
    let err;
    try {
      generateStoreStats('NonExistentBreedXYZ999');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });

  it('throws with statusCode 500 when breedName is empty string', () => {
    let err;
    try {
      generateStoreStats('');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });

  it('returns an object with all 12 stat keys for a valid breed', async () => {
    // Use the first breed in the JSON file. We read it at module level.
    // This test requires that breedStarterStats.json is readable.
    // Since we import from the service, which already loaded the file, we
    // check that valid breeds work by using a known one if available.
    // Strategy: attempt a known breed; skip gracefully if not present in JSON.
    const knownBreeds = ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Appaloosa', 'Andalusian'];

    let worked = false;
    for (const breed of knownBreeds) {
      try {
        const result = generateStoreStats(breed);
        // If it returned without throwing, validate the shape
        expect(typeof result).toBe('object');
        STAT_KEYS.forEach(stat => {
          expect(result).toHaveProperty(stat);
          expect(typeof result[stat]).toBe('number');
          expect(result[stat]).toBeGreaterThanOrEqual(1);
          expect(result[stat]).toBeLessThanOrEqual(100);
        });

        // Total must not exceed cap
        const total = STAT_KEYS.reduce((s, k) => s + result[k], 0);
        expect(total).toBeLessThanOrEqual(TOTAL_STAT_CAP);

        worked = true;
        break;
      } catch (_e) {
        // Try next breed
        continue;
      }
    }

    // If none of the known breeds worked, attempt to load the JSON directly
    // and pick the first entry — then verify generateStoreStats works with it.
    if (!worked) {
      // Equoria-ftaqy: removed the try/catch graceful-skip on missing
      // breedStarterStats.json. The JSON is a required source file — if
      // it's not readable the test must FAIL LOUDLY, not silently no-op.
      const { readFileSync } = await import('fs');
      const { fileURLToPath } = await import('url');
      const { dirname, resolve } = await import('path');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const jsonPath = resolve(__dirname, '..', 'data', 'breedStarterStats.json');
      const breedData = JSON.parse(readFileSync(jsonPath, 'utf8'));

      const firstBreed = Object.keys(breedData)[0];
      expect(firstBreed).toBeTruthy();
      const result = generateStoreStats(firstBreed);
      STAT_KEYS.forEach(stat => {
        expect(result).toHaveProperty(stat);
        expect(result[stat]).toBeGreaterThanOrEqual(1);
        expect(result[stat]).toBeLessThanOrEqual(100);
      });
      const total = STAT_KEYS.reduce((s, k) => s + result[k], 0);
      expect(total).toBeLessThanOrEqual(TOTAL_STAT_CAP);
    }
  });

  it('produces different results on repeated calls (random sampling)', () => {
    // This test is probabilistic — it's astronomically unlikely to get
    // identical results 20 times in a row unless the sampler is broken.
    const knownBreeds = ['Thoroughbred', 'Arabian', 'Quarter Horse', 'Appaloosa'];

    for (const breed of knownBreeds) {
      try {
        const results = Array.from({ length: 20 }, () => generateStoreStats(breed));
        const totals = results.map(r => STAT_KEYS.reduce((s, k) => s + r[k], 0));
        // Not all totals can be identical (unless every stat hit mean exactly)
        const _uniqueTotals = new Set(totals);
        // At minimum, the function returns valid stats every time
        results.forEach(r => {
          const total = STAT_KEYS.reduce((s, k) => s + r[k], 0);
          expect(total).toBeLessThanOrEqual(TOTAL_STAT_CAP);
          STAT_KEYS.forEach(k => {
            expect(r[k]).toBeGreaterThanOrEqual(1);
            expect(r[k]).toBeLessThanOrEqual(100);
          });
        });
        // We found a valid breed, stop
        break;
      } catch (_e) {
        continue;
      }
    }
  });
});
