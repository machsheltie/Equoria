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

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';
import { updateUserSettingsPaths } from '../../../../utils/userSettingsPaths.mjs';
import { withRetryableTxMapping } from '../../../../utils/retryableTransaction.mjs';
import { TACK_INVENTORY } from '../../tackShop/controllers/tackShopController.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read inventory array from User.settings, defaulting to empty array.
 * @param {object|null} settings - User.settings JSON value
 * @returns {Array}
 */
function getInventoryFromSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
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
      if (!itemId) {
        continue;
      }
      const def = TACK_INVENTORY.find(i => i.id === itemId);
      if (!def) {
        continue;
      }
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

/**
 * Read a Prisma Json value as a plain object (CONTRIBUTING.md JSONB guard).
 * @param {unknown} raw
 * @returns {object}
 */
function asObject(raw) {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** Build an error the catch blocks below turn into a specific HTTP status. */
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Message used when a concurrent writer changed `settings.inventory` between
 * this request's read and its write. Rejecting is the only honest outcome:
 * continuing would silently discard the other writer's change (the Finding 1
 * defect) — the player simply retries against fresh state.
 */
const INVENTORY_CONFLICT = 'Your inventory changed while this request was in flight. Please retry.';

/**
 * Apply a horse tack change, guarded on CURRENT ownership.
 *
 * `req.horse`/an earlier read proves ownership at READ time only. A horse sold
 * or transferred between the read and this write must not be re-tacked by its
 * former owner, so ownership is re-asserted in the WHERE clause and an
 * affected-row count other than 1 aborts the whole transaction.
 *
 * @param {object} tx - the surrounding interactive transaction client
 * @param {string} userId
 * @param {{id: number, tack: object}} change
 */
async function applyTackChange(tx, userId, change) {
  const { count } = await tx.horse.updateMany({
    where: { id: change.id, userId },
    data: { tack: change.tack },
  });
  if (count !== 1) {
    throw httpError(409, 'That horse is no longer yours. Please reload your stable.');
  }
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

      // Persist the derived inventory so equip/unequip work from now on. The
      // seed is KEPT (not removed): equip/unequip address items by their
      // inventory record id, so a legacy account whose only evidence of a tack
      // purchase is `horse.tack` would otherwise be unable to move that item
      // ever again. It is made SAFE instead — Finding 1's requirement that an
      // ordinary read can never undo a completed claim:
      //   * `jsonb_set` on the `inventory` path only, so `lastWeeklyClaimDate`
      //     and every other key keep their committed values;
      //   * a compare-and-swap on `inventory` so this write applies only while
      //     inventory is still absent/empty. If a concurrent purchase, craft or
      //     a parallel GET seeded it first, zero rows are affected and this
      //     request returns what it derived without overwriting anything.
      const seeded = await updateUserSettingsPaths(prisma, userId, {
        set: { inventory },
        expect: { inventory: { equals: [], whenMissing: [] } },
      });

      if (seeded === 1) {
        logger.info(
          `[inventoryController] Seeded inventory for user ${userId} from horse tack data`,
        );
      } else {
        logger.info(
          `[inventoryController] Skipped inventory tack-seed for user ${userId}; inventory changed concurrently`,
        );
      }
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

    // Equoria-6p398.1 / Equoria-q9nqm: ownership checks, the inventory
    // decision, the previous-horse tack change, the target-horse tack change
    // and the persisted item placement all live in ONE transaction, and the
    // settings write touches only the `inventory` path.
    const outcome = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            settings: true,
            horses: { select: { id: true, name: true, tack: true } },
          },
        });

        if (!user) {
          throw httpError(404, 'User not found');
        }

        const inventory = getInventoryFromSettings(user.settings);
        const itemIndex = inventory.findIndex(i => i.id === inventoryItemId);

        if (itemIndex === -1) {
          throw httpError(404, 'Inventory item not found');
        }

        const horse = user.horses.find(h => h.id === horseId);
        if (!horse) {
          throw httpError(404, 'Horse not found or not owned');
        }

        const item = inventory[itemIndex];

        // Update inventory record — set new item, clear any other same-category
        // item that was pointing at the same horse (stale after the swap).
        const updatedInventory = inventory.map((i, idx) => {
          if (idx === itemIndex) {
            return { ...i, equippedToHorseId: horseId };
          }
          if (i.category === item.category && i.equippedToHorseId === horseId) {
            return { ...i, equippedToHorseId: null };
          }
          return i;
        });

        // USER row first (repository lock ordering: User -> Horse). The
        // compare-and-swap on `inventory` is the linearisation point: a
        // concurrent equip of the SAME item to another horse changed the array,
        // so exactly one of the two can affect a row. The loser rejects here,
        // BEFORE any horse tack is written — which is what stops one item from
        // conferring its bonus on two horses.
        const affected = await updateUserSettingsPaths(tx, userId, {
          set: { inventory: updatedInventory },
          expect: { inventory: { equals: inventory, whenMissing: [] } },
        });
        if (affected !== 1) {
          throw httpError(409, INVENTORY_CONFLICT);
        }

        // HORSE rows second, in ascending primary-key order.
        const tackChanges = [];
        if (item.equippedToHorseId && item.equippedToHorseId !== horseId) {
          const prevHorse = user.horses.find(h => h.id === item.equippedToHorseId);
          if (prevHorse) {
            const newPrevTack = { ...asObject(prevHorse.tack) };
            delete newPrevTack[item.category];
            tackChanges.push({ id: prevHorse.id, tack: newPrevTack });
          }
        }
        const updatedTack = { ...asObject(horse.tack), [item.category]: item.itemId };
        tackChanges.push({ id: horseId, tack: updatedTack });
        tackChanges.sort((a, b) => a.id - b.id);

        for (const change of tackChanges) {
          await applyTackChange(tx, userId, change);
        }

        return { user, horse, item, itemIndex, updatedInventory, updatedTack };
      }),
      { message: 'Inventory is busy right now, please retry in a moment.' },
    );

    const { user, horse, item, itemIndex, updatedInventory, updatedTack } = outcome;

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
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
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

    const outcome = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            settings: true,
            horses: { select: { id: true, name: true, tack: true } },
          },
        });

        if (!user) {
          throw httpError(404, 'User not found');
        }

        const inventory = getInventoryFromSettings(user.settings);
        const itemIndex = inventory.findIndex(i => i.id === inventoryItemId);

        if (itemIndex === -1) {
          throw httpError(404, 'Inventory item not found');
        }

        const item = inventory[itemIndex];

        if (!item.equippedToHorseId) {
          throw httpError(400, 'Item is not currently equipped');
        }

        const updatedInventory = inventory.map((i, idx) =>
          idx === itemIndex ? { ...i, equippedToHorseId: null } : i,
        );

        // USER row first, `inventory` path only, guarded on the array this
        // request read (same reasoning as equipItem).
        const affected = await updateUserSettingsPaths(tx, userId, {
          set: { inventory: updatedInventory },
          expect: { inventory: { equals: inventory, whenMissing: [] } },
        });
        if (affected !== 1) {
          throw httpError(409, INVENTORY_CONFLICT);
        }

        // HORSE row second. A horse the user no longer owns is not in
        // `user.horses`, so its tack is left alone — the inventory record is
        // still cleared, but a former owner never writes a stranger's horse.
        const horse = user.horses.find(h => h.id === item.equippedToHorseId);
        if (horse) {
          const newTack = { ...asObject(horse.tack) };
          delete newTack[item.category];
          await applyTackChange(tx, userId, { id: horse.id, tack: newTack });
        }

        return { user, item, itemIndex, updatedInventory };
      }),
      { message: 'Inventory is busy right now, please retry in a moment.' },
    );

    const { user, item, itemIndex, updatedInventory } = outcome;

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
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[inventoryController] unequipItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unequip item', data: null });
  }
}
