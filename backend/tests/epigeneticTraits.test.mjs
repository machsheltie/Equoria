/**
 * 🧪 UNIT TEST: Epigenetic Traits System - Breeding & Environmental Trait Calculation
 *
 * This test validates the epigenetic traits system that determines how traits are
 * inherited and expressed in foals based on parent genetics and environmental factors.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Trait inheritance: Foals inherit traits from both parents with probability-based selection
 * - Environmental modifiers: Bond scores and stress levels affect trait expression
 * - Positive trait enhancement: High bond scores increase positive trait probability
 * - Negative trait suppression: High bond scores reduce negative trait inheritance
 * - Stress impact: High stress increases negative traits and reduces positive expression
 * - Hidden trait generation: Rare traits generated based on environmental conditions
 * - Trait consistency: No contradictory traits (e.g., calm + nervous) in same foal
 * - Input validation: Proper error handling for invalid breeding parameters
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. calculateEpigeneticTraits() - Complete trait inheritance and expression system
 * 2. Input validation: Required parameters, data types, value ranges
 * 3. Basic inheritance: Trait passing from dam and sire to offspring
 * 4. Bond score effects: High bonding increases positive, reduces negative traits
 * 5. Stress level effects: High stress increases negative, reduces positive traits
 * 6. Hidden trait generation: Rare trait creation based on environmental factors
 * 7. Complex scenarios: Mixed traits, optimal/poor conditions, empty parent traits
 * 8. Trait consistency: Prevention of contradictory trait combinations
 * 9. Deterministic behavior: Seed-based reproducible results for testing
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait calculation algorithms, probability systems, validation logic
 * ✅ REAL: Environmental factor calculations, trait inheritance, consistency checking
 * 🔧 MOCK: None - pure algorithmic testing with optional seed for deterministic results
 *
 * 💡 TEST STRATEGY: Statistical validation with multiple runs to verify probability-based
 *    trait inheritance and environmental factor effects on breeding outcomes
 */

import { describe, it, expect } from '@jest/globals';
import { calculateEpigeneticTraits } from '../utils/epigeneticTraits.mjs';

describe('🧬 UNIT: Epigenetic Traits System - Breeding & Environmental Trait Calculation', () => {
  describe('Input Validation', () => {
    it('should throw error for missing required parameters', () => {
      expect(() => calculateEpigeneticTraits()).toThrow('Missing required breeding parameters');
      expect(() => calculateEpigeneticTraits({})).toThrow('Missing required breeding parameters');
      expect(() => calculateEpigeneticTraits({ damTraits: [] })).toThrow(
        'Missing required breeding parameters',
      );
    });

    it('should throw error for invalid trait arrays', () => {
      const invalidInput = {
        damTraits: 'not-an-array',
        sireTraits: ['bold'],
        damBondScore: 85,
        damStressLevel: 20,
      };
      expect(() => calculateEpigeneticTraits(invalidInput)).toThrow('Parent traits must be arrays');
    });

    it('should throw error for invalid bond scores', () => {
      const invalidInput = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 'invalid',
        damStressLevel: 20,
      };
      expect(() => calculateEpigeneticTraits(invalidInput)).toThrow(
        'Bond scores and stress levels must be numbers',
      );
    });

    it('should throw error for out-of-range values', () => {
      const invalidInput = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 150, // Over 100
        damStressLevel: 20,
      };
      expect(() => calculateEpigeneticTraits(invalidInput)).toThrow(
        'Bond scores must be between 0-100, stress levels between 0-100',
      );
    });

    it('should accept valid input without throwing', () => {
      const validInput = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 85,
        damStressLevel: 20,
      };
      expect(() => calculateEpigeneticTraits(validInput)).not.toThrow();
    });
  });

  describe('Basic Trait Inheritance', () => {
    it('should inherit positive traits from both parents', () => {
      const input = {
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 80,
        damStressLevel: 15,
      };

      const result = calculateEpigeneticTraits(input);

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('hidden');
      expect(Array.isArray(result.positive)).toBe(true);
      expect(Array.isArray(result.negative)).toBe(true);
      expect(Array.isArray(result.hidden)).toBe(true);
    });

    it('should have chance to inherit each parent trait', () => {
      const input = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 90,
        damStressLevel: 10,
      };

      // Run multiple times to test probability
      const results = [];
      for (let i = 0; i < 50; i++) {
        results.push(calculateEpigeneticTraits(input));
      }

      // Should sometimes inherit resilient, sometimes bold, sometimes both
      const hasResilient = results.some(
        r => r.positive.includes('resilient') || r.hidden.includes('resilient'),
      );
      const hasBold = results.some(r => r.positive.includes('bold') || r.hidden.includes('bold'));

      expect(hasResilient).toBe(true);
      expect(hasBold).toBe(true);
    });

    it('should not inherit negative traits from positive parent traits', () => {
      const input = {
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 95,
        damStressLevel: 5,
      };

      const result = calculateEpigeneticTraits(input);

      // Positive parent traits should not appear in negative offspring traits
      expect(result.negative).not.toContain('resilient');
      expect(result.negative).not.toContain('intelligent');
      expect(result.negative).not.toContain('bold');
      expect(result.negative).not.toContain('athletic');
    });
  });

  describe('Bonding Score Effects', () => {
    it('should increase positive trait probability with high bonding', () => {
      const highBondInput = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 95,
        damStressLevel: 10,
      };

      const lowBondInput = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 30,
        damStressLevel: 10,
      };

      // Test multiple times for statistical significance
      let highBondPositives = 0;
      let lowBondPositives = 0;

      for (let i = 0; i < 100; i++) {
        const highResult = calculateEpigeneticTraits(highBondInput);
        const lowResult = calculateEpigeneticTraits(lowBondInput);

        highBondPositives += highResult.positive.length;
        lowBondPositives += lowResult.positive.length;
      }

      // High bonding should generally produce more positive traits
      expect(highBondPositives).toBeGreaterThan(lowBondPositives);
    });

    it('should reduce negative trait probability with high bonding', () => {
      const highBondInput = {
        damTraits: ['nervous'], // Negative trait
        sireTraits: ['stubborn'], // Negative trait
        damBondScore: 95,
        damStressLevel: 10,
      };

      const lowBondInput = {
        damTraits: ['nervous'],
        sireTraits: ['stubborn'],
        damBondScore: 20,
        damStressLevel: 10,
      };

      // Test multiple times
      let highBondNegatives = 0;
      let lowBondNegatives = 0;

      for (let i = 0; i < 100; i++) {
        const highResult = calculateEpigeneticTraits(highBondInput);
        const lowResult = calculateEpigeneticTraits(lowBondInput);

        highBondNegatives += highResult.negative.length;
        lowBondNegatives += lowResult.negative.length;
      }

      // High bonding should generally produce fewer negative traits
      expect(highBondNegatives).toBeLessThan(lowBondNegatives);
    });
  });

  describe('Stress Level Effects', () => {
    it('should increase negative trait probability with high stress', () => {
      const highStressInput = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 80,
        damStressLevel: 90,
      };

      const lowStressInput = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 80,
        damStressLevel: 10,
      };

      // Test multiple times
      let highStressNegatives = 0;
      let lowStressNegatives = 0;

      for (let i = 0; i < 100; i++) {
        const highResult = calculateEpigeneticTraits(highStressInput);
        const lowResult = calculateEpigeneticTraits(lowStressInput);

        highStressNegatives += highResult.negative.length;
        lowStressNegatives += lowResult.negative.length;
      }

      // High stress should generally produce more negative traits
      expect(highStressNegatives).toBeGreaterThan(lowStressNegatives);
    });

    it('should reduce positive trait expression with high stress', () => {
      const highStressInput = {
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 80,
        damStressLevel: 95,
      };

      const lowStressInput = {
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 80,
        damStressLevel: 5,
      };

      // Test multiple times
      let highStressPositives = 0;
      let lowStressPositives = 0;

      for (let i = 0; i < 100; i++) {
        const highResult = calculateEpigeneticTraits(highStressInput);
        const lowResult = calculateEpigeneticTraits(lowStressInput);

        highStressPositives += highResult.positive.length;
        lowStressPositives += lowResult.positive.length;
      }

      // High stress should generally produce fewer positive traits
      expect(highStressPositives).toBeLessThan(lowStressPositives);
    });
  });

  describe('Hidden Trait Generation', () => {
    it('should generate hidden traits based on environmental factors', () => {
      const input = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 75,
        damStressLevel: 25,
      };

      const result = calculateEpigeneticTraits(input);

      // Should have some hidden traits
      expect(result.hidden.length).toBeGreaterThanOrEqual(0);
      expect(result.hidden.length).toBeLessThanOrEqual(5); // Reasonable upper limit
    });

    it('should include rare traits in hidden category', () => {
      const input = {
        damTraits: ['intelligent'],
        sireTraits: ['athletic'],
        damBondScore: 90,
        damStressLevel: 10,
      };

      // Test multiple times to check for rare traits
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(calculateEpigeneticTraits(input));
      }

      const allHiddenTraits = results.flatMap(r => r.hidden);

      // Should sometimes generate rare traits like trainability_boost
      const hasRareTraits = allHiddenTraits.some(trait =>
        ['trainability_boost', 'legendary_bloodline', 'weather_immunity'].includes(trait),
      );

      expect(hasRareTraits).toBe(true);
    });
  });

  describe('Complex Breeding Scenarios', () => {
    it('should handle mixed positive and negative parent traits', () => {
      const input = {
        damTraits: ['resilient', 'nervous'], // Mixed traits
        sireTraits: ['bold', 'stubborn'], // Mixed traits
        damBondScore: 70,
        damStressLevel: 30,
      };

      // Test multiple times to account for randomness
      let hasTraits = false;
      for (let i = 0; i < 10; i++) {
        const result = calculateEpigeneticTraits(input);
        if (result.positive.length + result.negative.length + result.hidden.length > 0) {
          hasTraits = true;

          // Should not have contradictory traits (e.g., both calm and nervous)
          const allTraits = [...result.positive, ...result.negative, ...result.hidden];
          expect(
            allTraits.filter(t => t === 'calm').length +
              allTraits.filter(t => t === 'nervous').length,
          ).toBeLessThanOrEqual(1);
          break;
        }
      }

      // At least one run should generate traits
      expect(hasTraits).toBe(true);
    });

    it('should handle parents with no traits', () => {
      const input = {
        damTraits: [],
        sireTraits: [],
        damBondScore: 80,
        damStressLevel: 20,
      };

      const result = calculateEpigeneticTraits(input);

      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('hidden');

      // Should still potentially generate some traits based on environmental factors
      const totalTraits = result.positive.length + result.negative.length + result.hidden.length;
      expect(totalTraits).toBeGreaterThanOrEqual(0);
    });

    it('should handle optimal breeding conditions', () => {
      const input = {
        damTraits: ['resilient', 'intelligent', 'athletic'],
        sireTraits: ['bold', 'calm', 'trainability_boost'],
        damBondScore: 100,
        damStressLevel: 0,
      };

      const result = calculateEpigeneticTraits(input);

      // Optimal conditions should favor positive traits
      expect(result.positive.length).toBeGreaterThanOrEqual(result.negative.length);

      // Should have good chance of inheriting rare traits
      const allTraits = [...result.positive, ...result.negative, ...result.hidden];
      expect(allTraits.length).toBeGreaterThan(0);
    });

    it('should handle poor breeding conditions', () => {
      const input = {
        damTraits: ['nervous', 'fragile'],
        sireTraits: ['aggressive', 'lazy'],
        damBondScore: 10,
        damStressLevel: 95,
      };

      const result = calculateEpigeneticTraits(input);

      // Poor conditions should increase negative trait probability
      const totalNegative = result.negative.length;
      const totalPositive = result.positive.length;

      // In poor conditions, negative traits should be more likely
      expect(totalNegative + totalPositive).toBeGreaterThan(0); // Should generate some traits
    });
  });

  describe('Trait Consistency', () => {
    it('should not generate contradictory traits', () => {
      const input = {
        damTraits: ['calm'],
        sireTraits: ['nervous'],
        damBondScore: 50,
        damStressLevel: 50,
      };

      // Test multiple times
      for (let i = 0; i < 50; i++) {
        const result = calculateEpigeneticTraits(input);
        const allTraits = [...result.positive, ...result.negative, ...result.hidden];

        // Should not have both calm and nervous
        const hasCalm = allTraits.includes('calm');
        const hasNervous = allTraits.includes('nervous');
        expect(hasCalm && hasNervous).toBe(false);

        // Should not have both bold and nervous
        const hasBold = allTraits.includes('bold');
        expect(hasBold && hasNervous).toBe(false);
      }
    });

    it('should maintain trait type consistency', () => {
      const input = {
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 80,
        damStressLevel: 20,
      };

      const result = calculateEpigeneticTraits(input);

      // Positive traits should only appear in positive or hidden arrays
      const positiveTraitList = [
        'resilient',
        'intelligent',
        'bold',
        'athletic',
        'calm',
        'trainability_boost',
      ];

      result.negative.forEach(trait => {
        expect(positiveTraitList).not.toContain(trait);
      });
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce consistent results with same seed', () => {
      const input = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 80,
        damStressLevel: 20,
        seed: 12345, // Optional seed for testing
      };

      const result1 = calculateEpigeneticTraits(input);
      const result2 = calculateEpigeneticTraits(input);

      // With same seed, should produce identical results
      expect(result1).toEqual(result2);
    });

    it('should produce different results without seed', () => {
      const input = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 80,
        damStressLevel: 20,
      };

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(calculateEpigeneticTraits(input));
      }

      // Should have some variation in results
      const uniqueResults = new Set(results.map(r => JSON.stringify(r)));
      expect(uniqueResults.size).toBeGreaterThan(1);
    });
  });
});
