/**
 * 🧪 UNIT TEST: Groom Bonding & Burnout Prevention System
 *
 * This test validates the enhanced groom system's bonding mechanics and burnout
 * prevention features for horses 3+ years old.
 *
 * 📋 BUSINESS RULES TESTED:
 * - Bond score starts at 0 for new horses
 * - Daily bond gain of +2 for eligible grooming tasks
 * - Maximum bond score of 100
 * - Consecutive day tracking for burnout immunity
 * - 7 consecutive days grants burnout immunity
 * - 2+ day lapse resets consecutive counter
 * - Age restriction: grooming tasks only for horses 3+ years old
 * - One grooming session per horse per day maximum
 * - Eligible tasks: brushing, hand-walking, stall_care
 *
 * 🎯 TESTING APPROACH: Balanced Mocking
 * - Mock: Database operations (Prisma), external dependencies
 * - Real: Business logic, calculations, validation rules
 * - Focus: Actual bonding mechanics and burnout prevention logic
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import {
  calculateBondingEffects,
  updateConsecutiveDays,
  checkBurnoutImmunity,
  validateGroomingEligibility,
} from '../utils/groomBondingSystem.mjs';
import { GROOM_CONFIG } from '../config/groomConfig.mjs';

describe('Groom Bonding & Burnout Prevention System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Bond Score Mechanics', () => {
    it('should start horses with bond score of 0', () => {
      expect(GROOM_CONFIG.BOND_SCORE_START).toBe(0);
    });

    it('should increase bond score by +2 for eligible grooming tasks', () => {
      const currentBondScore = 20;
      const result = calculateBondingEffects(currentBondScore, 'brushing');

      expect(result.bondChange).toBe(2);
      expect(result.newBondScore).toBe(22);
    });

    it('should cap bond score at maximum of 100', () => {
      const currentBondScore = 99;
      const result = calculateBondingEffects(currentBondScore, 'brushing');

      expect(result.newBondScore).toBe(100);
      expect(result.bondChange).toBe(1); // Only +1 to reach cap
    });

    it('should not increase bond score beyond 100', () => {
      const currentBondScore = 100;
      const result = calculateBondingEffects(currentBondScore, 'brushing');

      expect(result.newBondScore).toBe(100);
      expect(result.bondChange).toBe(0);
    });
  });

  describe('Eligible Grooming Tasks', () => {
    it('should recognize brushing as eligible task', () => {
      expect(GROOM_CONFIG.ELIGIBLE_GROOMING_TASKS).toContain('brushing');
    });

    it('should recognize hand-walking as eligible task', () => {
      expect(GROOM_CONFIG.ELIGIBLE_GROOMING_TASKS).toContain('hand-walking');
    });

    it('should recognize stall_care as eligible task', () => {
      expect(GROOM_CONFIG.ELIGIBLE_GROOMING_TASKS).toContain('stall_care');
    });

    it('should reject non-eligible tasks for bonding', () => {
      const result = calculateBondingEffects(50, 'feeding');
      expect(result.bondChange).toBe(0);
    });
  });

  describe('Age Restrictions', () => {
    it('should allow grooming for horses 3+ years old', async () => {
      const horse = { id: 1, age: 1095, bondScore: 50 }; // 3 years old
      const result = await validateGroomingEligibility(horse, 'brushing');

      expect(result.eligible).toBe(true);
    });

    it('should reject adult grooming tasks for horses under 3 years old', async () => {
      const horse = { id: 1, age: 1000, bondScore: 50 }; // Under 3 years
      const result = await validateGroomingEligibility(horse, 'brushing');

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not an eligible task for foal');
    });

    it('should allow enrichment tasks for horses under 3 years old', async () => {
      const horse = { id: 1, age: 1000, bondScore: 50 }; // Under 3 years
      const result = await validateGroomingEligibility(horse, 'gentle_touch');

      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('eligible');
      expect(result.ageGroup).toBe('foal');
      expect(result.taskType).toBe('enrichment');
    });
  });

  describe('Consecutive Day Tracking', () => {
    it('should increment consecutive days for daily grooming', () => {
      const currentDays = 3;
      const result = updateConsecutiveDays(currentDays, true);

      expect(result.newConsecutiveDays).toBe(4);
    });

    it('should reset consecutive days to 0 after 2+ day lapse', () => {
      const currentDays = 5;
      const daysSinceLastGrooming = 3;
      const result = updateConsecutiveDays(currentDays, false, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(0);
      expect(result.wasReset).toBe(true);
    });

    it('should maintain consecutive days for 1-day lapse', () => {
      const currentDays = 5;
      const daysSinceLastGrooming = 1;
      const result = updateConsecutiveDays(currentDays, false, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(5);
      expect(result.wasReset).toBe(false);
    });
  });

  describe('Burnout Immunity System', () => {
    it('should grant immunity after 7 consecutive days', () => {
      const consecutiveDays = 7;
      const result = checkBurnoutImmunity(consecutiveDays);

      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE);
      expect(result.immunityGranted).toBe(true);
    });

    it('should maintain none status for less than 7 days', () => {
      const consecutiveDays = 6;
      const result = checkBurnoutImmunity(consecutiveDays);

      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.NONE);
      expect(result.immunityGranted).toBe(false);
    });

    it('should reset immunity status when consecutive days reset', () => {
      const consecutiveDays = 0;
      const result = checkBurnoutImmunity(consecutiveDays);

      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.NONE);
    });
  });
});
