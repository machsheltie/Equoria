/**
 * useFeedHorse hook (feed-system redesign 2026-04-29, Equoria-tt1x).
 *
 * Mutation wrapping POST /api/v1/horses/:id/feed — the daily feed action.
 * Decrements the equipped feed tier from the user's pooled inventory by
 * 1 unit, sets lastFedDate, optionally rolls a stat boost (per-tier
 * statRollPct), and (when inventory hits 0) auto-clears the horse's
 * equippedFeedType.
 *
 * On success, invalidates inventory, the specific horse, the horse list,
 * and the per-horse equippable list so all UI surfaces refresh.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horseFeedApi, ApiError, FeedHorseResponse } from '@/lib/api-client';

export function useFeedHorse(horseId: number) {
  const queryClient = useQueryClient();

  return useMutation<FeedHorseResponse, ApiError, void>({
    mutationFn: () => horseFeedApi.feed(horseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId] });
    },
  });
}
