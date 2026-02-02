/**
 * useCompetitionResults Hook
 *
 * Competition Results System - Full competition results query
 *
 * Fetches complete results for a specific competition including:
 * - All participants with rankings
 * - Prize distribution breakdown
 * - Score breakdowns for current user's horses
 *
 * Features:
 * - Conditional fetching (disabled when ID is null)
 * - 10 minute staleTime (results rarely change)
 * - 15 minute gcTime for cache retention
 * - Auto-updates when competition ID changes
 *
 * @example
 * // Fetch competition results
 * const { data, isLoading, error } = useCompetitionResults(123);
 *
 * // Conditional fetch (null disables the query)
 * const [selectedId, setSelectedId] = useState<number | null>(null);
 * const { data } = useCompetitionResults(selectedId);
 *
 * // Access winner information
 * if (data?.results[0]) {
 *   console.log(`Winner: ${data.results[0].horseName}`);
 * }
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchCompetitionResults,
  CompetitionResults,
  CompetitionResultsApiError,
} from '@/lib/api/competitionResults';

/**
 * Query keys for competition results queries
 *
 * Structure:
 * - all: ['competition-results'] - Base key for all results queries
 * - results: ['competition-results', id] - Specific competition results by ID
 *
 * Used for:
 * - Cache management
 * - Query invalidation
 * - Prefetching
 */
export const competitionResultsQueryKeys = {
  all: ['competition-results'] as const,
  results: (competitionId: number) => [...competitionResultsQueryKeys.all, competitionId] as const,
};

/**
 * Fetch full results for a specific competition
 *
 * @param competitionId - Competition ID (null disables the query)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when competitionId is not null
 * - staleTime: 10 minutes - Results rarely change once finalized
 * - gcTime: 15 minutes - Cache retained for 15 minutes after unmount
 *
 * @example
 * const { data, isLoading, isError, error, refetch } = useCompetitionResults(competitionId);
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <Error message={error.message} />;
 *
 * return (
 *   <ResultsTable
 *     results={data.results}
 *     prizePool={data.prizePool}
 *   />
 * );
 */
export function useCompetitionResults(competitionId: number | null) {
  return useQuery<CompetitionResults, CompetitionResultsApiError>({
    queryKey: competitionResultsQueryKeys.results(competitionId!),
    queryFn: () => fetchCompetitionResults(competitionId!),
    enabled: competitionId !== null,
    staleTime: 10 * 60 * 1000, // 10 minutes - results rarely change
    gcTime: 15 * 60 * 1000, // 15 minutes - cache retention
  });
}

/**
 * Export types for external use
 */
export type { CompetitionResults };
