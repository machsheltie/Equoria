/**
 * backfill-tack-rulings.mjs (Equoria-cv3if, Equoria-k1p62)
 *
 * One-off, idempotent rewrite of the saved tack data after the owner's tack
 * rulings of 2026-10-23 (q05, q32, q33):
 *
 *   1. User.settings.inventory records
 *      - The four crafted items the owner deleted (Handcrafted Bridle, Dyed
 *        Leather Bridle, Artisan Event Saddle, Legacy Tack Set) are REMOVED.
 *        There is no refund: a crafted item was paid for with a crafting fee
 *        that the ledger booked as a burn (SYSTEM_ACCOUNT_BURN) plus workshop
 *        materials, and the ledger has no pattern for paying a burned fee back
 *        out (a credit would have to mint coins or debit the burn account). The
 *        owner can ask for one; see the report on Equoria-cv3if.
 *      - A record of the legacy All Purpose ids (basic-all-purpose-saddle,
 *        standard-bridle) becomes the current All Purpose id (Equoria-8apf).
 *      - Every other tack record gets its effect fields rewritten from the
 *        catalogue or crafting recipe by itemId (tackEffectFields): a saddle or
 *        bridle keeps its current label, tack that does not score loses its
 *        bonus text and is marked comingSoon. Records of items this file does
 *        not know (feed, anything else) are left untouched.
 *   2. Horse.tack
 *      - The retired mirror keys saddleBonus and bridleBonus are deleted.
 *      - A slot that still names one of the four deleted items is cleared; a slot
 *        that names a legacy All Purpose id is set to the current id.
 *
 * Idempotent: a second run finds nothing to change. Transactional: each user
 * (their settings.inventory and their horses' tack) is rewritten in one
 * transaction, user first, then horses by ascending id (lock order
 * User -> Horse); ownerless horses are rewritten in a final transaction. A
 * failure rolls back that user's rewrite and the rest still run.
 *
 * Usage (do NOT run against production without the owner's go-ahead):
 *   node backend/scripts/backfill-tack-rulings.mjs --dry-run   report only
 *   node backend/scripts/backfill-tack-rulings.mjs             write
 *   --quiet                                                    summary only
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { updateUserSettingsPaths } from '../utils/userSettingsPaths.mjs';
import { allTackItems, tackEffectFields } from '../modules/economy/index.mjs';
import { craftedItemRecipes } from '../modules/crafting/index.mjs';

/** The four crafted items the owner deleted (q05), by inventory itemId. */
export const deletedTackItemIds = Object.freeze([
  'crafted-simple-bridle',
  'crafted-dyed-bridle',
  'crafted-event-saddle',
  'crafted-legacy-tack-set',
]);

/** The retired Horse.tack mirror keys (Equoria-lsudd). */
export const retiredMirrorKeys = Object.freeze(['saddleBonus', 'bridleBonus']);

const deleted = new Set(deletedTackItemIds);

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Key order is not a change: a record whose effect fields come back in the same
// values is left exactly as stored. Compared as JSON with sorted keys, so the
// comparison does not depend on which realm built the object.
const canonical = value =>
  JSON.stringify(value, (_key, nested) =>
    isPlainObject(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : nested,
  );
const sameJson = (a, b) => canonical(a) === canonical(b);

const craftedRecipes = ['saddle', 'bridle', 'halter', 'blanket', 'cosmetic'].flatMap(
  craftedItemRecipes,
);

/**
 * The legacy All Purpose ids (Equoria-8apf) and the current ids they become, in
 * both inventory records and Horse.tack slots. The two aliases are gone from the
 * catalogue once this has run.
 */
export const legacyAllPurposeIds = Object.freeze({
  'basic-all-purpose-saddle': 'all-purpose-saddle',
  'standard-bridle': 'all-purpose-bridle',
});

function definitionFor(itemId) {
  return (
    allTackItems().find(item => item.id === itemId) ??
    craftedRecipes.find(recipe => recipe.result === itemId) ??
    null
  );
}

/**
 * Rewrite one inventory array.
 *
 * @param {unknown} inventory - User.settings.inventory.
 * @returns {{ inventory: unknown[], removed: number, relabelled: number }}
 *   The new array (the same array when nothing changes), how many deleted-item
 *   records were removed and how many records had their effect fields rewritten.
 */
export function rewriteInventory(inventory) {
  if (!Array.isArray(inventory)) {
    return { inventory: [], removed: 0, relabelled: 0 };
  }
  let removed = 0;
  let relabelled = 0;
  const next = [];
  for (const record of inventory) {
    if (!isPlainObject(record)) {
      next.push(record);
      continue;
    }
    if (deleted.has(record.itemId)) {
      removed += 1;
      continue;
    }
    const currentId = legacyAllPurposeIds[record.itemId] ?? record.itemId;
    const definition = definitionFor(currentId);
    if (definition === null) {
      next.push(record);
      continue;
    }
    // Drop the stored effect text, then write back what the definition says.
    const { bonus: _bonus, comingSoon: _comingSoon, ...rest } = record;
    const rewritten = { ...rest, itemId: currentId, ...tackEffectFields(definition) };
    if (sameJson(rewritten, record)) {
      next.push(record);
    } else {
      relabelled += 1;
      next.push(rewritten);
    }
  }
  return { inventory: removed === 0 && relabelled === 0 ? inventory : next, removed, relabelled };
}

/**
 * Rewrite one Horse.tack object.
 *
 * @param {unknown} tack - Horse.tack.
 * @returns {{ tack: unknown, changed: boolean, mirrorsRemoved: number, slotsRewritten: number }}
 */
export function rewriteHorseTack(tack) {
  if (!isPlainObject(tack)) {
    return { tack, changed: false, mirrorsRemoved: 0, slotsRewritten: 0 };
  }
  const next = { ...tack };
  let mirrorsRemoved = 0;
  let slotsRewritten = 0;
  for (const key of retiredMirrorKeys) {
    if (Object.hasOwn(next, key)) {
      delete next[key];
      mirrorsRemoved += 1;
    }
  }
  for (const [slot, value] of Object.entries(next)) {
    if (typeof value === 'string' && deleted.has(value)) {
      delete next[slot];
      slotsRewritten += 1;
    } else if (typeof value === 'string' && Object.hasOwn(legacyAllPurposeIds, value)) {
      next[slot] = legacyAllPurposeIds[value];
      slotsRewritten += 1;
    }
  }
  const changed = mirrorsRemoved + slotsRewritten > 0;
  return { tack: changed ? next : tack, changed, mirrorsRemoved, slotsRewritten };
}

const emptySummary = () => ({
  usersScanned: 0,
  usersChanged: 0,
  inventoryRecordsRemoved: 0,
  inventoryRecordsRelabelled: 0,
  horsesChanged: 0,
  mirrorKeysRemoved: 0,
  slotsRewritten: 0,
  failed: 0,
});

async function rewriteHorses(tx, where, summary, beforeHorseWrite) {
  const horses = await tx.horse.findMany({
    where,
    select: { id: true, tack: true },
    orderBy: { id: 'asc' },
  });
  for (const horse of horses) {
    const result = rewriteHorseTack(horse.tack);
    if (!result.changed) {
      continue;
    }
    if (beforeHorseWrite) {
      await beforeHorseWrite(horse.id);
    }
    await tx.horse.update({ where: { id: horse.id }, data: { tack: result.tack } });
    summary.horsesChanged += 1;
    summary.mirrorKeysRemoved += result.mirrorsRemoved;
    summary.slotsRewritten += result.slotsRewritten;
  }
}

/**
 * Run the backfill.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun] - Count what would change; write nothing.
 * @param {string[]} [opts.userIds] - Restrict to these users (and their horses);
 *   ownerless horses are skipped. For tests and targeted reruns.
 * @param {boolean} [opts.quiet] - No per-user logging.
 * @param {(horseId: number) => Promise<void>} [opts.beforeHorseWrite] - Test seam,
 *   awaited inside the transaction before each horse write; a throw fails that
 *   user's rewrite.
 * @returns {Promise<ReturnType<typeof emptySummary>>}
 */
export async function backfillTackRulings(opts = {}) {
  const { dryRun = false, userIds = null, quiet = false, beforeHorseWrite = null } = opts;
  const summary = emptySummary();
  const log = quiet ? () => {} : message => console.log(message);

  const userWhere = userIds ? { id: { in: userIds } } : {};
  let lastId = '';
  for (;;) {
    const batch = await prisma.user.findMany({
      where: { ...userWhere, id: userIds ? { in: userIds, gt: lastId } : { gt: lastId } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 200,
    });
    if (batch.length === 0) {
      break;
    }
    for (const { id: userId } of batch) {
      summary.usersScanned += 1;
      try {
        if (dryRun) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { settings: true },
          });
          const settings = isPlainObject(user?.settings) ? user.settings : {};
          const before = { ...summary };
          if (Array.isArray(settings.inventory)) {
            const result = rewriteInventory(settings.inventory);
            summary.inventoryRecordsRemoved += result.removed;
            summary.inventoryRecordsRelabelled += result.relabelled;
          }
          const horses = await prisma.horse.findMany({ where: { userId }, select: { tack: true } });
          for (const horse of horses) {
            const result = rewriteHorseTack(horse.tack);
            if (result.changed) {
              summary.horsesChanged += 1;
              summary.mirrorKeysRemoved += result.mirrorsRemoved;
              summary.slotsRewritten += result.slotsRewritten;
            }
          }
          if (!sameJson(before, summary)) {
            summary.usersChanged += 1;
            log(`  [DRY] ${userId} would be rewritten`);
          }
          continue;
        }

        const perUser = emptySummary();
        await prisma.$transaction(async tx => {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { settings: true },
          });
          const settings = isPlainObject(user?.settings) ? user.settings : {};
          if (Array.isArray(settings.inventory)) {
            const result = rewriteInventory(settings.inventory);
            if (result.removed + result.relabelled > 0) {
              const affected = await updateUserSettingsPaths(tx, userId, {
                set: { inventory: result.inventory },
                expect: { inventory: { equals: settings.inventory, whenMissing: [] } },
              });
              if (affected !== 1) {
                throw new Error(`inventory of user ${userId} changed during the backfill`);
              }
              perUser.inventoryRecordsRemoved += result.removed;
              perUser.inventoryRecordsRelabelled += result.relabelled;
            }
          }
          await rewriteHorses(tx, { userId }, perUser, beforeHorseWrite);
        });
        // Counted only once the user's transaction has committed.
        for (const key of Object.keys(perUser)) {
          summary[key] += perUser[key];
        }
        if (Object.values(perUser).some(count => count > 0)) {
          summary.usersChanged += 1;
          log(`  [WET] ${userId} rewritten`);
        }
      } catch (err) {
        summary.failed += 1;
        console.error(`  [ERR] ${userId}: ${err.message}`);
      }
    }
    lastId = batch[batch.length - 1].id;
  }

  if (!userIds) {
    // Horses nobody owns (store and stud stock) carry tack too.
    try {
      if (dryRun) {
        const horses = await prisma.horse.findMany({
          where: { userId: null },
          select: { tack: true },
        });
        for (const horse of horses) {
          const result = rewriteHorseTack(horse.tack);
          if (result.changed) {
            summary.horsesChanged += 1;
            summary.mirrorKeysRemoved += result.mirrorsRemoved;
            summary.slotsRewritten += result.slotsRewritten;
          }
        }
      } else {
        const perOwnerless = emptySummary();
        await prisma.$transaction(async tx => {
          await rewriteHorses(tx, { userId: null }, perOwnerless, beforeHorseWrite);
        });
        summary.horsesChanged += perOwnerless.horsesChanged;
        summary.mirrorKeysRemoved += perOwnerless.mirrorKeysRemoved;
        summary.slotsRewritten += perOwnerless.slotsRewritten;
      }
    } catch (err) {
      summary.failed += 1;
      console.error(`  [ERR] ownerless horses: ${err.message}`);
    }
  }

  return summary;
}

// ── CLI entrypoint ───────────────────────────────────────────────────────────
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run') || argv.includes('--print-only');
  const quiet = argv.includes('--quiet');

  console.log('backfill-tack-rulings (Equoria-cv3if)');
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'WET RUN'}`);

  backfillTackRulings({ dryRun, quiet })
    .then(summary => {
      console.log(JSON.stringify(summary, null, 2));
      return prisma.$disconnect().finally(() => process.exit(summary.failed > 0 ? 1 : 0));
    })
    .catch(err => {
      console.error('Fatal error:', err);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}
