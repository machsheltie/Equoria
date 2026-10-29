/**
 * The owner's payroll re-run for ONE groom (Equoria-brh8c, owner ruling q158).
 *
 * Replays the pass that failed for this groom, inside the caller's transaction:
 * the staff module's Test run rolls it back, its Re-run commits it. Both payroll
 * passes are idempotent per groom and pay week through the existing guards (the
 * per-(user, pay week) advisory lock, the paid-week read and its partial unique
 * index), so a second re-run changes nothing.
 *
 *   - weeklySettlement: the week-end consequence for the week that failed
 *     (groomFeeArrearsService.resettleGroomWeekTx). Takes no money.
 *   - manualPayroll: the owner's payday for this groom (q262), through the same
 *     collection as Pay Groom (groomFeeCollection.collectGroomFeesTx), all money in
 *     this one transaction. Only inside the pay week that failed: once it has ended
 *     the week-end settlement has dealt with the week, and collecting it here could
 *     take it twice.
 */

import { gameDateKey, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { InsufficientFundsError } from '../../economy/index.mjs';
import { collectGroomFeesTx } from './groomFeeCollection.mjs';
import { resettleGroomWeekTx } from './groomFeeArrearsService.mjs';
import {
  arrearsOwedStatuses,
  arrearsSettledStatus,
  calculateWeeklyFee,
} from './groomFeeBasisService.mjs';
import { getPayWeekStart } from './groomSalaryService.mjs';

const nothing = outcome => ({ outcome, amount: 0, afterCommit: null });

/**
 * @param {Object} tx
 * @param {{ staffId: number, userId: string, source: 'weeklySettlement'|'manualPayroll',
 *   weekStart: Date, now?: Date }} params - `userId` is the player the failed pass was for
 * @returns {Promise<{ outcome: string, amount: number, afterCommit: (() => void)|null }>}
 */
export async function replayGroomPayrollTx(
  tx,
  { staffId, userId, source, weekStart, now = new Date() },
) {
  const groom = await tx.groom.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      name: true,
      userId: true,
      skillLevel: true,
      starLevel: true,
      speciality: true,
      feeUnpaidSince: true,
      retired: true,
      isActive: true,
      user: { select: { username: true } },
    },
  });
  if (!groom || groom.userId !== userId || groom.retired || !groom.isActive) {
    return nothing('noLongerOnStaff');
  }
  // Throws while the groom's price still cannot be read: the test run fails.
  const salary = calculateWeeklyFee(groom);
  const payWeekStart = new Date(weekStart);

  if (source === 'weeklySettlement') {
    // A groom hired during that week was paid for it by the hire fee.
    const hired = await tx.groomEngagement.findFirst({
      where: { userId, groomId: groom.id, endedAt: null, startedAt: { gte: payWeekStart } },
      select: { id: true },
    });
    if (hired) {
      return nothing('hiredThatWeek');
    }
    const settled = await resettleGroomWeekTx(tx, { groom, salary, userId, payWeekStart });
    return { ...settled, amount: 0 };
  }

  if (getPayWeekStart(now).getTime() !== payWeekStart.getTime()) {
    return nothing('weekEnded');
  }
  const payWeekEnd = startOfGameDayIndex(gameDayIndex(payWeekStart) + 7);
  let collected;
  try {
    collected = await collectGroomFeesTx(tx, {
      userId,
      username: groom.user?.username ?? userId,
      entries: [{ groom, salary }],
      payWeekStart,
      payWeekEnd,
      weekKey: gameDateKey(payWeekStart),
      now,
      description: `Groom weekly pay — ${groom.name}`,
    });
  } catch (error) {
    // Thrown before anything is written (a JS decision, not a database error), so
    // the transaction is still good; the week-end settlement handles an unpaid week.
    if (error instanceof InsufficientFundsError) {
      return nothing('notEnoughCoins');
    }
    throw error;
  }
  if (collected.skipped) {
    return nothing('alreadyPaid');
  }
  // The failed payday may have recorded this week as uncollected (owed). It is paid
  // now, in this same transaction, so it must never be collected again as a debt.
  await tx.groomSalaryPayment.updateMany({
    where: {
      groomId: groom.id,
      userId,
      paymentType: 'weeklySalary',
      status: { in: [...arrearsOwedStatuses] },
      paymentDate: { gte: payWeekStart, lt: payWeekEnd },
    },
    data: { status: arrearsSettledStatus },
  });
  return { outcome: 'paid', amount: collected.amount, afterCommit: null };
}
