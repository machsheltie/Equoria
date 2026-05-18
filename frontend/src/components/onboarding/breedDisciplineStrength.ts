/**
 * breedDisciplineStrength (Equoria-55bo.4)
 *
 * Derives the top-N discipline-strength badges for a breed from its real
 * statTendencies, per Spec 11.3.4. There is no per-breed discipline-strength
 * field on the backend, so we compute it from the breed's stat averages
 * using the SAME discipline→stat triple + 50/30/20 weighting the game's
 * competition model uses (DISCIPLINE_STAT_MAP, README "FinalScore").
 *
 * BreedStatTendencies only carries 6 of the 12 game stats (speed, stamina,
 * agility, balance, precision, boldness). A discipline whose primary/
 * secondary/tertiary triple references stats the breed data does NOT carry
 * is scored ONLY on the intersecting stats (re-normalised over the weights
 * actually present). A discipline with zero overlap is skipped entirely —
 * no fabricated strength for stats we don't have.
 *
 * PURE function (no network, no React) — unit-tested directly against the
 * real BreedStatTendencies shape.
 */

import type { BreedStatTendencies } from '@/hooks/api/useBreeds';
import { DISCIPLINE_STAT_MAP } from '@/components/training/DisciplineSelector';

export interface DisciplineStrength {
  discipline: string;
  /** 0–100 weighted strength from the breed's stat averages */
  strength: number;
}

const TIER_WEIGHTS = [0.5, 0.3, 0.2] as const;

/** Stats actually present in BreedStatTendencies. */
const BREED_STAT_KEYS: ReadonlySet<string> = new Set([
  'speed',
  'stamina',
  'agility',
  'balance',
  'precision',
  'boldness',
]);

function avgFor(tendencies: BreedStatTendencies, stat: string): number | undefined {
  if (!BREED_STAT_KEYS.has(stat)) return undefined;
  const t = (tendencies as unknown as Record<string, { avg?: number } | undefined>)[stat];
  return t && typeof t.avg === 'number' ? t.avg : undefined;
}

/**
 * Rank all disciplines by how strong the given breed's stat tendencies are
 * for them. Returns the full list sorted strongest-first; the caller slices
 * the top N. Disciplines with no overlapping breed stats are omitted (no
 * fabrication).
 */
export function rankBreedDisciplineStrengths(
  tendencies: BreedStatTendencies | null | undefined
): DisciplineStrength[] {
  if (!tendencies) return [];

  const out: DisciplineStrength[] = [];
  for (const [discipline, triple] of Object.entries(DISCIPLINE_STAT_MAP)) {
    let weightedSum = 0;
    let weightUsed = 0;
    triple.forEach((stat, i) => {
      const avg = avgFor(tendencies, stat);
      if (avg === undefined) return;
      weightedSum += avg * TIER_WEIGHTS[i];
      weightUsed += TIER_WEIGHTS[i];
    });
    if (weightUsed === 0) continue; // no overlapping stat — skip, don't invent
    const strength = Math.round(Math.max(0, Math.min(100, weightedSum / weightUsed)));
    out.push({ discipline, strength });
  }

  out.sort((a, b) =>
    b.strength !== a.strength ? b.strength - a.strength : a.discipline.localeCompare(b.discipline)
  );
  return out;
}

/** Convenience: the breed's top-N strongest disciplines (default 3). */
export function topBreedDisciplines(
  tendencies: BreedStatTendencies | null | undefined,
  n = 3
): DisciplineStrength[] {
  return rankBreedDisciplineStrengths(tendencies).slice(0, n);
}
