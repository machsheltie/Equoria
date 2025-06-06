/**
 * 🧪 UNIT TEST: Trait Effects System - Trait Impact Calculation & Combination
 *
 * This test validates the trait effects system's functionality for calculating
 * and combining trait impacts on horse performance, training, and competition.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Individual trait effect retrieval with complete modifier sets
 * - Trait combination logic: additive numeric modifiers, boolean OR operations
 * - Positive trait benefits: training bonuses, competition advantages, stat boosts
 * - Negative trait penalties: training penalties, competition disadvantages, stress increases
 * - Rare trait effects: legendary bloodline bonuses, burnout severe penalties
 * - Discipline-specific modifiers: trait advantages/disadvantages per competition type
 * - Input validation: null/undefined/invalid trait handling with graceful fallbacks
 * - Effect type handling: numeric addition, boolean combination, object merging
 * - Complete trait catalog validation: all positive, negative, and rare traits
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. getTraitEffects() - Individual trait effect retrieval with validation
 * 2. hasTraitEffect() - Trait-specific effect existence checking
 * 3. getCombinedTraitEffects() - Multi-trait effect combination with proper merging
 * 4. getAllTraitEffects() - Complete trait catalog retrieval and validation
 * 5. Positive trait effects: resilient, intelligent, athletic, bold, calm bonuses
 * 6. Negative trait effects: nervous, lazy, fragile, aggressive, stubborn penalties
 * 7. Rare trait effects: legendary bloodline, burnout, trainability boost impacts
 * 8. Discipline modifiers: Racing, Dressage, Show Jumping, Cross Country, Endurance
 * 9. Effect combination algorithms: numeric addition, boolean OR, object merging
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete trait effect calculations, combination algorithms, validation logic
 * ✅ REAL: Modifier calculations, discipline bonuses, stat boosts, penalty applications
 * 🔧 MOCK: None - pure algorithmic testing with no external dependencies
 *
 * 💡 TEST STRATEGY: Pure logic testing to validate trait effect calculations and
 *    combination algorithms without external dependencies or database complexity
 */

import { describe, expect, test } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the trait effects system
const { getTraitEffects, getAllTraitEffects, hasTraitEffect, getCombinedTraitEffects } =
  await import(join(__dirname, '../utils/traitEffects.js'));

describe('🎭 UNIT: Trait Effects System - Trait Impact Calculation & Combination', () => {
  describe('getTraitEffects', () => {
    test('should return effects for valid trait', () => {
      const effects = getTraitEffects('resilient');
      expect(effects).toBeDefined();
      expect(effects.suppressTemperamentDrift).toBe(true);
      expect(effects.trainingStressReduction).toBe(0.15);
      expect(effects.competitionScoreModifier).toBe(0.03);
    });

    test('should return null for invalid trait', () => {
      const effects = getTraitEffects('nonexistent_trait');
      expect(effects).toBeNull();
    });

    test('should return null for invalid input', () => {
      expect(getTraitEffects(null)).toBeNull();
      expect(getTraitEffects()).toBeNull();
      expect(getTraitEffects('')).toBeNull();
      expect(getTraitEffects(123)).toBeNull();
    });
  });

  describe('hasTraitEffect', () => {
    test('should return true for existing effect', () => {
      expect(hasTraitEffect('resilient', 'suppressTemperamentDrift')).toBe(true);
      expect(hasTraitEffect('lazy', 'trainingXpModifier')).toBe(true);
      expect(hasTraitEffect('bold', 'competitionConfidenceBoost')).toBe(true);
    });

    test('should return false for non-existing effect', () => {
      expect(hasTraitEffect('resilient', 'nonexistentEffect')).toBe(false);
      expect(hasTraitEffect('nonexistent_trait', 'anyEffect')).toBe(false);
    });
  });

  describe('getCombinedTraitEffects', () => {
    test('should combine multiple trait effects correctly', () => {
      const combined = getCombinedTraitEffects(['resilient', 'intelligent']);

      // Should have effects from both traits
      expect(combined.suppressTemperamentDrift).toBe(true); // from resilient
      expect(combined.trainingXpModifier).toBe(0.25); // from intelligent
      expect(combined.trainingStressReduction).toBe(0.15); // from resilient
      expect(combined.statGainChanceModifier).toBe(0.15); // from intelligent
    });

    test('should handle numeric modifiers additively', () => {
      const combined = getCombinedTraitEffects(['resilient', 'athletic']);

      // Both traits have competitionScoreModifier
      // resilient: 0.03, athletic: 0.05 = 0.08 total
      expect(combined.competitionScoreModifier).toBe(0.08);
    });

    test('should handle boolean effects correctly', () => {
      const combined = getCombinedTraitEffects(['resilient', 'calm']);

      // Both have suppressTemperamentDrift: true
      expect(combined.suppressTemperamentDrift).toBe(true);
    });

    test('should merge object effects correctly', () => {
      const combined = getCombinedTraitEffects(['athletic', 'legendary_bloodline']);

      // Both have baseStatBoost objects
      expect(combined.baseStatBoost).toBeDefined();
      expect(combined.baseStatBoost.stamina).toBe(5); // athletic: 2 + legendary: 3
      expect(combined.baseStatBoost.agility).toBe(5); // athletic: 2 + legendary: 3
      expect(combined.baseStatBoost.balance).toBe(3); // athletic: 1 + legendary: 2
      expect(combined.baseStatBoost.focus).toBe(2); // only legendary: 2
    });

    test('should handle empty array', () => {
      const combined = getCombinedTraitEffects([]);
      expect(combined).toEqual({});
    });

    test('should handle invalid input', () => {
      const combined = getCombinedTraitEffects('not_an_array');
      expect(combined).toEqual({});
    });

    test('should ignore invalid trait names', () => {
      const combined = getCombinedTraitEffects(['resilient', 'invalid_trait', 'intelligent']);

      // Should only include effects from valid traits
      expect(combined.suppressTemperamentDrift).toBe(true); // from resilient
      expect(combined.trainingXpModifier).toBe(0.25); // from intelligent
    });
  });

  describe('Positive Traits', () => {
    test('resilient trait should have correct effects', () => {
      const effects = getTraitEffects('resilient');
      expect(effects.suppressTemperamentDrift).toBe(true);
      expect(effects.trainingStressReduction).toBe(0.15);
      expect(effects.competitionStressResistance).toBe(0.15);
      expect(effects.competitionScoreModifier).toBe(0.03);
      expect(effects.stressRecoveryRate).toBe(1.25);
      expect(effects.disciplineModifiers).toBeDefined();
      expect(effects.disciplineModifiers['Cross Country']).toBe(0.05);
    });

    test('intelligent trait should have correct effects', () => {
      const effects = getTraitEffects('intelligent');
      expect(effects.trainingXpModifier).toBe(0.25);
      expect(effects.statGainChanceModifier).toBe(0.15);
      expect(effects.trainingTimeReduction).toBe(0.1);
      expect(effects.competitionScoreModifier).toBe(0.03);
      expect(effects.problemSolvingBonus).toBe(true);
      expect(effects.disciplineModifiers['Dressage']).toBe(0.06);
    });

    test('athletic trait should have correct effects', () => {
      const effects = getTraitEffects('athletic');
      expect(effects.physicalTrainingBonus).toBe(0.2);
      expect(effects.competitionScoreModifier).toBe(0.05);
      expect(effects.baseStatBoost).toBeDefined();
      expect(effects.baseStatBoost.stamina).toBe(2);
      expect(effects.baseStatBoost.agility).toBe(2);
      expect(effects.disciplineModifiers['Racing']).toBe(0.07);
    });
  });

  describe('Negative Traits', () => {
    test('nervous trait should have correct penalties', () => {
      const effects = getTraitEffects('nervous');
      expect(effects.trainingStressIncrease).toBe(0.25);
      expect(effects.competitionStressRisk).toBe(10);
      expect(effects.competitionScoreModifier).toBe(-0.04);
      expect(effects.stressAccumulation).toBe(1.2);
      expect(effects.disciplineModifiers['Racing']).toBe(-0.06);
    });

    test('lazy trait should have correct penalties', () => {
      const effects = getTraitEffects('lazy');
      expect(effects.trainingXpModifier).toBe(-0.2);
      expect(effects.trainingMotivationPenalty).toBe(0.25);
      expect(effects.competitionScoreModifier).toBe(-0.035);
      expect(effects.activityAvoidance).toBe(true);
      expect(effects.disciplineModifiers['Endurance']).toBe(-0.08);
    });

    test('burnout trait should have severe penalties', () => {
      const effects = getTraitEffects('burnout');
      expect(effects.statGainBlocked).toBe(true);
      expect(effects.trainingXpModifier).toBe(-0.5);
      expect(effects.competitionScoreModifier).toBe(-0.1);
      expect(effects.extendedRestRequired).toBe(true);
      expect(effects.disciplineModifiers['Endurance']).toBe(-0.15);
    });
  });

  describe('Rare Traits', () => {
    test('legendary_bloodline trait should have powerful effects', () => {
      const effects = getTraitEffects('legendary_bloodline');
      expect(effects.trainingXpModifier).toBe(0.5);
      expect(effects.statGainChanceModifier).toBe(0.3);
      expect(effects.competitionScoreModifier).toBe(0.08);
      expect(effects.eliteTrainingAccess).toBe(true);
      expect(effects.baseStatBoost).toBeDefined();
      expect(effects.baseStatBoost.stamina).toBe(3);
      expect(effects.breedingValueBonus).toBe(0.5);
      expect(effects.disciplineModifiers['Racing']).toBe(0.1);
    });
  });

  describe('Discipline-Specific Modifiers', () => {
    test('should have appropriate discipline bonuses for positive traits', () => {
      const resilient = getTraitEffects('resilient');
      expect(resilient.disciplineModifiers['Cross Country']).toBeGreaterThan(0);
      expect(resilient.disciplineModifiers['Endurance']).toBeGreaterThan(0);

      const bold = getTraitEffects('bold');
      expect(bold.disciplineModifiers['Show Jumping']).toBeGreaterThan(0);
      expect(bold.disciplineModifiers['Racing']).toBeGreaterThan(0);
    });

    test('should have appropriate discipline penalties for negative traits', () => {
      const nervous = getTraitEffects('nervous');
      expect(nervous.disciplineModifiers['Racing']).toBeLessThan(0);
      expect(nervous.disciplineModifiers['Show Jumping']).toBeLessThan(0);

      const lazy = getTraitEffects('lazy');
      expect(lazy.disciplineModifiers['Endurance']).toBeLessThan(0);
      expect(lazy.disciplineModifiers['Cross Country']).toBeLessThan(0);
    });
  });

  describe('getAllTraitEffects', () => {
    test('should return complete trait effects mapping', () => {
      const allEffects = getAllTraitEffects();
      expect(typeof allEffects).toBe('object');
      expect(allEffects.resilient).toBeDefined();
      expect(allEffects.lazy).toBeDefined();
      expect(allEffects.bold).toBeDefined();
      expect(allEffects.nervous).toBeDefined();
      expect(allEffects.legendary_bloodline).toBeDefined();
      expect(allEffects.burnout).toBeDefined();
    });

    test('should include all expected trait categories', () => {
      const allEffects = getAllTraitEffects();

      // Positive traits
      expect(allEffects.resilient).toBeDefined();
      expect(allEffects.calm).toBeDefined();
      expect(allEffects.bold).toBeDefined();
      expect(allEffects.intelligent).toBeDefined();
      expect(allEffects.athletic).toBeDefined();
      expect(allEffects.trainability_boost).toBeDefined();

      // Negative traits
      expect(allEffects.nervous).toBeDefined();
      expect(allEffects.lazy).toBeDefined();
      expect(allEffects.fragile).toBeDefined();
      expect(allEffects.aggressive).toBeDefined();
      expect(allEffects.stubborn).toBeDefined();

      // Rare traits
      expect(allEffects.legendary_bloodline).toBeDefined();
      expect(allEffects.burnout).toBeDefined();
    });
  });
});
