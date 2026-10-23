/**
 * Care Streak Grace Period Test Suite
 * Tests for the 2-day grace period in consecutive-day care streak tracking
 *
 * Owner ruling 2026-10-23 (Equoria-0gl9o): there is no burnout. The "burnout
 * immunity" label (checkBurnoutImmunity, BURNOUT_STATUS, Horse.burnoutStatus)
 * is gone; the care streak and its 2-day grace period stay. (The file keeps
 * its historical name.)
 *
 * 🎯 FEATURES TESTED:
 * - 2-day grace period for missed grooming days
 * - Streak preservation within grace period
 * - Streak reset after grace period expires
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
 * - Per-horse tracking: Each horse has independent streak
 * - Streak bonus: +10% at 7 consecutive days
 *
 * 🧪 TESTING APPROACH:
 * - Real: All business logic, streak calculations, grace period handling.
 *   No mocks (Equoria-arepn / CLAUDE.md §3). The three functions exercised
 *   here — updateConsecutiveDays and updateStreakTracking —
 *   are pure (no logger, no prisma); the previous logger.mjs mock was purely
 *   cosmetic for a code path this suite never touches (processGroomingSession),
 *   so it was removed and the dynamic imports replaced with static imports.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { updateConsecutiveDays, updateStreakTracking } from '../../../utils/groomBondingSystem.mjs';

import { GROOM_CONFIG } from '../../../config/groomConfig.mjs';

describe('Care Streak Grace Period', () => {
  // Reference date anchor for all test date calculations
  const referenceDate = new Date('2025-06-01T12:00:00Z');

  // Calculate relative dates for tests
  const currentDate = new Date(referenceDate);

  const yesterday = new Date(referenceDate);
  yesterday.setDate(referenceDate.getDate() - 1); // 2025-05-31

  const twoDaysAgo = new Date(referenceDate);
  twoDaysAgo.setDate(referenceDate.getDate() - 2); // 2025-05-30

  const fourDaysAgo = new Date(referenceDate);
  fourDaysAgo.setDate(referenceDate.getDate() - 4); // 2025-05-28

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
      const currentStreak = 8; // Even a long streak resets
      const daysSinceLastGrooming = 3;

      const result = updateConsecutiveDays(currentStreak, false, daysSinceLastGrooming);

      expect(result.newConsecutiveDays).toBe(0);
      expect(result.wasReset).toBe(true);
    });
  });

  describe('Streak Tracking Integration', () => {
    it('should handle first-time grooming', () => {
      const lastGroomed = null;
      // Using referenceDate-based currentDate from describe block
      const currentStreak = 0;

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(1);
      expect(result.streakBroken).toBe(false);
      expect(result.bonusEligible).toBe(false);
    });

    it('should increment streak for consecutive days', () => {
      const lastGroomed = yesterday; // Yesterday (referenceDate - 1 day)
      // Using referenceDate-based currentDate from describe block
      const currentStreak = 3;

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(4);
      expect(result.streakBroken).toBe(false);
      expect(result.bonusEligible).toBe(false); // Not yet at 7 days
    });

    it('should grant bonus eligibility at 7 consecutive days', () => {
      const lastGroomed = yesterday; // Yesterday (referenceDate - 1 day)
      // Using referenceDate-based currentDate from describe block
      const currentStreak = 6; // Will become 7

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(7);
      expect(result.bonusEligible).toBe(true);
      expect(result.bonusPercentage).toBe(10);
    });

    it('should preserve streak within grace period', () => {
      const lastGroomed = twoDaysAgo; // 2 days ago (referenceDate - 2 days)
      // Using referenceDate-based currentDate from describe block
      const currentStreak = 5;

      const result = updateStreakTracking(lastGroomed, currentDate, currentStreak);

      expect(result.consecutiveDays).toBe(6); // Incremented despite gap
      expect(result.streakBroken).toBe(false);
      expect(result.withinGracePeriod).toBe(true);
    });

    it('should reset streak beyond grace period', () => {
      const lastGroomed = fourDaysAgo; // 4 days ago (referenceDate - 4 days)
      // Using referenceDate-based currentDate from describe block
      const currentStreak = 8; // A long streak, but lost

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
        lastGroomed: yesterday, // Yesterday (referenceDate - 1 day)
        groomedToday: true,
      };

      // Horse B: Within grace period
      const horseB = {
        currentStreak: 4,
        lastGroomed: twoDaysAgo, // 2 days ago (referenceDate - 2 days)
        groomedToday: true,
      };

      // Horse C: Beyond grace period
      const horseC = {
        currentStreak: 5,
        lastGroomed: fourDaysAgo, // 4 days ago (referenceDate - 4 days)
        groomedToday: true,
      };

      // Using referenceDate-based currentDate from describe block

      // Process each horse independently
      const resultA = updateStreakTracking(horseA.lastGroomed, currentDate, horseA.currentStreak);
      const resultB = updateStreakTracking(horseB.lastGroomed, currentDate, horseB.currentStreak);
      const resultC = updateStreakTracking(horseC.lastGroomed, currentDate, horseC.currentStreak);

      // Horse A: Reaches the 7-day streak bonus
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
      expect(GROOM_CONFIG.FOAL_STREAK_GRACE_DAYS).toBe(2);
      expect(GROOM_CONFIG.FOAL_STREAK_BONUS_THRESHOLD).toBe(7);
    });

    // Old contract: BURNOUT_RESET_GRACE_DAYS drove updateConsecutiveDays and had
    // to equal FOAL_STREAK_GRACE_DAYS. Now the streak uses the one constant.
    it('updateConsecutiveDays keeps the streak for FOAL_STREAK_GRACE_DAYS and resets one day later', () => {
      const grace = GROOM_CONFIG.FOAL_STREAK_GRACE_DAYS;
      expect(updateConsecutiveDays(5, false, grace).newConsecutiveDays).toBe(5);
      expect(updateConsecutiveDays(5, false, grace + 1).wasReset).toBe(true);
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

    it('should keep building the streak past seven days', () => {
      let streak = 6;

      // Day 7
      let result = updateConsecutiveDays(streak, true);
      streak = result.newConsecutiveDays;
      expect(streak).toBe(7);

      // Days 8-10
      for (let day = 8; day <= 10; day++) {
        result = updateConsecutiveDays(streak, true);
        streak = result.newConsecutiveDays;
        expect(result.wasReset).toBe(false);
      }

      expect(streak).toBe(10);
    });
  });
});
