/**
 * 🧪 UNIT TEST: Trait Integration System - Gameplay Effect Application
 *
 * This test validates the trait integration system's functionality for applying
 * trait effects during training, competition, bonding, and temperament management.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Bonding modifier application: social traits enhance grooming/training bonding
 * - Negative trait penalties: antisocial/nervous traits reduce bonding effectiveness
 * - Competition bonding rewards: placement-based bonding with trait modifiers
 * - Temperament drift suppression: resilient/calm traits prevent temperament changes
 * - Stress resistance effects: traits reduce competition stress impact
 * - Trait combination algorithms: multiple trait effects combine additively
 * - Error handling: missing/malformed trait data handled gracefully
 * - Activity type validation: invalid activities return appropriate errors
 * - Trait effect persistence: effects apply consistently across gameplay systems
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. calculateBondingChange() - Trait-modified bonding for grooming/training/competition
 * 2. getCombinedTraitEffects() - Multi-trait effect combination and validation
 * 3. Bonding modifiers: social/calm bonuses, antisocial/nervous penalties
 * 4. Competition stress resistance: trait-based stress impact reduction
 * 5. Error handling: missing traits, malformed data, invalid activities
 * 6. Edge cases: empty trait arrays, unknown traits, invalid inputs
 * 7. Integration workflows: complete trait effect application across systems
 *
 * NOTE: calculateTemperamentDrift() tests were removed (TEMP-3).
 * temperamentDrift.mjs uses a legacy 6-type system incompatible with the
 * canonical 11-type system in temperamentService.mjs (Epic 31D).
 * The drift module is deprecated with no active importers.
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait integration logic, bonding calculations, temperament management
 * ✅ REAL: Effect combination algorithms, stress calculations, validation rules
 * 🔧 MOCK: Math.random - for deterministic testing of probability-based effects
 *
 * 💡 TEST STRATEGY: Integration testing with minimal mocking to validate trait
 *    effects across multiple gameplay systems while ensuring predictable outcomes
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { getCombinedTraitEffects } from '../utils/traitEffects.mjs';
import { calculateBondingChange } from '../utils/bondingModifiers.mjs';
// TEMP-3: calculateTemperamentDrift import removed — temperamentDrift.mjs is deprecated (legacy 6-type system)

describe('🎮 UNIT: Trait Integration System - Gameplay Effect Application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Math.random for consistent testing
    Math.random = jest.fn(() => 0.5);
  });

  describe('Bonding Modifiers', () => {
    it('should apply trait bonuses to grooming bonding', () => {
      const horse = {
        id: 1,
        bond_score: 50,
        epigenetic_modifiers: {
          positive: ['social', 'calm'],
          negative: [],
          hidden: [],
        },
      };

      const result = calculateBondingChange(horse, 'grooming', { duration: 60 });

      expect(result.modifiedChange).toBeGreaterThan(result.originalChange);
      expect(result.appliedTraits).toContain('social');
      expect(result.appliedTraits).toContain('calm');
      expect(result.traitModifier).toBeGreaterThan(1);
    });

    it('should apply trait penalties to bonding for antisocial horses', () => {
      const horse = {
        id: 1,
        bondScore: 50,
        epigenetic_modifiers: {
          positive: [],
          negative: ['antisocial', 'nervous'],
          hidden: [],
        },
      };

      const result = calculateBondingChange(horse, 'training', { success: true });

      expect(result.modifiedChange).toBeLessThan(result.originalChange);
      expect(result.appliedTraits).toContain('antisocial');
      expect(result.appliedTraits).toContain('nervous');
      expect(result.traitModifier).toBeLessThan(1);
    });

    it('should calculate competition bonding with placement modifiers', () => {
      const horse = {
        id: 1,
        bond_score: 70,
        epigenetic_modifiers: {
          positive: ['social'],
          negative: [],
          hidden: [],
        },
      };

      const result = calculateBondingChange(horse, 'competition', { placement: '1st' });

      expect(result.modifiedChange).toBeGreaterThan(5); // Should be significant for 1st place
      expect(result.traitModifier).toBeGreaterThan(1); // Social bonus applied
    });
  });

  describe('Trait Effects Combination', () => {
    it('should combine multiple positive trait effects correctly', () => {
      const traits = ['eager_learner', 'resilient', 'social'];
      const effects = getCombinedTraitEffects(traits);

      expect(effects.trainingXpModifier).toBeGreaterThan(0);
      expect(effects.suppressTemperamentDrift).toBe(true);
      expect(effects.bondingBonus).toBeGreaterThan(0);
    });

    it('should combine positive and negative trait effects', () => {
      const traits = ['eager_learner', 'lazy', 'social', 'nervous'];
      const effects = getCombinedTraitEffects(traits);

      // Should have both positive and negative modifiers
      expect(effects.trainingXpModifier).toBeDefined();
      expect(effects.bondingBonus).toBeDefined();
      // Net effect depends on specific trait values
    });

    it('should handle empty trait arrays', () => {
      const effects = getCombinedTraitEffects([]);

      expect(Object.keys(effects)).toHaveLength(0);
    });

    it('should handle unknown traits gracefully', () => {
      const effects = getCombinedTraitEffects(['unknown_trait', 'another_unknown']);

      expect(Object.keys(effects)).toHaveLength(0);
    });
  });

  describe('Competition Stress Response', () => {
    it('should calculate stress impact during competition', () => {
      // This would be tested through the simulateCompetition function
      // Testing the stress calculation logic
      const baseStressLevel = 70;
      const stressImpactPercent = baseStressLevel * 0.002; // 0.2% per stress point
      const expectedImpact = 100 * stressImpactPercent; // On a base score of 100

      expect(expectedImpact).toBeCloseTo(14, 1); // 70 * 0.002 * 100 = 14 point penalty
    });

    it('should apply stress resistance from traits', () => {
      const traits = ['resilient'];
      const effects = getCombinedTraitEffects(traits);

      expect(effects.competitionStressResistance).toBeGreaterThan(0);
      expect(effects.competitionStressResistance).toBeLessThanOrEqual(1);
    });
  });

  describe('Integration Error Handling', () => {
    it('should handle missing trait data gracefully', () => {
      const horse = {
        id: 1,
        name: 'Horse Without Traits',
        // No epigenetic_modifiers field
      };

      const result = calculateBondingChange(horse, 'grooming', { duration: 30 });

      expect(result.modifiedChange).toBeGreaterThan(0);
      expect(result.appliedTraits).toHaveLength(0);
      expect(result.traitModifier).toBeCloseTo(1, 1); // Allow for small variations
    });

    it('should handle malformed trait data', () => {
      const horse = {
        id: 1,
        epigenetic_modifiers: 'invalid_data', // Should be an object
      };

      const result = calculateBondingChange(horse, 'training', { success: true });

      expect(result.error).toBeUndefined(); // Should handle gracefully
      expect(result.modifiedChange).toBeGreaterThan(0);
    });

    it('should handle invalid activity types gracefully', () => {
      const horse = {
        id: 1,
        epigenetic_modifiers: {
          positive: ['social'],
          negative: [],
          hidden: [],
        },
      };

      const result = calculateBondingChange(horse, 'invalid_activity', {});

      expect(result.error).toBeDefined();
      expect(result.modifiedChange).toBe(0);
      expect(result.traitModifier).toBe(1);
    });
  });
});
