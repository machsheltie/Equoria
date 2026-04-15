/**
 * Rider Marketplace Controller
 * Handles GET /marketplace, POST /marketplace/hire, POST /marketplace/refresh.
 *
 * State is persisted in the database (staff_marketplace_state table, staffType='rider').
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

const STAFF_TYPE = 'rider';

/**
 * Load (or auto-generate) the persisted marketplace state for a user.
 */
async function loadOrCreateMarketplace(userId) {
  const record = await prisma.staffMarketplaceState.findUnique({
    where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
  });

  if (!record || riderMarketplaceNeedsRefresh(record.lastRefresh)) {
    const riders = generateRiderMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    const updated = await prisma.staffMarketplaceState.upsert({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      create: { userId, staffType: STAFF_TYPE, offers: riders, refreshCount },
      update: { offers: riders, lastRefresh: new Date(), refreshCount },
    });
    logger.info(
      `[riderMarketplace] Generated new marketplace for user ${userId} with ${riders.length} riders`,
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
 * GET /api/riders/marketplace
 */
export async function getRiderMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { offers, lastRefresh, refreshCount } = await loadOrCreateMarketplace(userId);

    const nextFreeRefresh = new Date(lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );
    const refreshCost = getRiderRefreshCost(lastRefresh);

    res.status(200).json({
      success: true,
      message: 'Rider marketplace retrieved successfully',
      data: {
        riders: offers,
        lastRefresh,
        nextFreeRefresh,
        refreshCost,
        canRefreshFree: refreshCost === 0,
        refreshCount,
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

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });
    const refreshCost = getRiderRefreshCost(record?.lastRefresh ?? null);

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
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    const updated = await prisma.staffMarketplaceState.upsert({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      create: { userId, staffType: STAFF_TYPE, offers: riders, refreshCount },
      update: { offers: riders, lastRefresh: new Date(), refreshCount },
    });

    const nextFreeRefresh = new Date(updated.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );

    res.status(200).json({
      success: true,
      message: 'Rider marketplace refreshed successfully',
      data: {
        riders: updated.offers,
        lastRefresh: updated.lastRefresh,
        nextFreeRefresh,
        refreshCost: 0,
        canRefreshFree: true,
        refreshCount: updated.refreshCount,
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

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No marketplace found. Please refresh marketplace first.',
        data: null,
      });
    }

    const offers = Array.isArray(record.offers) ? record.offers : [];
    const riderIndex = offers.findIndex(r => r.marketplaceId === marketplaceId);
    if (riderIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Rider not found in marketplace', data: null });
    }

    const riderData = offers[riderIndex];
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

    recordTransaction({
      userId,
      type: 'debit',
      amount: hiringCost,
      category: 'rider_hire',
      description: `Hired rider ${newRider.firstName} ${newRider.lastName}`,
      balanceAfter: updatedUser.money,
      metadata: { riderId: newRider.id, marketplaceId },
    }).catch(err => logger.error(`[riderMarketplace] ledger error: ${err.message}`));

    // Remove hired rider from persisted offer list
    const updatedOffers = offers.filter((_, i) => i !== riderIndex);
    await prisma.staffMarketplaceState.update({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      data: { offers: updatedOffers },
    });

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
