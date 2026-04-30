/**
 * Horse Feed Controller (feed-system redesign 2026-04-29, Equoria-wr30).
 *
 * Provides per-horse equip/unequip handlers for the new pooled-inventory feed
 * model. Inventory lives on User.settings.inventory; the equipped tier is
 * persisted on Horse.equippedFeedType.
 *
 * Routes:
 *   POST /api/horses/:id/equip-feed   → set Horse.equippedFeedType
 *   POST /api/horses/:id/unequip-feed → clear Horse.equippedFeedType
 *
 * Ownership is enforced inside this controller (not via requireOwnership
 * middleware) so we can return 403 for non-owners while still surfacing 404
 * for genuinely missing horses.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { FEED_CATALOG } from '../../services/controllers/feedShopController.mjs';

const VALID_TIERS = new Set(FEED_CATALOG.map(t => t.id));

/**
 * Read inventory array from User.settings, defaulting to empty array.
 */
function getInventory(settings) {
  if (!settings || typeof settings !== 'object') return [];
  return Array.isArray(settings.inventory) ? settings.inventory : [];
}

/**
 * Look up the horse and verify ownership in a single query path.
 * Returns either { horse } on success or { error: { status, message } }.
 */
async function ownerCheck(rawHorseId, userId) {
  const horseId = Number(rawHorseId);
  if (!Number.isInteger(horseId) || horseId < 1) {
    return { error: { status: 400, message: 'Invalid horse id' } };
  }
  const horse = await prisma.horse.findUnique({ where: { id: horseId } });
  if (!horse) {
    return { error: { status: 404, message: 'Horse not found' } };
  }
  if (horse.userId !== userId) {
    return { error: { status: 403, message: 'Not the owner of this horse' } };
  }
  return { horse };
}

/**
 * POST /api/horses/:id/equip-feed
 * Body: { feedType }
 *
 * Sets Horse.equippedFeedType when:
 *  - feedType is one of the 5 catalog tiers
 *  - the authenticated user owns the horse (else 403)
 *  - the user has at least 1 unit of feed-{feedType} in their pooled inventory
 */
export async function equipFeedHandler(req, res) {
  try {
    const userId = req.user.id;
    const { feedType } = req.body || {};

    if (!VALID_TIERS.has(feedType)) {
      return res.status(400).json({ success: false, message: 'Invalid feed tier', data: null });
    }

    const check = await ownerCheck(req.params.id, userId);
    if (check.error) {
      return res
        .status(check.error.status)
        .json({ success: false, message: check.error.message, data: null });
    }

    const ownerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const inventory = getInventory(ownerUser?.settings);
    const owned = inventory.find(i => i.id === `feed-${feedType}`);
    if (!owned || !Number.isFinite(owned.quantity) || owned.quantity < 1) {
      return res.status(400).json({
        success: false,
        message: `You don't own any ${feedType} feed.`,
        data: null,
      });
    }

    await prisma.horse.update({
      where: { id: check.horse.id },
      data: { equippedFeedType: feedType },
    });

    logger.info(
      `[horseFeedController.equipFeed] User ${userId} equipped ${feedType} on horse ${check.horse.id}`,
    );

    return res.status(200).json({
      success: true,
      message: `Equipped ${feedType}`,
      data: { horseId: check.horse.id, equippedFeedType: feedType },
    });
  } catch (error) {
    logger.error(`[horseFeedController.equipFeed] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to equip feed', data: null });
  }
}

/**
 * POST /api/horses/:id/unequip-feed
 *
 * Clears Horse.equippedFeedType for an owned horse. No body required.
 */
export async function unequipFeedHandler(req, res) {
  try {
    const userId = req.user.id;
    const check = await ownerCheck(req.params.id, userId);
    if (check.error) {
      return res
        .status(check.error.status)
        .json({ success: false, message: check.error.message, data: null });
    }

    await prisma.horse.update({
      where: { id: check.horse.id },
      data: { equippedFeedType: null },
    });

    logger.info(
      `[horseFeedController.unequipFeed] User ${userId} unequipped feed on horse ${check.horse.id}`,
    );

    return res.status(200).json({
      success: true,
      message: 'Unequipped feed',
      data: { horseId: check.horse.id, equippedFeedType: null },
    });
  } catch (error) {
    logger.error(`[horseFeedController.unequipFeed] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to unequip feed', data: null });
  }
}
