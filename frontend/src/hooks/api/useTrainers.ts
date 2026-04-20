/**
 * Trainer Management API Hooks (Epic 13)
 *
 * Centralized hooks for trainer-related API calls:
 * - List user's trainers
 * - Trainer assignments
 * - Trainer marketplace
 * - Hire and assign trainers
 * - Dismiss trainers
 *
 * Mirrors useRiders.ts / useGrooms.ts pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  trainersApi,
  ApiError,
  TrainerEntry,
  TrainerAssignmentEntry,
  MarketplaceTrainer,
  TrainerMarketplaceData,
  TrainerDiscoveryData,
} from '@/lib/api-client';

// Re-export types for convenience
export type {
  TrainerEntry,
  TrainerAssignmentEntry,
  MarketplaceTrainer,
  TrainerMarketplaceData,
  TrainerDiscoveryData,
};

// Query Keys
export const trainerKeys = {
  all: ['trainers'] as const,
  user: (userId: string | number) => [...trainerKeys.all, 'user', userId] as const,
  assignments: () => [...trainerKeys.all, 'assignments'] as const,
  marketplace: () => [...trainerKeys.all, 'marketplace'] as const,
  discovery: (trainerId: number) => [...trainerKeys.all, 'discovery', trainerId] as const,
};

// Hooks

export function useUserTrainers(userId: string | number) {
  return useQuery<TrainerEntry[], ApiError>({
    queryKey: trainerKeys.user(userId),
    queryFn: () => trainersApi.getUserTrainers(userId),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useTrainerAssignments() {
  return useQuery<TrainerAssignmentEntry[], ApiError>({
    queryKey: trainerKeys.assignments(),
    queryFn: trainersApi.getAssignments,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useTrainerMarketplace(options: Record<string, unknown> = {}) {
  return useQuery<TrainerMarketplaceData, ApiError>({
    queryKey: trainerKeys.marketplace(),
    queryFn: trainersApi.getMarketplace,
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

export function useHireTrainer() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; data: { trainer: TrainerEntry; cost: number; remainingMoney: number } },
    ApiError,
    string
  >({
    mutationFn: (marketplaceId) => trainersApi.hireTrainer(marketplaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainerKeys.all });
    },
  });
}

export function useRefreshTrainerMarketplace() {
  const queryClient = useQueryClient();

  return useMutation<TrainerMarketplaceData, ApiError, boolean | undefined>({
    mutationFn: (force) => trainersApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainerKeys.marketplace() });
    },
  });
}

export function useAssignTrainer() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    ApiError,
    {
      trainerId: number;
      horseId: number;
      notes?: string;
    }
  >({
    mutationFn: (data) => trainersApi.assignTrainer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainerKeys.assignments() });
      queryClient.invalidateQueries({ queryKey: trainerKeys.all });
    },
  });
}

export function useDeleteTrainerAssignment() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, number>({
    mutationFn: (assignmentId) => trainersApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainerKeys.assignments() });
    },
  });
}

export function useDismissTrainer() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, number>({
    mutationFn: (trainerId) => trainersApi.dismissTrainer(trainerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainerKeys.all });
    },
  });
}

/**
 * Trainer discovery slots — 3 categories × 2 slots, unlocked by trainer level.
 * Returns the live server-generated profile (never a client-side empty stub).
 */
export function useTrainerDiscovery(trainerId: number | null | undefined) {
  return useQuery<TrainerDiscoveryData, ApiError>({
    queryKey: trainerId ? trainerKeys.discovery(trainerId) : trainerKeys.all,
    queryFn: () => trainersApi.getDiscovery(trainerId as number),
    enabled: Boolean(trainerId),
    staleTime: 60 * 1000, // 1 minute — recompiles on trainer level up
  });
}
