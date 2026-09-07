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
 * two provenances and why they must be told apart.
 *
 * @module modules/marketplace/services/horseTransferReconciliation
 */

import { TACK_INVENTORY } from '../../economy/index.mjs';
import { updateUserSettingsPaths } from '../../../utils/userSettingsPaths.mjs';

/**
 * `Horse.tack` mirrors the numeric bonus of the two scored categories beside
 * the item id (`tackShopController.purchaseTackItem`). Those mirrors are
 * derived from the item, so they leave with it.
 */
const BONUS_MIRROR_KEYS = Object.freeze({ saddle: 'saddleBonus', bridle: 'bridleBonus' });

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
 * saddleBonus: <number>, bridleBonus: <number> }`. Only string-valued category
 * keys and the `decorations` array name an item; the numeric mirrors and any
 * other shape are not equipment and are left for the caller to handle.
 *
 * @param {object} tack
 * @returns {Array<{ key: string, category: string, itemId: string }>}
 */
function tackEntries(tack) {
  const entries = [];
  for (const [key, value] of Object.entries(tack)) {
    if (key === 'decorations') {
      if (Array.isArray(value)) {
        for (const itemId of value) {
          if (typeof itemId === 'string' && itemId) {
            entries.push({ key, category: 'decorative', itemId });
          }
        }
      }
      continue;
    }
    if (typeof value === 'string' && value) {
      entries.push({ key, category: key, itemId: value });
    }
  }
  return entries;
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
 * @returns {Promise<{ tackItemsReleased: number, tackItemsDerived: number }>}
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

  if (released.length === 0 && derived.length === 0) {
    return { tackItemsReleased: 0, tackItemsDerived: 0 };
  }

  // USER row first.
  const affected = await updateUserSettingsPaths(tx, sellerId, {
    set: { inventory: [...nextInventory, ...derived] },
    expect: { inventory: { equals: inventory, whenMissing: [] } },
  });
  if (affected !== 1) {
    throw Object.assign(
      new Error('The seller’s inventory changed while this purchase was completing. Please retry.'),
      { statusCode: 409 },
    );
  }

  // HORSE row second. Only the keys whose items were returned are removed (plus
  // their derived bonus mirrors), so an unrecognised key this code does not
  // understand is preserved rather than destroyed.
  if (entries.length > 0) {
    const strippedTack = { ...tack };
    for (const entry of entries) {
      delete strippedTack[entry.key];
      const mirrorKey = BONUS_MIRROR_KEYS[entry.category];
      if (mirrorKey) {
        delete strippedTack[mirrorKey];
      }
    }
    await tx.horse.update({ where: { id: horseId }, data: { tack: strippedTack } });
  }

  return { tackItemsReleased: released.length, tackItemsDerived: derived.length };
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
  return { ...tack, ...staff };
}

export default reconcileHorseOnTransfer;
