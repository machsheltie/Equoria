/**
 * Tack Shop Controller
 * Handles tack shop: listing inventory and purchasing items.
 *
 * Uses existing Horse.tack (Json) field — no schema changes required (Phase 1).
 *
 * Routes:
 *   GET  /api/tack-shop/inventory   → list available tack items
 *   POST /api/tack-shop/purchase    → purchase an item for a horse
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

// Tack inventory catalog
export const TACK_INVENTORY = [
  {
    id: 'dressage-saddle',
    category: 'saddle',
    name: 'Dressage Saddle',
    description:
      'Deep-seated saddle designed for precision movements. Enhances rider position in dressage disciplines.',
    cost: 800,
    bonus: '+5% dressage score',
    disciplines: ['Dressage'],
  },
  {
    id: 'jumping-saddle',
    category: 'saddle',
    name: 'Jump Saddle',
    description: 'Forward-cut saddle with knee rolls for optimal balance over fences.',
    cost: 750,
    bonus: '+5% jumping score',
    disciplines: ['Show Jumping', 'Cross-Country'],
  },
  {
    id: 'snaffle-bridle',
    category: 'bridle',
    name: 'Snaffle Bridle',
    description: 'Classic English bridle with snaffle bit. Suitable for training and competition.',
    cost: 200,
    bonus: '+2% obedience',
    disciplines: ['Dressage', 'Show Jumping'],
  },
  {
    id: 'hackamore',
    category: 'bridle',
    name: 'Hackamore',
    description: 'Bitless bridle offering gentle control. Popular in western and trail riding.',
    cost: 180,
    bonus: '+2% comfort score',
    disciplines: ['Western Pleasure', 'Endurance'],
  },
];

/**
 * GET /api/tack-shop/inventory
 */
export async function getTackInventory(_req, res) {
  const categories = {
    saddles: TACK_INVENTORY.filter(i => i.category === 'saddle'),
    bridles: TACK_INVENTORY.filter(i => i.category === 'bridle'),
  };

  res.status(200).json({
    success: true,
    message: 'Tack inventory retrieved successfully',
    data: {
      items: TACK_INVENTORY,
      categories,
    },
  });
}

/**
 * POST /api/tack-shop/purchase
 * Body: { horseId, itemId }
 */
export async function purchaseTackItem(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, itemId } = req.body;

    const item = TACK_INVENTORY.find(i => i.id === itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: 'Item not found in inventory', data: null });
    }

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (user.money < item.cost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. ${item.name} costs $${item.cost}`,
        data: { required: item.cost, available: user.money },
      });
    }

    // Merge item into horse.tack JSON
    const currentTack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    const updatedTack = { ...currentTack, [item.category]: item.id };

    const [updatedHorse] = await prisma.$transaction([
      prisma.horse.update({ where: { id: horseId }, data: { tack: updatedTack } }),
      prisma.user.update({ where: { id: userId }, data: { money: { decrement: item.cost } } }),
    ]);

    logger.info(
      `[tackShopController] User ${userId} purchased "${item.name}" for horse ${horseId} — cost $${item.cost}`,
    );

    res.status(200).json({
      success: true,
      message: `${item.name} purchased successfully`,
      data: {
        horse: {
          id: updatedHorse.id,
          name: updatedHorse.name,
          tack: updatedHorse.tack,
        },
        item,
        cost: item.cost,
        remainingMoney: user.money - item.cost,
      },
    });
  } catch (error) {
    logger.error(`[tackShopController] purchaseTackItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase tack item', data: null });
  }
}
