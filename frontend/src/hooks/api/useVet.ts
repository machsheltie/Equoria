/**
 * Vet Clinic API Hooks (Epic 10; two services since Equoria-7dmzp)
 *
 * - List the two vet services
 * - List the horses the vet may see, with their vetted / tested state
 * - Book a service for a horse
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vetApi, ApiError, VetService, VetHorse, VetAppointmentResult } from '@/lib/api-client';

export type { VetService, VetHorse, VetAppointmentResult };

export const vetKeys = {
  all: ['vet'] as const,
  services: () => [...vetKeys.all, 'services'] as const,
  horses: () => [...vetKeys.all, 'horses'] as const,
};

export function useVetServices() {
  return useQuery<VetService[], ApiError>({
    queryKey: vetKeys.services(),
    queryFn: vetApi.getServices,
    staleTime: 10 * 60 * 1000, // 10 minutes: the catalogue rarely changes
  });
}

export function useVetHorses() {
  return useQuery<VetHorse[], ApiError>({
    queryKey: vetKeys.horses(),
    queryFn: vetApi.getHorses,
  });
}

export function useBookVetAppointment() {
  const queryClient = useQueryClient();

  return useMutation<VetAppointmentResult, ApiError, { horseId: number; serviceId: string }>({
    mutationFn: (data) => vetApi.bookAppointment(data),
    onSuccess: () => {
      // The vetted / tested state of the dropdowns changed
      queryClient.invalidateQueries({ queryKey: vetKeys.horses() });
      // Invalidate horse data so health / genetics refresh
      queryClient.invalidateQueries({ queryKey: ['horses'] });
      // Invalidate profile so nav coin balance updates after payment
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
