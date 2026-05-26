/**
 * React Query hooks for the Behavioral Epigenetic Flag system (Equoria-yzqhj.8).
 *
 * ⚠️ NAMING TRAP — read before editing.
 * These BEHAVIORAL flags are the permanent brave/confident/fearful/... flags
 * stored on `Horse.epigeneticFlags`, served by the /api/v1/flags/* endpoints.
 * They are a DIFFERENT concept from `frontend/src/types/traits.ts`'s
 * `EpigeneticFlag` (a trait-acquisition-SOURCE tag —
 * 'stress-induced'|'care-influenced'|... — rendered by EpigeneticFlagBadge on
 * genetic traits). To avoid conflation in the UI, this module names its type
 * `BehavioralFlag`, never `EpigeneticFlag`.
 *
 * Real backend contract (post apiClient `.data` unwrap; apiClient.get unwraps
 * the { success, data } envelope and returns `data`):
 *
 *   GET /api/v1/flags/horses/:id/flags  (auth + ownership) →
 *     { horseId, horseName, ageInYears, currentBondScore, currentStressLevel,
 *       flagCount, flags: BehavioralFlag[], maxFlags, canReceiveMoreFlags }
 *   GET /api/v1/flags/definitions       (auth) →
 *     { count, flags: BehavioralFlag[] }
 *   GET /api/v1/flags/horses/:id/care-patterns (auth + ownership) →
 *     { eligible, reason?, ageInYears, patterns, ... }  (eligible only for
 *      foals/youngstock < 3 game-years; ineligible returns { eligible:false,
 *      reason, patterns:{} })
 *
 * Per CLAUDE.md 21R doctrine: real API data only. No mock flag data. Consumers
 * render honest empty/error states when data is absent.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient, type ApiError } from '@/lib/api-client';

/** A single behavioral epigenetic flag with its definition metadata. */
export interface BehavioralFlag {
  /** Stable flag key (e.g. 'brave', 'fearful'). */
  name: string;
  /** Human-readable name for display. */
  displayName: string;
  /** Definition description. */
  description: string;
  /** Valence of the flag. 'unknown' for an unrecognized stored flag. */
  type: 'positive' | 'negative' | 'adaptive' | 'unknown' | string;
  /** Where the flag originates (care/environment/etc.). */
  sourceCategory?: string;
  /** Gameplay influences this flag exerts (free-form per backend). */
  influences?: Record<string, unknown>;
}

/** GET /flags/horses/:id/flags response body (post-unwrap). */
export interface HorseFlagsData {
  horseId: number;
  horseName: string;
  ageInYears: number;
  currentBondScore: number;
  currentStressLevel: number;
  flagCount: number;
  flags: BehavioralFlag[];
  maxFlags: number;
  canReceiveMoreFlags: boolean;
}

/** GET /flags/definitions response body (post-unwrap). */
export interface FlagDefinitionsData {
  count: number;
  flags: BehavioralFlag[];
}

/**
 * GET /flags/horses/:id/care-patterns response body (post-unwrap).
 * `eligible` is false (with a `reason`) for horses ≥ 3 game-years; the
 * `patterns` object is then empty. The pattern sub-shapes are backend-internal
 * and intentionally typed loosely here — the UI surfaces them as a high-level
 * eligibility + summary, not a per-pattern breakdown.
 */
export interface CarePatternsData {
  eligible: boolean;
  reason?: string;
  horseId?: number;
  ageInDays?: number;
  ageInYears?: number;
  currentBondScore?: number;
  currentStressLevel?: number;
  patterns?: Record<string, unknown>;
}

const flagKeys = {
  root: ['flags'] as const,
  horse: (horseId: number) => ['flags', 'horse', horseId] as const,
  carePatterns: (horseId: number) => ['flags', 'care-patterns', horseId] as const,
  definitions: ['flags', 'definitions'] as const,
};

/**
 * Behavioral flags for a single owned horse. Core entity, moderate update
 * frequency → 2min staleTime (PATTERN_LIBRARY React Query cache strategy).
 */
export const useHorseFlags = (horseId: number): UseQueryResult<HorseFlagsData, ApiError> =>
  useQuery<HorseFlagsData, ApiError>({
    queryKey: flagKeys.horse(horseId),
    queryFn: () => apiClient.get<HorseFlagsData>(`/api/v1/flags/horses/${horseId}/flags`),
    enabled: Boolean(horseId),
    staleTime: 2 * 60 * 1000,
  });

/**
 * Care-pattern analysis for an owned foal/youngstock (< 3 game-years). For
 * older horses the backend returns { eligible: false, reason }. Bond/stress
 * driven, so a shorter staleTime keeps it reasonably current.
 */
export const useHorseCarePatterns = (horseId: number): UseQueryResult<CarePatternsData, ApiError> =>
  useQuery<CarePatternsData, ApiError>({
    queryKey: flagKeys.carePatterns(horseId),
    queryFn: () => apiClient.get<CarePatternsData>(`/api/v1/flags/horses/${horseId}/care-patterns`),
    enabled: Boolean(horseId),
    staleTime: 60 * 1000,
  });

/**
 * Static flag definitions (name/description/type/influences). Rarely changes →
 * long staleTime.
 */
export const useFlagDefinitions = (): UseQueryResult<FlagDefinitionsData, ApiError> =>
  useQuery<FlagDefinitionsData, ApiError>({
    queryKey: flagKeys.definitions,
    queryFn: () => apiClient.get<FlagDefinitionsData>('/api/v1/flags/definitions'),
    staleTime: 30 * 60 * 1000,
  });

export const flagQueryKeys = flagKeys;
