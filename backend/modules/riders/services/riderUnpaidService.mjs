/**
 * Rider unpaid-week consequences (owner ruling 2026-10-27, q111; Equoria-gafyt).
 *
 * The groom rule, applied to riders: a rider whose weekly pay is not taken cannot
 * ride that week, and after a full unpaid week the rider leaves. Per unpaid rider,
 * exactly one of three things happens:
 *
 *   already unpaid for a STRICTLY EARLIER pay week
 *     -> LEAVE. The rider leaves the player's stable for the riders-for-hire pool at
 *        its current level with its reveals intact (owner ruling 2026-10-28, q177;
 *        riderFreeAgentPool.mjs), active assignments end, and the player is told, all
 *        in one transaction.
 *   not yet marked unpaid
 *     -> GRACE. `feeUnpaidSince` is stamped with this pay week, the rider stays on
 *        the roster but cannot ride, and the player is told.
 *   marked unpaid for THIS pay week already
 *     -> nothing new: no second notice.
 *
 * `allowLeave: false` is for a pass that FAILED for a reason that is not the player's
 * (a thrown transaction): the rider is put in grace so nobody rides for free, but
 * never released, because losing a rider is the penalty for not paying.
 *
 * Every transaction takes the per-(user, pay week) advisory lock first, then locks
 * horses before staff rows in ascending id order (project lock order).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import { acquireRiderPayWeekLockTx, getRiderPayWeekEnd, riderPayWeekKey } from './riderPayWeek.mjs';
import { returnRiderToPoolTx } from './riderFreeAgentPool.mjs';

/** The player is told this rider cannot ride until the week's pay is taken. */
export const riderFeeUnpaidNotificationType = 'riderFeeUnpaid';
/** The player is told the rider has left after a full unpaid week. */
export const riderReleasedNotificationType = 'riderReleased';

/** A missed week still owed: collected with the next payday (owner q131). */
export const riderArrearsOwedStatus = 'missed';
/** A missed week collected with a later payday. */
export const riderArrearsSettledStatus = 'arrearsSettled';
/** A missed week forgiven because the rider left; the debt does not outlive the rider. */
export const riderArrearsWrittenOffStatus = 'arrearsWrittenOff';

/** Has a FULL pay week gone unpaid? True only for a STRICTLY EARLIER unpaid pay week. */
export function hasFullUnpaidRiderWeek(feeUnpaidSince, payWeekStart) {
  if (!feeUnpaidSince) {
    return false;
  }
  return new Date(feeUnpaidSince).getTime() < payWeekStart.getTime();
}

/**
 * Equoria-hc96y: was this rider paid for `payWeekStart`? Read under the pay-week lock, so
 * a player who pressed Pay Rider while the week-end pass was choosing whom to mark unpaid
 * is never marked unpaid for the week they paid. Old Monday-keyed rows count by date.
 */
async function paidForWeekTx(tx, riderId, userId, payWeekStart) {
  const row = await tx.riderSalaryPayment.findFirst({
    where: {
      riderId,
      userId,
      status: 'paid',
      OR: [
        { weekKey: riderPayWeekKey(payWeekStart) },
        { paymentDate: { gte: payWeekStart, lt: getRiderPayWeekEnd(payWeekStart) } },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}

const riderName = rider => `${rider.firstName} ${rider.lastName}`.trim();

async function leaveTx(tx, { rider, userId, payWeekStart }) {
  const active = await tx.riderAssignment.findMany({
    where: { riderId: rider.id, isActive: true },
    select: { horse: { select: { id: true, name: true } } },
  });
  const horses = active
    .map(a => a.horse)
    .filter(Boolean)
    .sort((a, b) => a.id - b.id);
  const horseIds = horses.map(h => h.id);
  if (horseIds.length > 0) {
    await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ANY(${horseIds}) ORDER BY "id" FOR UPDATE`;
  }
  const left = await returnRiderToPoolTx(tx, { riderId: rider.id, userId });
  if (left !== 1) {
    throw new Error(`Rider ${rider.id} was no longer on user ${userId}'s roster when they left`);
  }
  await tx.riderAssignment.updateMany({
    where: { riderId: rider.id, isActive: true },
    data: { isActive: false },
  });
  await tx.riderSalaryPayment.create({
    data: {
      riderId: rider.id,
      userId,
      amount: rider.weeklyRate,
      weekKey: riderPayWeekKey(payWeekStart),
      paymentDate: payWeekStart,
      status: 'releasedNonPayment',
    },
  });
  await tx.riderSalaryPayment.updateMany({
    where: { riderId: rider.id, userId, status: riderArrearsOwedStatus },
    data: { status: riderArrearsWrittenOffStatus },
  });
  const payload = {
    riderId: rider.id,
    riderName: riderName(rider),
    weeklyRate: rider.weeklyRate,
    horses: horses.map(h => ({ id: h.id, name: h.name })),
  };
  await createNotificationTx(tx, userId, riderReleasedNotificationType, payload);
  return payload;
}

async function graceTx(tx, { rider, userId, payWeekStart, allowLeave }) {
  const marked = await tx.rider.updateMany({
    where: { id: rider.id, userId, retired: false, feeUnpaidSince: null },
    data: { feeUnpaidSince: payWeekStart },
  });
  if (marked.count !== 1) {
    // A failed pass (not the player's fault) never releases, so a rider already in
    // grace from an EARLIER week is not released and this week must still be owed.
    // No second notice; one missed row per rider per pay week.
    if (!allowLeave && hasFullUnpaidRiderWeek(rider.feeUnpaidSince, payWeekStart)) {
      const weekKey = riderPayWeekKey(payWeekStart);
      const already = await tx.riderSalaryPayment.findFirst({
        where: { riderId: rider.id, userId, weekKey, status: riderArrearsOwedStatus },
        select: { id: true },
      });
      if (!already) {
        await tx.riderSalaryPayment.create({
          data: {
            riderId: rider.id,
            userId,
            amount: rider.weeklyRate,
            weekKey,
            paymentDate: payWeekStart,
            status: riderArrearsOwedStatus,
          },
        });
      }
    }
    return null;
  }
  await tx.riderSalaryPayment.create({
    data: {
      riderId: rider.id,
      userId,
      amount: rider.weeklyRate,
      weekKey: riderPayWeekKey(payWeekStart),
      paymentDate: payWeekStart,
      status: riderArrearsOwedStatus,
    },
  });
  const payload = {
    riderId: rider.id,
    riderName: riderName(rider),
    weeklyRate: rider.weeklyRate,
    payWeekStart: payWeekStart.toISOString(),
    canRide: false,
    graceWeeks: 1,
  };
  await createNotificationTx(tx, userId, riderFeeUnpaidNotificationType, payload);
  return payload;
}

/**
 * Apply the non-payment consequence to each unpaid rider, one transaction per rider
 * so one failure cannot stop the rest. Never throws.
 *
 * @param {string} userId
 * @param {Array<{id:number,firstName:string,lastName:string,weeklyRate:number,feeUnpaidSince:Date|null}>} unpaid
 * @param {Date} payWeekStart
 * @param {{allowLeave?: boolean, onFailure?: (rider: Object, error: Error) => Promise<void>}} [options]
 *   `onFailure` records a rider whose consequence could not be applied, for the
 *   owner's payroll diagnostics (Equoria-brh8c). It must not throw.
 * @returns {Promise<{graced: number, released: number}>}
 */
export async function handleUnpaidRiders(
  userId,
  unpaid,
  payWeekStart,
  { allowLeave = true, onFailure } = {},
) {
  const outcome = { graced: 0, released: 0 };
  const ordered = [...unpaid].sort((a, b) => a.id - b.id);
  for (const rider of ordered) {
    try {
      if (allowLeave && hasFullUnpaidRiderWeek(rider.feeUnpaidSince, payWeekStart)) {
        const payload = await prisma.$transaction(async tx => {
          await acquireRiderPayWeekLockTx(tx, userId, payWeekStart);
          if (await paidForWeekTx(tx, rider.id, userId, payWeekStart)) {
            return null;
          }
          return leaveTx(tx, { rider, userId, payWeekStart });
        });
        if (!payload) {
          continue;
        }
        finalizeNotificationAfterCommit(userId, riderReleasedNotificationType, payload);
        outcome.released++;
        logger.warn(
          `[riderUnpaidService] Rider ${rider.id} left user ${userId}: a full pay week unpaid`,
        );
        continue;
      }
      const payload = await prisma.$transaction(async tx => {
        await acquireRiderPayWeekLockTx(tx, userId, payWeekStart);
        if (await paidForWeekTx(tx, rider.id, userId, payWeekStart)) {
          return null;
        }
        return graceTx(tx, { rider, userId, payWeekStart, allowLeave });
      });
      if (payload) {
        finalizeNotificationAfterCommit(userId, riderFeeUnpaidNotificationType, payload);
        outcome.graced++;
      }
    } catch (error) {
      logger.error(
        `[riderUnpaidService] Could not apply the non-payment consequence to rider ${rider.id} ` +
          `for user ${userId}: ${error.message}`,
      );
      if (onFailure) {
        await onFailure(rider, error);
      }
    }
  }
  return outcome;
}

/**
 * The owner's re-run of a failed week-end settlement for ONE rider (Equoria-brh8c),
 * inside the caller's transaction (a test run rolls it back; a re-run commits it).
 *
 * Idempotent per rider and pay week: under the same pay-week lock as every rider
 * payroll write, a week already paid, or already settled (any recorded non-payment
 * row for that week), is left alone. Otherwise the rider gets exactly the
 * consequence the weekly settlement would have applied. Takes no money.
 *
 * @param {Object} tx
 * @param {{rider: Object, userId: string, payWeekStart: Date}} params - `rider` read
 *   fresh by the caller, with `weeklyRate` set to the star price
 * @returns {Promise<{outcome: 'alreadyPaid'|'alreadySettled'|'leftRoster'|'cannotRide',
 *   afterCommit: (() => void)|null}>}
 */
export async function resettleRiderWeekTx(tx, { rider, userId, payWeekStart }) {
  await acquireRiderPayWeekLockTx(tx, userId, payWeekStart);
  if (await paidForWeekTx(tx, rider.id, userId, payWeekStart)) {
    return { outcome: 'alreadyPaid', afterCommit: null };
  }
  const recorded = await tx.riderSalaryPayment.findFirst({
    where: {
      riderId: rider.id,
      userId,
      status: { not: 'paid' },
      OR: [{ weekKey: riderPayWeekKey(payWeekStart) }, { paymentDate: payWeekStart }],
    },
    select: { id: true },
  });
  if (recorded) {
    return { outcome: 'alreadySettled', afterCommit: null };
  }
  if (hasFullUnpaidRiderWeek(rider.feeUnpaidSince, payWeekStart)) {
    const payload = await leaveTx(tx, { rider, userId, payWeekStart });
    return {
      outcome: 'leftRoster',
      afterCommit: () =>
        finalizeNotificationAfterCommit(userId, riderReleasedNotificationType, payload),
    };
  }
  const payload = await graceTx(tx, { rider, userId, payWeekStart, allowLeave: true });
  return {
    outcome: payload ? 'cannotRide' : 'alreadySettled',
    afterCommit: payload
      ? () => finalizeNotificationAfterCommit(userId, riderFeeUnpaidNotificationType, payload)
      : null,
  };
}
