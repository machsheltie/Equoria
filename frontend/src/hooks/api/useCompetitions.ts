/**
 * Competition API Hooks
 *
 * Centralized hooks for competition-related API calls:
 * - List competitions with filtering
 * - Get available disciplines
 * - Check horse eligibility
 * - Enter competition
 */

import { useQuery, useQueries, keepPreviousData } from '@tanstack/react-query';
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
/**
 * The open shows. With a level (1-20) the server lists only the shows open to
 * that level (Equoria-i33ow); the previous list stays on screen while a new
 * level loads, so the filters never blank the page.
 */
export function useCompetitions(level?: number) {
  return useQuery<Competition[], ApiError>({
    queryKey: level === undefined ? competitionKeys.list() : [...competitionKeys.list(), { level }],
    queryFn: () => competitionsApi.list(level),
    placeholderData: keepPreviousData,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

export function useDisciplines() {
  return useQuery<
    { disciplines: string[]; disciplineDetails: Record<string, unknown>[] },
    ApiError
  >({
    queryKey: competitionKeys.disciplines(),
    queryFn: competitionsApi.getDisciplines,
    staleTime: 30 * 60 * 1000, // 30 minutes (rarely changes)
  });
}

export function useEligibility(horseId: number, discipline: string) {
  return useQuery<EligibilityResult, ApiError>({
    queryKey: competitionKeys.eligibility(horseId, discipline),
    queryFn: async () => {
      // fetchWithAuth already unwraps the outer { success, data } envelope,
      // so result is { horseId, horseName, discipline, eligibility }.
      const result = await competitionsApi.checkEligibility(horseId, discipline);
      return result.eligibility;
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
        // fetchWithAuth already unwraps the outer { success, data } envelope.
        const result = await competitionsApi.checkEligibility(horseId, discipline);
        return result.eligibility;
      },
      enabled: horseId > 0 && Boolean(discipline),
      staleTime: 60 * 1000,
    })),
  });
}
