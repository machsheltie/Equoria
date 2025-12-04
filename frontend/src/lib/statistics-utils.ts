/**
 * Statistics Utilities
 *
 * Functions for formatting and calculating game statistics.
 * Story 2.4: Statistics Dashboard - AC-1, AC-2, AC-3
 */

/**
 * Types of statistics tracked in the game
 */
export enum StatisticType {
  HORSES_OWNED = 'horses_owned',
  COMPETITIONS_WON = 'competitions_won',
  BREEDING_COUNT = 'breeding_count',
  TOTAL_EARNINGS = 'total_earnings',
  WIN_RATE = 'win_rate',
}

/**
 * Trend direction indicators
 */
export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  NEUTRAL = 'neutral',
}

/**
 * Threshold for considering a trend significant
 */
const TREND_THRESHOLD = 0.1;

/**
 * Format a statistic value with thousands separators
 *
 * @param value - The statistic value to format
 * @returns Formatted string with commas (e.g., "1,234")
 */
export function formatStatistic(value: number): string {
  // Handle edge cases
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0';
  }

  // Truncate decimals (statistics are whole numbers)
  const wholeValue = Math.trunc(value);

  // Use Intl.NumberFormat for locale-aware formatting
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(wholeValue);
}

/**
 * Format a percentage value
 *
 * @param value - The percentage value (e.g., 50 for 50%)
 * @returns Formatted percentage string (e.g., "50%")
 */
export function formatPercentage(value: number): string {
  // Handle edge cases
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '0%';
  }

  // Round to 1 decimal place
  const rounded = Math.round(value * 10) / 10;

  // Format with or without decimal
  if (rounded === Math.floor(rounded)) {
    return `${Math.floor(rounded)}%`;
  }

  return `${rounded.toFixed(1)}%`;
}

/**
 * Calculate trend percentage between current and previous values
 *
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Percentage change (positive = increase, negative = decrease)
 */
export function calculateTrend(current: number, previous: number): number {
  // Handle undefined/null
  const curr = current ?? 0;
  const prev = previous ?? 0;

  // If previous is 0, return 100% if current > 0, otherwise 0
  if (prev === 0) {
    return curr > 0 ? 100 : curr < 0 ? -100 : 0;
  }

  // Calculate percentage change
  const change = ((curr - prev) / Math.abs(prev)) * 100;

  // Round to whole number
  return Math.round(change);
}

/**
 * Get the direction of a trend
 *
 * @param trendValue - The trend percentage
 * @returns TrendDirection enum value
 */
export function getTrendDirection(trendValue: number): TrendDirection {
  if (trendValue >= TREND_THRESHOLD) {
    return TrendDirection.UP;
  }
  if (trendValue <= -TREND_THRESHOLD) {
    return TrendDirection.DOWN;
  }
  return TrendDirection.NEUTRAL;
}

/**
 * Format a trend value as a label with sign
 *
 * @param trendValue - The trend percentage
 * @returns Formatted string with sign (e.g., "+25%", "-15%")
 */
export function formatTrendLabel(trendValue: number): string {
  // Handle edge cases
  if (trendValue === undefined || trendValue === null || Number.isNaN(trendValue)) {
    return '0%';
  }

  // Round to 1 decimal place
  const rounded = Math.round(trendValue * 10) / 10;

  // Format with sign
  if (rounded > 0) {
    if (rounded === Math.floor(rounded)) {
      return `+${Math.floor(rounded)}%`;
    }
    return `+${rounded.toFixed(1)}%`;
  }

  if (rounded < 0) {
    if (rounded === Math.ceil(rounded)) {
      return `${Math.ceil(rounded)}%`;
    }
    return `${rounded.toFixed(1)}%`;
  }

  return '0%';
}
