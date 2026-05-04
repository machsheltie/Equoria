/**
 * Pregnancy bonus formula — frontend mirror of backend/utils/pregnancyBonus.mjs.
 *
 * Feed-system redesign 2026-04-29 (Equoria-ta4s, parent: Equoria-3gqg).
 *
 * Mirrors the canonical backend formula so the in-foal panel can show a live
 * preview of positive_chance / negative_chance without an extra API roundtrip.
 *
 * Contract: identical numeric output to
 *   backend/utils/pregnancyBonus.mjs#calculatePregnancyEpigeneticChances
 * for every input. Verified by the spec §8.2 worked-examples test.
 *
 * Spec: docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md §8.2
 */

/** Per-feeding bonus weight (in percentage points) by tier. */
export const PREGNANCY_BONUS_PCT: Record<string, number> = Object.freeze({
  basic: 0,
  performance: 5,
  performancePlus: 10,
  highPerformance: 15,
  elite: 20,
}) as Record<string, number>;

/** Percentage points added to negative_chance per missed day. */
export const NEG_PER_MISSED_DAY = 5;

/** Length of an Equoria gestation, in days. Doubles as the divisor floor. */
export const GESTATION_DAYS = 7;

export interface PregnancyChances {
  positive_chance: number;
  negative_chance: number;
}

/**
 * Calculate the pregnancy epigenetic-trait probability adjustments at foaling.
 * Unknown tier keys are ignored silently (matches backend behaviour).
 * Missing/null/undefined input is treated as zero feedings.
 */
export function calculatePregnancyEpigeneticChances(
  feedingsByTier?: Record<string, number> | null
): PregnancyChances {
  const counters = feedingsByTier ?? {};

  let totalFeedings = 0;
  let weightedSum = 0;

  for (const [tier, rawCount] of Object.entries(counters)) {
    const weight = PREGNANCY_BONUS_PCT[tier];
    if (weight === undefined || weight === null) {
      continue; // unknown tier key — ignore silently
    }
    const count = Number(rawCount) || 0;
    totalFeedings += count;
    weightedSum += count * weight;
  }

  const divisor = Math.max(GESTATION_DAYS, totalFeedings);
  const positive_chance = weightedSum / divisor;

  const unfedDays = Math.max(0, GESTATION_DAYS - totalFeedings);
  const negative_chance = unfedDays * NEG_PER_MISSED_DAY;

  return { positive_chance, negative_chance };
}
