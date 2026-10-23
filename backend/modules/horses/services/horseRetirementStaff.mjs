/**
 * Retired horses keep no staff (Equoria-6p398.14).
 *
 * Owner rulings 2026-10-23 (Stacey):
 * - A horse is retired at age 21 or over on the game clock. There is no separate
 *   retire action.
 * - Its grooms, rider and trainer are removed from it automatically when it turns
 *   21, so no staff member is tied up on, or charged for, a retired horse.
 * - Exception: a mare still in foal when she turns 21 keeps her staff (and can
 *   still be fed and vetted, because the foal depends on it) until she foals.
 *   The foaling transaction then removes them.
 *
 * So the release has two doors: the nightly birthday write (`writeBirthdayTx`,
 * called by horseAgingSystem.updateHorseAge) and the foaling claim
 * (`releaseStaffIfRetiredTx`, called by foalingService). Each runs inside the
 * transaction that changes the horse, after that horse's row is write-locked,
 * and each reads the in-foal flag / age from the locked row. That makes the
 * two doors safe against each other when the 00:05 aging and foaling jobs touch
 * the same mare: whichever commits second sees the other's write (READ
 * COMMITTED re-reads the row once the lock is granted).
 *
 * Assignments are ENDED, never deleted, exactly as a sale ends them
 * (marketplace horseTransferReconciliation): history survives. The horse's
 * derived `rider` JSON is cleared with them. Lock order: the horse row first
 * (already locked by the caller), then staff assignment rows.
 */

import { RETIREMENT_AGE_YEARS } from '../../../constants/horseAgePolicy.mjs';

/**
 * End every active groom, rider and trainer assignment on one horse and clear
 * its `rider` JSON. `rider` is written only when set, so a staffless horse costs
 * no extra horse write.
 *
 * @param {object} tx - interactive transaction client
 * @param {{ horseId: number, rider: unknown }} horse - the locked horse's id and current rider JSON
 * @returns {Promise<{ groomAssignmentsEnded: number, riderAssignmentsEnded: number, trainerAssignmentsEnded: number }>}
 */
async function releaseHorseStaff(tx, { horseId, rider }) {
  if (rider !== null && rider !== undefined) {
    await tx.horse.update({ where: { id: horseId }, data: { rider: null } });
  }
  const ended = { isActive: false };
  const grooms = await tx.groomAssignment.updateMany({
    where: { foalId: horseId, isActive: true },
    data: { ...ended, endDate: new Date() },
  });
  const riders = await tx.riderAssignment.updateMany({
    where: { horseId, isActive: true },
    data: ended,
  });
  const trainers = await tx.trainerAssignment.updateMany({
    where: { horseId, isActive: true },
    data: ended,
  });
  return {
    groomAssignmentsEnded: grooms.count,
    riderAssignmentsEnded: riders.count,
    trainerAssignmentsEnded: trainers.count,
  };
}

/**
 * The nightly birthday write. Sets the horse's age and, when this birthday is
 * its retirement and it is not in foal, releases its staff in the same
 * transaction.
 *
 * @param {object} tx - interactive transaction client
 * @param {{ horseId: number, age: number, retiring: boolean }} params
 * @returns {Promise<object|null>} the release counts, or null when nothing was released
 */
export async function writeBirthdayTx(tx, { horseId, age, retiring }) {
  const horse = await tx.horse.update({
    where: { id: horseId },
    data: { age },
    select: { inFoalSinceDate: true, rider: true },
  });
  if (!retiring || horse.inFoalSinceDate !== null) {
    return null;
  }
  return releaseHorseStaff(tx, { horseId, rider: horse.rider });
}

/**
 * Foaling door: once a mare's pregnancy has been claimed (her row is locked and
 * no longer in foal), release her staff if she is retired.
 *
 * @param {object} tx - interactive transaction client
 * @param {number} horseId
 * @returns {Promise<object|null>} the release counts, or null when she is not retired
 */
export async function releaseStaffIfRetiredTx(tx, horseId) {
  const horse = await tx.horse.findUnique({
    where: { id: horseId },
    select: { age: true, rider: true },
  });
  if (!horse || horse.age === null || horse.age < RETIREMENT_AGE_YEARS) {
    return null;
  }
  return releaseHorseStaff(tx, { horseId, rider: horse.rider });
}
