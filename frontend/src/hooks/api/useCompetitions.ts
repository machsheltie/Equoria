/**
 * Competition API Hooks
 *
 * Centralized hooks for competition-related API calls:
 * - List competitions with filtering
 * - Get available disciplines
 * - Check horse eligibility
 * - Enter competition
 */

import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { competitionsApi, ApiError, Competition, EligibilityResult } from '@/lib/api-client';

// Query Keys
export const competitionKeys = {
  all: ['competitions'] as const,
  list: () => [...competitionKeys.all, 'list'] as const,
  disciplines: () => [...competitionKeys.all, 'disciplines'] as const,
  eligibility: (horseId: number, discipline: string) =>
    [...competitionKeys.all, 'eligibility', horseId, discipline] as const,
};

// Hooks
export function useCompetitions() {
  return useQuery<Competition[], ApiError>({
    queryKey: competitionKeys.list(),
    queryFn: competitionsApi.list,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDisciplines() {
  return useQuery<{ disciplines: string[]; disciplineDetails: any[] }, ApiError>({
    queryKey: competitionKeys.disciplines(),
    queryFn: competitionsApi.getDisciplines,
    staleTime: 30 * 60 * 1000, // 30 minutes (rarely changes)
  });
}

export function useEligibility(horseId: number, discipline: string) {
  return useQuery<EligibilityResult, ApiError>({
    queryKey: competitionKeys.eligibility(horseId, discipline),
    queryFn: async () => {
      const result = await competitionsApi.checkEligibility(horseId, discipline);
      return result.data.eligibility;
    },
    enabled: horseId > 0 && Boolean(discipline),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useEligibilityForHorses(discipline: string, horseIds: number[]) {
  return useQueries({
    queries: horseIds.map((horseId) => ({
      queryKey: competitionKeys.eligibility(horseId, discipline),
      queryFn: async () => {
        const result = await competitionsApi.checkEligibility(horseId, discipline);
        return result.data.eligibility;
      },
      enabled: horseId > 0 && Boolean(discipline),
      staleTime: 60 * 1000,
    })),
  });
}

export function useEnterCompetition() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; data: { entryId: number } },
    ApiError,
    {
      horseId: number;
      competitionId: number;
    }
  >({
    mutationFn: (data) => competitionsApi.enter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: competitionKeys.all });
    },
  });
}
