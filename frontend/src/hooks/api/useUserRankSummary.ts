/**
 * useUserRankSummary Hook
 *
 * Leaderboard System - User rank summary query
 *
 * Fetches a user's rankings across all leaderboard categories including
 * their rank, rank change, primary stat, and best ranking achievements.
 *
 * Features:
 * - Conditional fetching (disabled when userId is empty)
 * - 5 minute staleTime (rankings do not change frequently)
 * - 10 minute gcTime for cache retention
 * - Enabled flag for conditional fetching
 * - Refetch function for manual refresh
 *
 * @example
 * const { data, isLoading, error } = useUserRankSummary({
 *   userId: 'user-123',
 * });
 *
 * if (data) {
 *   console.log(`${data.userName} has ${data.rankings.length} category rankings`);
 * }
 *
 * Story 5-5: Leaderboards - Task 5
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchUserRankSummary,
  UserRankSummaryResponse,
  LeaderboardApiError,
} from '@/lib/api/leaderboards';

/**
 * Parameters for the useUserRankSummary hook.
 */
export interface UseUserRankSummaryParams {
  userId: string;
  enabled?: boolean;
}

/**
 * Query keys for user rank summary queries.
 *
 * Structure:
 * - all: ['leaderboards', 'user-summary'] - Base key for all user summaries
 * - user: ['leaderboards', 'user-summary', userId] - Specific user summary
 *
 * Used for:
 * - Cache management
 * - Query invalidation on leaderboard refresh
 * - Prefetching user data
 */
export const userRankSummaryQueryKeys = {
  all: ['leaderboards', 'user-summary'] as const,
  user: (userId: string) => ['leaderboards', 'user-summary', userId] as const,
};

/**
 * Fetch a user's ranking summary across all leaderboard categories.
 *
 * @param params - Query parameters with userId and optional enabled flag
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - queryKey: ['leaderboards', 'user-summary', userId]
 * - enabled: Only fetches when userId is non-empty and params.enabled is true
 * - staleTime: 5 minutes - rankings do not change frequently
 * - gcTime: 10 minutes - cache retained after unmount
 */
export function useUserRankSummary(params: UseUserRankSummaryParams) {
  const { userId, enabled = true } = params;

  return useQuery<UserRankSummaryResponse, LeaderboardApiError>({
    queryKey: userRankSummaryQueryKeys.user(userId),
    queryFn: () => fetchUserRankSummary(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: enabled && userId.length > 0,
  });
}

/**
 * Export types for external use
 */
export type { UserRankSummaryResponse };
