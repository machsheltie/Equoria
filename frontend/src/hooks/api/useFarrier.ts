/**
 * Farrier API Hooks (Epic 10; one weekly action since Equoria-zmqzf)
 *
 * - List the shoe types (data) and the horses the farrier may see
 * - Shoe a horse (once a week)
 *
 * Follows useVet.ts / useGrooms.ts pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  farrierApi,
  ApiError,
  FarrierService,
  FarrierHorse,
  FarrierShoeingResult,
} from '@/lib/api-client';

export type { FarrierService, FarrierHorse, FarrierShoeingResult };

export const farrierKeys = {
  all: ['farrier'] as const,
  services: () => [...farrierKeys.all, 'services'] as const,
  horses: () => [...farrierKeys.all, 'horses'] as const,
};

export function useFarrierServices() {
  return useQuery<FarrierService[], ApiError>({
    queryKey: farrierKeys.services(),
    queryFn: farrierApi.getServices,
    staleTime: 10 * 60 * 1000,
  });
}

export function useFarrierHorses() {
  return useQuery<FarrierHorse[], ApiError>({
    queryKey: farrierKeys.horses(),
    queryFn: farrierApi.getHorses,
  });
}

export function useShoeHorse() {
  const queryClient = useQueryClient();

  return useMutation<FarrierShoeingResult, ApiError, { horseId: number; serviceId: string }>({
    mutationFn: (data) => farrierApi.shoeHorse(data),
    onSuccess: () => {
      // The shod state of the dropdown changed
      queryClient.invalidateQueries({ queryKey: farrierKeys.horses() });
      // Invalidate horse data so lastShod and the stat that rose refresh
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Shoeing spends coins: refresh the live balance (nav + Bank) — Equoria-z3yv3
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
