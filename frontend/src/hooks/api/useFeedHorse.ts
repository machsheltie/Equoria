/**
 * useFeedHorse hook (feed-system redesign 2026-04-29, Equoria-tt1x).
 *
 * Mutation wrapping POST /api/v1/horses/:id/feed — the daily feed action.
 * Decrements the equipped feed tier from the user's pooled inventory by
 * 1 unit, sets lastFedDate, optionally rolls a stat boost (per-tier
 * statRollPct), and (when inventory hits 0) auto-clears the horse's
 * equippedFeedType.
 *
 * Equoria-28cj follow-up: onSuccess writes lastFedDate and equippedFeedType
 * directly into ['horses', horseId] via setQueryData using the values from
 * the POST response — same pattern as useEquipFeed — so the action-feed
 * button disables immediately without racing a background GET against the
 * Prisma commit window. onSettled marks all affected queries stale with
 * refetchType:'none' so they refetch on next remount/focus.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horseFeedApi, ApiError, FeedHorseResponse, HorseSummary } from '@/lib/api-client';

export function useFeedHorse(horseId: number) {
  const queryClient = useQueryClient();

  return useMutation<FeedHorseResponse, ApiError, void>({
    mutationFn: () => horseFeedApi.feed(horseId),
    onSuccess: (data) => {
      if (!data.skipped) {
        queryClient.setQueryData<HorseSummary>(['horses', data.horse.id], (prev) =>
          prev
            ? {
                ...prev,
                lastFedDate: data.horse.lastFedDate,
                equippedFeedType: data.horse.equippedFeedType,
              }
            : prev
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['horses', horseId], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['horses'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId], refetchType: 'none' });
    },
  });
}
