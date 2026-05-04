/**
 * useInventory hook
 *
 * Provides inventory data and equip/unequip mutations via React Query.
 *   - useInventory()        → { items, total, isLoading, error }
 *   - useEquipItem()        → mutation({ inventoryItemId, horseId })
 *   - useUnequipItem()      → mutation({ inventoryItemId })
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi, EquippableResponse } from '@/lib/api-client';

/** Stale for 60 s — items change only when user equips/unequips */
const STALE_TIME = 60_000;

export function useInventory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.getInventory(),
    staleTime: STALE_TIME,
  });

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
  };
}

/**
 * Imperatively patch the ['equippable', horseId] cache for an equip/unequip
 * tack action so HorseEquipPage updates the row in place without waiting for
 * a refetch (matches the feed-equip optimistic-patch pattern; avoids the
 * stale-GET window documented in Equoria-28cj).
 */
function patchEquippableTack(
  prev: EquippableResponse | undefined,
  inventoryItemId: string,
  newHorseId: number | null
): EquippableResponse | undefined {
  if (!prev) return prev;
  return {
    ...prev,
    tack: prev.tack.map((t) =>
      t.id === inventoryItemId ? { ...t, equippedToHorseId: newHorseId } : t
    ),
  };
}

export function useEquipItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { inventoryItemId: string; horseId: number }) =>
      inventoryApi.equipItem(variables),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<EquippableResponse>(['equippable', variables.horseId], (prev) =>
        patchEquippableTack(prev, variables.inventoryItemId, variables.horseId)
      );
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      // HorseEquipPage relies on this so the tack list updates in place after
      // equipping inline. Invalidate both the target horse and any prior horse
      // (we don't know the prior id here — broad invalidation by prefix).
      queryClient.invalidateQueries({ queryKey: ['equippable'] });
      queryClient.invalidateQueries({ queryKey: ['horse', variables.horseId] });
    },
  });
}

export function useUnequipItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { inventoryItemId: string }) => inventoryApi.unequipItem(variables),
    onSuccess: (_data, variables) => {
      // Patch every cached equippable view that contains this item.
      const cache = queryClient.getQueryCache();
      for (const query of cache.findAll({ queryKey: ['equippable'] })) {
        queryClient.setQueryData<EquippableResponse>(query.queryKey, (prev) =>
          patchEquippableTack(prev, variables.inventoryItemId, null)
        );
      }
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equippable'] });
    },
  });
}
