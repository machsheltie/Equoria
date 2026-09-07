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
 * @module modules/marketplace/services/horseTransferReconciliation
 */

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

export default reconcileStaffOnHorseTransfer;
