/**
 * Horse-transfer staff reconciliation (audit 2026-07 finding 6 /
 * Equoria-6p398.6).
 *
 * WHY THIS EXISTS
 * A rider, trainer or groom is an EMPLOYEE of a player, not a fitting on a
 * horse: their `userId` is set when the player hires and pays for them, and the
 * assign endpoints require the caller to own the staff member AND the horse. A
 * sale moves the horse; it cannot move the employee. Before this reconciliation
 * the seller's assignment rows simply stayed active on a horse they no longer
 * owned, and the automated systems that read those rows never re-check current
 * ownership:
 *
 *   - the seller's staff stayed "busy" forever — the assign endpoints refuse a
 *     rider/trainer who already has an active assignment, and a groom's
 *     capacity is counted from active assignments, so the seller could not put
 *     them on another horse;
 *   - `trainingController.trainHorse` resolves the active TrainerAssignment by
 *     `horseId` alone, so the BUYER's training sessions were modified by, and
 *     awarded XP to, the SELLER's trainer;
 *   - `dailyCareAutomation.runDailyCareAutomation` grooms every horse with an
 *     active assignment with no ownership check, so the seller's groom kept
 *     changing the BUYER's horse's bond/stress and earning XP for it; and
 *   - `groomSalaryService.processWeeklySalaries` charges the ASSIGNMENT's
 *     `userId` weekly for every active assignment, so the seller kept paying a
 *     groom's wages for a horse they had sold.
 *
 * (The interactive groom-care endpoint does check `horse.userId !== userId`
 * — `enhancedGroomController.mjs:416` — so the manual path was already safe.
 * The automated paths above are what make groom reconciliation necessary.)
 *
 * WHAT IT DOES
 * Ends every active staff assignment on the transferred horse and clears the
 * horse's derived `rider` JSON (the representation `hasValidRider()` and the
 * competition engine read). The buyer starts with a clean, riderless horse and
 * no inherited staff; no `userId` is ever rewritten, so nobody's staff changes
 * hands.
 *
 * The `where` clauses deliberately do NOT pin the previous owner: an active
 * assignment row with a NULL or foreign `userId` (legacy data) is exactly as
 * unwanted on the buyer's new horse as the seller's own.
 *
 * CONCURRENCY / LOCK ORDER
 * Caller-supplied `tx` only — every write here belongs to the transaction that
 * performed the ownership transfer, so the horse cannot be handed over without
 * its staff being reconciled, and a rolled-back sale rolls the reconciliation
 * back with it. Ordering follows the project ruling (User rows, then Horse,
 * then RiderAssignment/staff rows): the Horse row is written first, and it is
 * already write-locked by the caller's claim, so this adds no new lock.
 *
 * TACK (Equoria-6p398.12 — owner ruling on the Task-1 `unequipItem` residual)
 * Equipment is not a fitting on the horse either: it is stripped on sale and
 * returned to the SELLER's inventory. See `returnTackToSeller` below for the
 * two provenances and why they must be told apart, and `BONUS_MIRROR_KEYS` for
 * why a leftover numeric mirror is a permanent free bonus rather than clutter.
 *
 * `reconcileHorseOnTransfer` ends with the test-only `marketplaceRaceBarrier`
 * seam so a regression can force a failure AFTER these writes and prove they
 * roll back with the purchase; it is inert outside NODE_ENV === 'test'.
 *
 * @module modules/marketplace/services/horseTransferReconciliation
 */

import { TACK_INVENTORY } from '../../economy/index.mjs';
import { updateUserSettingsPaths } from '../../../utils/userSettingsPaths.mjs';
// Same-module internal (NOT part of the marketplace public API): the test-only
// interleaving/abort seam. See `reconcileHorseOnTransfer` for why it is here.
import { awaitMarketplaceRaceBarrier } from './marketplaceRaceBarrier.mjs';

/**
 * `Horse.tack` mirrors the numeric bonus of the two scored categories beside
 * the item id (`tackShopController.purchaseTackItem`).
 *
 * A mirror left behind WITHOUT its item is not merely untidy, it is a
 * permanent free bonus: `resolveTackBonus` short-circuits on
 * `typeof tack.saddleBonus === 'number' || typeof tack.bridleBonus === 'number'`
 * and returns the stored numbers without ever looking at the item ids
 * (tackShopController.mjs — the `hasDirect` branch). A horse carrying only
 * `{ saddleBonus: 5 }` therefore scores +5 in every ridden competition
 * forever. So every mirror whose item key is gone is deleted here — including
 * one this sale did not create.
 */
const BONUS_MIRROR_KEYS = Object.freeze({ saddle: 'saddleBonus', bridle: 'bridleBonus' });

/**
 * The `Horse.tack` keys that name equipment: every non-decorative category in
 * the catalogue, plus `decorations` for the decorative array.
 *
 * Derived from `TACK_INVENTORY` rather than assumed, so a key that is NOT a
 * known category (a future field, a legacy scribble) is never mistaken for an
 * item id and swept into the seller's inventory. Such a key is left on the
 * horse: this code cannot say what it is, and it cannot confer a bonus —
 * `resolveTackBonus` reads only `saddle`, `bridle`, the two mirrors and
 * `decorations`.
 */
const TACK_CATEGORY_KEYS = Object.freeze(
  new Set(TACK_INVENTORY.map(item => item.category).filter(category => category !== 'decorative')),
);
const DECORATIONS_KEY = 'decorations';

/** Read a Prisma Json value as a plain object (CONTRIBUTING.md JSONB guard). */
function asObject(raw) {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** Read `User.settings.inventory`, normalising absent/null/non-array to `[]`. */
function readInventory(settings) {
  const inventory = asObject(settings).inventory;
  return Array.isArray(inventory) ? inventory : [];
}

/**
 * Flatten a `Horse.tack` document into the equipment entries it carries.
 *
 * The document is `{ <category>: <itemId>, decorations: [<itemId>...],
 * saddleBonus: <number>, bridleBonus: <number> }`. Only a string value under a
 * KNOWN category key, and the `decorations` array, name an item; the numeric
 * mirrors and every unknown key are not equipment and are left for the caller.
 *
 * @param {object} tack
 * @returns {Array<{ key: string, category: string, itemId: string }>}
 */
function tackEntries(tack) {
  const entries = [];
  for (const [key, value] of Object.entries(tack)) {
    if (key === DECORATIONS_KEY) {
      if (Array.isArray(value)) {
        for (const itemId of value) {
          if (typeof itemId === 'string' && itemId) {
            entries.push({ key, category: 'decorative', itemId });
          }
        }
      }
      continue;
    }
    if (TACK_CATEGORY_KEYS.has(key) && typeof value === 'string' && value) {
      entries.push({ key, category: key, itemId: value });
    }
  }
  return entries;
}

/**
 * The tack document the buyer should receive: every returned item's key gone,
 * and every orphaned bonus mirror with it (see `BONUS_MIRROR_KEYS`).
 *
 * @param {object} tack
 * @param {Array<{ key: string }>} entries - the equipment being returned
 * @returns {{ strippedTack: object, changed: boolean }}
 */
function stripReturnedTack(tack, entries) {
  const strippedTack = { ...tack };
  let changed = false;

  for (const entry of entries) {
    if (entry.key in strippedTack) {
      delete strippedTack[entry.key];
      changed = true;
    }
  }

  for (const [category, mirrorKey] of Object.entries(BONUS_MIRROR_KEYS)) {
    const itemStillPresent = typeof strippedTack[category] === 'string' && strippedTack[category];
    if (!itemStillPresent && mirrorKey in strippedTack) {
      delete strippedTack[mirrorKey];
      changed = true;
    }
  }

  return { strippedTack, changed };
}

/**
 * Build the inventory record for a shop-origin item coming off a sold horse.
 *
 * The shape and the `<horseId>-<itemId>` id scheme are exactly the ones
 * `inventoryController.deriveInventoryFromHorseTack` already PERSISTS on a
 * player's first `GET /api/inventory` — no schema is invented here. Two
 * deliberate differences, both because this is the item's last chance rather
 * than a display seed:
 *
 *   - an itemId absent from the catalogue is still returned (named by its id)
 *     instead of skipped, because skipping would destroy the item; and
 *   - `equippedToHorseId` is null — the item came OFF the horse.
 *
 * @param {number} horseId
 * @param {{ category: string, itemId: string }} entry
 * @param {Set<string>} takenIds - ids already present in the seller's inventory.
 *   Record ids must stay unique: `equipItem`/`unequipItem` address a record by
 *   `findIndex`, so a duplicate id is an item the player can never touch again.
 */
function deriveReturnedItem(horseId, entry, takenIds) {
  const definition = TACK_INVENTORY.find(item => item.id === entry.itemId);

  let id = `${horseId}-${entry.itemId}`;
  for (let suffix = 2; takenIds.has(id); suffix += 1) {
    id = `${horseId}-${entry.itemId}-${suffix}`;
  }
  takenIds.add(id);

  return {
    id,
    itemId: entry.itemId,
    category: definition?.category ?? entry.category,
    name: definition?.name ?? entry.itemId,
    bonus: definition?.bonus ?? null,
    quantity: 1,
    equippedToHorseId: null,
    equippedToHorseName: null,
  };
}

/**
 * Take every piece of equipment off a horse that just changed hands and put it
 * back in the OUTGOING owner's inventory.
 *
 * TWO PROVENANCES, ONE HORSE FIELD
 * `Horse.tack` says what is ON the horse; it never says who OWNS it. Ownership
 * lives only in a `User.settings.inventory` record carrying `equippedToHorseId`.
 *
 *   - `inventoryController.equipItem` writes BOTH representations, so the item
 *     already has a record: it is RELEASED (`equippedToHorseId` -> null), not
 *     recreated. Without this the record kept pointing at a horse the seller no
 *     longer owned, and neither equip (409 on the previous horse's tack write)
 *     nor unequip (it may not write a stranger's horse) could recover the item.
 *   - `tackShopController.purchaseTackItem` writes ONLY `Horse.tack`, so there
 *     is no record at all: one is DERIVED. Without this the sale handed the
 *     item to the buyer outright.
 *
 * The discriminator is therefore "does the seller hold a record pointing at
 * this horse with this item?" — evaluated per (category, itemId) pair, so a
 * shop purchase that overwrote a slot the seller had filled from inventory
 * returns BOTH items rather than silently merging them.
 *
 * CONCURRENCY
 * Mechanism (2) of the repository ruling — a compare-and-swap, not a lock. The
 * new array is computed from the old array AND the horse's tack, a genuine
 * read-modify-write that no single atomic statement expresses. The read below
 * happens AFTER the caller's `creditSeller` has write-locked `User(sellerId)`,
 * so it cannot go stale and the swap cannot lose; the guard is kept because a
 * seller write that somehow committed in between must reject the sale rather
 * than be silently discarded (the Finding 1 defect). `updateUserSettingsPaths`
 * rewrites only the `inventory` path, so `lastWeeklyClaimDate`, crafting
 * materials and onboarding state survive untouched.
 *
 * LOCK ORDER
 * Both rows written here are ALREADY write-locked by the caller's transaction
 * (`User(sellerId)` by the money move, `Horse(horseId)` by the ownership
 * claim), so no new lock is taken in any order. The ruling's User-before-Horse
 * sequence is followed regardless.
 *
 * @param {object} tx - the surrounding interactive Prisma transaction client
 * @param {{ horseId: number, sellerId: string }} params
 * @returns {Promise<{ tackItemsReleased: number, tackItemsDerived: number, tackDocumentRewritten: boolean }>}
 */
export async function returnTackToSeller(tx, { horseId, sellerId }) {
  if (!sellerId) {
    throw new Error('returnTackToSeller: sellerId is required');
  }

  const horse = await tx.horse.findUnique({ where: { id: horseId }, select: { tack: true } });
  const tack = asObject(horse?.tack);
  const entries = tackEntries(tack);

  const seller = await tx.user.findUnique({ where: { id: sellerId }, select: { settings: true } });
  const inventory = readInventory(seller?.settings);

  // Release the seller's own records. Matching `unequipItem`, only
  // `equippedToHorseId` is rewritten — `equippedToHorseName` is recomputed by
  // `enrichInventory` on every read and is not authoritative.
  const released = [];
  const nextInventory = inventory.map(item => {
    if (asObject(item).equippedToHorseId === horseId) {
      released.push({ category: item.category, itemId: item.itemId });
      return { ...item, equippedToHorseId: null };
    }
    return item;
  });

  const accountedFor = new Set(released.map(item => `${item.category}::${item.itemId}`));
  const takenIds = new Set(nextInventory.map(item => asObject(item).id).filter(Boolean));
  const derived = entries
    .filter(entry => !accountedFor.has(`${entry.category}::${entry.itemId}`))
    .map(entry => deriveReturnedItem(horseId, entry, takenIds));

  // The two writes are decided INDEPENDENTLY. A horse can need the tack write
  // with nothing to return — `{ saddleBonus: 5 }` and no saddle, which
  // `unequipItem` produces — and skipping it there would hand the buyer a
  // permanent scoring bonus. A horse can equally need the inventory write with
  // no tack change, when a record points at it that the tack never named.
  const { strippedTack, changed: tackChanged } = stripReturnedTack(tack, entries);
  const inventoryChanged = released.length > 0 || derived.length > 0;

  if (!inventoryChanged && !tackChanged) {
    return { tackItemsReleased: 0, tackItemsDerived: 0, tackDocumentRewritten: false };
  }

  // USER row first.
  if (inventoryChanged) {
    const affected = await updateUserSettingsPaths(tx, sellerId, {
      set: { inventory: [...nextInventory, ...derived] },
      expect: { inventory: { equals: inventory, whenMissing: [] } },
    });
    if (affected !== 1) {
      throw Object.assign(
        new Error(
          'The seller’s inventory changed while this purchase was completing. Please retry.',
        ),
        { statusCode: 409 },
      );
    }
  }

  // HORSE row second. Only returned keys and orphaned mirrors are removed, so a
  // key this code cannot identify is preserved rather than destroyed.
  if (tackChanged) {
    await tx.horse.update({ where: { id: horseId }, data: { tack: strippedTack } });
  }

  return {
    tackItemsReleased: released.length,
    tackItemsDerived: derived.length,
    tackDocumentRewritten: tackChanged,
  };
}

/**
 * End every active assignment on one horse in one assignment table.
 *
 * INTERIM COMPOSITE-UNIQUE GUARD (Equoria-kccmt is the owner-gated fix).
 * All three tables carry a composite unique on (staff, horse, isActive) —
 * `@@unique([riderId, horseId, isActive])`, `@@unique([trainerId, horseId,
 * isActive])`, `@@unique([foalId, groomId, isActive])`. That index makes a
 * plain "flip the active row to inactive" UPDATE fail with P2002 whenever the
 * horse ALREADY holds an inactive row for the same staff member — reachable in
 * four ordinary actions (assign → unassign → assign again → sell). Inside the
 * buy transaction that P2002 would abort a legitimate purchase, so before
 * deactivating we DELETE the superseded inactive row(s) for exactly the pairs
 * about to be deactivated.
 *
 * History cost, stated plainly: the older assignment ROW for that same
 * staff+horse pair is lost (its `startDate`, `notes`, and for grooms its
 * `endDate`/`bondScore`). The row that survives is the later one — the
 * assignment that was actually in force at the moment of sale. Care history
 * itself is not deleted: `GroomInteraction.assignmentId` is `ON DELETE SET
 * NULL` (migration 20250530230230), so interaction rows survive with their
 * assignment back-link cleared, and rider/trainer assignments have no dependent
 * rows at all. The proper fix — a partial unique index on `isActive = true`,
 * which needs a migration — is owner-gated and deliberately not done here.
 *
 * @param {object} delegate - the tx-bound Prisma model delegate
 * @param {{ horseField: string, staffField: string, horseId: number, endData?: object }} params
 * @returns {Promise<number>} how many active assignments were ended
 */
async function endActiveAssignmentsOnHorse(delegate, { horseField, staffField, horseId, endData }) {
  const active = await delegate.findMany({
    where: { [horseField]: horseId, isActive: true },
    select: { [staffField]: true },
  });
  if (active.length === 0) {
    return 0;
  }

  const staffIds = [...new Set(active.map(row => row[staffField]))];
  await delegate.deleteMany({
    where: { [horseField]: horseId, isActive: false, [staffField]: { in: staffIds } },
  });

  const { count } = await delegate.updateMany({
    where: { [horseField]: horseId, isActive: true },
    data: { isActive: false, ...endData },
  });
  return count;
}

/**
 * End the outgoing owner's staff associations for a horse that just changed
 * hands.
 *
 * @param {object} tx - the surrounding interactive Prisma transaction client
 * @param {{ horseId: number }} params
 * @returns {Promise<{ riderAssignmentsEnded: number, trainerAssignmentsEnded: number, groomAssignmentsEnded: number }>}
 */
export async function reconcileStaffOnHorseTransfer(tx, { horseId }) {
  // HORSE row first (already claimed by the caller — no new lock taken).
  await tx.horse.update({ where: { id: horseId }, data: { rider: null } });

  const riderAssignmentsEnded = await endActiveAssignmentsOnHorse(tx.riderAssignment, {
    horseField: 'horseId',
    staffField: 'riderId',
    horseId,
  });
  const trainerAssignmentsEnded = await endActiveAssignmentsOnHorse(tx.trainerAssignment, {
    horseField: 'horseId',
    staffField: 'trainerId',
    horseId,
  });
  // Grooms carry an explicit `endDate`, written the same way the groom service
  // ends an assignment (groomAssignmentService.removeAssignment).
  const groomAssignmentsEnded = await endActiveAssignmentsOnHorse(tx.groomAssignment, {
    horseField: 'foalId',
    staffField: 'groomId',
    horseId,
    endData: { endDate: new Date() },
  });

  return { riderAssignmentsEnded, trainerAssignmentsEnded, groomAssignmentsEnded };
}

/**
 * Everything the outgoing owner keeps when a horse changes hands: their tack
 * comes off and goes back to their inventory, and their staff stop working on
 * a horse they no longer own.
 *
 * Ordered to the repository's lock ruling — `User` row (the seller's inventory)
 * before the `Horse` row before the assignment rows — even though both the User
 * and Horse rows are already write-locked by the caller's money move and
 * ownership claim, so no new lock is acquired here at all.
 *
 * @param {object} tx - the surrounding interactive Prisma transaction client
 * @param {{ horseId: number, sellerId: string }} params
 */
export async function reconcileHorseOnTransfer(tx, { horseId, sellerId }) {
  const tack = await returnTackToSeller(tx, { horseId, sellerId });
  const staff = await reconcileStaffOnHorseTransfer(tx, { horseId });

  // Test-only seam, AFTER every reconciliation write and before the sale record
  // and ledger rows. A test barrier that throws here proves the tack return and
  // the staff reconciliation share the purchase's rollback — the one thing an
  // insufficient-funds rejection cannot prove, because that fails in
  // `debitBuyer` before the claim and before this ever runs. No-op unless armed,
  // and `setMarketplaceRaceBarrier` refuses to arm outside NODE_ENV === 'test'.
  await awaitMarketplaceRaceBarrier('horseTransfer:afterReconciliation', { horseId, sellerId });

  return { ...tack, ...staff };
}

export default reconcileHorseOnTransfer;
