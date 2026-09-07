/**
 * Rider Controller
 * Handles CRUD and assignment operations for riders.
 *
 * Mirrors groomController.mjs patterns with ownership protection.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  getRevealedDiscoveryCount,
  getNextDiscoveryRevealLevel,
} from '../../../utils/discoverySlotReveal.mjs';

/**
 * Build an error the assignment catch blocks turn into a specific HTTP status.
 * Mirrors the inventory controller's helper: `status` is the numeric code the
 * local catch reads (retryableTransaction.mjs documents the three idioms).
 *
 * @param {number} status
 * @param {string} message
 */
function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Message for a request that names a horse the caller no longer owns.
 * Same wording as the inventory controller's ownership guard — a former owner
 * acting on a sold horse gets one consistent, honest answer across the app.
 */
const HORSE_NOT_YOURS = 'That horse is no longer yours. Please reload your stable.';

/**
 * Message for a request that names an assignment which is no longer the
 * horse's current one (already unassigned, or superseded by a replacement).
 * Rejecting is the only honest outcome: the requested end state already holds,
 * and continuing would clear a rider this request never chose.
 */
const ASSIGNMENT_NOT_CURRENT =
  'That rider assignment is no longer active. Please reload your stable.';

/**
 * GET /api/riders/user/:userId
 * Returns all active riders for the authenticated user.
 */
export async function getUserRiders(req, res) {
  try {
    const userId = req.user.id;
    const riders = await prisma.rider.findMany({
      where: { userId, retired: false },
      include: {
        assignments: {
          where: { isActive: true },
          select: { id: true, horseId: true, startDate: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = riders.map(r => ({
      ...r,
      name: `${r.firstName} ${r.lastName}`,
      assignedHorseId: r.assignments[0]?.horseId ?? null,
      hiredDate: r.createdAt?.toISOString?.() ?? r.createdAt,
      totalCompetitions: r.totalCompetitions,
      totalWins: r.totalWins,
    }));

    res.status(200).json({
      success: true,
      message: 'Riders retrieved successfully',
      data: formatted,
    });
  } catch (error) {
    logger.error(`[riderController] getUserRiders error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to get riders', data: null });
  }
}

/**
 * GET /api/riders/assignments
 * Returns all active rider assignments for the authenticated user.
 */
export async function getRiderAssignments(req, res) {
  try {
    const userId = req.user.id;
    const assignments = await prisma.riderAssignment.findMany({
      where: { userId, isActive: true },
      include: {
        rider: { select: { id: true, firstName: true, lastName: true } },
        horse: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const formatted = assignments.map(a => ({
      id: a.id,
      riderId: a.riderId,
      horseId: a.horseId,
      horseName: a.horse.name,
      riderName: `${a.rider.firstName} ${a.rider.lastName}`,
      startDate: a.startDate,
      isActive: a.isActive,
    }));

    res.status(200).json({
      success: true,
      message: 'Rider assignments retrieved successfully',
      data: formatted,
    });
  } catch (error) {
    logger.error(`[riderController] getRiderAssignments error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get rider assignments', data: null });
  }
}

/**
 * POST /api/riders/assignments
 * Assign a rider to a horse.
 * Body: { riderId, horseId, notes? }
 */
export async function assignRider(req, res) {
  const userId = req.user.id;
  const { riderId, horseId, notes } = req.body;
  try {
    // Equoria-6p398.6 (finding 6): the rider row, the horse's `rider` JSON and
    // the assignment rows are ONE state change. They commit together, in the
    // project's lock order — Horse row first, staff rows second — and the horse
    // write re-asserts CURRENT ownership so a horse sold between this request's
    // reads and its writes can never be handed the former owner's rider.
    const assignment = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        // Verify rider belongs to user
        const rider = await tx.rider.findFirst({ where: { id: riderId, userId } });
        if (!rider) {
          throw httpError(404, 'Rider not found');
        }

        // Equoria-oey96.24: retired riders cannot be assigned (PRD-05 §2.3). A
        // retired rider the player owns IS found, so reject with a distinct 400
        // (a business-rule rejection, matching the sibling "already assigned to
        // a horse" 400 below) rather than folding it into the 404 not-found
        // path — "not found" would be a misleading message for a rider the
        // player owns. The UI already hides retired riders (getUserRiders
        // filters retired:false); this is the assign-endpoint boundary
        // enforcement so a direct API call cannot bypass the display filter.
        if (rider.retired) {
          throw httpError(400, 'Cannot assign a retired rider');
        }

        // Verify horse belongs to user
        const horse = await tx.horse.findFirst({
          where: { id: horseId, userId },
          select: { id: true },
        });
        if (!horse) {
          throw httpError(404, 'Horse not found');
        }

        // Check if rider is already actively assigned to another horse
        const existingRiderAssignment = await tx.riderAssignment.findFirst({
          where: { riderId, isActive: true },
        });
        if (existingRiderAssignment) {
          throw httpError(400, 'Rider is already assigned to a horse. Unassign first.');
        }

        // HORSE row first. Syncing the horse.rider JSONB field is what makes
        // hasValidRider() true for competition entry; RiderAssignment alone is
        // not sufficient. The `userId` predicate is the authoritative ownership
        // check — count 0 means the horse changed hands after the read above,
        // and the whole assignment rolls back rather than writing a rider onto
        // a stranger's horse.
        const claimed = await tx.horse.updateMany({
          where: { id: horseId, userId },
          data: {
            rider: {
              id: rider.id,
              name: rider.name,
              level: rider.level,
              speciality: rider.speciality,
            },
          },
        });
        if (claimed.count !== 1) {
          throw httpError(409, HORSE_NOT_YOURS);
        }

        // Staff rows second: deactivate any existing active rider on this horse.
        await tx.riderAssignment.updateMany({
          where: { horseId, isActive: true },
          data: { isActive: false },
        });

        return tx.riderAssignment.create({
          data: { riderId, horseId, userId, notes, isActive: true },
        });
      }),
      { message: 'Rider assignments are busy right now, please retry in a moment.' },
    );

    logger.info(
      `[riderController] Rider ${riderId} assigned to horse ${horseId} by user ${userId}`,
    );

    res.status(201).json({
      success: true,
      message: 'Rider assigned successfully',
      data: assignment,
    });
  } catch (error) {
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[riderController] assignRider error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to assign rider', data: null });
  }
}

/**
 * DELETE /api/riders/assignments/:id
 * Remove (deactivate) a rider assignment.
 */
export async function deleteRiderAssignment(req, res) {
  const userId = req.user.id;
  const assignmentId = parseInt(req.params.id, 10);
  try {
    // Equoria-6p398.6 (finding 6): owning the ASSIGNMENT ROW is not authority
    // over the HORSE. The pre-fix endpoint authorized on the row's stored
    // `userId`, accepted an inactive row, and then cleared `Horse.rider` by
    // horse id with no ownership predicate — so a previous owner (or the same
    // owner's superseded assignment) could null the rider that is currently on
    // the horse. Both facts are now re-proved as WRITE predicates inside one
    // transaction, in the project's lock order (Horse row, then staff rows):
    //   - the horse must still belong to the caller, and
    //   - this assignment must still be the ACTIVE one.
    // Either predicate failing rolls the other write back, so the assignment
    // status and the horse's rider can never disagree about what happened.
    await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const assignment = await tx.riderAssignment.findFirst({
          where: { id: assignmentId, userId },
          select: { id: true, horseId: true, isActive: true },
        });
        if (!assignment) {
          throw httpError(404, 'Assignment not found');
        }
        // Cheap pre-check so stale-delete spam is rejected without taking an
        // exclusive lock on the horse row and rolling it back. It is NOT the
        // authority — the guarded UPDATE below is, and it re-proves this under
        // a concurrent writer.
        if (!assignment.isActive) {
          throw httpError(409, ASSIGNMENT_NOT_CURRENT);
        }

        // Clear horse.rider JSONB so the competition engine sees the horse as
        // riderless after unassignment — but only on a horse still owned by the
        // caller.
        const cleared = await tx.horse.updateMany({
          where: { id: assignment.horseId, userId },
          data: { rider: null },
        });
        if (cleared.count !== 1) {
          throw httpError(409, HORSE_NOT_YOURS);
        }

        const deactivated = await tx.riderAssignment.updateMany({
          where: { id: assignmentId, userId, horseId: assignment.horseId, isActive: true },
          data: { isActive: false },
        });
        if (deactivated.count !== 1) {
          throw httpError(409, ASSIGNMENT_NOT_CURRENT);
        }
      }),
      { message: 'Rider assignments are busy right now, please retry in a moment.' },
    );

    logger.info(`[riderController] Assignment ${assignmentId} deactivated by user ${userId}`);

    res.status(200).json({ success: true, message: 'Rider unassigned successfully', data: null });
  } catch (error) {
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[riderController] deleteRiderAssignment error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unassign rider', data: null });
  }
}

/**
 * GET /api/riders/:id/discovery
 * Returns discovery slots for a rider (career affinity discoveries).
 */
export async function getRiderDiscovery(req, res) {
  try {
    const userId = req.user.id;
    const riderId = parseInt(req.params.id, 10);

    const rider = await prisma.rider.findFirst({ where: { id: riderId, userId } });
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    // Stepped reveal cadence (Equoria-oey96.25): slots unlock at levels
    // 2, 4, 6, 8, 9, 10 — all 6 revealable by the level-10 cap. The prior
    // Math.floor(level/2) formula left the 6th slot permanently hidden.
    const discoveredCount = getRevealedDiscoveryCount(rider.level);
    const categories = ['discipline_affinity', 'temperament_compatibility', 'gait_affinity'];
    const slots = Array.from({ length: 6 }, (_, i) => ({
      slotIndex: i,
      category: categories[Math.floor(i / 2)],
      discovered: i < discoveredCount,
      trait:
        i < discoveredCount
          ? {
              id: `${categories[Math.floor(i / 2)]}_${i}`,
              category: categories[Math.floor(i / 2)],
              label: `${rider.speciality} Affinity`,
              value: rider.speciality,
              strength: i < 2 ? 'minor' : i < 4 ? 'moderate' : 'strong',
              discoveredAt: rider.createdAt,
              icon: '✨',
              description: `Discovered ${rider.speciality} affinity through competitive experience.`,
            }
          : undefined,
    }));

    res.status(200).json({
      success: true,
      message: 'Rider discovery data retrieved',
      data: {
        riderId,
        totalSlots: 6,
        discoveredCount,
        slots,
        nextDiscoveryAt: getNextDiscoveryRevealLevel(discoveredCount),
      },
    });
  } catch (error) {
    logger.error(`[riderController] getRiderDiscovery error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to get rider discovery', data: null });
  }
}

/**
 * DELETE /api/riders/:id/dismiss
 * Dismiss (retire) a rider from the user's stable.
 */
export async function dismissRider(req, res) {
  const userId = req.user.id;
  const riderId = parseInt(req.params.id, 10);
  try {
    // Equoria-6p398.6 (finding 6): dismissing deactivated the assignment rows
    // but left `Horse.rider` populated, so a dismissed rider kept satisfying
    // hasValidRider() on their old horses. Both representations now end in one
    // transaction, in lock order (Horse rows, then staff rows), and the horse
    // write is scoped to horses the caller still owns.
    await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const rider = await tx.rider.findFirst({
          where: { id: riderId, userId },
          select: { id: true },
        });
        if (!rider) {
          throw httpError(404, 'Rider not found');
        }

        const active = await tx.riderAssignment.findMany({
          where: { riderId, isActive: true },
          select: { horseId: true },
        });
        // Ascending primary-key order for the multi-row write (project lock
        // ordering ruling).
        const horseIds = [...new Set(active.map(a => a.horseId))].sort((a, b) => a - b);

        if (horseIds.length > 0) {
          await tx.horse.updateMany({
            where: { id: { in: horseIds }, userId },
            data: { rider: null },
          });
        }

        // Deactivate all active assignments before dismissing
        await tx.riderAssignment.updateMany({
          where: { riderId, isActive: true },
          data: { isActive: false },
        });
        await tx.rider.update({ where: { id: riderId }, data: { retired: true } });
      }),
      { message: 'Rider assignments are busy right now, please retry in a moment.' },
    );

    logger.info(`[riderController] Rider ${riderId} dismissed by user ${userId}`);

    res.status(200).json({ success: true, message: 'Rider dismissed successfully', data: null });
  } catch (error) {
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[riderController] dismissRider error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to dismiss rider', data: null });
  }
}
