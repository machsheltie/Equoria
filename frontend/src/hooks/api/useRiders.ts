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
import { refreshOnConflict } from '@/lib/http/conflict';
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
    // Owner ruling 2026-10-23 (Equoria-i2xxj): an offline read ends in the
    // Manage tab's error with Try Again. The default networkMode 'online'
    // paused it, and the paused tab fell through to a false "none hired".
    networkMode: 'always',
  });
}

export function useRiderAssignments() {
  return useQuery<RiderAssignment[], ApiError>({
    queryKey: riderKeys.assignments(),
    queryFn: ridersApi.getAssignments,
    staleTime: 60 * 1000, // 1 minute
    // Owner ruling 2026-10-23 (Equoria-i2xxj): an offline read ends in the
    // Manage tab's error with Try Again. The default networkMode 'online'
    // paused it, and the paused tab fell through to a false "none hired".
    networkMode: 'always',
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

  return useMutation<{ rider: Rider; cost: number; remainingMoney: number }, ApiError, string>({
    mutationFn: (marketplaceId) => ridersApi.hireRider(marketplaceId),
    onSuccess: (result) => {
      queryClient.setQueryData(
        ['profile'],
        (old: { user: Record<string, unknown> } | undefined) => {
          if (!old?.user) return old;
          return { ...old, user: { ...old.user, money: result.remainingMoney } };
        }
      );
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    // 409: the marketplace entry was already taken or replaced (Equoria-6p398.13).
    onError: (error) => refreshOnConflict(queryClient, error, [riderKeys.all]),
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
    // 409: the horse is no longer the player's, or the assignment moved on
    // (Equoria-6p398.13).
    onError: (error) => refreshOnConflict(queryClient, error, [riderKeys.all]),
  });
}

export function useDeleteRiderAssignment() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, number>({
    mutationFn: (assignmentId) => ridersApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.assignments() });
    },
    // 409: the assignment is no longer the current one (Equoria-6p398.13).
    onError: (error) => refreshOnConflict(queryClient, error, [riderKeys.all]),
  });
}

/**
 * Dismiss (retire) a rider — FR-RIDER-4 (Equoria-oey96.27). Mirrors
 * useDismissTrainer. The backend DELETE /api/v1/riders/:id/dismiss soft-retires
 * the rider AND deactivates its active assignments; invalidating riderKeys.all
 * (the ['riders'] prefix) refetches both the user roster (retired:false-filtered)
 * and the assignments list, so the dismissed rider + its assignment both drop out.
 * User-visible success/failure feedback is raised at the call site (MyRidersDashboard)
 * via the mutate options, per FRONTEND_ASYNC_STATE_DOCTRINE §2.
 */
export function useDismissRider() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, number>({
    mutationFn: (riderId) => ridersApi.dismissRider(riderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: riderKeys.all });
    },
    // 409: the rider's state moved on (Equoria-6p398.13).
    onError: (error) => refreshOnConflict(queryClient, error, [riderKeys.all]),
  });
}
