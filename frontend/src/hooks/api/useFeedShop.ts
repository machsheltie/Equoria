/**
 * Feed Shop API Hooks (Epic 10)
 *
 * Centralized hooks for feed shop API calls:
 * - Get feed catalog
 * - Purchase feed for a horse
 *
 * Follows useVet.ts / useGrooms.ts pattern.
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

  return useMutation<FeedPurchaseResult, ApiError, { horseId: number; feedId: string }>({
    mutationFn: (data) => feedShopApi.purchaseFeed(data),
    onSuccess: () => {
      // Invalidate horse data so currentFeed / lastFedDate / energyLevel refresh
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Invalidate profile so balance updates in nav
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
