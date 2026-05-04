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
 * Optimistic update pattern (onMutate): the UI flips the instant the user
 * clicks, before the POST round-trip starts. On success the cache is left
 * as-is (already correct); on error we roll back to the snapshot captured
 * in onMutate so the optimistic flip reverts. This gives "click → equipped
 * that second" UX and survives the stale-GET window documented in
 * Equoria-28cj under NODE_ENV=beta + Vite dev proxy.
 *
 * Stale-GET fix (2026-05-04): onSettled previously invalidated
 * ['equippable', horseId] which triggered an immediate refetch. Under the
 * Vite dev proxy that GET could run before the prisma.horse.update commit
 * was visible to the next read, returning the PRE-mutation
 * equippedFeedType and overwriting the optimistic cache — the user saw the
 * UI flip to the new tier and then revert. We now mark the query stale
 * with refetchType: 'none' so a fresh GET happens on next remount/focus
 * (by which time the DB is consistent) without racing the commit.
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

  return useMutation<
    { horseId: number; equippedFeedType: string },
    ApiError,
    FeedItem['id'],
    { previous?: EquippableResponse }
  >({
    mutationFn: (feedType) => horseFeedApi.equipFeed(horseId, feedType),
    onMutate: async (feedType) => {
      // Cancel in-flight refetches so they can't overwrite the optimistic state.
      await queryClient.cancelQueries({ queryKey: ['equippable', horseId] });
      const previous = queryClient.getQueryData<EquippableResponse>(['equippable', horseId]);
      queryClient.setQueryData<EquippableResponse>(['equippable', horseId], (prev) =>
        patchEquippableFeed(prev, feedType)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['equippable', horseId], context.previous);
      }
    },
    onSettled: () => {
      // Refresh general horse data (no races there).
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Mark equippable stale but DO NOT refetch now — the immediate GET
      // could race the DB commit and overwrite the optimistic cache. Next
      // remount/focus picks up fresh data once the DB is consistent.
      queryClient.invalidateQueries({
        queryKey: ['equippable', horseId],
        refetchType: 'none',
      });
    },
  });
}

export function useUnequipFeed(horseId: number) {
  const queryClient = useQueryClient();

  return useMutation<
    { horseId: number; equippedFeedType: null },
    ApiError,
    void,
    { previous?: EquippableResponse }
  >({
    mutationFn: () => horseFeedApi.unequipFeed(horseId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['equippable', horseId] });
      const previous = queryClient.getQueryData<EquippableResponse>(['equippable', horseId]);
      queryClient.setQueryData<EquippableResponse>(['equippable', horseId], (prev) =>
        patchEquippableFeed(prev, null)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['equippable', horseId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Same stale-GET race as equipFeed — defer the equippable refetch.
      queryClient.invalidateQueries({
        queryKey: ['equippable', horseId],
        refetchType: 'none',
      });
    },
  });
}
