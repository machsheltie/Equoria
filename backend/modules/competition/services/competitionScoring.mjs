/**
 * Shared competition scoring helpers (Equoria-pqdte).
 *
 * Background — the duplication this module eliminates:
 * Two engines in the codebase score competition entries:
 *   1. backend/logic/simulateCompetition.mjs (rich, instant-path simulator —
 *      full stats / traits / tack / health / stress / luck pipeline).
 *   2. backend/modules/competition/shows/showController.mjs#executeClosedShows
 *      (the nightly 7-day-show cron — simple 5-stat avg + luck + rider).
 *
 * The two engines differ ON PURPOSE for the rest of the formula, but BOTH
 * apply the SAME rider flag-compatibility adjustment to the rider percents
 * before invoking `applyRiderModifiers`. Pre-pqdte that block was literally
 * copy-pasted, including the two cap constants:
 *     const RIDER_BONUS_CAP = 0.1;   // mirrors riderBonus.mjs BONUS_CAP
 *     const RIDER_PENALTY_CAP = 0.08;// mirrors riderBonus.mjs PENALTY_CAP
 * and the showController comment at line 489 literally said
 *     "Mirrors simulateCompetition.mjs exactly."
 * — i.e. the engineers had already noted the drift risk in the source.
 *
 * After pqdte:
 *   - riderBonus.mjs exports BONUS_CAP / PENALTY_CAP (single source of truth).
 *   - This module exports `applyRiderCompatibility` that both engines call.
 *   - The shared sentinel test
 *     `competitionScoringShared.test.mjs` asserts neither engine re-declares
 *     a local cap constant — drift is now a CI failure, not a silent bug.
 *
 * Scope note (AC §1 — "Single scoreCompetitionEntry function"):
 * The two engines apply substantively different scoring formulas (the full
 * sim uses 50/30/20 weighted stats + traits + tack + health + stress, the
 * cron uses a flat 5-stat average + luck only). They are not realistically
 * unifiable into a single scorer without changing product semantics. The
 * pragmatic interpretation of "single scoring function the two engines
 * consume" is this module: the rider flag-compat fragment was the only
 * scoring step that was actually duplicated. The other formula differences
 * are intentional, not duplication.
 */

import { BONUS_CAP, PENALTY_CAP } from '../../../utils/riderBonus.mjs';
import { calculateRiderFlagCompatibility } from '../../../utils/riderFlagCompatibility.mjs';

/**
 * Apply behavioral-flag rider compatibility (Equoria-yzqhj.6, grys6) to the
 * rider's effective bonus/penalty percentages.
 *
 * Pure function. Returns `{ bonusPercent, penaltyPercent }` clamped to the
 * canonical `BONUS_CAP` / `PENALTY_CAP` so the output is always a legal
 * input to `applyRiderModifiers`. When the input flags net to zero valence
 * (or are absent), the rider percents are returned unchanged — the no-flag
 * regression-safe path.
 *
 * Sign convention (mirrors pre-pqdte block in both engines):
 *   - Positive-valence net flags → bonus grows (* compatFactor),
 *     penalty shrinks (* (2 - compatFactor)).
 *   - Negative-valence net flags → bonus shrinks, penalty grows.
 *   - Both are clamped to [0, CAP] so the helper can never invert the
 *     sign of the rider effect.
 *
 * @param {Object} input
 * @param {number} input.bonusPercent   - Rider's pre-compat bonus in [0, BONUS_CAP].
 * @param {number} input.penaltyPercent - Rider's pre-compat penalty in [0, PENALTY_CAP].
 * @param {unknown} input.epigeneticFlags - Horse's behavioral flags (JSONB).
 * @returns {{ bonusPercent: number, penaltyPercent: number }}
 */
export function applyRiderCompatibility({
  bonusPercent = 0,
  penaltyPercent = 0,
  epigeneticFlags = null,
} = {}) {
  const compatFactor = calculateRiderFlagCompatibility(epigeneticFlags);
  if (compatFactor === 1.0) {
    // Net-zero valence (or no flags) — unchanged. Regression-safe path.
    return { bonusPercent, penaltyPercent };
  }
  const adjustedBonus = Math.max(0, Math.min(BONUS_CAP, bonusPercent * compatFactor));
  const adjustedPenalty = Math.max(0, Math.min(PENALTY_CAP, penaltyPercent * (2 - compatFactor)));
  return {
    bonusPercent: adjustedBonus,
    penaltyPercent: adjustedPenalty,
    compatFactor, // exposed for logging at the call site
  };
}

export default {
  applyRiderCompatibility,
};
