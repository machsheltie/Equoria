/**
 * useInventory hook
 *
 * Provides inventory data and equip/unequip mutations via React Query.
 *   - useInventory()        → { items, total, isLoading, error }
 *   - useEquipItem()        → mutation({ inventoryItemId, horseId })
 *   - useUnequipItem()      → mutation({ inventoryItemId })
 *
 * Equip/unequip use optimistic updates (onMutate) so the UI flips the
 * instant the user clicks, before the POST round-trip finishes. On error
 * the snapshot captured in onMutate is restored. This avoids the
 * "click and wait" feel and survives the stale-GET window documented in
 * Equoria-28cj under NODE_ENV=beta + Vite dev proxy.
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

interface EquippableSnapshot {
  queryKey: readonly unknown[];
  data: EquippableResponse | undefined;
}

export function useEquipItem() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { inventoryItemId: string; horseId: number },
    { snapshots: EquippableSnapshot[] }
  >({
    mutationFn: (variables) => inventoryApi.equipItem(variables),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['equippable', variables.horseId] });
      // Snapshot every cached equippable view (we may need to restore them on error).
      const cache = queryClient.getQueryCache();
      const snapshots: EquippableSnapshot[] = cache
        .findAll({ queryKey: ['equippable'] })
        .map((q) => ({
          queryKey: q.queryKey,
          data: queryClient.getQueryData<EquippableResponse>(q.queryKey),
        }));
      // Optimistically flip the target equippable view.
      queryClient.setQueryData<EquippableResponse>(['equippable', variables.horseId], (prev) =>
        patchEquippableTack(prev, variables.inventoryItemId, variables.horseId)
      );
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const snap of context.snapshots) {
          queryClient.setQueryData(snap.queryKey, snap.data);
        }
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equippable'] });
      queryClient.invalidateQueries({ queryKey: ['horse', variables.horseId] });
    },
  });
}

export function useUnequipItem() {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    { inventoryItemId: string },
    { snapshots: EquippableSnapshot[] }
  >({
    mutationFn: (variables) => inventoryApi.unequipItem(variables),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['equippable'] });
      const cache = queryClient.getQueryCache();
      const snapshots: EquippableSnapshot[] = cache
        .findAll({ queryKey: ['equippable'] })
        .map((q) => ({
          queryKey: q.queryKey,
          data: queryClient.getQueryData<EquippableResponse>(q.queryKey),
        }));
      // Optimistically clear equippedToHorseId on this item across every cached view.
      for (const snap of snapshots) {
        queryClient.setQueryData<EquippableResponse>(snap.queryKey, (prev) =>
          patchEquippableTack(prev, variables.inventoryItemId, null)
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const snap of context.snapshots) {
          queryClient.setQueryData(snap.queryKey, snap.data);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equippable'] });
    },
  });
}
