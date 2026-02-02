/**
 * useUserCompetitionStats Hook
 *
 * Competition Results System - User-wide competition statistics query
 *
 * Fetches aggregated competition statistics across all user's horses:
 * - Total competitions, wins, and top-3 finishes
 * - Win rate and prize money totals
 * - Best placement and most successful discipline
 * - Recent competition activity (last 5)
 *
 * Features:
 * - Conditional fetching (disabled when ID is null)
 * - 2 minute staleTime (updates more frequently than other stats)
 * - 5 minute gcTime for cache retention
 * - Auto-updates when user ID changes
 *
 * @example
 * // Fetch user competition stats
 * const { data, isLoading, error } = useUserCompetitionStats('user-uuid');
 *
 * // Conditional fetch (null disables the query)
 * const { user } = useAuth();
 * const { data } = useUserCompetitionStats(user?.id ?? null);
 *
 * // Access aggregated statistics
 * if (data) {
 *   console.log(`Total wins: ${data.totalWins}`);
 *   console.log(`Win rate: ${data.winRate}%`);
 * }
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchUserCompetitionStats,
  UserCompetitionStats,
  CompetitionResultsApiError,
} from '@/lib/api/competitionResults';

/**
 * Query keys for user competition stats queries
 *
 * Structure:
 * - all: ['user-competition-stats'] - Base key for all user stats queries
 * - stats: ['user-competition-stats', userId] - Specific user stats by ID
 *
 * Used for:
 * - Cache management
 * - Query invalidation after competitions
 * - Prefetching dashboard data
 */
export const userCompetitionStatsQueryKeys = {
  all: ['user-competition-stats'] as const,
  stats: (userId: string) => [...userCompetitionStatsQueryKeys.all, userId] as const,
};

/**
 * Fetch user's overall competition statistics
 *
 * @param userId - User ID (null disables the query)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when userId is not null
 * - staleTime: 2 minutes - User stats update frequently after competitions
 * - gcTime: 5 minutes - Cache retained for 5 minutes after unmount
 *
 * Note: Uses shorter staleTime than other hooks because user stats
 * change more frequently (any horse competing updates the totals).
 *
 * @example
 * const { data, isLoading, isError, error, refetch } = useUserCompetitionStats(userId);
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <Error message={error.message} />;
 *
 * return (
 *   <div>
 *     <StatsSummary
 *       totalWins={data.totalWins}
 *       winRate={data.winRate}
 *       totalPrizeMoney={data.totalPrizeMoney}
 *     />
 *     <RecentActivity competitions={data.recentCompetitions} />
 *   </div>
 * );
 */
export function useUserCompetitionStats(userId: string | null) {
  return useQuery<UserCompetitionStats, CompetitionResultsApiError>({
    queryKey: userCompetitionStatsQueryKeys.stats(userId!),
    queryFn: () => fetchUserCompetitionStats(userId!),
    enabled: userId !== null,
    staleTime: 2 * 60 * 1000, // 2 minutes - updates more frequently
    gcTime: 5 * 60 * 1000, // 5 minutes - cache retention
  });
}

/**
 * Export types for external use
 */
export type { UserCompetitionStats };
