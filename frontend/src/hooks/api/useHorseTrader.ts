/**
 * useHorseTrader hooks — Epic 21 extension (Horse Trader Store)
 *
 * Provides React Query hooks for the Horse Trader store page:
 *   - useBreeds()         → fetch all breeds (sorted A–Z) for the breed selector
 *   - useBuyStoreHorse()  → mutation to purchase a 3-year-old store horse
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { horseMarketplaceApi, breedsApi, type Breed } from '@/lib/api-client';

export type { Breed };

/** Fetch all breeds from the game DB. Breed list is stable — 10-min stale time. */
export function useBreeds() {
  return useQuery<Breed[]>({
    queryKey: ['breeds'],
    queryFn: breedsApi.list,
    staleTime: 10 * 60 * 1000,
  });
}

/** Purchase a 3-year-old store horse. Invalidates stable and profile (balance) on success. */
export function useBuyStoreHorse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ breedId, sex }: { breedId: number; sex: 'Mare' | 'Stallion' }) =>
      horseMarketplaceApi.buyStoreHorse(breedId, sex),
    onSuccess: (result) => {
      queryClient.setQueryData(
        ['profile'],
        (old: { user: Record<string, unknown> } | undefined) => {
          if (!old?.user) return old;
          return { ...old, user: { ...old.user, money: result.newBalance } };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['horses'] }); // refresh My Stable
      queryClient.invalidateQueries({ queryKey: ['profile'] }); // background sync after instant update
      queryClient.invalidateQueries({ queryKey: ['next-actions'] }); // refresh notification bar
    },
  });
}
