/**
 * horseStarterStats service tests — Equoria-h1xz
 *
 * Pure-algorithmic unit + data-contract tests for the canonical
 * starter-stats generator. No DB, no network, no mocks: this service is
 * deterministic-given-randomness and reads a static JSON at import time.
 *
 * What we prove (per the service's contract at backend/services/horseStarterStats.mjs):
 *   - sampleStat: integer in [1, 100], no NaN, mean tracks input mean
 *   - clampStatsToTotalCap: total ≤ cap, no stat < 1, all keys preserved,
 *     iterative trim converges
 *   - generateStoreStats: throws 500 on bad input, returns valid 12-stat
 *     object with sum ≤ TOTAL_STAT_CAP for every breed in the JSON
 *   - Data contract: every breed in breedStarterStats.json has a complete
 *     profile (this catches future data drift that would 500 in production)
 *
 * Surfaced as a follow-up from the 2026-04-30 code review — the service was
 * extracted in PR #108 (chunk-B) but had no dedicated test file. Filing per
 * OPTIMAL_FIX_DISCIPLINE.md §6 — "what was not done" becomes its own work.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import {
  STAT_KEYS,
  TOTAL_STAT_CAP,
  sampleStat,
  clampStatsToTotalCap,
  generateStoreStats,
} from '../../services/horseStarterStats.mjs';

// Read the breed JSON the same way the service does, so the data-contract
// test exercises the actual file the runtime reads — not a fixture that
// could drift from production data.
const BREED_STARTER_STATS_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'breedStarterStats.json',
);
const BREED_DATA = JSON.parse(readFileSync(BREED_STARTER_STATS_PATH, 'utf8'));
const BREED_NAMES = Object.keys(BREED_DATA);

// Pick a deterministic breed for individual case tests. Sorted to insulate
// against arbitrary JSON-key ordering changes.
const KNOWN_BREED = [...BREED_NAMES].sort()[0];

describe('horseStarterStats — exported constants', () => {
  it('TOTAL_STAT_CAP is 200 (game rule)', () => {
    expect(TOTAL_STAT_CAP).toBe(200);
  });

  it('STAT_KEYS contains exactly the canonical 12 stats', () => {
    // Order matters — Prisma schema column order. Any consumer that hard-codes
    // a different order is a bug per the service's contract comment.
    expect(STAT_KEYS).toEqual([
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
    ]);
  });

  it('STAT_KEYS has length 12 (sentinel against silent shrink)', () => {
    expect(STAT_KEYS).toHaveLength(12);
  });
});

describe('horseStarterStats — sampleStat (Box-Muller + clamp)', () => {
  it('returns an integer in [1, 100] for a typical breed-like (mean, std_dev)', () => {
    for (let i = 0; i < 1000; i++) {
      const v = sampleStat({ mean: 16, std_dev: 3 });
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('clamps to 1 (not 0) when mean is at the floor', () => {
    // mean=0 with any std_dev should never produce 0 — game rule "no zero stats"
    for (let i = 0; i < 1000; i++) {
      const v = sampleStat({ mean: 0, std_dev: 0 });
      expect(v).toBe(1);
    }
  });

  it('clamps to 100 (not over) when mean is well above the ceiling', () => {
    for (let i = 0; i < 1000; i++) {
      const v = sampleStat({ mean: 200, std_dev: 0 });
      expect(v).toBe(100);
    }
  });

  it('returns the rounded mean when std_dev is zero', () => {
    // With std_dev=0 the Box-Muller `z * 0` term is 0, so result = round(mean).
    expect(sampleStat({ mean: 50, std_dev: 0 })).toBe(50);
    expect(sampleStat({ mean: 17.4, std_dev: 0 })).toBe(17);
    expect(sampleStat({ mean: 17.6, std_dev: 0 })).toBe(18);
  });

  it('never returns NaN even when Math.random returns 0 (the EPSILON guard)', () => {
    // Force u1 = 0 by stubbing Math.random for the first call.
    const realRandom = Math.random;
    let calls = 0;
    Math.random = () => (calls++ === 0 ? 0 : 0.5);
    try {
      const v = sampleStat({ mean: 10, std_dev: 3 });
      expect(Number.isNaN(v)).toBe(false);
      expect(Number.isInteger(v)).toBe(true);
    } finally {
      Math.random = realRandom;
    }
  });

  it('sampled distribution mean tracks the requested mean (over many samples)', () => {
    const samples = [];
    for (let i = 0; i < 5000; i++) {
      samples.push(sampleStat({ mean: 30, std_dev: 5 }));
    }
    const observed = samples.reduce((s, v) => s + v, 0) / samples.length;
    // 5000 samples with std=5 → SE of mean ≈ 0.071. Three sigma is ~0.21.
    // Allow ±1.0 for headroom (Box-Muller + integer rounding + clamp at edges).
    expect(observed).toBeGreaterThan(29);
    expect(observed).toBeLessThan(31);
  });
});

describe('horseStarterStats — clampStatsToTotalCap', () => {
  const buildStats = values => Object.fromEntries(STAT_KEYS.map((k, i) => [k, values[i] ?? 0]));

  it('returns input unchanged (cloned) when total is already ≤ cap', () => {
    // Sum = 12 (one per stat), cap = 200 — well under.
    const input = buildStats(Array(12).fill(1));
    const out = clampStatsToTotalCap(input, 200);
    expect(out).toEqual(input);
    // Must be a clone, not the same reference (caller shouldn't mutate input).
    expect(out).not.toBe(input);
  });

  it('reduces total to ≤ cap when input total exceeds cap', () => {
    // Sum = 12 * 25 = 300, cap = 200 → must scale down.
    const input = buildStats(Array(12).fill(25));
    const out = clampStatsToTotalCap(input, 200);
    const total = Object.values(out).reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(200);
  });

  it('never produces a stat < 1 (preserves the floor)', () => {
    // Mix of high and very-low values; proportional scale would round low
    // values toward 0 without the Math.max(1, ...) clamp.
    const input = buildStats([100, 100, 100, 100, 100, 100, 1, 1, 1, 1, 1, 1]);
    const out = clampStatsToTotalCap(input, 200);
    for (const v of Object.values(out)) {
      expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  it('preserves all stat keys (no drops)', () => {
    const input = buildStats(Array(12).fill(50));
    const out = clampStatsToTotalCap(input, 200);
    expect(Object.keys(out).sort()).toEqual([...STAT_KEYS].sort());
  });

  it('converges (iterative trim terminates) for a heavy clamp scenario', () => {
    // 12 * 100 = 1200 → cap 200: factor ≈ 0.167. After scale + floor-clamp,
    // sum may sit slightly above 200 from rounding-up to 1; iterative trim
    // must converge in finite steps.
    const input = buildStats(Array(12).fill(100));
    const out = clampStatsToTotalCap(input, 200);
    const total = Object.values(out).reduce((s, v) => s + v, 0);
    expect(total).toBeLessThanOrEqual(200);
    expect(total).toBeGreaterThan(0); // sanity
  });

  it('handles cap === STAT_KEYS.length (the documented worst case)', () => {
    // Every stat must be exactly 1; total === 12.
    const input = buildStats(Array(12).fill(50));
    const out = clampStatsToTotalCap(input, STAT_KEYS.length);
    expect(Object.values(out).every(v => v === 1)).toBe(true);
    expect(Object.values(out).reduce((s, v) => s + v, 0)).toBe(STAT_KEYS.length);
  });

  it('handles cap exactly equal to total (no scaling needed)', () => {
    const input = buildStats(Array(12).fill(10)); // total = 120
    const out = clampStatsToTotalCap(input, 120);
    expect(out).toEqual(input);
  });
});

describe('horseStarterStats — generateStoreStats input validation', () => {
  it('throws statusCode=500 when breedName is null', () => {
    expect.assertions(2);
    try {
      generateStoreStats(null);
    } catch (err) {
      expect(err.statusCode).toBe(500);
      expect(err.message).toMatch(/Breed name is required/i);
    }
  });

  it('throws statusCode=500 when breedName is undefined', () => {
    expect.assertions(2);
    try {
      generateStoreStats(undefined);
    } catch (err) {
      expect(err.statusCode).toBe(500);
      expect(err.message).toMatch(/Breed name is required/i);
    }
  });

  it('throws statusCode=500 when breedName is empty string', () => {
    expect.assertions(2);
    try {
      generateStoreStats('');
    } catch (err) {
      expect(err.statusCode).toBe(500);
      expect(err.message).toMatch(/Breed name is required/i);
    }
  });

  it('throws statusCode=500 with explicit message when breed is unknown', () => {
    expect.assertions(2);
    try {
      generateStoreStats('NotARealBreed-z9z9z9');
    } catch (err) {
      expect(err.statusCode).toBe(500);
      expect(err.message).toMatch(/No starter-stats profile found/i);
    }
  });
});

describe('horseStarterStats — generateStoreStats output for a known breed', () => {
  it('returns an object with exactly the 12 STAT_KEYS', () => {
    const stats = generateStoreStats(KNOWN_BREED);
    expect(Object.keys(stats).sort()).toEqual([...STAT_KEYS].sort());
  });

  it('every stat is an integer in [1, 100]', () => {
    const stats = generateStoreStats(KNOWN_BREED);
    for (const [key, value] of Object.entries(stats)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
      // Defensive: catch a future regression where a key sneaks in unmapped.
      expect(STAT_KEYS).toContain(key);
    }
  });

  it('total stats ≤ TOTAL_STAT_CAP across 1000 generations (cap is enforced at generation time)', () => {
    let maxTotal = 0;
    let minStat = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 1000; i++) {
      const stats = generateStoreStats(KNOWN_BREED);
      const total = Object.values(stats).reduce((s, v) => s + v, 0);
      if (total > maxTotal) maxTotal = total;
      for (const v of Object.values(stats)) {
        if (v < minStat) minStat = v;
      }
      expect(total).toBeLessThanOrEqual(TOTAL_STAT_CAP);
    }
    // Sanity: at least one iteration should have hit the cap reasonably close
    // (otherwise the JSON means + std are too low to ever stress the cap and
    // this test isn't actually exercising the clamp path). Most breeds in
    // the JSON have means summing ~190-200 so this is comfortably true.
    expect(maxTotal).toBeGreaterThan(150);
    expect(minStat).toBeGreaterThanOrEqual(1);
  });
});

describe('horseStarterStats — data contract (every breed in the JSON)', () => {
  it('JSON has at least 200 breeds (sanity: catches truncated/empty file)', () => {
    expect(BREED_NAMES.length).toBeGreaterThanOrEqual(200);
  });

  it('every breed in breedStarterStats.json has a complete 12-stat profile', () => {
    // This is the contract that prevents a 500-on-purchase regression.
    // If a future PR adds a breed name without the matching JSON entry —
    // or adds the entry but omits a stat — the corresponding store
    // purchase / perf seed throws statusCode=500 in production. Catch
    // that here at unit-test time, not at runtime.
    const incompleteBreeds = [];
    for (const breedName of BREED_NAMES) {
      const profile = BREED_DATA[breedName];
      const missing = STAT_KEYS.filter(k => {
        const s = profile[k];
        return !s || typeof s.mean !== 'number';
      });
      if (missing.length > 0) {
        incompleteBreeds.push({ breedName, missing });
      }
    }
    if (incompleteBreeds.length > 0) {
      throw new Error(
        `Found ${incompleteBreeds.length} breeds with incomplete profiles:\n` +
          incompleteBreeds.map(b => `  ${b.breedName}: missing ${b.missing.join(', ')}`).join('\n'),
      );
    }
  });

  it('generateStoreStats produces valid output for every breed in the JSON', () => {
    // Spot-check the full breed catalog with one sample each. Doing 1000×
    // per breed would take seconds in pure CPU — one each is enough to
    // verify the contract holds for every breed name without bloating
    // the test runtime.
    const failures = [];
    for (const breedName of BREED_NAMES) {
      try {
        const stats = generateStoreStats(breedName);
        const total = Object.values(stats).reduce((s, v) => s + v, 0);
        if (total > TOTAL_STAT_CAP) {
          failures.push(`${breedName}: total ${total} > cap ${TOTAL_STAT_CAP}`);
        }
        for (const [k, v] of Object.entries(stats)) {
          if (!Number.isInteger(v) || v < 1 || v > 100) {
            failures.push(`${breedName}: ${k}=${v} out of [1,100]`);
          }
        }
      } catch (err) {
        failures.push(`${breedName}: threw ${err.message}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`generateStoreStats failed for ${failures.length} breeds:\n  ${failures.join('\n  ')}`);
    }
  });
});
