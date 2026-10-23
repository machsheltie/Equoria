/**
 * Rider retirement (owner ruling 2026-10-23, Equoria-or2ua).
 *
 * Riders retire when their age reaches a hidden, randomly rolled retirement age
 * (see riderRetirementScheduleService.mjs). Players who use the rider are
 * notified ONE WEEK before. This replaces the old career-weeks threshold
 * (80 weeks on the server, 104 on the client; Equoria-oey96.26).
 *
 * THE WEEKLY PASS (Mondays 09:30 Eastern, after the 00:15 tick that ages every
 * active rider by one game-year) does two things, in this order:
 *
 *   1. RETIRE every rider whose age has reached the retirement age AND whose
 *      notice was sent in an EARLIER pass. A rider who is already past the age
 *      when first seen (a backfilled veteran) is therefore noticed this pass and
 *      retired the next, so nobody ever retires without a week's warning.
 *   2. NOTIFY every rider who will reach the retirement age at the next tick
 *      (age + 1 >= retirementAge) and has no notice yet. The notice row is
 *      claimed with a guarded `updateMany` on `noticeSentAt: null`, so a repeat
 *      or concurrent pass never sends a second notice.
 *
 * Doing (1) before (2) is what makes the notice come a full week ahead for an
 * ordinary rider: notified at age R-1, aged to R at the next tick, retired in
 * the next pass.
 *
 * The notification names the rider and the horses that use them. It carries no
 * age, no retirement age and no countdown. Riders with no schedule row (not yet
 * backfilled) are left alone: the pass never draws an age itself.
 *
 * Retiring ends BOTH representations of an assignment (the RiderAssignment rows
 * and the denormalised Horse.rider JSON the competition engine reads;
 * Equoria-r9u5k), in one transaction, Horse rows before staff rows (ascending
 * ids).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import { riderAgeYears } from './riderRetirementScheduleService.mjs';

/** The notification type players receive a week before a rider retires. */
export const RIDER_RETIRING_NOTIFICATION_TYPE = 'riderRetiring';

/**
 * Riders with a schedule, with the hidden age read for this pass only. The age
 * stays inside this module: callers get ids and flags, never the number.
 */
async function loadScheduledRiders() {
  const rows = await prisma.rider.findMany({
    where: { retired: false, riderRetirementSchedule: { isNot: null } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userId: true,
      startAge: true,
      careerWeeks: true,
      riderRetirementSchedule: { select: { retirementAge: true, noticeSentAt: true } },
    },
  });
  return rows.filter(r => riderAgeYears(r) !== null);
}

/**
 * Retire riders who have reached their retirement age and were noticed in an
 * earlier pass. Deactivates their active assignments and clears Horse.rider.
 *
 * @returns {Promise<{retiredCount: number, deactivatedAssignmentCount: number, retiredIds: number[]}>}
 */
export async function retireRidersAtTheirAge() {
  const scheduled = await loadScheduledRiders();
  const ids = scheduled
    .filter(
      r =>
        r.riderRetirementSchedule.noticeSentAt !== null &&
        riderAgeYears(r) >= r.riderRetirementSchedule.retirementAge,
    )
    .map(r => r.id)
    .sort((a, b) => a - b);

  if (ids.length === 0) {
    return { retiredCount: 0, deactivatedAssignmentCount: 0, retiredIds: [] };
  }

  const { retired, deactivated } = await prisma.$transaction(async tx => {
    const active = await tx.riderAssignment.findMany({
      where: { riderId: { in: ids }, isActive: true },
      select: { horseId: true },
    });
    const horseIds = [...new Set(active.map(a => a.horseId))].sort((a, b) => a - b);
    if (horseIds.length > 0) {
      await tx.horse.updateMany({ where: { id: { in: horseIds } }, data: { rider: null } });
    }
    const ended = await tx.riderAssignment.updateMany({
      where: { riderId: { in: ids }, isActive: true },
      data: { isActive: false },
    });
    const flipped = await tx.rider.updateMany({
      where: { id: { in: ids }, retired: false },
      data: { retired: true },
    });
    return { retired: flipped, deactivated: ended };
  });

  logger.info(
    `[riderRetirementService] Retired ${retired.count} riders (ids: ${ids.join(', ')}); ` +
      `deactivated ${deactivated.count} active assignments.`,
  );
  return {
    retiredCount: retired.count,
    deactivatedAssignmentCount: deactivated.count,
    retiredIds: ids,
  };
}

/**
 * Send the one-week notice for every rider who retires at the next tick.
 *
 * @returns {Promise<{noticedCount: number, noticedIds: number[]}>}
 */
export async function noticeRidersRetiringNextWeek() {
  const scheduled = await loadScheduledRiders();
  const due = scheduled.filter(
    r =>
      r.riderRetirementSchedule.noticeSentAt === null &&
      riderAgeYears(r) + 1 >= r.riderRetirementSchedule.retirementAge,
  );

  const noticedIds = [];
  for (const rider of due) {
    const committed = await prisma.$transaction(async tx => {
      // Guarded claim: only one pass ever sends this rider's notice.
      const claimed = await tx.riderRetirementSchedule.updateMany({
        where: { riderId: rider.id, noticeSentAt: null },
        data: { noticeSentAt: new Date() },
      });
      if (claimed.count !== 1) {
        return null;
      }
      const assignments = await tx.riderAssignment.findMany({
        where: { riderId: rider.id, isActive: true },
        select: { userId: true, horse: { select: { id: true, name: true, userId: true } } },
      });
      const recipients = new Set();
      if (rider.userId) {
        recipients.add(rider.userId);
      }
      for (const a of assignments) {
        const owner = a.userId ?? a.horse?.userId;
        if (owner) {
          recipients.add(owner);
        }
      }
      if (recipients.size === 0) {
        logger.error(
          `[riderRetirementService] Rider ${rider.id} retires next week but no player could be notified.`,
        );
      }
      const riderName = `${rider.firstName} ${rider.lastName}`.trim();
      const sent = [];
      for (const recipientId of [...recipients].sort()) {
        const horses = assignments
          .filter(a => (a.userId ?? a.horse?.userId) === recipientId && a.horse)
          .map(a => ({ id: a.horse.id, name: a.horse.name }));
        const payload = { riderId: rider.id, riderName, horses };
        await createNotificationTx(tx, recipientId, RIDER_RETIRING_NOTIFICATION_TYPE, payload);
        sent.push({ recipientId, payload });
      }
      return sent;
    });

    if (committed) {
      noticedIds.push(rider.id);
      for (const { recipientId, payload } of committed) {
        finalizeNotificationAfterCommit(recipientId, RIDER_RETIRING_NOTIFICATION_TYPE, payload);
      }
    }
  }

  if (noticedIds.length > 0) {
    logger.info(
      `[riderRetirementService] Sent one-week retirement notices for riders ${noticedIds.join(', ')}.`,
    );
  }
  return { noticedCount: noticedIds.length, noticedIds };
}

/**
 * The weekly rider pass: retire first, then send the one-week notices.
 * @returns {Promise<{retiredCount: number, deactivatedAssignmentCount: number, retiredIds: number[], noticedCount: number, noticedIds: number[]}>}
 */
export async function processRiderRetirement() {
  const retirement = await retireRidersAtTheirAge();
  const notices = await noticeRidersRetiringNextWeek();
  return { ...retirement, ...notices };
}
