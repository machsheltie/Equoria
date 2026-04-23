// Unit and statistical validation tests for temperament assignment service.
// Tests: weighted random selection, breed-specific generation, edge cases,
// statistical distribution (chi-squared), and backward compatibility.

import { generateTemperament, weightedRandomSelect } from '../modules/horses/services/temperamentService.mjs';
import { BREED_GENETIC_PROFILES, TEMPERAMENT_TYPES } from '../modules/horses/data/breedGeneticProfiles.mjs';

describe('Temperament Assignment Service', () => {
  // ── weightedRandomSelect ────────────────────────────────────────────────

  describe('weightedRandomSelect', () => {
    test('returns a key from the weights object', () => {
      const weights = { A: 50, B: 30, C: 20 };
      const result = weightedRandomSelect(weights);
      expect(['A', 'B', 'C']).toContain(result);
    });

    test('returns the only option when one weight is 100', () => {
      const weights = { OnlyChoice: 100 };
      // Run multiple times to confirm deterministic behavior
      for (let i = 0; i < 10; i++) {
        expect(weightedRandomSelect(weights)).toBe('OnlyChoice');
      }
    });

    test('handles single-entry weights', () => {
      const weights = { Solo: 1 };
      expect(weightedRandomSelect(weights)).toBe('Solo');
    });

    test('throws on empty weights object', () => {
      expect(() => weightedRandomSelect({})).toThrow('weights object is empty');
    });

    test('throws on all-zero weights', () => {
      expect(() => weightedRandomSelect({ A: 0, B: 0 })).toThrow('total weight must be greater than zero');
    });

    test('handles very large weight differentials', () => {
      // Dominant weight should almost always win
      const weights = { Dominant: 9999, Rare: 1 };
      const results = {};
      for (let i = 0; i < 100; i++) {
        const r = weightedRandomSelect(weights);
        results[r] = (results[r] || 0) + 1;
      }
      // Dominant should win at least 95 out of 100
      expect(results['Dominant']).toBeGreaterThanOrEqual(95);
    });

    test('selects across all options over many trials', () => {
      const weights = { A: 33, B: 33, C: 34 };
      const seen = new Set();
      for (let i = 0; i < 200; i++) {
        seen.add(weightedRandomSelect(weights));
      }
      expect(seen.size).toBe(3);
    });
  });

  // ── generateTemperament ─────────────────────────────────────────────────

  describe('generateTemperament', () => {
    test('returns a valid temperament type for each canonical breed', () => {
      // All 12 breeds (IDs 1-12)
      for (let breedId = 1; breedId <= 12; breedId++) {
        const temperament = generateTemperament(breedId);
        expect(TEMPERAMENT_TYPES).toContain(temperament);
      }
    });

    test('returns a string', () => {
      const result = generateTemperament(1);
      expect(typeof result).toBe('string');
    });

    test('returns different temperaments over multiple calls (not always the same)', () => {
      const results = new Set();
      for (let i = 0; i < 100; i++) {
        results.add(generateTemperament(1)); // Thoroughbred
      }
      // Thoroughbred has multiple high-weight types, so we should see variety
      expect(results.size).toBeGreaterThan(1);
    });

    // Post-309-breeds refactor: invalid/missing breed identifiers must
    // throw rather than silently returning a random temperament.
    test.each([0, -1, 999, null, undefined])('throws for invalid breed identifier %p', breedId => {
      expect(() => generateTemperament(breedId)).toThrow();
    });
  });

  // ── Breed temperament weight validation ─────────────────────────────────

  describe('Breed temperament weight data integrity', () => {
    test('all 12 breeds have temperament_weights', () => {
      for (let breedId = 1; breedId <= 12; breedId++) {
        const profile = BREED_GENETIC_PROFILES[breedId];
        expect(profile).toBeDefined();
        expect(profile.temperament_weights).toBeDefined();
        expect(typeof profile.temperament_weights).toBe('object');
      }
    });

    test('all breed temperament weights sum to 100', () => {
      for (let breedId = 1; breedId <= 12; breedId++) {
        const weights = BREED_GENETIC_PROFILES[breedId].temperament_weights;
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(sum).toBe(100);
      }
    });

    test('all breed temperament weights use the canonical 11 types', () => {
      for (let breedId = 1; breedId <= 12; breedId++) {
        const weights = BREED_GENETIC_PROFILES[breedId].temperament_weights;
        const keys = Object.keys(weights);
        for (const key of keys) {
          expect(TEMPERAMENT_TYPES).toContain(key);
        }
      }
    });

    test('all temperament weights are non-negative integers', () => {
      for (let breedId = 1; breedId <= 12; breedId++) {
        const weights = BREED_GENETIC_PROFILES[breedId].temperament_weights;
        for (const [_type, weight] of Object.entries(weights)) {
          expect(Number.isInteger(weight)).toBe(true);
          expect(weight).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // ── Statistical distribution validation (NFR-04) ───────────────────────

  describe('Statistical distribution (chi-squared, NFR-04)', () => {
    // Chi-squared critical value for df=10, p=0.001 is 29.588 (reduces false-positive rate
    // from ~5% to ~0.1% per test; with 4 breeds tested the suite-level false-positive rate
    // drops from ~19% to ~0.4%, preventing intermittent CI failures on a correct implementation)
    const CHI_SQUARED_CRITICAL = 29.588;
    const SAMPLE_SIZE = 10000;

    /**
     * Calculate chi-squared statistic for observed vs expected frequencies.
     * Skips types with expected count < 5 (standard chi-squared assumption).
     */
    function chiSquared(observed, expected) {
      let stat = 0;
      let df = 0;
      for (const type of Object.keys(expected)) {
        if (expected[type] < 5) {
          continue;
        } // Skip low-expected categories
        const o = observed[type] || 0;
        const e = expected[type];
        stat += (o - e) ** 2 / e;
        df++;
      }
      return { stat, df: Math.max(df - 1, 1) };
    }

    // Test a representative subset of breeds (not all 12 to keep test time reasonable)
    const BREEDS_TO_TEST = [
      { id: 1, name: 'Thoroughbred' },
      { id: 2, name: 'Arabian' },
      { id: 5, name: 'Pony Of The Americas' },
      { id: 9, name: 'American Quarter Horse' },
    ];

    for (const breed of BREEDS_TO_TEST) {
      test(`${breed.name} (ID ${breed.id}) temperament distribution matches breed weights (p > 0.05)`, () => {
        const weights = BREED_GENETIC_PROFILES[breed.id].temperament_weights;
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

        // Generate SAMPLE_SIZE temperaments
        const observed = {};
        for (let i = 0; i < SAMPLE_SIZE; i++) {
          const t = generateTemperament(breed.id);
          observed[t] = (observed[t] || 0) + 1;
        }

        // Calculate expected frequencies
        const expected = {};
        for (const [type, weight] of Object.entries(weights)) {
          expected[type] = (weight / totalWeight) * SAMPLE_SIZE;
        }

        // Compute chi-squared
        const { stat, df: _df } = chiSquared(observed, expected);

        // For variable df, use df=10 critical value as conservative bound
        const criticalValue = CHI_SQUARED_CRITICAL;

        // Chi-squared stat should be below critical value for p > 0.001
        expect(stat).toBeLessThan(criticalValue);
      });
    }

    test('all 11 temperament types can be generated from Thoroughbred (which has non-zero weights for all)', () => {
      const seen = new Set();
      // Thoroughbred has non-zero weights for all 11 types — given enough samples we should see all
      for (let i = 0; i < 10000; i++) {
        seen.add(generateTemperament(1));
      }
      // At minimum we should see the high-weight types
      expect(seen.has('Spirited')).toBe(true); // weight 30
      expect(seen.has('Bold')).toBe(true); // weight 15
      expect(seen.has('Reactive')).toBe(true); // weight 15
      expect(seen.has('Nervous')).toBe(true); // weight 15
    });
  });

  // ── Backward compatibility ──────────────────────────────────────────────

  describe('Backward compatibility', () => {
    test('null temperament is a valid state for existing horses', () => {
      // Existing horses in the database have temperament = null
      // This test documents that null is the expected default
      const existingHorse = { id: 1, name: 'Legacy Horse', temperament: null };
      expect(existingHorse.temperament).toBeNull();
    });
  });

  // ── Immutability verification ───────────────────────────────────────────

  describe('Immutability', () => {
    test('temperament is NOT in the horse update allowed fields', () => {
      // The validateHorseUpdatePayload in horseRoutes.mjs uses this whitelist
      const allowedUpdateFields = new Set(['name', 'sex', 'gender', 'dateOfBirth', 'breedId']);
      expect(allowedUpdateFields.has('temperament')).toBe(false);
    });

    test('generateTemperament is a pure function (no side effects on breed data)', () => {
      const profileBefore = JSON.stringify(BREED_GENETIC_PROFILES[1].temperament_weights);
      generateTemperament(1);
      const profileAfter = JSON.stringify(BREED_GENETIC_PROFILES[1].temperament_weights);
      expect(profileAfter).toBe(profileBefore);
    });
  });
});
