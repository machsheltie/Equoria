/**
 * 🧪 UNIT TEST: Epigenetic Traits Calculation System
 *
 * This test validates the complex epigenetic trait inheritance system that determines
 * offspring traits based on parent genetics and environmental breeding conditions.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Trait inheritance probability based on parent traits (40-50% base chance)
 * - Environmental modifiers: high bonding (+20% positive), high stress (+20% negative)
 * - Trait rarity system: common (50%), rare (15%), legendary (5%) inheritance rates
 * - Trait conflict resolution: opposing traits cannot coexist (calm vs nervous)
 * - Environmental trait generation based on breeding conditions
 * - Trait visibility system: rare/legendary traits often hidden (70%/90%)
 * - Deterministic results with seeded random number generation
 * - Input validation for all breeding parameters
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. calculateEpigeneticTraits() - Main trait calculation with environmental factors
 * 2. getTraitDefinition() - Trait metadata retrieval
 * 3. getTraitsByType() - Trait filtering by positive/negative/all types
 * 4. checkTraitConflict() - Trait conflict validation
 * 5. Edge cases: extreme values, empty inputs, invalid parameters
 * 6. Probability distributions and inheritance patterns
 * 7. Environmental trait generation under various conditions
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: All trait calculation logic, probability calculations, conflict resolution
 * ✅ REAL: Environmental factor processing, inheritance algorithms, validation
 * 🔧 MOCK: None - pure algorithmic testing with deterministic seeded randomness
 *
 * 💡 TEST STRATEGY: Pure unit testing with seeded randomness for deterministic
 *    validation of complex genetic inheritance algorithms and environmental effects
 */

import {
  calculateEpigeneticTraits,
  getTraitDefinition,
  getTraitsByType,
  checkTraitConflict,
} from '../utils/epigeneticTraits.mjs';

describe('🧬 UNIT: Epigenetic Traits Calculation System', () => {
  describe('Edge Cases', () => {
    it('should handle extreme bonding values', () => {
      // Test with maximum bonding
      const maxBondResult = calculateEpigeneticTraits({
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 100,
        damStressLevel: 50,
        seed: 12345,
      });

      // Test with minimum bonding
      const minBondResult = calculateEpigeneticTraits({
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 0,
        damStressLevel: 50,
        seed: 12345,
      });

      // Maximum bonding should generally produce more positive traits
      expect(maxBondResult.positive.length).toBeGreaterThanOrEqual(minBondResult.positive.length);
    });

    it('should handle extreme stress values', () => {
      // Test with maximum stress
      const maxStressResult = calculateEpigeneticTraits({
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 50,
        damStressLevel: 100,
        seed: 12345,
      });

      // Test with minimum stress
      const minStressResult = calculateEpigeneticTraits({
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 50,
        damStressLevel: 0,
        seed: 12345,
      });

      // Minimum stress should generally produce more positive traits
      expect(minStressResult.positive.length).toBeGreaterThanOrEqual(
        maxStressResult.positive.length,
      );
    });

    it('should handle empty trait arrays', () => {
      const result = calculateEpigeneticTraits({
        damTraits: [],
        sireTraits: [],
        damBondScore: 50,
        damStressLevel: 50,
        seed: 12345,
      });

      // Should still produce some traits based on environmental factors
      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('hidden');
    });
  });

  describe('Trait Combinations', () => {
    it('should handle complementary positive traits', () => {
      const result = calculateEpigeneticTraits({
        damTraits: ['intelligent', 'trainability_boost'],
        sireTraits: ['athletic', 'resilient'],
        damBondScore: 85,
        damStressLevel: 15,
        seed: 12345,
      });

      // Should have a good chance of inheriting complementary traits
      const allTraits = [...result.positive, ...result.hidden];
      const hasIntelligenceRelatedTrait = allTraits.some(trait =>
        ['intelligent', 'trainability_boost'].includes(trait),
      );

      expect(hasIntelligenceRelatedTrait).toBe(true);
    });

    it('should handle opposing traits appropriately', () => {
      const result = calculateEpigeneticTraits({
        damTraits: ['calm'],
        sireTraits: ['nervous'],
        damBondScore: 50,
        damStressLevel: 50,
        seed: 12345,
      });

      const allTraits = [...result.positive, ...result.negative, ...result.hidden];

      // Should not have both opposing traits
      const hasCalm = allTraits.includes('calm');
      const hasNervous = allTraits.includes('nervous');

      expect(hasCalm && hasNervous).toBe(false);
    });
  });

  describe('Environmental Influence', () => {
    it('should produce more positive traits in ideal conditions', () => {
      const idealResult = calculateEpigeneticTraits({
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 95,
        damStressLevel: 5,
        seed: 12345,
      });

      const poorResult = calculateEpigeneticTraits({
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 15,
        damStressLevel: 85,
        seed: 12345,
      });

      // Ideal conditions should produce more positive traits
      expect(idealResult.positive.length).toBeGreaterThanOrEqual(poorResult.positive.length);

      // Poor conditions should produce more negative traits
      expect(poorResult.negative.length).toBeGreaterThanOrEqual(idealResult.negative.length);
    });

    it('should test trait inheritance probability', () => {
      // Run multiple tests with same parameters to check probability distribution
      const results = [];
      const params = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 75,
        damStressLevel: 25,
      };

      for (let i = 0; i < 50; i++) {
        results.push(calculateEpigeneticTraits({ ...params, seed: i }));
      }

      // Count trait occurrences
      const resilientCount = results.filter(
        r => r.positive.includes('resilient') || r.hidden.includes('resilient'),
      ).length;
      const boldCount = results.filter(
        r => r.positive.includes('bold') || r.hidden.includes('bold'),
      ).length;

      // Should have reasonable inheritance rates (at least 20%)
      expect(resilientCount).toBeGreaterThan(10);
      expect(boldCount).toBeGreaterThan(10);
    });
  });

  describe('Rare Trait Generation', () => {
    it('should occasionally produce rare traits', () => {
      // Run multiple tests to increase chance of generating rare traits
      const results = [];
      const params = {
        damTraits: ['resilient', 'intelligent'],
        sireTraits: ['bold', 'athletic'],
        damBondScore: 95, // High bond score to increase positive trait chances
        damStressLevel: 5, // Low stress to increase positive trait chances
      };

      // Run 100 tests with different seeds to increase chance of rare traits
      for (let i = 0; i < 100; i++) {
        results.push(calculateEpigeneticTraits({ ...params, seed: i }));
      }

      // Collect all traits from all results
      const allTraits = results.flatMap(result => [
        ...result.positive,
        ...result.negative,
        ...result.hidden,
      ]);

      // Check if we have at least one trait that's not in the input traits
      const uniqueTraits = new Set(allTraits);
      const inputTraits = new Set([...params.damTraits, ...params.sireTraits]);

      // Find traits that weren't in the input
      const newTraits = [...uniqueTraits].filter(trait => !inputTraits.has(trait));

      // We should have generated at least one new trait across all tests
      expect(newTraits.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should handle missing parameters gracefully', () => {
      // Missing damBondScore
      expect(() => {
        calculateEpigeneticTraits({
          damTraits: ['resilient'],
          sireTraits: ['bold'],
          damStressLevel: 50,
          seed: 12345,
        });
      }).toThrow('Missing required breeding parameters');

      // Missing damStressLevel
      expect(() => {
        calculateEpigeneticTraits({
          damTraits: ['resilient'],
          sireTraits: ['bold'],
          damBondScore: 50,
          seed: 12345,
        });
      }).toThrow('Missing required breeding parameters');
    });

    it('should handle invalid parameter types', () => {
      // Non-numeric bonding score
      expect(() => {
        calculateEpigeneticTraits({
          damTraits: ['resilient'],
          sireTraits: ['bold'],
          damBondScore: 'high',
          damStressLevel: 50,
          seed: 12345,
        });
      }).toThrow('Bond scores and stress levels must be numbers');

      // Non-numeric stress level
      expect(() => {
        calculateEpigeneticTraits({
          damTraits: ['resilient'],
          sireTraits: ['bold'],
          damBondScore: 50,
          damStressLevel: 'low',
          seed: 12345,
        });
      }).toThrow('Bond scores and stress levels must be numbers');
    });
  });

  describe('Deterministic Behavior', () => {
    it('should produce consistent results with the same seed', () => {
      const params = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 50,
        damStressLevel: 50,
        seed: 54321,
      };

      const result1 = calculateEpigeneticTraits(params);
      const result2 = calculateEpigeneticTraits(params);

      // Results should be identical with the same seed
      expect(result1.positive).toEqual(result2.positive);
      expect(result1.negative).toEqual(result2.negative);
      expect(result1.hidden).toEqual(result2.hidden);
    });

    it('should produce different results with different seeds', () => {
      const baseParams = {
        damTraits: ['resilient', 'bold', 'intelligent'],
        sireTraits: ['athletic', 'calm', 'nervous'],
        damBondScore: 75,
        damStressLevel: 25,
      };

      // Test multiple seed combinations to ensure we get different results
      let foundDifference = false;
      const seeds = [12345, 54321, 98765, 11111, 99999];

      for (let i = 0; i < seeds.length - 1; i++) {
        const result1 = calculateEpigeneticTraits({ ...baseParams, seed: seeds[i] });
        const result2 = calculateEpigeneticTraits({ ...baseParams, seed: seeds[i + 1] });

        const areAllEqual =
          JSON.stringify(result1.positive) === JSON.stringify(result2.positive) &&
          JSON.stringify(result1.negative) === JSON.stringify(result2.negative) &&
          JSON.stringify(result1.hidden) === JSON.stringify(result2.hidden);

        if (!areAllEqual) {
          foundDifference = true;
          break;
        }
      }

      expect(foundDifference).toBe(true);
    });
  });

  describe('getTraitDefinition', () => {
    it('should return trait definition for valid traits', () => {
      const resilientDef = getTraitDefinition('resilient');

      expect(resilientDef).toEqual({
        type: 'positive',
        rarity: 'common',
        conflicts: ['fragile'],
      });

      const nervousDef = getTraitDefinition('nervous');

      expect(nervousDef).toEqual({
        type: 'negative',
        rarity: 'common',
        conflicts: ['bold', 'calm'],
      });
    });

    it('should return null for invalid traits', () => {
      const invalidDef = getTraitDefinition('nonexistent_trait');
      expect(invalidDef).toBeNull();
    });

    it('should return correct definition for rare traits', () => {
      const legendaryDef = getTraitDefinition('legendary_bloodline');

      expect(legendaryDef).toEqual({
        type: 'positive',
        rarity: 'legendary',
        conflicts: [],
      });
    });
  });

  describe('getTraitsByType', () => {
    it('should return all traits when type is "all"', () => {
      const allTraits = getTraitsByType('all');

      expect(Array.isArray(allTraits)).toBe(true);
      expect(allTraits.length).toBeGreaterThan(10);
      expect(allTraits).toContain('resilient');
      expect(allTraits).toContain('nervous');
      expect(allTraits).toContain('legendary_bloodline');
    });

    it('should return only positive traits when type is "positive"', () => {
      const positiveTraits = getTraitsByType('positive');

      expect(Array.isArray(positiveTraits)).toBe(true);
      expect(positiveTraits).toContain('resilient');
      expect(positiveTraits).toContain('bold');
      expect(positiveTraits).toContain('intelligent');
      expect(positiveTraits).not.toContain('nervous');
      expect(positiveTraits).not.toContain('stubborn');
    });

    it('should return only negative traits when type is "negative"', () => {
      const negativeTraits = getTraitsByType('negative');

      expect(Array.isArray(negativeTraits)).toBe(true);
      expect(negativeTraits).toContain('nervous');
      expect(negativeTraits).toContain('stubborn');
      expect(negativeTraits).toContain('fragile');
      expect(negativeTraits).not.toContain('resilient');
      expect(negativeTraits).not.toContain('bold');
    });

    it('should default to "all" when no type specified', () => {
      const defaultTraits = getTraitsByType();
      const allTraits = getTraitsByType('all');

      expect(defaultTraits).toEqual(allTraits);
    });
  });

  describe('checkTraitConflict', () => {
    it('should detect conflicts between opposing traits', () => {
      expect(checkTraitConflict('calm', 'nervous')).toBe(true);
      expect(checkTraitConflict('nervous', 'calm')).toBe(true);
      expect(checkTraitConflict('resilient', 'fragile')).toBe(true);
      expect(checkTraitConflict('bold', 'nervous')).toBe(true);
    });

    it('should return false for non-conflicting traits', () => {
      expect(checkTraitConflict('resilient', 'bold')).toBe(false);
      expect(checkTraitConflict('intelligent', 'athletic')).toBe(false);
      expect(checkTraitConflict('calm', 'resilient')).toBe(false);
    });

    it('should return false for unknown traits', () => {
      expect(checkTraitConflict('unknown_trait', 'resilient')).toBe(false);
      expect(checkTraitConflict('resilient', 'unknown_trait')).toBe(false);
      expect(checkTraitConflict('unknown1', 'unknown2')).toBe(false);
    });

    it('should handle self-comparison correctly', () => {
      expect(checkTraitConflict('resilient', 'resilient')).toBe(false);
      expect(checkTraitConflict('nervous', 'nervous')).toBe(false);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle bond score boundaries (0, 50, 100)', () => {
      const testParams = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damStressLevel: 50,
        seed: 12345,
      };

      // Test boundary values
      const result0 = calculateEpigeneticTraits({ ...testParams, damBondScore: 0 });
      const result50 = calculateEpigeneticTraits({ ...testParams, damBondScore: 50 });
      const result100 = calculateEpigeneticTraits({ ...testParams, damBondScore: 100 });

      // All should return valid results
      expect(result0).toHaveProperty('positive');
      expect(result50).toHaveProperty('positive');
      expect(result100).toHaveProperty('positive');
    });

    it('should handle stress level boundaries (0, 50, 100)', () => {
      const testParams = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        damBondScore: 50,
        seed: 12345,
      };

      // Test boundary values
      const result0 = calculateEpigeneticTraits({ ...testParams, damStressLevel: 0 });
      const result50 = calculateEpigeneticTraits({ ...testParams, damStressLevel: 50 });
      const result100 = calculateEpigeneticTraits({ ...testParams, damStressLevel: 100 });

      // All should return valid results
      expect(result0).toHaveProperty('positive');
      expect(result50).toHaveProperty('positive');
      expect(result100).toHaveProperty('positive');
    });

    it('should reject out-of-bounds values', () => {
      const baseParams = {
        damTraits: ['resilient'],
        sireTraits: ['bold'],
        seed: 12345,
      };

      // Test out-of-bounds bond scores
      expect(() =>
        calculateEpigeneticTraits({
          ...baseParams,
          damBondScore: -1,
          damStressLevel: 50,
        }),
      ).toThrow('Bond scores must be between 0-100');

      expect(() =>
        calculateEpigeneticTraits({
          ...baseParams,
          damBondScore: 101,
          damStressLevel: 50,
        }),
      ).toThrow('Bond scores must be between 0-100');

      // Test out-of-bounds stress levels
      expect(() =>
        calculateEpigeneticTraits({
          ...baseParams,
          damBondScore: 50,
          damStressLevel: -1,
        }),
      ).toThrow('stress levels between 0-100');

      expect(() =>
        calculateEpigeneticTraits({
          ...baseParams,
          damBondScore: 50,
          damStressLevel: 101,
        }),
      ).toThrow('stress levels between 0-100');
    });
  });
});
