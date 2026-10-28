/**
 * Trainer Marketplace Controller
 * Handles GET /marketplace, POST /marketplace/hire, POST /marketplace/refresh.
 *
 * State is persisted in the database (staff_marketplace_state table, staffType='trainer').
 */

import {
  generateTrainerMarketplace,
  trainerMarketplaceNeedsRefresh,
  getTrainerRefreshCost,
  TRAINER_MARKETPLACE_CONFIG,
} from '../services/trainerMarketplace.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../economy/index.mjs';
// Equoria-oey96.8: roster-cap enforcement. Same-module config deep import;
// getStableLevel via the users barrel (cross-module); shared roster-cap error.
import { getTrainerRosterCap } from '../config/trainerConfig.mjs';
import { getStableLevel } from '../../users/index.mjs';
import { RosterCapExceededError, StaleOfferError } from '../../../errors/index.mjs';
import { staffHireRefusal } from '../../../errors/staffHireRefusalCodes.mjs';
import { offerLevelAndFee } from '../../../constants/staffLevels.mjs';
// Equoria-1poxi: a hire may carry a horseId; the assignment commits with the hire.
import { assertHorseTakesNewStaffTx } from '../../horses/index.mjs';
// Equoria-bvddn.19: remove the hired offer INSIDE the hire transaction via a
// compare-and-swap on the persisted offer list, instead of a post-commit
// read-filter-write against a pre-transaction snapshot.
import { removeMarketplaceOfferCas } from '../../../utils/staffMarketplaceOfferCas.mjs';

const STAFF_TYPE = 'trainer';

/** An error the hire's catch block turns into a specific HTTP status. */
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Load (or auto-generate) the persisted marketplace state for a user.
 */
async function loadOrCreateMarketplace(userId) {
  const record = await prisma.staffMarketplaceState.findUnique({
    where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
  });

  if (!record || trainerMarketplaceNeedsRefresh(record.lastRefresh)) {
    const trainers = generateTrainerMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    const updated = await prisma.staffMarketplaceState.upsert({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      create: { userId, staffType: STAFF_TYPE, offers: trainers, refreshCount },
      update: { offers: trainers, lastRefresh: new Date(), refreshCount },
    });
    logger.info(
      `[trainerMarketplace] Generated new marketplace for user ${userId} with ${trainers.length} trainers`,
    );
    return {
      offers: updated.offers,
      lastRefresh: updated.lastRefresh,
      refreshCount: updated.refreshCount,
    };
  }

  return {
    offers: record.offers,
    lastRefresh: record.lastRefresh,
    refreshCount: record.refreshCount,
  };
}

/**
 * GET /api/trainers/marketplace
 */
export async function getTrainerMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { offers, lastRefresh, refreshCount } = await loadOrCreateMarketplace(userId);

    const nextFreeRefresh = new Date(lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );
    const refreshCost = getTrainerRefreshCost(lastRefresh);

    res.status(200).json({
      success: true,
      message: 'Trainer marketplace retrieved successfully',
      data: {
        trainers: offers,
        lastRefresh,
        nextFreeRefresh,
        refreshCost,
        canRefreshFree: refreshCost === 0,
        refreshCount,
      },
    });
  } catch (error) {
    logger.error(`[trainerMarketplace] getMarketplace error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get trainer marketplace', data: null });
  }
}

/**
 * POST /api/trainers/marketplace/refresh
 */
export async function refreshTrainerMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });
    const refreshCost = getTrainerRefreshCost(record?.lastRefresh ?? null);

    if (refreshCost > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `Marketplace refresh costs $${refreshCost}. Set force=true to pay for refresh.`,
        data: { cost: refreshCost },
      });
    }

    if (refreshCost > 0 && force) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', data: null });
      }
      if (user.money < refreshCost) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Refresh costs $${refreshCost}`,
          data: { required: refreshCost, available: user.money },
        });
      }
    }

    // Equoria-t65fh (hjtys follow-up #4): wrap the paid-refresh debit AND
    // the staffMarketplaceState.upsert in a single $transaction so the two
    // writes share rollback semantics. Pre-fix: a debit succeeded against
    // bare prisma (autocommit), and then an upsert failure (DB blip,
    // conflict, validation) left the user charged with NO refreshed offer
    // list persisted. The conditional debit (refreshCost > 0 && force)
    // moves inside the tx with debitMoneyOrThrow(tx, ...) for concurrency
    // safety; InsufficientFundsError surfaces as a 400 to the client.
    const trainers = generateTrainerMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    let updated;
    try {
      updated = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          if (refreshCost > 0 && force) {
            // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
            await debitMoneyOrThrow(tx, {
              userId,
              amount: refreshCost,
              systemAccount: SYSTEM_ACCOUNT_BURN,
              category: 'trainerMarketplaceRefreshBurn',
              description: 'Trainer marketplace refresh fee',
              metadata: { staffType: STAFF_TYPE },
            });
          }
          return tx.staffMarketplaceState.upsert({
            where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
            create: { userId, staffType: STAFF_TYPE, offers: trainers, refreshCount },
            update: { offers: trainers, lastRefresh: new Date(), refreshCount },
          });
        }),
        { message: 'The marketplace is busy right now, please retry in a moment.' },
      );
    } catch (txErr) {
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Refresh costs $${refreshCost}`,
          data: { required: refreshCost },
        });
      }
      throw txErr;
    }

    const nextFreeRefresh = new Date(updated.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );

    res.status(200).json({
      success: true,
      message: 'Trainer marketplace refreshed successfully',
      data: {
        trainers: updated.offers,
        lastRefresh: updated.lastRefresh,
        nextFreeRefresh,
        refreshCost: 0,
        canRefreshFree: true,
        refreshCount: updated.refreshCount,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[trainerMarketplace] refreshMarketplace error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to refresh trainer marketplace', data: null });
  }
}

/**
 * POST /api/trainers/marketplace/hire
 *
 * Equoria-3kegj. OLD CONTRACT: hiring charged sessionRate * 4 ("one month of
 * sessions upfront"). NEW RULING (owner, 2026-10-22): hiring a trainer is
 * FREE. The only trainer charge is the trainer's advertised per-training fee
 * (sessionRate), taken once each time the player trains a horse with this
 * trainer (training/services/trainingSessionTx.mjs).
 */
export async function hireTrainerFromMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { marketplaceId } = req.body;
    // Equoria-1poxi: optional. When present the new trainer is assigned to this horse
    // inside the hire transaction, so a hire can never be left unassigned.
    const horseId = req.body.horseId === undefined ? null : Number(req.body.horseId);

    if (!marketplaceId) {
      return res
        .status(400)
        .json({ success: false, message: 'marketplaceId is required', data: null });
    }

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No marketplace found. Please refresh first.',
        data: null,
      });
    }

    const offers = Array.isArray(record.offers) ? record.offers : [];
    const trainerIndex = offers.findIndex(t => t.marketplaceId === marketplaceId);
    if (trainerIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Trainer not found in marketplace', data: null });
    }

    const trainerData = offers[trainerIndex];
    // Owner ruling 2026-10-28 (Equoria-nawn5): the trainer's per-session fee is its
    // star level's price. An offer generated before star levels keeps the session
    // rate it advertised.
    const { starLevel, fee: sessionFee } = offerLevelAndFee(
      'trainer',
      trainerData,
      trainerData.sessionRate,
    );

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { level: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    // Equoria-oey96.8: roster cap scales by stable level (getStableLevel derives
    // it from User.level). Fast-path reject for an already-full user so we don't
    // open a tx for a hire that can't land. TOCTOU on its own — the authoritative
    // guard is the in-tx post-lock re-count below; this only avoids the tx for the
    // common sequential at-cap case.
    const rosterCap = getTrainerRosterCap(getStableLevel(user));
    const activeTrainerCount = await prisma.trainer.count({ where: { userId, retired: false } });
    if (activeTrainerCount >= rosterCap) {
      return res.status(400).json({
        success: false,
        code: staffHireRefusal.rosterCapReached,
        message: `You have reached your trainer roster cap of ${rosterCap}. Retire a trainer or raise your stable level before hiring another.`,
        data: { currentCount: activeTrainerCount, maxAllowed: rosterCap },
      });
    }

    const hired = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        // Lock the User row first (lock order User -> staff) so concurrent
        // same-user hires serialize here and the roster re-count below sees
        // every committed sibling. (The hire used to take this lock through
        // its money debit; the hire is free now, so it takes it explicitly.)
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

        // Equoria-1poxi: lock order User -> Horse -> staff. The owned horse row is
        // locked before the new trainer row exists, and a retired horse takes no
        // new trainer (the same guards the assign endpoint applies).
        if (horseId !== null) {
          const [horse] = await tx.$queryRaw`
            SELECT "id" FROM "horses" WHERE "id" = ${horseId} AND "userId" = ${userId} FOR UPDATE`;
          if (!horse) {
            throw httpError(404, 'Horse not found');
          }
          await assertHorseTakesNewStaffTx(tx, horseId);
        }

        const trainer = await tx.trainer.create({
          data: {
            userId,
            firstName: trainerData.firstName,
            lastName: trainerData.lastName,
            personality: trainerData.personality,
            skillLevel: trainerData.skillLevel,
            starLevel,
            speciality: trainerData.speciality,
            sessionRate: sessionFee,
            bio: trainerData.bio,
          },
        });

        // Equoria-oey96.8: authoritative roster-cap re-count (mirrors the groom
        // Equoria-n4m5j / hduc5 pattern). The User row lock above serializes
        // concurrent same-user hires, so this count observes every committed
        // sibling. trainer.create ran first, so the count INCLUDES this hire — if
        // it now exceeds the cap the last slot was already taken by a racing
        // sibling; throw so the create rolls back (no over-cap trainer). Only
        // NON-retired trainers count. rosterCap is from the pre-tx User.level
        // (monotonic; a concurrent level-up only RAISES the cap).
        const rosterCountInTx = await tx.trainer.count({ where: { userId, retired: false } });
        if (rosterCountInTx > rosterCap) {
          throw new RosterCapExceededError(
            `You have reached your trainer roster cap of ${rosterCap}. Retire a trainer or raise your stable level before hiring another.`,
          );
        }
        // Equoria-bvddn.19: remove the hired offer from the persisted list
        // INSIDE this transaction, compare-and-swapped against the exact
        // `offers` snapshot read before the transaction opened. If a
        // concurrent hire (same offer, a different offer, or a marketplace
        // refresh) already changed the row, zero rows match and the whole
        // hire rolls back rather than creating a second trainer from one offer
        // or resurrecting an already-hired offer.
        const updatedOffers = offers.filter((_, i) => i !== trainerIndex);
        const offerClaim = await removeMarketplaceOfferCas(tx, {
          userId,
          staffType: STAFF_TYPE,
          expectedOffers: offers,
          updatedOffers,
        });
        if (offerClaim !== 1) {
          throw new StaleOfferError(
            'This trainer was already hired or the marketplace changed. Please refresh and try again.',
          );
        }

        // One trainer per horse: the horse's previous active trainer steps down.
        let assignment;
        if (horseId !== null) {
          await tx.trainerAssignment.updateMany({
            where: { horseId, isActive: true },
            data: { isActive: false },
          });
          assignment = await tx.trainerAssignment.create({
            data: { trainerId: trainer.id, horseId, userId, isActive: true },
          });
        }
        return { trainer, assignment };
      }),
      { message: 'The marketplace is busy right now, please retry in a moment.' },
    );
    const { trainer: newTrainer, assignment: newAssignment } = hired;

    logger.info(`[trainerMarketplace] User ${userId} hired trainer ${newTrainer.id} (free)`);

    res.status(201).json({
      success: true,
      message: 'Trainer hired successfully',
      data: {
        trainer: { ...newTrainer, name: `${newTrainer.firstName} ${newTrainer.lastName}` },
        // Hiring is free (owner ruling 2026-10-22, Equoria-3kegj).
        cost: 0,
        ...(newAssignment ? { assignment: newAssignment } : {}),
      },
    });
  } catch (error) {
    // Equoria-1poxi: the horse guards (404 not yours, 400 retired) refuse the whole
    // hire; the transaction rolled back, so no trainer row remains.
    if (typeof error?.status === 'number' && error.status !== 503) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        ...(error.code ? { code: error.code } : {}),
        data: null,
      });
    }
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    // Equoria-oey96.8: the post-lock re-count rejected an over-cap racing hire.
    // trainer.create rolled back (user left at exactly the cap, no trainer row).
    if (error instanceof RosterCapExceededError) {
      return res.status(400).json({
        success: false,
        code: staffHireRefusal.rosterCapReached,
        message: error.message,
        data: null,
      });
    }
    // Equoria-bvddn.19: the in-tx CAS lost the offer to a concurrent hire or
    // refresh. trainer.create rolled back (no orphan trainer). Surface as 409
    // so the client re-fetches the marketplace before retrying.
    if (error instanceof StaleOfferError) {
      return res.status(409).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[trainerMarketplace] hireTrainer error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to hire trainer', data: null });
  }
}
