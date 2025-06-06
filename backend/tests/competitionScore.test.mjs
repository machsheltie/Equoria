/**
 * 🧪 UNIT TEST: Competition Score Calculation - Scoring Algorithm Validation
 *
 * This test validates the competition scoring algorithm including stat calculations,
 * trait bonuses, luck modifiers, and discipline-specific scoring logic.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Discipline-specific stat weighting: Each discipline uses 3 primary stats
 * - Trait bonus application: +5 score bonus for matching discipline affinity traits
 * - Luck modifier system: ±9% random variance applied to base scores
 * - Score calculation formula: (stat1 + stat2 + stat3) + trait_bonus + luck_modifier
 * - Input validation: Proper error handling for invalid horses and event types
 * - Edge case handling: Missing stats default to 0, missing traits handled gracefully
 * - Score rounding: All scores returned as integers
 * - Trait matching logic: Only matching discipline traits provide bonuses
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. calculateCompetitionScore() - Complete scoring algorithm for all disciplines
 * 2. Discipline stat mapping: Racing, Show Jumping, Dressage, Cross Country
 * 3. Trait bonus application: +5 bonus for matching discipline_affinity traits
 * 4. Luck modifier variance: ±9% random adjustment to base scores
 * 5. Input validation: Error handling for null/invalid inputs
 * 6. Edge cases: Missing stats, missing traits, unknown disciplines
 * 7. Statistical validation: Trait advantages demonstrated over multiple runs
 * 8. Deterministic testing: Controlled randomness for exact score verification
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Score calculations, stat mappings, trait logic, validation
 * ✅ REAL: Business rule enforcement, edge case handling, mathematical operations
 * 🔧 MOCK: Math.random() only - for predictable testing of luck modifiers
 *
 * 💡 TEST STRATEGY: Unit testing with controlled randomness to validate
 *    scoring algorithm accuracy and trait advantage consistency
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  calculateCompetitionScore,
  getDisciplineStatWeights,
  validateHorseForCompetition,
} from '../utils/competitionScore.mjs';

describe('🏆 UNIT: Competition Score Calculation - Scoring Algorithm Validation', () => {
  const createTestHorse = (stats = {}, traits = []) => ({
    id: 1,
    name: 'Test Horse',
    speed: 70,
    stamina: 60,
    focus: 50,
    agility: 60,
    precision: 55,
    balance: 55,
    coordination: 50,
    boldness: 50,
    epigeneticModifiers: {
      positive: traits,
      negative: [],
      hidden: [],
    },
    ...stats,
  });

  describe('calculateCompetitionScore', () => {
    it('should calculate correct base score for Racing discipline', () => {
      const horse = createTestHorse({ speed: 80, stamina: 70, focus: 60 });
      const score = calculateCompetitionScore(horse, 'Racing');

      // Base score should be 80 + 70 + 60 = 210, plus/minus luck and trait bonus
      expect(score).toBeGreaterThan(180); // Allow for luck variance
      expect(score).toBeLessThan(240);
    });

    it('should calculate correct base score for Show Jumping discipline', () => {
      const horse = createTestHorse({ precision: 80, focus: 70, stamina: 60 });
      const score = calculateCompetitionScore(horse, 'Show Jumping');

      // Base score should be 80 + 70 + 60 = 210, plus/minus luck and trait bonus
      expect(score).toBeGreaterThan(180);
      expect(score).toBeLessThan(240);
    });

    it('should calculate correct base score for Dressage discipline', () => {
      const horse = createTestHorse({ precision: 80, focus: 70, coordination: 60 });
      const score = calculateCompetitionScore(horse, 'Dressage');

      // Base score should be 80 + 70 + 60 = 210, plus/minus luck and trait bonus
      expect(score).toBeGreaterThan(180);
      expect(score).toBeLessThan(240);
    });

    it('should calculate correct base score for Cross Country discipline', () => {
      const horse = createTestHorse({ stamina: 80, agility: 70, boldness: 60 });
      const score = calculateCompetitionScore(horse, 'Cross Country');

      // Base score should be 80 + 70 + 60 = 210, plus/minus luck and trait bonus
      expect(score).toBeGreaterThan(180);
      expect(score).toBeLessThan(240);
    });

    it('should apply +5 trait bonus for matching discipline affinity', () => {
      const horseWithTrait = createTestHorse({ speed: 70, stamina: 60, focus: 50 }, [
        'discipline_affinity_racing',
      ]);
      const horseWithoutTrait = createTestHorse({ speed: 70, stamina: 60, focus: 50 });

      // Mock Math.random to eliminate luck variance for this test
      const originalRandom = Math.random;
      Math.random = () => 0.5; // This gives 0% luck modifier

      const scoreWithTrait = calculateCompetitionScore(horseWithTrait, 'Racing');
      const scoreWithoutTrait = calculateCompetitionScore(horseWithoutTrait, 'Racing');

      // Restore Math.random
      Math.random = originalRandom;

      expect(scoreWithTrait).toBe(scoreWithoutTrait + 5);
    });

    it('should NOT apply trait bonus for non-matching discipline', () => {
      const horse = createTestHorse(
        { speed: 70, stamina: 60, focus: 50 },
        ['discipline_affinity_dressage'], // Wrong trait for Racing
      );

      // Mock Math.random to eliminate luck variance
      const originalRandom = Math.random;
      Math.random = () => 0.5;

      const score = calculateCompetitionScore(horse, 'Racing');

      // Restore Math.random
      Math.random = originalRandom;

      // Should be base score (180) with no trait bonus
      expect(score).toBe(180);
    });

    it('should apply ±9% random luck modifier', () => {
      const horse = createTestHorse({ speed: 100, stamina: 100, focus: 100 }); // Base score: 300
      const scores = [];

      // Generate multiple scores to test variance
      for (let i = 0; i < 50; i++) {
        scores.push(calculateCompetitionScore(horse, 'Racing'));
      }

      // Check that we have variance in scores
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);

      expect(maxScore).toBeGreaterThan(minScore); // Should have variance
      expect(minScore).toBeGreaterThanOrEqual(273); // Should be at or above 300 * 0.91 = 273
      expect(maxScore).toBeLessThanOrEqual(327); // Should be at or below 300 * 1.09 = 327
    });

    it('should handle missing stats by defaulting to 0', () => {
      const horse = createTestHorse({ speed: undefined, stamina: null, focus: 80 });
      const score = calculateCompetitionScore(horse, 'Racing');

      // Should use 0 + 0 + 80 = 80 as base score
      expect(score).toBeGreaterThan(70);
      expect(score).toBeLessThan(90);
    });

    it('should handle missing epigeneticModifiers gracefully', () => {
      const horse = {
        id: 1,
        name: 'Test Horse',
        speed: 70,
        stamina: 60,
        focus: 50,
        // No epigeneticModifiers field
      };

      expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
      const score = calculateCompetitionScore(horse, 'Racing');
      expect(typeof score).toBe('number');
    });

    it('should handle null epigeneticModifiers.positive gracefully', () => {
      const horse = createTestHorse();
      horse.epigeneticModifiers.positive = null;

      expect(() => calculateCompetitionScore(horse, 'Racing')).not.toThrow();
      const score = calculateCompetitionScore(horse, 'Racing');
      expect(typeof score).toBe('number');
    });

    it('should throw error for invalid horse input', () => {
      expect(() => calculateCompetitionScore(null, 'Racing')).toThrow('Horse object is required');
      expect(() => calculateCompetitionScore(undefined, 'Racing')).toThrow(
        'Horse object is required',
      );
      expect(() => calculateCompetitionScore('invalid', 'Racing')).toThrow(
        'Horse object is required',
      );
    });

    it('should throw error for invalid event type', () => {
      const horse = createTestHorse();
      expect(() => calculateCompetitionScore(horse, null)).toThrow(
        'Event type is required and must be a string',
      );
      expect(() => calculateCompetitionScore(horse)).toThrow(
        'Event type is required and must be a string',
      );
      expect(() => calculateCompetitionScore(horse, 123)).toThrow(
        'Event type is required and must be a string',
      );
    });

    it('should handle unknown event types with default calculation', () => {
      const horse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });
      const score = calculateCompetitionScore(horse, 'Unknown Event');

      // Should use Racing calculation as default
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(160);
      expect(score).toBeLessThan(200);
    });

    it('should return rounded integer scores', () => {
      const horse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });
      const score = calculateCompetitionScore(horse, 'Racing');

      expect(Number.isInteger(score)).toBe(true);
    });
  });

  describe('Trait Match Logic - 20 Competition Simulation Tests', () => {
    it('should demonstrate trait advantage in Show Jumping competitions (discipline_affinity_show_jumping)', () => {
      // Use jest.spyOn for more deterministic testing
      const mockRandom = jest.spyOn(Math, 'random');

      const traitHorse = createTestHorse({ precision: 70, focus: 60, stamina: 50 }, [
        'discipline_affinity_show_jumping',
      ]);

      const regularHorse = createTestHorse({ precision: 70, focus: 60, stamina: 50 });

      let traitWins = 0;
      const totalRuns = 20;

      // Generate consistent but varied random values to ensure trait advantage shows
      const randomValues = Array.from({ length: totalRuns * 2 }, (_, i) => 0.3 + (i % 5) * 0.1);
      let randomIndex = 0;

      mockRandom.mockImplementation(() => randomValues[randomIndex++ % randomValues.length]);

      for (let i = 0; i < totalRuns; i++) {
        const traitScore = calculateCompetitionScore(traitHorse, 'Show Jumping');
        const regularScore = calculateCompetitionScore(regularHorse, 'Show Jumping');

        if (traitScore > regularScore) {
          traitWins++;
        }
      }

      // Restore original Math.random
      mockRandom.mockRestore();

      // With +5 trait bonus and controlled randomness, should win most of the time
      expect(traitWins).toBeGreaterThanOrEqual(11);

      expect(traitWins).toBeLessThanOrEqual(20); // Sanity check
    });

    it('should demonstrate trait advantage in Racing competitions (discipline_affinity_racing)', () => {
      // Use jest.spyOn for more deterministic testing
      const mockRandom = jest.spyOn(Math, 'random');

      const traitHorse = createTestHorse({ speed: 70, stamina: 60, focus: 50 }, [
        'discipline_affinity_racing',
      ]);

      const regularHorse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });

      let traitWins = 0;
      const totalRuns = 20;

      // Generate consistent but varied random values to ensure trait advantage shows
      const randomValues = Array.from({ length: totalRuns * 2 }, (_, i) => 0.3 + (i % 5) * 0.1);
      let randomIndex = 0;

      mockRandom.mockImplementation(() => randomValues[randomIndex++ % randomValues.length]);

      for (let i = 0; i < totalRuns; i++) {
        const traitScore = calculateCompetitionScore(traitHorse, 'Racing');
        const regularScore = calculateCompetitionScore(regularHorse, 'Racing');

        if (traitScore > regularScore) {
          traitWins++;
        }
      }

      // Restore original Math.random
      mockRandom.mockRestore();

      expect(traitWins).toBeGreaterThanOrEqual(11);
      expect(traitWins).toBeLessThanOrEqual(20);
    });

    it('should demonstrate trait advantage in Dressage competitions (discipline_affinity_dressage)', () => {
      // Use jest.spyOn for more deterministic testing
      const mockRandom = jest.spyOn(Math, 'random');

      const traitHorse = createTestHorse({ precision: 70, focus: 60, coordination: 50 }, [
        'discipline_affinity_dressage',
      ]);

      const regularHorse = createTestHorse({ precision: 70, focus: 60, coordination: 50 });

      let traitWins = 0;
      const totalRuns = 20;

      // Generate consistent but varied random values to ensure trait advantage shows
      const randomValues = Array.from({ length: totalRuns * 2 }, (_, i) => 0.3 + (i % 5) * 0.1);
      let randomIndex = 0;

      mockRandom.mockImplementation(() => randomValues[randomIndex++ % randomValues.length]);

      for (let i = 0; i < totalRuns; i++) {
        const traitScore = calculateCompetitionScore(traitHorse, 'Dressage');
        const regularScore = calculateCompetitionScore(regularHorse, 'Dressage');

        if (traitScore > regularScore) {
          traitWins++;
        }
      }

      // Restore original Math.random
      mockRandom.mockRestore();

      expect(traitWins).toBeGreaterThanOrEqual(11);
      expect(traitWins).toBeLessThanOrEqual(20);
    });

    it('should demonstrate trait advantage in Cross Country competitions (discipline_affinity_cross_country)', () => {
      // Use jest.spyOn for more deterministic testing
      const mockRandom = jest.spyOn(Math, 'random');

      const traitHorse = createTestHorse({ stamina: 70, agility: 60, boldness: 50 }, [
        'discipline_affinity_cross_country',
      ]);

      const regularHorse = createTestHorse({ stamina: 70, agility: 60, boldness: 50 });

      let traitWins = 0;
      const totalRuns = 20;

      // Generate consistent but varied random values to ensure trait advantage shows
      const randomValues = Array.from({ length: totalRuns * 2 }, (_, i) => 0.3 + (i % 5) * 0.1);
      let randomIndex = 0;

      mockRandom.mockImplementation(() => randomValues[randomIndex++ % randomValues.length]);

      for (let i = 0; i < totalRuns; i++) {
        const traitScore = calculateCompetitionScore(traitHorse, 'Cross Country');
        const regularScore = calculateCompetitionScore(regularHorse, 'Cross Country');

        if (traitScore > regularScore) {
          traitWins++;
        }
      }

      // Restore original Math.random
      mockRandom.mockRestore();

      // With +5 trait bonus and controlled randomness, should win most of the time
      expect(traitWins).toBeGreaterThanOrEqual(11);
      expect(traitWins).toBeLessThanOrEqual(20);
    });

    it('should show no advantage when trait does not match discipline', () => {
      // Use jest.spyOn for more deterministic testing
      const mockRandom = jest.spyOn(Math, 'random');

      const jumpTraitHorse = createTestHorse(
        { speed: 70, stamina: 60, focus: 50 },
        ['discipline_affinity_show_jumping'], // Jump trait for Racing discipline
      );

      const regularHorse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });

      let traitWins = 0;
      const totalRuns = 20;

      // Generate random values that create exactly 50/50 distribution
      // Each pair of calls: first favors trait horse, second favors regular horse
      const randomValues = [];
      for (let i = 0; i < totalRuns; i++) {
        if (i < 10) {
          // First 10 runs: trait horse gets slightly better luck
          randomValues.push(0.6); // trait horse gets +1.8% luck
          randomValues.push(0.4); // regular horse gets -1.8% luck
        } else {
          // Last 10 runs: regular horse gets slightly better luck
          randomValues.push(0.4); // trait horse gets -1.8% luck
          randomValues.push(0.6); // regular horse gets +1.8% luck
        }
      }
      let randomIndex = 0;

      mockRandom.mockImplementation(() => randomValues[randomIndex++ % randomValues.length]);

      // Test in Racing (trait doesn't match)
      for (let i = 0; i < totalRuns; i++) {
        const traitScore = calculateCompetitionScore(jumpTraitHorse, 'Racing');
        const regularScore = calculateCompetitionScore(regularHorse, 'Racing');

        if (traitScore > regularScore) {
          traitWins++;
        }
      }

      // Restore original Math.random
      mockRandom.mockRestore();

      // Should be close to 50/50 since no trait advantage applies
      expect(traitWins).toBeGreaterThanOrEqual(8); // Should win about 10 out of 20
      expect(traitWins).toBeLessThanOrEqual(12); // Should win about 10 out of 20
    });

    it('should handle horse missing epigeneticModifiers without throwing error', () => {
      // Use jest.spyOn for more deterministic testing
      const mockRandom = jest.spyOn(Math, 'random');

      const horseWithoutModifiers = {
        id: 1,
        name: 'No Modifiers Horse',
        speed: 70,
        stamina: 60,
        focus: 50,
        // No epigeneticModifiers field
      };

      const regularHorse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });

      let noModifiersWins = 0;
      const totalRuns = 20;

      // Generate random values that create exactly 50/50 distribution
      // Each pair of calls: first favors no-modifiers horse, second favors regular horse
      const randomValues = [];
      for (let i = 0; i < totalRuns; i++) {
        if (i < 10) {
          // First 10 runs: no-modifiers horse gets slightly better luck
          randomValues.push(0.6); // no-modifiers horse gets +1.8% luck
          randomValues.push(0.4); // regular horse gets -1.8% luck
        } else {
          // Last 10 runs: regular horse gets slightly better luck
          randomValues.push(0.4); // no-modifiers horse gets -1.8% luck
          randomValues.push(0.6); // regular horse gets +1.8% luck
        }
      }
      let randomIndex = 0;

      mockRandom.mockImplementation(() => randomValues[randomIndex++ % randomValues.length]);

      for (let i = 0; i < totalRuns; i++) {
        expect(() => {
          calculateCompetitionScore(horseWithoutModifiers, 'Racing');
        }).not.toThrow();

        const noModifiersScore = calculateCompetitionScore(horseWithoutModifiers, 'Racing');
        const regularScore = calculateCompetitionScore(regularHorse, 'Racing');

        if (noModifiersScore > regularScore) {
          noModifiersWins++;
        }
      }

      // Restore original Math.random
      mockRandom.mockRestore();

      // Should be close to 50/50 since both horses have no trait advantage
      expect(noModifiersWins).toBeGreaterThanOrEqual(8); // Should win about 10 out of 20
      expect(noModifiersWins).toBeLessThanOrEqual(12); // Should win about 10 out of 20
    });
  });

  describe('Deterministic Tests with Controlled Randomness', () => {
    let originalRandom;

    beforeEach(() => {
      originalRandom = Math.random;
    });

    afterEach(() => {
      Math.random = originalRandom;
    });

    it('should apply exact +5 bonus with controlled randomness', () => {
      // Mock Math.random to return 0.5 (middle of range for luck modifier)
      Math.random = () => 0.5;

      const traitHorse = createTestHorse({ speed: 70, stamina: 60, focus: 50 }, [
        'discipline_affinity_racing',
      ]);

      const regularHorse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });

      const traitScore = calculateCompetitionScore(traitHorse, 'Racing');
      const regularScore = calculateCompetitionScore(regularHorse, 'Racing');

      // With controlled randomness, the difference should be exactly +5
      const scoreDifference = traitScore - regularScore;
      expect(scoreDifference).toBe(5);
    });

    it('should handle minimum luck modifier (0)', () => {
      // Mock Math.random to return 0 (minimum luck modifier: -9%)
      Math.random = () => 0;

      const horse = createTestHorse({ speed: 100, stamina: 100, focus: 100 });
      const score = calculateCompetitionScore(horse, 'Racing');

      // Base score: 300, with -9% luck modifier should be exactly 273
      expect(score).toBe(273);
    });

    it('should handle maximum luck modifier (1)', () => {
      // Mock Math.random to return 1 (maximum luck modifier: +9%)
      Math.random = () => 1;

      const horse = createTestHorse({ speed: 100, stamina: 100, focus: 100 });
      const score = calculateCompetitionScore(horse, 'Racing');

      // Base score: 300, with +9% luck modifier should be exactly 327
      expect(score).toBe(327);
    });

    it('should demonstrate consistent trait advantage with controlled randomness', () => {
      // Mock Math.random to return consistent value
      Math.random = () => 0.5;

      const traitHorse = createTestHorse({ precision: 70, focus: 60, stamina: 50 }, [
        'discipline_affinity_show_jumping',
      ]);

      const regularHorse = createTestHorse({ precision: 70, focus: 60, stamina: 50 });

      // With controlled randomness, trait horse should win every time
      let traitWins = 0;
      const totalRuns = 10;

      for (let i = 0; i < totalRuns; i++) {
        const traitScore = calculateCompetitionScore(traitHorse, 'Show Jumping');
        const regularScore = calculateCompetitionScore(regularHorse, 'Show Jumping');

        if (traitScore > regularScore) {
          traitWins++;
        }
      }

      expect(traitWins).toBe(totalRuns); // Should win all with controlled randomness
    });

    it('should verify trait bonus is applied correctly across all disciplines', () => {
      Math.random = () => 0.5; // Neutral luck modifier

      const disciplines = [
        {
          name: 'Racing',
          trait: 'discipline_affinity_racing',
          stats: { speed: 70, stamina: 60, focus: 50 },
        },
        {
          name: 'Show Jumping',
          trait: 'discipline_affinity_show_jumping',
          stats: { precision: 70, focus: 60, stamina: 50 },
        },
        {
          name: 'Dressage',
          trait: 'discipline_affinity_dressage',
          stats: { precision: 70, focus: 60, coordination: 50 },
        },
        {
          name: 'Cross Country',
          trait: 'discipline_affinity_cross_country',
          stats: { stamina: 70, agility: 60, boldness: 50 },
        },
      ];

      disciplines.forEach(({ name, trait, stats }) => {
        const traitHorse = createTestHorse(stats, [trait]);
        const regularHorse = createTestHorse(stats);

        const traitScore = calculateCompetitionScore(traitHorse, name);
        const regularScore = calculateCompetitionScore(regularHorse, name);

        expect(traitScore - regularScore).toBe(5);
      });
    });

    it('should verify no bonus when trait does not match discipline', () => {
      Math.random = () => 0.5; // Neutral luck modifier

      const jumpTraitHorse = createTestHorse(
        { speed: 70, stamina: 60, focus: 50 },
        ['discipline_affinity_show_jumping'], // Jump trait
      );

      const regularHorse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });

      // Test in Racing (trait doesn't match)
      const traitScore = calculateCompetitionScore(jumpTraitHorse, 'Racing');
      const regularScore = calculateCompetitionScore(regularHorse, 'Racing');

      expect(traitScore - regularScore).toBe(0); // No bonus
    });
  });

  describe('getDisciplineStatWeights', () => {
    it('should return correct weights for Racing', () => {
      const weights = getDisciplineStatWeights('Racing');
      expect(weights).toEqual({
        speed: 1.0,
        stamina: 1.0,
        focus: 1.0,
      });
    });

    it('should return correct weights for Show Jumping', () => {
      const weights = getDisciplineStatWeights('Show Jumping');
      expect(weights).toEqual({
        precision: 1.0,
        focus: 1.0,
        stamina: 1.0,
      });
    });

    it('should return default weights for unknown discipline', () => {
      const weights = getDisciplineStatWeights('Unknown');
      expect(weights).toEqual({
        speed: 1.0,
        stamina: 1.0,
        focus: 1.0,
      });
    });
  });

  describe('validateHorseForCompetition', () => {
    it('should return true for valid horse with required stats', () => {
      const horse = createTestHorse({ speed: 70, stamina: 60, focus: 50 });
      expect(validateHorseForCompetition(horse, 'Racing')).toBe(true);
    });

    it('should return false for invalid horse input', () => {
      expect(validateHorseForCompetition(null, 'Racing')).toBe(false);
      expect(validateHorseForCompetition(undefined, 'Racing')).toBe(false);
      expect(validateHorseForCompetition('invalid', 'Racing')).toBe(false);
    });

    it('should return true if horse has at least one required stat', () => {
      const horse = { speed: 70 }; // Only has speed stat
      expect(validateHorseForCompetition(horse, 'Racing')).toBe(true);
    });

    it('should return false if horse has no valid stats', () => {
      const horse = { name: 'Test Horse' }; // No stat fields
      expect(validateHorseForCompetition(horse, 'Racing')).toBe(false);
    });
  });
});
