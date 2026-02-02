/**
 * Groom Management API Hooks
 *
 * Centralized hooks for groom-related API calls:
 * - List user's grooms
 * - Groom assignments
 * - Groom marketplace
 * - Hire and assign grooms
 * - Salary summaries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  groomsApi,
  ApiError,
  Groom,
  GroomAssignment,
  MarketplaceGroom,
  SalarySummary,
} from '@/lib/api-client';

// Query Keys
export const groomKeys = {
  all: ['grooms'] as const,
  user: (userId: string | number) => [...groomKeys.all, 'user', userId] as const,
  assignments: () => [...groomKeys.all, 'assignments'] as const,
  assignmentsForHorse: (horseId: number) => [...groomKeys.assignments(), 'horse', horseId] as const,
  salaries: () => [...groomKeys.all, 'salaries'] as const,
  marketplace: () => [...groomKeys.all, 'marketplace'] as const,
};

// Hooks
export function useUserGrooms(userId: string | number) {
  return useQuery<Groom[], ApiError>({
    queryKey: groomKeys.user(userId),
    queryFn: () => groomsApi.getUserGrooms(userId),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useGroomAssignments() {
  return useQuery<GroomAssignment[], ApiError>({
    queryKey: groomKeys.assignments(),
    queryFn: groomsApi.getAssignments,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useGroomSalaries() {
  return useQuery<SalarySummary, ApiError>({
    queryKey: groomKeys.salaries(),
    queryFn: groomsApi.getSalarySummary,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useGroomMarketplace(options: any = {}) {
  return useQuery<MarketplaceGroom[], ApiError>({
    queryKey: groomKeys.marketplace(),
    queryFn: groomsApi.getMarketplace,
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

export function useHireGroom() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, string>({
    mutationFn: (marketplaceId) => groomsApi.hireGroom(marketplaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.all });
    },
  });
}

export function useRefreshMarketplace() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, boolean | undefined>({
    mutationFn: (force) => groomsApi.refreshMarketplace(force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.marketplace() });
    },
  });
}

export function useAssignGroom() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    ApiError,
    {
      groomId: number;
      horseId: number;
      priority: number;
      notes?: string;
      replacePrimary?: boolean;
    }
  >({
    mutationFn: (data) => groomsApi.assignGroom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.assignments() });
      queryClient.invalidateQueries({ queryKey: groomKeys.all });
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiError, number>({
    mutationFn: (assignmentId) => groomsApi.deleteAssignment(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groomKeys.assignments() });
    },
  });
}
