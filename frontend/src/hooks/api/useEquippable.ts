/**
 * useEquippable hook (feed-system redesign 2026-04-29, Equoria-tt1x).
 *
 * Query wrapping GET /api/v1/horses/:id/equippable — returns the items the
 * user can equip on the given horse: tack (excluding tack equipped to a
 * different horse) plus all 5 feed tiers in inventory with quantity > 0,
 * each tagged with `isCurrentlyEquippedToThisHorse`.
 *
 * staleTime: 30 seconds — inventory + equipped state changes when the user
 * feeds, equips, or buys feed; per-horse refreshing on those mutations is
 * handled via invalidation in useFeedHorse / useEquipFeed.
 */

import { useQuery } from '@tanstack/react-query';
import { horseFeedApi, ApiError, EquippableResponse } from '@/lib/api-client';

export function useEquippable(horseId: number) {
  return useQuery<EquippableResponse, ApiError>({
    queryKey: ['equippable', horseId],
    queryFn: () => horseFeedApi.getEquippable(horseId),
    staleTime: 30_000,
  });
}
