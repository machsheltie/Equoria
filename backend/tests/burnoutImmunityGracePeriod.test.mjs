/**
 * Burnout Immunity Grace Period Test Suite
 * Tests for the 2-day grace period in burnout immunity streak tracking
 *
 * 🎯 FEATURES TESTED:
 * - 2-day grace period for missed grooming days
 * - Streak preservation within grace period
 * - Streak reset after grace period expires
 * - Burnout immunity achievement at 7 consecutive days
 * - Per-horse streak tracking (not global)
 * - Integration with existing groom bonding system
 *
 * 🔧 DEPENDENCIES:
 * - groomBondingSystem.mjs (streak tracking functions)
 * - groomConfig.mjs (configuration constants)
 * - foalTaskLogManager.mjs (task log utilities)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Grace period: Up to 2 days missed before streak reset
 * - Burnout immunity: Triggered at 7+ consecutive days
 * - Per-horse tracking: Each horse has independent streak
 * - Streak bonus: +10 points for trait evaluation when immunity achieved
 * - Grace period consistency: Same 2-day period for both burnout and foal streaks
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Date manipulation for deterministic testing
 * - Real: All business logic, streak calculations, grace period handling
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock the logger import
jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: mockLogger,
  logger: mockLogger,
}));

// Import the functions after mocking
const { updateConsecutiveDays, checkBurnoutImmunity, updateStreakTracking } = await import(
  join(__dirname, '../utils/groomBondingSystem.js')
);

const { GROOM_CONFIG } = await import(join(__dirname, '../config/groomConfig.js'));

describe('Burnout Immunity Grace Period', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Grace Period Mechanics', () => {
    it('should preserve streak within 2-day grace period', () => {
      const currentStreak = 5;
      const daysSinceLastGrooming = 2; // Within grace period

      const result = updateConsecutiveDays(currentStreak, false, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(5); // Streak preserved
      expect(result.wasReset).toBe(false);
      expect(result.reason).toContain('Within grace period');
    });

    it('should reset streak after grace period expires', () => {
      const currentStreak = 6;
      const daysSinceLastGrooming = 3; // Beyond grace period

      const result = updateConsecutiveDays(currentStreak, false, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(0); // Streak reset
      expect(result.wasReset).toBe(true);
      expect(result.reason).toContain('Reset due to 3 day lapse');
    });

    it('should increment streak when groomed today', () => {
      const currentStreak = 4;

      const result = updateConsecutiveDays(currentStreak, true);

      expect(result.newConsecutiveDays).toBe(5);
      expect(result.wasReset).toBe(false);
      expect(result.reason).toContain('consecutive days incremented');
    });

    it('should handle exactly 2-day grace period boundary', () => {
      const currentStreak = 3;
      const daysSinceLastGrooming = 2; // Exactly at grace period limit

      const result = updateConsecutiveDays(currentStreak, false, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(3); // Still within grace period
      expect(result.wasReset).toBe(false);
    });

    it('should reset at 3-day lapse (beyond grace period)', () => {
      const currentStreak = 8; // Even with immunity, streak resets
      const daysSinceLastGrooming = 3;

      const result = updateConsecutiveDays(currentStreak, false, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(0);
      expect(result.wasReset).toBe(true);
    });
  });

  describe('Burnout Immunity Achievement', () => {
    it('should grant immunity at 7 consecutive days', () => {
      const consecutiveDays = 7;

      const result = checkBurnoutImmunity(consecutiveDays);

      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE);
      expect(result.immunityGranted).toBe(true);
      expect(result.daysToImmunity).toBe(0);
    });

    it('should maintain immunity above 7 days', () => {
      const consecutiveDays = 12;

      const result = checkBurnoutImmunity(consecutiveDays);

      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.IMMUNE);
      expect(result.immunityGranted).toBe(true);
    });

    it('should show days remaining before immunity', () => {
      const consecutiveDays = 4;

      const result = checkBurnoutImmunity(consecutiveDays);

      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.NONE);
      expect(result.immunityGranted).toBe(false);
      expect(result.daysToImmunity).toBe(3); // 7 - 4 = 3 days remaining
    });

    it('should handle edge case at 6 days (one day before immunity)', () => {
      const consecutiveDays = 6;

      const result = checkBurnoutImmunity(consecutiveDays);

      expect(result.status).toBe(GROOM_CONFIG.BURNOUT_STATUS.NONE);
      expect(result.daysToImmunity).toBe(1);
    });
  });

  describe('Streak Tracking Integration', () => {
    it('should handle first-time grooming', () => {
      const lastGroomed = null;
      const currentDate = new Date('2025-06-01');
      const currentStreak = 0;

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(1);
      expect(result.streakBroken).toBe(false);
      expect(result.bonusEligible).toBe(false);
    });

    it('should increment streak for consecutive days', () => {
      const lastGroomed = new Date('2025-05-31'); // Yesterday
      const currentDate = new Date('2025-06-01'); // Today
      const currentStreak = 3;

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(4);
      expect(result.streakBroken).toBe(false);
      expect(result.bonusEligible).toBe(false); // Not yet at 7 days
    });

    it('should grant bonus eligibility at 7 consecutive days', () => {
      const lastGroomed = new Date('2025-05-31');
      const currentDate = new Date('2025-06-01');
      const currentStreak = 6; // Will become 7

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(7);
      expect(result.bonusEligible).toBe(true);
      expect(result.bonusPercentage).toBe(10);
    });

    it('should preserve streak within grace period', () => {
      const lastGroomed = new Date('2025-05-30'); // 2 days ago
      const currentDate = new Date('2025-06-01'); // Today
      const currentStreak = 5;

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(6); // Incremented despite gap
      expect(result.streakBroken).toBe(false);
      expect(result.withinGracePeriod).toBe(true);
    });

    it('should reset streak beyond grace period', () => {
      const lastGroomed = new Date('2025-05-28'); // 4 days ago
      const currentDate = new Date('2025-06-01'); // Today
      const currentStreak = 8; // Had immunity, but lost it

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(1); // Reset to 1 (today's grooming)
      expect(result.streakBroken).toBe(true);
      expect(result.bonusEligible).toBe(false);
      expect(result.daysSinceLastGrooming).toBe(4);
    });
  });

  describe('Per-Horse Tracking', () => {
    it('should demonstrate independent streak tracking per horse', () => {
      // Horse A: Building streak
      const horseA = {
        currentStreak: 6,
        lastGroomed: new Date('2025-05-31'),
        groomedToday: true,
      };

      // Horse B: Within grace period
      const horseB = {
        currentStreak: 4,
        lastGroomed: new Date('2025-05-30'), // 2 days ago
        groomedToday: true,
      };

      // Horse C: Beyond grace period
      const horseC = {
        currentStreak: 5,
        lastGroomed: new Date('2025-05-28'), // 4 days ago
        groomedToday: true,
      };

      const currentDate = new Date('2025-06-01');

      // Process each horse independently
      const resultA = updateStreakTracking(horseA.lastGroomed, currentDate, horseA.currentStreak);
      const resultB = updateStreakTracking(horseB.lastGroomed, currentDate, horseB.currentStreak);
      const resultC = updateStreakTracking(horseC.lastGroomed, currentDate, horseC.currentStreak);

      // Horse A: Achieves immunity
      expect(resultA.consecutiveDays).toBe(7);
      expect(resultA.bonusEligible).toBe(true);

      // Horse B: Continues building within grace period
      expect(resultB.consecutiveDays).toBe(5);
      expect(resultB.withinGracePeriod).toBe(true);
      expect(resultB.bonusEligible).toBe(false);

      // Horse C: Streak reset
      expect(resultC.consecutiveDays).toBe(1);
      expect(resultC.streakBroken).toBe(true);
      expect(resultC.bonusEligible).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should use correct grace period configuration', () => {
      expect(GROOM_CONFIG.BURNOUT_RESET_GRACE_DAYS).toBe(2);
      expect(GROOM_CONFIG.FOAL_STREAK_GRACE_DAYS).toBe(2);
      expect(GROOM_CONFIG.BURNOUT_IMMUNITY_THRESHOLD_DAYS).toBe(7);
      expect(GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD).toBe(7);
    });

    it('should have consistent grace periods across systems', () => {
      // Burnout system and foal streak system should use same grace period
      expect(GROOM_CONFIG.BURNOUT_RESET_GRACE_DAYS).toBe(GROOM_CONFIG.FOAL_STREAK_GRACE_DAYS);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero consecutive days', () => {
      const result = updateConsecutiveDays(0, true);

      expect(result.newConsecutiveDays).toBe(1);
      expect(result.wasReset).toBe(false);
    });

    it('should handle negative consecutive days', () => {
      const result = updateConsecutiveDays(-1, true);

      expect(result.newConsecutiveDays).toBe(0); // Should normalize to 0 then increment
    });

    it('should handle very large streak numbers', () => {
      const result = updateConsecutiveDays(100, true);

      expect(result.newConsecutiveDays).toBe(101);
      expect(result.wasReset).toBe(false);
    });

    it('should handle zero days since last grooming', () => {
      const result = updateConsecutiveDays(5, false, 0);

      expect(result.newConsecutiveDays).toBe(5); // Within grace period
      expect(result.wasReset).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle weekend gap scenario', () => {
      // Player grooms Monday-Friday, skips weekend, resumes Monday
      const fridayStreak = 5;
      const daysSinceLastGrooming = 2; // Skipped Sat & Sun

      const result = updateConsecutiveDays(fridayStreak, true, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(6); // Continues building
      expect(result.wasReset).toBe(false);
      expect(result.reason).toContain('consecutive days incremented');
    });

    it('should handle vacation scenario', () => {
      // Player had 6-day streak, goes on 4-day vacation, then grooms
      const preVacationStreak = 6;
      const vacationDays = 4;

      const result = updateConsecutiveDays(preVacationStreak, true, vacationDays);

      expect(result.newConsecutiveDays).toBe(7); // Incremented because groomed today
      expect(result.wasReset).toBe(false); // Not reset because groomed today

      // But if we check what would happen if they didn't groom today
      const wouldResetResult = updateConsecutiveDays(preVacationStreak, false, vacationDays);
      expect(wouldResetResult.newConsecutiveDays).toBe(0); // Would reset
      expect(wouldResetResult.wasReset).toBe(true);
    });

    it('should handle immunity achievement and maintenance', () => {
      // Build up to immunity
      let streak = 6;

      // Day 7: Achieve immunity
      let result = updateConsecutiveDays(streak, true);
      streak = result.newConsecutiveDays;

      expect(streak).toBe(7);

      let immunityCheck = checkBurnoutImmunity(streak);
      expect(immunityCheck.immunityGranted).toBe(true);

      // Day 8-10: Maintain immunity
      for (let day = 8; day <= 10; day++) {
        result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;

        immunityCheck = checkBurnoutImmunity(streak);
        expect(immunityCheck.immunityGranted).toBe(true);
      }

      expect(streak).toBe(10);
    });
  });
});
