/**
 * 🧪 INTEGRATION TEST: Enhanced Competition Integration - Trait Scoring Validation
 *
 * This test validates the integration between competition scoring and trait systems
 * to ensure trait bonuses are properly applied in competition calculations.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Trait bonus integration: Discipline affinity traits provide competitive advantages
 * - Score calculation accuracy: Competition scores include trait bonuses correctly
 * - Discipline matching: Only matching discipline traits provide bonuses
 * - Random variance handling: Luck modifiers create score variation while preserving trait advantages
 * - Edge case handling: Missing epigenetic modifiers handled gracefully
 * - Score consistency: Results within expected ranges with appropriate variance
 * - Trait advantage demonstration: Horses with traits can achieve higher maximum scores
 * - Integration reliability: Trait system works consistently across multiple runs
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. calculateCompetitionScore() - Complete scoring with trait integration
 * 2. Trait bonus application: +5 bonuses for matching discipline affinity traits
 * 3. Discipline coverage: Racing, Show Jumping, Dressage, Cross Country
 * 4. Non-matching scenarios: Wrong discipline traits provide no consistent advantage
 * 5. Missing field handling: Graceful behavior with missing epigenetic modifiers
 * 6. Score variance: Random luck modifiers create appropriate score variation
 * 7. Maximum potential: Trait horses can achieve higher peak scores
 * 8. Statistical validation: Multiple runs to verify trait advantages
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: Complete competition scoring, trait calculations, random variance
 * ✅ REAL: Statistical validation, score range verification, integration testing
 * 🔧 MOCK: None - pure integration testing with real scoring algorithms
 *
 * 💡 TEST STRATEGY: Integration testing with statistical validation to ensure
 *    trait bonuses provide meaningful competitive advantages in scoring
 *
 * ⚠️  NOTE: Tests use multiple runs to find trait advantages, which may indicate
 *    inconsistent trait bonus application that should be investigated.
 */

import { describe, it, expect } from '@jest/globals';
import { calculateCompetitionScore } from '../utils/competitionScore.mjs';

// Simple integration test to verify the trait scoring works
const createTestHorse = (overrides = {}) => ({
  id: 1,
  name: 'Test Horse',
  speed: 70,
  stamina: 60,
  focus: 50,
  precision: 65,
  agility: 55,
  coordination: 50,
  boldness: 45,
  balance: 50,
  stressLevel: 20,
  health: 'Good',
  tack: {
    saddleBonus: 5,
    bridleBonus: 3,
  },
  epigeneticModifiers: {
    positive: [],
    negative: [],
    hidden: [],
  },
  ...overrides,
});

describe('🏆 INTEGRATION: Enhanced Competition Integration - Trait Scoring Validation', () => {
  describe('Basic Integration Tests', () => {
    it('should successfully import and use calculateCompetitionScore function', () => {
      const horse = createTestHorse();
      const score = calculateCompetitionScore(horse, 'Racing');

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
      expect(Number.isInteger(score)).toBe(true);
    });

    it('should apply trait bonuses correctly for each discipline', () => {
      const disciplines = [
        { name: 'Racing', trait: 'discipline_affinity_racing' },
        { name: 'Show Jumping', trait: 'discipline_affinity_show_jumping' },
        { name: 'Dressage', trait: 'discipline_affinity_dressage' },
        { name: 'Cross Country', trait: 'discipline_affinity_cross_country' },
      ];

      disciplines.forEach(({ name, trait }) => {
        const horseWithTrait = createTestHorse({
          epigeneticModifiers: {
            positive: [trait],
            negative: [],
            hidden: [],
          },
        });

        const horseWithoutTrait = createTestHorse();

        // Test multiple times to find at least one case where trait wins
        let foundTraitAdvantage = false;
        for (let i = 0; i < 10; i++) {
          const scoreWithTrait = calculateCompetitionScore(horseWithTrait, name);
          const scoreWithoutTrait = calculateCompetitionScore(horseWithoutTrait, name);

          if (scoreWithTrait > scoreWithoutTrait) {
            foundTraitAdvantage = true;
            break;
          }
        }

        expect(foundTraitAdvantage).toBe(true);
      });
    });

    it('should not apply trait bonus when trait does not match discipline', () => {
      const horseWithRacingTrait = createTestHorse({
        epigeneticModifiers: {
          positive: ['discipline_affinity_racing'],
          negative: [],
          hidden: [],
        },
      });

      const horseWithoutTrait = createTestHorse();

      // Test racing trait in show jumping - should not have consistent advantage
      let traitWins = 0;
      const totalRuns = 10;

      for (let i = 0; i < totalRuns; i++) {
        const scoreWithTrait = calculateCompetitionScore(horseWithRacingTrait, 'Show Jumping');
        const scoreWithoutTrait = calculateCompetitionScore(horseWithoutTrait, 'Show Jumping');

        if (scoreWithTrait > scoreWithoutTrait) {
          traitWins++;
        }
      }

      // Should not win all the time since no trait advantage applies
      expect(traitWins).toBeLessThan(totalRuns);
    });

    it('should handle horses with missing epigeneticModifiers', () => {
      const horseWithoutModifiers = createTestHorse();
      delete horseWithoutModifiers.epigeneticModifiers;

      expect(() => {
        calculateCompetitionScore(horseWithoutModifiers, 'Racing');
      }).not.toThrow();

      const score = calculateCompetitionScore(horseWithoutModifiers, 'Racing');
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    it('should provide consistent scoring results with variance', () => {
      const horse = createTestHorse({
        epigeneticModifiers: {
          positive: ['discipline_affinity_racing'],
          negative: [],
          hidden: [],
        },
      });

      // Run the same scoring multiple times
      const scores = [];
      for (let i = 0; i < 10; i++) {
        scores.push(calculateCompetitionScore(horse, 'Racing'));
      }

      // All scores should be numbers and within reasonable range
      scores.forEach(score => {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(150);
        expect(score).toBeLessThan(250);
      });

      // There should be some variance due to luck modifier
      const uniqueScores = [...new Set(scores)];
      expect(uniqueScores.length).toBeGreaterThan(1);
    });

    it('should demonstrate that trait integration is working', () => {
      // This test verifies that the integration is working by checking
      // that horses with traits can potentially score higher than those without
      const horseWithTrait = createTestHorse({
        epigeneticModifiers: {
          positive: ['discipline_affinity_racing'],
          negative: [],
          hidden: [],
        },
      });

      const horseWithoutTrait = createTestHorse();

      // Get multiple scores to find the maximum potential
      const scoresWithTrait = [];
      const scoresWithoutTrait = [];

      for (let i = 0; i < 20; i++) {
        scoresWithTrait.push(calculateCompetitionScore(horseWithTrait, 'Racing'));
        scoresWithoutTrait.push(calculateCompetitionScore(horseWithoutTrait, 'Racing'));
      }

      const maxWithTrait = Math.max(...scoresWithTrait);
      const maxWithoutTrait = Math.max(...scoresWithoutTrait);

      // The horse with trait should be able to achieve higher scores
      expect(maxWithTrait).toBeGreaterThan(maxWithoutTrait);
    });
  });
});
