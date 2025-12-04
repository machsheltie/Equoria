/**
 * XP Utilities Tests
 *
 * TDD tests for XP/Level calculation functions
 * Story 2.2: XP & Level Display - AC-3
 */

import {
  calculateLevel,
  getXPForNextLevel,
  getXPProgress,
  getXPProgressPercent,
  getXPNeededForNextLevel,
  formatXPDisplay,
} from '../xp-utils';

describe('XP Utilities', () => {
  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(calculateLevel(0)).toBe(1);
    });

    it('should return level 1 for 99 XP', () => {
      expect(calculateLevel(99)).toBe(1);
    });

    it('should return level 2 for 100 XP', () => {
      expect(calculateLevel(100)).toBe(2);
    });

    it('should return level 2 for 199 XP', () => {
      expect(calculateLevel(199)).toBe(2);
    });

    it('should return level 3 for 200 XP', () => {
      expect(calculateLevel(200)).toBe(3);
    });

    it('should return level 10 for 900 XP', () => {
      expect(calculateLevel(900)).toBe(10);
    });

    it('should return level 11 for 1000 XP', () => {
      expect(calculateLevel(1000)).toBe(11);
    });

    it('should handle large XP values', () => {
      expect(calculateLevel(9999)).toBe(100);
      expect(calculateLevel(10000)).toBe(101);
    });

    it('should handle undefined XP by returning level 1', () => {
      expect(calculateLevel(undefined as unknown as number)).toBe(1);
    });

    it('should handle negative XP by returning level 1', () => {
      expect(calculateLevel(-50)).toBe(1);
    });
  });

  describe('getXPForNextLevel', () => {
    it('should return 100 XP needed for level 1 to reach level 2', () => {
      expect(getXPForNextLevel(1)).toBe(100);
    });

    it('should return 200 XP needed for level 2 to reach level 3', () => {
      expect(getXPForNextLevel(2)).toBe(200);
    });

    it('should return 1000 XP needed for level 10 to reach level 11', () => {
      expect(getXPForNextLevel(10)).toBe(1000);
    });

    it('should handle level 0 by returning 0', () => {
      expect(getXPForNextLevel(0)).toBe(0);
    });

    it('should handle undefined level by returning 100', () => {
      expect(getXPForNextLevel(undefined as unknown as number)).toBe(100);
    });
  });

  describe('getXPProgress', () => {
    it('should return 0 for 0 XP', () => {
      expect(getXPProgress(0)).toBe(0);
    });

    it('should return 50 for 50 XP', () => {
      expect(getXPProgress(50)).toBe(50);
    });

    it('should return 0 for 100 XP (just leveled up)', () => {
      expect(getXPProgress(100)).toBe(0);
    });

    it('should return 50 for 150 XP', () => {
      expect(getXPProgress(150)).toBe(50);
    });

    it('should return 99 for 199 XP', () => {
      expect(getXPProgress(199)).toBe(99);
    });

    it('should return 0 for 500 XP', () => {
      expect(getXPProgress(500)).toBe(0);
    });

    it('should handle undefined XP by returning 0', () => {
      expect(getXPProgress(undefined as unknown as number)).toBe(0);
    });
  });

  describe('getXPProgressPercent', () => {
    it('should return 0% for 0 XP', () => {
      expect(getXPProgressPercent(0)).toBe(0);
    });

    it('should return 50% for 50 XP', () => {
      expect(getXPProgressPercent(50)).toBe(50);
    });

    it('should return 75% for 75 XP', () => {
      expect(getXPProgressPercent(75)).toBe(75);
    });

    it('should return 0% for 100 XP (just leveled up)', () => {
      expect(getXPProgressPercent(100)).toBe(0);
    });

    it('should return 25% for 125 XP', () => {
      expect(getXPProgressPercent(125)).toBe(25);
    });

    it('should return 99% for 99 XP', () => {
      expect(getXPProgressPercent(99)).toBe(99);
    });

    it('should handle undefined XP by returning 0%', () => {
      expect(getXPProgressPercent(undefined as unknown as number)).toBe(0);
    });
  });

  describe('getXPNeededForNextLevel', () => {
    it('should return 100 XP needed when at 0 XP (level 1)', () => {
      expect(getXPNeededForNextLevel(0)).toBe(100);
    });

    it('should return 50 XP needed when at 50 XP (level 1)', () => {
      expect(getXPNeededForNextLevel(50)).toBe(50);
    });

    it('should return 1 XP needed when at 99 XP (level 1)', () => {
      expect(getXPNeededForNextLevel(99)).toBe(1);
    });

    it('should return 100 XP needed when at 100 XP (level 2)', () => {
      expect(getXPNeededForNextLevel(100)).toBe(100);
    });

    it('should return 50 XP needed when at 150 XP (level 2)', () => {
      expect(getXPNeededForNextLevel(150)).toBe(50);
    });

    it('should handle undefined XP by returning 100', () => {
      expect(getXPNeededForNextLevel(undefined as unknown as number)).toBe(100);
    });
  });

  describe('formatXPDisplay', () => {
    it('should format XP display for level 1 with 0 XP', () => {
      expect(formatXPDisplay(0)).toBe('0 / 100 XP');
    });

    it('should format XP display for level 1 with 50 XP', () => {
      expect(formatXPDisplay(50)).toBe('50 / 100 XP');
    });

    it('should format XP display for level 2 with 100 XP', () => {
      expect(formatXPDisplay(100)).toBe('0 / 100 XP');
    });

    it('should format XP display for level 2 with 150 XP', () => {
      expect(formatXPDisplay(150)).toBe('50 / 100 XP');
    });

    it('should format XP display for level 10 with 950 XP', () => {
      expect(formatXPDisplay(950)).toBe('50 / 100 XP');
    });

    it('should handle undefined XP', () => {
      expect(formatXPDisplay(undefined as unknown as number)).toBe('0 / 100 XP');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large XP values consistently', () => {
      const largeXP = 999999;
      const level = calculateLevel(largeXP);
      const progress = getXPProgress(largeXP);
      const percent = getXPProgressPercent(largeXP);

      expect(level).toBe(10000);
      expect(progress).toBe(99);
      expect(percent).toBe(99);
    });

    it('should maintain consistency between functions', () => {
      const testXP = 250;
      const level = calculateLevel(testXP);
      const progress = getXPProgress(testXP);
      const xpForNext = getXPForNextLevel(level);
      const needed = getXPNeededForNextLevel(testXP);

      expect(level).toBe(3);
      expect(progress).toBe(50);
      expect(xpForNext).toBe(300);
      expect(needed).toBe(50);
    });
  });
});
