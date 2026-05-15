/**
 * useRankHistory Hook
 *
 * Leaderboard System - Historical rank time-series query (Equoria-l332).
 *
 * Fetches a user's UserRankSnapshot history grouped into one ascending
 * series per category (level / xp / horse-earnings / horse-performance).
 * Powers the rank-trend Recharts LineChart on the profile page.
 *
 * Features:
 * - Conditional fetching (disabled when userId is empty)
 * - 5 minute staleTime (snapshots are captured nightly, not real-time)
 * - 10 minute gcTime for cache retention
 * - Optional `days` lookback window (1..365)
 *
 * @example
 * const { data, isLoading, error } = useRankHistory({ userId: 'user-123', days: 90 });
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchUserRankHistory,
  RankHistoryResponse,
  LeaderboardApiError,
} from '@/lib/api/leaderboards';

/**
 * Parameters for the useRankHistory hook.
 */
export interface UseRankHistoryParams {
  userId: string;
  /** Optional lookback window in days (1..365). Omitted → full history. */
  days?: number;
  enabled?: boolean;
}

/**
 * Query keys for rank-history queries.
 */
export const rankHistoryQueryKeys = {
  all: ['leaderboards', 'rank-history'] as const,
  user: (userId: string, days?: number) =>
    ['leaderboards', 'rank-history', userId, days ?? 'all'] as const,
};

/**
 * Fetch a user's historical rank series across all categories.
 *
 * @param params - Query parameters with userId, optional days + enabled flag
 * @returns React Query result with data, loading states, error, refetch
 */
export function useRankHistory(params: UseRankHistoryParams) {
  const { userId, days, enabled = true } = params;

  return useQuery<RankHistoryResponse, LeaderboardApiError>({
    queryKey: rankHistoryQueryKeys.user(userId, days),
    queryFn: () => fetchUserRankHistory(userId, days),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    enabled: enabled && userId.length > 0,
  });
}

export type { RankHistoryResponse };
