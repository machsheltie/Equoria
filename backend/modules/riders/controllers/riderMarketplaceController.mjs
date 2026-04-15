/**
 * Rider Marketplace Controller
 * Handles GET /marketplace, POST /marketplace/hire, POST /marketplace/refresh.
 *
 * In-memory store per user (mirrors groomMarketplaceController.mjs pattern).
 * In production this would be backed by Redis or a DB table.
 */

import {
  generateRiderMarketplace,
  riderMarketplaceNeedsRefresh,
  getRiderRefreshCost,
  RIDER_MARKETPLACE_CONFIG,
} from '../../../services/riderMarketplace.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';

// In-memory marketplace storage per user
const userRiderMarketplaces = new Map();

/**
 * GET /api/riders/marketplace
 */
export async function getRiderMarketplace(req, res) {
  try {
    const userId = req.user.id;
    let userMarketplace = userRiderMarketplaces.get(userId);

    if (!userMarketplace || riderMarketplaceNeedsRefresh(userMarketplace.lastRefresh)) {
      const riders = generateRiderMarketplace();
      userMarketplace = {
        riders,
        lastRefresh: new Date(),
        refreshCount: (userMarketplace?.refreshCount || 0) + 1,
      };
      userRiderMarketplaces.set(userId, userMarketplace);
      logger.info(
        `[riderMarketplace] Generated new marketplace for user ${userId} with ${riders.length} riders`,
      );
    }

    const nextFreeRefresh = new Date(userMarketplace.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );
    const refreshCost = getRiderRefreshCost(userMarketplace.lastRefresh);

    res.status(200).json({
      success: true,
      message: 'Rider marketplace retrieved successfully',
      data: {
        riders: userMarketplace.riders,
        lastRefresh: userMarketplace.lastRefresh,
        nextFreeRefresh,
        refreshCost,
        canRefreshFree: refreshCost === 0,
        refreshCount: userMarketplace.refreshCount,
      },
    });
  } catch (error) {
    logger.error(`[riderMarketplace] Error getting marketplace: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get rider marketplace', data: null });
  }
}

/**
 * POST /api/riders/marketplace/refresh
 */
export async function refreshRiderMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;
    const userMarketplace = userRiderMarketplaces.get(userId);
    const refreshCost = getRiderRefreshCost(userMarketplace?.lastRefresh);

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

    const riders = generateRiderMarketplace();
    const newMarketplace = {
      riders,
      lastRefresh: new Date(),
      refreshCount: (userMarketplace?.refreshCount || 0) + 1,
    };
    userRiderMarketplaces.set(userId, newMarketplace);

    const nextFreeRefresh = new Date(newMarketplace.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );

    res.status(200).json({
      success: true,
      message: 'Rider marketplace refreshed successfully',
      data: {
        riders: newMarketplace.riders,
        lastRefresh: newMarketplace.lastRefresh,
        nextFreeRefresh,
        refreshCost: 0,
        canRefreshFree: true,
        refreshCount: newMarketplace.refreshCount,
      },
    });
  } catch (error) {
    logger.error(`[riderMarketplace] Error refreshing marketplace: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to refresh rider marketplace', data: null });
  }
}

/**
 * POST /api/riders/marketplace/hire
 */
export async function hireRiderFromMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { marketplaceId } = req.body;

    if (!marketplaceId) {
      return res
        .status(400)
        .json({ success: false, message: 'marketplaceId is required', data: null });
    }

    const userMarketplace = userRiderMarketplaces.get(userId);
    if (!userMarketplace) {
      return res.status(404).json({
        success: false,
        message: 'No marketplace found. Please refresh marketplace first.',
        data: null,
      });
    }

    const riderIndex = userMarketplace.riders.findIndex(r => r.marketplaceId === marketplaceId);
    if (riderIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Rider not found in marketplace', data: null });
    }

    const riderData = userMarketplace.riders[riderIndex];
    const hiringCost = riderData.weeklyRate; // One week upfront

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.money < hiringCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Hiring costs $${hiringCost} (one week upfront)`,
        data: { required: hiringCost, available: user.money },
      });
    }

    const newRider = await prisma.rider.create({
      data: {
        userId,
        firstName: riderData.firstName,
        lastName: riderData.lastName,
        personality: riderData.personality,
        skillLevel: riderData.skillLevel,
        speciality: riderData.speciality,
        weeklyRate: riderData.weeklyRate,
        experience: riderData.experience,
        bio: riderData.bio,
      },
    });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { money: { decrement: hiringCost } },
      select: { money: true },
    });

    // Record financial transaction as best-effort (non-blocking)
    recordTransaction({
      userId,
      type: 'debit',
      amount: hiringCost,
      category: 'rider_hire',
      description: `Hired rider ${newRider.firstName} ${newRider.lastName}`,
      balanceAfter: updatedUser.money,
      metadata: { riderId: newRider.id, marketplaceId },
    }).catch(err => logger.error(`[riderMarketplace] ledger error: ${err.message}`));

    userMarketplace.riders.splice(riderIndex, 1);
    userRiderMarketplaces.set(userId, userMarketplace);

    logger.info(`[riderMarketplace] User ${userId} hired rider ${newRider.id} for $${hiringCost}`);

    res.status(201).json({
      success: true,
      message: 'Rider hired successfully',
      data: {
        rider: { ...newRider, name: `${newRider.firstName} ${newRider.lastName}` },
        cost: hiringCost,
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    logger.error(`[riderMarketplace] Error hiring rider: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to hire rider', data: null });
  }
}
