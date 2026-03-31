/**
 * Tack Shop API Hooks (Epic 10)
 *
 * Centralized hooks for tack shop API calls:
 * - Get inventory (saddles + bridles)
 * - Purchase a tack item for a horse
 * - Repair a tack item (restore condition to 100)
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
  TackRepairResult,
  TackUnequipDecorationResult,
} from '@/lib/api-client';

export type {
  TackItem,
  TackInventoryData,
  TackPurchaseResult,
  TackRepairResult,
  TackUnequipDecorationResult,
};

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

export function useRepairTack() {
  const queryClient = useQueryClient();

  return useMutation<TackRepairResult, ApiError, { horseId: number; category: string }>({
    mutationFn: (data) => tackShopApi.repairItem(data),
    onSuccess: () => {
      // Refresh horse data so condition values update
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Refresh profile so balance updates in nav
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
