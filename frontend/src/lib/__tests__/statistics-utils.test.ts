/**
 * Statistics Utilities Tests
 *
 * TDD tests for statistics formatting and calculation utilities.
 * Story 2.4: Statistics Dashboard - AC-1, AC-2, AC-3
 */

import { describe, it, expect } from 'vitest';
import {
  formatStatistic,
  formatPercentage,
  calculateTrend,
  getTrendDirection,
  formatTrendLabel,
  StatisticType,
  TrendDirection,
} from '../statistics-utils';

describe('statistics-utils', () => {
  describe('formatStatistic', () => {
    it('should format 0 as "0"', () => {
      expect(formatStatistic(0)).toBe('0');
    });

    it('should format positive integers', () => {
      expect(formatStatistic(42)).toBe('42');
    });

    it('should format hundreds without separator', () => {
      expect(formatStatistic(999)).toBe('999');
    });

    it('should format thousands with separator', () => {
      expect(formatStatistic(1000)).toBe('1,000');
    });

    it('should format large numbers', () => {
      expect(formatStatistic(1234567)).toBe('1,234,567');
    });

    it('should handle undefined by returning "0"', () => {
      expect(formatStatistic(undefined as unknown as number)).toBe('0');
    });

    it('should handle null by returning "0"', () => {
      expect(formatStatistic(null as unknown as number)).toBe('0');
    });

    it('should handle NaN by returning "0"', () => {
      expect(formatStatistic(NaN)).toBe('0');
    });

    it('should truncate decimals', () => {
      expect(formatStatistic(42.99)).toBe('42');
    });

    it('should handle negative numbers', () => {
      expect(formatStatistic(-10)).toBe('-10');
    });
  });

  describe('formatPercentage', () => {
    it('should format 0 as "0%"', () => {
      expect(formatPercentage(0)).toBe('0%');
    });

    it('should format whole percentages', () => {
      expect(formatPercentage(50)).toBe('50%');
    });

    it('should format 100%', () => {
      expect(formatPercentage(100)).toBe('100%');
    });

    it('should format decimal percentages with 1 decimal place', () => {
      expect(formatPercentage(33.333)).toBe('33.3%');
    });

    it('should round to 1 decimal place', () => {
      expect(formatPercentage(66.666)).toBe('66.7%');
    });

    it('should handle small percentages', () => {
      expect(formatPercentage(0.5)).toBe('0.5%');
    });

    it('should handle undefined by returning "0%"', () => {
      expect(formatPercentage(undefined as unknown as number)).toBe('0%');
    });

    it('should handle negative percentages', () => {
      expect(formatPercentage(-10.5)).toBe('-10.5%');
    });
  });

  describe('calculateTrend', () => {
    it('should return 0 when both values are 0', () => {
      expect(calculateTrend(0, 0)).toBe(0);
    });

    it('should return 100% increase from 0 to positive', () => {
      expect(calculateTrend(10, 0)).toBe(100);
    });

    it('should return 0 when no change', () => {
      expect(calculateTrend(50, 50)).toBe(0);
    });

    it('should calculate positive trend correctly', () => {
      expect(calculateTrend(150, 100)).toBe(50);
    });

    it('should calculate negative trend correctly', () => {
      expect(calculateTrend(50, 100)).toBe(-50);
    });

    it('should calculate 100% increase (doubled)', () => {
      expect(calculateTrend(200, 100)).toBe(100);
    });

    it('should handle small decimals', () => {
      const trend = calculateTrend(105, 100);
      expect(trend).toBe(5);
    });

    it('should handle undefined current by treating as 0', () => {
      expect(calculateTrend(undefined as unknown as number, 100)).toBe(-100);
    });

    it('should handle undefined previous by treating as 0', () => {
      expect(calculateTrend(100, undefined as unknown as number)).toBe(100);
    });
  });

  describe('getTrendDirection', () => {
    it('should return "up" for positive trend', () => {
      expect(getTrendDirection(10)).toBe('up');
    });

    it('should return "down" for negative trend', () => {
      expect(getTrendDirection(-10)).toBe('down');
    });

    it('should return "neutral" for zero trend', () => {
      expect(getTrendDirection(0)).toBe('neutral');
    });

    it('should return "neutral" for very small positive change', () => {
      expect(getTrendDirection(0.001)).toBe('neutral');
    });

    it('should return "neutral" for very small negative change', () => {
      expect(getTrendDirection(-0.001)).toBe('neutral');
    });

    it('should detect up for threshold boundary (0.1)', () => {
      expect(getTrendDirection(0.1)).toBe('up');
    });
  });

  describe('formatTrendLabel', () => {
    it('should format positive trend with + sign', () => {
      expect(formatTrendLabel(25)).toBe('+25%');
    });

    it('should format negative trend with - sign', () => {
      expect(formatTrendLabel(-15)).toBe('-15%');
    });

    it('should format zero trend', () => {
      expect(formatTrendLabel(0)).toBe('0%');
    });

    it('should format decimal trends with 1 decimal place', () => {
      expect(formatTrendLabel(12.5)).toBe('+12.5%');
    });

    it('should round trend decimals', () => {
      expect(formatTrendLabel(33.333)).toBe('+33.3%');
    });

    it('should handle large positive trends', () => {
      expect(formatTrendLabel(500)).toBe('+500%');
    });

    it('should handle large negative trends', () => {
      expect(formatTrendLabel(-75)).toBe('-75%');
    });
  });

  describe('StatisticType enum', () => {
    it('should have HORSES_OWNED type', () => {
      expect(StatisticType.HORSES_OWNED).toBe('horses_owned');
    });

    it('should have COMPETITIONS_WON type', () => {
      expect(StatisticType.COMPETITIONS_WON).toBe('competitions_won');
    });

    it('should have BREEDING_COUNT type', () => {
      expect(StatisticType.BREEDING_COUNT).toBe('breeding_count');
    });

    it('should have TOTAL_EARNINGS type', () => {
      expect(StatisticType.TOTAL_EARNINGS).toBe('total_earnings');
    });

    it('should have WIN_RATE type', () => {
      expect(StatisticType.WIN_RATE).toBe('win_rate');
    });
  });

  describe('TrendDirection enum', () => {
    it('should have UP direction', () => {
      expect(TrendDirection.UP).toBe('up');
    });

    it('should have DOWN direction', () => {
      expect(TrendDirection.DOWN).toBe('down');
    });

    it('should have NEUTRAL direction', () => {
      expect(TrendDirection.NEUTRAL).toBe('neutral');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large statistics', () => {
      expect(formatStatistic(999999999)).toBe('999,999,999');
    });

    it('should handle percentages over 100%', () => {
      expect(formatPercentage(250)).toBe('250%');
    });

    it('should handle trends over 1000%', () => {
      expect(formatTrendLabel(1500)).toBe('+1500%');
    });

    it('should handle calculating trend with both 0', () => {
      expect(getTrendDirection(calculateTrend(0, 0))).toBe('neutral');
    });
  });
});
