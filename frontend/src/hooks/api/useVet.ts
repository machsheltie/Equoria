/**
 * Vet Clinic API Hooks (Epic 10)
 *
 * Centralized hooks for veterinary clinic API calls:
 * - List available vet services
 * - Book an appointment for a horse
 *
 * Follows useGrooms.ts / useRiders.ts pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vetApi, ApiError, VetService, VetAppointmentResult } from '@/lib/api-client';

export type { VetService, VetAppointmentResult };

export const vetKeys = {
  all: ['vet'] as const,
  services: () => [...vetKeys.all, 'services'] as const,
};

export function useVetServices() {
  return useQuery<VetService[], ApiError>({
    queryKey: vetKeys.services(),
    queryFn: vetApi.getServices,
    staleTime: 10 * 60 * 1000, // 10 minutes — catalog rarely changes
  });
}

export function useBookVetAppointment() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; data: VetAppointmentResult },
    ApiError,
    { horseId: number; serviceId: string }
  >({
    mutationFn: (data) => vetApi.bookAppointment(data),
    onSuccess: () => {
      // Invalidate horse data so healthStatus / lastVettedDate refresh
      queryClient.invalidateQueries({ queryKey: ['horses'] });
    },
  });
}
