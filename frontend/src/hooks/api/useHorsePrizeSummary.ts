/**
 * useHorsePrizeSummary Hook
 *
 * Prize System - Horse prize summary query
 *
 * Fetches a horse's complete prize earnings summary including:
 * - Total competitions and prize money
 * - Placement breakdown (1st, 2nd, 3rd places)
 * - Unclaimed prizes count
 * - Recent prize transactions
 *
 * Features:
 * - Conditional fetching (disabled when horseId is null)
 * - 5 minute staleTime (summary updates after competitions/claims)
 * - 10 minute gcTime for cache retention
 * - Auto-updates when horse ID changes
 *
 * @example
 * // Fetch horse prize summary
 * const { data, isLoading, error } = useHorsePrizeSummary(456);
 *
 * // Conditional fetch (null disables the query)
 * const [selectedHorseId, setSelectedHorseId] = useState<number | null>(null);
 * const { data } = useHorsePrizeSummary(selectedHorseId);
 *
 * // Access summary data
 * if (data) {
 *   console.log(`Total prize money: $${data.totalPrizeMoney}`);
 *   console.log(`Unclaimed: ${data.unclaimedPrizes}`);
 * }
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchHorsePrizeSummary,
  HorsePrizeSummary,
  PrizeApiError,
} from '@/lib/api/prizes';

/**
 * Query keys for horse prize summary queries
 *
 * Structure:
 * - all: ['prizes', 'horseSummary'] - Base key for all summary queries
 * - summary: ['prizes', 'horseSummary', horseId] - Specific horse summary by ID
 *
 * Used for:
 * - Cache management
 * - Query invalidation after prize claims
 * - Prefetching horse data
 */
export const horsePrizeSummaryQueryKeys = {
  all: ['prizes', 'horseSummary'] as const,
  summary: (horseId: number) => [...horsePrizeSummaryQueryKeys.all, horseId] as const,
};

/**
 * Fetch a horse's prize earnings summary
 *
 * @param horseId - Horse ID (null disables the query)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when horseId is not null
 * - staleTime: 5 minutes - Summary updates after competitions/claims
 * - gcTime: 10 minutes - Cache retained for 10 minutes after unmount
 *
 * @example
 * const { data, isLoading, isError, error, refetch } = useHorsePrizeSummary(horseId);
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <Error message={error.message} />;
 *
 * return (
 *   <PrizeSummaryCard
 *     summary={data}
 *     onClaimAll={handleClaimAll}
 *   />
 * );
 */
export function useHorsePrizeSummary(horseId: number | null) {
  return useQuery<HorsePrizeSummary, PrizeApiError>({
    queryKey: horsePrizeSummaryQueryKeys.summary(horseId!),
    queryFn: () => fetchHorsePrizeSummary(horseId!),
    enabled: horseId !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes - summary updates after competitions/claims
    gcTime: 10 * 60 * 1000, // 10 minutes - cache retention
  });
}

/**
 * Export types for external use
 */
export type { HorsePrizeSummary };
