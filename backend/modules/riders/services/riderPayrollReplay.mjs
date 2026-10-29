/**
 * The owner's payroll re-run for ONE rider (Equoria-brh8c, owner ruling q158).
 *
 * Riders have one game-run payroll pass, the weekly settlement just after Sunday
 * midnight Eastern (it takes no money). This replays it for the week that failed,
 * inside the caller's transaction: the staff module's Test run rolls it back, its
 * Re-run commits it. Idempotent per rider and pay week (riderUnpaidService.
 * resettleRiderWeekTx, under the rider pay-week lock).
 */

import { hiredStaffFee } from '../../../constants/staffLevels.mjs';
import { resettleRiderWeekTx } from './riderUnpaidService.mjs';

const nothing = outcome => ({ outcome, amount: 0, afterCommit: null });

/**
 * @param {Object} tx
 * @param {{ staffId: number, userId: string, source: 'weeklySettlement', weekStart: Date }} params
 * @returns {Promise<{ outcome: string, amount: number, afterCommit: (() => void)|null }>}
 */
export async function replayRiderPayrollTx(tx, { staffId, userId, source, weekStart }) {
  if (source !== 'weeklySettlement') {
    return nothing('nothingToReplay');
  }
  const rider = await tx.rider.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      weeklyRate: true,
      starLevel: true,
      userId: true,
      feeUnpaidSince: true,
      retired: true,
    },
  });
  if (!rider || rider.userId !== userId || rider.retired) {
    return nothing('noLongerOnStaff');
  }
  // Throws while the rider's price still cannot be read: the test run fails.
  const weeklyRate = hiredStaffFee(rider);
  const settled = await resettleRiderWeekTx(tx, {
    rider: { ...rider, weeklyRate },
    userId,
    payWeekStart: new Date(weekStart),
  });
  return { ...settled, amount: 0 };
}
