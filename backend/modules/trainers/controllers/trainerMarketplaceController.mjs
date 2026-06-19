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
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../economy/services/financialLedgerService.mjs';

const STAFF_TYPE = 'trainer';

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
              category: 'trainer_marketplace_refresh_burn',
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
 */
export async function hireTrainerFromMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { marketplaceId } = req.body;

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
    const hiringCost = trainerData.sessionRate * 4; // One month of sessions upfront

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.money < hiringCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Hiring costs $${hiringCost} (one month upfront)`,
        data: { required: hiringCost, available: user.money },
      });
    }

    const { newTrainer, updatedUser } = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const trainer = await tx.trainer.create({
          data: {
            userId,
            firstName: trainerData.firstName,
            lastName: trainerData.lastName,
            personality: trainerData.personality,
            skillLevel: trainerData.skillLevel,
            speciality: trainerData.speciality,
            sessionRate: trainerData.sessionRate,
            bio: trainerData.bio,
          },
        });

        // Equoria-hjzwt: atomic debit via shared helper (was inline conditional
        // updateMany after kyrqo). InsufficientFundsError rolls back the tx
        // including the trainer.create above. Helper centralizes the race-safe
        // shape so all 7+ debit sites land on one tested pattern.
        // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
        const userMoneyAfter = await debitMoneyOrThrow(tx, {
          userId,
          amount: hiringCost,
          systemAccount: SYSTEM_ACCOUNT_BURN,
          category: 'trainer_hire_burn',
          description: `Trainer hire fee — ${trainer.firstName} ${trainer.lastName}`,
          metadata: { trainerId: trainer.id, marketplaceId },
        });
        const userUpdate = { money: userMoneyAfter };
        // Equoria-ye2r3: migrated to recordTransactionTx(tx, opts). tx is now
        // structurally required (first arg); balanceAfter is read inside the
        // service from the same tx (caller no longer supplies it), so the
        // debit above and the ledger row share rollback semantics.
        await recordTransactionTx(tx, {
          userId,
          type: 'debit',
          amount: hiringCost,
          category: 'trainer_hire',
          description: `Hired trainer ${trainer.firstName} ${trainer.lastName}`,
          metadata: { trainerId: trainer.id, marketplaceId },
        });

        return { newTrainer: trainer, updatedUser: userUpdate };
      }),
      { message: 'The marketplace is busy right now, please retry in a moment.' },
    );

    // Remove hired trainer from persisted offer list
    const updatedOffers = offers.filter((_, i) => i !== trainerIndex);
    await prisma.staffMarketplaceState.update({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      data: { offers: updatedOffers },
    });

    logger.info(
      `[trainerMarketplace] User ${userId} hired trainer ${newTrainer.id} for $${hiringCost}`,
    );

    res.status(201).json({
      success: true,
      message: 'Trainer hired successfully',
      data: {
        trainer: { ...newTrainer, name: `${newTrainer.firstName} ${newTrainer.lastName}` },
        cost: hiringCost,
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping
    // (above the InsufficientFundsError check so the 503 wins first).
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    if (error instanceof InsufficientFundsError) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient funds at debit time (concurrent hire?)',
        data: null,
      });
    }
    logger.error(`[trainerMarketplace] hireTrainer error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to hire trainer', data: null });
  }
}
