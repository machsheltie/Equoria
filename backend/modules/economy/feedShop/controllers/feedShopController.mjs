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

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';
import {
  recordTransaction,
  debitMoneyOrThrow,
  InsufficientFundsError,
} from '../../services/financialLedgerService.mjs';

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
 * Read inventory array from User.settings, defaulting to empty array.
 */
function getInventoryFromSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
  return Array.isArray(settings.inventory) ? settings.inventory : [];
}

/**
 * POST /api/feed-shop/purchase
 * Body: { feedTier, packs }
 *
 * Bulk pack purchase. Each pack = 100 units. No per-horse application.
 * Inventory is pooled in User.settings.inventory.
 */
export async function purchaseFeed(req, res) {
  try {
    const userId = req.user.id;
    const { feedTier, packs } = req.body;

    const tier = FEED_CATALOG.find(f => f.id === feedTier);
    if (!tier) {
      return res
        .status(404)
        .json({ success: false, message: 'Feed tier not found in catalog', data: null });
    }

    if (!Number.isInteger(packs) || packs < 1) {
      return res
        .status(400)
        .json({ success: false, message: 'packs must be an integer ≥ 1', data: null });
    }

    const totalCost = tier.packPrice * packs;
    const totalUnits = 100 * packs;

    // Equoria-6g8wm: atomic money debit through the shared helper. The
    // settings (inventory) update still needs the read-modify-write inside
    // the tx because JSONB inventory is not a simple counter. The money
    // debit is now atomic; the settings update is conventional (no
    // concurrent-write race for THIS user's inventory at the granularity
    // the game UI exposes, but if one ever lands, the existing single-
    // writer-per-user assumption is broken and a separate refactor is
    // needed for inventory CRDTs — out of scope here).
    let result;
    try {
      result = await prisma.$transaction(async tx => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { settings: true },
        });
        if (!user) {
          const err = new Error('User not found');
          err.status = 404;
          throw err;
        }

        // Atomic debit FIRST — if the helper throws, the tx unwinds and
        // the settings update below never runs.
        const remainingMoney = await debitMoneyOrThrow(tx, { userId, amount: totalCost });

        const settings =
          user.settings && typeof user.settings === 'object' ? { ...user.settings } : {};
        const inventory = getInventoryFromSettings(settings).map(item => ({ ...item }));
        const existingIdx = inventory.findIndex(item => item.id === `feed-${tier.id}`);

        let inventoryItem;
        if (existingIdx >= 0) {
          inventoryItem = {
            ...inventory[existingIdx],
            quantity: inventory[existingIdx].quantity + totalUnits,
          };
          inventory[existingIdx] = inventoryItem;
        } else {
          inventoryItem = {
            id: `feed-${tier.id}`,
            itemId: tier.id,
            category: 'feed',
            name: tier.name,
            quantity: totalUnits,
          };
          inventory.push(inventoryItem);
        }

        await tx.user.update({
          where: { id: userId },
          data: { settings: { ...settings, inventory } },
        });

        await recordTransaction(
          {
            userId,
            type: 'debit',
            amount: totalCost,
            category: 'feed_purchase',
            description: `${packs} pack(s) of ${tier.name}`,
            balanceAfter: remainingMoney,
            metadata: { feedTier: tier.id, packs, totalUnits },
          },
          tx,
        );

        return { remainingMoney, inventoryItem };
      });
    } catch (txErr) {
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. ${packs} pack(s) of ${tier.name} cost ${totalCost} coins.`,
          data: null,
        });
      }
      throw txErr;
    }

    logger.info(
      `[feedShopController] User ${userId} purchased ${packs} pack(s) of ${tier.name} — ${totalUnits} units, ${totalCost} coins`,
    );

    res.status(200).json({
      success: true,
      message: `Purchased ${totalUnits} units of ${tier.name}.`,
      data: result,
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[feedShopController] purchaseFeed error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase feed', data: null });
  }
}
