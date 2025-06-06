/**
 * Foal Task Logging & Streak Tracking System Test Suite
 * Tests for foal-specific task logging, streak tracking, and mutual exclusivity
 *
 * 🎯 FEATURES TESTED:
 * - Age-based task eligibility (0-2 enrichment, 1-3 grooming, 3+ general)
 * - Task logging system (JSON format frequency tracking)
 * - Streak tracking with grace period logic
 * - Mutual exclusivity (one enrichment OR one grooming task per day)
 * - Task category classification and validation
 * - Progressive age-based task availability
 *
 * 🔧 DEPENDENCIES:
 * - groomBondingSystem.mjs (task validation and processing)
 * - groomConfig.mjs (task definitions and age thresholds)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Ages 0-2: Enrichment tasks only (epigenetic trait development)
 * - Ages 1-3: Both enrichment AND grooming tasks (overlap phase)
 * - Ages 3+: All tasks (enrichment + foal grooming + general grooming)
 * - Daily mutual exclusivity: One enrichment OR one grooming task per day
 * - Task logging: JSON format {task_name: count} for trait evaluation
 * - Streak tracking: 2-day grace period, +10% bonus for 7 consecutive days
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Database operations, date/time functions
 * - Real: Business logic, age calculations, task categorization, logging logic
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateGroomingEligibility,
  // TODO: Will use getEligibleTasksForAge in future tests
  // getEligibleTasksForAge,
  categorizeTask,
  updateTaskLog,
  updateStreakTracking,
  checkTaskMutualExclusivity,
} from '../utils/groomBondingSystem.mjs';
import { GROOM_CONFIG } from '../config/groomConfig.mjs';

describe('Foal Task Logging & Streak Tracking System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Task Category Configuration', () => {
    it('should have foal enrichment tasks defined', () => {
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toBeDefined();
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('desensitization');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('trust_building');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('showground_exposure');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('early_touch');
    });

    it('should have foal grooming tasks defined', () => {
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toBeDefined();
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('hoof_handling');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('tying_practice');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('sponge_bath');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('coat_check');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS).toContain('mane_tail_grooming');
    });

    it('should have general grooming tasks defined', () => {
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toBeDefined();
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('brushing');
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('hand-walking');
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('stall_care');
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('bathing');
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('mane_tail_trim');
    });

    it('should have proper age thresholds configured', () => {
      expect(GROOM_CONFIG.FOAL_ENRICHMENT_MAX_AGE).toBe(2);
      expect(GROOM_CONFIG.FOAL_GROOMING_MIN_AGE).toBe(1);
      expect(GROOM_CONFIG.FOAL_GROOMING_MAX_AGE).toBe(3);
      expect(GROOM_CONFIG.GENERAL_GROOMING_MIN_AGE).toBe(3);
    });
  });

  describe('Age-Based Task Eligibility', () => {
    it('should allow only enrichment tasks for 0-2 year olds', async () => {
      const youngFoal = { id: 1, age: 365, bondScore: 10 }; // 1 year old

      // Should allow enrichment tasks
      const enrichmentResult = await validateGroomingEligibility(youngFoal, 'trust_building');
      expect(enrichmentResult.eligible).toBe(true);
      expect(enrichmentResult.taskType).toBe('enrichment');

      // Should reject grooming tasks for horses under 1 year
      const zeroYearOld = { id: 2, age: 180, bondScore: 5 }; // 6 months old
      const groomingResult = await validateGroomingEligibility(zeroYearOld, 'hoof_handling');
      expect(groomingResult.eligible).toBe(false);
    });

    it('should allow both enrichment and grooming tasks for 1-3 year olds', async () => {
      const overlapAgeFoal = { id: 3, age: 730, bondScore: 20 }; // 2 years old

      // Should allow enrichment tasks
      const enrichmentResult = await validateGroomingEligibility(overlapAgeFoal, 'desensitization');
      expect(enrichmentResult.eligible).toBe(true);
      expect(enrichmentResult.taskType).toBe('enrichment');

      // Should allow foal grooming tasks
      const groomingResult = await validateGroomingEligibility(overlapAgeFoal, 'hoof_handling');
      expect(groomingResult.eligible).toBe(true);
      expect(groomingResult.taskType).toBe('grooming');
    });

    it('should allow all task types for 3+ year olds', async () => {
      const adultHorse = { id: 4, age: 1460, bondScore: 50 }; // 4 years old

      // Should allow enrichment tasks
      const enrichmentResult = await validateGroomingEligibility(adultHorse, 'trust_building');
      expect(enrichmentResult.eligible).toBe(true);

      // Should allow foal grooming tasks
      const foalGroomingResult = await validateGroomingEligibility(adultHorse, 'hoof_handling');
      expect(foalGroomingResult.eligible).toBe(true);

      // Should allow general grooming tasks
      const generalGroomingResult = await validateGroomingEligibility(adultHorse, 'brushing');
      expect(generalGroomingResult.eligible).toBe(true);
    });
  });

  describe('Task Categorization', () => {
    it('should correctly categorize enrichment tasks', () => {
      expect(categorizeTask('trust_building')).toBe('enrichment');
      expect(categorizeTask('desensitization')).toBe('enrichment');
      expect(categorizeTask('showground_exposure')).toBe('enrichment');
      expect(categorizeTask('early_touch')).toBe('enrichment');
    });

    it('should correctly categorize grooming tasks', () => {
      expect(categorizeTask('hoof_handling')).toBe('grooming');
      expect(categorizeTask('tying_practice')).toBe('grooming');
      expect(categorizeTask('sponge_bath')).toBe('grooming');
      expect(categorizeTask('brushing')).toBe('grooming');
      expect(categorizeTask('bathing')).toBe('grooming');
    });

    it('should return null for unknown tasks', () => {
      expect(categorizeTask('unknown_task')).toBeNull();
      expect(categorizeTask('')).toBeNull();
      expect(categorizeTask(null)).toBeNull();
    });
  });

  describe('Task Logging System', () => {
    it('should initialize empty task log', () => {
      const result = updateTaskLog(null, 'trust_building');
      expect(result.taskLog).toEqual({ trust_building: 1 });
      expect(result.totalTasks).toBe(1);
    });

    it('should increment existing task count', () => {
      const existingLog = { trust_building: 3, hoof_handling: 1 };
      const result = updateTaskLog(existingLog, 'trust_building');
      expect(result.taskLog).toEqual({ trust_building: 4, hoof_handling: 1 });
      expect(result.totalTasks).toBe(5);
    });

    it('should add new task to existing log', () => {
      const existingLog = { trust_building: 2 };
      const result = updateTaskLog(existingLog, 'desensitization');
      expect(result.taskLog).toEqual({ trust_building: 2, desensitization: 1 });
      expect(result.totalTasks).toBe(3);
    });

    it('should handle empty object task log', () => {
      const result = updateTaskLog({}, 'hoof_handling');
      expect(result.taskLog).toEqual({ hoof_handling: 1 });
      expect(result.totalTasks).toBe(1);
    });
  });

  describe('Streak Tracking System', () => {
    it('should start new streak for first grooming', () => {
      const today = new Date('2024-01-15');
      const result = updateStreakTracking(null, today);

      expect(result.consecutiveDays).toBe(1);
      expect(result.lastGroomed).toEqual(today);
      expect(result.streakBroken).toBe(false);
      expect(result.bonusEligible).toBe(false);
    });

    it('should increment streak for consecutive days', () => {
      const lastGroomed = new Date('2024-01-14');
      const today = new Date('2024-01-15');
      const result = updateStreakTracking(lastGroomed, today, 3);

      expect(result.consecutiveDays).toBe(4);
      expect(result.lastGroomed).toEqual(today);
      expect(result.streakBroken).toBe(false);
    });

    it('should maintain streak within grace period', () => {
      const lastGroomed = new Date('2024-01-13'); // 2 days ago
      const today = new Date('2024-01-15');
      const result = updateStreakTracking(lastGroomed, today, 5);

      expect(result.consecutiveDays).toBe(6); // Increment from 5
      expect(result.streakBroken).toBe(false);
      expect(result.withinGracePeriod).toBe(true);
    });

    it('should reset streak after grace period expires', () => {
      const lastGroomed = new Date('2024-01-12'); // 3 days ago (beyond grace period)
      const today = new Date('2024-01-15');
      const result = updateStreakTracking(lastGroomed, today, 6);

      expect(result.consecutiveDays).toBe(1); // Reset to 1
      expect(result.streakBroken).toBe(true);
      expect(result.withinGracePeriod).toBe(false);
    });

    it('should detect bonus eligibility at 7 consecutive days', () => {
      const lastGroomed = new Date('2024-01-14');
      const today = new Date('2024-01-15');
      const result = updateStreakTracking(lastGroomed, today, 6);

      expect(result.consecutiveDays).toBe(7);
      expect(result.bonusEligible).toBe(true);
      expect(result.bonusPercentage).toBe(10);
    });
  });

  describe('Task Mutual Exclusivity', () => {
    it('should allow first task of the day', () => {
      const result = checkTaskMutualExclusivity(null, 'trust_building');
      expect(result.allowed).toBe(true);
      expect(result.conflict).toBe(false);
    });

    it('should prevent mixing enrichment and grooming tasks same day', () => {
      const existingTask = 'trust_building'; // enrichment
      const newTask = 'hoof_handling'; // grooming
      const result = checkTaskMutualExclusivity(existingTask, newTask);

      expect(result.allowed).toBe(false);
      expect(result.conflict).toBe(true);
      expect(result.reason).toContain('cannot do both enrichment and grooming');
    });

    it('should allow same category tasks (if other rules permit)', () => {
      const existingTask = 'trust_building'; // enrichment
      const newTask = 'desensitization'; // enrichment
      const result = checkTaskMutualExclusivity(existingTask, newTask);

      expect(result.allowed).toBe(true);
      expect(result.conflict).toBe(false);
      expect(result.sameCategory).toBe(true);
    });
  });
});
