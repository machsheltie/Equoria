/**
 * React Query Hook for Temperament Reference Data
 *
 * Equoria-876o — surfaces GET /api/v1/horses/temperament-definitions so the
 * frontend can show players what the 11 temperaments mean and how each
 * affects gameplay (training, competition, groom synergy).
 *
 * The data is purely static reference content, so we use a long staleTime
 * (1 hour) and gcTime (24 hours).
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { horsesApi } from '@/lib/api-client';

export interface TemperamentDefinition {
  name: string;
  description: string;
  prevalenceNote: string;
  trainingModifiers: { xpModifier: number; scoreModifier: number };
  competitionModifiers: { riddenModifier: number; conformationModifier: number };
  bestGroomPersonalities: string[];
}

export interface TemperamentDefinitionsResponse {
  count: number;
  definitions: TemperamentDefinition[];
}

export function useTemperamentDefinitions(
  enabled = true
): UseQueryResult<TemperamentDefinitionsResponse, Error> {
  return useQuery({
    queryKey: ['temperament-definitions'],
    queryFn: () => horsesApi.getTemperamentDefinitions(),
    enabled,
    staleTime: 60 * 60 * 1000, // 1 hour — reference data rarely changes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
