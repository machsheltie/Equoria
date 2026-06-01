/**
 * React Query Hooks for Horse Gait Scores
 *
 * Provides hook for fetching gait quality scores via
 * GET /api/v1/horses/:id/gaits.
 *
 * Equoria-aa6b: surfaces walk/trot/canter/gallop + named gaiting array on
 * HorseDetailPage. Endpoint returns `null` for pre-31C.1 horses that never
 * had scores generated (Equoria-0hqg policy — null-forever, no backfill).
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { horsesApi } from '@/lib/api-client';

export interface GaitedGaitEntry {
  name: string;
  score: number;
}

export interface HorseGaitScores {
  walk: number;
  trot: number;
  canter: number;
  gallop: number;
  gaiting: GaitedGaitEntry[] | null;
}

export interface HorseGaitsResponse {
  horseId: number;
  horseName: string;
  breedId: number;
  gaitScores: HorseGaitScores;
}

/**
 * Fetch a horse's gait scores. Returns `null` when no gait scores are
 * available (legacy pre-31C.1 horses).
 */
export function useHorseGaits(
  horseId: number | string
): UseQueryResult<HorseGaitsResponse | null, Error> {
  return useQuery({
    queryKey: ['horse', String(horseId), 'gaits'],
    queryFn: () => horsesApi.getGaits(horseId),
    enabled: horseId !== null && horseId !== undefined && horseId !== '',
    staleTime: 5 * 60 * 1000, // 5 minutes — gait scores are permanent attributes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
