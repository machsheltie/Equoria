/**
 * Pay Rider — payday is a player action (Equoria-hc96y).
 *
 * Owner rulings 2026-10-28 (q262/q265 notes): "payday is handled by players. They click
 * 'pay groom, pay rider'." Owner ruling 2026-10-29 (q268): pay any time during the
 * week; the week ends Sunday midnight Eastern, then the unpaid rules apply.
 *
 * Still true (q131/q142): a missed rider week is OWED, and the rider cannot ride until
 * this week and every owed week are paid — so one press of Pay Rider takes this week's
 * star price plus every owed week, all or nothing. A rider unpaid for a full week leaves
 * (riderUnpaidService). The hire charge is the hire week's pay (q111), so a rider hired
 * this week is already paid for it.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { InsufficientFundsError } from '../../economy/index.mjs';
import { hiredStaffFee } from '../../../constants/staffLevels.mjs';
import { getRiderPayWeekEnd, getRiderPayWeekStart, riderPayWeekKey } from './riderPayWeek.mjs';
import { collectRiderPayTx } from './riderSalaryService.mjs';
import { handleUnpaidRiders, riderArrearsOwedStatus } from './riderUnpaidService.mjs';
import { riderPayrollFailureRecorder } from './riderPayrollFailures.mjs';

/** A refused press of Pay Rider: the route answers with `status`, `code` and `message`. */
export class RiderPayRefusal extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const riderSelect = {
  id: true,
  firstName: true,
  lastName: true,
  weeklyRate: true,
  starLevel: true,
  userId: true,
  feeUnpaidSince: true,
};

const riderName = rider => `${rider.firstName} ${rider.lastName}`.trim();

/** Rider ids among `riderIds` with a 'paid' row for the pay week starting `weekStart`. */
async function paidRiderIds(userId, riderIds, weekStart) {
  if (riderIds.length === 0) {
    return new Set();
  }
  const rows = await prisma.riderSalaryPayment.findMany({
    where: {
      userId,
      riderId: { in: riderIds },
      status: 'paid',
      OR: [
        { weekKey: riderPayWeekKey(weekStart) },
        { paymentDate: { gte: weekStart, lt: getRiderPayWeekEnd(weekStart) } },
      ],
    },
    select: { riderId: true },
  });
  return new Set(rows.map(row => row.riderId));
}

/**
 * This week's pay state for every rider on the player's roster. `amountDue` is what
 * one press takes: this week's pay plus every owed week (q142); when the week is
 * already paid it is the weekly pay, for the label.
 *
 * @param {string} userId
 * @param {Date} [now]
 */
export async function getRiderPayStatus(userId, now = new Date()) {
  const payWeekStart = getRiderPayWeekStart(now);
  const roster = await prisma.rider.findMany({
    where: { userId, retired: false },
    select: riderSelect,
    orderBy: { id: 'asc' },
  });
  const riderIds = roster.map(rider => rider.id);
  const [user, paid, owedRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { money: true } }),
    paidRiderIds(userId, riderIds, payWeekStart),
    prisma.riderSalaryPayment.findMany({
      where: {
        userId,
        riderId: { in: riderIds },
        status: riderArrearsOwedStatus,
        paymentDate: { lt: payWeekStart },
      },
      select: { riderId: true, amount: true },
    }),
  ]);
  const money = user?.money ?? 0;
  const owedBy = new Map();
  for (const row of owedRows) {
    owedBy.set(row.riderId, (owedBy.get(row.riderId) ?? 0) + row.amount);
  }
  const riders = roster.map(rider => {
    const weeklyFee = hiredStaffFee(rider);
    const owed = owedBy.get(rider.id) ?? 0;
    const paidThisWeek = paid.has(rider.id);
    const amountDue = paidThisWeek ? weeklyFee : weeklyFee + owed;
    return {
      riderId: rider.id,
      weeklyFee,
      owed,
      amountDue,
      paidThisWeek,
      canAfford: money >= amountDue,
      feeUnpaid: rider.feeUnpaidSince !== null,
    };
  });
  return {
    weekEndsAt: getRiderPayWeekEnd(payWeekStart).toISOString(),
    money,
    riders,
  };
}

/**
 * The player presses Pay Rider for one rider on their roster.
 *
 * @param {string} userId
 * @param {number} riderId
 * @param {Date} [now]
 * @returns {Promise<{riderId: number, amount: number}>}
 * @throws {RiderPayRefusal} 404 riderNotFound, 409 alreadyPaid, 400 insufficientFunds
 */
export async function payRider(userId, riderId, now = new Date()) {
  const row = await prisma.rider.findFirst({
    where: { id: riderId, userId, retired: false },
    select: { ...riderSelect, user: { select: { username: true } } },
  });
  if (!row) {
    throw new RiderPayRefusal(404, 'riderNotFound', 'Rider not found');
  }
  const rider = { ...row, weeklyRate: hiredStaffFee(row) };
  const alreadyPaid = new RiderPayRefusal(
    409,
    'alreadyPaid',
    `${riderName(rider)} is already paid for this week.`,
  );
  let outcome;
  try {
    outcome = await withRetryableTxMapping(
      prisma.$transaction(
        tx =>
          collectRiderPayTx(tx, {
            userId,
            username: row.user?.username ?? userId,
            riders: [rider],
            payWeekStart: getRiderPayWeekStart(now),
            now,
          }),
        { timeout: 30000 },
      ),
    );
  } catch (error) {
    if (error?.code === 'P2002') {
      throw alreadyPaid;
    }
    if (error instanceof InsufficientFundsError) {
      throw new RiderPayRefusal(
        400,
        'insufficientFunds',
        `You do not have enough coins to pay ${riderName(rider)}.`,
      );
    }
    throw error;
  }
  if (outcome.skipped) {
    throw alreadyPaid;
  }
  return { riderId: rider.id, amount: outcome.amount };
}

/**
 * The end of a pay week: every rider on a roster whose week went unpaid gets the unpaid
 * consequence. Takes no money. Run by the weekly job just after Sunday midnight Eastern.
 *
 * @param {Date} [now] - any instant in the pay week AFTER the one to settle
 * @param {{userId?: string|null}} [options] - scope to ONE player (tests must)
 */
export async function settleEndedRiderPayWeek(now = new Date(), { userId = null } = {}) {
  const weekEnd = getRiderPayWeekStart(now);
  const weekStart = startOfGameDayIndex(gameDayIndex(weekEnd) - 7);
  const results = { users: 0, graced: 0, released: 0, errors: [] };
  // Equoria-brh8c: each rider this pass could not settle is recorded for the owner.
  const recordFailure = riderPayrollFailureRecorder('weeklySettlement', weekStart);
  const roster = await prisma.rider.findMany({
    where: { userId: userId ?? { not: null }, retired: false },
    select: riderSelect,
    orderBy: { id: 'asc' },
  });
  const byUser = new Map();
  for (const row of roster) {
    if (!byUser.has(row.userId)) {
      byUser.set(row.userId, []);
    }
    byUser.get(row.userId).push({ ...row, weeklyRate: hiredStaffFee(row) });
  }
  for (const [ownerId, riders] of byUser) {
    try {
      const paid = await paidRiderIds(
        ownerId,
        riders.map(rider => rider.id),
        weekStart,
      );
      const unpaid = riders.filter(rider => !paid.has(rider.id));
      if (unpaid.length === 0) {
        continue;
      }
      results.users++;
      // Re-checks each rider's paid row under the pay-week lock before marking it.
      const outcome = await handleUnpaidRiders(ownerId, unpaid, weekStart, {
        onFailure: recordFailure,
      });
      results.graced += outcome.graced;
      results.released += outcome.released;
    } catch (error) {
      results.errors.push(`User ${ownerId}: ${error.message}`);
      logger.error(
        `[riderPlayerPayService] Week-end settlement failed for user ${ownerId}: ${error.message}`,
      );
      // Nobody on this player's roster was settled: the failure is each rider's.
      for (const rider of riders) {
        await recordFailure(rider, error, ownerId);
      }
    }
  }
  return results;
}
