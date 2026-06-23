/**
 * useClaimPrizes Hook
 *
 * Prize System - Competition prize claiming mutation
 *
 * Submits a request to claim prizes from a competition.
 * Handles prize transfer, balance updates, and cache invalidation.
 *
 * Features:
 * - Automatic cache invalidation on success
 * - Invalidates prize history, horse prize summary, and profile caches
 * - Meaningful error messages from API
 *
 * NOTE (Equoria-b0cjn): the mutation does NOT read the response body. The
 * backend echoes the settled CompetitionResult row (PrizeClaimResult), which
 * carries no balance/XP/claim-state — the updated balance and history surface
 * through cache invalidation in onSuccess, not by reading `data`.
 *
 * @example
 * // Basic usage
 * const { mutate, isPending, error } = useClaimPrizes();
 *
 * // Submit claim — balance/history refresh via cache invalidation on success
 * mutate({ competitionId: 123 });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { claimCompetitionPrizes, PrizeClaimResult, PrizeApiError } from '@/lib/api/prizes';
import { prizeHistoryQueryKeys } from './usePrizeHistory';
import { horsePrizeSummaryQueryKeys } from './useHorsePrizeSummary';

/**
 * Variables for the claim prizes mutation
 */
export interface ClaimPrizesVariables {
  competitionId: number;
}

/**
 * Submit a claim for competition prizes
 *
 * @returns Mutation result with mutate, isPending, error, data
 *
 * On Success:
 * - Invalidates prize history cache (prizes are now claimed)
 * - Invalidates horse prize summary cache (unclaimed count updated)
 * - Invalidates user data cache (balance has been credited)
 */
export function useClaimPrizes() {
  const queryClient = useQueryClient();

  return useMutation<PrizeClaimResult, PrizeApiError, ClaimPrizesVariables>({
    mutationFn: (variables: ClaimPrizesVariables) =>
      claimCompetitionPrizes(variables.competitionId),
    onSuccess: () => {
      // Invalidate prize history to refresh claimed status
      queryClient.invalidateQueries({
        queryKey: prizeHistoryQueryKeys.all,
      });

      // Invalidate horse prize summaries (unclaimed count changed)
      queryClient.invalidateQueries({
        queryKey: horsePrizeSummaryQueryKeys.all,
      });

      // Invalidate profile (balance has been credited — nav reads from ['profile'])
      queryClient.invalidateQueries({
        queryKey: ['profile'],
      });

      // Invalidate notifications (prize-related notifications may now appear)
      queryClient.invalidateQueries({
        queryKey: ['game-notifications'],
      });
    },
    onError: (error) => {
      // Error is already properly structured by the API client
      // Log for debugging purposes (will be suppressed in tests)
      if (import.meta.env.MODE !== 'test') {
        console.error('Failed to claim prizes:', error.message);
      }
    },
  });
}
