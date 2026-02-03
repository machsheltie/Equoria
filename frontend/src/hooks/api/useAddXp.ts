/**
 * useAddXp Hook
 *
 * XP System - Add XP mutation
 *
 * Submits a request to add XP to a horse from a specific source.
 * Handles cache invalidation for related queries on success.
 *
 * Features:
 * - Automatic cache invalidation on success
 * - Invalidates horse level info and XP history caches
 * - Meaningful error messages from API
 * - Supports level-up detection
 *
 * @example
 * // Basic usage
 * const { mutate, isPending, error, data } = useAddXp();
 *
 * // Submit XP addition
 * mutate({
 *   horseId: 123,
 *   xpAmount: 50,
 *   source: 'competition',
 *   sourceId: 456,
 *   sourceName: 'Spring Championship',
 * });
 *
 * // Handle result
 * if (data?.leveledUp) {
 *   console.log(`Leveled up to ${data.newLevel}!`);
 * }
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addXp,
  AddXpResult,
  XpApiError,
} from '@/lib/api/xp';
import { horseLevelInfoQueryKeys } from './useHorseLevelInfo';
import { xpHistoryQueryKeys } from './useXpHistory';

/**
 * Variables for the add XP mutation
 */
export interface AddXpVariables {
  horseId: number;
  xpAmount: number;
  source: 'competition' | 'training' | 'achievement' | 'bonus';
  sourceId: number;
  sourceName: string;
}

/**
 * Submit an XP addition for a horse
 *
 * @returns Mutation result with mutate, isPending, error, data
 *
 * On Success:
 * - Invalidates horse level info cache (XP and level changed)
 * - Invalidates XP history cache for the specific horse (new entry added)
 * - Invalidates all XP history queries (for filtered queries)
 */
export function useAddXp() {
  const queryClient = useQueryClient();

  return useMutation<AddXpResult, XpApiError, AddXpVariables>({
    mutationFn: (variables: AddXpVariables) => addXp(variables),
    onSuccess: (data, variables) => {
      // Invalidate horse level info (XP and level changed)
      queryClient.invalidateQueries({
        queryKey: horseLevelInfoQueryKeys.horse(variables.horseId),
      });

      // Invalidate XP history for the specific horse (new entry added)
      queryClient.invalidateQueries({
        queryKey: xpHistoryQueryKeys.horse(variables.horseId),
      });

      // Invalidate all XP history queries (for filtered queries)
      queryClient.invalidateQueries({
        queryKey: xpHistoryQueryKeys.all,
      });
    },
    onError: (error) => {
      // Error is already properly structured by the API client
      // Log for debugging purposes (will be suppressed in tests)
      if (process.env.NODE_ENV !== 'test') {
        console.error('Failed to add XP:', error.message);
      }
    },
  });
}
