/**
 * useLeaderboardRefresh Hook
 *
 * Leaderboard System - Cache invalidation for leaderboard queries
 *
 * Provides functions to manually refresh leaderboard data by invalidating
 * React Query caches. Supports refreshing all leaderboard data or
 * targeting a specific category.
 *
 * Features:
 * - refreshAll: Invalidates all leaderboard queries (lists and user summaries)
 * - refreshCategory: Invalidates queries for a specific category and period
 * - isRefreshing: Boolean indicating if any refresh is in progress
 * - Uses React Query's invalidateQueries for proper cache management
 *
 * @example
 * const { refreshAll, refreshCategory, isRefreshing } = useLeaderboardRefresh();
 *
 * // Refresh all leaderboards
 * await refreshAll();
 *
 * // Refresh a specific category
 * await refreshCategory('level', 'monthly');
 *
 * Story 5-5: Leaderboards - Task 5
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { leaderboardQueryKeys } from './useLeaderboard';
import { userRankSummaryQueryKeys } from './useUserRankSummary';
import type { LeaderboardCategory, TimePeriod } from '@/components/leaderboard/LeaderboardCategorySelector';

/**
 * Return type for the useLeaderboardRefresh hook.
 */
export interface UseLeaderboardRefreshResult {
  refreshAll: () => Promise<void>;
  refreshCategory: (
    category: LeaderboardCategory,
    period: TimePeriod,
    _discipline?: string
  ) => Promise<void>;
  isRefreshing: boolean;
}

/**
 * Provides manual refresh functions for leaderboard cache invalidation.
 *
 * @returns Object with refreshAll, refreshCategory, and isRefreshing
 *
 * refreshAll:
 * - Invalidates all leaderboard list queries
 * - Invalidates all user rank summary queries
 * - Returns a promise that resolves when invalidation starts
 *
 * refreshCategory:
 * - Invalidates queries matching the given category and period
 * - Optionally filters by discipline
 * - More targeted than refreshAll
 */
export function useLeaderboardRefresh(): UseLeaderboardRefreshResult {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: leaderboardQueryKeys.all,
        }),
        queryClient.invalidateQueries({
          queryKey: userRankSummaryQueryKeys.all,
        }),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const refreshCategory = useCallback(
    async (
      category: LeaderboardCategory,
      period: TimePeriod,
      _discipline?: string
    ) => {
      setIsRefreshing(true);
      try {
        await queryClient.invalidateQueries({
          queryKey: ['leaderboards', category, period, discipline],
        });
      } finally {
        setIsRefreshing(false);
      }
    },
    [queryClient]
  );

  return {
    refreshAll,
    refreshCategory,
    isRefreshing,
  };
}
