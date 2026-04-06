/**
 * React Query Hooks for Horse Conformation Data
 *
 * Provides hooks for fetching:
 * - Horse conformation scores (8 regions) via GET /api/v1/horses/:id/conformation
 * - Breed average conformation scores via GET /api/v1/breeds/:id/conformation-averages
 * - Cached with React Query for optimal performance
 *
 * Story 3-5: Conformation Scoring UI - Task 4
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { horsesApi } from '@/lib/api-client';

export interface HorseConformation {
  head: number;
  neck: number;
  shoulders: number;
  back: number;
  hindquarters: number;
  legs: number;
  hooves: number;
  topline: number;
  overallConformation: number;
}

export interface BreedAverages {
  breedId: string;
  breedName: string;
  averages: HorseConformation;
}

/**
 * Fetch horse conformation scores from the backend.
 * Endpoint: GET /api/v1/horses/:id/conformation
 */
export function useHorseConformation(
  horseId: number | string
): UseQueryResult<HorseConformation, Error> {
  return useQuery({
    queryKey: ['horse', String(horseId), 'conformation'],
    queryFn: async () => {
      const response = await horsesApi.getConformation(horseId);
      return response.conformationScores;
    },
    enabled: horseId !== null && horseId !== undefined && horseId !== '',
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Fetch breed average conformation scores from the backend.
 * Endpoint: GET /api/v1/breeds/:id/conformation-averages
 */
export function useBreedAverages(breedId: string | number): UseQueryResult<BreedAverages, Error> {
  return useQuery({
    queryKey: ['breed', String(breedId), 'conformation-averages'],
    queryFn: () => horsesApi.getBreedAverages(breedId),
    enabled: breedId !== null && breedId !== undefined && breedId !== '',
    staleTime: 60 * 60 * 1000, // 1 hour (breed data rarely changes)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
