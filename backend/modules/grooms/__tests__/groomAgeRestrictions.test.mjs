/**
 * Groom Age Restrictions Test Suite
 * Tests for age-based task eligibility in the groom system
 *
 * 🎯 FEATURES TESTED:
 * - Foal enrichment task eligibility (0-2 years old)
 * - Foal grooming task eligibility (1-3 years old)
 * - Adult grooming task eligibility (3+ years old)
 * - Age threshold validation and boundary conditions
 * - Task pool differentiation by age group
 * - Configuration-driven age restrictions
 *
 * 🔧 DEPENDENCIES:
 * - groomBondingSystem.mjs (validateGroomingEligibility function)
 * - groomConfig.mjs (age thresholds and task definitions)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Young foals (0-2 years): Can receive enrichment tasks for epigenetic development
 * - Foals (1-3 years): Can receive grooming tasks for presentation prep
 * - Adult horses (3+ years): Can receive bonding tasks for burnout prevention
 * - Age boundaries: Exactly 3 years (1095 days) is the transition point
 * - Task separation: Different task pools for different age groups
 *
 * 🧪 TESTING APPROACH:
 * - Mock: None (pure business logic testing)
 * - Real: Age calculations, task eligibility validation, configuration values
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { validateGroomingEligibility } from '../../../utils/groomBondingSystem.mjs';
import { GROOM_CONFIG } from '../../../config/groomConfig.mjs';

describe('Groom Age Restrictions & Task Eligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Values', () => {
    it('should allow grooms to work with foals from birth', () => {
      expect(GROOM_CONFIG.MIN_AGE_FOR_GROOMING_TASKS).toBe(0);
    });

    it('should define adult horse age threshold at 3 years', () => {
      expect(GROOM_CONFIG.GENERAL_GROOMING_MIN_AGE).toBe(3);
    });

    it('should have foal enrichment tasks defined', () => {
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toBeDefined();
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS.length).toBeGreaterThan(0);
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('gentle_touch');
      expect(GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS).toContain('feeding_assistance');
    });

    it('should have adult grooming tasks defined', () => {
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toBeDefined();
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS.length).toBeGreaterThan(0);
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('brushing');
      expect(GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS).toContain('hand-walking');
    });
  });

  // Equoria-v6gg / Equoria-son6: horse.age is game-years. validateGroomingEligibility
  // compares horse.age directly to year-denominated config thresholds. Fixtures below
  // use game-year values matching each test's stated age intent.
  describe('Foal Enrichment Task Eligibility (0-2 years)', () => {
    it('should allow newborn foal (0 game-years) to receive enrichment tasks', async () => {
      const newbornFoal = { id: 1, age: 0, bondScore: 0 };
      const result = await validateGroomingEligibility(newbornFoal, 'gentle_touch');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });

    it('should allow under-1-game-year foal to receive enrichment tasks', async () => {
      const weekOldFoal = { id: 2, age: 0, bondScore: 10 };
      const result = await validateGroomingEligibility(weekOldFoal, 'feeding_assistance');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });

    it('should allow 1-game-year-old horse to receive enrichment tasks', async () => {
      const yearlingHorse = { id: 3, age: 1, bondScore: 25 };
      const result = await validateGroomingEligibility(yearlingHorse, 'gentle_touch');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });

    it('should allow 2-game-year-old horse to receive foal grooming tasks (1-3 years)', async () => {
      const youngHorse = { id: 4, age: 2, bondScore: 40 };
      const result = await validateGroomingEligibility(youngHorse, 'hoof_handling');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });
  });

  describe('Adult Horse Grooming Task Eligibility (3+ years)', () => {
    it('should allow exactly 3-game-year-old horse to receive adult grooming tasks', async () => {
      const threeYearOld = { id: 5, age: 3, bondScore: 50 };
      const result = await validateGroomingEligibility(threeYearOld, 'brushing');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });

    it('should allow 5-game-year-old horse to receive adult grooming tasks', async () => {
      const adultHorse = { id: 6, age: 5, bondScore: 75 };
      const result = await validateGroomingEligibility(adultHorse, 'hand-walking');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });

    it('should allow senior horse (10+ game-years) to receive adult grooming tasks', async () => {
      const seniorHorse = { id: 7, age: 10, bondScore: 90 };
      const result = await validateGroomingEligibility(seniorHorse, 'stall_care');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });
  });

  describe('Task Type Validation', () => {
    it('should reject invalid task types for any age', async () => {
      const horse = { id: 8, age: 10, bondScore: 50 };
      const result = await validateGroomingEligibility(horse, 'invalid_task');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not an eligible');
    });

    it('should provide list of eligible tasks when task is invalid', async () => {
      const horse = { id: 9, age: 5, bondScore: 30 };
      const result = await validateGroomingEligibility(horse, 'nonexistent_task');

      expect(result.eligible).toBe(false);
      expect(result.eligibleTasks).toBeDefined();
      expect(Array.isArray(result.eligibleTasks)).toBe(true);
    });
  });

  describe('Age Boundary Conditions', () => {
    // Equoria-v6gg: horse.age is game-years post Equoria-son6. Fixture values
    // updated from days-semantics to years-semantics.
    it('should handle exactly 3 years as adult threshold', async () => {
      const exactlyThreeYears = { id: 10, age: 3, bondScore: 60 };

      // Should be eligible for adult tasks
      const adultTaskResult = await validateGroomingEligibility(exactlyThreeYears, 'brushing');
      expect(adultTaskResult.eligible).toBe(true);

      // Should also be eligible for foal tasks (transition period — adults get all task types)
      const foalTaskResult = await validateGroomingEligibility(exactlyThreeYears, 'gentle_touch');
      expect(foalTaskResult.eligible).toBe(true);
    });

    it('should handle 2.86 years (between foal-enrichment and general-grooming bands)', async () => {
      const almostThreeYears = { id: 11, age: 2.86, bondScore: 55 };

      // Should NOT be eligible for foal enrichment tasks (age > 2 years)
      const foalTaskResult = await validateGroomingEligibility(almostThreeYears, 'gentle_touch');
      expect(foalTaskResult.eligible).toBe(false);

      // Should be eligible for foal grooming tasks (1-3 years)
      const groomingTaskResult = await validateGroomingEligibility(almostThreeYears, 'hoof_handling');
      expect(groomingTaskResult.eligible).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative age gracefully', async () => {
      const invalidHorse = { id: 12, age: -1, bondScore: 0 };
      const result = await validateGroomingEligibility(invalidHorse, 'gentle_touch');

      // Should still process (age validation might be handled elsewhere)
      expect(result).toBeDefined();
      expect(typeof result.eligible).toBe('boolean');
    });

    it('should handle very old horses (20+ years)', async () => {
      const veryOldHorse = { id: 13, age: 20, bondScore: 100 };
      const result = await validateGroomingEligibility(veryOldHorse, 'brushing');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
    });
  });
});
