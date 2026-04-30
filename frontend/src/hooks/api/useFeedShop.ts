/**
 * Feed Shop API Hooks (feed-system redesign 2026-04-29, Equoria-tt1x).
 *
 * Centralized hooks for the bulk-purchase feed shop:
 * - useFeedCatalog: 5-tier catalog (basic, performance, performancePlus, highPerformance, elite)
 * - usePurchaseFeed: bulk pack purchase ({ feedTier, packs }); each pack = 100 units
 *
 * Inventory is pooled at the user level (User.settings.inventory) — same-tier
 * purchases accumulate on a single inventory row. Equipping a tier to a horse
 * is a separate action (useEquipFeed).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedShopApi, ApiError, FeedItem, FeedPurchaseResult } from '@/lib/api-client';

export type { FeedItem, FeedPurchaseResult };

export const feedShopKeys = {
  all: ['feed-shop'] as const,
  catalog: () => [...feedShopKeys.all, 'catalog'] as const,
};

export function useFeedCatalog() {
  return useQuery<FeedItem[], ApiError>({
    queryKey: feedShopKeys.catalog(),
    queryFn: feedShopApi.getCatalog,
    staleTime: 10 * 60 * 1000, // 10 minutes — catalog rarely changes
  });
}

export function usePurchaseFeed() {
  const queryClient = useQueryClient();

  return useMutation<FeedPurchaseResult, ApiError, { feedTier: FeedItem['id']; packs: number }>({
    mutationFn: (data) => feedShopApi.purchase(data),
    onSuccess: () => {
      // Inventory grew — refresh inventory + balance + per-horse equippable.
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['equippable'] });
    },
  });
}
