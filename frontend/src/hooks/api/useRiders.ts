/**
 * Rider Management API Hooks (Epic 9C)
 *
 * Centralized hooks for rider-related API calls:
 * - List user's riders
 * - Rider assignments
 * - Rider marketplace
 * - Hire and assign riders
 * - Rider discovery data
 *
 * Mirrors useGrooms.ts pattern.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ridersApi,
  ApiError,
  Rider,
  RiderAssignment,
  MarketplaceRider,
  RiderMarketplaceData,
  RiderDiscoveryData,
} from '@/lib/api-client';

// Re-export types for convenience
export type { Rider, RiderAssignment, MarketplaceRider, RiderMarketplaceData, RiderDiscoveryData };

// Query Keys
export const riderKeys = {
  all: ['riders'] as const,
  user: (userId: string | number) => [...riderKeys.all, 'user', userId] as const,
  assignments: () => [...riderKeys.all, 'assignments'] as const,
  assignmentsForHorse: (horseId: number) => [...riderKeys.assignments(), 'horse', horseId] as const,
  marketplace: () => [...riderKeys.all, 'marketplace'] as const,
  discovery: (riderId: number) => [...riderKeys.all, 'discovery', riderId] as const,
};

// Hooks
export function useUserRiders(userId: string | number) {
  return useQuery<Rider[], ApiError>({
    queryKey: riderKeys.user(userId),
    queryFn: () => ridersApi.getUserRiders(userId),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useRiderAssignments() {
  return useQuery<RiderAssignment[], ApiError>({
    queryKey: riderKeys.assignments(),
    queryFn: ridersApi.getAssignments,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useRiderMarketplace(options: Record<string, unknown> = {}) {
  return useQuery<RiderMarketplaceData, ApiError>({
    queryKey: riderKeys.marketplace(),
    queryFn: ridersApi.getMarketplace,
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

export function useRiderDiscovery(riderId: number) {
  return useQuery<RiderDiscoveryData, ApiError>({
    queryKey: riderKeys.discovery(riderId),
    queryFn: () => ridersApi.getDiscovery(riderId),
    enabled: Boolean(riderId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useHireRider() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, string>({
    mutationFn: (marketplaceId) => ridersApi.hireRider(marketplaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
    },
  });
}

export function useRefreshRiderMarketplace() {
  const queryClient = useQueryClient();

  return useMutation<RiderMarketplaceData, ApiError, boolean | undefined>({
    mutationFn: (force) => ridersApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.marketplace() });
    },
  });
}

export function useAssignRider() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    ApiError,
    {
      riderId: number;
      horseId: number;
      notes?: string;
    }
  >({
    mutationFn: (data) => ridersApi.assignRider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.assignments() });
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
    },
  });
}

export function useDeleteRiderAssignment() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, number>({
    mutationFn: (assignmentId) => ridersApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.assignments() });
    },
  });
}
