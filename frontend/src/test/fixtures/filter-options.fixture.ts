/**
 * Filter Options Test Fixture
 *
 * Filter option definitions for Competition Filters component testing.
 * Includes date range and entry fee filter options.
 *
 * Story: 5.1 Competition Entry - Task 2
 * Usage: Testing CompetitionFilters component with standardized options
 */

/**
 * Date Range Filter Options
 *
 * 4 date range options for filtering competitions by timing
 */
export const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'upcoming', label: 'Upcoming (Next 7 Days)' },
  { value: 'this-week', label: 'This Week' },
  { value: 'this-month', label: 'This Month' },
] as const;

export type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]['value'];

/**
 * Entry Fee Filter Options
 *
 * 4 entry fee ranges for filtering competitions by cost
 * Fee ranges:
 * - Free: $0
 * - Low: $1-$100
 * - Medium: $101-$500
 * - High: $501+
 */
export const ENTRY_FEE_OPTIONS = [
  { value: 'all', label: 'All Entry Fees' },
  { value: 'free', label: 'Free' },
  { value: 'low', label: 'Low ($1-$100)' },
  { value: 'medium', label: 'Medium ($101-$500)' },
  { value: 'high', label: 'High ($501+)' },
] as const;

export type EntryFeeValue = (typeof ENTRY_FEE_OPTIONS)[number]['value'];

/**
 * Fee range boundaries for backend filtering logic
 */
export const FEE_RANGES = {
  free: { min: 0, max: 0 },
  low: { min: 1, max: 100 },
  medium: { min: 101, max: 500 },
  high: { min: 501, max: Infinity },
} as const;

/**
 * Validate if a value is a valid date range filter
 */
export function isValidDateRange(value: string): value is DateRangeValue {
  return DATE_RANGE_OPTIONS.some((option) => option.value === value);
}

/**
 * Validate if a value is a valid entry fee filter
 */
export function isValidEntryFee(value: string): value is EntryFeeValue {
  return ENTRY_FEE_OPTIONS.some((option) => option.value === value);
}

/**
 * Get fee range boundaries for a given fee filter
 */
export function getFeeRange(fee: Exclude<EntryFeeValue, 'all'>): { min: number; max: number } {
  return FEE_RANGES[fee];
}

/**
 * Determine which fee category a competition falls into
 */
export function categorizeFee(fee: number): EntryFeeValue {
  if (fee === 0) return 'free';
  if (fee <= 100) return 'low';
  if (fee <= 500) return 'medium';
  return 'high';
}

/**
 * Calculate date filter range from current date
 * Returns { startDate, endDate } for date range filtering
 */
export function getDateRange(
  range: DateRangeValue
): { startDate: Date; endDate: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (range) {
    case 'all':
      return null; // No date filtering

    case 'upcoming':
      // Next 7 days
      return {
        startDate: today,
        endDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
      };

    case 'this-week':
      // Current week (Sunday to Saturday)
      const dayOfWeek = today.getDay();
      const startOfWeek = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
      return { startDate: startOfWeek, endDate: endOfWeek };

    case 'this-month':
      // Current month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { startDate: startOfMonth, endDate: endOfMonth };

    default:
      return null;
  }
}

/**
 * Filter options count verification (for testing)
 */
export const DATE_RANGE_OPTIONS_COUNT = 4;
export const ENTRY_FEE_OPTIONS_COUNT = 4;

// Verify fixture integrity
if (DATE_RANGE_OPTIONS.length !== DATE_RANGE_OPTIONS_COUNT) {
  throw new Error(
    `Date range options fixture integrity error: Expected ${DATE_RANGE_OPTIONS_COUNT} options, got ${DATE_RANGE_OPTIONS.length}`
  );
}

if (ENTRY_FEE_OPTIONS.length !== ENTRY_FEE_OPTIONS_COUNT) {
  throw new Error(
    `Entry fee options fixture integrity error: Expected ${ENTRY_FEE_OPTIONS_COUNT} options, got ${ENTRY_FEE_OPTIONS.length}`
  );
}
