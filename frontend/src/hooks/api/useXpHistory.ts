/**
 * useXpHistory Hook
 *
 * XP System - Horse XP gain history query
 *
 * Fetches a horse's complete XP gain history including:
 * - All XP gain events with source details
 * - Level-up events
 * - Optional filtering by date range and source type
 *
 * Features:
 * - Conditional fetching (disabled when horseId is 0 or negative)
 * - 5 minute staleTime (history updates after new XP gains)
 * - 10 minute gcTime for cache retention
 * - Filter-aware cache keys for separate cached queries
 *
 * @example
 * // Fetch all XP history
 * const { data, isLoading, error } = useXpHistory(123);
 *
 * // Fetch with filters
 * const { data } = useXpHistory(123, { dateRange: '30days', source: 'competition' });
 *
 * // Access XP gain data
 * if (data) {
 *   const levelUps = data.filter(g => g.leveledUp);
 *   console.log(`Level-ups: ${levelUps.length}`);
 * }
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchXpHistory,
  XpGain,
  XpHistoryFilters,
  XpApiError,
} from '@/lib/api/xp';

/**
 * Query keys for XP history queries
 *
 * Structure:
 * - all: ['xpHistory'] - Base key for all XP history queries
 * - horse: ['xpHistory', horseId] - Horse-specific history without filters
 * - filtered: ['xpHistory', horseId, filters] - Horse-specific history with filters
 *
 * Used for:
 * - Cache management
 * - Query invalidation after XP additions
 * - Filter-specific caching
 */
export const xpHistoryQueryKeys = {
  all: ['xpHistory'] as const,
  horse: (horseId: number) => ['xpHistory', horseId] as const,
  filtered: (horseId: number, filters: XpHistoryFilters) =>
    ['xpHistory', horseId, filters] as const,
};

/**
 * Fetch a horse's XP gain history
 *
 * @param horseId - Horse ID (0 or negative disables the query)
 * @param filters - Optional filter criteria (dateRange, source)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when horseId > 0
 * - staleTime: 5 minutes - History updates after XP gains
 * - gcTime: 10 minutes - Cache retained for 10 minutes after unmount
 */
export function useXpHistory(
  horseId: number,
  filters?: XpHistoryFilters
) {
  return useQuery<XpGain[], XpApiError>({
    queryKey: filters
      ? xpHistoryQueryKeys.filtered(horseId, filters)
      : xpHistoryQueryKeys.horse(horseId),
    queryFn: () => fetchXpHistory(horseId, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: horseId > 0,
  });
}

/**
 * Export types for external use
 */
export type { XpGain, XpHistoryFilters };
