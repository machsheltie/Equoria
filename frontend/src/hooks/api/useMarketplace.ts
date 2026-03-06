/**
 * useMarketplace hooks (Epic 21)
 *
 * React Query hooks for the horse marketplace system.
 *   - useMarketplaceListings(filters?) → browse paginated listings
 *   - useMyListings()                  → seller's active listings
 *   - useSaleHistory()                 → user's buy + sell history
 *   - useListHorse()                   → mutation: list a horse for sale
 *   - useDelistHorse()                 → mutation: remove a listing
 *   - useBuyHorse()                    → mutation: purchase a horse atomically
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { horseMarketplaceApi, MarketplaceBrowseFilters } from '@/lib/api-client';
import { toast } from 'sonner';

export function useMarketplaceListings(filters?: MarketplaceBrowseFilters) {
  return useQuery({
    queryKey: ['marketplace', 'listings', filters],
    queryFn: () => horseMarketplaceApi.browse(filters),
    staleTime: 60_000, // 1 minute
  });
}

export function useMyListings() {
  return useQuery({
    queryKey: ['marketplace', 'my-listings'],
    queryFn: () => horseMarketplaceApi.myListings(),
    staleTime: 30_000,
  });
}

export function useSaleHistory() {
  return useQuery({
    queryKey: ['marketplace', 'history'],
    queryFn: () => horseMarketplaceApi.saleHistory(),
    staleTime: 60_000,
  });
}

export function useListHorse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { horseId: number; price: number }) => horseMarketplaceApi.listHorse(data),
    onSuccess: (_data, vars) => {
      toast.success(`Your horse is now listed for ${vars.price.toLocaleString()} coins`);
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      qc.invalidateQueries({ queryKey: ['horses'] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to list horse');
    },
  });
}

export function useDelistHorse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (horseId: number) => horseMarketplaceApi.delistHorse(horseId),
    onSuccess: () => {
      toast.success('Listing removed');
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      qc.invalidateQueries({ queryKey: ['horses'] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to remove listing');
    },
  });
}

export function useBuyHorse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (horseId: number) => horseMarketplaceApi.buyHorse(horseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace'] });
      qc.invalidateQueries({ queryKey: ['horses'] });
      qc.invalidateQueries({ queryKey: ['profile'] }); // update coin balance in header
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Purchase failed');
    },
  });
}
