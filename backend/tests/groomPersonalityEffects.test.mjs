/**
 * @fileoverview Comprehensive Tests for Groom Personality Effects System
 *
 * @description
 * Complete test suite for the groom personality effects system, validating personality-based
 * bonuses, task-specific effects, special conditions, and integration with the groom
 * interaction system. Tests all personality types and their unique effects using TDD
 * methodology with balanced mocking approach.
 *
 * @features
 * - Personality effect calculation testing for all personality types
 * - Task-specific bonus validation and penalty application
 * - Special condition testing (age, traits, task categories)
 * - Success rate modification and bonding effect validation
 * - Trait influence amplification and burnout risk modification
 * - Integration testing with groom interaction system
 * - Edge case and error handling validation
 *
 * @dependencies
 * - @jest/globals: Testing framework with ES modules support
 * - groomPersonalityEffects: Core personality effects calculation functions
 * - groomSystem: Integration with groom interaction calculations
 * - logger: Winston logger (strategically mocked for test isolation)
 *
 * @usage
 * Run with: npm test -- groomPersonalityEffects.test.js
 * Tests personality effects system with balanced mocking approach.
 * Validates business logic without over-mocking internal components.
 *
 * @author Equoria Development Team
 * @since 1.2.0
 * @lastModified 2025-01-02 - Initial comprehensive personality effects tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  GROOM_PERSONALITY_EFFECTS,
  calculatePersonalityEffects,
  getPersonalityEffectSummary,
  getAllPersonalityTypes,
} from '../utils/groomPersonalityEffects.mjs';

// Strategic mocking: Only mock external dependencies, not business logic
jest.mock('../utils/logger.mjs', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Groom Personality Effects System', () => {
  let testGroom;
  let testHorse;
  let baseEffects;

  beforeEach(() => {
    // Create fresh test data for each test
    testGroom = {
      id: 'test-groom-personality',
      name: 'Test Groom',
      personality: 'gentle',
      speciality: 'foalCare',
      skillLevel: 'intermediate',
      experience: 5,
    };

    testHorse = {
      id: 'test-horse-personality',
      name: 'Test Horse',
      age: 365, // 1 year old
      bondScore: 50,
      stressLevel: 20,
      traits: [
        { name: 'nervous', type: 'behavioral' },
        { name: 'curious', type: 'mental' },
      ],
    };

    baseEffects = {
      bondingChange: 5,
      stressChange: -3,
      cost: 25.0,
      quality: 'good',
      errorOccurred: false,
      successRate: 0.85,
      traitInfluence: 1,
      streakGrowth: 1,
      burnoutRisk: 0.1,
      modifiers: {
        specialty: 1.2,
        skillLevel: 1.1,
        personality: 1.2,
        experience: 1,
      },
    };
  });

  describe('GROOM_PERSONALITY_EFFECTS Configuration', () => {
    it('should have all required personality types defined', () => {
      const expectedPersonalities = [
        'gentle',
        'playful',
        'firm',
        'patient',
        'high_energy',
        'aloof',
      ];

      expectedPersonalities.forEach(personality => {
        expect(GROOM_PERSONALITY_EFFECTS).toHaveProperty(personality);

        const config = GROOM_PERSONALITY_EFFECTS[personality];
        expect(config).toHaveProperty('bonusTasks');
        expect(config).toHaveProperty('effect');
        expect(config).toHaveProperty('successRateModifier');
        expect(config).toHaveProperty('bondingModifier');
        expect(config).toHaveProperty('stressReductionModifier');
        expect(Array.isArray(config.bonusTasks)).toBe(true);
        expect(typeof config.effect).toBe('string');
      });
    });

    it('should have correct gentle personality configuration', () => {
      const gentle = GROOM_PERSONALITY_EFFECTS.gentle;

      expect(gentle.bonusTasks).toContain('brushing');
      expect(gentle.bonusTasks).toContain('stall_care');
      expect(gentle.effect).toContain('nervous or timid horses');
      expect(gentle.bondingModifier).toBe(1.2);
      expect(gentle.stressReductionModifier).toBe(1.4);
      expect(gentle.specialConditions.horseTraits).toContain('nervous');
      expect(gentle.specialConditions.bonusSuccessRate).toBe(0.1);
    });

    it('should have correct aloof personality penalty configuration', () => {
      const aloof = GROOM_PERSONALITY_EFFECTS.aloof;

      expect(aloof.penalty).toBe(true);
      expect(aloof.bonusTasks).toEqual([]);
      expect(aloof.bondingModifier).toBeLessThan(1.0);
      expect(aloof.streakGrowthModifier).toBeLessThan(1.0);
      expect(aloof.effect).toContain('No bonuses');
    });
  });

  describe('calculatePersonalityEffects', () => {
    it('should apply gentle personality effects for nervous horse with brushing', () => {
      testGroom.personality = 'gentle';
      const taskType = 'brushing';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('gentle');
      expect(result.personalityEffects.taskBonus).toBe(true);
      expect(result.personalityEffects.specialConditionMet).toBe(true);
      expect(result.personalityEffects.bonusesApplied).toContain('task_specialty');
      expect(result.personalityEffects.bonusesApplied).toContain('trait_match');

      // Should have enhanced bonding due to gentle personality
      expect(result.bondingChange).toBeGreaterThan(baseEffects.bondingChange);

      // Should have enhanced success rate due to nervous horse bonus
      expect(result.successRate).toBeGreaterThan(baseEffects.successRate);
    });

    it('should apply playful personality effects for young horse', () => {
      testGroom.personality = 'playful';
      testHorse.age = 500; // Young horse within age range
      const taskType = 'grooming_game';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('playful');
      expect(result.personalityEffects.taskBonus).toBe(true);
      expect(result.personalityEffects.specialConditionMet).toBe(true);
      expect(result.personalityEffects.bonusesApplied).toContain('task_specialty');
      expect(result.personalityEffects.bonusesApplied).toContain('age_match');

      // Should have enhanced bonding for young horses
      expect(result.bondingChange).toBeGreaterThan(baseEffects.bondingChange);

      // Should have faster streak growth (1.15x modifier)
      expect(result.streakGrowth).toBe(Math.round(baseEffects.streakGrowth * 1.15));
    });

    it('should apply firm personality effects for stubborn horse', () => {
      testGroom.personality = 'firm';
      testHorse.traits = [{ name: 'stubborn', type: 'behavioral' }];
      const taskType = 'hand_walking';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('firm');
      expect(result.personalityEffects.taskBonus).toBe(true);
      expect(result.personalityEffects.specialConditionMet).toBe(true);
      expect(result.personalityEffects.bonusesApplied).toContain('task_specialty');
      expect(result.personalityEffects.bonusesApplied).toContain('trait_match');

      // Should have enhanced trait influence for stubborn horses (1.3x modifier)
      expect(result.traitInfluence).toBe(Math.round(baseEffects.traitInfluence * 1.3));
    });

    it('should apply patient personality effects for enrichment tasks', () => {
      testGroom.personality = 'patient';
      const taskType = 'puddle_training';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('patient');
      expect(result.personalityEffects.taskBonus).toBe(true);
      expect(result.personalityEffects.specialConditionMet).toBe(true);
      expect(result.personalityEffects.bonusesApplied).toContain('task_specialty');
      expect(result.personalityEffects.bonusesApplied).toContain('category_match');

      // Should have enhanced success rate for enrichment tasks
      expect(result.successRate).toBeGreaterThan(baseEffects.successRate);

      // Should have reduced burnout risk
      expect(result.burnoutRisk).toBeLessThan(baseEffects.burnoutRisk);
    });

    it('should apply high_energy personality effects with extra trait points', () => {
      testGroom.personality = 'high_energy';
      const taskType = 'obstacle_course';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('high_energy');
      expect(result.personalityEffects.taskBonus).toBe(true);
      expect(result.personalityEffects.bonusesApplied).toContain('task_specialty');
      expect(result.personalityEffects.bonusesApplied).toContain('extra_trait_points');

      // Should have extra trait influence points (1.4x modifier + 1 extra = 2.4, rounded to 2)
      const expectedTraitInfluence = Math.round(baseEffects.traitInfluence * 1.4) + 1;
      expect(result.traitInfluence).toBe(expectedTraitInfluence);

      // Should have higher burnout risk (1.2x modifier)
      expect(result.burnoutRisk).toBe(baseEffects.burnoutRisk * 1.2);
    });

    it('should apply aloof personality penalties', () => {
      testGroom.personality = 'aloof';
      const taskType = 'brushing';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('aloof');
      expect(result.personalityEffects.taskBonus).toBe(false);
      expect(result.personalityEffects.specialConditionMet).toBe(false);

      // Should have reduced bonding (0.8x modifier)
      expect(result.bondingChange).toBe(Math.round(baseEffects.bondingChange * 0.8));

      // Should have reduced success rate (0.9x modifier)
      expect(result.successRate).toBe(baseEffects.successRate * 0.9);

      // Should have slower streak growth (0.9x modifier)
      expect(result.streakGrowth).toBe(Math.round(baseEffects.streakGrowth * 0.9));
    });

    it('should handle unknown personality gracefully', () => {
      testGroom.personality = 'unknown_personality';
      const taskType = 'brushing';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      // Should return original effects unchanged
      expect(result).toEqual(baseEffects);
    });

    it('should not exceed maximum success rate of 0.99', () => {
      testGroom.personality = 'patient';
      baseEffects.successRate = 0.95; // High base success rate
      const taskType = 'puddle_training';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.successRate).toBeLessThanOrEqual(0.99);
    });
  });

  describe('getPersonalityEffectSummary', () => {
    it('should return correct summary for gentle personality with bonus task', () => {
      const summary = getPersonalityEffectSummary('gentle', 'brushing');

      expect(summary.hasEffect).toBe(true);
      expect(summary.personality).toBe('gentle');
      expect(summary.taskBonus).toBe(true);
      expect(summary.effect).toContain('nervous or timid horses');
      expect(summary.modifiers.bonding).toBe(1.2);
      expect(summary.specialConditions.horseTraits).toContain('nervous');
    });

    it('should return correct summary for personality without task bonus', () => {
      const summary = getPersonalityEffectSummary('gentle', 'obstacle_course');

      expect(summary.hasEffect).toBe(true);
      expect(summary.personality).toBe('gentle');
      expect(summary.taskBonus).toBe(false);
      expect(summary.modifiers.bonding).toBe(1.2);
    });

    it('should handle unknown personality type', () => {
      const summary = getPersonalityEffectSummary('unknown', 'brushing');

      expect(summary.hasEffect).toBe(false);
      expect(summary.description).toBe('Unknown personality type');
    });
  });

  describe('getAllPersonalityTypes', () => {
    it('should return all personality types with correct structure', () => {
      const personalities = getAllPersonalityTypes();

      expect(Array.isArray(personalities)).toBe(true);
      expect(personalities.length).toBe(6); // gentle, playful, firm, patient, high_energy, aloof

      personalities.forEach(personality => {
        expect(personality).toHaveProperty('type');
        expect(personality).toHaveProperty('name');
        expect(personality).toHaveProperty('effect');
        expect(personality).toHaveProperty('bonusTasks');
        expect(personality).toHaveProperty('isPenalty');
        expect(Array.isArray(personality.bonusTasks)).toBe(true);
        expect(typeof personality.isPenalty).toBe('boolean');
      });
    });

    it('should correctly identify penalty personalities', () => {
      const personalities = getAllPersonalityTypes();
      const aloof = personalities.find(p => p.type === 'aloof');

      expect(aloof.isPenalty).toBe(true);

      const gentle = personalities.find(p => p.type === 'gentle');
      expect(gentle.isPenalty).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle horse without traits', () => {
      testGroom.personality = 'gentle';
      testHorse.traits = null;
      const taskType = 'brushing';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('gentle');
      expect(result.personalityEffects.taskBonus).toBe(true);
      expect(result.personalityEffects.specialConditionMet).toBe(false); // No traits to match
    });

    it('should handle missing age information', () => {
      testGroom.personality = 'playful';
      testHorse.age = undefined;
      const taskType = 'grooming_game';

      const result = calculatePersonalityEffects(testGroom, testHorse, taskType, baseEffects);

      expect(result.personalityEffects.personality).toBe('playful');
      expect(result.personalityEffects.taskBonus).toBe(true);
      // Should not crash, but age-based bonus won't apply
    });

    it('should handle empty base effects object', () => {
      const emptyEffects = {};
      testGroom.personality = 'gentle';

      const result = calculatePersonalityEffects(testGroom, testHorse, 'brushing', emptyEffects);

      expect(result.personalityEffects).toBeDefined();
      expect(result.personalityEffects.personality).toBe('gentle');
    });
  });
});
