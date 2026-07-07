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
import { withRetryableTxMapping } from '../../../../utils/retryableTransaction.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
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

    // Equoria-6g8wm: atomic money debit through the shared helper.
    // Equoria-8sag0: the JSONB inventory read-modify-write is now correctly
    // ORDERED — the debit's conditional updateMany takes the User row lock
    // FIRST, and settings is read AFTER that lock, so concurrent purchases
    // serialize and a sibling merges onto the committed inventory instead of a
    // stale pre-lock snapshot. Reading settings before the debit (the prior
    // bug) let two concurrent purchases both debit but the second write erase
    // the first's inventory add — money charged twice, one pack lost. JSONB
    // inventory is an array merge (find-or-push + increment), not a simple
    // counter, so it cannot use a single jsonb_set UPDATE like the bank
    // weekly-claim path; the debit-first row-lock ordering is the equivalent
    // serialization for the multi-step array merge.
    let result;
    try {
      // Equoria-7x9po: transient P2028 tx-timeout -> retryable 503 (outer catch
      // already honours error.status).
      result = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          // Existence fast-path (preserves the 404 for a missing user). Selects
          // only `id`, NOT settings — this read does NOT feed the inventory
          // read-modify-write, so it is race-immune. The AUTHORITATIVE settings
          // read happens AFTER the debit's row lock (see below).
          const exists = await tx.user.findUnique({
            where: { id: userId },
            select: { id: true },
          });
          if (!exists) {
            const err = new Error('User not found');
            err.status = 404;
            throw err;
          }

          // Equoria-8sag0: DEBIT FIRST — the conditional updateMany inside
          // debitMoneyOrThrow takes the User row lock, so a concurrent purchase
          // blocks here until we commit. This serializes the whole inventory
          // read-modify-write below. If the helper throws (missing/underfunded
          // row), the tx unwinds and the settings update never runs.
          // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
          const remainingMoney = await debitMoneyOrThrow(tx, {
            userId,
            amount: totalCost,
            systemAccount: SYSTEM_ACCOUNT_BURN,
            category: 'feed_purchase_burn',
            description: `Feed purchase — ${packs} pack(s) of ${tier.name}`,
            metadata: { feedTier: tier.id, packs, totalUnits },
          });

          // Equoria-8sag0: AUTHORITATIVE settings read — AFTER the debit's row
          // lock. Under READ COMMITTED this SELECT observes any sibling purchase
          // that committed while we were blocked on the debit above, so we merge
          // our inventory add onto the latest committed inventory rather than a
          // stale pre-lock snapshot. debitMoneyOrThrow already threw
          // InsufficientFundsError if the row was missing/underfunded, so the
          // user row is guaranteed present here.
          const locked = await tx.user.findUnique({
            where: { id: userId },
            select: { settings: true },
          });
          const settings =
            locked?.settings && typeof locked.settings === 'object' ? { ...locked.settings } : {};
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

          // Equoria-g5yex: migrated to recordTransactionTx(tx, opts). tx is
          // structurally required (first arg); balanceAfter is read inside
          // the service from the same tx (caller no longer supplies it).
          // `remainingMoney` is still returned to the caller from
          // debitMoneyOrThrow above for the controller response payload.
          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: totalCost,
            category: 'feed_purchase',
            description: `${packs} pack(s) of ${tier.name}`,
            metadata: { feedTier: tier.id, packs, totalUnits },
          });

          return { remainingMoney, inventoryItem };
        }),
        { message: 'Feed shop is busy right now, please retry in a moment.' },
      );
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
