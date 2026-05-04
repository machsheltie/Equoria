/**
 * useEquipFeed / useUnequipFeed hooks (feed-system redesign 2026-04-29, Equoria-tt1x).
 *
 * Mutations wrapping:
 *   POST /api/v1/horses/:id/equip-feed   — set Horse.equippedFeedType
 *   POST /api/v1/horses/:id/unequip-feed — clear it
 *
 * Equip is a preference flag, not an inventory reservation: 1 unit lets a
 * user equip a tier on N horses; the actual unit is decremented at feed-time.
 *
 * On success we (a) imperatively patch the ['equippable', horseId] cache via
 * setQueryData so the UI reflects the new equipped tier without waiting for
 * a refetch round-trip — this is the only way to avoid the stale-GET window
 * documented in Equoria-28cj under NODE_ENV=beta + Vite dev proxy — and
 * (b) invalidate horses queries so other surfaces eventually catch up.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horseFeedApi, ApiError, FeedItem, EquippableResponse } from '@/lib/api-client';

function patchEquippableFeed(
  prev: EquippableResponse | undefined,
  newEquippedType: string | null
): EquippableResponse | undefined {
  if (!prev) return prev;
  return {
    ...prev,
    feed: prev.feed.map((f) => ({
      ...f,
      isCurrentlyEquippedToThisHorse: newEquippedType !== null && f.feedType === newEquippedType,
    })),
  };
}

export function useEquipFeed(horseId: number) {
  const queryClient = useQueryClient();

  return useMutation<{ horseId: number; equippedFeedType: string }, ApiError, FeedItem['id']>({
    mutationFn: (feedType) => horseFeedApi.equipFeed(horseId, feedType),
    onSuccess: (data) => {
      queryClient.setQueryData<EquippableResponse>(['equippable', horseId], (prev) =>
        patchEquippableFeed(prev, data.equippedFeedType)
      );
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId] });
    },
  });
}

export function useUnequipFeed(horseId: number) {
  const queryClient = useQueryClient();

  return useMutation<{ horseId: number; equippedFeedType: null }, ApiError, void>({
    mutationFn: () => horseFeedApi.unequipFeed(horseId),
    onSuccess: () => {
      queryClient.setQueryData<EquippableResponse>(['equippable', horseId], (prev) =>
        patchEquippableFeed(prev, null)
      );
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId] });
    },
  });
}
