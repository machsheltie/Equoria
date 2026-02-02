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
 * - Invalidates prize history, horse prize summary, and user balance caches
 * - Meaningful error messages from API
 * - Supports partial success handling (errors array)
 *
 * @example
 * // Basic usage
 * const { mutate, isPending, error, data } = useClaimPrizes();
 *
 * // Submit claim
 * mutate({ competitionId: 123 });
 *
 * // Handle result
 * if (data?.success) {
 *   console.log(`Claimed $${data.prizesClaimed.reduce((sum, p) => sum + p.prizeMoney, 0)}`);
 *   console.log(`New balance: $${data.newBalance}`);
 * }
 *
 * // Handle partial success
 * if (data?.errors?.length) {
 *   data.errors.forEach(e => console.log(`Warning: ${e}`));
 * }
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  claimCompetitionPrizes,
  PrizeClaimResult,
  PrizeApiError,
} from '@/lib/api/prizes';
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

      // Invalidate user data (balance has been credited)
      queryClient.invalidateQueries({
        queryKey: ['user'],
      });
    },
    onError: (error) => {
      // Error is already properly structured by the API client
      // Log for debugging purposes (will be suppressed in tests)
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to claim prizes:', error.message);
      }
    },
  });
}
