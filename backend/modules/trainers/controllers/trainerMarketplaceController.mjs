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
} from '../../../services/trainerMarketplace.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';

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
      await prisma.user.update({
        where: { id: userId },
        data: { money: { decrement: refreshCost } },
      });
    } else if (refreshCost > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `Marketplace refresh costs $${refreshCost}. Set force=true to pay for refresh.`,
        data: { cost: refreshCost },
      });
    }

    const trainers = generateTrainerMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    const updated = await prisma.staffMarketplaceState.upsert({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      create: { userId, staffType: STAFF_TYPE, offers: trainers, refreshCount },
      update: { offers: trainers, lastRefresh: new Date(), refreshCount },
    });

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

    const { newTrainer, updatedUser } = await prisma.$transaction(async tx => {
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

      const userUpdate = await tx.user.update({
        where: { id: userId },
        data: { money: { decrement: hiringCost } },
        select: { money: true },
      });
      await recordTransaction(
        {
          userId,
          type: 'debit',
          amount: hiringCost,
          category: 'trainer_hire',
          description: `Hired trainer ${trainer.firstName} ${trainer.lastName}`,
          balanceAfter: userUpdate.money,
          metadata: { trainerId: trainer.id, marketplaceId },
        },
        tx,
      );

      return { newTrainer: trainer, updatedUser: userUpdate };
    });

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
    logger.error(`[trainerMarketplace] hireTrainer error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to hire trainer', data: null });
  }
}
