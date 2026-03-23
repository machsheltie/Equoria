/**
 * Tack Shop API Hooks (Epic 10)
 *
 * Centralized hooks for tack shop API calls:
 * - Get inventory (saddles + bridles)
 * - Purchase a tack item for a horse
 *
 * Follows useGrooms.ts / useRiders.ts pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  tackShopApi,
  ApiError,
  TackItem,
  TackInventoryData,
  TackPurchaseResult,
} from '@/lib/api-client';

export type { TackItem, TackInventoryData, TackPurchaseResult };

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
    onSuccess: () => {
      // Invalidate horse data so tack JSON refreshes
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Invalidate profile so balance updates in nav
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
