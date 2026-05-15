/**
 * useColorPrediction (Equoria-c9jp, 31E-5 frontend)
 *
 * React Query hook over `breedingPredictionApi.getColorPrediction`. Wraps the
 * POST /api/v1/horses/breeding/color-prediction endpoint that computes the
 * per-locus Punnett-square probability distribution for offspring coat colors.
 *
 * Backend contract (`backend/modules/horses/services/breedingColorPredictionService.mjs`,
 * route mounted in `backend/modules/horses/routes/horseRoutes.mjs`):
 *   - Returns BreedingColorPredictionResult with possibleColors[], totalCombinations,
 *     and lethalCombinationsFiltered.
 *   - AC6 legacy-horse case: if either parent lacks colorGenotype data, the API
 *     returns `{ success: true, data: null }`. The hook surfaces `data === null`
 *     so the UI can render a fallback (e.g. "Color prediction unavailable —
 *     legacy parent horse"). Callers MUST branch on null.
 *   - Self-cross guard: backend returns 400 for sireId === damId BEFORE any DB
 *     work (per `.claude/rules/CONTRIBUTING.md` §4). The hook does not need to
 *     re-guard but is disabled when either ID is missing.
 *
 * Cache strategy: 10-minute staleTime mirrors the other breeding hooks in
 * `useBreedingPrediction.ts` — genetics is deterministic so the result for a
 * given (sire, dam, breed) tuple is immutable until the parent records change.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  breedingPredictionApi,
  type BreedingColorPredictionResult,
  type ApiError,
} from '@/lib/api-client';

export const colorPredictionQueryKeys = {
  root: ['breeding-prediction', 'color'] as const,
  pair: (sireId: number, damId: number, foalBreedId?: number) =>
    ['breeding-prediction', 'color', sireId, damId, foalBreedId ?? null] as const,
};

/**
 * Fetch the offspring coat-color probability distribution for a sire/dam pair.
 *
 * @param sireId       Sire horse ID (must be > 0 to enable the query)
 * @param damId        Dam horse ID (must be > 0 to enable the query)
 * @param foalBreedId  Optional breed override (defaults to dam's breed server-side)
 *
 * @returns UseQueryResult<BreedingColorPredictionResult | null>
 *   - `data === null` indicates the AC6 legacy-horse case
 *   - `data.possibleColors` is sorted descending by probability
 */
export function useColorPrediction(
  sireId: number | null | undefined,
  damId: number | null | undefined,
  foalBreedId?: number
): UseQueryResult<BreedingColorPredictionResult | null, ApiError> {
  const validSire = typeof sireId === 'number' && sireId > 0;
  const validDam = typeof damId === 'number' && damId > 0;
  // Self-cross guard mirrored on the client — avoids an avoidable 400 round-trip.
  const distinctParents = validSire && validDam && sireId !== damId;

  return useQuery<BreedingColorPredictionResult | null, ApiError>({
    queryKey: colorPredictionQueryKeys.pair(
      (sireId as number) ?? 0,
      (damId as number) ?? 0,
      foalBreedId
    ),
    queryFn: () =>
      breedingPredictionApi.getColorPrediction({
        sireId: sireId as number,
        damId: damId as number,
        ...(typeof foalBreedId === 'number' ? { foalBreedId } : {}),
      }),
    enabled: distinctParents,
    staleTime: 10 * 60 * 1000, // 10 minutes — deterministic genetics
    gcTime: 30 * 60 * 1000,
  });
}
