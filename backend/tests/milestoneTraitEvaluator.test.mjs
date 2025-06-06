/**
 * @fileoverview Comprehensive Tests for Milestone Trait Evaluation System
 *
 * @description
 * Complete test suite for the milestone trait evaluation system, validating trait
 * assignment at ages 1, 2, and 3 based on accumulated task history. Tests net
 * trait influence scoring, epigenetic trait marking, milestone completion tracking,
 * and integration with the existing trait system using TDD methodology.
 *
 * @features
 * - Milestone evaluation logic testing (ages 1, 2, 3)
 * - Net trait influence scoring validation (+1 encourage, -1 discourage)
 * - Trait assignment threshold testing (+3/-3 thresholds)
 * - Epigenetic trait marking verification (before age 3)
 * - Milestone completion tracking and prevention of re-evaluation
 * - Task log processing and scoring accuracy
 * - Duplicate trait prevention testing
 * - Edge case and error handling validation
 * - Integration with existing trait influence system
 *
 * @dependencies
 * - @jest/globals: Testing framework with ES modules support
 * - milestoneTraitEvaluator: Core milestone evaluation functions
 * - taskTraitInfluenceMap: Task-to-trait influence mapping
 * - logger: Winston logger (strategically mocked for test isolation)
 *
 * @usage
 * Run with: npm test -- milestoneTraitEvaluator.test.js
 * Tests standalone milestone evaluation before aging system integration.
 * Validates business logic with balanced mocking approach.
 *
 * @author Equoria Development Team
 * @since 1.2.0
 * @lastModified 2025-01-02 - Initial comprehensive milestone evaluation tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  evaluateTraitMilestones,
  checkMilestoneEligibility,
  getMilestoneSummary,
  calculateTraitScores,
  MILESTONE_AGES,
  TRAIT_THRESHOLDS,
} from '../utils/milestoneTraitEvaluator.mjs';
import { TASK_TRAIT_INFLUENCE_MAP } from '../utils/taskTraitInfluenceMap.mjs';

// Strategic mocking: Only mock external dependencies, not business logic
jest.mock('../utils/logger.mjs', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Milestone Trait Evaluator', () => {
  let testHorse;

  beforeEach(() => {
    // Create fresh test horse for each test
    testHorse = {
      id: 'test-horse-milestone',
      name: 'Test Horse',
      age: 365, // 1 year old
      task_log: [],
      trait_milestones: {},
      epigeneticModifiers: {
        positive: [],
        negative: [],
        hidden: [],
        epigenetic: [],
      },
    };
  });

  describe('evaluateTraitMilestones', () => {
    it('should assign positive trait when encouraged 3+ times at age 1', () => {
      testHorse.task_log = [
        { task: 'brushing', date: '2025-01-01' },
        { task: 'brushing', date: '2025-01-02' },
        { task: 'brushing', date: '2025-01-03' },
      ];

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(true);
      expect(result.milestoneAge).toBe(1);
      expect(result.isEpigenetic).toBe(true);
      expect(result.traitsApplied).toHaveLength(3); // bonded, patient, and resists_aloof from brushing
      expect(result.traitsApplied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'bonded',
            type: 'positive',
            score: 3,
            epigenetic: true,
          }),
          expect.objectContaining({
            name: 'patient',
            type: 'positive',
            score: 3,
            epigenetic: true,
          }),
          expect.objectContaining({
            name: 'resists_aloof',
            type: 'resistance',
            score: -3,
            epigenetic: true,
          }),
        ]),
      );
      expect(result.updatedMilestones.age_1).toBe(true);
    });

    it('should assign resistance trait when discouraged 3+ times at age 2', () => {
      testHorse.age = 730; // 2 years old
      testHorse.task_log = [
        { task: 'brushing', date: '2025-01-01' }, // discourages aloof
        { task: 'brushing', date: '2025-01-02' }, // discourages aloof
        { task: 'brushing', date: '2025-01-03' }, // discourages aloof
      ];

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(true);
      expect(result.milestoneAge).toBe(2);
      expect(result.isEpigenetic).toBe(true);
      expect(result.traitsApplied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'resists_aloof',
            type: 'resistance',
            score: -3,
            epigenetic: true,
          }),
        ]),
      );
    });

    it('should not mark traits as epigenetic at age 3', () => {
      testHorse.age = 1095; // 3 years old
      testHorse.task_log = [
        { task: 'hand_walking', date: '2025-01-01' },
        { task: 'hand_walking', date: '2025-01-02' },
        { task: 'hand_walking', date: '2025-01-03' },
      ];

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(true);
      expect(result.milestoneAge).toBe(3);
      expect(result.isEpigenetic).toBe(false);
      expect(result.traitsApplied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'trusting',
            epigenetic: false,
          }),
          expect.objectContaining({
            name: 'brave',
            epigenetic: false,
          }),
        ]),
      );
    });

    it('should calculate net trait scores correctly with mixed influences', () => {
      testHorse.task_log = [
        { task: 'brushing', date: '2025-01-01' }, // encourages bonded, patient; discourages aloof
        { task: 'brushing', date: '2025-01-02' }, // encourages bonded, patient; discourages aloof
        { task: 'socialization', date: '2025-01-03' }, // encourages affectionate, friendly; discourages aloof
        { task: 'grooming_game', date: '2025-01-04' }, // encourages playful, bonded; discourages independent
      ];

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(true);
      expect(result.traitScores).toEqual({
        bonded: 3, // 2 from brushing + 1 from grooming_game
        patient: 2, // 2 from brushing
        aloof: -3, // -2 from brushing + -1 from socialization
        affectionate: 1, // 1 from socialization
        friendly: 1, // 1 from socialization
        playful: 1, // 1 from grooming_game
        independent: -1, // -1 from grooming_game
      });

      // Should apply bonded (score 3) and resists_aloof (score -3)
      expect(result.traitsApplied).toHaveLength(2);
      expect(result.traitsApplied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'bonded', type: 'positive' }),
          expect.objectContaining({ name: 'resists_aloof', type: 'resistance' }),
        ]),
      );
    });

    it('should not evaluate if already completed for that milestone', () => {
      testHorse.trait_milestones = { age_1: true };

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('already_evaluated');
      expect(result.evaluationPerformed).toBe(false);
    });

    it('should not evaluate if not a milestone age', () => {
      testHorse.age = 200; // Less than 1 year (365 days)

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('not_milestone_age');
      expect(result.evaluationPerformed).toBe(false);
    });

    it('should handle empty task log gracefully', () => {
      testHorse.task_log = [];

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(true);
      expect(result.traitsApplied).toHaveLength(0);
      expect(result.traitScores).toEqual({});
      expect(result.updatedMilestones.age_1).toBe(true);
    });

    it('should handle task log with unknown tasks', () => {
      testHorse.task_log = [
        { task: 'unknown_task', date: '2025-01-01' },
        { task: 'brushing', date: '2025-01-02' },
        { task: 'invalid_task', date: '2025-01-03' },
      ];

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(true);
      // Should only process the valid 'brushing' task
      expect(result.traitScores).toEqual({
        bonded: 1,
        patient: 1,
        aloof: -1,
      });
    });

    it('should prevent duplicate trait assignment', () => {
      // Set up horse with existing bonded trait
      testHorse.epigeneticModifiers.positive = ['bonded'];
      testHorse.task_log = [
        { task: 'brushing', date: '2025-01-01' },
        { task: 'brushing', date: '2025-01-02' },
        { task: 'brushing', date: '2025-01-03' },
      ];

      const result = evaluateTraitMilestones(testHorse);

      expect(result.success).toBe(true);
      // Should apply patient but not bonded (already exists)
      expect(result.traitsApplied).toHaveLength(2); // patient and resists_aloof
      expect(result.traitsApplied.map(t => t.name)).not.toContain('bonded');
    });
  });

  describe('calculateTraitScores', () => {
    it('should calculate correct scores for single task type', () => {
      const taskLog = [{ task: 'brushing' }, { task: 'brushing' }, { task: 'brushing' }];

      const scores = calculateTraitScores(taskLog);

      expect(scores).toEqual({
        bonded: 3,
        patient: 3,
        aloof: -3,
      });
    });

    it('should calculate net scores for mixed task types', () => {
      const taskLog = [
        { task: 'brushing' }, // bonded +1, patient +1, aloof -1
        { task: 'socialization' }, // affectionate +1, friendly +1, aloof -1
        { task: 'hand_walking' }, // trusting +1, brave +1, nervous -1
      ];

      const scores = calculateTraitScores(taskLog);

      expect(scores).toEqual({
        bonded: 1,
        patient: 1,
        aloof: -2,
        affectionate: 1,
        friendly: 1,
        trusting: 1,
        brave: 1,
        nervous: -1,
      });
    });

    it('should handle empty task log', () => {
      const scores = calculateTraitScores([]);
      expect(scores).toEqual({});
    });

    it('should ignore unknown tasks', () => {
      const taskLog = [{ task: 'unknown_task' }, { task: 'brushing' }, { task: 'invalid_task' }];

      const scores = calculateTraitScores(taskLog);

      expect(scores).toEqual({
        bonded: 1,
        patient: 1,
        aloof: -1,
      });
    });
  });

  describe('checkMilestoneEligibility', () => {
    it('should return eligible for milestone age without completion', () => {
      const eligibility = checkMilestoneEligibility(testHorse);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.milestoneAge).toBe(1);
      expect(eligibility.isMilestoneAge).toBe(true);
      expect(eligibility.alreadyEvaluated).toBeFalsy();
    });

    it('should return not eligible if already evaluated', () => {
      testHorse.trait_milestones = { age_1: true };

      const eligibility = checkMilestoneEligibility(testHorse);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.alreadyEvaluated).toBe(true);
    });

    it('should return not eligible for non-milestone age', () => {
      testHorse.age = 200; // Less than 1 year (365 days)

      const eligibility = checkMilestoneEligibility(testHorse);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.isMilestoneAge).toBe(false);
    });
  });

  describe('getMilestoneSummary', () => {
    it('should return correct summary for horse with completed milestones', () => {
      testHorse.age = 1095; // 3 years old
      testHorse.trait_milestones = {
        age_1: true,
        age_2: true,
      };

      const summary = getMilestoneSummary(testHorse);

      expect(summary.currentAge).toBe(3);
      expect(summary.completedMilestones).toEqual(['age_1', 'age_2']);
      expect(summary.pendingMilestones).toEqual(['age_3']);
      expect(summary.nextMilestone).toBeUndefined();
      expect(summary.allMilestonesComplete).toBe(false);
    });

    it('should return correct summary for horse with all milestones complete', () => {
      testHorse.age = 1460; // 4 years old
      testHorse.trait_milestones = {
        age_1: true,
        age_2: true,
        age_3: true,
      };

      const summary = getMilestoneSummary(testHorse);

      expect(summary.currentAge).toBe(4);
      expect(summary.completedMilestones).toEqual(['age_1', 'age_2', 'age_3']);
      expect(summary.pendingMilestones).toEqual([]);
      expect(summary.nextMilestone).toBeUndefined();
      expect(summary.allMilestonesComplete).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should have correct milestone ages defined', () => {
      expect(MILESTONE_AGES).toEqual([1, 2, 3]);
    });

    it('should have correct trait thresholds defined', () => {
      expect(TRAIT_THRESHOLDS.POSITIVE_THRESHOLD).toBe(3);
      expect(TRAIT_THRESHOLDS.NEGATIVE_THRESHOLD).toBe(-3);
    });

    it('should have valid task trait influence map', () => {
      expect(TASK_TRAIT_INFLUENCE_MAP).toBeDefined();
      expect(typeof TASK_TRAIT_INFLUENCE_MAP).toBe('object');

      // Verify structure of influence map
      Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([_task, influence]) => {
        expect(influence).toHaveProperty('encourages');
        expect(influence).toHaveProperty('discourages');
        expect(Array.isArray(influence.encourages)).toBe(true);
        expect(Array.isArray(influence.discourages)).toBe(true);
      });
    });
  });
});
