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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUnequipItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: { inventoryItemId: string }) => inventoryApi.unequipItem(variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
