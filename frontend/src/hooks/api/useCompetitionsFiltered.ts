/**
 * useCompetitionsFiltered Hook
 *
 * Competition Entry System - Filtered competitions list query
 *
 * Fetches list of available competitions with optional filtering support.
 * Supports filtering by discipline, date range, and entry fee.
 *
 * Features:
 * - Filter-aware caching with unique query keys per filter combination
 * - Configurable staleTime (5 minutes default)
 * - Configurable gcTime (10 minutes default)
 * - Automatic refetch on filter changes
 *
 * @example
 * // Fetch all competitions
 * const { data, isLoading, error } = useCompetitionsFiltered();
 *
 * // Fetch dressage competitions this week
 * const { data } = useCompetitionsFiltered({
 *   discipline: 'dressage',
 *   dateRange: 'week'
 * });
 *
 * // Fetch free competitions
 * const { data } = useCompetitionsFiltered({ entryFee: 'free' });
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchCompetitions,
  CompetitionFilters,
  CompetitionData,
  CompetitionApiError,
} from '@/lib/api/competitions';

/**
 * Query keys for competition list queries
 *
 * Structure:
 * - all: ['competitions', 'filtered'] - Base key for all filtered queries
 * - list: ['competitions', 'filtered', filters] - Specific filter combination
 */
export const competitionFilteredQueryKeys = {
  all: ['competitions', 'filtered'] as const,
  list: (filters?: CompetitionFilters) => [...competitionFilteredQueryKeys.all, filters] as const,
};

/**
 * Fetch competitions with optional filtering
 *
 * @param filters - Optional filters for discipline, date range, entry fee
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - staleTime: 5 minutes - Data considered fresh for 5 minutes
 * - gcTime: 10 minutes - Cache retained for 10 minutes after unmount
 * - Enabled by default - Fetches immediately on mount
 */
export function useCompetitionsFiltered(filters?: CompetitionFilters) {
  return useQuery<CompetitionData[], CompetitionApiError>({
    queryKey: competitionFilteredQueryKeys.list(filters),
    queryFn: () => fetchCompetitions(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Export types for external use
 */
export type { CompetitionFilters, CompetitionData };
