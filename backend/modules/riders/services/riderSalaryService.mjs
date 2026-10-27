/**
 * Rider weekly pay (owner ruling 2026-10-27, q111; Equoria-gafyt): "Riders, yes."
 *
 * Every Monday (Eastern) each hired rider's weekly rate (`Rider.weeklyRate`, the same
 * figure charged at hire) is taken from the employing player. A rider whose pay cannot
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
import {
  acquireRiderPayWeekLockTx,
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
    const weekKey = riderPayWeekKey(payWeekStart);
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
        userId: true,
        feeUnpaidSince: true,
        user: { select: { username: true } },
      },
      orderBy: { id: 'asc' },
    });
    const byUser = new Map();
    for (const rider of roster) {
      if (!byUser.has(rider.userId)) {
        byUser.set(rider.userId, []);
      }
      byUser.get(rider.userId).push(rider);
    }

    for (const [userId, riders] of byUser) {
      results.processed++;
      let unpaid = riders;
      try {
        const outcome = await prisma.$transaction(
          async tx => {
            await acquireRiderPayWeekLockTx(tx, userId, payWeekStart);
            const paidRows = await tx.riderSalaryPayment.findMany({
              where: { userId, weekKey, status: 'paid', riderId: { in: riders.map(r => r.id) } },
              select: { riderId: true },
            });
            const paidIds = new Set(paidRows.map(row => row.riderId));
            unpaid = riders.filter(r => !paidIds.has(r.id));
            if (unpaid.length === 0) {
              return { skipped: true, amount: 0 };
            }
            const total = unpaid.reduce((sum, r) => sum + r.weeklyRate, 0);
            // Earlier weeks these riders still owe. A missed row is dated with its own
            // pay week's Monday, so `lt: payWeekStart` can never pick up this week.
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
            // Owed weeks first (owner q142): this week plus the debt in ONE debit. If the
            // wallet cannot cover all of it nothing is taken (InsufficientFundsError), the
            // week is missed, and the rider cannot ride.
            const arrearsSettledNow = owedRows.length > 0;
            if (total + owedTotal > 0) {
              await debitMoneyOrThrow(tx, {
                userId,
                amount: total + owedTotal,
                systemAccount: burnAccount,
                category: 'riderSalaryBurn',
                description: `Rider weekly pay: user ${riders[0].user?.username ?? userId}`,
                metadata: {
                  riderCount: unpaid.length,
                  totalSalary: total,
                  arrears: owedTotal,
                  payWeekStart: payWeekStart.toISOString(),
                },
              });
            }
            if (arrearsSettledNow && owedRows.length > 0) {
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
            return { skipped: false, amount: total + (arrearsSettledNow ? owedTotal : 0) };
          },
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
          const consequence = await handleUnpaidRiders(userId, unpaid, payWeekStart);
          results.graced += consequence.graced;
          results.released += consequence.released;
          results.errors.push(`User ${userId} could not pay this week's rider pay`);
        } else {
          // Our fault, not the player's: nobody rides for free, nobody is released.
          const consequence = await handleUnpaidRiders(userId, unpaid, payWeekStart, {
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
