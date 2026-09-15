/**
 * Groom Retirement Schedule — the game's HIDDEN per-groom retirement age.
 *
 * Equoria-m9lz1, implementing the owner's ruling (2026-09-08): "Grooms retire
 * automatically at a randomly selected age by the game. They can retire any
 * time between age 50-65 and that is not known until the week they retire."
 *
 * This module is deliberately tiny and deliberately separate. It is the ONLY
 * place that draws or reads a groom's retirement age, which makes the hiding
 * requirement auditable by grep: any leak of the age would have to import from
 * here or `include: { retirementSchedule: ... }` a groom read, and there are no
 * such call sites outside `groomRetirementService.mjs` and the two hire paths
 * (which write, never return, the value).
 *
 * THE UNIT: GAME-YEARS OF AGE, NOT WEEKS OF CAREER
 *   Equoria-maeba, owner ruling 2026-09-14: "I am confirming the new specified
 *   aging criteria. Retire any reference to the old system." `retirementAge` is
 *   an AGE in game-years, and the retirement test is
 *
 *       groomAgeYears(groom) >= retirementAge      i.e.
 *       startAge + careerWeeks >= retirementAge
 *
 *   (see groomAgeService.mjs and checkRetirementEligibility). One real week is
 *   one game-year (backend/utils/horseAge.mjs), so `Groom.careerWeeks` is the
 *   number of years the groom has WORKED — the offset from `startAge`, never the
 *   age itself. This docblock used to state the test as
 *   `careerWeeks >= retirementAge`; that was the retired reading, under which a
 *   groom hired today was age 0 and retired at an effective 75-90.
 *
 * THE RANGE
 *   Enforced twice on purpose. Here, by the draw; and in the database, by the
 *   `groom_retirement_schedules_age_range` CHECK constraint created in migration
 *   20260908180000_m9lz1_groom_retirement_schedule. Widening the band here alone
 *   produces a write error rather than a silently wider distribution.
 */

import { randomInt } from 'node:crypto';

/**
 * The inclusive random band for a groom's retirement age.
 * Re-exported through `CAREER_CONSTANTS` in groomRetirementService.mjs.
 */
export const RETIREMENT_AGE_MIN = 50;
export const RETIREMENT_AGE_MAX = 65;

/**
 * Draw a retirement age uniformly from [RETIREMENT_AGE_MIN, RETIREMENT_AGE_MAX]
 * inclusive.
 *
 * `crypto.randomInt(min, max)` is half-open on `max`, hence the `+ 1`. It is
 * used rather than `Math.random()` because a modulo-biased draw over a 16-value
 * band is a visible distribution defect, and this value is drawn once per groom
 * and never revisited.
 *
 * @returns {number} an integer in [50, 65]
 */
export function drawRetirementAge() {
  return randomInt(RETIREMENT_AGE_MIN, RETIREMENT_AGE_MAX + 1);
}

/**
 * Read a groom's persisted retirement age, or null when none has been drawn.
 *
 * @param {Object} client - Prisma client or transaction client
 * @param {number} groomId
 * @returns {Promise<number|null>}
 */
export async function readRetirementAge(client, groomId) {
  const row = await client.groomRetirementSchedule.findUnique({
    where: { groomId },
    select: { retirementAge: true },
  });
  return row ? row.retirementAge : null;
}

/**
 * Ensure a groom has exactly one persisted retirement age, and return it.
 *
 * Idempotent and safe to call repeatedly: the first call draws and persists,
 * every later call returns the SAME stored value. That is the whole point of
 * persisting rather than recomputing — a value derived on each read could differ
 * between two reads and the groom's retirement week would drift.
 *
 * `groomId` is the table's primary key, so two concurrent callers cannot create
 * two schedules.
 *
 * THE P2002 RECOVERY BELOW ONLY WORKS ON AN AUTOCOMMIT CLIENT. When two callers
 * race on the module-level `prisma`, the loser catches P2002 and re-reads the
 * winner's row. When `client` is a TRANSACTION client it does NOT: in PostgreSQL a
 * unique violation aborts the enclosing transaction, so every subsequent statement
 * on that `tx` — including the re-read — fails with "current transaction is
 * aborted", and the catch cannot rescue anything. That is correct behaviour for
 * the two callers that pass a `tx`: both hire paths create the groom in the SAME
 * transaction, so no concurrent writer can have inserted a schedule for a groom id
 * that did not exist a moment ago, the P2002 branch is unreachable there, and if
 * it ever did fire the right outcome is the hire rolling back rather than a
 * half-recovered one. The recovery exists for the weekly-pass backstop, which
 * passes the autocommit client and is the only caller that can genuinely race.
 *
 * Called at hire from both hire paths (groomRosterController.hireGroom,
 * groomMarketplaceController.hireFromMarketplace) inside their existing
 * transactions, and again from the weekly career pass as the backstop for grooms
 * that predate Equoria-m9lz1, legacy protégés, and test fixtures. The backstop
 * is why the migration performs no backfill.
 *
 * @param {Object} client - Prisma client or transaction client
 * @param {number} groomId
 * @returns {Promise<number>} the groom's persisted retirement age
 */
export async function ensureRetirementSchedule(client, groomId) {
  const existing = await readRetirementAge(client, groomId);
  if (existing !== null) {
    return existing;
  }

  try {
    const created = await client.groomRetirementSchedule.create({
      data: { groomId, retirementAge: drawRetirementAge() },
      select: { retirementAge: true },
    });
    return created.retirementAge;
  } catch (error) {
    // P2002: a concurrent caller won the race. The stored value is
    // authoritative — read it rather than drawing a second age.
    if (error?.code !== 'P2002') {
      throw error;
    }
    const winner = await readRetirementAge(client, groomId);
    if (winner === null) {
      throw error;
    }
    return winner;
  }
}

export default {
  RETIREMENT_AGE_MIN,
  RETIREMENT_AGE_MAX,
  drawRetirementAge,
  readRetirementAge,
  ensureRetirementSchedule,
};
