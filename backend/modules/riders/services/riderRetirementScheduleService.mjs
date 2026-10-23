/**
 * Rider age and the HIDDEN rider retirement schedule (owner ruling 2026-10-23,
 * Equoria-or2ua). Mirrors the groom pair (groomAgeService.mjs and
 * groomRetirementScheduleService.mjs) with the rider bands.
 *
 * THE RULING
 *   New riders start at a random age of 18-25. Each rider's retirement age is
 *   rolled at generation from 40-65 and is NEVER shown, returned by an API or
 *   derivable. Careers vary: some long, some short.
 *
 * THE CLOCK
 *   One real week is one game-year (backend/utils/horseAge.mjs). A rider's age
 *   is `startAge + careerWeeks`, and `careerWeeks` ticks once per weekly career
 *   pass (incrementWeeklyCareerWeeks), so the age follows the game calendar with
 *   no second counter. A rider retires when that age reaches the hidden
 *   retirement age.
 *
 * WHY THE RETIREMENT AGE LIVES IN ITS OWN TABLE
 *   `RiderRetirementSchedule` is a 1:1 table, not a column on `riders`. Rider
 *   reads in this codebase serialise the row straight into player-facing
 *   responses; a scalar column would leak into all of them. A relation is absent
 *   from those responses by construction (Prisma emits it only when asked), and
 *   the only code that asks is riderRetirementService.mjs and the backfill
 *   script. Every draw or read of the age is therefore one grep away:
 *   `riderRetirementSchedule`. A jest sentinel
 *   (__tests__/riderRetirementHidden.integration.test.mjs) enforces that.
 *
 * The start age is NOT secret (a character attribute like `personality`), so it
 * is a plain nullable column on `riders`.
 */

import { randomInt } from 'node:crypto';

export const riderStartAgeMin = 18;
export const riderStartAgeMax = 25;
export const riderRetirementAgeMin = 40;
export const riderRetirementAgeMax = 65;

/**
 * Draw a start age uniformly from [18, 25] inclusive.
 * (`crypto.randomInt` is half-open on max, hence the `+ 1`.)
 * @returns {number}
 */
export function drawRiderStartAge() {
  return randomInt(riderStartAgeMin, riderStartAgeMax + 1);
}

/**
 * Draw a retirement age uniformly from [40, 65] inclusive.
 * @returns {number}
 */
export function drawRiderRetirementAge() {
  return randomInt(riderRetirementAgeMin, riderRetirementAgeMax + 1);
}

/**
 * A rider's current age in game-years, or null when the start age is unknown
 * (a rider that predates this ruling and has not been backfilled). Null is not
 * zero: an unknown age must never be read as very young.
 * @param {{ startAge: number|null|undefined, careerWeeks: number|null|undefined }} rider
 * @returns {number|null}
 */
export function riderAgeYears(rider) {
  if (!rider || rider.startAge === null || rider.startAge === undefined) {
    return null;
  }
  return rider.startAge + (rider.careerWeeks ?? 0);
}

/**
 * Ensure this rider has exactly one persisted retirement age. Idempotent: the
 * first call draws and persists, later calls leave the stored value alone.
 * Returns nothing on purpose: no caller outside the retirement service may hold
 * the number. Safe on a transaction client (createMany + skipDuplicates does not
 * abort the transaction on a concurrent insert).
 *
 * @param {Object} client - Prisma client or transaction client
 * @param {number} riderId
 * @returns {Promise<void>}
 */
export async function ensureRiderRetirementSchedule(client, riderId) {
  await client.riderRetirementSchedule.createMany({
    data: [{ riderId, retirementAge: drawRiderRetirementAge() }],
    skipDuplicates: true,
  });
}

/**
 * Ensure this rider has a start age, drawing one if it does not. Idempotent: a
 * guarded conditional update (`startAge: null`) decides the winner.
 * @param {Object} client - Prisma client or transaction client
 * @param {number} riderId
 * @returns {Promise<void>}
 */
export async function ensureRiderStartAge(client, riderId) {
  await client.rider.updateMany({
    where: { id: riderId, startAge: null },
    data: { startAge: drawRiderStartAge() },
  });
}
