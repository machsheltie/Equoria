/**
 * Horse Feed Service (feed-system redesign 2026-04-29, Equoria-l5kf,
 * parent: Equoria-3gqg).
 *
 * Provides the daily feed action: transactional inventory decrement,
 * lastFedDate set, and stat-boost RNG roll. Single source of truth for
 * feed-action pre-conditions — the controller is a thin HTTP shim around
 * `feedHorse()`.
 *
 * Pre-conditions (all checked inside the transaction):
 *   - horse exists (404 if not)
 *   - horse belongs to caller (404, NOT 403, for CWE-639 disclosure
 *     resistance — see commit 892fc812 / requireOwnership middleware in
 *     backend/middleware/ownership.mjs:14-15). This branch is unreachable
 *     when the route is wired with requireOwnership('horse'), but
 *     defense-in-depth still warrants the check.
 *   - age < 21 (else returns { skipped: 'retired' }, no inventory mutation)
 *   - equippedFeedType is set (else 400)
 *   - alreadyFedToday returns false (else 400)
 *   - inventory has >= 1 unit of equipped tier (else 400 + auto-clear
 *     equippedFeedType per spec §6.2 step 6a)
 *
 * RNG is injectable for deterministic service-level tests (Task A9).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { FEED_CATALOG } from '../../services/controllers/feedShopController.mjs';
import { alreadyFedToday } from '../../../utils/horseHealth.mjs';

// 12-stat boost pool. Names match Horse schema fields exactly.
const STATS = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

const TIER_BY_ID = Object.fromEntries(FEED_CATALOG.map(t => [t.id, t]));

function getInventory(settings) {
  if (!settings || typeof settings !== 'object') return [];
  return Array.isArray(settings.inventory) ? settings.inventory : [];
}

/**
 * Roll for a stat boost based on the tier's statRollPct.
 *
 * Calls `rng()` twice — once for the threshold check, once for the stat
 * selection — so deterministic tests can drive both outcomes by seeding
 * the rng with a sequence of known values.
 *
 * @param {string} feedTier - Tier id (one of FEED_CATALOG ids)
 * @param {() => number} [rng=Math.random] - 0..1 random function
 * @returns {{ stat: string, amount: number } | null}
 */
export function rollStatBoost(feedTier, rng = Math.random) {
  const tier = TIER_BY_ID[feedTier];
  if (!tier || tier.statRollPct === 0) return null;
  if (rng() * 100 >= tier.statRollPct) return null;
  const stat = STATS[Math.floor(rng() * STATS.length)];
  return { stat, amount: 1 };
}

/**
 * Feed a horse. Transactional. Validates pre-conditions, decrements the
 * pooled inventory by 1 unit of the equipped tier, sets lastFedDate, rolls
 * a stat boost, and (when inventory hits 0 for that tier) prunes the
 * inventory row AND clears horse.equippedFeedType.
 *
 * @param {{ userId: string, horseId: number|string, rng?: () => number }} args
 * @returns {Promise<
 *   | { skipped: 'retired', horse: object }
 *   | {
 *       horse: object,
 *       feed: { tier: string, name: string },
 *       remainingUnits: number,
 *       statBoost: { stat: string, amount: number } | null,
 *       equippedFeedClearedDueToEmpty: boolean,
 *     }
 * >}
 * @throws {Error & { status: number }} 400/404 on pre-condition failures
 */
export async function feedHorse({ userId, horseId, rng = Math.random }) {
  // Sentinel for the "out of feed" case: we MUST clear equippedFeedType
  // (spec §6.2 step 6a) BUT we must also reject the request with 400.
  // If we simply throw inside prisma.$transaction, the transaction rolls
  // back including the clear — failing the DB read-back assertion. So we
  // signal the auto-clear case via the resolved value, then perform the
  // clear and the throw OUTSIDE the transaction.
  const result = await prisma.$transaction(async tx => {
    const horse = await tx.horse.findUnique({ where: { id: Number(horseId) } });
    if (!horse) {
      const e = new Error('Horse not found');
      e.status = 404;
      throw e;
    }
    // CWE-639 disclosure resistance: cross-user access returns 404 (not 403)
    // so authenticated attackers cannot enumerate horse IDs. Mirrors the
    // pattern from requireOwnership middleware (backend/middleware/ownership.mjs).
    // Defense-in-depth — the route already wires requireOwnership('horse').
    if (horse.userId !== userId) {
      const e = new Error('Horse not found');
      e.status = 404;
      throw e;
    }
    if (horse.age != null && horse.age >= 21) {
      return { kind: 'retired', horse };
    }
    if (!horse.equippedFeedType) {
      const e = new Error(
        'No feed currently selected. Please purchase feed from the feed store and equip it to your horse.',
      );
      e.status = 400;
      throw e;
    }
    if (alreadyFedToday(horse.lastFedDate)) {
      const e = new Error('Already fed today. Try again tomorrow.');
      e.status = 400;
      throw e;
    }

    const tier = TIER_BY_ID[horse.equippedFeedType];
    if (!tier) {
      const e = new Error(`Unknown feed tier: ${horse.equippedFeedType}`);
      e.status = 400;
      throw e;
    }

    const dbUser = await tx.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const settings = dbUser?.settings && typeof dbUser.settings === 'object' ? dbUser.settings : {};
    const inventory = getInventory(settings).map(i => ({ ...i }));
    const idx = inventory.findIndex(i => i.id === `feed-${tier.id}`);

    if (idx < 0 || !Number.isFinite(inventory[idx].quantity) || inventory[idx].quantity < 1) {
      // Signal the out-of-feed case to the outer scope. We deliberately
      // do NOT mutate inside the transaction here — the transaction is
      // about to commit cleanly with no inventory or horse changes. The
      // outer scope will then perform the auto-clear and throw the 400.
      return { kind: 'outOfFeed', tier };
    }

    inventory[idx].quantity -= 1;
    let equippedFeedClearedDueToEmpty = false;
    if (inventory[idx].quantity <= 0) {
      inventory.splice(idx, 1);
      equippedFeedClearedDueToEmpty = true;
    }

    const horseUpdate = {
      lastFedDate: new Date(),
    };
    if (equippedFeedClearedDueToEmpty) {
      horseUpdate.equippedFeedType = null;
    }

    const statBoost = rollStatBoost(tier.id, rng);
    if (statBoost) {
      horseUpdate[statBoost.stat] = { increment: statBoost.amount };
    }

    const updatedHorse = await tx.horse.update({
      where: { id: horse.id },
      data: horseUpdate,
    });
    await tx.user.update({
      where: { id: userId },
      data: { settings: { ...settings, inventory } },
    });

    const remainingUnits = equippedFeedClearedDueToEmpty ? 0 : inventory[idx].quantity;

    return {
      kind: 'fed',
      horse: updatedHorse,
      feed: { tier: tier.id, name: tier.name },
      remainingUnits,
      statBoost,
      equippedFeedClearedDueToEmpty,
    };
  });

  // Out-of-feed: auto-clear equippedFeedType OUTSIDE the transaction (so
  // it persists), then throw the 400 to the controller.
  if (result.kind === 'outOfFeed') {
    await prisma.horse.update({
      where: { id: Number(horseId) },
      data: { equippedFeedType: null },
    });
    const e = new Error(`Out of ${result.tier.name}. Purchase more from the feed shop.`);
    e.status = 400;
    throw e;
  }

  if (result.kind === 'retired') {
    return { skipped: 'retired', horse: result.horse };
  }

  // result.kind === 'fed' — strip the discriminator and return the spec shape
  const { kind: _kind, ...fedResult } = result;
  return fedResult;
}
