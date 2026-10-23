/**
 * Shared competition scoring helpers (Equoria-pqdte).
 *
 * Background — the duplication this module eliminates:
 * Two engines in the codebase score competition entries:
 *   1. backend/logic/simulateCompetition.mjs (rich, instant-path simulator —
 *      full stats / traits / tack / health / stress / luck pipeline).
 *   2. backend/modules/competition/shows/showExecutionService.mjs#executeClosedShows
 *      (the nightly 7-day-show cron — 50/30/20 discipline base + luck + rider; B4a).
 *
 * The two engines differ ON PURPOSE for the rest of the formula, but BOTH
 * apply the SAME rider flag-compatibility adjustment to the rider percents
 * before using them (the instant simulator through `applyRiderModifiers`; the
 * nightly scorer as one summed percent term, Equoria-576c0 B5). Pre-pqdte that block was literally
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
 * cron uses the 50/30/20 base + luck + rider only). They are not realistically
 * unifiable into a single scorer without changing product semantics. The
 * pragmatic interpretation of "single scoring function the two engines
 * consume" is this module: the rider flag-compat fragment was the only
 * scoring step that was actually duplicated. The other formula differences
 * are intentional, not duplication.
 *
 * Current state: simulateCompetition.mjs was deleted as dead code on
 * 2026-10-21, so the nightly scorer below is the only engine. Epic
 * Equoria-k1p62 brings the owner's locked factors into it: the matching
 * discipline trait (k1p62.1) and saddle/bridle tack (k1p62.2) as flat points.
 */

import { BONUS_CAP, PENALTY_CAP, computeRiderModifiers } from '../../../utils/riderBonus.mjs';
import { calculateRiderFlagCompatibility } from '../../../utils/riderFlagCompatibility.mjs';
import logger from '../../../utils/logger.mjs';
import {
  DISCIPLINE_STATS,
  isKnownDiscipline,
  matchingTraitPoints,
  temperamentPercent,
} from '../rules/disciplineRules.mjs';
import { tackPoints } from '../rules/tackScoring.mjs';

/**
 * The ridden base: 50% primary + 30% secondary + 20% tertiary of the
 * discipline's bible stats (owner ruling R8, BIBLE 13:45-73; Equoria-576c0 B4a).
 * Integer tenths, so an exact x.5 stays x.5 for the final round-half-up
 * (0.5*75 + 0.3*70 + 0.2*70 in floating point need not be exactly 72.5).
 * Not rounded here: the score is rounded once, at the end.
 * @param {Object} horse - Horse row with the discipline's three stats.
 * @param {string} discipline - One of the 24 competition disciplines.
 * @returns {number}
 */
export function weightedDisciplineBase(horse, discipline) {
  const [primary, secondary, tertiary] = DISCIPLINE_STATS[discipline];
  return (5 * horse[primary] + 3 * horse[secondary] + 2 * horse[tertiary]) / 10;
}

/**
 * One luck roll: +1..+10% in whole percents, never zero or negative (owner
 * ruling C1; Equoria-576c0 B5). Clamped so a seam returning 1 or less than 0
 * still yields a legal roll.
 * @param {Function} rng - Returns a number in [0, 1).
 * @returns {number} Whole percent 1..10.
 */
export function rollLuckPercent(rng) {
  return Math.max(1, Math.min(10, 1 + Math.floor(rng() * 10)));
}

/**
 * Apply the summed modifier percentages once (owner ruling C2):
 * round(base x (1 + sum / 100)), x.5 or more up, x.4 or less down. Float
 * noise below a millionth is dropped first so an exact x.5 is not read as
 * x.4999 (rider percents carry fractions such as 9.72).
 * @param {number} base - The ridden base (B4a).
 * @param {number[]} percentTerms - Each modifier in percent (luck, rider, ...).
 * @returns {number} Non-negative whole score.
 */
export function applyPercentTerms(base, percentTerms) {
  const sum = percentTerms.reduce((total, term) => total + term, 0);
  const raw = (base * (100 + sum)) / 100;
  return Math.max(0, Math.round(Number(raw.toFixed(6))));
}

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
 * Score the entries of a nightly (cron-path) show (extracted from
 * executeClosedShows, Equoria-c7mx0): the discipline's 50/30/20 base
 * (Equoria-576c0 B4a; was a flat 5-stat average) plus the flat points, times
 * (1 + the summed modifier percents), rounded once, x.5 up (B5, owner rulings
 * C1/C2). The flat points are the matching discipline trait (+5,
 * Equoria-k1p62.1) and the saddle and bridle (discipline tack +5 each in its
 * own discipline, All Purpose +2 each, Equoria-k1p62.2). The percent terms
 * are luck (+1..+10%), the rider's bonus
 * minus penalty (with flag compatibility) and temperament (+5 / 0 / -5, B6).
 * Before B5, luck was ±9 points added to the base and the rider was a second
 * multiplication.
 *
 * @param {Object} input
 * @param {Object} input.show    - Show row (discipline read).
 * @param {Array}  input.entries - ShowEntry rows incl. `horse` stats,
 *   epigeneticModifiers and tack.
 * @param {Map}    input.assignmentByHorseId - horseId -> active RiderAssignment.
 * @param {Function} [input.rng] - Luck RNG (default Math.random), called once
 *   per entry; tests pass a fixed value (0 gives +1%, 0.5 gives +6%).
 * @returns {Array<{entry: Object, score: number, assignment: Object|undefined,
 *   breakdown: Object}>} `breakdown` holds every input of the score (base, flat
 *   points, each percent term) so a result can be audited (Equoria-4q02c).
 */
export function scoreShowEntries({ show, entries, assignmentByHorseId, rng = Math.random }) {
  // A show row whose discipline is outside the 24 (a legacy name) keeps the
  // pre-B4a flat 5-stat average, so the show still settles instead of failing
  // the nightly run.
  const weighted = isKnownDiscipline(show.discipline);
  if (!weighted) {
    logger.error(
      `[competitionScoring] show ${show.id ?? 'unknown'}: discipline "${show.discipline}" is not a competition discipline; scored on the flat 5-stat average`,
    );
  }
  // Horses scored with a 0 temperament term because theirs is missing or not
  // one of the 11 (O5 interim); logged once for the show below.
  const unrecognizedTemperamentHorseIds = [];
  const scored = entries.map(entry => {
    const h = entry.horse;
    // Equoria-507mt: stat columns are NOT NULL at the schema layer
    // (migration 20260530130000_507mt_horse_stats_nonnull). The prior
    // `?? 50` defaults silently scored a NULL-stat horse at mid-pack —
    // a bug masked by the fact that no production path ever inserted
    // NULL. The schema lock makes that impossible; the readers stop
    // pretending NULL is meaningful.
    const base = weighted
      ? weightedDisciplineBase(h, show.discipline)
      : (h.speed + h.stamina + h.agility + h.precision + h.boldness) / 5;
    const luckPercent = rollLuckPercent(rng); // one roll per horse per competition (C1)

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
    // Temperament (R1, B6): +5 / 0 / -5 from the owner's matrix. A null or
    // unknown-name temperament contributes 0, as every horse did before B6,
    // and is logged once per show (O5 interim, approved 2026-10-17). A legacy discipline has
    // no matrix row and was already logged above, so it contributes 0 quietly.
    let temperamentTerm = 0;
    if (weighted) {
      const percent = temperamentPercent(show.discipline, h.temperament);
      if (percent === null) {
        unrecognizedTemperamentHorseIds.push(h.id ?? entry.horseId);
      } else {
        temperamentTerm = percent;
      }
    }

    // Flat points join the base before the percentages (owner ruling
    // 2026-10-20, decision D 2026-10-23). A legacy discipline keeps its
    // pre-B4a scoring, so it gets none.
    const traitPoints = weighted ? matchingTraitPoints(h.epigeneticModifiers, show.discipline) : 0;
    const tackBonus = weighted ? tackPoints(h.tack, show.discipline) : 0;

    // C2: each modifier as a percent, summed, applied once. Health stays out
    // until the owner settles decision C (Equoria-k1p62).
    const riderPercent = (bonusPercent - penaltyPercent) * 100;
    const percentTerms = [luckPercent, riderPercent, temperamentTerm];
    const breakdown = {
      base,
      traitPoints,
      tackPoints: tackBonus,
      luckPercent,
      riderPercent,
      temperamentPercent: temperamentTerm,
    };

    return {
      entry,
      score: applyPercentTerms(base + traitPoints + tackBonus, percentTerms),
      assignment,
      breakdown,
    };
  });
  if (unrecognizedTemperamentHorseIds.length > 0) {
    logger.error(
      `[competitionScoring] show ${show.id ?? 'unknown'}: ${unrecognizedTemperamentHorseIds.length} horse(s) with no recognized temperament scored with a 0 temperament term: ${unrecognizedTemperamentHorseIds.join(', ')}`,
    );
  }
  return scored;
}

/**
 * How many times a tie may be re-rolled before the ordering gives up. Only an
 * rng that keeps answering the same value (a test's fixed seam) gets near it:
 * with Math.random two horses tie on ten rounds in a row once in 10^10 shows.
 */
const maxTieBreakRounds = 50;

/**
 * Order tied horses by re-rolling the luck roll among them (owner ruling
 * 2026-10-22, Equoria-bvddn.22): each tied horse rolls again, the higher roll
 * places higher, and horses that roll the same re-roll among themselves until
 * the order is strict. The re-roll only orders the tie; the horses keep the
 * score they tied on, and every other horse keeps its place.
 *
 * The tied horses roll in horseId order, which only fixes which horse receives
 * which roll (so an injected rng reproduces the same outcome); it favours no
 * one.
 */
function orderTiedByLuckReroll(tied, rng, round = 0) {
  if (tied.length < 2) {
    return tied;
  }
  if (round >= maxTieBreakRounds) {
    logger.error(
      `[competitionScoring] tie between horses ${tied.map(t => t.entry.horseId).join(', ')} still unbroken after ${maxTieBreakRounds} luck re-rolls (the rng keeps answering the same roll); kept in horseId order`,
    );
    return tied;
  }
  const rolls = new Map(tied.map(item => [item, rollLuckPercent(rng)]));
  const byRoll = [...tied].sort((a, b) => rolls.get(b) - rolls.get(a));
  return groupsOfEqual(byRoll, item => rolls.get(item)).flatMap(group =>
    orderTiedByLuckReroll(group, rng, round + 1),
  );
}

/** Split an already-sorted list into runs of equal key, in order. */
function groupsOfEqual(sorted, keyOf) {
  const groups = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && keyOf(last[0]) === keyOf(item)) {
      last.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups;
}

/**
 * Rank scored entries best first, with no shared placings: horses on the same
 * score are ordered by a luck re-roll among them (Equoria-bvddn.22).
 *
 * @param {Array<{entry: {horseId: number}, score: number}>} scored - scoreShowEntries output
 * @param {Function} [rng] - the luck RNG (default Math.random); the executor
 *   passes the same seam it scored with
 * @returns {Array} the same items, ranked
 */
export function rankScoredEntries(scored, rng = Math.random) {
  const byScore = [...scored].sort((a, b) => b.score - a.score);
  return groupsOfEqual(byScore, item => item.score).flatMap(group =>
    group.length < 2
      ? group
      : orderTiedByLuckReroll(
          [...group].sort((a, b) => a.entry.horseId - b.entry.horseId),
          rng,
        ),
  );
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
  rankScoredEntries,
  readStagedOrdering,
};
