/**
 * Riders-for-hire pool: list and hire (owner ruling 2026-10-28, q177; Equoria-xlw03).
 *
 * GET  /api/riders/free-agents        riders other players let go, at their current level
 * POST /api/riders/free-agents/hire   { riderId } — one week at the rider's level's price
 *
 * The pool predicate and the list projection live in riderFreeAgentPool.mjs. A hire is
 * the marketplace hire's money path (debit + burn, ledger row, this pay week paid) on an
 * existing rider row, claimed with a guarded update on the pool predicate so two
 * players cannot both get the same rider.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  systemAccountBurn,
} from '../../economy/index.mjs';
import { getRiderRosterCap } from '../config/riderConfig.mjs';
import { getStableLevel } from '../../users/index.mjs';
import { RosterCapExceededError } from '../../../errors/index.mjs';
import { staffHireRefusal } from '../../../errors/staffHireRefusalCodes.mjs';
import { hiredStaffFee } from '../../../constants/staffLevels.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { getRiderPayWeekStart, riderPayWeekKey } from '../services/riderPayWeek.mjs';
import { listFreeAgentRiders, riderFreeAgentWhere } from '../services/riderFreeAgentPool.mjs';

class FreeAgentRiderUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FreeAgentRiderUnavailableError';
  }
}

/** GET /api/riders/free-agents */
export async function listFreeAgentRidersHandler(req, res) {
  try {
    const { limit, skip } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });
    const { riders, total } = await listFreeAgentRiders(prisma, { limit, skip });
    res.status(200).json({
      success: true,
      message: `Retrieved ${riders.length} riders available for hire`,
      data: {
        riders,
        total,
        pagination: { total, limit, offset: skip, hasMore: skip + limit < total },
      },
    });
  } catch (error) {
    logger.error(`[riderFreeAgentController] Error listing free agents: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve riders for hire', data: null });
  }
}

/** POST /api/riders/free-agents/hire */
export async function hireFreeAgentRider(req, res) {
  const userId = req.user.id;
  const riderId = Number.parseInt(req.body?.riderId, 10);
  try {
    const offer = await prisma.rider.findFirst({
      where: { id: riderId, ...riderFreeAgentWhere },
      select: { id: true, firstName: true, lastName: true, starLevel: true },
    });
    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: 'That rider is not available for hire', data: null });
    }
    // One week at the rider's CURRENT level's price, as any hire (q226, q177).
    const hiringCost = hiredStaffFee(offer);
    const riderName = `${offer.firstName} ${offer.lastName}`;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true, level: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }
    const rosterCap = getRiderRosterCap(getStableLevel(user));

    let result;
    try {
      result = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          // User row first (lock order), then the rider row.
          const moneyAfter = await debitMoneyOrThrow(tx, {
            userId,
            amount: hiringCost,
            systemAccount: systemAccountBurn,
            category: 'riderHireBurn',
            description: `Rider hire fee — ${riderName}`,
            metadata: { riderId, freeAgent: true },
          });
          const claimed = await tx.rider.updateMany({
            where: { id: riderId, ...riderFreeAgentWhere },
            data: { userId, freeAgentSince: null, feeUnpaidSince: null },
          });
          if (claimed.count !== 1) {
            throw new FreeAgentRiderUnavailableError(
              'That rider was hired by someone else a moment ago.',
            );
          }
          const rosterCount = await tx.rider.count({ where: { userId, retired: false } });
          if (rosterCount > rosterCap) {
            throw new RosterCapExceededError(
              `You have reached your rider roster cap of ${rosterCap}. Retire a rider or raise your stable level before hiring another.`,
            );
          }
          // The hidden retirement age was rolled when the rider was first hired and stays
          // with the row; only the retirement services touch it (Equoria-or2ua).
          // The hire charge is this pay week's pay (q111), as for a marketplace hire. A
          // rider let go earlier this same week already has this week's 'paid' row (one
          // per rider per week, a partial unique index), which equally stops the Monday
          // pass charging the week twice, so none is added.
          const weekKey = riderPayWeekKey(getRiderPayWeekStart());
          const paidThisWeek = await tx.riderSalaryPayment.findFirst({
            where: { riderId, weekKey, status: 'paid' },
            select: { id: true },
          });
          if (!paidThisWeek) {
            await tx.riderSalaryPayment.create({
              data: { riderId, userId, amount: hiringCost, weekKey, status: 'paid' },
            });
          }
          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: hiringCost,
            category: 'riderHire',
            description: `Hired rider ${riderName}`,
            metadata: { riderId, freeAgent: true },
          });
          return { moneyAfter };
        }),
        { message: 'The riders for hire are busy right now, please retry in a moment.' },
      );
    } catch (txErr) {
      if (txErr instanceof FreeAgentRiderUnavailableError) {
        return res.status(409).json({ success: false, message: txErr.message, data: null });
      }
      if (txErr instanceof RosterCapExceededError) {
        return res.status(400).json({
          success: false,
          code: staffHireRefusal.rosterCapReached,
          message: txErr.message,
          data: { maxAllowed: rosterCap },
        });
      }
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          code: staffHireRefusal.insufficientFunds,
          message: `Insufficient funds. Hiring costs $${hiringCost} (one week upfront)`,
          data: { required: hiringCost },
        });
      }
      throw txErr;
    }

    logger.info(`[riderFreeAgentController] User ${userId} hired rider ${riderId} from the pool`);
    return res.status(201).json({
      success: true,
      message: `Hired ${riderName}`,
      data: {
        rider: { id: riderId, name: riderName, starLevel: offer.starLevel },
        cost: hiringCost,
        remainingMoney: result.moneyAfter,
      },
    });
  } catch (error) {
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[riderFreeAgentController] Error hiring free agent: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to hire rider', data: null });
  }
}
