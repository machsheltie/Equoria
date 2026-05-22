/**
 * Trait Discovery Type Definitions
 *
 * Equoria-q3u77: This file previously also declared a rich tier-based
 * `EpigeneticTrait` type (tier / category / 6-discipline competitionImpact /
 * epigeneticFlags / isPositive) plus ~15 helper functions, used ONLY by the
 * orphaned `components/traits/{TraitCard,TraitDetailModal,EpigeneticTraitDisplay,
 * CompetitionImpactPanel,EpigeneticFlagBadge,TraitHistoryTimeline}` set. That
 * shape required data the real backend never provides, so the components were
 * dead code and were removed. The duplicate `EpigeneticTrait` type was removed
 * with them — the single canonical trait view model now lives in
 * `hooks/useHorseGenetics.ts` (EpigeneticTrait: rarity/strength/impact, live)
 * and the per-horse classification model in `hooks/useHorseTraits.ts`
 * (HorseTrait: valence/description, live).
 *
 * What remains here is the LIVE discovery-status surface consumed by
 * `components/traits/HiddenTraitIndicator.tsx` and mapped from the real
 * `/api/v1/traits/discovery-status/:horseId` endpoint in
 * `hooks/useHorseTraits.ts#mapDiscoveryStatus`.
 */

/**
 * Trait Discovery Status Tracking — view model for HiddenTraitIndicator.
 */
export interface TraitDiscoveryStatus {
  horseId: number;
  totalTraits: number;
  discoveredTraits: number;
  partiallyDiscoveredTraits: number;
  hiddenTraits: number;
  /** Hint for discovering the next hidden trait. */
  nextDiscoveryHint?: string;
  /** 0-100 percentage. */
  discoveryProgress: number;
}

/**
 * Calculate discovery progress percentage. Partial discoveries count as 50%.
 */
export function calculateDiscoveryProgress(status: TraitDiscoveryStatus): number {
  if (status.totalTraits === 0) return 0;
  const discovered = status.discoveredTraits;
  const partial = status.partiallyDiscoveredTraits * 0.5;
  return Math.round(((discovered + partial) / status.totalTraits) * 100);
}
