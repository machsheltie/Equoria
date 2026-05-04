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
 * Ownership is enforced by the requireOwnership('horse') middleware on the
 * route, which sets req.horse and returns 404 (CWE-639 disclosure
 * resistance) for both "not found" and "not owned by caller". The handlers
 * therefore only need to handle the inventory check (equip) and the actual
 * persistence.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { FEED_CATALOG } from '../../services/controllers/feedShopController.mjs';
import { feedHorse } from '../services/horseFeedService.mjs';

const VALID_TIERS = new Set(FEED_CATALOG.map(t => t.id));

/**
 * Read inventory array from User.settings, defaulting to empty array.
 */
function getInventory(settings) {
  if (!settings || typeof settings !== 'object') return [];
  return Array.isArray(settings.inventory) ? settings.inventory : [];
}

/**
 * POST /api/horses/:id/equip-feed
 * Body: { feedType }
 *
 * Sets Horse.equippedFeedType when:
 *  - feedType is one of the 5 catalog tiers
 *  - the user has at least 1 unit of feed-{feedType} in their pooled inventory
 *
 * Ownership of the horse is already enforced by requireOwnership middleware
 * (req.horse is the owned horse). 404 for missing/not-owned (no disclosure).
 */
export async function equipFeedHandler(req, res) {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const { feedType } = body;

    if (typeof feedType !== 'string' || feedType.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'feedType is required',
        data: null,
      });
    }
    if (!VALID_TIERS.has(feedType)) {
      return res.status(400).json({
        success: false,
        message: `Unknown feed tier: ${feedType}`,
        data: null,
      });
    }

    const horse = req.horse;

    const ownerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const inventory = getInventory(ownerUser?.settings);
    const owned = inventory.find(i => i.id === `feed-${feedType}`);
    // Equip is a preference flag, not a reservation: inventory is decremented at feed-time (A8),
    // not here. A user with 1 unit of a tier can equip that tier on N horses; the consumption
    // happens when each horse is fed. This is intentional per the feed-system spec.
    if (!owned || !Number.isFinite(owned.quantity) || owned.quantity < 1) {
      return res.status(400).json({
        success: false,
        message: `You don't own any ${feedType} feed.`,
        data: null,
      });
    }

    await prisma.horse.update({
      where: { id: horse.id },
      data: { equippedFeedType: feedType },
    });

    logger.info(
      `[horseFeedController.equipFeed] User ${userId} equipped ${feedType} on horse ${horse.id}`,
    );

    return res.status(200).json({
      success: true,
      message: `Equipped ${feedType}`,
      data: { horseId: horse.id, equippedFeedType: feedType },
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
 * Ownership enforced by requireOwnership middleware.
 */
export async function unequipFeedHandler(req, res) {
  try {
    const userId = req.user.id;
    const horse = req.horse;

    await prisma.horse.update({
      where: { id: horse.id },
      data: { equippedFeedType: null },
    });

    logger.info(
      `[horseFeedController.unequipFeed] User ${userId} unequipped feed on horse ${horse.id}`,
    );

    return res.status(200).json({
      success: true,
      message: 'Unequipped feed',
      data: { horseId: horse.id, equippedFeedType: null },
    });
  } catch (error) {
    logger.error(`[horseFeedController.unequipFeed] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to unequip feed', data: null });
  }
}

/**
 * GET /api/horses/:id/equippable
 *
 * Returns the items the user can equip on this horse:
 *   - tack (saddle, bridle, etc.): items NOT currently equipped to a
 *     DIFFERENT horse. Items unowned OR already on this horse are kept.
 *   - feed (all 5 tiers in the user's inventory with quantity > 0):
 *     each entry includes `isCurrentlyEquippedToThisHorse` so the UI can
 *     mark the active tier without needing to fetch the horse separately.
 *
 * Ownership enforced by requireOwnership('horse') middleware (404 for
 * missing/not-owned, CWE-639). req.horse is the owned horse.
 */
export async function getEquippableHandler(req, res) {
  try {
    const userId = req.user.id;
    const horse = req.horse;

    const ownerUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const inventory = getInventory(ownerUser?.settings);

    const tack = inventory
      .filter(i => i.category !== 'feed')
      .filter(i => i.equippedToHorseId == null || i.equippedToHorseId === horse.id);

    const feed = inventory
      .filter(i => i.category === 'feed')
      .filter(i => Number.isFinite(i.quantity) && i.quantity > 0)
      .map(i => ({
        feedType: i.itemId,
        name: i.name,
        quantity: i.quantity,
        isCurrentlyEquippedToThisHorse: horse.equippedFeedType === i.itemId,
      }));

    return res.status(200).json({
      success: true,
      message: 'Equippable items',
      data: { tack, feed },
    });
  } catch (error) {
    logger.error(`[horseFeedController.getEquippable] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to load equippable items',
      data: null,
    });
  }
}

/**
 * POST /api/horses/:id/feed
 *
 * Daily feed action: transactional inventory decrement, lastFedDate set,
 * stat-boost RNG roll. The service `feedHorse()` is the source of truth
 * for pre-conditions; this handler is a thin HTTP shim that maps the
 * service's status-tagged errors to HTTP responses.
 *
 * Ownership is enforced by requireOwnership('horse') middleware on the
 * route. The service performs a defense-in-depth owner check inside its
 * transaction and returns 404 (not 403) on mismatch (CWE-639).
 */
export async function feedHorseHandler(req, res) {
  try {
    const result = await feedHorse({
      userId: req.user.id,
      horseId: req.params.id,
    });

    if (result.skipped === 'retired') {
      return res.status(200).json({
        success: true,
        message: `${result.horse.name} is retired and doesn't need to be fed.`,
        data: { skipped: 'retired', horse: result.horse },
      });
    }

    return res.status(200).json({
      success: true,
      message: `Fed ${result.horse.name} with ${result.feed.name}.`,
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[horseFeedController.feedHorse] ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to feed horse', data: null });
  }
}
