/**
 * Trainer Marketplace Controller
 * Handles GET /marketplace, POST /marketplace/hire, POST /marketplace/refresh.
 */

import {
  generateTrainerMarketplace,
  trainerMarketplaceNeedsRefresh,
  getTrainerRefreshCost,
  TRAINER_MARKETPLACE_CONFIG,
} from '../../../services/trainerMarketplace.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

const userTrainerMarketplaces = new Map();

/**
 * GET /api/trainers/marketplace
 */
export async function getTrainerMarketplace(req, res) {
  try {
    const userId = req.user.id;
    let userMarketplace = userTrainerMarketplaces.get(userId);

    if (!userMarketplace || trainerMarketplaceNeedsRefresh(userMarketplace.lastRefresh)) {
      const trainers = generateTrainerMarketplace();
      userMarketplace = {
        trainers,
        lastRefresh: new Date(),
        refreshCount: (userMarketplace?.refreshCount || 0) + 1,
      };
      userTrainerMarketplaces.set(userId, userMarketplace);
    }

    const nextFreeRefresh = new Date(userMarketplace.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );
    const refreshCost = getTrainerRefreshCost(userMarketplace.lastRefresh);

    res.status(200).json({
      success: true,
      message: 'Trainer marketplace retrieved successfully',
      data: {
        trainers: userMarketplace.trainers,
        lastRefresh: userMarketplace.lastRefresh,
        nextFreeRefresh,
        refreshCost,
        canRefreshFree: refreshCost === 0,
        refreshCount: userMarketplace.refreshCount,
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
    const userMarketplace = userTrainerMarketplaces.get(userId);
    const refreshCost = getTrainerRefreshCost(userMarketplace?.lastRefresh);

    if (refreshCost > 0 && force) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
      if (!user)
        return res.status(404).json({ success: false, message: 'User not found', data: null });
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
    const newMarketplace = {
      trainers,
      lastRefresh: new Date(),
      refreshCount: (userMarketplace?.refreshCount || 0) + 1,
    };
    userTrainerMarketplaces.set(userId, newMarketplace);

    const nextFreeRefresh = new Date(newMarketplace.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + TRAINER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );

    res.status(200).json({
      success: true,
      message: 'Trainer marketplace refreshed successfully',
      data: {
        trainers: newMarketplace.trainers,
        lastRefresh: newMarketplace.lastRefresh,
        nextFreeRefresh,
        refreshCost: 0,
        canRefreshFree: true,
        refreshCount: newMarketplace.refreshCount,
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

    const userMarketplace = userTrainerMarketplaces.get(userId);
    if (!userMarketplace) {
      return res.status(404).json({
        success: false,
        message: 'No marketplace found. Please refresh first.',
        data: null,
      });
    }

    const trainerIndex = userMarketplace.trainers.findIndex(t => t.marketplaceId === marketplaceId);
    if (trainerIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Trainer not found in marketplace', data: null });
    }

    const trainerData = userMarketplace.trainers[trainerIndex];
    const hiringCost = trainerData.sessionRate * 4; // One month of sessions upfront

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found', data: null });

    if (user.money < hiringCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Hiring costs $${hiringCost} (one month upfront)`,
        data: { required: hiringCost, available: user.money },
      });
    }

    const newTrainer = await prisma.trainer.create({
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

    await prisma.user.update({ where: { id: userId }, data: { money: { decrement: hiringCost } } });

    userMarketplace.trainers.splice(trainerIndex, 1);
    userTrainerMarketplaces.set(userId, userMarketplace);

    logger.info(
      `[trainerMarketplace] User ${userId} hired trainer ${newTrainer.id} for $${hiringCost}`,
    );

    res.status(201).json({
      success: true,
      message: 'Trainer hired successfully',
      data: {
        trainer: { ...newTrainer, name: `${newTrainer.firstName} ${newTrainer.lastName}` },
        cost: hiringCost,
        remainingMoney: user.money - hiringCost,
      },
    });
  } catch (error) {
    logger.error(`[trainerMarketplace] hireTrainer error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to hire trainer', data: null });
  }
}
