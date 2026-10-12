/**
 * disciplineTraitIndicators
 *
 * Per-discipline trait badges for the training discipline picker: for each
 * discipline, which of the horse's own traits the shared
 * ./disciplineTraitGrouping module lists as a bonus or a penalty there.
 *
 * Owner ruling 2026-10-07 (Stacey): the game never ranks or recommends
 * disciplines for a horse. This module replaced the earlier
 * disciplineRecommendation ranking (Equoria-pfp1w), which ordered disciplines
 * by a stat "match score" and labelled a "Recommended for this horse" set.
 * Do not reintroduce ranking, scoring or recommendations here.
 *
 * PURE function (no network, no React).
 */

import { ALL_DISCIPLINES } from './DisciplineSelector';
import { disciplineTraitEffects } from './disciplineTraitGrouping';

/** Minimal real-horse shape this utility reads (a structural subset of HorseSummary). */
export interface TraitBearingHorse {
  traits?: string[] | null;
}

export interface DisciplineTraitIndicator {
  /** trait name as the horse stores it (lowercased for matching) */
  trait: string;
  kind: 'bonus' | 'penalty';
}

/**
 * { discipline: indicators[] } for the picker's per-option trait badges.
 * Disciplines where none of the horse's traits apply are omitted.
 */
export function disciplineTraitIndicators(
  horse: TraitBearingHorse | null | undefined,
  disciplines: string[] = ALL_DISCIPLINES
): Record<string, DisciplineTraitIndicator[]> {
  const out: Record<string, DisciplineTraitIndicator[]> = {};
  if (!horse) return out;

  const horseTraits = (horse.traits ?? [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.toLowerCase());

  for (const discipline of disciplines) {
    const { bonus, penalty } = disciplineTraitEffects(discipline);
    const indicators: DisciplineTraitIndicator[] = [];
    for (const ht of horseTraits) {
      if (bonus.includes(ht)) indicators.push({ trait: ht, kind: 'bonus' });
      else if (penalty.includes(ht)) indicators.push({ trait: ht, kind: 'penalty' });
    }
    if (indicators.length > 0) out[discipline] = indicators;
  }
  return out;
}
