/**
 * The foal-assignment door — `POST /api/grooms/assign`.
 *
 * No foal is ever born with, or given, a groom by the game (owner ruling 2026-10-28,
 * q153): the deprecated default-assignment helper, which created a "Sarah Johnson"
 * groom and assignment in test mode, was deleted with its route. Players hire grooms
 * from the hiring pool and assign them here.
 *
 * Split out of backend/utils/groomSystem.mjs by Equoria-95yrv fix round 1 (F1), which
 * made this door TRANSACTIONAL and pushed that file back over the 600-line cap. The
 * split is also the right seam: everything left in groomSystem is interaction
 * ARITHMETIC (specialty/skill/personality tables, effects, daily-task rules), while
 * this is a staffing WRITE with a cap, a lock and a transaction. `groomSystem`
 * re-exports both functions, so every importer — the handlers, foalController and
 * the existing suites — is unchanged.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
// Equoria-95yrv: the ten-horse cap is the FEE's cap, defined once with the fee.
import {
  acquireGroomRosterLockTx,
  assertGroomHasRoomForAnotherHorse,
} from './groomFeeBasisService.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
// Equoria-6p398.14 follow-up: a retired horse (21+, not in foal) is given no new groom.
import { assertHorseTakesNewStaffTx } from '../../horses/index.mjs';

/**
 * Assign a groom to a foal
 * @param {number} foalId - ID of the foal
 * @param {number} groomId - ID of the groom
 * @param {string} userId - ID of the user
 * @param {Object} options - Assignment options
 * @returns {Object} Assignment result
 */
export async function assignGroomToFoal(foalId, groomId, userId, options = {}) {
  const { priority = 1, notes = null, isDefault = false } = options;

  logger.info(`[groomSystem.assignGroomToFoal] Assigning groom ${groomId} to foal ${foalId}`);

  // Validate foal exists
  const foal = await prisma.horse.findUnique({
    where: { id: foalId },
    select: { id: true, name: true, age: true },
  });

  if (!foal) {
    throw new Error(`Foal with ID ${foalId} not found`);
  }

  // Validate groom exists and is available
  const groom = await prisma.groom.findUnique({
    where: { id: groomId },
    select: {
      id: true,
      name: true,
      speciality: true,
      skillLevel: true,
      isActive: true,
      availability: true,
      userId: true, // Correct field name for groom ownership
    },
  });

  if (!groom) {
    throw new Error(`Groom with ID ${groomId} not found`);
  }

  // CWE-639 (Equoria-a7dy): cross-user access must be indistinguishable
  // from not-found. Ownership of `groom` is enforced upstream by the
  // `findOwnedResource('groom')` middleware on POST /api/grooms/assign
  // (groomRoutes.mjs:170), which 404s before this throw is reachable.
  // This branch is defense-in-depth — collapse the disclosure-leaky
  // 'You do not own groom X' string into the same 'Groom not found'
  // message used by the missing-row case above so a bypass cannot
  // surface ownership status via error text.
  if (groom.userId !== userId) {
    throw new Error(`Groom with ID ${groomId} not found`);
  }

  if (!groom.isActive) {
    throw new Error(`Groom ${groom.name} is not currently active`);
  }

  // Check for existing active assignment
  const existingAssignment = await prisma.groomAssignment.findFirst({
    where: {
      foalId,
      groomId,
      isActive: true,
    },
  });

  if (existingAssignment) {
    throw new Error(`Groom ${groom.name} is already assigned to this foal`);
  }

  // Equoria-95yrv (fix round 1, F1): at most ten horses, enforced ATOMICALLY. This
  // door had no limit at all before the ruling, and the first fix left the count and
  // the create as two statements — two requests at nine horses both passed. The
  // roster lock is the transaction's first statement, the re-count runs under it,
  // and the primary-assignment retirement now commits with the create instead of
  // standing alone. See acquireGroomRosterLockTx for why a guarded
  // `INSERT ... SELECT ... WHERE (COUNT) < 10` does not hold under READ COMMITTED.
  const assignment = await withRetryableTxMapping(
    prisma.$transaction(async tx => {
      await acquireGroomRosterLockTx(tx, groomId);
      // Owner ruling 2026-10-23: no new staff for a retired horse. Locks the horse
      // row, so the nightly birthday release cannot slip between check and create.
      await assertHorseTakesNewStaffTx(tx, foalId);
      await assertGroomHasRoomForAnotherHorse(tx, groomId, groom.name);

      // Deactivate other assignments if this is primary (priority 1)
      if (priority === 1) {
        await tx.groomAssignment.updateMany({
          where: {
            foalId,
            priority: 1,
            isActive: true,
          },
          data: {
            isActive: false,
            endDate: new Date(),
          },
        });
      }

      // Create new assignment
      return tx.groomAssignment.create({
        data: {
          foalId,
          groomId,
          userId,
          priority,
          notes,
          isDefault,
          isActive: true,
        },
        include: {
          groom: true,
          foal: {
            select: { id: true, name: true },
          },
        },
      });
    }),
    { message: 'Could not assign the groom just now. Please try again.' },
  );

  logger.info(
    `[groomSystem.assignGroomToFoal] Successfully assigned ${groom.name} to foal ${foal.name}`,
  );

  return {
    success: true,
    assignment,
    message: `${groom.name} has been assigned to ${foal.name}`,
  };
}

export default { assignGroomToFoal };
