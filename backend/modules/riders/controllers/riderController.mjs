/**
 * Rider Controller
 * Handles CRUD and assignment operations for riders.
 *
 * Mirrors groomController.mjs patterns with ownership protection.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { hiredStaffFee, staffCareerLevel } from '../../../constants/staffLevels.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
// Equoria-6p398.14 follow-up: a retired horse (21+, not in foal) is given no new rider.
import { assertHorseTakesNewStaffTx } from '../../horses/index.mjs';
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
      // Equoria-nawn5, owner ruling q226: what this rider costs a week is its star
      // level's price.
      weeklyRate: hiredStaffFee(r),
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
        rider: { select: { id: true, firstName: true, lastName: true, starLevel: true } },
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
      // Equoria-nawn5: the horse page's Care Team shows the rider's star level.
      riderStarLevel: a.rider.starLevel,
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
    // Equoria-6p398.6 (finding 6): the rider row and the assignment rows are ONE
    // state change. They commit together, in the project's lock order — Horse
    // row first, staff rows second — and the horse lock re-asserts CURRENT
    // ownership so a horse sold between this request's reads and its writes can
    // never be handed the former owner's rider.
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

        // Owner ruling 2026-10-23: a retired horse (21+, not in foal) takes no new
        // rider — 400 'horseRetired'. This locks the HORSE row first (lock order),
        // so the nightly birthday release cannot slip between check and assign.
        await assertHorseTakesNewStaffTx(tx, horseId);

        // HORSE row first. The RiderAssignment row is the one record of who rides
        // the horse (the Horse.rider JSON copy is gone, Equoria-97se). The
        // `userId` predicate on the locked read is the authoritative ownership
        // check — no row means the horse changed hands after the read above, and
        // the whole assignment rolls back rather than writing a rider onto a
        // stranger's horse.
        const claimed = await tx.$queryRaw`
          SELECT "id" FROM "horses" WHERE "id" = ${horseId} AND "userId" = ${userId} FOR UPDATE`;
        if (claimed.length !== 1) {
          throw httpError(409, HORSE_NOT_YOURS);
        }

        // Equoria-j8s5c: then LOCK the rider row (a real write, as the trainer
        // flow does) BEFORE the "already assigned" read, so a concurrent assign
        // of this same rider to ANOTHER horse waits here and then sees this
        // assignment. Without it both read "not assigned" and the rider went
        // active on two horses. Horse before staff keeps the lock order.
        // Equoria-r9u5k: the lock is a guarded write that re-checks `retired`,
        // so a rider the weekly job retired after the read above is refused.
        const lockedRider = await tx.rider.updateMany({
          where: { id: riderId, retired: false },
          data: { updatedAt: new Date() },
        });
        if (lockedRider.count !== 1) {
          throw httpError(400, 'Cannot assign a retired rider');
        }

        const existingRiderAssignment = await tx.riderAssignment.findFirst({
          where: { riderId, isActive: true },
        });
        if (existingRiderAssignment) {
          throw httpError(400, 'Rider is already assigned to a horse. Unassign first.');
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
      return res.status(error.status).json({
        success: false,
        message: error.message,
        // A machine-readable refusal code when the error carries one ('horseRetired').
        ...(error.code ? { code: error.code } : {}),
        data: null,
      });
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
    // `userId`, accepted an inactive row, and acted on the horse by id with no
    // ownership predicate — so a previous owner (or the same owner's superseded
    // assignment) could end the rider that is currently on the horse. Both
    // facts are now re-proved inside one transaction, in the project's lock
    // order (Horse row, then staff rows):
    //   - the horse must still belong to the caller, and
    //   - this assignment must still be the ACTIVE one.
    // Either predicate failing rolls the transaction back.
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

        // Lock the horse row, but only a horse still owned by the caller.
        const locked = await tx.$queryRaw`
          SELECT "id" FROM "horses" WHERE "id" = ${assignment.horseId} AND "userId" = ${userId} FOR UPDATE`;
        if (locked.length !== 1) {
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

    // Stepped reveal cadence (Equoria-oey96.25): slots unlock at career levels
    // 2, 4, 6, 8, 9, 10. Every rider sits at level 1 (owner ruling 2026-10-28, q244:
    // stars give nothing for now), so none is revealed until staff growth (xlw03).
    const discoveredCount = getRevealedDiscoveryCount(staffCareerLevel);
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
    // Equoria-6p398.6 (finding 6): dismissing ends the assignment rows and
    // retires the rider in one transaction, in lock order (Horse rows, then
    // staff rows), locking only horses the caller still owns.
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
          // Lock the caller's horses in ascending id order before the staff rows.
          await tx.$queryRaw`
            SELECT "id" FROM "horses" WHERE "id" = ANY(${horseIds}) AND "userId" = ${userId} ORDER BY "id" FOR UPDATE`;
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
