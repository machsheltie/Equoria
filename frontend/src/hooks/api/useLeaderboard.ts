/**
 * useLeaderboard Hook
 *
 * Leaderboard System - Leaderboard data query
 *
 * Fetches ranked leaderboard entries for a specific category and time period.
 * Supports discipline-specific leaderboards, pagination, and conditional fetching.
 *
 * Features:
 * - Parameterized query key including category, period, discipline, page, limit
 * - 5 minute staleTime (leaderboards do not change frequently)
 * - 10 minute gcTime for cache retention
 * - Conditional fetching via enabled flag
 * - Refetch function for manual refresh
 *
 * @example
 * const { data, isLoading, error } = useLeaderboard({
 *   category: 'level',
 *   period: 'monthly',
 *   page: 1,
 *   limit: 50,
 * });
 *
 * @example
 * // Discipline-specific leaderboard
 * const { data } = useLeaderboard({
 *   category: 'discipline',
 *   period: 'weekly',
 *   discipline: 'show-jumping',
 * });
 *
 * Story 5-5: Leaderboards - Task 5
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchLeaderboard,
  LeaderboardResponse,
  LeaderboardApiError,
} from '@/lib/api/leaderboards';
import type { LeaderboardCategory, TimePeriod } from '@/components/leaderboard/LeaderboardCategorySelector';

/**
 * Parameters for the useLeaderboard hook.
 */
export interface UseLeaderboardParams {
  category: LeaderboardCategory;
  period: TimePeriod;
  discipline?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

/**
 * Query keys for leaderboard queries.
 *
 * Structure:
 * - all: ['leaderboards'] - Base key for all leaderboard queries
 * - list: ['leaderboards', category, period, discipline, page, limit] - Specific leaderboard query
 *
 * Used for:
 * - Cache management
 * - Query invalidation on refresh
 * - Prefetching leaderboard data
 */
export const leaderboardQueryKeys = {
  all: ['leaderboards'] as const,
  list: (
    category: LeaderboardCategory,
    period: TimePeriod,
    discipline?: string,
    page?: number,
    limit?: number
  ) => ['leaderboards', category, period, discipline, page, limit] as const,
};

/**
 * Fetch leaderboard data for a specific category and period.
 *
 * @param params - Leaderboard query parameters including category, period, discipline, page, limit
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - queryKey: ['leaderboards', category, period, discipline, page, limit]
 * - enabled: Controlled by params.enabled (default true)
 * - staleTime: 5 minutes - leaderboards do not change frequently
 * - gcTime: 10 minutes - cache retained after unmount
 */
export function useLeaderboard(params: UseLeaderboardParams) {
  const {
    category,
    period,
    discipline,
    page = 1,
    limit = 50,
    enabled = true,
  } = params;

  return useQuery<LeaderboardResponse, LeaderboardApiError>({
    queryKey: leaderboardQueryKeys.list(category, period, discipline, page, limit),
    queryFn: () =>
      fetchLeaderboard({
        category,
        period,
        discipline,
        page,
        limit,
      }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled,
  });
}

/**
 * Export types for external use
 */
export type { LeaderboardResponse };
