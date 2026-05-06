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
 * clicks, before the POST round-trip starts; on error we roll back to the
 * snapshot captured in onMutate. This gives "click → equipped that second" UX.
 *
 * Equoria-28cj fix (2026-05-06): the root cause was that onSettled called
 * invalidateQueries(['horses', horseId]) which triggered an immediate
 * background GET. Under the Vite dev proxy that GET raced the Prisma commit
 * visibility window and returned the PRE-equip equippedFeedType=null,
 * overwriting the optimistic cache. HorseDetailPage then saw the stale
 * (null) value within its 60s staleTime and never re-fetched.
 * Fix: onSuccess writes equippedFeedType directly into ['horses', horseId]
 * via setQueryData (value comes from the POST response — no DB round-trip
 * needed). onSettled marks all affected queries stale with refetchType:'none'
 * so the next remount/focus refetches without racing the commit.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  horseFeedApi,
  ApiError,
  FeedItem,
  EquippableResponse,
  HorseSummary,
} from '@/lib/api-client';

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
    onSuccess: (data) => {
      // Write equippedFeedType directly into the horse detail cache using
      // the value from the POST response — no refetch needed, no race
      // window between Prisma commit visibility and the next read.
      // (Equoria-28cj root cause: invalidateQueries triggered an immediate
      // background GET that raced the commit and overwrote the optimistic
      // cache with the pre-equip null.)
      queryClient.setQueryData<HorseSummary>(['horses', data.horseId], (prev) =>
        prev ? { ...prev, equippedFeedType: data.equippedFeedType } : prev
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['equippable', horseId], context.previous);
      }
    },
    onSettled: () => {
      // Mark everything stale for next remount/focus — DO NOT trigger
      // immediate refetches; they race the Prisma commit under the Vite
      // dev proxy (Equoria-28cj).
      queryClient.invalidateQueries({ queryKey: ['horses', horseId], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['horses'], refetchType: 'none' });
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
    onSuccess: (data) => {
      queryClient.setQueryData<HorseSummary>(['horses', data.horseId], (prev) =>
        prev ? { ...prev, equippedFeedType: null } : prev
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['equippable', horseId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['horses', horseId], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['horses'], refetchType: 'none' });
      queryClient.invalidateQueries({
        queryKey: ['equippable', horseId],
        refetchType: 'none',
      });
    },
  });
}
