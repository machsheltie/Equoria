/**
 * React Query hooks for Horse Coat-Color Genetics (Epic 31E-4)
 *
 * Distinct from useHorseGenetics.ts (epigenetic traits). These hooks call
 * GET /api/v1/horses/:id/genetics and GET /api/v1/horses/:id/color and surface
 * the coat-color genotype + phenotype produced by the 31E pipeline.
 *
 * The backend returns the canonical { success, message, data } envelope where
 * `data === null` for legacy horses (pre-31E horses without color data).
 * api-client.ts unwraps the envelope, so the hook's `data` is either the
 * payload object or `null` — consumers MUST handle the null branch.
 *
 * Cache strategy (per PATTERN_LIBRARY.md / 31E-4 follow-up Equoria-1wed):
 *   - Coat genetics rarely change after creation (only via mutation events).
 *   - staleTime: 10 minutes — refetch is wasteful for static data.
 *   - gcTime: 30 minutes — keep the payload around for tab-switches.
 *   - refetchOnWindowFocus: false — no need to re-poll on focus.
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { horsesApi, type HorseGeneticsResponse, type HorseColorResponse } from '@/lib/api-client';

const COAT_GENETICS_STALE_MS = 10 * 60 * 1000; // 10 minutes
const COAT_GENETICS_GC_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch the full color genotype + phenotype for a horse.
 * Returns `null` when the horse has no coat-color data (legacy horse).
 *
 * @param horseId - target horse ID (skip when falsy)
 */
export function useHorseCoatGenetics(
  horseId: number | string | null | undefined
): UseQueryResult<HorseGeneticsResponse | null> {
  return useQuery({
    queryKey: ['horse-coat-genetics', horseId],
    queryFn: () => {
      if (!horseId) {
        return Promise.resolve(null);
      }
      return horsesApi.getGenetics(horseId);
    },
    enabled: Boolean(horseId),
    staleTime: COAT_GENETICS_STALE_MS,
    gcTime: COAT_GENETICS_GC_MS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch the player-facing color summary (colorName, shade, markings) for a
 * horse. Returns `null` when the horse has no phenotype data.
 *
 * @param horseId - target horse ID (skip when falsy)
 */
export function useHorseCoatColor(
  horseId: number | string | null | undefined
): UseQueryResult<HorseColorResponse | null> {
  return useQuery({
    queryKey: ['horse-coat-color', horseId],
    queryFn: () => {
      if (!horseId) {
        return Promise.resolve(null);
      }
      return horsesApi.getColor(horseId);
    },
    enabled: Boolean(horseId),
    staleTime: COAT_GENETICS_STALE_MS,
    gcTime: COAT_GENETICS_GC_MS,
    refetchOnWindowFocus: false,
  });
}
