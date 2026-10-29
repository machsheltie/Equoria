/**
 * Vet Controller (owner ruling 2026-10-26, q78, Equoria-7dmzp).
 *
 * The vet sells exactly two services, each acting on one horse:
 *   - General Health Check: restores the horse to Excellent vet health by
 *     recording today (Eastern game date) as its lastVettedDate (utils/horseHealth).
 *     Owner ruling 2026-10-27: the fee is 100 for each level the horse's VET
 *     health is below Excellent (Very Good 100, Good 200, Fair 300, Bad 400),
 *     computed on the server from the fresh horse row.
 *   - Genetic Testing (500 coins): marks the horse colorGeneticsTested. Revealing
 *     the colour genetics on the Genetics tab is Equoria-8tz7p; this only records
 *     the paid test.
 * A horse that has nothing left to gain is refused with 409 and charged nothing:
 * "already vetted" means its vet health is still Excellent (vetted within the
 * last 7 Eastern game days, the Excellent band of getVetHealth); "already
 * tested" means colorGeneticsTested. Retired horses (21+) are not listed by
 * GET /vet/horses, except a mare still in foal: owner ruling 2026-10-23 keeps her
 * vetted until she foals, because the foal depends on it, so she is listed,
 * priced and vetted on her care as if she were not retired (vetHealthOf).
 *
 * Old contract: a flat 100-coin health check whatever the horse's health
 * (before that, four services; 150/350/200/120).
 *
 * Routes:
 *   GET  /api/v1/vet/services          -> the two services
 *   GET  /api/v1/vet/horses            -> the player's horses under 21 (or in foal), with state
 *   POST /api/v1/vet/book-appointment  -> { horseId, serviceId }
 */

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';
import { gameCalendarDate } from '../../../../utils/gameTime.mjs';
import { liveAgeBelowClauses } from '../../../../utils/horseAge.mjs';
import {
  careBeneathRetirement,
  getVetHealth,
  getFeedHealth,
  getDisplayedHealth,
  healthWords,
} from '../../../../utils/horseHealth.mjs';
import { retirementAgeYears } from '../../../../constants/horseAgePolicy.mjs';
import { withRetryableTxMapping } from '../../../../utils/retryableTransaction.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../services/financialLedgerService.mjs';

export const healthCheckId = 'health-check';
export const geneticTestingId = 'genetic-testing';

// The owner-set service list. Prices are the owner's; never change them here
// without a ruling.
export const VET_SERVICES = [
  {
    id: healthCheckId,
    name: 'General Health Check',
    description: 'Restores a horse to Excellent health',
    // Base price (a horse one level down). The fee for a horse is healthCheckFee().
    cost: 100,
    costNote: '100 coins for a horse at Very Good health, and 100 more for each level below',
    actionLabel: 'Vet Horse',
  },
  {
    id: geneticTestingId,
    name: 'Genetic Testing',
    description: 'A color genetics panel that uncovers the color genes a horse carries.',
    cost: 500,
    actionLabel: 'Run Panel',
  },
];

class AlreadyDoneError extends Error {}
class FeeChangedError extends Error {}

const healthCheckStep = 100;

/**
 * The health check fee for a vet-health word: 100 per level below Excellent.
 * Excellent (and retired) horses have nothing to restore: null.
 */
export function healthCheckFee(vetHealth) {
  const level = healthWords.indexOf(vetHealth);
  return level <= 0 ? null : level * healthCheckStep;
}

/**
 * The vet health the vet works from. A mare of 21 or over still in foal is read on
 * the care underneath her retirement (owner ruling 2026-10-23, Equoria-1re40):
 * getVetHealth would otherwise say 'retired', which has no fee, and the vet
 * refused her as already vetted.
 */
export function vetHealthOf(horse, now = new Date()) {
  return getVetHealth(horse.inFoalSinceDate ? careBeneathRetirement(horse) : horse, now);
}

/** Vet health still Excellent: another health check would change nothing. */
export function isAlreadyVetted(horse, now = new Date()) {
  return vetHealthOf(horse, now) === 'Excellent';
}

/**
 * Prisma where-fragment: horses the vet sees: under 21 on the live Eastern age
 * (Equoria-66qkj: a pending birthday counts), or in foal.
 */
const vetVisibleWhere = (now = new Date()) => ({
  OR: [...liveAgeBelowClauses(retirementAgeYears, now), { inFoalSinceDate: { not: null } }],
});

/**
 * GET /api/v1/vet/services
 */
export async function getVetServices(_req, res) {
  res.status(200).json({
    success: true,
    message: 'Vet services retrieved successfully',
    data: VET_SERVICES,
  });
}

/**
 * GET /api/v1/vet/horses
 * The dropdown list: the player's horses under 21 or in foal, with whether each is
 * already vetted and already genetics-tested.
 */
export async function getVetHorses(req, res) {
  try {
    const rows = await prisma.horse.findMany({
      where: { userId: req.user.id, ...vetVisibleWhere() },
      select: {
        id: true,
        name: true,
        age: true,
        healthStatus: true,
        lastVettedDate: true,
        inFoalSinceDate: true,
        colorGeneticsTested: true,
      },
      orderBy: { name: 'asc' },
    });
    const now = new Date();
    res.status(200).json({
      success: true,
      message: 'Vet horses retrieved successfully',
      data: rows.map(horse => ({
        id: horse.id,
        name: horse.name,
        vetted: isAlreadyVetted(horse, now),
        vetHealth: vetHealthOf(horse, now),
        healthCheckFee: healthCheckFee(vetHealthOf(horse, now)),
        geneticsTested: horse.colorGeneticsTested,
      })),
    });
  } catch (error) {
    logger.error(`[vetController] getVetHorses error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to load horses', data: null });
  }
}

/**
 * POST /api/v1/vet/book-appointment
 * Body: { horseId, serviceId }
 */
export async function bookVetAppointment(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, serviceId } = req.body;

    const service = VET_SERVICES.find(s => s.id === serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found', data: null });
    }

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    // Charge and record the service atomically (Equoria-6g8wm: the shared
    // debitMoneyOrThrow helper is the only correct check-then-debit shape). The
    // horse change is a guarded compare-and-swap on the state read above, so two
    // concurrent clicks cannot buy the same service twice: the loser matches no
    // row and its debit rolls back with the thrown error.
    // Date-only column: store the Eastern calendar date of the visit.
    const isPanel = service.id === geneticTestingId;
    const updateData = isPanel
      ? { colorGeneticsTested: true }
      : { lastVettedDate: gameCalendarDate(), healthStatus: 'Excellent' };

    let updatedHorse;
    let updatedUser;
    let charge = service.cost;
    try {
      ({ updatedHorse, updatedUser } = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          // The health check fee depends on the horse's vet health, so the server
          // prices it from the horse row, never from the client. The row is read
          // again after the debit's User lock (below); a fee that moved between
          // the two reads refuses the booking and rolls the debit back.
          const fee = isPanel ? service.cost : healthCheckFee(vetHealthOf(horse));
          if (fee === null) {
            throw new AlreadyDoneError();
          }
          charge = fee;
          // Equoria-6p398.9 lock ordering: the User row is written BEFORE the
          // Horse row. Every UPDATE holds its row write-lock until commit, so
          // the previous Horse-then-User order deadlocked against buyHorse
          // (which holds User(owner) and waits for Horse) whenever an owner
          // booked a vet service on a horse being bought. No data dependency
          // between the two statements; only the order moved. Guarded by
          // backend/__tests__/txUserBeforeHorseLockOrder.sentinel.test.mjs.
          // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
          const moneyAfter = await debitMoneyOrThrow(tx, {
            userId,
            amount: fee,
            systemAccount: SYSTEM_ACCOUNT_BURN,
            category: 'vetServiceBurn',
            description: `Vet fee — ${service.name} for ${horse.name}`,
            metadata: { horseId, serviceId },
          });
          // The "already done" test reads the horse AFTER the debit's User row lock,
          // so concurrent bookings by one owner serialise and cannot both pass it.
          // Owner ruling 2026-10-26: nothing left to gain means 409 and no charge
          // (the thrown error rolls the debit back).
          const fresh = await tx.horse.findFirst({ where: { id: horseId, userId } });
          if (!fresh) {
            throw new AlreadyDoneError('missing');
          }
          if (isPanel ? fresh.colorGeneticsTested : isAlreadyVetted(fresh)) {
            throw new AlreadyDoneError();
          }
          if (!isPanel && healthCheckFee(vetHealthOf(fresh)) !== fee) {
            throw new FeeChangedError();
          }
          const { count } = await tx.horse.updateMany({
            where: { id: horseId, userId },
            data: updateData,
          });
          if (count !== 1) {
            throw new AlreadyDoneError();
          }
          const horseUpdate = await tx.horse.findUnique({
            where: { id: horseId },
            select: {
              id: true,
              name: true,
              age: true,
              // The response's health words read the live age (Equoria-6pbka).
              dateOfBirth: true,
              healthStatus: true,
              lastVettedDate: true,
              lastFedDate: true,
              hungerSince: true,
              colorGeneticsTested: true,
            },
          });
          // Equoria-2hfss: migrated to recordTransactionTx(tx, opts). tx is
          // structurally required (first arg); the service reads the
          // authoritative balanceAfter inside the same tx, so the caller no
          // longer supplies it. moneyAfter from debitMoneyOrThrow is kept
          // purely as the response-shape value (remainingMoney in the
          // 200 envelope below) — the ledger row's balanceAfter is sourced
          // independently inside the service.
          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: fee,
            category: 'vetService',
            description: `${service.name} for ${horse.name}`,
            metadata: { horseId, serviceId },
          });
          return { updatedHorse: horseUpdate, updatedUser: { money: moneyAfter } };
        }),
        { message: 'The vet office is busy right now, please retry in a moment.' },
      ));
    } catch (txErr) {
      if (txErr instanceof AlreadyDoneError) {
        return res.status(409).json({
          success: false,
          message: isPanel
            ? `${horse.name} has already been tested`
            : `${horse.name} has already been vetted`,
          data: null,
        });
      }
      if (txErr instanceof FeeChangedError) {
        return res.status(409).json({
          success: false,
          message: `The fee for ${horse.name} has changed. Reload and try again.`,
          data: null,
        });
      }
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. ${service.name} for ${horse.name} costs ${charge} coins`,
          data: { required: charge },
        });
      }
      throw txErr;
    }

    logger.info(
      `[vetController] User ${userId} booked "${service.name}" for horse ${horseId} — cost ${charge}`,
    );

    res.status(200).json({
      success: true,
      message: `${service.name} booked successfully`,
      data: {
        horse: {
          id: updatedHorse.id,
          name: updatedHorse.name,
          lastVettedDate: updatedHorse.lastVettedDate,
          colorGeneticsTested: updatedHorse.colorGeneticsTested,
          vetHealth: getVetHealth(updatedHorse),
          feedHealth: getFeedHealth(updatedHorse),
          displayedHealth: getDisplayedHealth(updatedHorse),
        },
        service,
        cost: charge,
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[vetController] bookAppointment error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to book vet appointment', data: null });
  }
}
