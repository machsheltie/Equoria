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
 * On success both invalidate the horse and equippable queries.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { horseFeedApi, ApiError, FeedItem } from '@/lib/api-client';

export function useEquipFeed(horseId: number) {
  const queryClient = useQueryClient();

  return useMutation<{ horseId: number; equippedFeedType: string }, ApiError, FeedItem['id']>({
    mutationFn: (feedType) => horseFeedApi.equipFeed(horseId, feedType),
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ['horses', horseId] });
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      queryClient.invalidateQueries({ queryKey: ['equippable', horseId] });
    },
  });
}
