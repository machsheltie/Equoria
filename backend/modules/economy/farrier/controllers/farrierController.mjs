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
 * Owner ruling 2026-10-26 (q78, Equoria-zz14s): the farrier's shoe types are a
 * data list (FARRIER_SERVICES; Basic Shoes at 50 for now, more later). The page
 * shows each as a box with a dropdown of the player's horses: a horse shod this
 * week is greyed out and a retired horse (21+) is not listed (GET /horses).
 *
 * Routes:
 *   GET  /api/v1/farrier/shoe-types -> the shoe types
 *   GET  /api/v1/farrier/horses     -> the player's horses under 21, with shod state
 *   POST /api/v1/farrier/shoe-horse -> shoe a horse. Body: { horseId, serviceId? }
 *        (serviceId defaults to basic-shoes, the only type today)
 */

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../../utils/retryableTransaction.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../../utils/gameTime.mjs';
import { retirementAgeYears } from '../../../../constants/horseAgePolicy.mjs';
import { HORSE_STAT_VALUES } from '../../../../constants/schema.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../services/financialLedgerService.mjs';

/** The shoe types, as data. Prices are the owner's. */
export const FARRIER_SERVICES = [
  {
    id: 'basic-shoes',
    name: 'Basic Shoes',
    description: 'A standard set of shoes. A shod horse gains +1 in one stat.',
    cost: 50,
    actionLabel: 'Shoe Horse',
  },
];
export const defaultServiceId = 'basic-shoes';
export const shoeingCost = FARRIER_SERVICES[0].cost;
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

/** Shod within the week: the horse's last shoeing is inside the weekly window. */
function isShodThisWeek(lastShod, now) {
  if (!lastShod) {
    return false;
  }
  const cutoff = startOfGameDayIndex(gameDayIndex(now) - (shoeingIntervalDays - 1));
  return lastShod >= cutoff;
}

/**
 * GET /api/v1/farrier/shoe-types
 * (Not /services: that path stays 404, guarded by farrierController.test.mjs.)
 */
export async function getFarrierServices(_req, res) {
  res.status(200).json({
    success: true,
    message: 'Farrier services retrieved successfully',
    data: FARRIER_SERVICES,
  });
}

/**
 * GET /api/v1/farrier/horses
 * The dropdown list: the player's horses under 21 and whether each is shod.
 */
export async function getFarrierHorses(req, res) {
  try {
    const rows = await prisma.horse.findMany({
      where: {
        userId: req.user.id,
        OR: [{ age: null }, { age: { lt: retirementAgeYears } }],
      },
      select: { id: true, name: true, lastShod: true },
      orderBy: { name: 'asc' },
    });
    const now = new Date();
    res.status(200).json({
      success: true,
      message: 'Farrier horses retrieved successfully',
      data: rows.map(horse => ({
        id: horse.id,
        name: horse.name,
        shod: isShodThisWeek(horse.lastShod, now),
      })),
    });
  } catch (error) {
    logger.error(`[farrierController] getFarrierHorses error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to load horses', data: null });
  }
}

function pickRandomStat() {
  return HORSE_STAT_VALUES[Math.floor(Math.random() * HORSE_STAT_VALUES.length)];
}

/**
 * POST /api/v1/farrier/shoe-horse
 * Body: { horseId, serviceId? }
 */
export async function shoeHorse(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, serviceId = defaultServiceId } = req.body;

    const service = FARRIER_SERVICES.find(entry => entry.id === serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found', data: null });
    }

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
            amount: service.cost,
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
            amount: service.cost,
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
          message: `Insufficient funds. ${service.name} costs ${service.cost} coins`,
          data: { required: service.cost },
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
        cost: service.cost,
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
