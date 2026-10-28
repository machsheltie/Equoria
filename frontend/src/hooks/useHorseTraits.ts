/**
 * React Query hooks for the authoritative per-horse trait surface.
 *
 * Equoria-hriey / Equoria-6rf97 / Equoria-vpgmc:
 * These hooks back the LIVE Genetics tab trait features (valence badge, detail
 * modal, hidden-trait discovery). They read the REAL backend trait endpoints
 * whose response shapes are documented inline:
 *
 *  - GET  /api/v1/traits/horse/:horseId           → authoritative positive /
 *      negative classification + a hidden COUNT + per-trait definition (label,
 *      description, category, type). Never the rarity (owner ruling 2026-10-27, q112). This is the single source of truth for a
 *      trait's beneficial-vs-detrimental valence (definition.type / which
 *      bucket the name is in) — NOT a client-side stat-sign guess.
 *  - GET  /api/v1/traits/discovery-status/:horseId → discovery progress counts
 *      + canDiscover eligibility, mapped to the @/types/traits
 *      TraitDiscoveryStatus shape consumed by HiddenTraitIndicator.
 *
 * There is no discover/reveal call: players never reveal traits (Equoria-gu8jk;
 * owner ruling 2026-10-20). POST /traits/discover/:horseId and the
 * useDiscoverTraits mutation were removed.
 *
 * Backend route handlers (read-only references, verified at build time):
 *   backend/modules/traits/controllers/traitController.mjs
 *     getHorseTraits, getDiscoveryStatus
 *
 * The path prefix is `/api/v1/` per the Epic 20 api-client convention
 * (authRouter is mounted on both `/api` and `/api/v1/v1` in backend/app.mjs).
 */

import { useMutation, useQuery, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { TraitDiscoveryStatus } from '@/types/traits';

/* ============================================================================
 * RAW BACKEND SHAPES (post `{ success, data }` unwrap)
 * ==========================================================================*/

/** A trait definition as embedded by getTraitDefinition (epigeneticTraits.mjs). */
export interface RawTraitDefinition {
  /** Authored player-facing name (owner ruling 2026-10-23). */
  label?: string;
  type?: 'positive' | 'negative' | null;
  description?: string;
  category?: string;
  conflicts?: string[];
  [key: string]: unknown;
}

/** One enhanced trait row: { name, definition } (traitController.getHorseTraits). */
export interface RawEnhancedTrait {
  name?: string;
  definition?: RawTraitDefinition | null;
  /** True until this viewer has seen the revealed trait once (Equoria-lylhb). */
  isNew?: boolean;
}

/** GET /traits/horse/:id → data */
export interface RawHorseTraits {
  horseId?: number;
  horseName?: string;
  bondScore?: number;
  age?: number;
  traits?: {
    positive?: RawEnhancedTrait[];
    negative?: RawEnhancedTrait[];
    /** Revealed but switched off (Equoria-nrto5; shown greyed out, owner ruling q213). */
    dormant?: RawEnhancedTrait[];
    /** Count only: the backend never names an unrevealed trait (Equoria-6dace). */
    hiddenCount?: number;
  };
  summary?: {
    totalTraits?: number;
    visibleTraits?: number;
    hiddenTraits?: number;
  };
}

/** GET /traits/discovery-status/:id → data */
export interface RawDiscoveryStatus {
  horseId?: number;
  horseName?: string;
  currentStats?: { bondScore?: number; age?: number };
  traitCounts?: { visible?: number; hidden?: number };
  discoveryConditions?: {
    met?: Array<{ trait?: string; reason?: string } | string>;
    total?: number;
  };
  canDiscover?: boolean;
}

/* ============================================================================
 * NORMALIZED VIEW MODEL
 * ==========================================================================*/

/**
 * A live, real-data trait for the Genetics tab card/modal. `valence` is the
 * authoritative beneficial-vs-detrimental classification driven by the
 * backend bucket the trait is in (and corroborated by definition.type).
 */
export interface HorseTrait {
  /** Raw trait key (e.g. 'resilient'). Stable id for keys/lookup. */
  key: string;
  /** Humanized display name (e.g. 'Resilient'). */
  name: string;
  /** Authoritative classification from the backend. */
  valence: 'positive' | 'negative';
  /** Trait description from the backend definition (may be empty if undefined). */
  description: string;
  /** Backend category if present (e.g. 'epigenetic', 'bond'). */
  category?: string;
  /** The viewer has not seen this revealed trait yet: it glows once (Equoria-lylhb). */
  isNew?: boolean;
}

export interface HorseTraitsView {
  positive: HorseTrait[];
  negative: HorseTrait[];
  /** Revealed traits that are switched off: still carried, no effect (q213). */
  dormant: HorseTrait[];
  /** Hidden trait COUNT only — names are intentionally not revealed. */
  hiddenCount: number;
  totalTraits: number;
}

/* ============================================================================
 * PURE MAPPERS (exported for tests)
 * ==========================================================================*/

/** Title-case a snake_or_camelCase trait key. */
export function humanizeTraitKey(key: string): string {
  if (!key) return 'Unknown Trait';
  return (
    key
      // split camelCase → camel Case
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ')
  );
}

function mapBucket(
  rows: RawEnhancedTrait[] | undefined,
  valence: 'positive' | 'negative' | null
): HorseTrait[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is RawEnhancedTrait => !!r && typeof r.name === 'string' && r.name.length > 0)
    .map((r) => {
      const def = r.definition && typeof r.definition === 'object' ? r.definition : null;
      return {
        key: r.name as string,
        name:
          typeof def?.label === 'string' && def.label.length > 0
            ? def.label
            : humanizeTraitKey(r.name as string),
        // The bucket the backend placed the trait in is authoritative; if a
        // definition.type disagrees we still trust the bucket (the bucket is
        // derived from horse.epigeneticModifiers, the persisted truth).
        // A dormant trait has no bucket of its own valence: its definition says.
        valence: valence ?? (def?.type === 'negative' ? 'negative' : 'positive'),
        description: typeof def?.description === 'string' ? def.description : '',
        category: typeof def?.category === 'string' ? def.category : undefined,
        isNew: r.isNew === true,
      };
    });
}

/** Map GET /traits/horse/:id → HorseTraitsView. Total + defensive. */
export function mapHorseTraits(raw: RawHorseTraits | null | undefined): HorseTraitsView {
  const buckets = raw?.traits;
  const positive = mapBucket(buckets?.positive, 'positive');
  const negative = mapBucket(buckets?.negative, 'negative');
  const dormant = mapBucket(buckets?.dormant, null);
  const rawHidden = buckets?.hiddenCount;
  const hiddenCount =
    typeof rawHidden === 'number' && Number.isInteger(rawHidden) && rawHidden > 0 ? rawHidden : 0;
  return {
    positive,
    negative,
    dormant,
    hiddenCount,
    totalTraits: positive.length + negative.length + dormant.length + hiddenCount,
  };
}

/**
 * Map GET /traits/discovery-status/:id → TraitDiscoveryStatus (the shape
 * HiddenTraitIndicator consumes). The backend exposes visible/hidden counts
 * and a `canDiscover` flag + met conditions; there is no separate "partial"
 * state, so partiallyDiscoveredTraits is 0. The first met condition (if any)
 * becomes the next-discovery hint. There is no enrichment condition list
 * (Equoria-ecp0i).
 */
export function mapDiscoveryStatus(
  raw: RawDiscoveryStatus | null | undefined
): TraitDiscoveryStatus {
  const visible = raw?.traitCounts?.visible ?? 0;
  const hidden = raw?.traitCounts?.hidden ?? 0;
  const total = visible + hidden;

  const conditions = Array.isArray(raw?.discoveryConditions?.met)
    ? raw!.discoveryConditions!.met!
    : [];
  let nextDiscoveryHint: string | undefined;
  const first = conditions[0];
  if (first) {
    if (typeof first === 'string') {
      nextDiscoveryHint = first;
    } else if (typeof first.reason === 'string') {
      nextDiscoveryHint = first.reason;
    } else if (typeof first.trait === 'string') {
      nextDiscoveryHint = `A trait may be revealed soon: ${humanizeTraitKey(first.trait)}`;
    }
  }

  const discoveryProgress = total > 0 ? Math.round((visible / total) * 100) : 0;

  // Equoria-9zmc4: surface the backend's authoritative eligibility flag plus a
  // human-readable reason the action is unavailable, so the discover button can
  // be pre-disabled BEFORE a wasted 400 round-trip. The backend computes
  // canDiscover = (metConditions > 0) AND hidden > 0
  // (traitController.getDiscoveryStatus). We default a MISSING flag to true so a
  // shape regression never silently disables a real action; only an explicit
  // `false` disables. The reason mirrors the two branches of that AND so the
  // hint matches why the backend would itself decline.
  const canDiscover = raw?.canDiscover !== false;
  let cannotDiscoverReason: string | undefined;
  if (!canDiscover) {
    if (hidden <= 0) {
      cannotDiscoverReason = 'All traits for this horse have already been discovered.';
    } else {
      // hidden > 0 but the backend says no — no discovery condition is met yet.
      cannotDiscoverReason =
        'No discovery conditions are met yet. Keep bonding, completing milestones, and enrichment activities to reveal hidden traits.';
    }
  }

  return {
    horseId: raw?.horseId ?? 0,
    totalTraits: total,
    discoveredTraits: visible,
    partiallyDiscoveredTraits: 0,
    hiddenTraits: hidden,
    nextDiscoveryHint,
    discoveryProgress,
    canDiscover,
    cannotDiscoverReason,
  };
}

/* ============================================================================
 * API surface
 * ==========================================================================*/

export const horseTraitsApi = {
  getHorseTraits: async (horseId: number): Promise<HorseTraitsView> => {
    const raw = await apiClient.get<RawHorseTraits>(`/api/v1/traits/horse/${horseId}`);
    return mapHorseTraits(raw);
  },
  /** Record that the owner has now seen the revealed traits (Equoria-lylhb). */
  markTraitsSeen: async (horseId: number): Promise<void> => {
    await apiClient.post(`/api/v1/traits/horse/${horseId}/seen`, {});
  },
  getDiscoveryStatus: async (horseId: number): Promise<TraitDiscoveryStatus> => {
    const raw = await apiClient.get<RawDiscoveryStatus>(
      `/api/v1/traits/discovery-status/${horseId}`
    );
    return mapDiscoveryStatus(raw);
  },
};

/* ============================================================================
 * Hooks
 * ==========================================================================*/

/**
 * Authoritative per-horse trait classification (positive/negative/hidden).
 * Backs the live valence badge (6rf97) + detail modal (vpgmc).
 */
export function useHorseTraits(
  horseId: number,
  options?: { enabled?: boolean; staleTime?: number }
): UseQueryResult<HorseTraitsView, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'traits'],
    queryFn: () => horseTraitsApi.getHorseTraits(horseId),
    enabled: options?.enabled !== false && !!horseId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000,
  });
}

/**
 * Records that the owner has now seen the horse's revealed traits, so each
 * glows only once (Equoria-lylhb). On success the cached view is marked seen
 * too, so coming back to the tab inside the cache window does not glow again;
 * the glow already on screen is held by the component that captured it.
 */
export function useMarkTraitsSeen(horseId: number) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => horseTraitsApi.markTraitsSeen(horseId),
    onSuccess: () => {
      queryClient.setQueryData<HorseTraitsView>(['horse', horseId, 'traits'], (view) =>
        view
          ? {
              ...view,
              positive: view.positive.map((t) => ({ ...t, isNew: false })),
              negative: view.negative.map((t) => ({ ...t, isNew: false })),
            }
          : view
      );
    },
  });
}

/**
 * Hidden-trait discovery status (counts + progress + canDiscover). Backs
 * HiddenTraitIndicator (hriey).
 */
export function useHorseTraitDiscoveryStatus(
  horseId: number,
  options?: { enabled?: boolean; staleTime?: number }
): UseQueryResult<TraitDiscoveryStatus, Error> {
  return useQuery({
    queryKey: ['horse', horseId, 'trait-discovery-status'],
    queryFn: () => horseTraitsApi.getDiscoveryStatus(horseId),
    enabled: options?.enabled !== false && !!horseId,
    staleTime: options?.staleTime ?? 60 * 1000,
  });
}
