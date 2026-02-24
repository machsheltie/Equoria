/**
 * Farrier API Hooks (Epic 10)
 *
 * Centralized hooks for farrier clinic API calls:
 * - List available farrier services
 * - Book a service for a horse
 *
 * Follows useVet.ts / useGrooms.ts pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { farrierApi, ApiError, FarrierService, FarrierBookingResult } from '@/lib/api-client';

export type { FarrierService, FarrierBookingResult };

export const farrierKeys = {
  all: ['farrier'] as const,
  services: () => [...farrierKeys.all, 'services'] as const,
};

export function useFarrierServices() {
  return useQuery<FarrierService[], ApiError>({
    queryKey: farrierKeys.services(),
    queryFn: farrierApi.getServices,
    staleTime: 10 * 60 * 1000, // 10 minutes — catalog rarely changes
  });
}

export function useBookFarrierService() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; data: FarrierBookingResult },
    ApiError,
    { horseId: number; serviceId: string }
  >({
    mutationFn: (data) => farrierApi.bookService(data),
    onSuccess: () => {
      // Invalidate horse data so hoofCondition / lastFarrierDate / lastShod refresh
      queryClient.invalidateQueries({ queryKey: ['horses'] });
    },
  });
}
