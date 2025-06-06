/**
 * Foal Task Exclusivity Integration Test
 * Tests the integration between groomConfig task categories and groomSystem daily exclusivity
 *
 * 🎯 FEATURES TESTED:
 * - Daily task exclusivity enforcement for foals
 * - Integration between ELIGIBLE_FOAL_ENRICHMENT_TASKS and FOAL_GROOMING_TASKS
 * - Real task category validation with actual configuration
 * - Edge cases and business rule enforcement
 *
 * 🔧 DEPENDENCIES:
 * - groomConfig.mjs  (task category definitions)
 * - groomSystem.mjs (daily exclusivity function)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Foals can only complete ONE task per day from either category
 * - Enrichment tasks: desensitization, trust_building, showground_exposure
 * - Grooming tasks: early_touch, hoof_handling, tying_practice, sponge_bath, coat_check, mane_tail_grooming
 * - Non-foal tasks don't count toward daily limit
 * - Proper integration between configuration and validation logic
 *
 * 🧪 TESTING APPROACH:
 * - Mock: None (testing real integration)
 * - Real: All configuration values, task arrays, validation logic
 */

import { describe, it, expect } from '@jest/globals';
import { ELIGIBLE_FOAL_ENRICHMENT_TASKS, FOAL_GROOMING_TASKS } from '../config/groomConfig.mjs';
import { hasAlreadyCompletedFoalTaskToday } from '../utils/groomSystem.mjs';

describe('Foal Task Exclusivity Integration', () => {
  const today = '2024-01-15';

  describe('Configuration Integration', () => {
    it('should have correct task categories defined', () => {
      // Verify enrichment tasks
      expect(ELIGIBLE_FOAL_ENRICHMENT_TASKS).toEqual([
        'desensitization',
        'trust_building',
        'showground_exposure',
      ]);

      // Verify grooming tasks
      expect(FOAL_GROOMING_TASKS).toEqual([
        'early_touch',
        'hoof_handling',
        'tying_practice',
        'sponge_bath',
        'coat_check',
        'mane_tail_grooming',
      ]);
    });

    it('should have no overlap between task categories', () => {
      const enrichmentSet = new Set(ELIGIBLE_FOAL_ENRICHMENT_TASKS);
      const groomingSet = new Set(FOAL_GROOMING_TASKS);

      const intersection = [...enrichmentSet].filter(task => groomingSet.has(task));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Daily Exclusivity Enforcement', () => {
    it('should detect all enrichment tasks correctly', () => {
      ELIGIBLE_FOAL_ENRICHMENT_TASKS.forEach(task => {
        const foal = {
          id: 1,
          name: 'Test Foal',
          dailyTaskRecord: {
            [today]: [task],
          },
        };

        const result = hasAlreadyCompletedFoalTaskToday(foal, today);
        expect(result).toBe(true);
      });
    });

    it('should detect all grooming tasks correctly', () => {
      FOAL_GROOMING_TASKS.forEach(task => {
        const foal = {
          id: 1,
          name: 'Test Foal',
          dailyTaskRecord: {
            [today]: [task],
          },
        };

        const result = hasAlreadyCompletedFoalTaskToday(foal, today);
        expect(result).toBe(true);
      });
    });

    it('should enforce mutual exclusivity between categories', () => {
      // Test enrichment task blocks grooming task
      const foalWithEnrichment = {
        id: 1,
        name: 'Test Foal',
        dailyTaskRecord: {
          [today]: ['trust_building'],
        },
      };

      expect(hasAlreadyCompletedFoalTaskToday(foalWithEnrichment, today)).toBe(true);

      // Test grooming task blocks enrichment task
      const foalWithGrooming = {
        id: 2,
        name: 'Test Foal 2',
        dailyTaskRecord: {
          [today]: ['hoof_handling'],
        },
      };

      expect(hasAlreadyCompletedFoalTaskToday(foalWithGrooming, today)).toBe(true);
    });

    it('should allow non-foal tasks without blocking', () => {
      const foalWithGeneralTasks = {
        id: 1,
        name: 'Test Foal',
        dailyTaskRecord: {
          [today]: ['general_grooming', 'exercise', 'medical_check', 'feeding'],
        },
      };

      const result = hasAlreadyCompletedFoalTaskToday(foalWithGeneralTasks, today);
      expect(result).toBe(false);
    });

    it('should detect foal tasks mixed with general tasks', () => {
      const foalWithMixedTasks = {
        id: 1,
        name: 'Test Foal',
        dailyTaskRecord: {
          [today]: ['general_grooming', 'trust_building', 'exercise'],
        },
      };

      const result = hasAlreadyCompletedFoalTaskToday(foalWithMixedTasks, today);
      expect(result).toBe(true);
    });
  });

  describe('Business Rule Validation', () => {
    it('should prevent double-counting with multiple foal tasks', () => {
      const foalWithMultipleFoalTasks = {
        id: 1,
        name: 'Test Foal',
        dailyTaskRecord: {
          [today]: ['trust_building', 'hoof_handling', 'desensitization'],
        },
      };

      // Should return true (blocked) because foal already has foal tasks today
      const result = hasAlreadyCompletedFoalTaskToday(foalWithMultipleFoalTasks, today);
      expect(result).toBe(true);
    });

    it('should work correctly across different days', () => {
      const foal = {
        id: 1,
        name: 'Test Foal',
        dailyTaskRecord: {
          '2024-01-14': ['trust_building'],
          '2024-01-15': [], // Today - empty
          '2024-01-16': ['hoof_handling'],
        },
      };

      // Should allow interaction today since no foal tasks completed today
      const result = hasAlreadyCompletedFoalTaskToday(foal, '2024-01-15');
      expect(result).toBe(false);

      // Should block on other days
      expect(hasAlreadyCompletedFoalTaskToday(foal, '2024-01-14')).toBe(true);
      expect(hasAlreadyCompletedFoalTaskToday(foal, '2024-01-16')).toBe(true);
    });

    it('should handle real-world task progression scenario', () => {
      const foal = {
        id: 1,
        name: 'Test Foal',
        dailyTaskRecord: {
          '2024-01-10': ['trust_building'],
          '2024-01-11': ['desensitization'],
          '2024-01-12': ['hoof_handling'],
          '2024-01-13': ['early_touch'],
          '2024-01-14': ['general_grooming'], // Non-foal task
          [today]: [], // Today - ready for new task
        },
      };

      // Should allow new foal task today
      expect(hasAlreadyCompletedFoalTaskToday(foal, today)).toBe(false);

      // Should block on previous days with foal tasks
      expect(hasAlreadyCompletedFoalTaskToday(foal, '2024-01-10')).toBe(true);
      expect(hasAlreadyCompletedFoalTaskToday(foal, '2024-01-11')).toBe(true);
      expect(hasAlreadyCompletedFoalTaskToday(foal, '2024-01-12')).toBe(true);
      expect(hasAlreadyCompletedFoalTaskToday(foal, '2024-01-13')).toBe(true);

      // Should allow on day with only general tasks
      expect(hasAlreadyCompletedFoalTaskToday(foal, '2024-01-14')).toBe(false);
    });
  });
});
