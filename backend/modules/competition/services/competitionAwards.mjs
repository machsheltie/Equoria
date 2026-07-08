/**
 * competitionAwards.mjs (Equoria-oey96.4)
 *
 * Single source of truth for the post-placement PROGRESSION awards a competition
 * grants: horse XP, owner (user) XP, and a chance-gated stat gain. Extracted so
 * the overnight show executor (`executeClosedShows`) and any future competition
 * path award the same thing the same way — instead of the awards living only in
 * the now-410 legacy `enterAndRunShow` controller (the P1-3 audit gap: the live
 * cron path awarded prize money + rider XP but ZERO horse/owner progression).
 *
 * Design: docs/architecture/show-xp-award-architecture.md §4.1.
 *
 * TWO CONSTRAINTS shape this module:
 *   1. No `prisma.$transaction` is ever opened here — `awardPlacementProgression`
 *      ALWAYS receives a client (`db`) and calls the TX-AWARE cores
 *      (`addXpToHorseCore` / `addXpToUserCore`). The executor calls it INSIDE its
 *      per-entry interactive tx; calling the public self-transacting writers there
 *      would open a nested tx on a second connection and self-deadlock on the
 *      user-row lock the outer tx already holds (P2028). Because this file holds
 *      no `$transaction`, it never enters the retryableTransactionWrapping pin
 *      table.
 *   2. The award TABLE is the PRD-03 §2.1 contract, frozen and pinned by a
 *      sentinel test — editing a constant away from the PRD fails CI.
 */

// Cross-module imports go through the module barrels (ESLint-enforced boundary,
// Equoria-v8l96.4). Both cores are tx-aware (accept a `db` client first arg).
import { addXpToHorseCore } from '../../horses/index.mjs';
import { addXpToUserCore } from '../../users/index.mjs';
// calculateStatGains is a shared util (ordinal-keyed) with an injectable RNG seam
// (_rngFn) — reuse it rather than reinventing the chance/stat-selection logic.
import { calculateStatGains } from '../../../utils/competitionRewards.mjs';

/**
 * PRD-03 §2.1 award table (docs/product/PRD-03-Gameplay-Systems.md:141-146).
 * Verified equal to the legacy constants (awardCompetitionXp = 20 base + 10/7/5;
 * enterAndRunShow user-XP switch = 20/15/10; calculateStatGains = 0.10/0.05/0.03).
 * Frozen so a mutation is a compile-time-ish error and pinned by
 * competitionAwards.test.mjs (§5.D sentinel).
 */
const PLACEMENT_AWARD_TABLE = Object.freeze({
  1: Object.freeze({ horseXp: 30, userXp: 20, statGainChance: 0.1, ordinal: '1st' }),
  2: Object.freeze({ horseXp: 27, userXp: 15, statGainChance: 0.05, ordinal: '2nd' }),
  3: Object.freeze({ horseXp: 25, userXp: 10, statGainChance: 0.03, ordinal: '3rd' }),
});

// Participation award for 4th place and beyond: the PRD grants every entrant the
// base 20 horse XP (the legacy path under-awarded — it only ran inside
// `if (placement)` so 4th+ got nothing), but NO user XP and NO stat-gain roll.
const PARTICIPATION_AWARD = Object.freeze({ horseXp: 20, userXp: 0, statGainChance: 0 });

/**
 * Map a NUMERIC placement (the executor stores placement as "1"/"2"/"3"…; this
 * takes the 1-based number) to its award row. Placements 1-3 get the podium row;
 * 4th+ (and any non-integer/invalid input, defensively) get the participation
 * row. The returned `ordinal` ('1st'/'2nd'/'3rd' or `${n}th`) is what
 * `calculateStatGains` keys on and what the audit reason strings read.
 *
 * Pure — no I/O. This is the number->ordinal normalization boundary so the
 * numeric-placement executor never touches the ordinal-keyed legacy helpers.
 *
 * @param {number} placementNumber - 1-based finishing position.
 * @returns {{horseXp:number, userXp:number, statGainChance:number, ordinal:string}}
 */
export function computePlacementAwards(placementNumber) {
  const n = Number(placementNumber);
  const podium = Number.isInteger(n) ? PLACEMENT_AWARD_TABLE[n] : undefined;
  if (podium) {
    return podium;
  }
  const ordinal = Number.isInteger(n) && n >= 1 ? `${n}th` : 'participant';
  return { ...PARTICIPATION_AWARD, ordinal };
}

/**
 * Perform ALL progression writes for one placed entry, on the supplied client.
 *
 * Order (matches the legacy semantics + the PRD):
 *   1. Horse XP — EVERY entrant (podium and participation) via addXpToHorseCore.
 *   2. User (owner) XP — top-3 only (userXp > 0) via addXpToUserCore.
 *   3. Stat gain — top-3 only, chance-gated; applied as a CAP-SAFE atomic +1
 *      (`updateMany where stat < 100`) so a stat already at the 0-100 ceiling is
 *      a no-op instead of exceeding it. `updateHorseRewards`/`updateHorseStat`
 *      are deliberately NOT reused — they are separate un-transacted writes that
 *      also bundle earnings (the totalEarnings gap is the separate Equoria-xal4m).
 *
 * `db` MUST be a transaction client when atomicity with sibling writes is
 * required (the executor passes its per-entry `tx`); a root client is acceptable
 * for standalone/unit use. No `$transaction` is opened here.
 *
 * @param {object} db - prisma client or `$transaction` tx client.
 * @param {object} params
 * @param {number} params.horseId - Horse receiving XP / a possible stat gain.
 * @param {string} [params.ownerId] - Owner user id (top-3 user XP recipient).
 * @param {number} params.placementNumber - 1-based finishing position.
 * @param {string} params.discipline - Show discipline (reason strings + stat map).
 * @param {string} [params.horseName] - Horse name for the user-XP reason string.
 * @param {Function} [params.rng] - Injectable RNG (defaults Math.random); tests
 *   pass () => 0 (always gain) / () => 0.999 (never gain).
 * @returns {Promise<{awards:object, statGain:{stat:string,gain:number}|null}>}
 *   for the caller's logging / notification payloads.
 */
export async function awardPlacementProgression(
  db,
  { horseId, ownerId, placementNumber, discipline, horseName, rng = Math.random },
) {
  const awards = computePlacementAwards(placementNumber);

  // 1. Horse XP — all entrants.
  await addXpToHorseCore(
    db,
    horseId,
    awards.horseXp,
    `Competition: ${awards.ordinal} place in ${discipline}`,
  );

  // 2. Owner XP — top-3 only.
  if (awards.userXp > 0 && ownerId) {
    await addXpToUserCore(
      db,
      ownerId,
      awards.userXp,
      `${awards.ordinal} place with horse ${horseName ?? 'Unknown'} in ${discipline}`,
    );
  }

  // 3. Stat gain — top-3 only, chance-gated. calculateStatGains returns
  // { stat, gain } or null; `stat` comes from a hardcoded discipline->stats map
  // (allow-listed constants — safe to interpolate as a column key).
  const statGain =
    awards.statGainChance > 0 ? calculateStatGains(awards.ordinal, discipline, rng) : null;
  if (statGain) {
    await db.horse.updateMany({
      where: { id: horseId, [statGain.stat]: { lt: 100 } },
      data: { [statGain.stat]: { increment: statGain.gain } },
    });
  }

  return { awards, statGain };
}
