/**
 * Epigenetic Flag Influence Tests
 * Unit tests for flag influence system and trait integration
 *
 * 🧪 TESTING APPROACH: Balanced Mocking
 * - Mock logger only
 * - Test real influence calculation logic
 * - Validate trait weight modifications
 * - Test behavior modifier aggregation
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock logger
jest.mock(
  '../../utils/logger.mjs',
  () => ({
    default: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  }),
  { virtual: true },
);

// Import after mocking
const {
  calculateBehaviorModifiers,
  applyFlagInfluencesToCompetition,
  applyFlagInfluencesToTraining,
  applyFlagInfluencesToBonding,
  getFlagInfluenceSummary,
} = await import('../../utils/epigeneticFlagInfluence.mjs');

describe('Epigenetic Flag Influence System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateBehaviorModifiers', () => {
    test('should return empty object for no flags', () => {
      const result = calculateBehaviorModifiers([]);
      expect(result).toEqual({});
    });

    test('should calculate modifiers for single flag', () => {
      const result = calculateBehaviorModifiers(['brave']);

      expect(result.statRecoveryBonus).toBe(0.05);
      expect(result.stressResistance).toBe(0.1);
    });

    test('should aggregate modifiers from multiple flags', () => {
      const result = calculateBehaviorModifiers(['brave', 'resilient']);

      // Brave: statRecoveryBonus 0.05, stressResistance 0.1
      // Resilient: stressRecovery 0.2, healthBonus 0.05
      expect(result.statRecoveryBonus).toBe(0.05);
      expect(result.stressResistance).toBe(0.1);
      expect(result.stressRecovery).toBe(0.2);
      expect(result.healthBonus).toBe(0.05);
    });

    test('should stack same modifier types', () => {
      const result = calculateBehaviorModifiers(['fearful', 'fragile']);

      // Both flags have stressVulnerability
      expect(result.stressVulnerability).toBe(0.4); // 0.15 + 0.25
    });
  });

  describe('applyFlagInfluencesToCompetition', () => {
    test('should return unchanged score for no flags', () => {
      const result = applyFlagInfluencesToCompetition(100, [], 'racing');

      expect(result.modifiedScore).toBe(100);
      expect(result.totalModifier).toBe(0);
      expect(result.appliedModifiers).toEqual({});
    });

    test('should apply competition bonus correctly', () => {
      const result = applyFlagInfluencesToCompetition(100, ['confident'], 'racing');

      // Confident has competitionBonus 0.1 and stressResistance 0.2 (applied as 0.2 * 0.3 = 0.06)
      // competitionBonus: 100 * 0.1 = 10
      // stressResistance: 100 * 0.06 = 6
      // Total: 100 + 10 + 6 = 116
      expect(result.modifiedScore).toBe(116);
      expect(result.totalModifier).toBe(16);
      expect(result.appliedModifiers.competitionBonus).toBe(10);
    });

    test('should apply competition penalty correctly', () => {
      const result = applyFlagInfluencesToCompetition(100, ['fearful'], 'racing');

      // Fearful has competitionPenalty -0.15 and stressVulnerability 0.15
      // competitionPenalty: 100 * -0.15 = -15
      // stressVulnerability: 100 * (-0.15 * 0.5) = -7.5
      // Total: 100 - 15 - 7.5 = 77.5
      expect(result.modifiedScore).toBe(77.5);
      expect(result.appliedModifiers.competitionPenalty).toBe(-15);
      expect(result.appliedModifiers.stressVulnerability).toBe(-7.5);
    });

    test('should apply stress modifiers correctly', () => {
      const result = applyFlagInfluencesToCompetition(100, ['brave'], 'racing');

      // Brave has competitionBonus 0.15 and stressResistance 0.1 (applied as 0.1 * 0.3 = 0.03)
      // competitionBonus: 100 * 0.15 = 15
      // stressResistance: 100 * 0.03 = 3
      // Total: 100 + 15 + 3 = 118
      expect(result.modifiedScore).toBe(118);
      expect(result.appliedModifiers.stressResistance).toBe(3);
    });

    test('should not allow negative scores', () => {
      const result = applyFlagInfluencesToCompetition(10, ['fragile'], 'racing');

      // Fragile has high stress vulnerability that could make score negative
      expect(result.modifiedScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyFlagInfluencesToTraining', () => {
    test('should return unchanged efficiency for no flags', () => {
      const result = applyFlagInfluencesToTraining(0.5, []);

      expect(result.modifiedEfficiency).toBe(0.5);
      expect(result.totalModifier).toBe(0);
    });

    test('should apply training efficiency modifier', () => {
      const result = applyFlagInfluencesToTraining(0.5, ['confident']);

      expect(result.modifiedEfficiency).toBe(0.55); // 0.5 + 0.05
      expect(result.appliedModifiers.trainingEfficiency).toBe(0.05);
    });

    test('should apply bonding modifiers to training', () => {
      const result = applyFlagInfluencesToTraining(0.5, ['affectionate']);

      // Affectionate has bondingRate 0.15, applied as 0.15 * 0.5 = 0.075
      expect(result.modifiedEfficiency).toBe(0.575); // 0.5 + 0.075
      expect(result.appliedModifiers.bondingBonus).toBe(0.075);
    });

    test('should clamp efficiency to 0-1 range', () => {
      const result = applyFlagInfluencesToTraining(0.95, ['confident']);

      expect(result.modifiedEfficiency).toBe(1); // Clamped to 1
    });
  });

  describe('applyFlagInfluencesToBonding', () => {
    test('should return unchanged bonding for no flags', () => {
      const result = applyFlagInfluencesToBonding(5, []);

      expect(result.modifiedBondingChange).toBe(5);
      expect(result.totalModifier).toBe(0);
    });

    test('should apply bonding rate modifier', () => {
      const result = applyFlagInfluencesToBonding(5, ['affectionate']);

      // Affectionate has bondingRate 0.15 and groomEffectiveness 0.15
      const expectedRate = 5 * 0.15; // 0.75
      const expectedGroom = 5 * 0.15; // 0.75
      const expectedTotal = 5 + expectedRate + expectedGroom; // 6.5

      expect(result.modifiedBondingChange).toBe(expectedTotal);
      expect(result.appliedModifiers.bondingRate).toBe(expectedRate);
      expect(result.appliedModifiers.groomEffectiveness).toBe(expectedGroom);
    });

    test('should apply bonding resistance penalty', () => {
      const result = applyFlagInfluencesToBonding(5, ['aloof']);

      // Aloof has bondingResistance 0.15 and groomEffectiveness -0.15
      const expectedPenalty = 5 * -0.15; // -0.75
      const expectedGroom = 5 * -0.15; // -0.75
      const expectedTotal = 5 + expectedPenalty + expectedGroom; // 3.5

      expect(result.modifiedBondingChange).toBe(expectedTotal);
      expect(result.appliedModifiers.bondingResistance).toBe(expectedPenalty);
    });
  });

  describe('getFlagInfluenceSummary', () => {
    test('should return empty summary for no flags', () => {
      const result = getFlagInfluenceSummary([]);

      expect(result.flagCount).toBe(0);
      expect(result.flags).toEqual([]);
      expect(result.traitInfluences).toEqual({});
      expect(result.behaviorModifiers).toEqual({});
      expect(result.summary).toBe('No epigenetic flags assigned');
    });

    test('should generate complete summary for multiple flags', () => {
      const result = getFlagInfluenceSummary(['brave', 'confident']);

      expect(result.flagCount).toBe(2);
      expect(result.flags).toHaveLength(2);
      expect(result.flags[0].name).toBe('brave');
      expect(result.flags[1].name).toBe('confident');
      expect(result.summary).toBe('2 flags (2 positive, 0 negative)');
    });

    test('should aggregate trait influences correctly', () => {
      const result = getFlagInfluenceSummary(['brave', 'fearful']);

      // Brave: bold +0.3, spooky -0.4, confident +0.2
      // Fearful: bold -0.3, spooky +0.4, confident -0.4, timid +0.2
      expect(result.traitInfluences.bold).toBe(0); // 0.3 - 0.3
      expect(result.traitInfluences.spooky).toBe(0); // -0.4 + 0.4
      expect(result.traitInfluences.confident).toBe(-0.2); // 0.2 - 0.4
      expect(result.traitInfluences.timid).toBe(0.2);
    });

    test('should count flag types correctly', () => {
      const result = getFlagInfluenceSummary(['brave', 'confident', 'fearful', 'fragile']);

      expect(result.summary).toBe('4 flags (2 positive, 2 negative)');
    });
  });
});
