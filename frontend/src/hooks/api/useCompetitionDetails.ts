/**
 * useCompetitionDetails Hook
 *
 * Competition Entry System - Single competition details query
 *
 * Fetches detailed information for a specific competition by ID.
 * Includes competition requirements, entry status, and prize information.
 *
 * Features:
 * - Conditional fetching (disabled when ID is null)
 * - Separate cache from competitions list
 * - Configurable staleTime (5 minutes default)
 * - Auto-updates when ID changes
 *
 * @example
 * // Fetch competition details
 * const { data, isLoading, error } = useCompetitionDetails(123);
 *
 * // Conditional fetch (null disables the query)
 * const [selectedId, setSelectedId] = useState<number | null>(null);
 * const { data } = useCompetitionDetails(selectedId);
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchCompetitionDetails,
  CompetitionData,
  CompetitionApiError,
} from '@/lib/api/competitions';

/**
 * Query keys for competition detail queries
 *
 * Structure:
 * - all: ['competition', 'detail'] - Base key for all detail queries
 * - detail: ['competition', 'detail', id] - Specific competition by ID
 *
 * Note: Uses different base key ('competition') from list queries ('competitions')
 * to maintain separate cache entries.
 */
export const competitionDetailsQueryKeys = {
  all: ['competition', 'detail'] as const,
  detail: (id: number) => [...competitionDetailsQueryKeys.all, id] as const,
};

/**
 * Fetch detailed information for a specific competition
 *
 * @param id - Competition ID (null disables the query)
 * @returns Query result with data, loading states, error, and refetch function
 *
 * Query Options:
 * - enabled: Only fetches when id is not null
 * - staleTime: 5 minutes - Data considered fresh for 5 minutes
 * - gcTime: 10 minutes - Cache retained for 10 minutes after unmount
 */
export function useCompetitionDetails(id: number | null) {
  return useQuery<CompetitionData, CompetitionApiError>({
    queryKey: competitionDetailsQueryKeys.detail(id!),
    queryFn: () => fetchCompetitionDetails(id!),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Export types for external use
 */
export type { CompetitionData };
