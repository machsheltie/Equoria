/**
 * Feed Shop Controller
 * Handles feed shop: listing catalog and purchasing feed.
 *
 * Uses new Horse fields: currentFeed, lastFedDate, energyLevel.
 *
 * Routes:
 *   GET  /api/feed-shop/catalog  → list available feeds
 *   POST /api/feed-shop/purchase → purchase feed for a horse
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';

// 5-tier feed catalog (feed-system redesign 2026-04-29).
// All packs sold in 100-unit increments only. Per spec §5.5.
export const FEED_CATALOG = [
  {
    id: 'basic',
    name: 'Basic Feed',
    description: 'Standard hay-and-grain mix. Prevents the no-feed penalty. No bonus.',
    packPrice: 100,
    perUnit: 1.0,
    statRollPct: 0,
    pregnancyBonusPct: 0,
  },
  {
    id: 'performance',
    name: 'Performance Feed',
    description:
      'Active-rider blend with electrolytes. 10% chance per feeding to boost a random stat by 1.',
    packPrice: 125,
    perUnit: 1.25,
    statRollPct: 10,
    pregnancyBonusPct: 5,
  },
  {
    id: 'performancePlus',
    name: 'Performance Plus Feed',
    description: 'Enriched protein blend. 15% chance per feeding to boost a random stat by 1.',
    packPrice: 150,
    perUnit: 1.5,
    statRollPct: 15,
    pregnancyBonusPct: 10,
  },
  {
    id: 'highPerformance',
    name: 'High Performance Feed',
    description: 'Competition-grade nutrition. 20% chance per feeding to boost a random stat by 1.',
    packPrice: 175,
    perUnit: 1.75,
    statRollPct: 20,
    pregnancyBonusPct: 15,
  },
  {
    id: 'elite',
    name: 'Elite Feed',
    description: 'Top-tier specialised blend. 25% chance per feeding to boost a random stat by 1.',
    packPrice: 200,
    perUnit: 2.0,
    statRollPct: 25,
    pregnancyBonusPct: 20,
  },
];

/**
 * GET /api/feed-shop/catalog
 */
export async function getFeedCatalog(_req, res) {
  res.status(200).json({
    success: true,
    message: 'Feed catalog retrieved successfully',
    data: FEED_CATALOG,
  });
}

/**
 * POST /api/feed-shop/purchase
 * Body: { horseId, feedId }
 */
export async function purchaseFeed(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, feedId } = req.body;

    const feed = FEED_CATALOG.find(f => f.id === feedId);
    if (!feed) {
      return res
        .status(404)
        .json({ success: false, message: 'Feed not found in catalog', data: null });
    }

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.money < feed.cost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. ${feed.name} costs $${feed.cost}`,
        data: { required: feed.cost, available: user.money },
      });
    }

    // Cap energyLevel at 100
    const currentEnergy = horse.energyLevel ?? 100;
    const newEnergy = Math.min(100, currentEnergy + feed.energyBoost);

    const { updatedHorse, updatedUser } = await prisma.$transaction(async tx => {
      const horseUpdate = await tx.horse.update({
        where: { id: horseId },
        data: {
          currentFeed: feed.feedType,
          lastFedDate: new Date(),
          energyLevel: newEnergy,
        },
      });
      const userUpdate = await tx.user.update({
        where: { id: userId },
        data: { money: { decrement: feed.cost } },
        select: { money: true },
      });
      await recordTransaction(
        {
          userId,
          type: 'debit',
          amount: feed.cost,
          category: 'feed_purchase',
          description: `${feed.name} for ${horse.name}`,
          balanceAfter: userUpdate.money,
          metadata: { horseId, feedId },
        },
        tx,
      );
      return { updatedHorse: horseUpdate, updatedUser: userUpdate };
    });

    logger.info(
      `[feedShopController] User ${userId} purchased "${feed.name}" for horse ${horseId} — cost $${feed.cost}`,
    );

    res.status(200).json({
      success: true,
      message: `${feed.name} purchased successfully`,
      data: {
        horse: {
          id: updatedHorse.id,
          name: updatedHorse.name,
          currentFeed: updatedHorse.currentFeed,
          lastFedDate: updatedHorse.lastFedDate,
          energyLevel: updatedHorse.energyLevel,
        },
        feed,
        cost: feed.cost,
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    logger.error(`[feedShopController] purchaseFeed error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase feed', data: null });
  }
}
