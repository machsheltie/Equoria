/**
 * usePrizeHistory Hook
 *
 * Prize System - User prize transaction history query
 *
 * Fetches a user's complete prize transaction history including:
 * - All prize transactions with competition details
 * - Claim status for each prize
 * - Optional filtering by date range, horse, or discipline
 *
 * Features:
 * - Conditional fetching (disabled when userId is empty)
 * - 5 minute staleTime (history updates after claims)
 * - 10 minute gcTime for cache retention
 * - Filter-aware cache keys for separate cached queries
 *
 * @example
 * // Fetch all prize history
 * const { data, isLoading, error } = usePrizeHistory('user-uuid');
 *
 * // Fetch with filters
 * const { data } = usePrizeHistory('user-uuid', { dateRange: '30days', discipline: 'dressage' });
 *
 * // Access transaction data
 * if (data) {
 *   const unclaimed = data.filter(t => !t.claimed);
 *   console.log(`Unclaimed prizes: ${unclaimed.length}`);
 * }
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchPrizeHistory,
  PrizeTransaction,
  TransactionFilters,
  PrizeApiError,
} from '@/lib/api/prizes';

/**
 * Query keys for prize history queries
 *
 * Structure:
 * - all: ['prizes', 'history'] - Base key for all history queries
 * - history: ['prizes', 'history', userId, filters] - User-specific history with optional filters
 *
 * Used for:
 * - Cache management
 * - Query invalidation after prize claims
 * - Filter-specific caching
 */
export const prizeHistoryQueryKeys = {
  all: ['prizes', 'history'] as const,
  history: (userId: string, filters?: TransactionFilters) =>
    [...prizeHistoryQueryKeys.all, userId, filters] as const,
};

/**
 * Fetch a user's prize transaction history
 *
 * @param userId - User ID (empty string disables the query)
 * @param filters - Optional filter criteria (dateRange, horseId, discipline)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when userId is not empty
 * - staleTime: 5 minutes - History updates after prize claims
 * - gcTime: 10 minutes - Cache retained for 10 minutes after unmount
 *
 * @example
 * const { data, isLoading, isError, error, refetch } = usePrizeHistory(userId);
 *
 * if (isLoading) return <Spinner />;
 * if (isError) return <Error message={error.message} />;
 *
 * return (
 *   <PrizeHistoryTable
 *     transactions={data}
 *     onClaim={handleClaim}
 *   />
 * );
 */
export function usePrizeHistory(userId: string, filters?: TransactionFilters) {
  return useQuery<PrizeTransaction[], PrizeApiError>({
    queryKey: prizeHistoryQueryKeys.history(userId, filters),
    queryFn: () => fetchPrizeHistory(userId, filters),
    enabled: userId !== '',
    staleTime: 5 * 60 * 1000, // 5 minutes - history updates after claims
    gcTime: 10 * 60 * 1000, // 10 minutes - cache retention
  });
}

/**
 * Export types for external use
 */
export type { PrizeTransaction, TransactionFilters };
