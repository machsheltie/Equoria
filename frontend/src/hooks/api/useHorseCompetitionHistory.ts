/**
 * useHorseCompetitionHistory Hook
 *
 * Competition Results System - Horse competition history query
 *
 * Fetches a horse's complete competition history including:
 * - All past competitions with placements
 * - Aggregated statistics (wins, win rate, prize money, etc.)
 * - Performance metrics (average placement, best placement)
 *
 * Features:
 * - Conditional fetching (disabled when ID is null)
 * - 5 minute staleTime (history updates moderately)
 * - 10 minute gcTime for cache retention
 * - Auto-updates when horse ID changes
 *
 * @example
 * // Fetch horse competition history
 * const { data, isLoading, error } = useHorseCompetitionHistory(456);
 *
 * // Conditional fetch (null disables the query)
 * const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
 * const { data } = useHorseCompetitionHistory(selectedHorseId);
 *
 * // Access statistics
 * if (data?.statistics) {
 *   console.log(`Win rate: ${data.statistics.winRate}%`);
 * }
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchHorseCompetitionHistory,
  CompetitionHistoryData,
  CompetitionResultsApiError,
} from '@/lib/api/competitionResults';

/**
 * Query keys for horse competition history queries
 *
 * Structure:
 * - all: ['horse-competition-history'] - Base key for all history queries
 * - history: ['horse-competition-history', id] - Specific horse history by ID
 *
 * Used for:
 * - Cache management
 * - Query invalidation after competition completion
 * - Prefetching horse data
 */
export const horseCompetitionHistoryQueryKeys = {
  all: ['horse-competition-history'] as const,
  history: (horseId: number) => [...horseCompetitionHistoryQueryKeys.all, horseId] as const,
};

/**
 * Fetch a horse's complete competition history
 *
 * @param horseId - Horse ID (null disables the query)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when horseId is not null
 * - staleTime: 5 minutes - History updates after each competition
 * - gcTime: 10 minutes - Cache retained for 10 minutes after unmount
 *
 * @example
 * const { data, isLoading, isError, error, refetch } = useHorseCompetitionHistory(horseId);
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <Error message={error.message} />;
 *
 * return (
 *   <div>
 *     <StatsCard stats={data.statistics} />
 *     <CompetitionList competitions={data.competitions} />
 *   </div>
 * );
 */
export function useHorseCompetitionHistory(horseId: number | null) {
  return useQuery<CompetitionHistoryData, CompetitionResultsApiError>({
    queryKey: horseCompetitionHistoryQueryKeys.history(horseId!),
    queryFn: () => fetchHorseCompetitionHistory(horseId!),
    enabled: horseId !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes - history updates after competitions
    gcTime: 10 * 60 * 1000, // 10 minutes - cache retention
  });
}

/**
 * Export types for external use
 */
export type { CompetitionHistoryData };
