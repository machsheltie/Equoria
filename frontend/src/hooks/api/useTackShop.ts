/**
 * Tack Shop API Hooks (Epic 10)
 *
 * Centralized hooks for tack shop API calls:
 * - Get inventory (saddles + bridles)
 * - Purchase a tack item for a horse
 * - Unequip a decorative item
 *
 * Tack does not degrade with use — the previous repair flow was removed
 * 2026-05-05 (Equoria-045l).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  tackShopApi,
  ApiError,
  TackItem,
  TackInventoryData,
  TackPurchaseResult,
  TackUnequipDecorationResult,
} from '@/lib/api-client';

export type { TackItem, TackInventoryData, TackPurchaseResult, TackUnequipDecorationResult };

export const tackShopKeys = {
  all: ['tack-shop'] as const,
  inventory: () => [...tackShopKeys.all, 'inventory'] as const,
};

export function useTackInventory() {
  return useQuery<TackInventoryData, ApiError>({
    queryKey: tackShopKeys.inventory(),
    queryFn: tackShopApi.getInventory,
    staleTime: 10 * 60 * 1000, // 10 minutes — catalog rarely changes
  });
}

export function usePurchaseTackItem() {
  const queryClient = useQueryClient();

  return useMutation<TackPurchaseResult, ApiError, { horseId: number; itemId: string }>({
    mutationFn: (data) => tackShopApi.purchaseItem(data),
    onSuccess: (result) => {
      queryClient.setQueryData(
        ['profile'],
        (old: { user: Record<string, unknown> } | undefined) => {
          if (!old?.user) return old;
          return { ...old, user: { ...old.user, money: result.remainingMoney } };
        }
      );
      // Invalidate horse data so tack JSON refreshes
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Background sync after instant balance update
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useUnequipDecoration() {
  const queryClient = useQueryClient();

  return useMutation<TackUnequipDecorationResult, ApiError, { horseId: number; itemId: string }>({
    mutationFn: (data) => tackShopApi.unequipDecoration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horses'] });
    },
  });
}
