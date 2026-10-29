/**
 * Pay Groom — payday is a player action (Equoria-hc96y).
 *
 * Owner rulings 2026-10-28 (q262/q265 notes): "Users have to pay them. My goal is not
 * to automate work for players." and "payday is handled by players. They click 'pay
 * groom, pay rider'." Owner ruling 2026-10-29 (q268): pay any time during the week;
 * the week ends Sunday midnight Eastern, then the unpaid rules apply.
 *
 * So the game never takes a groom's weekly fee by itself any more. This file owns:
 *   - `getGroomPayStatus`: what each groom on staff costs this week, whether this week
 *     is paid, and what one press of Pay Groom would take;
 *   - `payGroom`: the press itself, one groom, through the same collection the owner's
 *     manual payday uses (groomFeeCollection.mjs), so it is idempotent per groom and
 *     pay week (the advisory lock plus the paid-week partial unique index);
 *   - `settleEndedGroomPayWeek`: the weekly job at the end of a pay week. It takes no
 *     money. Each groom whose week went unpaid gets the existing consequence
 *     (groomFeeArrearsService.handleUnpaidFees): the week is owed and the groom cannot
 *     work until paid; a groom already unpaid for an earlier week leaves for the
 *     grooms-for-hire pool.
 *
 * The hire fee is one week's pay (the star price), so a groom hired during a pay week
 * counts as paid for that week: the week-end job leaves them alone and Pay Groom says
 * the week is paid.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { gameDateKey, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { InsufficientFundsError } from '../../economy/index.mjs';
import { collectGroomFeesTx } from './groomFeeCollection.mjs';
import { handleUnpaidFees } from './groomFeeArrearsService.mjs';
import { arrearsOwedStatuses, calculateWeeklyFee } from './groomFeeBasisService.mjs';
import { getPayWeekStart } from './groomSalaryService.mjs';

/** A refused press of Pay Groom: the route answers with `status`, `code` and `message`. */
export class GroomPayRefusal extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const groomSelect = {
  id: true,
  name: true,
  userId: true,
  skillLevel: true,
  starLevel: true,
  speciality: true,
  feeUnpaidSince: true,
};

function payWeekBounds(now) {
  const payWeekStart = getPayWeekStart(now);
  const payWeekEnd = startOfGameDayIndex(gameDayIndex(payWeekStart) + 7);
  return { payWeekStart, payWeekEnd, weekKey: gameDateKey(payWeekStart) };
}

/** Groom ids among `groomIds` whose open engagement with `userId` began at or after `since`. */
async function hiredSince(client, userId, groomIds, since) {
  if (groomIds.length === 0) {
    return new Set();
  }
  const rows = await client.groomEngagement.findMany({
    where: { userId, groomId: { in: groomIds }, endedAt: null, startedAt: { gte: since } },
    select: { groomId: true },
  });
  return new Set(rows.map(row => row.groomId));
}

/**
 * This week's pay state for every groom on the player's staff.
 *
 * `amountDue` is what one press takes: this week's fee plus any owed weeks when the
 * wallet covers both, else this week's fee alone (this week first, then the debt —
 * Equoria-bgdfb). When the week is already paid it is the weekly fee, for the label.
 *
 * @param {string} userId
 * @param {Date} [now]
 */
export async function getGroomPayStatus(userId, now = new Date()) {
  const { payWeekStart, payWeekEnd } = payWeekBounds(now);
  const staff = await prisma.groom.findMany({
    where: { userId, retired: false, isActive: true },
    select: groomSelect,
    orderBy: { id: 'asc' },
  });
  const groomIds = staff.map(groom => groom.id);
  const [user, paidRows, owedRows, hired] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { money: true } }),
    prisma.groomSalaryPayment.findMany({
      where: {
        userId,
        groomId: { in: groomIds },
        paymentType: 'weeklySalary',
        status: 'paid',
        paymentDate: { gte: payWeekStart, lt: payWeekEnd },
      },
      select: { groomId: true },
    }),
    prisma.groomSalaryPayment.findMany({
      where: {
        userId,
        groomId: { in: groomIds },
        paymentType: 'weeklySalary',
        status: { in: [...arrearsOwedStatuses] },
        paymentDate: { lt: payWeekStart },
      },
      select: { groomId: true, amount: true },
    }),
    hiredSince(prisma, userId, groomIds, payWeekStart),
  ]);
  const money = user?.money ?? 0;
  const paid = new Set(paidRows.map(row => row.groomId));
  const owedBy = new Map();
  for (const row of owedRows) {
    owedBy.set(row.groomId, (owedBy.get(row.groomId) ?? 0) + row.amount);
  }

  const grooms = staff.map(groom => {
    const weeklyFee = calculateWeeklyFee(groom);
    const owed = owedBy.get(groom.id) ?? 0;
    const paidThisWeek = paid.has(groom.id) || hired.has(groom.id);
    let amountDue = weeklyFee;
    if (!paidThisWeek && owed > 0 && money >= weeklyFee + owed) {
      amountDue = weeklyFee + owed;
    }
    return {
      groomId: groom.id,
      weeklyFee,
      owed,
      amountDue,
      paidThisWeek,
      canAfford: money >= amountDue,
      feeUnpaid: groom.feeUnpaidSince !== null,
    };
  });

  return { weekEndsAt: payWeekEnd.toISOString(), money, grooms };
}

/**
 * The player presses Pay Groom for one groom on their staff.
 *
 * @param {string} userId
 * @param {number} groomId
 * @param {Date} [now]
 * @returns {Promise<{groomId: number, amount: number}>}
 * @throws {GroomPayRefusal} 404 groomNotFound, 409 alreadyPaid, 400 insufficientFunds
 */
export async function payGroom(userId, groomId, now = new Date()) {
  const groom = await prisma.groom.findFirst({
    where: { id: groomId, userId, retired: false, isActive: true },
    select: { ...groomSelect, user: { select: { username: true } } },
  });
  if (!groom) {
    throw new GroomPayRefusal(404, 'groomNotFound', 'Groom not found');
  }
  const alreadyPaid = new GroomPayRefusal(
    409,
    'alreadyPaid',
    `${groom.name} is already paid for this week.`,
  );
  const { payWeekStart, payWeekEnd, weekKey } = payWeekBounds(now);
  const hired = await hiredSince(prisma, userId, [groom.id], payWeekStart);
  if (hired.has(groom.id)) {
    throw alreadyPaid;
  }

  let outcome;
  try {
    outcome = await withRetryableTxMapping(
      prisma.$transaction(
        tx =>
          collectGroomFeesTx(tx, {
            userId,
            username: groom.user?.username ?? userId,
            entries: [{ groom, salary: calculateWeeklyFee(groom) }],
            payWeekStart,
            payWeekEnd,
            weekKey,
            now,
            description: `Groom weekly pay — ${groom.name}`,
          }),
        { timeout: 30000 },
      ),
    );
  } catch (error) {
    if (error?.code === 'P2002') {
      throw alreadyPaid;
    }
    if (error instanceof InsufficientFundsError) {
      throw new GroomPayRefusal(
        400,
        'insufficientFunds',
        `You do not have enough coins to pay ${groom.name}.`,
      );
    }
    throw error;
  }
  if (outcome.skipped) {
    throw alreadyPaid;
  }
  return { groomId: groom.id, amount: outcome.amount };
}

/**
 * The end of a pay week: every groom on staff whose week went unpaid gets the unpaid
 * consequence. Takes no money. Run by the weekly job just after Sunday midnight
 * Eastern, for the week that has just ended.
 *
 * @param {Date} [now] - any instant in the pay week AFTER the one to settle
 * @param {{userId?: string|null}} [options] - scope to ONE player (tests must: an
 *   unscoped pass applies the consequence to every player's unpaid grooms)
 */
export async function settleEndedGroomPayWeek(now = new Date(), { userId = null } = {}) {
  const weekEnd = getPayWeekStart(now);
  const weekStart = startOfGameDayIndex(gameDayIndex(weekEnd) - 7);
  const results = { users: 0, graced: 0, released: 0, errors: [] };

  const where = { userId: userId ?? { not: null }, retired: false, isActive: true };
  const staff = await prisma.groom.findMany({
    where,
    select: groomSelect,
    orderBy: { id: 'asc' },
  });
  const byUser = new Map();
  for (const groom of staff) {
    if (!byUser.has(groom.userId)) {
      byUser.set(groom.userId, []);
    }
    byUser.get(groom.userId).push(groom);
  }

  for (const [ownerId, grooms] of byUser) {
    try {
      const ids = grooms.map(groom => groom.id);
      const paidRows = await prisma.groomSalaryPayment.findMany({
        where: {
          userId: ownerId,
          groomId: { in: ids },
          paymentType: 'weeklySalary',
          status: 'paid',
          paymentDate: { gte: weekStart, lt: weekEnd },
        },
        select: { groomId: true },
      });
      const paid = new Set(paidRows.map(row => row.groomId));
      const hired = await hiredSince(prisma, ownerId, ids, weekStart);
      const unpaid = grooms
        .filter(groom => !paid.has(groom.id) && !hired.has(groom.id))
        .map(groom => ({ groom, salary: calculateWeeklyFee(groom) }));
      if (unpaid.length === 0) {
        continue;
      }
      results.users++;
      // Re-checks each groom's paid row under the pay-week lock before marking it.
      const outcome = await handleUnpaidFees(ownerId, unpaid, weekStart);
      results.graced += outcome.graced;
      results.released += outcome.released;
    } catch (error) {
      results.errors.push(`User ${ownerId}: ${error.message}`);
      logger.error(
        `[groomPlayerPayService] Week-end settlement failed for user ${ownerId}: ${error.message}`,
      );
    }
  }
  return results;
}
