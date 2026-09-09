/**
 * Groom Age — the groom's ORDINARY age, on the clock horses already use.
 *
 * Equoria-ypb7d.1, implementing the owner's ruling of 2026-09-09 (Equoria-maeba):
 *   "grooms should have a built in start age. Anywhere from 18-24 years old.
 *    They should require [retire] at 50-65 years old. Just like horses, a groom
 *    ages a year per week."
 *
 * THE CLOCK, AND WHY THERE IS ONLY ONE
 *   Equoria's clock is `DAYS_PER_GAME_YEAR = 7` — one real week is one game-year.
 *   It is declared once, in backend/utils/horseAge.mjs, and that is what horses
 *   age on. `Groom.careerWeeks` already advances by exactly one per weekly career
 *   pass (groomRetirementService.incrementCareerWeeks, scheduled Mondays 09:45
 *   UTC), so it already ticks once per game-year on that same clock. What it
 *   lacked was an origin: it starts at 0 at hire, so a groom hired today was
 *   modelled as being age 0.
 *
 *   This module supplies the missing origin and nothing else:
 *
 *       age = startAge + careerWeeks
 *
 *   No second counter, no second cron, no second cadence. `startAge` is drawn
 *   once and never changes; every tick still comes from the existing weekly pass.
 *   The alternative — giving grooms a `dateOfBirth` and deriving age from the
 *   calendar the way `horseAge.getHorseAgeYears()` does for horses — was
 *   considered and rejected: it would have advanced a groom's age on their own
 *   hire-day anniversary rather than on the weekly pass, so the pass that decides
 *   retirement would read an age that changed between passes. One counter, read
 *   at one place, is the smaller thing.
 *
 * TIME TO RETIREMENT, STATED HONESTLY
 *   Retirement is at a hidden age drawn from 50..65 (see
 *   groomRetirementScheduleService.mjs). With a start age of 18..24, a groom
 *   therefore works between 65 - 24 = 26 and 50 - 18 = 32 weekly passes at the
 *   extremes of a single draw — and across the two independent draws the span is
 *   26 to 47 weekly passes. That is six months to nearly a year of real time. The
 *   mechanic remains slow to observe; that is inherent to a year-per-week clock
 *   and is not a defect.
 *
 * THIS VALUE IS NOT SECRET
 *   Deliberately unlike the retirement age. That one is hidden in its own table
 *   because the ruling says it "is not known until the week they retire", and
 *   scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs enforces it. A
 *   groom's ordinary age is a character attribute, like `personality` or `bio`,
 *   so it is a plain column on `grooms`. Two different values; only one hidden.
 *   No player-facing response emits the age YET — whether it should is the
 *   owner's call and belongs to Equoria-ypb7d.5's surfaces, so this module is
 *   deliberately the only reader for now.
 */

import { randomInt } from 'node:crypto';

/**
 * The inclusive band a groom's start age is drawn from.
 *
 * Enforced twice on purpose. Here, by the draw; and in the database, by the
 * `grooms_start_age_range` CHECK constraint created in migration
 * 20260909120000_ypb7d_groom_age_and_engagement. Widening the band here alone
 * produces a write error rather than a silently wider distribution.
 */
export const START_AGE_MIN = 18;
export const START_AGE_MAX = 24;

/**
 * Draw a start age uniformly from [START_AGE_MIN, START_AGE_MAX] inclusive.
 *
 * `crypto.randomInt(min, max)` is half-open on `max`, hence the `+ 1`. It is used
 * rather than `Math.random()` for the same reason the retirement draw does: a
 * modulo-biased draw over a seven-value band is measurably lopsided, and chance
 * is the whole rule here. The owner's addendum — "Math.random determines when
 * they retire between 50-65 years old. That is all." — is a statement that
 * NOTHING ELSE may influence the timing, not a requirement to use that specific
 * function. Level, experience, assignment count and performance are absent from
 * this module and from the retirement decision by construction.
 *
 * @returns {number} An integer in [18, 24]
 */
export function drawStartAge() {
  return randomInt(START_AGE_MIN, START_AGE_MAX + 1);
}

/**
 * The groom's current age in game-years, or null when it is not yet known.
 *
 * @param {{ startAge: number|null|undefined, careerWeeks: number|null|undefined }} groom
 * @returns {number|null} `startAge + careerWeeks`, or null when `startAge` has
 *   not been drawn yet (a groom that predates Equoria-ypb7d and whose first
 *   weekly pass has not run). Null is NOT 0: an unknown age must not be treated
 *   as "very young" or "very old", and the retirement rule refuses to act on it.
 */
export function groomAgeYears(groom) {
  if (!groom || groom.startAge === null || groom.startAge === undefined) {
    return null;
  }
  return groom.startAge + (groom.careerWeeks ?? 0);
}

/**
 * Ensure this groom has a start age, drawing one if it does not. Idempotent.
 *
 * CONCURRENCY: mechanism (2) of the campaign's concurrency rule — a guarded
 * conditional update whose `where` carries the precondition (`startAge: null`)
 * and whose affected-row count decides the outcome. Two concurrent callers
 * cannot both draw: the loser sees `count === 0`, re-reads, and returns the
 * winner's value. No `SELECT ... FOR UPDATE`, because the precondition fits in
 * the WHERE clause. Safe on a transaction client as well as the autocommit one —
 * unlike a unique-violation recovery, a `count === 0` does not abort the
 * transaction, so the re-read below always succeeds.
 *
 * @param {import('@prisma/client').PrismaClient|Object} client - Prisma client or tx client
 * @param {number} groomId
 * @returns {Promise<number>} The groom's start age
 */
export async function ensureStartAge(client, groomId) {
  const drawn = drawStartAge();

  const claimed = await client.groom.updateMany({
    where: { id: groomId, startAge: null },
    data: { startAge: drawn },
  });
  if (claimed.count === 1) {
    return drawn;
  }

  // Either a concurrent caller drew first, or the groom already had one, or the
  // groom does not exist. Distinguish by reading.
  const existing = await client.groom.findUnique({
    where: { id: groomId },
    select: { startAge: true },
  });
  if (!existing) {
    throw new Error(`Groom with ID ${groomId} not found`);
  }
  if (existing.startAge === null) {
    // The conditional update matched nothing AND the column is still null. That
    // is not a race outcome; it is a broken precondition (a rolled-back sibling
    // write, say). Fail loudly rather than returning a fabricated age.
    throw new Error(`Failed to draw a start age for groom ${groomId}`);
  }
  return existing.startAge;
}

export default {
  START_AGE_MIN,
  START_AGE_MAX,
  drawStartAge,
  groomAgeYears,
  ensureStartAge,
};
