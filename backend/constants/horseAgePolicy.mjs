/**
 * Horse Age Policy — canonical active-age bounds (Equoria-2nacc / oey96.15)
 *
 * Single source of truth for the game's horse lifecycle age gates, shared
 * across training, competition, and breeding. Per PRODUCT.md § Core Simulation,
 * the "retires at 21" language is a fencepost: age 20 is the last ACTIVE
 * game-year (inclusive), and 21 is the retirement label. Every gate reads
 * these constants instead of inlining `20`/`21` literals — per-path literals
 * are exactly how the historic
 * 20-vs-21 drift happened (§5.5).
 *
 * 🎯 CONSUMERS (each imports THIS module — do NOT duplicate the values):
 * - Training   : trainingController.computeCanTrain (Equoria-oey96.15 — this leg, LIVE)
 * - Competition: enterShow / isHorseEligible / checkAgeRequirements (planned — 2nacc legs)
 * - Breeding   : shared stud eligibility validator (planned — 2nacc legs; the
 *                breeding leg is expected to add MAX_MARE_BREEDING_AGE_YEARS here)
 *
 * Only MIN/MAX_ACTIVE_AGE_YEARS + RETIREMENT_AGE_YEARS exist in this commit; the
 * competition/breeding consumers and any breeding-specific re-exports land with
 * their own 2nacc legs (do NOT assume they exist yet).
 *
 * ⏰ Age is always read via getHorseAgeYears / backend/utils/horseAge.mjs
 * (Equoria-vdw5, date-only UTC). NEVER inline `Math.floor((Date.now()-dob)/…)`.
 *
 * Rule form (game-years, inclusive): MIN_ACTIVE_AGE_YEARS <= age <= MAX_ACTIVE_AGE_YEARS.
 */

// First game-year at which training / competition / breeding all begin.
export const MIN_ACTIVE_AGE_YEARS = 3;

// Last ACTIVE game-year, inclusive. A horse aged exactly 20 is still active;
// 21 is over the cap. Tuning this changes lifetime training opportunity and
// competition balance; require a fresh owner ruling and coordinated review.
export const MAX_ACTIVE_AGE_YEARS = 20;

// Display / UX label: the age at which a horse "retires" (one past the last
// active year). Not itself a gate — the gate is `age > MAX_ACTIVE_AGE_YEARS`.
export const RETIREMENT_AGE_YEARS = 21;
