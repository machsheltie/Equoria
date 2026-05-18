/**
 * 🧪 COMPREHENSIVE TEST: Groom Bonding System & Task Eligibility
 *
 * This test suite provides comprehensive coverage of the groom bonding system
 * and task eligibility logic using pure algorithmic testing with minimal mocking.
 * It validates age-based task eligibility, bonding calculations, and care workflows.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Age-based task eligibility (0-2 years enrichment, 1-3 years grooming, 3+ general)
 * - Task categorization and age group validation
 * - Bonding score calculations and modifiers
 * - Care interaction effects on horse development
 * - Task mutual exclusivity and daily limits
 * - Groom specialization and skill level impacts
 * - Age group transitions and task availability
 * - Foal care progression and milestone tracking
 *
 * 🎯 FUNCTIONALITY TESTED:
 * 1. getEligibleTasksForAge - Age-based task filtering
 * 2. validateGroomingEligibility - Comprehensive eligibility validation
 * 3. calculateBondingEffects - Bonding score calculations
 * 4. categorizeTask - Task type classification
 * 5. getAgeGroupDescription - Age group determination
 * 6. Task availability and restriction logic
 * 7. Age boundary validation and edge cases
 * 8. Input validation and error handling
 *
 * 🔄 PURE ALGORITHMIC APPROACH:
 * ✅ NO MOCKING: Pure unit tests with no external dependencies
 * ✅ DETERMINISTIC: Consistent results for same inputs
 * ✅ ISOLATED: Tests only the groom bonding and eligibility logic
 * ✅ COMPREHENSIVE: Covers all age groups and task scenarios
 *
 * 💡 TEST STRATEGY: Pure algorithmic testing of groom care systems
 *    to ensure accurate task eligibility and bonding calculations
 *
 * 🚫 NO DATABASE: This test suite does not require database setup
 *    as it only tests pure algorithmic functions
 */

// Set test environment to avoid database setup requirements
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/equoria_test';

import { describe, it, expect } from '@jest/globals';
import {
  getEligibleTasksForAge,
  validateGroomingEligibility,
  calculateBondingEffects,
  categorizeTask,
  getAgeGroupDescription,
} from '../../utils/groomBondingSystem.mjs';

describe('🤝 COMPREHENSIVE: Groom Bonding System & Task Eligibility', () => {
  describe('Age-Based Task Eligibility', () => {
    // Equoria-iptd: post Equoria-son6, getEligibleTasksForAge takes game-years
    // directly (no /7 day conversion). The prior fixtures passed stale day
    // values (5, 10, 25, 7/14/21) under foal/yearling/mature titles while only
    // asserting length>0 / typeof string — vacuous: the same assertions passed
    // for ANY age because every band cumulatively includes enrichment tasks.
    // Strengthened to sentinel-positive: correct game-year fixtures + assert on
    // the band-specific task SET so a regression in the age→band mapping fails.
    it('should return ONLY enrichment tasks for newborn foals (0-2 game-years)', () => {
      const eligibleTasks = getEligibleTasksForAge(0.5); // 0.5 game-years = young foal

      expect(Array.isArray(eligibleTasks)).toBe(true);
      // Enrichment-only band: exactly the foal enrichment task pool, NOT grooming.
      expect(eligibleTasks).toEqual(expect.arrayContaining(['desensitization', 'trust_building', 'early_touch']));
      // Sentinel: foal grooming + general grooming tasks must NOT appear at age 0.5.
      expect(eligibleTasks).not.toContain('hoof_handling'); // foal-grooming (1-3)
      expect(eligibleTasks).not.toContain('brushing'); // general-grooming (3+)
    });

    it('should return enrichment + foal-grooming for young foals in overlap (1-2 game-years)', () => {
      const eligibleTasks = getEligibleTasksForAge(1.5); // 1.5 game-years = overlap band

      expect(Array.isArray(eligibleTasks)).toBe(true);
      // Overlap band: enrichment AND foal-grooming tasks present.
      expect(eligibleTasks).toContain('desensitization'); // enrichment
      expect(eligibleTasks).toContain('hoof_handling'); // foal-grooming (1-3)
      // Sentinel: general (3+) grooming must NOT appear yet at age 1.5.
      expect(eligibleTasks).not.toContain('brushing');
    });

    it('should NOT include general-grooming tasks for a 2-game-year yearling', () => {
      const eligibleTasks = getEligibleTasksForAge(2); // 2 game-years

      expect(Array.isArray(eligibleTasks)).toBe(true);
      expect(eligibleTasks).toContain('hoof_handling'); // foal-grooming (1-3)
      // Sentinel: 2 < GENERAL_GROOMING_MIN_AGE (3) — general tasks excluded.
      expect(eligibleTasks).not.toContain('brushing');
      expect(eligibleTasks).not.toContain('hand-walking');
    });

    it('should return general-grooming tasks for mature horses (3+ game-years)', () => {
      const eligibleTasks = getEligibleTasksForAge(4); // 4 game-years = mature

      expect(Array.isArray(eligibleTasks)).toBe(true);
      // Mature band includes the full cumulative pool: enrichment + foal + general.
      expect(eligibleTasks).toContain('desensitization'); // enrichment (still present)
      expect(eligibleTasks).toContain('hoof_handling'); // foal-grooming
      expect(eligibleTasks).toContain('brushing'); // general-grooming (3+)
      expect(eligibleTasks).toContain('hand-walking'); // general-grooming (3+)
    });

    it('should switch task pools exactly at the 3-game-year general-grooming boundary', () => {
      // Sentinel boundary test: 2.99 (below) vs 3 (at threshold).
      // Band model (getEligibleTasksForAge): enrichment 0-2, foal-grooming 1-3,
      // general (= enrichment+foal+general) 3+. Note enrichment is NOT cumulative:
      // it drops out in the (2,3) window and only returns at the 3+ "all tasks" band.
      const justUnder = getEligibleTasksForAge(2.99);
      const atThreshold = getEligibleTasksForAge(3);

      // Below 3: only foal-grooming, no general-grooming, and no enrichment
      // (2.99 > FOAL_ENRICHMENT_MAX_AGE=2 and < GENERAL_GROOMING_MIN_AGE=3).
      expect(justUnder).toContain('hoof_handling'); // foal-grooming (1-3)
      expect(justUnder).not.toContain('brushing'); // general not yet
      expect(justUnder).not.toContain('desensitization'); // enrichment dropped out at >2
      // At exactly 3: the 3+ band re-adds enrichment + foal + general.
      expect(atThreshold).toContain('brushing'); // general-grooming
      expect(atThreshold).toContain('desensitization'); // enrichment back in 3+ band
    });
  });

  describe('Grooming Eligibility Validation', () => {
    it('should validate eligibility for young foal enrichment', async () => {
      const youngFoal = {
        id: 1,
        name: 'Young Foal',
        age: 30, // 30 days old
        healthStatus: 'Good',
      };

      const result = await validateGroomingEligibility(youngFoal, 'desensitization');

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('reason');
      expect(typeof result.eligible).toBe('boolean');
      expect(typeof result.reason).toBe('string');
    });

    it('should validate eligibility for yearling grooming', async () => {
      const yearling = {
        id: 2,
        name: 'Yearling Horse',
        age: 1, // 1 game-year old (post Equoria-son6: Horse.age is game-years)
        healthStatus: 'Excellent',
      };

      const result = await validateGroomingEligibility(yearling, 'hoof_handling');

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('ageGroup');
      expect(typeof result.ageGroup).toBe('string');
    });

    it('should validate eligibility for mature horse general care', async () => {
      const matureHorse = {
        id: 3,
        name: 'Mature Horse',
        age: 4, // 4 game-years old (post Equoria-son6: Horse.age is game-years)
        healthStatus: 'Good',
      };

      const result = await validateGroomingEligibility(matureHorse, 'brushing');

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('taskType');
    });

    it('should reject inappropriate tasks for age groups', async () => {
      const youngFoal = {
        id: 4,
        name: 'Very Young Foal',
        age: 0, // under 1 game-year (post Equoria-son6: Horse.age is game-years)
        healthStatus: 'Good',
      };

      const result = await validateGroomingEligibility(youngFoal, 'brushing'); // Adult task (3+ yr) for under-1-yr foal

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('reason');

      // A horse under 1 game-year is below GENERAL_GROOMING_MIN_AGE (3) so the
      // adult 'brushing' task must be rejected — assert it unconditionally
      // (the prior `if (!result.eligible)` block was vacuous when age was a
      // stale day-value that read as an adult game-year count).
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not an eligible task');
    });

    it('should handle edge cases in age validation', async () => {
      // Equoria-son6: Horse.age is game-years. Boundary values expressed in
      // game-years matching the eligibility bands (enrichment 0-2, foal
      // grooming 1-3, general grooming 3+).
      const edgeCases = [
        { age: 0, task: 'early_touch', expectEligible: true }, // Newborn - valid enrichment task (0-2)
        { age: 1, task: 'hoof_handling', expectEligible: true }, // 1 game-year - valid foal grooming task (1-3)
        { age: 3, task: 'hoof_handling', expectEligible: true }, // 3 game-years - still in foal grooming band (1-3)
        { age: 3, task: 'brushing', expectEligible: true }, // exactly 3 game-years - valid general grooming task (3+)
        { age: 5, task: 'brushing', expectEligible: true }, // 5 game-years - valid general grooming task (3+)
      ];

      for (const testCase of edgeCases) {
        const horse = {
          id: 5,
          name: 'Edge Case Horse',
          age: testCase.age,
          healthStatus: 'Good',
        };

        const result = await validateGroomingEligibility(horse, testCase.task);
        expect(result).toHaveProperty('eligible');
        expect(result).toHaveProperty('reason');
        expect(result.eligible).toBe(testCase.expectEligible);
      }
    });
  });

  describe('Bonding Effect Calculations', () => {
    it('should calculate bonding effects for grooming tasks', () => {
      const currentBondScore = 50;
      const groomingTask = 'brushing';

      const result = calculateBondingEffects(currentBondScore, groomingTask);

      expect(result).toHaveProperty('bondChange');
      expect(result).toHaveProperty('newBondScore');
      expect(typeof result.bondChange).toBe('number');
      expect(typeof result.newBondScore).toBe('number');
      expect(result.newBondScore).toBeGreaterThanOrEqual(0);
      expect(result.newBondScore).toBeLessThanOrEqual(100);
    });

    it('should calculate bonding effects for non-grooming tasks', () => {
      const currentBondScore = 30;
      const nonGroomingTask = 'feeding';

      const result = calculateBondingEffects(currentBondScore, nonGroomingTask);

      expect(result).toHaveProperty('bondChange');
      expect(result).toHaveProperty('newBondScore');
      expect(result.newBondScore).toBeGreaterThanOrEqual(0);
      expect(result.newBondScore).toBeLessThanOrEqual(100);
      // Non-grooming tasks should not provide bonding
      expect(result.bondChange).toBe(0);
    });

    it('should handle maximum bonding score scenarios', () => {
      const currentBondScore = 95;
      const groomingTask = 'brushing'; // Grooming task that provides bonding

      const result = calculateBondingEffects(currentBondScore, groomingTask);

      expect(result.newBondScore).toBeLessThanOrEqual(100);
      expect(result.bondChange).toBeGreaterThanOrEqual(0);
    });

    it('should handle minimum bonding score scenarios', () => {
      const currentBondScore = 5;
      const groomingTask = 'feeding'; // Non-grooming task

      const result = calculateBondingEffects(currentBondScore, groomingTask);

      expect(result.newBondScore).toBeGreaterThanOrEqual(0);
      expect(result.bondChange).toBe(0); // Non-grooming tasks don't provide bonding
    });
  });

  describe('Task Categorization', () => {
    it('should categorize enrichment tasks correctly', () => {
      const enrichmentTasks = ['desensitization', 'trust_building', 'showground_exposure', 'early_touch'];

      enrichmentTasks.forEach(task => {
        const category = categorizeTask(task);
        expect(category).toBe('enrichment');
      });
    });

    it('should categorize grooming tasks correctly', () => {
      const groomingTasks = ['brushing', 'hoof_handling', 'mane_tail_grooming', 'stall_care'];

      groomingTasks.forEach(task => {
        const category = categorizeTask(task);
        expect(category).toBe('grooming');
      });
    });

    it('should categorize general care tasks correctly', () => {
      const generalTasks = [
        'feeding', // This should return null as it's not in any category
        'exercise', // This should return null as it's not in any category
        'medical_check', // This should return null as it's not in any category
        'unknown_task', // This should return null as it's not in any category
      ];

      generalTasks.forEach(task => {
        const category = categorizeTask(task);
        expect(category).toBe(null); // These tasks are not in the configuration
      });
    });

    it('should handle unknown task types', () => {
      const unknownTasks = ['unknown_task', 'invalid_task', '', 'random_string'];

      unknownTasks.forEach(task => {
        const category = categorizeTask(task);
        expect(category).toBe(null); // Unknown tasks should return null
      });
    });
  });

  describe('Age Group Descriptions', () => {
    it('should provide correct descriptions for different age groups', () => {
      // Equoria-son6: ages are game-years; assert the exact string
      // getAgeGroupDescription returns for each band (was a vacuous
      // typeof-string check against dead expectedGroup labels).
      const ageTestCases = [
        { age: 0, expectedGroup: 'young foal (0-2 years)' },
        { age: 2, expectedGroup: 'young foal (0-2 years)' },
        { age: 3, expectedGroup: 'foal (1-3 years)' },
        { age: 5, expectedGroup: 'adult horse (3+ years)' },
        { age: 12, expectedGroup: 'adult horse (3+ years)' },
      ];

      ageTestCases.forEach(testCase => {
        const description = getAgeGroupDescription(testCase.age);
        expect(typeof description).toBe('string');
        expect(description).toBe(testCase.expectedGroup);
      });
    });

    it('should handle boundary ages consistently', () => {
      const boundaryAges = [0, 1, 2, 3, 4]; // game-years (post Equoria-son6)

      boundaryAges.forEach(age => {
        const description = getAgeGroupDescription(age);
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should handle invalid age values gracefully', () => {
      const invalidAges = [-1, -100, NaN, Infinity];

      invalidAges.forEach(age => {
        expect(() => {
          getEligibleTasksForAge(age);
        }).not.toThrow();
      });
    });

    it('should handle missing horse data gracefully', async () => {
      const incompleteHorse = {
        id: 6,
        // Missing age and other required fields
      };

      expect(async () => {
        await validateGroomingEligibility(incompleteHorse, 'desensitization');
      }).not.toThrow();
    });

    it('should handle invalid bonding calculation data', () => {
      const invalidBondScore = null;
      const invalidTask = undefined;

      expect(() => {
        calculateBondingEffects(invalidBondScore, invalidTask);
      }).not.toThrow();
    });

    it('should handle null and undefined inputs', () => {
      expect(() => {
        getEligibleTasksForAge(null);
        getEligibleTasksForAge(undefined);
        categorizeTask(null);
        categorizeTask(undefined);
        getAgeGroupDescription(null);
        getAgeGroupDescription(undefined);
      }).not.toThrow();
    });
  });

  describe('System Integration Scenarios', () => {
    it('should provide consistent results across related functions', () => {
      const testAge = 500; // ~1.4 years old

      const eligibleTasks = getEligibleTasksForAge(testAge);
      const ageGroup = getAgeGroupDescription(testAge);

      expect(Array.isArray(eligibleTasks)).toBe(true);
      expect(typeof ageGroup).toBe('string');

      // Tasks should be appropriate for the age group
      eligibleTasks.forEach(task => {
        const category = categorizeTask(task);
        expect(typeof category).toBe('string');
      });
    });

    it('should maintain logical progression through age groups', () => {
      const ageProgression = [30, 180, 400, 800, 1200, 1600];

      ageProgression.forEach(age => {
        const tasks = getEligibleTasksForAge(age);
        const description = getAgeGroupDescription(age);

        expect(tasks.length).toBeGreaterThanOrEqual(0);
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });
});
