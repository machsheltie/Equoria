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

import {
  BONUS_CAP,
  PENALTY_CAP,
  applyRiderModifiers,
  computeRiderModifiers,
} from '../../../utils/riderBonus.mjs';
import { calculateRiderFlagCompatibility } from '../../../utils/riderFlagCompatibility.mjs';
import logger from '../../../utils/logger.mjs';

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

/**
 * Score the entries of a nightly (cron-path) show — extracted VERBATIM from
 * executeClosedShows (Equoria-c7mx0; formula unchanged: 5-stat average ±9%
 * luck, then rider modifiers with flag compatibility).
 *
 * @param {Object} input
 * @param {Object} input.show    - Show row (discipline read).
 * @param {Array}  input.entries - ShowEntry rows incl. `horse` stats.
 * @param {Map}    input.assignmentByHorseId - horseId -> active RiderAssignment.
 * @returns {Array<{entry: Object, score: number, assignment: Object|undefined}>}
 */
export function scoreShowEntries({ show, entries, assignmentByHorseId }) {
  return entries.map(entry => {
    const h = entry.horse;
    // Equoria-507mt: stat columns are NOT NULL at the schema layer
    // (migration 20260530130000_507mt_horse_stats_nonnull). The prior
    // `?? 50` defaults silently scored a NULL-stat horse at mid-pack —
    // a bug masked by the fact that no production path ever inserted
    // NULL. The schema lock makes that impossible; the readers stop
    // pretending NULL is meaningful.
    const base = (h.speed + h.stamina + h.agility + h.precision + h.boldness) / 5;
    const luck = (Math.random() - 0.5) * 18; // ±9%
    const subtotal = Math.max(0, base + luck);

    // Apply rider modifiers if an active rider is assigned to this horse.
    // computeRiderModifiers returns 0/0 for missing/null/malformed input —
    // safe to call unconditionally.
    const assignment = assignmentByHorseId.get(entry.horseId);
    let { bonusPercent, penaltyPercent } = computeRiderModifiers({
      rider: assignment?.rider ?? null,
      discipline: show.discipline,
    });

    // Equoria-grys6 / Equoria-pqdte: behavioral-flag rider compatibility
    // (adjacent to simulateCompetition.mjs yzqhj.6). ONLY when a rider is
    // present, the horse's behavioral epigenetic flags modulate HOW WELL
    // that rider performs with THIS horse — see applyRiderCompatibility
    // above for the cap-clamped shared implementation.
    if (assignment?.rider) {
      const compatResult = applyRiderCompatibility({
        bonusPercent,
        penaltyPercent,
        epigeneticFlags: h.epigeneticFlags,
      });
      if (compatResult.compatFactor !== undefined) {
        bonusPercent = compatResult.bonusPercent;
        penaltyPercent = compatResult.penaltyPercent;
        logger.info(
          `[competitionScoring] Horse ${h.name}: Rider flag-compatibility factor ${compatResult.compatFactor.toFixed(3)} applied (bonus -> ${(bonusPercent * 100).toFixed(2)}%, penalty -> ${(penaltyPercent * 100).toFixed(2)}%)`,
        );
      }
    }
    const scoreWithRider = applyRiderModifiers(subtotal, bonusPercent, penaltyPercent);

    return { entry, score: Math.max(0, Math.round(scoreWithRider)), assignment };
  });
}

/**
 * Read a show's persisted scored ordering (Equoria-c7mx0, 2026-07-06 approved
 * decision). The ordering is written in the SAME atomic statement as the
 * 'executing' claim; when a crashed execution is re-driven, the executor
 * replays this array VERBATIM instead of re-scoring, so recovery pays exactly
 * the placements scored at the original claim.
 *
 * Returns the validated array, or null when the column is NULL (fresh claim,
 * or a stranding that predates the staging migration) or structurally invalid
 * (full JSONB shape guard per CONTRIBUTING.md; a member-count mismatch with
 * the current entries — e.g. an entrant GDPR-deleted between claim and
 * re-drive — also invalidates, falling back to fresh scoring of the surviving
 * roster rather than paying a stale one).
 *
 * @param {Object} show    - Show row (stagedOrdering read).
 * @param {Array}  entries - Current ShowEntry rows for the show.
 * @returns {Array<{horseId: number, userId: string, horseName: string|null, score: number, placement: number, riderId: number|null}>|null}
 */
export function readStagedOrdering(show, entries) {
  const so = show.stagedOrdering;
  if (so === null || so === undefined) {
    return null;
  }
  const invalid = reason => {
    logger.warn(
      `[competitionScoring] Show ${show.id}: stagedOrdering present but ${reason} — falling back to fresh scoring`,
    );
    return null;
  };
  if (!Array.isArray(so)) {
    return invalid('not an array');
  }
  if (so.length !== entries.length) {
    return invalid(`member count ${so.length} != current entry count ${entries.length}`);
  }
  const entryHorseIds = new Set(entries.map(e => e.horseId));
  for (const m of so) {
    if (m === null || typeof m !== 'object' || Array.isArray(m)) {
      return invalid('a member is not an object');
    }
    if (
      !Number.isInteger(m.horseId) ||
      typeof m.userId !== 'string' ||
      typeof m.score !== 'number' ||
      !Number.isInteger(m.placement) ||
      m.placement < 1
    ) {
      return invalid('a member is missing horseId/userId/score/placement');
    }
    if (!entryHorseIds.has(m.horseId)) {
      return invalid(`staged horseId ${m.horseId} is not among the current entries`);
    }
  }
  return so;
}

export default {
  applyRiderCompatibility,
  scoreShowEntries,
  readStagedOrdering,
};
