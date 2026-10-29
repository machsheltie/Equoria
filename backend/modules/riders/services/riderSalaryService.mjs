/**
 * Rider weekly pay (owner ruling 2026-10-27, q111; Equoria-gafyt): "Riders, yes."
 *
 * Owner rulings 2026-10-28 and 2026-10-29 (q268, Equoria-hc96y): payday is a player
 * action. The player presses Pay Rider (riderPlayerPayService) any time during the week,
 * which takes the rider's star price through `collectRiderPayTx` below; nothing is
 * scheduled to charge riders any more (old contract: every Monday the weekly pass below
 * took every rider's pay). `processWeeklyRiderSalaries` remains the same collection run
 * over a whole roster at once, and is no longer scheduled. A rider whose pay cannot
 * be taken cannot ride that week (utils/competitionEntryRules riderRefusal), and leaves
 * after a full unpaid week (riderUnpaidService). Trainers are NOT paid here: a player
 * pays a trainer per horse each time they press Train Horse.
 *
 * Mirrors the groom pass (groomSalaryService): one debit per player for the whole
 * roster, a per-(user, pay week) advisory lock, per-rider paid rows (one 'paid' row per
 * rider and week is also enforced by a partial unique index), and idempotency by pay
 * week. A rider hired this pay week already has a paid row for it (the hire charge), so
 * the pass leaves them alone until next Monday. Retired riders are not charged.
 *
 * Arrears (owner q131, 2026-10-27): a missed week is OWED, as for grooms. The next time
 * the rider is paid, the 'missed' rows for earlier pay weeks are collected in the same
 * single debit and marked 'arrearsSettled'. Owed weeks first (q142, which differs from
 * grooms): the rider cannot ride until this week AND every owed week are paid. If the
 * wallet cannot cover the full amount nothing is taken, this week is also missed, and
 * the rider stays unable to ride. A rider who leaves has their owed weeks written off
 * (riderUnpaidService). All or nothing still applies to the week itself (q132).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { debitMoneyOrThrow, InsufficientFundsError } from '../../economy/index.mjs';
import { hiredStaffFee } from '../../../constants/staffLevels.mjs';
import {
  acquireRiderPayWeekLockTx,
  getRiderPayWeekEnd,
  getRiderPayWeekStart,
  riderPayWeekKey,
} from './riderPayWeek.mjs';
import {
  riderArrearsOwedStatus,
  riderArrearsSettledStatus,
  handleUnpaidRiders,
} from './riderUnpaidService.mjs';

// The economy module's burn sink, whose constant name is snake-case (ratchet): its value.
const burnAccount = 'burn';

/**
 * Take this week's pay for some of one player's riders, inside the caller's transaction.
 *
 * Shared by the weekly pass below and the player's Pay Rider button (owner ruling
 * 2026-10-28; q268, Equoria-hc96y), so money moves by one definition: the per-(user, pay
 * week) advisory lock first, the paid-this-week read, this week plus every owed week in
 * ONE debit (q142), the paid rows, and the unpaid marker cleared.
 *
 * A rider counts as paid for the week when it has a 'paid' row with this week's key OR
 * dated inside the week: rows written before the pay week moved from Monday to Sunday
 * carry the old Monday key, and must not let the same week be charged twice.
 *
 * Throws `InsufficientFundsError` when the wallet cannot cover the whole amount; nothing
 * is taken. `state.unpaid` is set to the riders still unpaid for the week.
 *
 * @param {Object} tx
 * @param {{userId: string, username: string, riders: Array, payWeekStart: Date, now: Date,
 *   state?: {unpaid?: Array}}} params - each rider carries its star-level `weeklyRate`
 * @returns {Promise<{skipped: boolean, amount: number}>}
 */
export async function collectRiderPayTx(tx, params) {
  const { userId, username, riders, payWeekStart, now, state = {} } = params;
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
  state.unpaid = unpaid;
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

/**
 * Take this week's pay for every hired rider.
 *
 * @param {Date} [now] - injection point for the pay-week clock (tests)
 * @param {{userId?: string|null}} [options] - scope the pass to ONE player. Tests must
 *   scope to their own fixture user: an unscoped pass puts every underfunded player's
 *   riders into grace and releases the ones already in it.
 */
export async function processWeeklyRiderSalaries(
  now = new Date(),
  { userId: scopeUserId = null } = {},
) {
  const results = {
    processed: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    graced: 0,
    released: 0,
    totalAmount: 0,
    errors: [],
  };
  try {
    const payWeekStart = getRiderPayWeekStart(now);
    const where = { userId: { not: null }, retired: false };
    if (scopeUserId) {
      where.userId = scopeUserId;
    }
    const roster = await prisma.rider.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        weeklyRate: true,
        starLevel: true,
        userId: true,
        feeUnpaidSince: true,
        user: { select: { username: true } },
      },
      orderBy: { id: 'asc' },
    });
    const byUser = new Map();
    for (const row of roster) {
      // Equoria-nawn5, owner ruling q226: the week's pay is the rider's star level's price.
      const rider = { ...row, weeklyRate: hiredStaffFee(row) };
      if (!byUser.has(rider.userId)) {
        byUser.set(rider.userId, []);
      }
      byUser.get(rider.userId).push(rider);
    }

    for (const [userId, riders] of byUser) {
      results.processed++;
      const collected = { unpaid: riders };
      try {
        const outcome = await prisma.$transaction(
          tx =>
            collectRiderPayTx(tx, {
              userId,
              username: riders[0].user?.username ?? userId,
              riders,
              payWeekStart,
              now,
              state: collected,
            }),
          { timeout: 30000 },
        );
        if (outcome.skipped) {
          results.skipped++;
        } else {
          results.successful++;
          results.totalAmount += outcome.amount;
        }
      } catch (error) {
        if (error?.code === 'P2002') {
          results.skipped++;
          continue;
        }
        results.failed++;
        if (error instanceof InsufficientFundsError) {
          // The wallet could not cover the whole roster, so none of it was paid.
          const consequence = await handleUnpaidRiders(userId, collected.unpaid, payWeekStart);
          results.graced += consequence.graced;
          results.released += consequence.released;
          results.errors.push(`User ${userId} could not pay this week's rider pay`);
        } else {
          // Our fault, not the player's: nobody rides for free, nobody is released.
          const consequence = await handleUnpaidRiders(userId, collected.unpaid, payWeekStart, {
            allowLeave: false,
          });
          results.graced += consequence.graced;
          results.errors.push(`User ${userId}: rider pay uncollected, ${error.message}`);
          logger.error(
            `[riderSalaryService] Rider pay for user ${userId} failed: ${error.message}`,
          );
        }
      }
    }
  } catch (error) {
    logger.error(`[riderSalaryService] Weekly rider pay failed: ${error.message}`);
    results.errors.push(error.message);
  }
  return results;
}
