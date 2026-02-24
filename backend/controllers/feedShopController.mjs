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

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

// Feed catalog
export const FEED_CATALOG = [
  {
    id: 'basic',
    name: 'Basic Feed',
    description:
      'Standard hay and grain mix suitable for everyday maintenance. Keeps your horse in good condition.',
    billing: 'per week',
    cost: 50,
    energyBoost: 10,
    feedType: 'basic',
  },
  {
    id: 'performance',
    name: 'Performance Mix',
    description:
      'High-energy blend with added electrolytes and protein for horses in active competition training.',
    billing: 'per week',
    cost: 120,
    energyBoost: 25,
    feedType: 'performance',
  },
  {
    id: 'vitamin',
    name: 'Supplement Package',
    description:
      'Vitamin and mineral supplements to support overall health, coat quality, and immune function.',
    billing: 'per week',
    cost: 80,
    energyBoost: 15,
    feedType: 'vitamin',
  },
  {
    id: 'diet-plan',
    name: 'Diet Plan',
    description:
      'Veterinarian-recommended diet for weight management, senior horses, or special dietary needs.',
    billing: 'per week',
    cost: 100,
    energyBoost: 20,
    feedType: 'diet-plan',
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

    const [updatedHorse] = await prisma.$transaction([
      prisma.horse.update({
        where: { id: horseId },
        data: {
          currentFeed: feed.feedType,
          lastFedDate: new Date(),
          energyLevel: newEnergy,
        },
      }),
      prisma.user.update({ where: { id: userId }, data: { money: { decrement: feed.cost } } }),
    ]);

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
        remainingMoney: user.money - feed.cost,
      },
    });
  } catch (error) {
    logger.error(`[feedShopController] purchaseFeed error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase feed', data: null });
  }
}
