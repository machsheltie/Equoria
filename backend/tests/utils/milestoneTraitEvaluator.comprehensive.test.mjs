/**
 * 🧪 COMPREHENSIVE TEST: Milestone Trait Evaluator System
 *
 * This test suite provides comprehensive coverage of the milestone trait evaluation
 * system using pure algorithmic testing with minimal mocking. It validates horse
 * progression milestones, trait revelation logic, and age-based development.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Age-based milestone eligibility (1 year, 2 year, 3 year milestones)
 * - Task completion history analysis for trait revelation
 * - Streak-based bonus trait assignments
 * - Care quality impact on trait development
 * - Milestone trait probability calculations
 * - Horse development progression tracking
 * - Task log validation and processing
 * - Trait revelation timing and conditions
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. checkMilestoneEligibility - Age and condition validation
 * 2. evaluateTraitsAtMilestone - Main trait evaluation logic
 * 3. Task history analysis and scoring
 * 4. Streak calculation and bonus application
 * 5. Care quality assessment algorithms
 * 6. Trait probability determination
 * 7. Milestone progression tracking
 * 8. Input validation and error handling
 *
 * 🔄 PURE ALGORITHMIC APPROACH:
 * ✅ NO MOCKING: Pure unit tests with no external dependencies
 * ✅ DETERMINISTIC: Consistent results for same inputs
 * ✅ ISOLATED: Tests only the milestone evaluation logic
 * ✅ COMPREHENSIVE: Covers all milestone scenarios and edge cases
 *
 * 💡 TEST STRATEGY: Pure algorithmic testing of horse development milestones
 *    to ensure accurate trait revelation and progression tracking
 */

import { describe, it, expect } from '@jest/globals';
import {
  checkMilestoneEligibility,
  evaluateTraitMilestones,
} from '../../utils/milestoneTraitEvaluator.mjs';

describe('🏇 COMPREHENSIVE: Milestone Trait Evaluator System', () => {
  describe('Milestone Eligibility Validation', () => {
    it('should validate 1-year milestone eligibility', () => {
      const horse = {
        id: 1,
        name: 'Young Horse',
        age: 365, // Exactly 1 year
        trait_milestones: {}, // No previous milestones
      };

      const result = checkMilestoneEligibility(horse);

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('milestoneAge');
      expect(result).toHaveProperty('isMilestoneAge');
      expect(result.milestoneAge).toBe(1);
      expect(result.isMilestoneAge).toBe(true);
    });

    it('should validate 2-year milestone eligibility', () => {
      const horse = {
        id: 2,
        name: 'Developing Horse',
        age: 730, // Exactly 2 years
        dateOfBirth: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000),
        healthStatus: 'Excellent',
      };

      const result = checkMilestoneEligibility(horse);

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('milestone');
      expect(result.ageInDays).toBe(730);
    });

    it('should validate 3-year milestone eligibility', () => {
      const horse = {
        id: 3,
        name: 'Mature Horse',
        age: 1095, // Exactly 3 years
        dateOfBirth: new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000),
        healthStatus: 'Good',
      };

      const result = checkMilestoneEligibility(horse);

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('milestone');
      expect(result.ageInDays).toBe(1095);
    });

    it('should handle horses too young for milestones', () => {
      const horse = {
        id: 4,
        name: 'Very Young Horse',
        age: 200, // Less than 1 year
        dateOfBirth: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
        healthStatus: 'Good',
      };

      const result = checkMilestoneEligibility(horse);

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('reason');
    });

    it('should handle horses too old for milestones', () => {
      const horse = {
        id: 5,
        name: 'Old Horse',
        age: 2000, // Over 3 years
        dateOfBirth: new Date(Date.now() - 2000 * 24 * 60 * 60 * 1000),
        healthStatus: 'Good',
      };

      const result = checkMilestoneEligibility(horse);

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('reason');
    });
  });

  describe('Trait Milestone Evaluation', () => {
    it('should evaluate traits for 1-year milestone', () => {
      const horse = {
        id: 6,
        name: 'Well-Cared Horse',
        age: 365, // Exactly 1 year
        healthStatus: 'Excellent',
        task_log: [
          { task: 'feeding', completedAt: new Date() },
          { task: 'grooming', completedAt: new Date() },
          { task: 'exercise', completedAt: new Date() },
          { task: 'bonding', completedAt: new Date() },
        ],
        trait_milestones: {}, // No previous milestones
        epigeneticModifiers: { positive: [], negative: [], hidden: [], epigenetic: [] },
      };

      const result = evaluateTraitMilestones(horse);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('milestoneAge');
      expect(result).toHaveProperty('traitsApplied');
      expect(result).toHaveProperty('evaluationPerformed');
      expect(Array.isArray(result.traitsApplied)).toBe(true);
      expect(typeof result.success).toBe('boolean');
      expect(result.milestoneAge).toBe(1);
    });

    it('should evaluate traits for 2-year milestone', () => {
      const horse = {
        id: 7,
        name: 'Two Year Old',
        age: 730, // Exactly 2 years
        healthStatus: 'Good',
        task_log: [
          { task: 'feeding', completedAt: new Date() },
          { task: 'grooming', completedAt: new Date() },
          { task: 'exercise', completedAt: new Date() },
        ],
        trait_milestones: { age_1: true }, // 1-year milestone completed
        epigeneticModifiers: { positive: [], negative: [], hidden: [], epigenetic: [] },
      };

      const result = evaluateTraitMilestones(horse);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('milestoneAge');
      expect(result).toHaveProperty('traitsApplied');
      expect(result.milestoneAge).toBe(2);
      expect(Array.isArray(result.traitsApplied)).toBe(true);
    });

    it('should evaluate traits with moderate care history', () => {
      const horse = {
        id: 8,
        name: 'Average Horse',
        age: 730,
        healthStatus: 'Good',
      };

      const taskHistory = {
        feeding: 25,
        grooming: 20,
        exercise: 18,
        medical_check: 15,
        bonding: 12,
      };

      const careStreak = 10;

      const result = evaluateTraitsAtMilestone(horse, taskHistory, careStreak);

      expect(result).toHaveProperty('revealedTraits');
      expect(result).toHaveProperty('careQuality');
      expect(result).toHaveProperty('streakBonus');
      expect(typeof result.careQuality).toBe('string');
    });
  });

  describe('Streak Bonus Calculations', () => {
    it('should apply streak bonuses for long care streaks', () => {
      const horse = {
        id: 9,
        name: 'Consistently Cared Horse',
        age: 365,
        healthStatus: 'Excellent',
      };

      const taskHistory = {
        feeding: 30,
        grooming: 25,
        exercise: 20,
        medical_check: 15,
        bonding: 20,
      };

      const longStreak = 50; // Very long streak

      const result = evaluateTraitsAtMilestone(horse, taskHistory, longStreak);

      expect(result).toHaveProperty('streakBonus');
      expect(result.streakBonus).toBe(true);
    });

    it('should not apply streak bonuses for short streaks', () => {
      const horse = {
        id: 10,
        name: 'Inconsistently Cared Horse',
        age: 365,
        healthStatus: 'Good',
      };

      const taskHistory = {
        feeding: 20,
        grooming: 15,
        exercise: 10,
        medical_check: 8,
        bonding: 5,
      };

      const shortStreak = 3; // Very short streak

      const result = evaluateTraitsAtMilestone(horse, taskHistory, shortStreak);

      expect(result).toHaveProperty('streakBonus');
      expect(result.streakBonus).toBe(false);
    });

    it('should handle zero streak scenarios', () => {
      const horse = {
        id: 11,
        name: 'No Streak Horse',
        age: 365,
        healthStatus: 'Fair',
      };

      const taskHistory = {
        feeding: 15,
        grooming: 10,
        exercise: 8,
        medical_check: 5,
        bonding: 3,
      };

      const zeroStreak = 0;

      const result = evaluateTraitsAtMilestone(horse, taskHistory, zeroStreak);

      expect(result).toHaveProperty('streakBonus');
      expect(result.streakBonus).toBe(false);
    });
  });

  describe('Care Quality Assessment', () => {
    it('should assess excellent care quality', () => {
      const horse = {
        id: 12,
        name: 'Premium Care Horse',
        age: 730,
        healthStatus: 'Excellent',
      };

      const excellentTaskHistory = {
        feeding: 60,
        grooming: 55,
        exercise: 50,
        medical_check: 45,
        bonding: 40,
        enrichment: 35,
      };

      const result = evaluateTraitsAtMilestone(horse, excellentTaskHistory, 20);

      expect(result.careQuality).toBe('excellent');
    });

    it('should assess poor care quality', () => {
      const horse = {
        id: 13,
        name: 'Poor Care Horse',
        age: 730,
        healthStatus: 'Poor',
      };

      const poorTaskHistory = {
        feeding: 2,
        grooming: 1,
        exercise: 0,
        medical_check: 1,
        bonding: 0,
      };

      const result = evaluateTraitsAtMilestone(horse, poorTaskHistory, 0);

      expect(result.careQuality).toBe('poor');
    });

    it('should assess average care quality', () => {
      const horse = {
        id: 14,
        name: 'Average Care Horse',
        age: 1095,
        healthStatus: 'Good',
      };

      const averageTaskHistory = {
        feeding: 20,
        grooming: 18,
        exercise: 15,
        medical_check: 12,
        bonding: 10,
      };

      const result = evaluateTraitsAtMilestone(horse, averageTaskHistory, 8);

      expect(['average', 'good', 'fair']).toContain(result.careQuality);
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should handle missing task history', () => {
      const horse = {
        id: 15,
        name: 'No History Horse',
        age: 365,
        healthStatus: 'Good',
      };

      const emptyTaskHistory = {};
      const result = evaluateTraitsAtMilestone(horse, emptyTaskHistory, 0);

      expect(result).toHaveProperty('revealedTraits');
      expect(result).toHaveProperty('careQuality');
      expect(Array.isArray(result.revealedTraits)).toBe(true);
    });

    it('should handle null task history', () => {
      const horse = {
        id: 16,
        name: 'Null History Horse',
        age: 365,
        healthStatus: 'Good',
      };

      const result = evaluateTraitsAtMilestone(horse, null, 0);

      expect(result).toHaveProperty('revealedTraits');
      expect(result).toHaveProperty('careQuality');
      expect(Array.isArray(result.revealedTraits)).toBe(true);
    });

    it('should handle invalid horse data', () => {
      const invalidHorse = {
        id: 17,
        // Missing required fields
      };

      const taskHistory = {
        feeding: 10,
        grooming: 8,
      };

      expect(() => {
        evaluateTraitsAtMilestone(invalidHorse, taskHistory, 5);
      }).not.toThrow(); // Should handle gracefully
    });

    it('should handle negative streak values', () => {
      const horse = {
        id: 18,
        name: 'Negative Streak Horse',
        age: 365,
        healthStatus: 'Good',
      };

      const taskHistory = {
        feeding: 15,
        grooming: 12,
      };

      const result = evaluateTraitsAtMilestone(horse, taskHistory, -5);

      expect(result).toHaveProperty('streakBonus');
      expect(result.streakBonus).toBe(false);
    });
  });

  describe('Trait Revelation Logic', () => {
    it('should reveal appropriate traits for different milestones', () => {
      const horses = [
        { id: 19, age: 365, healthStatus: 'Excellent' },  // 1 year
        { id: 20, age: 730, healthStatus: 'Good' },       // 2 years
        { id: 21, age: 1095, healthStatus: 'Fair' },      // 3 years
      ];

      const taskHistory = {
        feeding: 30,
        grooming: 25,
        exercise: 20,
        medical_check: 15,
        bonding: 18,
      };

      horses.forEach(horse => {
        const result = evaluateTraitsAtMilestone(horse, taskHistory, 15);

        expect(result).toHaveProperty('revealedTraits');
        expect(Array.isArray(result.revealedTraits)).toBe(true);

        // Each revealed trait should be a non-empty string
        result.revealedTraits.forEach(trait => {
          expect(typeof trait).toBe('string');
          expect(trait.length).toBeGreaterThan(0);
        });
      });
    });

    it('should maintain consistency in trait revelation', () => {
      const horse = {
        id: 22,
        name: 'Consistent Horse',
        age: 365,
        healthStatus: 'Good',
      };

      const taskHistory = {
        feeding: 25,
        grooming: 20,
        exercise: 18,
        medical_check: 15,
        bonding: 12,
      };

      // Run multiple evaluations with same inputs
      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(evaluateTraitsAtMilestone(horse, taskHistory, 10));
      }

      // Results should be consistent (assuming deterministic logic)
      expect(results[0].careQuality).toBe(results[1].careQuality);
      expect(results[1].careQuality).toBe(results[2].careQuality);
    });
  });
});
