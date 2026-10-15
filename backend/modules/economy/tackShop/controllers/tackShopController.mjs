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

    const item = TACK_INVENTORY.find(i => i.id === itemId);
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
            category: 'tack_purchase_burn',
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
            category: 'tack_purchase',
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
 * Removes a decorative item from Horse.tack.decorations[] by item ID.
 * Does not charge coins — this is purely a cosmetic management operation.
 */
export async function unequipDecoration(req, res) {
  try {
    const userId = req.user.id;
    const { horseId, itemId } = req.body;

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found', data: null });
    }

    const currentTack = typeof horse.tack === 'object' && horse.tack !== null ? horse.tack : {};
    const existing = Array.isArray(currentTack.decorations) ? currentTack.decorations : [];

    if (!existing.includes(itemId)) {
      return res.status(400).json({
        success: false,
        message: `Decoration "${itemId}" is not equipped on this horse`,
        data: null,
      });
    }

    const updatedTack = { ...currentTack, decorations: existing.filter(id => id !== itemId) };
    const updatedHorse = await prisma.horse.update({
      where: { id: horseId },
      data: { tack: updatedTack },
    });

    logger.info(
      `[tackShopController] User ${userId} unequipped decoration "${itemId}" from horse ${horseId}`,
    );

    res.status(200).json({
      success: true,
      message: 'Decoration removed successfully',
      data: {
        horse: { id: updatedHorse.id, name: updatedHorse.name, tack: updatedHorse.tack },
        removedItemId: itemId,
      },
    });
  } catch (error) {
    logger.error(`[tackShopController] unequipDecoration error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unequip decoration', data: null });
  }
}
