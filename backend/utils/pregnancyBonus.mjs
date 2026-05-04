/**
 * Pregnancy bonus formula (feed-system redesign 2026-04-29).
 *
 * Pure function: takes the per-tier feeding counters accrued during a
 * mare's 7-day in-foal window and returns the epigenetic-trait probability
 * adjustments to apply at foaling.
 *
 * Spec: docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md §8.2
 *
 * Formula:
 *   - Each tier has a per-feeding bonus weight (basic 0%, performance 5%,
 *     performancePlus 10%, highPerformance 15%, elite 20%).
 *   - positive_chance = weightedSum / max(GESTATION_DAYS, totalFeedings)
 *     The divisor floor at GESTATION_DAYS prevents under-fed gestations from
 *     inflating the bonus. The max(...) cap also bounds the bonus when a
 *     mare is fed beyond the 7-day window (8th-day edge per §8.6).
 *   - negative_chance = unfedDays * NEG_PER_MISSED_DAY
 *     Each missed day adds 5% chance of a negative epigenetic trait.
 *
 * At foaling: two independent rolls (positive + negative) — both can succeed,
 * both can fail. Trait selection is delegated to the existing trait-discovery
 * system (B5 wires this in).
 */

/**
 * Per-feeding bonus weight (in percentage points) by tier.
 * Unknown tier keys are ignored.
 */
export const PREGNANCY_BONUS_PCT = Object.freeze({
  basic: 0,
  performance: 5,
  performancePlus: 10,
  highPerformance: 15,
  elite: 20,
});

/**
 * Percentage points added to negative_chance per missed day.
 */
export const NEG_PER_MISSED_DAY = 5;

/**
 * Length of an Equoria gestation, in days. Doubles as the divisor floor.
 */
export const GESTATION_DAYS = 7;

/**
 * Calculate the pregnancy epigenetic-trait probability adjustments at foaling.
 *
 * @param {Object<string, number>} [feedingsByTier] - Map of tier key → number of feedings.
 *   Keys MUST match `PREGNANCY_BONUS_PCT`. Unknown keys are silently ignored.
 *   Missing/null/undefined input is treated as zero feedings.
 * @returns {{ positive_chance: number, negative_chance: number }}
 *   Both fields are percentages (0-100).
 */
export function calculatePregnancyEpigeneticChances(feedingsByTier) {
  const counters = feedingsByTier ?? {};

  let totalFeedings = 0;
  let weightedSum = 0;

  for (const [tier, rawCount] of Object.entries(counters)) {
    if (PREGNANCY_BONUS_PCT[tier] == null) {
      continue; // unknown tier key — ignore silently
    }
    const count = Number(rawCount) || 0;
    totalFeedings += count;
    weightedSum += count * PREGNANCY_BONUS_PCT[tier];
  }

  const divisor = Math.max(GESTATION_DAYS, totalFeedings);
  const positive_chance = weightedSum / divisor;

  const unfedDays = Math.max(0, GESTATION_DAYS - totalFeedings);
  const negative_chance = unfedDays * NEG_PER_MISSED_DAY;

  return { positive_chance, negative_chance };
}
