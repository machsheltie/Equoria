/**
 * Tack Shop Controller
 * Handles tack shop: listing inventory and purchasing items.
 *
 * Uses existing Horse.tack (Json) field — no schema changes required.
 *
 * Routes:
 *   GET  /api/tack-shop/inventory          → list available tack items
 *   POST /api/tack-shop/purchase           → purchase an item for a horse
 *   POST /api/tack-shop/unequip-decoration → remove a decorative item
 *
 * Tack does NOT degrade with use. The previous condition / repair system
 * was removed 2026-05-05 (Equoria-045l). Any *_condition values left in
 * existing Horse.tack JSON rows are harmless dead data — the scoring path
 * no longer reads them.
 */

import prisma from '../../../../../packages/database/prismaClient.mjs';
import logger from '../../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../../utils/retryableTransaction.mjs';
import { updateUserSettingsPaths } from '../../../../utils/userSettingsPaths.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../services/financialLedgerService.mjs';
// Equoria-q4uem.4 (WS4 S4): the tack catalog and the tack-bonus policy live in
// ../services/tackInventory.mjs (data/policy, not HTTP). Re-exported here so
// same-module importers and tests keep their existing specifiers.
import { TACK_INVENTORY } from '../services/tackInventory.mjs';
export { TACK_INVENTORY, resolveTackBonus } from '../services/tackInventory.mjs';

// ── Category display configuration ──────────────────────────────────────────

const CATEGORY_DISPLAY = {
  saddle: 'Saddles',
  bridle: 'Bridles',
  halter: 'Halters',
  saddle_pad: 'Saddle Pads',
  leg_wraps: 'Leg Wraps & Boots',
  reins: 'Reins',
  girth: 'Girths',
  breastplate: 'Breastplates',
  decorative: 'Decorative & Parade',
};

class HorseNotOwnedError extends Error {}

// Merge a purchased item into Horse.tack (no mutation). Decorations are additive
// (no duplicates); functional items replace their slot + store numeric bonuses.
function mergeTackItem(rawTack, item) {
  const current =
    rawTack !== null && typeof rawTack === 'object' && !Array.isArray(rawTack) ? rawTack : {};
  const updated = { ...current };
  if (item.category === 'decorative') {
    const existing = Array.isArray(updated.decorations) ? updated.decorations : [];
    if (!existing.includes(item.id)) {
      updated.decorations = [...existing, item.id];
    }
    return updated;
  }
  updated[item.category] = item.id;
  if (item.category === 'saddle') {
    updated.saddleBonus = item.numericBonus;
  } else if (item.category === 'bridle') {
    updated.bridleBonus = item.numericBonus;
  }
  return updated;
}

// ── Decoration return helpers (Equoria-6p398.19) ──────────────────────────────

/** The catalogue entry for an item id, or undefined. */
function catalogItem(itemId) {
  return TACK_INVENTORY.find(item => item.id === itemId);
}

function decorationError(status, message) {
  return Object.assign(new Error(message), { decorationStatus: status });
}

function asTackObject(raw) {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function decorationsOf(rawTack) {
  const decorations = asTackObject(rawTack).decorations;
  return Array.isArray(decorations) ? decorations : [];
}

function inventoryOf(settings) {
  const inventory = asTackObject(settings).inventory;
  return Array.isArray(inventory) ? inventory : [];
}

/**
 * The owner's inventory after a decoration comes off `horseId`: every record of
 * it pointing at the horse is released; with none, one is derived. Shape and id
 * scheme match marketplace `deriveReturnedItem` and inventoryController's
 * tack-seed; ids stay unique because equip/unequip address records by id.
 */
function returnDecorationToInventory(inventory, horseId, itemId) {
  let released = false;
  const next = inventory.map(record => {
    const r = asTackObject(record);
    if (r.category === 'decorative' && r.itemId === itemId && r.equippedToHorseId === horseId) {
      released = true;
      return { ...record, equippedToHorseId: null };
    }
    return record;
  });
  if (released) {
    return next;
  }
  const taken = new Set(next.map(record => asTackObject(record).id).filter(Boolean));
  let id = `${horseId}-${itemId}`;
  for (let suffix = 2; taken.has(id); suffix += 1) {
    id = `${horseId}-${itemId}-${suffix}`;
  }
  const definition = catalogItem(itemId);
  return [
    ...next,
    {
      id,
      itemId,
      category: 'decorative',
      name: definition?.name ?? itemId,
      bonus: definition?.bonus ?? null,
      quantity: 1,
      equippedToHorseId: null,
      equippedToHorseName: null,
    },
  ];
}

// ── Route handlers ──────────────────────────────────────────────────────────

/**
 * GET /api/tack-shop/inventory
 * Returns full catalog grouped by category.
 */
export async function getTackInventory(_req, res) {
  const visibleItems = TACK_INVENTORY.filter(item => !item.isLegacyAlias);
  const categories = {};
  for (const item of visibleItems) {
    const key = item.category;
    if (!categories[key]) {
      categories[key] = [];
    }
    categories[key].push(item);
  }

  res.status(200).json({
    success: true,
    message: 'Tack inventory retrieved successfully',
    data: {
      items: visibleItems,
      categories,
      categoryDisplayNames: CATEGORY_DISPLAY,
    },
  });
}

/**
 * POST /api/tack-shop/purchase
 * Body: { horseId, itemId } — stores item ID AND numeric bonuses in Horse.tack.
 */
export async function purchaseTackItem(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, itemId } = req.body;

    const item = catalogItem(itemId);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: 'Item not found in inventory', data: null });
    }

    // Fast 404 + display name only; the tack is re-read inside the tx below.
    const horse = await prisma.horse.findFirst({
      where: { id: horseId, userId },
      select: { name: true },
    });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    // Equoria-6g8wm / 78i38: the debit, horse.tack update and ledger row commit
    // or unwind together; InsufficientFundsError surfaces as a 400.
    let updatedHorse;
    let updatedUser;
    try {
      ({ updatedHorse, updatedUser } = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          // Equoria-6p398.9 lock ordering: User row BEFORE Horse row, else this
          // deadlocks buyHorse (holds User(owner), waits for Horse). Guarded by
          // backend/__tests__/txUserBeforeHorseLockOrder.sentinel.test.mjs.
          // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
          const moneyAfter = await debitMoneyOrThrow(tx, {
            userId,
            amount: item.cost,
            systemAccount: SYSTEM_ACCOUNT_BURN,
            category: 'tackPurchaseBurn',
            description: `Tack purchase — ${item.name} for ${horse.name ?? horseId}`,
            metadata: { horseId, itemId: item.id, itemCategory: item.category },
          });
          // Equoria-bvddn.14: re-read tack AFTER the debit, whose User row lock
          // serialises concurrent purchases (and a sale) — no stale overwrite.
          // userId guard: a horse sold mid-purchase is never written (404).
          const where = { id: horseId, userId };
          const fresh = await tx.horse.findFirst({ where, select: { tack: true } });
          const tack = fresh && mergeTackItem(fresh.tack, item);
          if (!fresh || (await tx.horse.updateMany({ where, data: { tack } })).count !== 1) {
            throw new HorseNotOwnedError();
          }
          const horseRow = { id: horseId, name: horse.name, tack };
          // Equoria-0caxg: balanceAfter is read inside the tx by the service;
          // moneyAfter is only the response value (remainingMoney below).
          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: item.cost,
            category: 'tackPurchase',
            description: `${item.name} for ${horse.name ?? horseId}`,
            metadata: { horseId, itemId: item.id, category: item.category },
          });
          return { updatedHorse: horseRow, updatedUser: { money: moneyAfter } };
        }),
        { message: 'The tack shop is busy right now, please retry in a moment.' },
      ));
    } catch (txErr) {
      if (txErr instanceof HorseNotOwnedError) {
        return res.status(404).json({ success: false, message: 'Horse not found', data: null });
      }
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. ${item.name} costs $${item.cost}`,
          data: { required: item.cost },
        });
      }
      throw txErr;
    }

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
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[tackShopController] purchaseTackItem error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to purchase tack item', data: null });
  }
}

/**
 * POST /api/tack-shop/unequip-decoration
 * Body: { horseId, itemId }
 *
 * Takes a decoration off Horse.tack.decorations[] and puts it back in the
 * owner's inventory. No coins move.
 *
 * Equoria-6p398.19: this used to delete the decoration outright, while a sale
 * returns the very same decoration to the seller's inventory
 * (marketplace horseTransferReconciliation.returnTackToSeller). It now follows
 * the sale: an inventory record already pointing at this horse is RELEASED
 * (`equippedToHorseId` -> null); a shop-bought decoration, which has no record,
 * gets one DERIVED in the `<horseId>-<itemId>` shape the sale and the
 * inventory tack-seed write.
 *
 * Concurrency and lock order: the inventory write (a compare-and-swap on the
 * array this request read, `inventory` path only) takes the User row lock
 * first; the horse's tack is re-read under that lock and written second with
 * an ownership guard, so neither a concurrent purchase nor a sale is lost.
 */
export async function unequipDecoration(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, itemId } = req.body;

    const outcome = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const where = { id: horseId, userId };
        const horse = await tx.horse.findFirst({
          where,
          select: { id: true, name: true, tack: true },
        });
        if (!horse) {
          throw decorationError(404, 'Horse not found');
        }
        if (!decorationsOf(horse.tack).includes(itemId)) {
          throw decorationError(400, `Decoration "${itemId}" is not equipped on this horse`);
        }

        // USER row first.
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { settings: true },
        });
        const inventory = inventoryOf(user?.settings);
        const nextInventory = returnDecorationToInventory(inventory, horseId, itemId);
        const affected = await updateUserSettingsPaths(tx, userId, {
          set: { inventory: nextInventory },
          expect: { inventory: { equals: inventory, whenMissing: [] } },
        });
        if (affected !== 1) {
          throw decorationError(
            409,
            'Your inventory changed while this request was in flight. Please retry.',
          );
        }

        // HORSE row second, re-read under the User row lock taken above.
        const fresh = await tx.horse.findFirst({ where, select: { tack: true } });
        if (!fresh) {
          throw decorationError(404, 'Horse not found');
        }
        const currentTack = asTackObject(fresh.tack);
        const existing = decorationsOf(currentTack);
        if (!existing.includes(itemId)) {
          throw decorationError(400, `Decoration "${itemId}" is not equipped on this horse`);
        }
        const tack = { ...currentTack, decorations: existing.filter(id => id !== itemId) };
        if ((await tx.horse.updateMany({ where, data: { tack } })).count !== 1) {
          throw decorationError(404, 'Horse not found');
        }
        return { horse: { id: horseId, name: horse.name, tack } };
      }),
      { message: 'The tack shop is busy right now, please retry in a moment.' },
    );

    logger.info(
      `[tackShopController] User ${userId} unequipped decoration "${itemId}" from horse ${horseId} (returned to inventory)`,
    );

    res.status(200).json({
      success: true,
      message: 'Decoration removed successfully',
      data: { horse: outcome.horse, removedItemId: itemId },
    });
  } catch (error) {
    if (typeof error?.decorationStatus === 'number') {
      return res
        .status(error.decorationStatus)
        .json({ success: false, message: error.message, data: null });
    }
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[tackShopController] unequipDecoration error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unequip decoration', data: null });
  }
}
