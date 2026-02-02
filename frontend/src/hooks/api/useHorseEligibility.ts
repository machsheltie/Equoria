/**
 * useHorseEligibility Hook
 *
 * Competition Entry System - Horse eligibility query
 *
 * Fetches user's horses with their eligibility status for a specific competition.
 * Eligibility is determined by age, level, health status, and whether already entered.
 *
 * Features:
 * - Conditional fetching (disabled when either ID is null)
 * - Returns eligibility status and reasons for each horse
 * - More frequent refresh (2 minute staleTime) for accurate entry status
 * - Separate cache per competition and user combination
 *
 * @example
 * // Fetch horse eligibility for a competition
 * const { data, isLoading, error } = useHorseEligibility(competitionId, userId);
 *
 * // Filter to only eligible horses
 * const canEnter = data?.filter(h => h.isEligible && !h.alreadyEntered);
 *
 * // Show reasons for ineligibility
 * const ineligible = data?.filter(h => !h.isEligible);
 * ineligible?.forEach(h => console.log(h.name, h.eligibilityReasons));
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchHorseEligibility,
  EligibleHorse,
  CompetitionApiError,
} from '@/lib/api/competitions';

/**
 * Query keys for horse eligibility queries
 *
 * Structure:
 * - all: ['horse-eligibility'] - Base key for all eligibility queries
 * - forCompetition: ['horse-eligibility', competitionId, userId] - Specific combination
 */
export const horseEligibilityQueryKeys = {
  all: ['horse-eligibility'] as const,
  forCompetition: (competitionId: number, userId: string) =>
    [...horseEligibilityQueryKeys.all, competitionId, userId] as const,
};

/**
 * Fetch user's horses with eligibility status for a competition
 *
 * @param competitionId - Competition ID (null disables the query)
 * @param userId - User ID (null disables the query)
 * @returns Query result with eligible horses list, loading states, error
 *
 * Query Options:
 * - enabled: Only fetches when both competitionId and userId are provided
 * - staleTime: 2 minutes - More frequent updates for accurate entry status
 * - gcTime: 5 minutes - Shorter cache retention for eligibility data
 */
export function useHorseEligibility(
  competitionId: number | null,
  userId: string | null
) {
  return useQuery<EligibleHorse[], CompetitionApiError>({
    queryKey: horseEligibilityQueryKeys.forCompetition(competitionId!, userId!),
    queryFn: () => fetchHorseEligibility(competitionId!, userId!),
    enabled: competitionId !== null && userId !== null,
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequent updates)
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Export types for external use
 */
export type { EligibleHorse };
