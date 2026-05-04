/**
 * useInventory hook
 *
 * Provides inventory data and equip/unequip mutations via React Query.
 *   - useInventory()        → { items, total, isLoading, error }
 *   - useEquipItem()        → mutation({ inventoryItemId, horseId })
 *   - useUnequipItem()      → mutation({ inventoryItemId })
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api-client';

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

export function useEquipItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { inventoryItemId: string; horseId: number }) =>
      inventoryApi.equipItem(variables),
    onSuccess: (_data, variables) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equippable'] });
    },
  });
}
