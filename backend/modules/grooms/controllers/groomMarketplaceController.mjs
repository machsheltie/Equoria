/**
 * Groom Marketplace Controller
 * Handles API endpoints for the groom marketplace system
 *
 * Features:
 * - Get available grooms in marketplace
 * - Refresh marketplace (free or premium)
 * - Hire grooms from marketplace
 * - State is persisted in the database (staff_marketplace_state table)
 */

import {
  generateMarketplace,
  needsRefresh,
  getRefreshCost,
  MARKETPLACE_CONFIG,
} from '../../../services/groomMarketplace.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';

const STAFF_TYPE = 'groom';

/**
 * Load (or auto-generate) the persisted marketplace state for a user.
 * If no record exists or the refresh window has expired, a fresh set of
 * offers is generated and stored before returning.
 * @param {string} userId
 * @returns {Promise<{offers: Array, lastRefresh: Date, refreshCount: number}>}
 */
async function loadOrCreateMarketplace(userId) {
  const record = await prisma.staffMarketplaceState.findUnique({
    where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
  });

  if (!record || needsRefresh(record.lastRefresh)) {
    const grooms = generateMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    const updated = await prisma.staffMarketplaceState.upsert({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      create: { userId, staffType: STAFF_TYPE, offers: grooms, refreshCount },
      update: { offers: grooms, lastRefresh: new Date(), refreshCount },
    });
    logger.info(
      `[groomMarketplace] Generated new marketplace for user ${userId} with ${grooms.length} grooms`,
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
 * Get marketplace for a user
 */
export async function getMarketplace(req, res) {
  try {
    const userId = req.user.id;
    logger.info(`[groomMarketplace] Getting marketplace for user ${userId}`);

    const { offers, lastRefresh, refreshCount } = await loadOrCreateMarketplace(userId);

    const nextFreeRefresh = new Date(lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );
    const refreshCost = getRefreshCost(lastRefresh);

    res.status(200).json({
      success: true,
      message: 'Marketplace retrieved successfully',
      data: {
        grooms: offers,
        lastRefresh,
        nextFreeRefresh,
        refreshCost,
        canRefreshFree: refreshCost === 0,
        refreshCount,
      },
    });
  } catch (error) {
    logger.error(`[groomMarketplace] Error getting marketplace: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to get marketplace', data: null });
  }
}

/**
 * Refresh marketplace for a user
 */
export async function refreshMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;
    logger.info(`[groomMarketplace] Refreshing marketplace for user ${userId}, force: ${force}`);

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });
    const refreshCost = getRefreshCost(record?.lastRefresh ?? null);

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
      logger.info(`[groomMarketplace] Charged user ${userId} $${refreshCost} for premium refresh`);
    } else if (refreshCost > 0 && !force) {
      const nextFreeRefresh = record
        ? new Date(
            record.lastRefresh.getTime() +
              MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS * 60 * 60 * 1000,
          )
        : new Date();
      return res.status(400).json({
        success: false,
        message: `Marketplace refresh costs $${refreshCost}. Set force=true to pay for refresh.`,
        data: { cost: refreshCost, nextFreeRefresh },
      });
    }

    const grooms = generateMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    const updated = await prisma.staffMarketplaceState.upsert({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      create: { userId, staffType: STAFF_TYPE, offers: grooms, refreshCount },
      update: { offers: grooms, lastRefresh: new Date(), refreshCount },
    });

    const nextFreeRefresh = new Date(updated.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );

    logger.info(
      `[groomMarketplace] Refreshed marketplace for user ${userId} with ${grooms.length} new grooms`,
    );

    res.status(200).json({
      success: true,
      message: 'Marketplace refreshed successfully',
      data: {
        grooms: updated.offers,
        lastRefresh: updated.lastRefresh,
        nextFreeRefresh,
        refreshCost: 0,
        canRefreshFree: true,
        refreshCount: updated.refreshCount,
        paidRefresh: refreshCost > 0,
      },
    });
  } catch (error) {
    logger.error(`[groomMarketplace] Error refreshing marketplace: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to refresh marketplace', data: null });
  }
}

/**
 * Hire a groom from the marketplace
 */
export async function hireFromMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { marketplaceId } = req.body;

    if (!marketplaceId) {
      return res
        .status(400)
        .json({ success: false, message: 'marketplaceId is required', data: null });
    }

    logger.info(`[groomMarketplace] User ${userId} attempting to hire groom ${marketplaceId}`);

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
    const groomIndex = offers.findIndex(g => g.marketplaceId === marketplaceId);
    if (groomIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Groom not found in marketplace', data: null });
    }

    const groomData = offers[groomIndex];
    const hiringCost = groomData.sessionRate * 7; // One week upfront

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

    const { newGroom, updatedUser } = await prisma.$transaction(async tx => {
      const groom = await tx.groom.create({
        data: {
          userId,
          name: `${groomData.firstName} ${groomData.lastName}`,
          speciality: groomData.specialty,
          skillLevel: groomData.skillLevel,
          personality: groomData.personality,
          experience: groomData.experience,
          sessionRate: Number(groomData.sessionRate),
          bio: groomData.bio,
          availability: JSON.stringify({ available: true }),
          hiredDate: new Date(),
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
          category: 'groom_hire',
          description: `Hired groom ${groom.name}`,
          balanceAfter: userUpdate.money,
          metadata: { groomId: groom.id, marketplaceId },
        },
        tx,
      );

      return { newGroom: groom, updatedUser: userUpdate };
    });

    // Remove hired groom from persisted offer list
    const updatedOffers = offers.filter((_, i) => i !== groomIndex);
    await prisma.staffMarketplaceState.update({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      data: { offers: updatedOffers },
    });

    logger.info(`[groomMarketplace] User ${userId} hired groom ${newGroom.id} for $${hiringCost}`);

    res.status(201).json({
      success: true,
      message: 'Groom hired successfully',
      data: {
        groom: { ...newGroom, sessionRate: Number(newGroom.sessionRate) },
        cost: hiringCost,
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    logger.error(`[groomMarketplace] Error hiring groom: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to hire groom', data: null });
  }
}

/**
 * Test-only helper: backdates a user's marketplace lastRefresh to Unix epoch
 * so the free-refresh window appears expired immediately, eliminating real-time waits.
 * No-op outside of test environment.
 * @param {string} userId - The user whose marketplace to expire
 */
export async function forceExpireMarketplace(userId) {
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  await prisma.staffMarketplaceState.updateMany({
    where: { userId, staffType: STAFF_TYPE },
    data: { lastRefresh: new Date(0) },
  });
}

/**
 * Get marketplace statistics
 */
export async function getMarketplaceStats(req, res) {
  try {
    const userId = req.user.id;

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });

    if (!record) {
      return res.status(200).json({
        success: true,
        message: 'No marketplace data available',
        data: {
          totalGrooms: 0,
          lastRefresh: 'never',
          refreshCount: 0,
          qualityDistribution: {},
          specialtyDistribution: {},
        },
      });
    }

    const offers = Array.isArray(record.offers) ? record.offers : [];
    const qualityDistribution = {};
    const specialtyDistribution = {};

    offers.forEach(groom => {
      qualityDistribution[groom.skillLevel] = (qualityDistribution[groom.skillLevel] || 0) + 1;
      specialtyDistribution[groom.specialty] = (specialtyDistribution[groom.specialty] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      message: 'Marketplace statistics retrieved successfully',
      data: {
        totalGrooms: offers.length,
        lastRefresh: record.lastRefresh,
        refreshCount: record.refreshCount,
        qualityDistribution,
        specialtyDistribution,
        config: {
          refreshIntervalHours: MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
          premiumRefreshCost: MARKETPLACE_CONFIG.PREMIUM_REFRESH_COST,
          defaultSize: MARKETPLACE_CONFIG.DEFAULT_MARKETPLACE_SIZE,
        },
      },
    });
  } catch (error) {
    logger.error(`[groomMarketplace] Error getting marketplace stats: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get marketplace statistics', data: null });
  }
}
