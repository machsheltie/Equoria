/**
 * React Query hooks for Horse Genetics Data
 *
 * Provides hooks for fetching advanced genetics data including:
 * - Trait interactions
 * - Epigenetic insights
 * - Trait timeline/history
 *
 * Equoria-yzar3 — DATA-CONTRACT FIX:
 * The previous version of this file declared FICTIONAL response interfaces
 * (`{ traits }`, `{ interactions }`, timeline `{ id, traitName, eventType,
 * timestamp, ... }`) that did NOT match the real backend JSON. As a result
 * the GeneticsTab rendered empty traits/interactions and CRASHED on the
 * timeline (`entry.eventType.charAt(0)` on undefined).
 *
 * Decision (AC §2): the FRONTEND maps the real backend shapes into a stable
 * UI view model inside each hook's `queryFn`. Rationale:
 *  - the three endpoints are shared/stable; mutating their response shape on
 *    the backend risks other consumers and is out of scope for this fix,
 *  - the issue frames the fix layer as "reconcile the hook contract,"
 *  - the raw backend payloads carry enough data to derive the view model.
 *
 * The hook output types below describe the NORMALIZED view model the
 * GeneticsTab consumes. The raw backend shapes are documented inline and
 * captured by the `Raw*` interfaces + the exported pure `map*` functions
 * (tested against real-backend-shaped payloads).
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/* ============================================================================
 * RAW BACKEND SHAPES (what the endpoints actually return, post-`.data` unwrap)
 * apiClient.get unwraps the `{ success, data }` envelope and returns `data`.
 * ==========================================================================*/

/**
 * GET /api/horses/:id/epigenetic-insights → data
 * (backend/modules/labs/routes/enhancedReportingRoutes.mjs)
 * Shape: { horseId, traitAnalysis, environmentalInfluences,
 *          developmentalProgress, predictiveInsights, recommendations }
 * traitAnalysis (= generateInteractionMatrix output,
 * backend/services/traitInteractionMatrix.mjs) is:
 *   { horseId, traits: string[], synergies: [...], conflicts: [...],
 *     overallHarmony, dominantTraits, interactionStrength }
 * NOTE: `traitAnalysis.traits` is an array of trait-NAME strings
 * (horse.epigeneticFlags), NOT rich trait objects.
 */
export interface RawTraitAnalysis {
  horseId?: number;
  traits?: string[];
  synergies?: Array<{ trait1: string; trait2: string; strength: number }>;
  conflicts?: Array<{ trait1: string; trait2: string; strength: number }>;
  overallHarmony?: number;
  dominantTraits?: Array<{ trait: string; dominanceScore: number; dominanceLevel: string }>;
  interactionStrength?: number;
}

export interface RawEpigeneticInsights {
  horseId?: number;
  traitAnalysis?: RawTraitAnalysis;
  environmentalInfluences?: unknown;
  developmentalProgress?: unknown;
  predictiveInsights?: unknown;
  recommendations?: string[];
}

/**
 * GET /api/horses/:id/trait-interactions → data
 * (backend/modules/traits/routes/advancedEpigeneticRoutes.mjs)
 * Shape: { horseId, traitInteractions, synergies, conflicts, dominance }
 * `traitInteractions` (= analyzeTraitInteractions output) is the full matrix:
 *   { horseId, traits, synergies: [...], conflicts: [...], ... }
 * synergy/conflict items: { trait1, trait2, strength (0-1 float),
 *                           description, category, amplificationFactor? }
 * NOTE: strength is a 0..1 float, NOT a 0..100 integer. There is NO `effect`
 * field; `description` is the human-readable text.
 */
export interface RawTraitPair {
  trait1?: string;
  trait2?: string;
  strength?: number; // 0..1 float
  description?: string;
  category?: string;
  amplificationFactor?: number;
  suppressionFactor?: number;
}

export interface RawTraitInteractionsData {
  horseId?: number;
  traitInteractions?: {
    horseId?: number;
    traits?: string[];
    synergies?: RawTraitPair[];
    conflicts?: RawTraitPair[];
    overallHarmony?: number;
    interactionStrength?: number;
  };
  synergies?: unknown;
  conflicts?: RawTraitPair[];
  dominance?: unknown;
}

/**
 * GET /api/horses/:id/trait-timeline → data
 * (backend/modules/labs/routes/enhancedReportingRoutes.mjs)
 * Shape: { horseId, timeline, milestones, criticalPeriods, environmentalEvents }
 * timeline items (= buildTraitTimeline output,
 * backend/services/enhancedReportingService.mjs):
 *   { date, type, event, method?, context?, groom?, data, ... }
 * NOTE: there is NO `eventType`, `traitName`, `timestamp`, `id`, or `source`
 * field on a timeline item. The discriminator is `type`
 * (e.g. 'trait_discovery' | 'significant_interaction'); the human label is
 * `event`; the date field is `date`.
 */
export interface RawTimelineEntry {
  date?: string;
  type?: string;
  event?: string;
  method?: string;
  context?: string;
  groom?: string;
  [key: string]: unknown;
}

export interface RawTraitTimelineData {
  horseId?: number;
  timeline?: RawTimelineEntry[];
  milestones?: unknown;
  criticalPeriods?: unknown;
  environmentalEvents?: unknown;
}

/* ============================================================================
 * NORMALIZED VIEW MODEL (what GeneticsTab consumes)
 * ==========================================================================*/

export interface TraitInteraction {
  trait1: string;
  trait2: string;
  effect: string;
  strength: number; // normalized to 0-100 scale for the UI
}

export interface TraitInteractionsResponse {
  interactions: TraitInteraction[];
}

export interface EpigeneticTrait {
  name: string;
  type: 'genetic' | 'epigenetic';
  description: string;
  source?: 'sire' | 'dam' | 'mutation';
  discoveryDate?: string;
  isActive?: boolean;
  rarity: 'common' | 'rare' | 'legendary';
  strength: number; // 0-100 scale
  impact: {
    stats?: Record<string, number>;
    disciplines?: Record<string, number>;
  };
}

export interface EpigeneticInsightsResponse {
  traits: EpigeneticTrait[];
}

export interface TraitTimelineEntry {
  id: string;
  traitName: string;
  /** Always a defined, non-empty string after mapping — the crash guard. */
  eventType: string;
  timestamp: string;
  description?: string;
  source?: string;
}

export interface TraitTimelineResponse {
  timeline: TraitTimelineEntry[];
}

/* ============================================================================
 * PURE MAPPERS (raw backend shape → view model). Exported for unit tests.
 * Every mapper is total + defensive: any missing/odd field maps to a safe
 * default, never `undefined` on a field the UI dereferences.
 * ==========================================================================*/

/** Format a snake_or_camel trait-name string into a Title Case label. */
function humanizeTraitName(name: string): string {
  if (!name) return 'Unknown Trait';
  return name
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Map epigenetic-insights → EpigeneticTrait[].
 * The real backend exposes trait NAMES (strings) in `traitAnalysis.traits`,
 * plus a `dominantTraits` list. We project each name into the trait card view
 * model. Dominant traits are treated as higher-strength.
 */
export function mapEpigeneticInsights(raw: RawEpigeneticInsights | null | undefined): EpigeneticInsightsResponse {
  const analysis = raw?.traitAnalysis;
  const names = Array.isArray(analysis?.traits) ? analysis!.traits! : [];

  const dominanceByTrait = new Map<string, number>();
  if (Array.isArray(analysis?.dominantTraits)) {
    for (const d of analysis!.dominantTraits!) {
      if (d && typeof d.trait === 'string') {
        // dominanceScore is a 0..1 float; scale to 0..100.
        dominanceByTrait.set(d.trait, Math.round((d.dominanceScore ?? 0) * 100));
      }
    }
  }

  const traits: EpigeneticTrait[] = names
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .map((rawName) => {
      const dominance = dominanceByTrait.get(rawName);
      const strength = typeof dominance === 'number' ? Math.max(40, dominance) : 50;
      const rarity: EpigeneticTrait['rarity'] =
        strength >= 80 ? 'legendary' : strength >= 60 ? 'rare' : 'common';
      return {
        name: humanizeTraitName(rawName),
        type: 'epigenetic',
        description: dominanceByTrait.has(rawName)
          ? 'Dominant epigenetic trait influencing behavior and development.'
          : 'Epigenetic trait expressed by this horse.',
        rarity,
        strength,
        impact: {},
      };
    });

  return { traits };
}

/** Clamp/normalize a 0..1 (or already-0..100) strength to a 0..100 integer. */
function normalizeStrength(strength: number | undefined): number {
  if (typeof strength !== 'number' || Number.isNaN(strength)) return 0;
  // Backend synergy/conflict strengths are 0..1 floats; scale up. Values that
  // already exceed 1 are assumed to be on a 0..100 scale and passed through.
  const scaled = strength <= 1 ? strength * 100 : strength;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

/**
 * Map trait-interactions → TraitInteraction[].
 * Pulls synergy + conflict pairs from the nested `traitInteractions` matrix
 * (with a fallback to the top-level `conflicts`). Each pair's `description`
 * becomes the UI `effect`; `strength` is normalized to 0-100.
 */
export function mapTraitInteractions(
  raw: RawTraitInteractionsData | null | undefined
): TraitInteractionsResponse {
  const matrix = raw?.traitInteractions;
  const pairs: RawTraitPair[] = [
    ...(Array.isArray(matrix?.synergies) ? matrix!.synergies! : []),
    ...(Array.isArray(matrix?.conflicts) ? matrix!.conflicts! : []),
  ];
  // Fallback: if the nested matrix had no pairs, use top-level conflicts.
  if (pairs.length === 0 && Array.isArray(raw?.conflicts)) {
    pairs.push(...raw!.conflicts!);
  }

  const interactions: TraitInteraction[] = pairs
    .filter((p): p is RawTraitPair => !!p && (!!p.trait1 || !!p.trait2))
    .map((p) => ({
      trait1: humanizeTraitName(p.trait1 ?? ''),
      trait2: humanizeTraitName(p.trait2 ?? ''),
      effect: p.description ?? `${humanizeTraitName(p.trait1 ?? '')} interacts with ${humanizeTraitName(p.trait2 ?? '')}`,
      strength: normalizeStrength(p.strength),
    }));

  return { interactions };
}

/**
 * Map trait-timeline → TraitTimelineEntry[].
 * The real timeline items have NO `eventType`/`traitName`/`timestamp`. We
 * derive `eventType` from `type` (or a safe default) so the GeneticsTab's
 * `entry.eventType.charAt(0)` can NEVER receive undefined — this is the
 * crash guard required by AC §3.
 */
export function mapTraitTimeline(
  raw: RawTraitTimelineData | null | undefined
): TraitTimelineResponse {
  const entries = Array.isArray(raw?.timeline) ? raw!.timeline! : [];

  const timeline: TraitTimelineEntry[] = entries
    .filter((e): e is RawTimelineEntry => !!e && typeof e === 'object')
    .map((e, index) => {
      // Derive a guaranteed-defined eventType from the backend `type`.
      const rawType = typeof e.type === 'string' && e.type.length > 0 ? e.type : 'event';
      const eventType = humanizeTraitName(rawType);
      const timestamp =
        typeof e.date === 'string' && e.date.length > 0 ? e.date : new Date(0).toISOString();
      return {
        id: `${rawType}-${index}-${timestamp}`,
        traitName: typeof e.event === 'string' && e.event.length > 0 ? e.event : 'Trait Event',
        eventType, // never undefined
        timestamp,
        description: typeof e.event === 'string' ? e.event : undefined,
        source: typeof e.method === 'string' ? e.method : undefined,
      };
    });

  return { timeline };
}

/**
 * Genetics API surface
 * Each call fetches the raw backend shape then maps it to the view model.
 */
export const geneticsApi = {
  getTraitInteractions: async (horseId: number): Promise<TraitInteractionsResponse> => {
    const raw = await apiClient.get<RawTraitInteractionsData>(
      `/api/horses/${horseId}/trait-interactions`
    );
    return mapTraitInteractions(raw);
  },

  getEpigeneticInsights: async (horseId: number): Promise<EpigeneticInsightsResponse> => {
    const raw = await apiClient.get<RawEpigeneticInsights>(
      `/api/horses/${horseId}/epigenetic-insights`
    );
    return mapEpigeneticInsights(raw);
  },

  getTraitTimeline: async (horseId: number): Promise<TraitTimelineResponse> => {
    const raw = await apiClient.get<RawTraitTimelineData>(
      `/api/horses/${horseId}/trait-timeline`
    );
    return mapTraitTimeline(raw);
  },
};

/**
 * React Query hook for fetching trait interactions
 */
export function useHorseTraitInteractions(
  horseId: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    staleTime?: number;
  }
): UseQueryResult<TraitInteractionsResponse, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'trait-interactions'],
    queryFn: () => geneticsApi.getTraitInteractions(horseId),
    enabled: options?.enabled !== false && !!horseId,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // Default: 5 minutes
  });
}

/**
 * React Query hook for fetching epigenetic insights
 */
export function useHorseEpigeneticInsights(
  horseId: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    staleTime?: number;
  }
): UseQueryResult<EpigeneticInsightsResponse, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'epigenetic-insights'],
    queryFn: () => geneticsApi.getEpigeneticInsights(horseId),
    enabled: options?.enabled !== false && !!horseId,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime ?? 10 * 60 * 1000, // Default: 10 minutes (traits change slowly)
  });
}

/**
 * React Query hook for fetching trait timeline
 */
export function useHorseTraitTimeline(
  horseId: number,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    staleTime?: number;
  }
): UseQueryResult<TraitTimelineResponse, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'trait-timeline'],
    queryFn: () => geneticsApi.getTraitTimeline(horseId),
    enabled: options?.enabled !== false && !!horseId,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime ?? 15 * 60 * 1000, // Default: 15 minutes (historical data changes rarely)
  });
}
