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
 * - Trait combination algorithms: multiple trait effects combine additively
 * - Error handling: missing/malformed trait data handled gracefully
 * - Activity type validation: invalid activities return appropriate errors
 * - Trait effect persistence: effects apply consistently across gameplay systems
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. getCombinedTraitEffects() - Multi-trait effect combination and validation
 * 2. Edge cases: empty trait arrays, unknown traits, invalid inputs
 *
 * NOTE (Equoria-rk8rm): the calculateBondingChange() tests were removed with
 * utils/bondingModifiers.mjs, which no gameplay code called; no live bond path
 * applies a trait bonding effect.
 *
 * NOTE: calculateTemperamentDrift() tests were removed (TEMP-3).
 * temperamentDrift.mjs uses a legacy 6-type system incompatible with the
 * canonical 11-type system in temperamentService.mjs (Epic 31D).
 * The drift module is deprecated with no active importers.
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait integration logic, bonding calculations, temperament management
 * ✅ REAL: Effect combination algorithms, validation rules
 * 🔧 MOCK: Math.random - for deterministic testing of probability-based effects
 *
 * 💡 TEST STRATEGY: Integration testing with minimal mocking to validate trait
 *    effects across multiple gameplay systems while ensuring predictable outcomes
 *
 * Owner ruling 2026-10-27 (q117, Equoria-2d55z) replaced the trait roster:
 * social, calm, antisocial, nervous and lazy are no longer traits and carry no
 * effects. peopleTrusting is the roster trait with bonding bonuses; no roster
 * trait carries a bonding penalty any more, so the old penalty case became
 * "off-roster traits change nothing".
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { getCombinedTraitEffects } from '../../../utils/traitEffects.mjs';
// TEMP-3: calculateTemperamentDrift import removed — temperamentDrift.mjs is deprecated (legacy 6-type system)

describe('🎮 UNIT: Trait Integration System - Gameplay Effect Application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Math.random for consistent testing
    Math.random = jest.fn(() => 0.5);
  });

  describe('Trait Effects Combination', () => {
    it('should combine multiple positive trait effects correctly', () => {
      const traits = ['eagerLearner', 'resilient', 'peopleTrusting'];
      const effects = getCombinedTraitEffects(traits);

      expect(effects.trainingXpModifier).toBeGreaterThan(0);
      expect(effects.suppressTemperamentDrift).toBe(true);
      expect(effects.bondingBonus).toBeGreaterThan(0);
    });

    it('should combine positive and negative trait effects', () => {
      const traits = ['eagerLearner', 'fragile', 'peopleTrusting'];
      const effects = getCombinedTraitEffects(traits);

      // Should have both positive and negative modifiers
      expect(effects.trainingXpModifier).toBeDefined();
      expect(effects.bondingBonus).toBeDefined();
      expect(effects.injuryRisk).toBe(0.3); // fragile
      // eagerLearner +0.02 and fragile -0.035
      expect(effects.competitionScoreModifier).toBeLessThan(0);
    });

    it('should handle empty trait arrays', () => {
      const effects = getCombinedTraitEffects([]);

      expect(Object.keys(effects)).toHaveLength(0);
    });

    it('should handle unknown traits gracefully', () => {
      const effects = getCombinedTraitEffects(['unknownTrait', 'anotherUnknown']);

      expect(Object.keys(effects)).toHaveLength(0);
    });
  });
});
