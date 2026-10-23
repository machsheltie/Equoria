/**
 * Farrier Controller (owner ruling 2026-10-23, Equoria-zmqzf).
 *
 * The farrier has ONE action: once a week the player shoes a horse for
 * shoeingCost coins. The horse's `lastShod` is set to now and, for now, one
 * random stat gains +1. There are no tiers, trims, durations, outcome grades,
 * hoof condition or decay.
 *
 * "Once a week" is game time (US Eastern, utils/gameTime.mjs): a horse can be
 * shod again when seven Eastern calendar days have passed since its last
 * shoeing. The limit is enforced inside the transaction by a guarded
 * conditional updateMany on the horse row, so concurrent clicks cannot shoe
 * (or charge for) the same horse twice.
 *
 * Route:
 *   POST /api/v1/farrier/shoe-horse -> shoe a horse. Body: { horseId }
 */

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../../utils/retryableTransaction.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../../utils/gameTime.mjs';
import { HORSE_STAT_VALUES } from '../../../../constants/schema.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../services/financialLedgerService.mjs';

export const shoeingCost = 50;
/** Game days that must pass between two shoeings of the same horse. */
export const shoeingIntervalDays = 7;

class AlreadyShodThisWeekError extends Error {}

/**
 * Prisma `where` fragment: the horse has never been shod, or its last shoeing
 * was at least shoeingIntervalDays Eastern calendar days ago.
 * @param {Date} now
 */
function shoeableWhere(now) {
  const cutoff = startOfGameDayIndex(gameDayIndex(now) - (shoeingIntervalDays - 1));
  return { OR: [{ lastShod: null }, { lastShod: { lt: cutoff } }] };
}

function pickRandomStat() {
  return HORSE_STAT_VALUES[Math.floor(Math.random() * HORSE_STAT_VALUES.length)];
}

/**
 * POST /api/v1/farrier/shoe-horse
 * Body: { horseId }
 */
export async function shoeHorse(req, res) {
  try {
    const userId = req.user.id;
    const { horseId } = req.body;

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const now = new Date();
    const stat = pickRandomStat();

    let updatedHorse;
    let moneyAfter;
    try {
      ({ updatedHorse, moneyAfter } = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          // Lock order User -> Horse (Equoria-6p398.9; guarded by
          // txUserBeforeHorseLockOrder.sentinel.test.mjs): the debit writes the
          // User row first. Equoria-kl16c: paired SystemAccount burn credit.
          const balance = await debitMoneyOrThrow(tx, {
            userId,
            amount: shoeingCost,
            systemAccount: SYSTEM_ACCOUNT_BURN,
            category: 'farrierServiceBurn',
            description: `Farrier fee, shoeing ${horse.name}`,
            metadata: { horseId },
          });
          // The weekly limit: a guarded conditional update. A second concurrent
          // click, or a click inside the week, matches no row and rolls the
          // debit back with the thrown error.
          const { count } = await tx.horse.updateMany({
            where: { id: horseId, userId, ...shoeableWhere(now) },
            data: { lastShod: now, [stat]: { increment: 1 } },
          });
          if (count !== 1) {
            throw new AlreadyShodThisWeekError();
          }
          const shod = await tx.horse.findUnique({
            where: { id: horseId },
            select: { id: true, name: true, lastShod: true },
          });
          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: shoeingCost,
            category: 'farrierService',
            description: `Shoeing for ${horse.name}`,
            metadata: { horseId },
          });
          return { updatedHorse: shod, moneyAfter: balance };
        }),
        { message: 'The farrier is busy right now, please retry in a moment.' },
      ));
    } catch (txErr) {
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Shoeing costs ${shoeingCost} coins`,
          data: { required: shoeingCost },
        });
      }
      if (txErr instanceof AlreadyShodThisWeekError) {
        return res.status(409).json({
          success: false,
          message: `${horse.name} has already been shod this week`,
          data: null,
        });
      }
      throw txErr;
    }

    logger.info(`[farrierController] User ${userId} shod horse ${horseId}`);

    res.status(200).json({
      success: true,
      message: `${horse.name} has been shod`,
      data: {
        horse: { id: updatedHorse.id, name: updatedHorse.name, lastShod: updatedHorse.lastShod },
        statGained: stat,
        cost: shoeingCost,
        remainingMoney: moneyAfter,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[farrierController] shoeHorse error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to shoe horse', data: null });
  }
}
