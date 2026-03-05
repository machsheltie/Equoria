/**
 * Inventory Controller
 * Manages the player's owned items and equipped tack on horses.
 *
 * Data model (no schema migration required):
 *   - User.settings.inventory  → Array of owned inventory items
 *   - Horse.tack               → { saddle?: string, bridle?: string } — equipped items
 *
 * Routes:
 *   GET  /api/inventory         → list all owned items with equipped state
 *   POST /api/inventory/equip   → equip item to a horse
 *   POST /api/inventory/unequip → remove item from a horse
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { TACK_INVENTORY } from './tackShopController.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read inventory array from User.settings, defaulting to empty array.
 * @param {object|null} settings - User.settings JSON value
 * @returns {Array}
 */
function getInventoryFromSettings(settings) {
  if (!settings || typeof settings !== 'object') return [];
  const inv = settings.inventory;
  return Array.isArray(inv) ? inv : [];
}

/**
 * Derive inventory from horses' tack fields when no inventory is recorded.
 * Called on first-ever inventory GET so existing purchases are surfaced.
 * Returns an array of InventoryItem objects.
 * @param {Array} horses - User's horses with tack field
 */
function deriveInventoryFromHorseTack(horses) {
  const items = [];
  for (const horse of horses) {
    const tack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    for (const itemId of Object.values(tack)) {
      if (!itemId) continue;
      const def = TACK_INVENTORY.find(i => i.id === itemId);
      if (!def) continue;
      items.push({
        id: `${horse.id}-${itemId}`,
        itemId: def.id,
        category: def.category,
        name: def.name,
        bonus: def.bonus,
        quantity: 1,
        equippedToHorseId: horse.id,
        equippedToHorseName: horse.name,
      });
    }
  }
  return items;
}

/**
 * Enrich inventory items with horse name for equippedToHorseId lookups.
 * @param {Array} inventory - raw inventory from User.settings
 * @param {Array} horses - User's horses array
 */
function enrichInventory(inventory, horses) {
  return inventory.map(item => {
    if (item.equippedToHorseId) {
      const horse = horses.find(h => h.id === item.equippedToHorseId);
      return { ...item, equippedToHorseName: horse ? horse.name : null };
    }
    return { ...item, equippedToHorseName: null };
  });
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * GET /api/inventory
 * Returns the authenticated user's inventory with equipped state.
 */
export async function getInventory(req, res) {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        settings: true,
        horses: { select: { id: true, name: true, tack: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    let inventory = getInventoryFromSettings(user.settings);

    // First-time seed: derive from existing horse tack purchases
    if (inventory.length === 0 && user.horses.some(h => h.tack && Object.keys(h.tack).length > 0)) {
      inventory = deriveInventoryFromHorseTack(user.horses);

      // Persist the derived inventory so equip/unequip work from now on
      const currentSettings =
        typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
      await prisma.user.update({
        where: { id: userId },
        data: { settings: { ...currentSettings, inventory } },
      });

      logger.info(`[inventoryController] Seeded inventory for user ${userId} from horse tack data`);
    }

    const enriched = enrichInventory(inventory, user.horses);

    res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: { items: enriched, total: enriched.length },
    });
  } catch (error) {
    logger.error(`[inventoryController] getInventory error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve inventory', data: null });
  }
}

/**
 * POST /api/inventory/equip
 * Body: { inventoryItemId: string, horseId: number }
 * Equips the item to the specified horse.
 */
export async function equipItem(req, res) {
  try {
    const userId = req.user.id;
    const { inventoryItemId, horseId } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        settings: true,
        horses: { select: { id: true, name: true, tack: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    const inventory = getInventoryFromSettings(user.settings);
    const itemIndex = inventory.findIndex(i => i.id === inventoryItemId);

    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Inventory item not found', data: null });
    }

    const horse = user.horses.find(h => h.id === horseId);
    if (!horse) {
      return res
        .status(404)
        .json({ success: false, message: 'Horse not found or not owned', data: null });
    }

    const item = inventory[itemIndex];

    // Unequip from previous horse if already equipped somewhere
    if (item.equippedToHorseId && item.equippedToHorseId !== horseId) {
      const prevHorse = user.horses.find(h => h.id === item.equippedToHorseId);
      if (prevHorse) {
        const prevTack =
          typeof prevHorse.tack === 'object' && prevHorse.tack !== null ? prevHorse.tack : {};
        const newPrevTack = { ...prevTack };
        delete newPrevTack[item.category];
        await prisma.horse.update({ where: { id: prevHorse.id }, data: { tack: newPrevTack } });
      }
    }

    // Equip to target horse — merge into horse.tack
    const currentTack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    const updatedTack = { ...currentTack, [item.category]: item.itemId };
    await prisma.horse.update({ where: { id: horseId }, data: { tack: updatedTack } });

    // Update inventory record
    const updatedInventory = inventory.map((i, idx) =>
      idx === itemIndex ? { ...i, equippedToHorseId: horseId } : i,
    );

    const currentSettings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    await prisma.user.update({
      where: { id: userId },
      data: { settings: { ...currentSettings, inventory: updatedInventory } },
    });

    logger.info(
      `[inventoryController] User ${userId} equipped "${item.name}" (${inventoryItemId}) to horse ${horseId}`,
    );

    const enriched = enrichInventory(updatedInventory, [
      ...user.horses.map(h => (h.id === horseId ? { ...h, tack: updatedTack } : h)),
    ]);

    res.status(200).json({
      success: true,
      message: `${item.name} equipped to ${horse.name}`,
      data: { items: enriched, equippedItem: enriched[itemIndex] },
    });
  } catch (error) {
    logger.error(`[inventoryController] equipItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to equip item', data: null });
  }
}

/**
 * POST /api/inventory/unequip
 * Body: { inventoryItemId: string }
 * Removes the item from whatever horse it is currently equipped to.
 */
export async function unequipItem(req, res) {
  try {
    const userId = req.user.id;
    const { inventoryItemId } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        settings: true,
        horses: { select: { id: true, name: true, tack: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    const inventory = getInventoryFromSettings(user.settings);
    const itemIndex = inventory.findIndex(i => i.id === inventoryItemId);

    if (itemIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Inventory item not found', data: null });
    }

    const item = inventory[itemIndex];

    if (!item.equippedToHorseId) {
      return res
        .status(400)
        .json({ success: false, message: 'Item is not currently equipped', data: null });
    }

    // Remove from horse.tack
    const horse = user.horses.find(h => h.id === item.equippedToHorseId);
    if (horse) {
      const currentTack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
      const newTack = { ...currentTack };
      delete newTack[item.category];
      await prisma.horse.update({ where: { id: horse.id }, data: { tack: newTack } });
    }

    // Clear equippedToHorseId in inventory
    const updatedInventory = inventory.map((i, idx) =>
      idx === itemIndex ? { ...i, equippedToHorseId: null } : i,
    );

    const currentSettings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    await prisma.user.update({
      where: { id: userId },
      data: { settings: { ...currentSettings, inventory: updatedInventory } },
    });

    logger.info(
      `[inventoryController] User ${userId} unequipped "${item.name}" (${inventoryItemId})`,
    );

    const enriched = enrichInventory(updatedInventory, user.horses);

    res.status(200).json({
      success: true,
      message: `${item.name} unequipped`,
      data: { items: enriched, unequippedItem: enriched[itemIndex] },
    });
  } catch (error) {
    logger.error(`[inventoryController] unequipItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unequip item', data: null });
  }
}
