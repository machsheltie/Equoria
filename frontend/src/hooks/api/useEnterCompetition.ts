/**
 * useEnterCompetition Hook
 *
 * Competition Entry System - Competition entry mutation
 *
 * Submits entry for one or more horses into a competition.
 * Handles validation, fee deduction, and cache invalidation.
 *
 * Features:
 * - Automatic cache invalidation on success
 * - Meaningful error messages from API
 * - Partial success handling (some horses may fail)
 * - Invalidates related queries (competitions, eligibility, user balance)
 *
 * @example
 * // Basic usage
 * const { mutate, isPending, error, data } = useEnterCompetition();
 *
 * // Submit entry
 * mutate({ competitionId: 123, horseIds: [1, 2, 3] });
 *
 * // Handle result
 * if (data?.success) {
 *   console.log(`Entered ${data.entryIds.length} horses`);
 *   console.log(`Total cost: ${data.totalCost}`);
 * }
 *
 * // Handle partial success
 * if (data?.failedEntries?.length) {
 *   data.failedEntries.forEach(e => {
 *     console.log(`Horse ${e.horseId} failed: ${e.reason}`);
 *   });
 * }
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  submitCompetitionEntry,
  EntryData,
  EntryResult,
  CompetitionApiError,
} from '@/lib/api/competitions';
import { competitionFilteredQueryKeys } from './useCompetitionsFiltered';
import { competitionDetailsQueryKeys } from './useCompetitionDetails';
import { horseEligibilityQueryKeys } from './useHorseEligibility';

/**
 * Submit entry to a competition
 *
 * @returns Mutation result with mutate, isPending, error, data
 *
 * On Success:
 * - Invalidates competitions list (participant count updated)
 * - Invalidates specific competition details
 * - Invalidates horse eligibility (horses marked as entered)
 * - Invalidates user data (balance deducted)
 */
export function useEnterCompetition() {
  const queryClient = useQueryClient();

  return useMutation<EntryResult, CompetitionApiError, EntryData>({
    mutationFn: (entry: EntryData) => submitCompetitionEntry(entry),
    onSuccess: (data, variables) => {
      // Invalidate competitions list to update participant counts
      queryClient.invalidateQueries({
        queryKey: competitionFilteredQueryKeys.all,
      });

      // Invalidate specific competition details
      queryClient.invalidateQueries({
        queryKey: competitionDetailsQueryKeys.detail(variables.competitionId),
      });

      // Invalidate all horse eligibility queries
      // (horses are now marked as entered)
      queryClient.invalidateQueries({
        queryKey: horseEligibilityQueryKeys.all,
      });

      // Invalidate user data (balance has been deducted)
      queryClient.invalidateQueries({
        queryKey: ['user'],
      });
    },
    onError: (error) => {
      // Error is already properly structured by the API client
      // Log for debugging purposes (will be suppressed in tests)
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to enter competition:', error.message);
      }
    },
  });
}

/**
 * Export types for external use
 */
export type { EntryData, EntryResult };
