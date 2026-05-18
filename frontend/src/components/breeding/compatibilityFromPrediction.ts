/**
 * compatibilityFromPrediction (Equoria-to87r)
 *
 * Maps the REAL backend breeding-genetics prediction responses into the
 * CompatibilityData shape the CompatibilityPreview component renders.
 *
 * Replaces the previous client-side hardcoded math in
 * BreedingPairSelection.buildCompatibilityData() (stat ranges = (s+d)/2 ±
 * spread*0.3±5, trait probabilities hardcoded 0.95/0.7, inbreeding fallback
 * 0.02, fake "shared grandsire" pedigree). Those numbers were NOT the game's
 * real genetics — a 21R "no fake product values" beta-readiness defect.
 *
 * The real numbers come from:
 *   - POST /api/v1/breeding/genetic-probability  → statProbabilities (per-stat
 *     expectedRange/expectedValue from the game's inheritance model) +
 *     traitProbabilities (positive/negative/hidden, each with a real
 *     probability % and inheritancePattern).
 *   - POST /api/v1/genetics/inbreeding-analysis   → real path-analysis
 *     coefficient + real commonAncestors (id/name/contribution) for a real
 *     pedigree-overlap summary.
 *
 * This module is a PURE function (no network, no React) so it can be unit
 * tested directly against the documented backend response shapes.
 */

import type { CompatibilityData } from './CompatibilityPreview';

/** Per-stat shape returned by /breeding/genetic-probability statProbabilities */
export interface BackendStatProbability {
  expectedValue: number;
  expectedRange: { min: number; max: number };
  variance?: number;
  distribution?: unknown;
  parentalContribution?: unknown;
}

export interface BackendTraitProbability {
  trait: string;
  probability: number; // backend returns a percentage 5–95
  inheritancePattern: 'dominant' | 'heterozygous' | 'recessive' | string;
}

export interface BackendGeneticProbability {
  statProbabilities?: Record<string, BackendStatProbability>;
  traitProbabilities?: {
    positive?: BackendTraitProbability[];
    negative?: BackendTraitProbability[];
    hidden?: BackendTraitProbability[];
  };
  [key: string]: unknown;
}

export interface BackendCommonAncestor {
  id: number;
  name: string;
  contribution?: number;
  stallionPath?: unknown;
  marePath?: unknown;
}

export interface BackendInbreedingAnalysis {
  // The /api/v1/genetics/inbreeding-analysis route returns the
  // calculateDetailedInbreedingCoefficient() shape whose key is `coefficient`.
  // Some older typings/helpers expose `inbreedingCoefficient`; accept either so
  // a typing drift can never silently fall back to a fabricated value.
  coefficient?: number; // 0–1, real path-analysis value
  inbreedingCoefficient?: number;
  commonAncestors?: BackendCommonAncestor[];
  riskAssessment?: unknown;
  recommendations?: string[];
  [key: string]: unknown;
}

/**
 * Inbreeding coefficient that triggers the CompatibilityPreview warning.
 * Mirrors the backend GENETIC_CONSTANTS.INBREEDING_THRESHOLD (0.125 = 12.5%),
 * the same threshold the game's genetic-health model uses. Kept as a named
 * export so the warning UI and tests reference one source of truth.
 */
export const INBREEDING_WARNING_THRESHOLD = 0.125;

/**
 * Map the real backend prediction + inbreeding responses into CompatibilityData.
 *
 * Returns null when the required genetic-probability payload is missing — the
 * caller MUST render an honest loading/error state rather than fabricating
 * numbers (the whole point of Equoria-to87r).
 */
export function mapPredictionToCompatibilityData(
  geneticProbability: BackendGeneticProbability | null | undefined,
  inbreedingAnalysis: BackendInbreedingAnalysis | null | undefined
): CompatibilityData | null {
  if (!geneticProbability || !geneticProbability.statProbabilities) {
    return null;
  }

  // ── Stat ranges — straight from the game's inheritance model ──────────────
  const statRanges: CompatibilityData['statRanges'] = {};
  for (const [stat, sp] of Object.entries(geneticProbability.statProbabilities)) {
    if (!sp || !sp.expectedRange) continue;
    statRanges[stat] = {
      min: Math.round(sp.expectedRange.min),
      avg: Math.round(sp.expectedValue),
      max: Math.round(sp.expectedRange.max),
    };
  }

  // ── Traits — real per-trait inheritance probabilities & patterns ──────────
  const tp = geneticProbability.traitProbabilities ?? {};
  const traits: CompatibilityData['traits'] = [];
  const pushTraits = (
    list: BackendTraitProbability[] | undefined,
    fallbackSource: CompatibilityData['traits'][number]['source']
  ) => {
    for (const t of list ?? []) {
      const pattern = String(t.inheritancePattern);
      const source: CompatibilityData['traits'][number]['source'] =
        pattern === 'dominant' ? 'both' : pattern === 'recessive' ? 'recessive' : fallbackSource;
      traits.push({
        name: t.trait,
        // backend returns 5–95 (percent); CompatibilityPreview wants 0–1
        probability: Math.min(1, Math.max(0, t.probability / 100)),
        source,
      });
    }
  };
  pushTraits(tp.positive, 'sire');
  pushTraits(tp.negative, 'dam');
  pushTraits(tp.hidden, 'recessive');

  // ── Inbreeding — real path-analysis coefficient (no 0.02 fabrication) ─────
  // If the inbreeding endpoint hasn't resolved, surface 0 (no fake fallback);
  // the warning only fires on the real value crossing the real threshold.
  const rawCoefficient =
    inbreedingAnalysis &&
    (typeof inbreedingAnalysis.coefficient === 'number'
      ? inbreedingAnalysis.coefficient
      : typeof inbreedingAnalysis.inbreedingCoefficient === 'number'
        ? inbreedingAnalysis.inbreedingCoefficient
        : undefined);
  const inbreedingCoefficient =
    typeof rawCoefficient === 'number' ? Math.max(0, Math.min(1, rawCoefficient)) : 0;

  // ── Pedigree — real common ancestors from path analysis ───────────────────
  const pedigreeOverlap: CompatibilityData['pedigreeOverlap'] = (
    inbreedingAnalysis?.commonAncestors ?? []
  ).map((a) => ({
    ancestorName: a.name,
    // contribution is a 0–1 path weight; surface it as a 1-dp percent label
    // the component already renders generations as a number.
    generations: Math.max(1, Math.round((a.contribution ?? 0) * 100)),
  }));

  return { statRanges, traits, inbreedingCoefficient, pedigreeOverlap };
}
