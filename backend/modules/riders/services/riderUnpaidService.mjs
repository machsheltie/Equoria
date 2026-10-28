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
import { acquireRiderPayWeekLockTx, riderPayWeekKey } from './riderPayWeek.mjs';
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
 * @param {{allowLeave?: boolean}} [options]
 * @returns {Promise<{graced: number, released: number}>}
 */
export async function handleUnpaidRiders(userId, unpaid, payWeekStart, { allowLeave = true } = {}) {
  const outcome = { graced: 0, released: 0 };
  const ordered = [...unpaid].sort((a, b) => a.id - b.id);
  for (const rider of ordered) {
    try {
      if (allowLeave && hasFullUnpaidRiderWeek(rider.feeUnpaidSince, payWeekStart)) {
        const payload = await prisma.$transaction(async tx => {
          await acquireRiderPayWeekLockTx(tx, userId, payWeekStart);
          return leaveTx(tx, { rider, userId, payWeekStart });
        });
        finalizeNotificationAfterCommit(userId, riderReleasedNotificationType, payload);
        outcome.released++;
        logger.warn(
          `[riderUnpaidService] Rider ${rider.id} left user ${userId}: a full pay week unpaid`,
        );
        continue;
      }
      const payload = await prisma.$transaction(async tx => {
        await acquireRiderPayWeekLockTx(tx, userId, payWeekStart);
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
    }
  }
  return outcome;
}
