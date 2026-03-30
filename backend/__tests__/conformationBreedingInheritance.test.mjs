// Tests for conformation breeding inheritance (Story 31B-2).
// Validates inherited score generation, formula correctness, fallback behavior,
// and statistical properties of the inheritance system.

import {
  generateInheritedConformationScores,
  hasValidConformationScores,
  validateConformationScores,
  CONFORMATION_REGIONS,
} from '../modules/horses/services/conformationService.mjs';
import { BREED_GENETIC_PROFILES } from '../modules/horses/data/breedGeneticProfiles.mjs';

// Helper: create a scores object with a uniform value for all regions
function uniformScores(value) {
  const scores = {};
  for (const region of CONFORMATION_REGIONS) {
    scores[region] = value;
  }
  return scores;
}

// === Task 3.1: generateInheritedConformationScores returns all 8 regions + overallConformation ===

describe('generateInheritedConformationScores', () => {
  const sireScores = uniformScores(80);
  const damScores = uniformScores(70);

  test('returns all 8 conformation regions', () => {
    const scores = generateInheritedConformationScores(1, sireScores, damScores);
    for (const region of CONFORMATION_REGIONS) {
      expect(scores).toHaveProperty(region);
    }
  });

  test('returns overallConformation field', () => {
    const scores = generateInheritedConformationScores(1, sireScores, damScores);
    expect(scores).toHaveProperty('overallConformation');
  });

  test('returns exactly 9 keys (8 regions + overallConformation)', () => {
    const scores = generateInheritedConformationScores(1, sireScores, damScores);
    expect(Object.keys(scores)).toHaveLength(9);
  });

  // === Task 3.2: All scores are integers in [0, 100] ===

  test('all region scores are integers in [0, 100]', () => {
    for (let i = 0; i < 50; i++) {
      const scores = generateInheritedConformationScores(1, sireScores, damScores);
      for (const region of CONFORMATION_REGIONS) {
        expect(Number.isInteger(scores[region])).toBe(true);
        expect(scores[region]).toBeGreaterThanOrEqual(0);
        expect(scores[region]).toBeLessThanOrEqual(100);
      }
    }
  });

  test('overallConformation is an integer in [0, 100]', () => {
    for (let i = 0; i < 50; i++) {
      const scores = generateInheritedConformationScores(1, sireScores, damScores);
      expect(Number.isInteger(scores.overallConformation)).toBe(true);
      expect(scores.overallConformation).toBeGreaterThanOrEqual(0);
      expect(scores.overallConformation).toBeLessThanOrEqual(100);
    }
  });

  // === Task 3.3: Formula verification with known inputs ===

  test('baseValue formula: (sire*0.5 + dam*0.5)*0.6 + breedMean*0.4', () => {
    // Use Thoroughbred (ID 1), head region: mean=78, std_dev=8
    // sire head=90, dam head=80
    // Expected baseValue = (90*0.5 + 80*0.5)*0.6 + 78*0.4 = 85*0.6 + 31.2 = 51 + 31.2 = 82.2
    // With 1000 samples at std_dev=8, average should be close to 82.2
    const sire = { ...uniformScores(50), head: 90 };
    const dam = { ...uniformScores(50), head: 80 };
    const headScores = [];
    for (let i = 0; i < 2000; i++) {
      const scores = generateInheritedConformationScores(1, sire, dam);
      headScores.push(scores.head);
    }
    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // Expected baseValue = 82.2, tolerance ±2 for sampling variance
    expect(avg).toBeGreaterThan(80);
    expect(avg).toBeLessThan(85);
  });

  // === Task 3.7, 3.8, 3.9: Null parent fallback ===

  test('null sireScores falls back to breed-only generation', () => {
    const scores = generateInheritedConformationScores(1, null, damScores);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
    expect(scores).toHaveProperty('overallConformation');
  });

  test('null damScores falls back to breed-only generation', () => {
    const scores = generateInheritedConformationScores(1, sireScores, null);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
    expect(scores).toHaveProperty('overallConformation');
  });

  test('both parents null falls back to breed-only generation', () => {
    const scores = generateInheritedConformationScores(1, null, null);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
    expect(scores).toHaveProperty('overallConformation');
  });

  // === Task 3.10: All 12 breeds produce valid inherited scores ===

  const ALL_BREED_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  test.each(ALL_BREED_IDS)('breed %i produces valid inherited conformation scores', breedId => {
    const scores = generateInheritedConformationScores(breedId, sireScores, damScores);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
    expect(Number.isInteger(scores.overallConformation)).toBe(true);
  });

  // === Task 3.11: Unknown breed with valid parents ===

  test('unknown breed with valid parents falls back to default scores (50)', () => {
    const scores = generateInheritedConformationScores(999, sireScores, damScores);
    for (const region of CONFORMATION_REGIONS) {
      expect(scores[region]).toBe(50);
    }
    expect(scores.overallConformation).toBe(50);
  });

  // Edge case: NaN parent region scores should fall back to breed mean, not propagate NaN
  test('NaN parent region score falls back to breed mean (not silent NaN→50)', () => {
    const sireWithNaN = { ...uniformScores(80), head: NaN };
    const damWithNaN = { ...uniformScores(70), head: NaN };
    // With both parents NaN for head, should use breed mean (78 for Thoroughbred)
    // and NOT silently degrade to 50 via clampScore(NaN)
    const headScores = [];
    for (let i = 0; i < 500; i++) {
      const scores = generateInheritedConformationScores(1, sireWithNaN, damWithNaN);
      expect(Number.isInteger(scores.head)).toBe(true);
      expect(scores.head).toBeGreaterThanOrEqual(0);
      expect(scores.head).toBeLessThanOrEqual(100);
      headScores.push(scores.head);
    }
    // Average should be near breed mean (78), not 50
    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    expect(avg).toBeGreaterThan(70);
    expect(avg).toBeLessThan(86);
  });

  // Edge case: string parent region scores should be treated as invalid
  test('string sire region score falls back to breed mean', () => {
    const sireWithString = { ...uniformScores(80), head: 'eighty' };
    const scores = generateInheritedConformationScores(1, sireWithString, damScores);
    expect(Number.isInteger(scores.head)).toBe(true);
    expect(scores.head).toBeGreaterThanOrEqual(0);
    expect(scores.head).toBeLessThanOrEqual(100);
  });

  test('string dam region score falls back to breed mean', () => {
    const damWithString = { ...uniformScores(70), neck: 'seventy' };
    const scores = generateInheritedConformationScores(1, sireScores, damWithString);
    expect(Number.isInteger(scores.neck)).toBe(true);
    expect(scores.neck).toBeGreaterThanOrEqual(0);
    expect(scores.neck).toBeLessThanOrEqual(100);
  });

  test('string scores in both parents fall back to breed mean', () => {
    const sireWithString = { ...uniformScores(80), shoulders: 'high' };
    const damWithString = { ...uniformScores(70), shoulders: 'low' };
    const scores = generateInheritedConformationScores(1, sireWithString, damWithString);
    expect(Number.isInteger(scores.shoulders)).toBe(true);
    expect(scores.shoulders).toBeGreaterThanOrEqual(0);
    expect(scores.shoulders).toBeLessThanOrEqual(100);
  });
});

// === Task 3.6: Variance — foals from identical parents are NOT all identical ===

describe('Inheritance variance', () => {
  test('1000 foals from identical parents are NOT all identical', () => {
    const parentScores = uniformScores(75);
    const results = new Set();
    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedConformationScores(1, parentScores, parentScores);
      results.add(scores.head);
    }
    // With normalRandom variance, there should be many distinct values
    expect(results.size).toBeGreaterThan(5);
  });
});

// === Task 4: Statistical validation (AC #3, #4) ===

describe('Statistical validation - breeding inheritance', () => {
  // Task 4.1: High-scoring parents produce foals averaging above breed mean
  test('high-scoring parents (sire=95, dam=90) produce foals with average head > breed mean', () => {
    const breedId = 1; // Thoroughbred, head mean = 78
    const breedMean = BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation.head.mean;
    const sire = { ...uniformScores(80), head: 95 };
    const dam = { ...uniformScores(80), head: 90 };
    const headScores = [];

    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedConformationScores(breedId, sire, dam);
      headScores.push(scores.head);
    }

    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // Expected baseValue = (95*0.5 + 90*0.5)*0.6 + 78*0.4 = 92.5*0.6 + 31.2 = 55.5 + 31.2 = 86.7
    // Average should be > breed mean (78) by at least 5 points
    expect(avg).toBeGreaterThan(breedMean + 5);
  });

  // Task 4.2: Low-scoring parents produce foals averaging higher than parents (regression to mean)
  test('low-scoring parents (head=40) produce foals with average head > 40 (regression to mean)', () => {
    const breedId = 1; // Thoroughbred, head mean = 78
    const sire = { ...uniformScores(40), head: 40 };
    const dam = { ...uniformScores(40), head: 40 };
    const headScores = [];

    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedConformationScores(breedId, sire, dam);
      headScores.push(scores.head);
    }

    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // Expected baseValue = (40*0.5 + 40*0.5)*0.6 + 78*0.4 = 24 + 31.2 = 55.2
    // Average should be > parent avg (40) showing regression toward breed mean
    expect(avg).toBeGreaterThan(40);
  });

  // Task 4.3: 95% of inherited scores fall within baseValue ± 2*breedStdDev
  test('95% of inherited scores fall within baseValue ± 2*breedStdDev', () => {
    const breedId = 1; // Thoroughbred
    const conformation = BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation;
    const sire = uniformScores(80);
    const dam = uniformScores(70);
    const sampleSize = 1000;
    const allScores = [];

    for (let i = 0; i < sampleSize; i++) {
      allScores.push(generateInheritedConformationScores(breedId, sire, dam));
    }

    for (const region of CONFORMATION_REGIONS) {
      const regionMean = conformation[region].mean;
      const regionStdDev = conformation[region].std_dev;
      // baseValue = (sire*0.5 + dam*0.5)*0.6 + breedMean*0.4
      const parentAvg = sire[region] * 0.5 + dam[region] * 0.5;
      const baseValue = parentAvg * 0.6 + regionMean * 0.4;
      const lowerBound = baseValue - 2 * regionStdDev;
      const upperBound = baseValue + 2 * regionStdDev;

      const withinRange = allScores.filter(s => {
        return s[region] >= lowerBound && s[region] <= upperBound;
      }).length;

      const percentage = (withinRange / sampleSize) * 100;
      // Normal distribution: ~95.4% within 2 std_devs
      // Use 90% as conservative lower bound to avoid flakiness
      expect(percentage).toBeGreaterThanOrEqual(90);
    }
  });

  // Statistical validation: non-Thoroughbred breed (Appaloosa, ID 6)
  test('Appaloosa (breed 6) high-scoring parents produce foals above breed mean', () => {
    const breedId = 6;
    const breedMean = BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation.head.mean;
    const sire = { ...uniformScores(85), head: 95 };
    const dam = { ...uniformScores(85), head: 95 };
    const headScores = [];

    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedConformationScores(breedId, sire, dam);
      headScores.push(scores.head);
    }

    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // Parents at 95 with breed mean lower → foals should exceed breed mean
    expect(avg).toBeGreaterThan(breedMean);
  });
});

// === F-1: Legacy parent scores (score=20) are intentional game design ===

describe('Legacy parent scores - intentional game design', () => {
  test('parents with low scores (20) produce foals worse than breed mean — this is by design', () => {
    // Legacy/store horses default to score 20. Players who breed unimproved horses
    // will get weaker foals — this is the intended natural consequence.
    const breedId = 1; // Thoroughbred, head mean = 78
    const breedMean = BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation.head.mean;
    const legacyParent = uniformScores(20);
    const headScores = [];

    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedConformationScores(breedId, legacyParent, legacyParent);
      headScores.push(scores.head);
    }

    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // baseValue = (20*0.5 + 20*0.5)*0.6 + 78*0.4 = 12 + 31.2 = 43.2
    // Foal average should be around 43, well below breed mean of 78
    // This is intentional — players must train/show to produce better offspring
    expect(avg).toBeLessThan(breedMean);
    expect(avg).toBeGreaterThan(35);
    expect(avg).toBeLessThan(52);
  });

  test('improved parents (score=90) produce foals above breed mean — reward for training', () => {
    const breedId = 1;
    const breedMean = BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation.head.mean;
    const improvedParent = uniformScores(90);
    const headScores = [];

    for (let i = 0; i < 1000; i++) {
      const scores = generateInheritedConformationScores(breedId, improvedParent, improvedParent);
      headScores.push(scores.head);
    }

    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // baseValue = (90*0.5 + 90*0.5)*0.6 + 78*0.4 = 54 + 31.2 = 85.2
    // Players who train their horses get rewarded with superior offspring
    expect(avg).toBeGreaterThan(breedMean);
  });
});

// === F-5: Asymmetric parent contribution verification ===

describe('Asymmetric parent contributions', () => {
  test('sire=90 dam=50 produces average near parentAvg*0.6 + breedMean*0.4', () => {
    // sire head=90, dam head=50 → parentAvg = (90+50)/2 = 70
    // baseValue = 70*0.6 + 78*0.4 = 42 + 31.2 = 73.2
    const breedId = 1;
    const sire = { ...uniformScores(70), head: 90 };
    const dam = { ...uniformScores(70), head: 50 };
    const headScores = [];

    for (let i = 0; i < 2000; i++) {
      const scores = generateInheritedConformationScores(breedId, sire, dam);
      headScores.push(scores.head);
    }

    const avg = headScores.reduce((a, b) => a + b, 0) / headScores.length;
    // Expected baseValue = 73.2, tolerance ±3 for sampling variance
    expect(avg).toBeGreaterThan(70);
    expect(avg).toBeLessThan(77);
  });

  test('50/50 split: swapping sire/dam scores produces same statistical average', () => {
    const breedId = 1;
    const sireA = { ...uniformScores(70), head: 90 };
    const damA = { ...uniformScores(70), head: 50 };
    const sireB = { ...uniformScores(70), head: 50 };
    const damB = { ...uniformScores(70), head: 90 };

    const scoresA = [];
    const scoresB = [];
    for (let i = 0; i < 2000; i++) {
      scoresA.push(generateInheritedConformationScores(breedId, sireA, damA).head);
      scoresB.push(generateInheritedConformationScores(breedId, sireB, damB).head);
    }

    const avgA = scoresA.reduce((a, b) => a + b, 0) / scoresA.length;
    const avgB = scoresB.reduce((a, b) => a + b, 0) / scoresB.length;
    // Both should be near 73.2 — within 3 points of each other
    expect(Math.abs(avgA - avgB)).toBeLessThan(3);
  });
});

// === F-3: hasValidConformationScores helper ===

describe('hasValidConformationScores', () => {
  test('returns true for object with valid region scores', () => {
    expect(hasValidConformationScores(uniformScores(75))).toBe(true);
  });

  test('returns false for null', () => {
    expect(hasValidConformationScores(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(hasValidConformationScores(undefined)).toBe(false);
  });

  test('returns false for empty object', () => {
    expect(hasValidConformationScores({})).toBe(false);
  });

  test('returns false for object with no conformation region keys', () => {
    expect(hasValidConformationScores({ foo: 80, bar: 90 })).toBe(false);
  });

  test('returns true for object with at least one valid region', () => {
    expect(hasValidConformationScores({ head: 80 })).toBe(true);
  });

  test('returns false for object with only NaN region values', () => {
    const nanScores = {};
    for (const region of CONFORMATION_REGIONS) {
      nanScores[region] = NaN;
    }
    expect(hasValidConformationScores(nanScores)).toBe(false);
  });
});

// === F-7: Partial parent conformation scores ===

describe('Partial parent conformation scores', () => {
  test('sire with only head and neck scores still produces valid foal', () => {
    const partialSire = { head: 85, neck: 80 };
    const fullDam = uniformScores(70);
    const scores = generateInheritedConformationScores(1, partialSire, fullDam);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
    expect(scores).toHaveProperty('overallConformation');
  });

  test('dam missing all but hindquarters still produces valid foal', () => {
    const fullSire = uniformScores(80);
    const partialDam = { hindquarters: 90 };
    const scores = generateInheritedConformationScores(1, fullSire, partialDam);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
  });

  test('both parents with partial non-overlapping scores still produces valid foal', () => {
    const partialSire = { head: 85, neck: 80, shoulders: 75 };
    const partialDam = { back: 70, hindquarters: 90, legs: 65 };
    const scores = generateInheritedConformationScores(1, partialSire, partialDam);
    for (const region of CONFORMATION_REGIONS) {
      expect(Number.isInteger(scores[region])).toBe(true);
      expect(scores[region]).toBeGreaterThanOrEqual(0);
      expect(scores[region]).toBeLessThanOrEqual(100);
    }
  });
});

// === F-9: validateConformationScores ===

describe('validateConformationScores', () => {
  test('returns valid object with all 8 regions + overallConformation', () => {
    const input = uniformScores(75);
    const result = validateConformationScores(input);
    expect(Object.keys(result)).toHaveLength(9);
    for (const region of CONFORMATION_REGIONS) {
      expect(result[region]).toBe(75);
    }
    expect(result.overallConformation).toBe(75);
  });

  test('clamps out-of-range values', () => {
    const input = { ...uniformScores(50), head: 150, neck: -10 };
    const result = validateConformationScores(input);
    expect(result.head).toBe(100);
    expect(result.neck).toBe(0);
  });

  test('fills missing regions with 50', () => {
    const input = { head: 80 };
    const result = validateConformationScores(input);
    expect(result.head).toBe(80);
    expect(result.neck).toBe(50);
    expect(result.shoulders).toBe(50);
  });

  test('handles null input gracefully', () => {
    const result = validateConformationScores(null);
    for (const region of CONFORMATION_REGIONS) {
      expect(result[region]).toBe(50);
    }
    expect(result.overallConformation).toBe(50);
  });

  test('handles undefined input gracefully', () => {
    const result = validateConformationScores(undefined);
    for (const region of CONFORMATION_REGIONS) {
      expect(result[region]).toBe(50);
    }
  });

  test('replaces NaN values with 50', () => {
    const input = { ...uniformScores(80), head: NaN };
    const result = validateConformationScores(input);
    expect(result.head).toBe(50);
    expect(result.neck).toBe(80);
  });

  test('always includes overallConformation', () => {
    const input = uniformScores(60);
    const result = validateConformationScores(input);
    expect(result.overallConformation).toBe(60);
  });
});
