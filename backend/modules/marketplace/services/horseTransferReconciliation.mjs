/**
 * Horse-transfer staff reconciliation (audit 2026-07 finding 6 /
 * Equoria-6p398.6).
 *
 * WHY THIS EXISTS
 * A rider or trainer is an EMPLOYEE of a player, not a fitting on a horse:
 * `Rider.userId` / `Trainer.userId` are set when the player hires and pays for
 * them, and both assign endpoints require the caller to own the staff member
 * AND the horse. A sale moves the horse; it cannot move the employee. Before
 * this reconciliation the seller's assignment rows simply stayed active on a
 * horse they no longer owned, which had two live consequences:
 *
 *   - the seller's rider/trainer stayed "busy" forever — the assign endpoints
 *     refuse a staff member who already has an active assignment, so the
 *     seller could not put them on any other horse; and
 *   - `trainingController.trainHorse` resolves the active TrainerAssignment by
 *     `horseId` alone, so the BUYER's training sessions were modified by, and
 *     awarded XP to, the SELLER's trainer.
 *
 * WHAT IT DOES
 * Ends every active staff assignment on the transferred horse and clears the
 * horse's derived `rider` JSON (the representation `hasValidRider()` and the
 * competition engine read). The rows are deactivated, never deleted, so the
 * horse's care history survives; no `userId` is rewritten, so nobody's staff
 * changes hands. The buyer starts with a clean, riderless horse.
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
 * End the outgoing owner's staff associations for a horse that just changed
 * hands.
 *
 * @param {object} tx - the surrounding interactive Prisma transaction client
 * @param {{ horseId: number }} params
 * @returns {Promise<{ riderAssignmentsEnded: number, trainerAssignmentsEnded: number }>}
 */
export async function reconcileStaffOnHorseTransfer(tx, { horseId }) {
  // HORSE row first (already claimed by the caller — no new lock taken).
  await tx.horse.update({ where: { id: horseId }, data: { rider: null } });

  const riderAssignments = await tx.riderAssignment.updateMany({
    where: { horseId, isActive: true },
    data: { isActive: false },
  });
  const trainerAssignments = await tx.trainerAssignment.updateMany({
    where: { horseId, isActive: true },
    data: { isActive: false },
  });

  return {
    riderAssignmentsEnded: riderAssignments.count,
    trainerAssignmentsEnded: trainerAssignments.count,
  };
}

export default reconcileStaffOnHorseTransfer;
