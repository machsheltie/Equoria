/**
 * Vet Controller (owner ruling 2026-10-26, q78, Equoria-7dmzp).
 *
 * The vet sells exactly two services, each acting on one horse:
 *   - General Health Check (100 coins): records today (Eastern game date) as the
 *     horse's lastVettedDate, which drives its vet health (utils/horseHealth).
 *   - Genetic Testing (500 coins): marks the horse colorGeneticsTested. Revealing
 *     the colour genetics on the Genetics tab is Equoria-8tz7p; this only records
 *     the paid test.
 * A horse that has nothing left to gain is refused with 409 and charged nothing:
 * "already vetted" means its vet health is still Excellent (vetted within the
 * last 7 Eastern game days, the Excellent band of getVetHealth); "already
 * tested" means colorGeneticsTested. Retired horses (21+) are not listed by
 * GET /vet/horses.
 *
 * Old contract: four services (health check 150, treatment 350, dental 200,
 * vaccination 120); a health check set healthStatus and could be bought again
 * at once.
 *
 * Routes:
 *   GET  /api/v1/vet/services          -> the two services
 *   GET  /api/v1/vet/horses            -> the player's horses under 21, with state
 *   POST /api/v1/vet/book-appointment  -> { horseId, serviceId }
 */

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';
import { gameCalendarDate } from '../../../../utils/gameTime.mjs';
import { getVetHealth } from '../../../../utils/horseHealth.mjs';
import { retirementAgeYears } from '../../../../constants/horseAgePolicy.mjs';
import { withRetryableTxMapping } from '../../../../utils/retryableTransaction.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../services/financialLedgerService.mjs';

export const HEALTH_CHECK_ID = 'health-check';
export const GENETIC_TESTING_ID = 'genetic-testing';

// The owner-set service list. Prices are the owner's; never change them here
// without a ruling.
export const VET_SERVICES = [
  {
    id: HEALTH_CHECK_ID,
    name: 'General Health Check',
    description: 'A full examination. Keeps a horse in Excellent health for a week.',
    cost: 100,
    actionLabel: 'Vet Horse',
  },
  {
    id: GENETIC_TESTING_ID,
    name: 'Genetic Testing',
    description: 'A colour genetics panel that uncovers the colour genes a horse carries.',
    cost: 500,
    actionLabel: 'Run Panel',
  },
];

class AlreadyDoneError extends Error {}

/** Vet health still Excellent: another health check would change nothing. */
export function isAlreadyVetted(horse, now = new Date()) {
  return getVetHealth(horse, now) === 'Excellent';
}

/** Prisma where-fragment: horses still active (age unknown counts as active). */
const notRetiredWhere = { OR: [{ age: null }, { age: { lt: retirementAgeYears } }] };

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
 * The dropdown list: the player's horses under 21, with whether each is
 * already vetted and already genetics-tested.
 */
export async function getVetHorses(req, res) {
  try {
    const rows = await prisma.horse.findMany({
      where: { userId: req.user.id, ...notRetiredWhere },
      select: {
        id: true,
        name: true,
        age: true,
        healthStatus: true,
        lastVettedDate: true,
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
    const isPanel = service.id === GENETIC_TESTING_ID;
    const updateData = isPanel
      ? { colorGeneticsTested: true }
      : { lastVettedDate: gameCalendarDate(), healthStatus: 'Excellent' };

    let updatedHorse;
    let updatedUser;
    try {
      ({ updatedHorse, updatedUser } = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
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
            amount: service.cost,
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
          const { count } = await tx.horse.updateMany({
            where: { id: horseId, userId },
            data: updateData,
          });
          if (count !== 1) {
            throw new AlreadyDoneError();
          }
          const horseUpdate = await tx.horse.findUnique({
            where: { id: horseId },
            select: { id: true, name: true, lastVettedDate: true, colorGeneticsTested: true },
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
            amount: service.cost,
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
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. ${service.name} costs ${service.cost} coins`,
          data: { required: service.cost },
        });
      }
      throw txErr;
    }

    logger.info(
      `[vetController] User ${userId} booked "${service.name}" for horse ${horseId} — cost ${service.cost}`,
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
        },
        service,
        cost: service.cost,
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
