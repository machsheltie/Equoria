// Tests for gait breeding inheritance (Story 31B-2, Adversarial Review #2).
// Validates inherited gait score generation, formula correctness, fallback behavior,
// NaN/string/empty parent handling, and statistical properties of gait inheritance.

import {
  generateInheritedGaitScores,
  generateGaitScores,
  hasValidGaitScores,
  validateGaitScores,
  STANDARD_GAITS,
} from '../modules/horses/services/gaitService.mjs';
import { BREED_GENETIC_PROFILES } from '../modules/horses/data/breedGeneticProfiles.mjs';

// Helper: average conformation (bonus = 0)
const avgConformation = {
  head: 70,
  neck: 70,
  shoulders: 70,
  back: 70,
  hindquarters: 70,
  legs: 70,
  hooves: 70,
  topline: 70,
};

// Helper: standard parent gait scores
const sireGaits = { walk: 70, trot: 80, canter: 85, gallop: 95, gaiting: null };
const damGaits = { walk: 68, trot: 76, canter: 82, gallop: 90, gaiting: null };

// === hasValidGaitScores ===

describe('hasValidGaitScores', () => {
  test('returns true for object with valid standard gait scores', () => {
    expect(hasValidGaitScores(sireGaits)).toBe(true);
  });

  test('returns false for null', () => {
    expect(hasValidGaitScores(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(hasValidGaitScores(undefined)).toBe(false);
  });

  test('returns false for empty object', () => {
    expect(hasValidGaitScores({})).toBe(false);
  });

  test('returns false for object with no gait keys', () => {
    expect(hasValidGaitScores({ foo: 80, bar: 90 })).toBe(false);
  });

  test('returns true for object with at least one valid gait', () => {
    expect(hasValidGaitScores({ walk: 65 })).toBe(true);
  });

  test('returns false for object with only NaN gait values', () => {
    const nanGaits = {};
    for (const gait of STANDARD_GAITS) {
      nanGaits[gait] = NaN;
    }
    expect(hasValidGaitScores(nanGaits)).toBe(false);
  });

  test('returns false for object with string gait values', () => {
    expect(hasValidGaitScores({ walk: 'fast', trot: 'medium' })).toBe(false);
  });
});

// === validateGaitScores ===

describe('validateGaitScores', () => {
  test('returns valid object with all 4 gaits + gaiting', () => {
    const input = { walk: 70, trot: 80, canter: 85, gallop: 90, gaiting: null };
    const result = validateGaitScores(input);
    expect(result.walk).toBe(70);
    expect(result.trot).toBe(80);
    expect(result.canter).toBe(85);
    expect(result.gallop).toBe(90);
    expect(result.gaiting).toBeNull();
  });

  test('clamps out-of-range values', () => {
    const input = { walk: 150, trot: -10, canter: 50, gallop: 80, gaiting: null };
    const result = validateGaitScores(input);
    expect(result.walk).toBe(100);
    expect(result.trot).toBe(0);
  });

  test('fills missing gaits with 50', () => {
    const input = { walk: 80 };
    const result = validateGaitScores(input);
    expect(result.walk).toBe(80);
    expect(result.trot).toBe(50);
    expect(result.canter).toBe(50);
    expect(result.gallop).toBe(50);
  });

  test('handles null input gracefully', () => {
    const result = validateGaitScores(null);
    for (const gait of STANDARD_GAITS) {
      expect(result[gait]).toBe(50);
    }
    expect(result.gaiting).toBeNull();
  });

  test('handles undefined input gracefully', () => {
    const result = validateGaitScores(undefined);
    for (const gait of STANDARD_GAITS) {
      expect(result[gait]).toBe(50);
    }
  });

  test('replaces NaN values with 50', () => {
    const input = { walk: NaN, trot: 80, canter: 70, gallop: 60, gaiting: null };
    const result = validateGaitScores(input);
    expect(result.walk).toBe(50);
    expect(result.trot).toBe(80);
  });

  test('preserves valid gaiting array', () => {
    const input = {
      walk: 70,
      trot: 80,
      canter: 85,
      gallop: 90,
      gaiting: [
        { name: 'Slow Gait', score: 75 },
        { name: 'Rack', score: 82 },
      ],
    };
    const result = validateGaitScores(input);
    expect(result.gaiting).toHaveLength(2);
    expect(result.gaiting[0].name).toBe('Slow Gait');
    expect(result.gaiting[0].score).toBe(75);
    expect(result.gaiting[1].score).toBe(82);
  });

  test('clamps gaiting entry scores', () => {
    const input = {
      walk: 70,
      trot: 80,
      canter: 85,
      gallop: 90,
      gaiting: [{ name: 'Test', score: 150 }],
    };
    const result = validateGaitScores(input);
    expect(result.gaiting[0].score).toBe(100);
  });
});

// === NaN/String/Empty parent gait score handling ===

describe('generateInheritedGaitScores — corrupted parent data', () => {
  test('NaN parent gait score falls back to breed mean (not silent NaN→50)', () => {
    const breedId = 1; // Thoroughbred, gallop mean = 90
    const sireWithNaN = { ...sireGaits, gallop: NaN };
    const damWithNaN = { ...damGaits, gallop: NaN };
    const gallopScores = [];

    for (let i = 0; i < 500; i++) {
      const scores = generateInheritedGaitScores(breedId, sireWithNaN, damWithNaN, avgConformation);
      gallopScores.push(scores.gallop);
    }

    const avg = gallopScores.reduce((a, b) => a + b, 0) / gallopScores.length;
    // With both parents NaN, should use breed mean (90), not degrade to 50
    expect(avg).toBeGreaterThan(80);
    expect(avg).toBeLessThan(100);
  });

  test('string parent gait score falls back to breed mean', () => {
    const sireWithString = { ...sireGaits, walk: 'fast' };
    const scores = generateInheritedGaitScores(1, sireWithString, damGaits, avgConformation);
    expect(Number.isInteger(scores.walk)).toBe(true);
    expect(scores.walk).toBeGreaterThanOrEqual(0);
    expect(scores.walk).toBeLessThanOrEqual(100);
  });

  test('Infinity parent gait score falls back to breed mean', () => {
    const sireWithInf = { ...sireGaits, trot: Infinity };
    const scores = generateInheritedGaitScores(1, sireWithInf, damGaits, avgConformation);
    expect(Number.isInteger(scores.trot)).toBe(true);
    expect(scores.trot).toBeGreaterThanOrEqual(0);
    expect(scores.trot).toBeLessThanOrEqual(100);
  });

  test('null parent gait value falls back to breed mean', () => {
    const sireWithNull = { ...sireGaits, canter: null };
    const scores = generateInheritedGaitScores(1, sireWithNull, damGaits, avgConformation);
    expect(Number.isInteger(scores.canter)).toBe(true);
  });

  test('partial parent gaits (missing some gaits) still produces valid foal', () => {
    const partialSire = { walk: 70, trot: 80 }; // missing canter, gallop
    const scores = generateInheritedGaitScores(1, partialSire, damGaits, avgConformation);
    for (const gait of STANDARD_GAITS) {
      expect(Number.isInteger(scores[gait])).toBe(true);
      expect(scores[gait]).toBeGreaterThanOrEqual(0);
      expect(scores[gait]).toBeLessThanOrEqual(100);
    }
  });

  test('both parents with string scores produce valid foal', () => {
    const sireStrings = { walk: 'fast', trot: 'slow', canter: 'medium', gallop: 'high' };
    const damStrings = { walk: 'ok', trot: 'good', canter: 'bad', gallop: 'great' };
    const scores = generateInheritedGaitScores(1, sireStrings, damStrings, avgConformation);
    for (const gait of STANDARD_GAITS) {
      expect(Number.isInteger(scores[gait])).toBe(true);
      expect(scores[gait]).toBeGreaterThanOrEqual(0);
      expect(scores[gait]).toBeLessThanOrEqual(100);
    }
  });
});

// === Independent gaited gait variance (F-7) ===

describe('Gaited gait independence', () => {
  test('gaited breed store horse gets independent scores per named gait (not all identical)', () => {
    // American Saddlebred (breed 3) has Slow Gait and Rack
    const distinctPairCount = { same: 0, different: 0 };

    for (let i = 0; i < 200; i++) {
      const scores = generateGaitScores(3, avgConformation);
      if (scores.gaiting[0].score === scores.gaiting[1].score) {
        distinctPairCount.same++;
      } else {
        distinctPairCount.different++;
      }
    }

    // With independent rolls, we expect SOME pairs to be different
    // (With shared roll, ALL would be same — probability of 200 identical independent rolls is ~0)
    expect(distinctPairCount.different).toBeGreaterThan(0);
  });

  test('inherited gaited breed gets independent scores per named gait', () => {
    const gaitedSire = {
      walk: 70,
      trot: 75,
      canter: 70,
      gallop: 65,
      gaiting: [
        { name: 'Slow Gait', score: 85 },
        { name: 'Rack', score: 85 },
      ],
    };
    const gaitedDam = {
      walk: 68,
      trot: 73,
      canter: 68,
      gallop: 63,
      gaiting: [
        { name: 'Slow Gait', score: 80 },
        { name: 'Rack', score: 80 },
      ],
    };

    const distinctPairCount = { same: 0, different: 0 };

    for (let i = 0; i < 200; i++) {
      const scores = generateInheritedGaitScores(3, gaitedSire, gaitedDam, avgConformation);
      if (scores.gaiting[0].score === scores.gaiting[1].score) {
        distinctPairCount.same++;
      } else {
        distinctPairCount.different++;
      }
    }

    expect(distinctPairCount.different).toBeGreaterThan(0);
  });
});

// === Statistical validation — gait inheritance ===

describe('Statistical validation — gait inheritance', () => {
  test('high-scoring parents produce foals averaging above breed mean', () => {
    const breedId = 1; // Thoroughbred, gallop mean = 90
    const breedMean = BREED_GENETIC_PROFILES[breedId].rating_profiles.gaits.gallop.mean;
    const highSire = { walk: 85, trot: 90, canter: 95, gallop: 100, gaiting: null };
    const highDam = { walk: 82, trot: 88, canter: 92, gallop: 98, gaiting: null };
    const foalScores = [];

    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedGaitScores(breedId, highSire, highDam, avgConformation);
      foalScores.push(scores.gallop);
    }

    const avg = foalScores.reduce((a, b) => a + b, 0) / foalScores.length;
    expect(avg).toBeGreaterThan(breedMean);
  });

  test('low-scoring parents produce foals above parent avg (regression to mean)', () => {
    const breedId = 1; // Thoroughbred, walk mean = 65
    const lowSire = { walk: 30, trot: 30, canter: 30, gallop: 30, gaiting: null };
    const lowDam = { walk: 30, trot: 30, canter: 30, gallop: 30, gaiting: null };
    const walkScores = [];

    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedGaitScores(breedId, lowSire, lowDam, avgConformation);
      walkScores.push(scores.walk);
    }

    const avg = walkScores.reduce((a, b) => a + b, 0) / walkScores.length;
    // baseValue = (30*0.6) + (65*0.4) = 18 + 26 = 44 — above parent avg of 30
    expect(avg).toBeGreaterThan(30);
  });

  test('Appaloosa (breed 6) inherited gait scores are valid', () => {
    const breedId = 6;
    const sire = { walk: 75, trot: 80, canter: 70, gallop: 85, gaiting: null };
    const dam = { walk: 72, trot: 78, canter: 68, gallop: 82, gaiting: null };

    for (let i = 0; i < 50; i++) {
      const scores = generateInheritedGaitScores(breedId, sire, dam, avgConformation);
      for (const gait of STANDARD_GAITS) {
        expect(Number.isInteger(scores[gait])).toBe(true);
        expect(scores[gait]).toBeGreaterThanOrEqual(0);
        expect(scores[gait]).toBeLessThanOrEqual(100);
      }
      expect(scores.gaiting).toBeNull();
    }
  });

  test('swapping sire/dam gait scores produces same statistical average', () => {
    const breedId = 1;
    const sireA = { walk: 90, trot: 80, canter: 70, gallop: 60, gaiting: null };
    const damA = { walk: 50, trot: 80, canter: 70, gallop: 60, gaiting: null };
    const sireB = { walk: 50, trot: 80, canter: 70, gallop: 60, gaiting: null };
    const damB = { walk: 90, trot: 80, canter: 70, gallop: 60, gaiting: null };

    const scoresA = [];
    const scoresB = [];
    for (let i = 0; i < 2000; i++) {
      scoresA.push(generateInheritedGaitScores(breedId, sireA, damA, avgConformation).walk);
      scoresB.push(generateInheritedGaitScores(breedId, sireB, damB, avgConformation).walk);
    }

    const avgA = scoresA.reduce((a, b) => a + b, 0) / scoresA.length;
    const avgB = scoresB.reduce((a, b) => a + b, 0) / scoresB.length;
    expect(Math.abs(avgA - avgB)).toBeLessThan(3);
  });
});
