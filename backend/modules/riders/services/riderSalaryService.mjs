/**
 * Rider weekly pay (owner ruling 2026-10-27, q111; Equoria-gafyt): "Riders, yes."
 *
 * Owner rulings 2026-10-28 and 2026-10-29 (q268, Equoria-hc96y): payday is a player
 * action. The player presses Pay Rider (riderPlayerPayService) any time during the week,
 * which takes the rider's star price through `collectRiderPayTx` below; nothing charges
 * riders automatically (old contract: every Monday a weekly pass took every rider's pay;
 * that pass was removed, Equoria-kw60x). A rider whose week went unpaid cannot ride
 * (utils/competitionEntryRules riderRefusal), and leaves after a full unpaid week
 * (riderUnpaidService, applied by the week-end settlement). Trainers are NOT paid here: a
 * player pays a trainer per horse each time they press Train Horse.
 *
 * A per-(user, pay week) advisory lock, per-rider paid rows (one 'paid' row per rider and
 * week is also enforced by a partial unique index), and idempotency by pay week. A rider
 * hired this pay week already has a paid row for it (the hire charge).
 *
 * Arrears (owner q131, 2026-10-27): a missed week is OWED, as for grooms. The next time
 * the rider is paid, the 'missed' rows for earlier pay weeks are collected in the same
 * single debit and marked 'arrearsSettled'. Owed weeks first (q142, which differs from
 * grooms): the rider cannot ride until this week AND every owed week are paid. If the
 * wallet cannot cover the full amount nothing is taken. A rider who leaves has their owed
 * weeks written off (riderUnpaidService). All or nothing still applies to the week itself
 * (q132).
 */

import { debitMoneyOrThrow } from '../../economy/index.mjs';
import { acquireRiderPayWeekLockTx, getRiderPayWeekEnd, riderPayWeekKey } from './riderPayWeek.mjs';
import { riderArrearsOwedStatus, riderArrearsSettledStatus } from './riderUnpaidService.mjs';

// The economy module's burn sink, whose constant name is snake-case (ratchet): its value.
const burnAccount = 'burn';

/**
 * Take this week's pay for some of one player's riders, inside the caller's transaction.
 *
 * Used by the player's Pay Rider button (owner ruling 2026-10-28; q268,
 * Equoria-hc96y), so money moves by one definition: the per-(user, pay
 * week) advisory lock first, the paid-this-week read, this week plus every owed week in
 * ONE debit (q142), the paid rows, and the unpaid marker cleared.
 *
 * A rider counts as paid for the week when it has a 'paid' row with this week's key OR
 * dated inside the week: rows written before the pay week moved from Monday to Sunday
 * carry the old Monday key, and must not let the same week be charged twice.
 *
 * Throws `InsufficientFundsError` when the wallet cannot cover the whole amount; nothing
 * is taken.
 *
 * @param {Object} tx
 * @param {{userId: string, username: string, riders: Array, payWeekStart: Date,
 *   now: Date}} params - each rider carries its star-level `weeklyRate`
 * @returns {Promise<{skipped: boolean, amount: number}>}
 */
export async function collectRiderPayTx(tx, params) {
  const { userId, username, riders, payWeekStart, now } = params;
  const weekKey = riderPayWeekKey(payWeekStart);
  const payWeekEnd = getRiderPayWeekEnd(payWeekStart);
  await acquireRiderPayWeekLockTx(tx, userId, payWeekStart);
  const paidRows = await tx.riderSalaryPayment.findMany({
    where: {
      userId,
      status: 'paid',
      riderId: { in: riders.map(r => r.id) },
      OR: [{ weekKey }, { paymentDate: { gte: payWeekStart, lt: payWeekEnd } }],
    },
    select: { riderId: true },
  });
  const paidIds = new Set(paidRows.map(row => row.riderId));
  const unpaid = riders.filter(r => !paidIds.has(r.id));
  if (unpaid.length === 0) {
    return { skipped: true, amount: 0 };
  }
  const total = unpaid.reduce((sum, r) => sum + r.weeklyRate, 0);
  // Earlier weeks these riders still owe. A missed row is dated with its own pay week's
  // start, so `lt: payWeekStart` can never pick up this week.
  const owedRows = await tx.riderSalaryPayment.findMany({
    where: {
      userId,
      status: riderArrearsOwedStatus,
      riderId: { in: unpaid.map(r => r.id) },
      paymentDate: { lt: payWeekStart },
    },
    select: { id: true, amount: true },
  });
  const owedTotal = owedRows.reduce((sum, row) => sum + row.amount, 0);
  // Owed weeks first (owner q142): this week plus the debt in ONE debit. If the wallet
  // cannot cover all of it nothing is taken (InsufficientFundsError).
  if (total + owedTotal > 0) {
    await debitMoneyOrThrow(tx, {
      userId,
      amount: total + owedTotal,
      systemAccount: burnAccount,
      category: 'riderSalaryBurn',
      description: `Rider weekly pay: user ${username}`,
      metadata: {
        riderCount: unpaid.length,
        totalSalary: total,
        arrears: owedTotal,
        payWeekStart: payWeekStart.toISOString(),
      },
    });
  }
  if (owedRows.length > 0) {
    await tx.riderSalaryPayment.updateMany({
      where: { id: { in: owedRows.map(row => row.id) } },
      data: { status: riderArrearsSettledStatus },
    });
  }
  await tx.riderSalaryPayment.createMany({
    data: unpaid.map(r => ({
      riderId: r.id,
      userId,
      amount: r.weeklyRate,
      weekKey,
      paymentDate: now,
      status: 'paid',
    })),
  });
  await tx.rider.updateMany({
    where: { id: { in: unpaid.map(r => r.id) }, feeUnpaidSince: { not: null } },
    data: { feeUnpaidSince: null },
  });
  return { skipped: false, amount: total + owedTotal };
}
