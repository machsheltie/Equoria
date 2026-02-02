/**
 * React Query Hooks for Horse Conformation Data
 *
 * Provides hooks for fetching:
 * - Horse conformation scores (8 regions)
 * - Breed average conformation scores
 * - Cached with React Query for optimal performance
 *
 * Story 3-5: Conformation Scoring UI - Task 4
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

export interface HorseConformation {
  head: number;
  neck: number;
  shoulder: number;
  back: number;
  hindquarters: number;
  legs: number;
  hooves: number;
  overall: number; // Calculated average
}

export interface BreedAverages {
  breedId: string;
  breedName: string;
  averages: HorseConformation;
}

/**
 * Fetch horse conformation scores
 * Frontend-first implementation with mock data until backend API is ready
 *
 * TODO: Replace with real API call when backend endpoint exists
 * Expected endpoint: GET /api/horses/:id/conformation
 */
export function useHorseConformation(
  horseId: number | string
): UseQueryResult<HorseConformation, Error> {
  return useQuery({
    queryKey: ['horse', String(horseId), 'conformation'],
    queryFn: async (): Promise<HorseConformation> => {
      // Mock data for frontend development
      // TODO: Replace with apiClient.get(`/api/horses/${horseId}/conformation`)
      await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate network delay

      // Generate semi-random but consistent scores based on horseId
      const id = typeof horseId === 'string' ? parseInt(horseId, 10) : horseId;
      const seed = id || 1;

      const generateScore = (offset: number): number => {
        const base = 70 + ((seed + offset) % 30);
        return Math.min(100, Math.max(0, base));
      };

      const scores = {
        head: generateScore(1),
        neck: generateScore(2),
        shoulder: generateScore(3),
        back: generateScore(4),
        hindquarters: generateScore(5),
        legs: generateScore(6),
        hooves: generateScore(7),
        overall: 0, // Will be calculated below
      };

      // Calculate overall score (average of 7 regions)
      scores.overall =
        Math.round(
          ((scores.head +
            scores.neck +
            scores.shoulder +
            scores.back +
            scores.hindquarters +
            scores.legs +
            scores.hooves) /
            7) *
            10
        ) / 10;

      return scores;
    },
    enabled: horseId !== null && horseId !== undefined && horseId !== '',
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (replaces cacheTime)
  });
}

/**
 * Fetch breed average conformation scores
 * Frontend-first implementation with mock data until backend API is ready
 *
 * TODO: Replace with real API call when backend endpoint exists
 * Expected endpoint: GET /api/breeds/:id/averages
 */
export function useBreedAverages(breedId: string | number): UseQueryResult<BreedAverages, Error> {
  return useQuery({
    queryKey: ['breed', String(breedId), 'averages'],
    queryFn: async (): Promise<BreedAverages> => {
      // Mock data for frontend development
      // TODO: Replace with apiClient.get(`/api/breeds/${breedId}/averages`)
      await new Promise((resolve) => setTimeout(resolve, 200)); // Simulate network delay

      // Mock breed average scores (slightly lower than typical horse scores)
      const averages: HorseConformation = {
        head: 75,
        neck: 73,
        shoulder: 78,
        back: 76,
        hindquarters: 77,
        legs: 74,
        hooves: 75,
        overall: 75.4,
      };

      return {
        breedId: String(breedId),
        breedName: 'Arabian', // Mock breed name
        averages,
      };
    },
    enabled: breedId !== null && breedId !== undefined && breedId !== '',
    staleTime: 60 * 60 * 1000, // 1 hour (static data)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
