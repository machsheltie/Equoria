/**
 * disciplineRecommendation (Equoria-pfp1w)
 *
 * Pure ranking of training disciplines BY a specific horse's real stat
 * profile + traits. Replaces the previous behaviour where DisciplineSelector
 * fell back to a static DEFAULT_RECOMMENDED list (Dressage / Show Jumping /
 * Barrel Racing / Racing / Endurance) regardless of the horse — a UX-spec
 * "best for your horse" personalisation gap (spec 11.3.9 + Journey 3 10.3).
 *
 * Ranking model — mirrors the game's competition stat weighting (README
 * "FinalScore" 50/30/20 primary/secondary/tertiary): each discipline's
 * matchScore = weighted average of the horse's actual primary/secondary/
 * tertiary stats for that discipline, scaled 0–100. Higher = better aligned.
 *
 * Trait indicators: a trait the horse actually has is surfaced per discipline
 * when that trait's affected disciplines include the discipline (positive →
 * ⭐ bonus, negative → ⚠ penalty). The trait→discipline mapping mirrors the
 * modal's getDisciplineTraitModifiers grouping so the selector and the
 * Trait-Modifiers panel agree on one source of truth.
 *
 * PURE function (no network, no React) so it can be unit-tested directly
 * against the real HorseSummary stat/trait shape. No fabrication: when the
 * horse has no usable stats it returns an empty ranking and the caller must
 * fall back to the documented popular defaults (honest, not invented
 * per-horse numbers).
 */

import { DISCIPLINE_STAT_MAP, ALL_DISCIPLINES } from './DisciplineSelector';
import { disciplineTraitEffects } from './disciplineTraitGrouping';

/**
 * Minimal real-horse shape this utility reads (a structural subset of
 * HorseSummary). No index signature so HorseSummary is assignable without a
 * cast; flat stat fields are read via an internal record view.
 */
export interface RankableHorse {
  // `object` (not Record<string,number>) so the typed SimpleHorseStats from
  // HorseSummary is assignable without an index signature; readStat() does
  // the runtime number-type guard per field.
  stats?: object | null;
  traits?: string[] | null;
}

export interface DisciplineTraitIndicator {
  /** trait name as the horse stores it (lowercased for matching) */
  trait: string;
  kind: 'bonus' | 'penalty';
}

export interface RankedDiscipline {
  discipline: string;
  /** 0–100 weighted stat-alignment score */
  matchScore: number;
  /** real traits the horse has that affect this discipline */
  traitIndicators: DisciplineTraitIndicator[];
}

const WEIGHTS = { primary: 0.5, secondary: 0.3, tertiary: 0.2 } as const;

/**
 * The discipline-group → trait-effect mapping (previously duplicated here)
 * now lives in the shared ./disciplineTraitGrouping module (Equoria-svilx)
 * and is imported above as `disciplineTraitEffects`, so the selector's
 * per-option indicators and TrainingSessionModal's Trait-Modifiers panel
 * derive from one source and cannot drift.
 */

function readStat(horse: RankableHorse, stat: string): number | undefined {
  const statsObj =
    horse.stats && typeof horse.stats === 'object'
      ? (horse.stats as Record<string, unknown>)
      : undefined;
  const fromStats = statsObj ? statsObj[stat] : undefined;
  if (typeof fromStats === 'number') return fromStats;
  const flat = (horse as Record<string, unknown>)[stat];
  return typeof flat === 'number' ? flat : undefined;
}

/**
 * Rank ALL disciplines by how well they fit the given horse's real stats &
 * traits. Returns the full ordered list (caller slices the top N for the
 * "best for your horse" set). Empty array when the horse has no usable stats.
 */
export function rankDisciplinesForHorse(
  horse: RankableHorse | null | undefined,
  disciplines: string[] = ALL_DISCIPLINES
): RankedDiscipline[] {
  if (!horse) return [];

  const horseTraits = (horse.traits ?? [])
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.toLowerCase());

  const ranked: RankedDiscipline[] = [];
  for (const discipline of disciplines) {
    const triple = DISCIPLINE_STAT_MAP[discipline];
    if (!triple) continue;
    const [p, s, t] = triple;
    const pv = readStat(horse, p);
    const sv = readStat(horse, s);
    const tv = readStat(horse, t);
    // require at least one real stat value — otherwise this discipline can't
    // be honestly scored for this horse.
    if (pv === undefined && sv === undefined && tv === undefined) continue;

    const matchScore = Math.round(
      (pv ?? 0) * WEIGHTS.primary + (sv ?? 0) * WEIGHTS.secondary + (tv ?? 0) * WEIGHTS.tertiary
    );

    const { bonus, penalty } = disciplineTraitEffects(discipline);
    const traitIndicators: DisciplineTraitIndicator[] = [];
    for (const ht of horseTraits) {
      if (bonus.includes(ht)) traitIndicators.push({ trait: ht, kind: 'bonus' });
      else if (penalty.includes(ht)) traitIndicators.push({ trait: ht, kind: 'penalty' });
    }

    ranked.push({
      discipline,
      matchScore: Math.max(0, Math.min(100, matchScore)),
      traitIndicators,
    });
  }

  // Highest stat-alignment first; stable tie-break by name for deterministic UI
  ranked.sort((a, b) =>
    b.matchScore !== a.matchScore
      ? b.matchScore - a.matchScore
      : a.discipline.localeCompare(b.discipline)
  );
  return ranked;
}

/** Convenience: ordered discipline-name list (top first) for recommendedDisciplines. */
export function recommendedDisciplineOrder(
  horse: RankableHorse | null | undefined,
  disciplines?: string[]
): string[] {
  return rankDisciplinesForHorse(horse, disciplines).map((r) => r.discipline);
}

/** Convenience: { discipline: matchScore } map for the selector's matchScores prop. */
export function disciplineMatchScores(
  horse: RankableHorse | null | undefined,
  disciplines?: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rankDisciplinesForHorse(horse, disciplines)) {
    out[r.discipline] = r.matchScore;
  }
  return out;
}

/** Convenience: { discipline: indicators[] } map for per-option trait badges. */
export function disciplineTraitIndicators(
  horse: RankableHorse | null | undefined,
  disciplines?: string[]
): Record<string, DisciplineTraitIndicator[]> {
  const out: Record<string, DisciplineTraitIndicator[]> = {};
  for (const r of rankDisciplinesForHorse(horse, disciplines)) {
    if (r.traitIndicators.length > 0) out[r.discipline] = r.traitIndicators;
  }
  return out;
}
