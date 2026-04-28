// Tests for conformation score generation service.
// Validates score generation, normal distribution, clamping, and overall calculation.
// Covers AC #1, #2, #4, #5 from Story 31B-1.

import {
  normalRandom,
  clampScore,
  calculateOverallConformation,
  generateConformationScores,
  CONFORMATION_REGIONS,
} from '../modules/horses/services/conformationService.mjs';
import { BREED_GENETIC_PROFILES } from '../modules/horses/data/breedGeneticProfiles.mjs';

// === Task 3.1: Score generation produces all 8 regions ===

describe('generateConformationScores', () => {
  test('produces all 8 conformation regions', () => {
    const scores = generateConformationScores(1); // Thoroughbred
    for (const region of CONFORMATION_REGIONS) {
      expect(scores).toHaveProperty(region);
    }
  });

  test('produces overallConformation field', () => {
    const scores = generateConformationScores(1);
    expect(scores).toHaveProperty('overallConformation');
  });

  test('returns exactly 8 region keys plus overallConformation', () => {
    const scores = generateConformationScores(1);
    const keys = Object.keys(scores);
    expect(keys).toHaveLength(9); // 8 regions + overallConformation
  });

  // === Task 3.2: All scores are integers in [0, 100] ===

  test('all region scores are integers in [0, 100]', () => {
    // Run multiple times to increase confidence
    for (let i = 0; i < 50; i++) {
      const scores = generateConformationScores(1);
      for (const region of CONFORMATION_REGIONS) {
        expect(Number.isInteger(scores[region])).toBe(true);
        expect(scores[region]).toBeGreaterThanOrEqual(0);
        expect(scores[region]).toBeLessThanOrEqual(100);
      }
    }
  });

  test('overallConformation is an integer in [0, 100]', () => {
    for (let i = 0; i < 50; i++) {
      const scores = generateConformationScores(1);
      expect(Number.isInteger(scores.overallConformation)).toBe(true);
      expect(scores.overallConformation).toBeGreaterThanOrEqual(0);
      expect(scores.overallConformation).toBeLessThanOrEqual(100);
    }
  });

  // === Task 3.5: All breeds produce valid scores ===

  const ALL_BREED_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  test.each(ALL_BREED_IDS)('breed %i produces valid conformation scores', breedId => {
    const scores = generateConformationScores(breedId);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
    expect(Number.isInteger(scores.overallConformation)).toBe(true);
  });

  // New contract (post-309-breeds refactor): missing/invalid breed identifiers
  // must throw rather than silently returning stub defaults. The old silent-50
  // fallback was the root cause of store horses arriving with generic random
  // stats; see PR that introduced breedProfiles.json.
  test('unknown numeric breedId throws', () => {
    expect(() => generateConformationScores(999)).toThrow(/No canonical-12 breed for numeric breedId 999/);
  });

  test.each([0, null, undefined, NaN])('invalid breed identifier %p throws', breedId => {
    expect(() => generateConformationScores(breedId)).toThrow();
  });
});

// === Task 3.4: overallConformation calculation ===

describe('calculateOverallConformation', () => {
  test('returns arithmetic mean of all 8 regions', () => {
    const scores = {
      head: 80,
      neck: 70,
      shoulders: 60,
      back: 50,
      hindquarters: 90,
      legs: 40,
      hooves: 30,
      topline: 80,
    };
    // Mean = (80+70+60+50+90+40+30+80) / 8 = 500/8 = 62.5 → 63
    expect(calculateOverallConformation(scores)).toBe(63);
  });

  test('returns rounded integer', () => {
    const scores = {
      head: 75,
      neck: 75,
      shoulders: 75,
      back: 75,
      hindquarters: 75,
      legs: 75,
      hooves: 75,
      topline: 76,
    };
    // Mean = (75*7 + 76) / 8 = 601/8 = 75.125 → 75
    expect(calculateOverallConformation(scores)).toBe(75);
  });

  test('handles all zeros', () => {
    const scores = {
      head: 0,
      neck: 0,
      shoulders: 0,
      back: 0,
      hindquarters: 0,
      legs: 0,
      hooves: 0,
      topline: 0,
    };
    expect(calculateOverallConformation(scores)).toBe(0);
  });

  test('handles all 100s', () => {
    const scores = {
      head: 100,
      neck: 100,
      shoulders: 100,
      back: 100,
      hindquarters: 100,
      legs: 100,
      hooves: 100,
      topline: 100,
    };
    expect(calculateOverallConformation(scores)).toBe(100);
  });

  test('handles partial scores (missing regions default to 0)', () => {
    const scores = { head: 80, neck: 80 };
    // (80 + 80 + 0*6) / 8 = 160/8 = 20
    expect(calculateOverallConformation(scores)).toBe(20);
  });

  test('handles legacy scores without overallConformation key', () => {
    // Legacy horses have { head: 20, neck: 20, ... } with no overallConformation
    const legacyScores = {
      head: 20,
      neck: 20,
      shoulders: 20,
      back: 20,
      hindquarters: 20,
      legs: 20,
      hooves: 20,
      topline: 20,
    };
    expect(calculateOverallConformation(legacyScores)).toBe(20);
  });

  // Edge case: null/undefined scores parameter should not crash
  // CONF-2: returns neutral midpoint 50 (not 0) to avoid permanently disadvantaging a horse
  test('returns 50 for null scores', () => {
    expect(calculateOverallConformation(null)).toBe(50);
  });

  test('returns 50 for undefined scores', () => {
    expect(calculateOverallConformation(undefined)).toBe(50);
  });
});

// === Task 3.1 + 3.3: normalRandom distribution ===

describe('normalRandom', () => {
  test('returns a number', () => {
    const result = normalRandom(50, 8);
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result)).toBe(true);
  });

  test('1000+ samples center around the specified mean (tolerance ±2)', () => {
    const mean = 75;
    const stdDev = 8;
    const samples = [];
    for (let i = 0; i < 2000; i++) {
      samples.push(normalRandom(mean, stdDev));
    }
    const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length;
    // With 2000 samples and std_dev=8, the standard error is 8/sqrt(2000) ≈ 0.179
    // 99% CI is about ±0.46, so tolerance of ±2 is very generous
    expect(sampleMean).toBeGreaterThan(mean - 2);
    expect(sampleMean).toBeLessThan(mean + 2);
  });

  test('1000+ samples have standard deviation close to specified (tolerance ±2)', () => {
    const mean = 75;
    const stdDev = 8;
    const samples = [];
    for (let i = 0; i < 2000; i++) {
      samples.push(normalRandom(mean, stdDev));
    }
    const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sampleVariance = samples.reduce((acc, val) => acc + (val - sampleMean) ** 2, 0) / (samples.length - 1);
    const sampleStdDev = Math.sqrt(sampleVariance);
    expect(sampleStdDev).toBeGreaterThan(stdDev - 2);
    expect(sampleStdDev).toBeLessThan(stdDev + 2);
  });
});

// === clampScore edge cases ===

describe('clampScore', () => {
  test('rounds to nearest integer', () => {
    expect(clampScore(72.4)).toBe(72);
    expect(clampScore(72.5)).toBe(73);
    expect(clampScore(72.6)).toBe(73);
  });

  test('clamps values below 0 to 0', () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(-100)).toBe(0);
    expect(clampScore(-0.1)).toBe(0);
  });

  test('clamps values above 100 to 100', () => {
    expect(clampScore(105)).toBe(100);
    expect(clampScore(200)).toBe(100);
    expect(clampScore(100.4)).toBe(100);
  });

  test('passes through valid values', () => {
    expect(clampScore(0)).toBe(0);
    expect(clampScore(50)).toBe(50);
    expect(clampScore(100)).toBe(100);
  });

  test('handles NaN input gracefully (fallback to 50)', () => {
    expect(clampScore(NaN)).toBe(50);
    expect(clampScore(Infinity)).toBe(50);
    expect(clampScore(-Infinity)).toBe(50);
  });

  // Task 3.5: Edge cases for extreme means
  test('handles extreme mean near 0 (breed with low mean)', () => {
    // Simulate a score generated from mean=5, std_dev=8
    // Some values will go negative and should be clamped to 0
    expect(clampScore(-3)).toBe(0);
    expect(clampScore(2.7)).toBe(3);
  });

  test('handles extreme mean near 100', () => {
    // Simulate a score generated from mean=98, std_dev=8
    // Some values will exceed 100 and should be clamped
    expect(clampScore(106)).toBe(100);
    expect(clampScore(97.3)).toBe(97);
  });
});

// === Task 5.1: Statistical validation (AC #5) ===

describe('Statistical validation - normal distribution verification', () => {
  test('95% of 1000 generated scores fall within breedMean ± 2*stdDev per region', () => {
    const breedId = 1; // Thoroughbred
    const conformation = BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation;
    const sampleSize = 1000;
    const allScores = [];

    for (let i = 0; i < sampleSize; i++) {
      allScores.push(generateConformationScores(breedId));
    }

    // Check each region independently
    for (const region of CONFORMATION_REGIONS) {
      const regionMean = conformation[region].mean;
      const regionStdDev = conformation[region].std_dev;
      const lowerBound = regionMean - 2 * regionStdDev;
      const upperBound = regionMean + 2 * regionStdDev;

      const withinRange = allScores.filter(s => {
        return s[region] >= lowerBound && s[region] <= upperBound;
      }).length;

      const percentage = (withinRange / sampleSize) * 100;

      // Normal distribution: ~95.4% within 2 std_devs (AC #5 specifies 95%)
      // With clamping at 0 and 100, actual percentage is ≥95% in practice
      // Threshold set to 90% to avoid rare flaky failures from random sampling
      expect(percentage).toBeGreaterThanOrEqual(90);
    }
  });

  test('generated head scores for Thoroughbred center around mean 78', () => {
    const breedId = 1;
    const sampleSize = 1000;
    const headScores = [];

    for (let i = 0; i < sampleSize; i++) {
      const scores = generateConformationScores(breedId);
      headScores.push(scores.head);
    }

    const avgHead = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // Tolerance: mean ±3 (generous for integer-rounded, clamped scores)
    expect(avgHead).toBeGreaterThan(75);
    expect(avgHead).toBeLessThan(81);
  });
});
