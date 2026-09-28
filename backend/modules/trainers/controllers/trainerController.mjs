/**
 * Trainer Controller
 * Handles CRUD and assignment operations for trainers.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  generateDiscoverySlots,
  readDiscoverySlots,
  writeDiscoverySlots,
} from '../services/trainerDiscoveryService.mjs';
import {
  getRevealedDiscoveryCount,
  getNextDiscoveryRevealLevel,
} from '../../../utils/discoverySlotReveal.mjs';

/**
 * Build an error the assignment catch blocks turn into a specific HTTP
 * status. Mirrors riderController.mjs's helper.
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
 * GET /api/trainers/user/:userId
 */
export async function getUserTrainers(req, res) {
  try {
    const userId = req.user.id;
    const trainers = await prisma.trainer.findMany({
      where: { userId, retired: false },
      include: {
        assignments: {
          where: { isActive: true },
          select: { id: true, horseId: true, startDate: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = trainers.map(t => ({
      ...t,
      name: `${t.firstName} ${t.lastName}`,
      assignedHorseId: t.assignments[0]?.horseId ?? null,
    }));

    res.status(200).json({
      success: true,
      message: 'Trainers retrieved successfully',
      data: formatted,
    });
  } catch (error) {
    logger.error(`[trainerController] getUserTrainers error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to get trainers', data: null });
  }
}

/**
 * GET /api/trainers/assignments
 */
export async function getTrainerAssignments(req, res) {
  try {
    const userId = req.user.id;
    const assignments = await prisma.trainerAssignment.findMany({
      where: { userId, isActive: true },
      include: {
        trainer: { select: { id: true, firstName: true, lastName: true } },
        horse: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    const formatted = assignments.map(a => ({
      id: a.id,
      trainerId: a.trainerId,
      horseId: a.horseId,
      horseName: a.horse.name,
      trainerName: `${a.trainer.firstName} ${a.trainer.lastName}`,
      startDate: a.startDate,
      isActive: a.isActive,
    }));

    res.status(200).json({
      success: true,
      message: 'Trainer assignments retrieved successfully',
      data: formatted,
    });
  } catch (error) {
    logger.error(`[trainerController] getTrainerAssignments error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get trainer assignments', data: null });
  }
}

/**
 * POST /api/trainers/assignments
 * Body: { trainerId, horseId, notes? }
 */
export async function assignTrainer(req, res) {
  const userId = req.user.id;
  const { trainerId, horseId, notes } = req.body;
  try {
    // Equoria-bvddn.8: the "does this trainer already have an active
    // assignment?" read and the deactivate-then-create write were two
    // separate, unwrapped statements. Two concurrent assign requests for the
    // SAME trainer but DIFFERENT horses could both read "no active
    // assignment" before either committed, then both insert — the DB's only
    // constraint here (the kccmt partial unique index) is scoped to the
    // (trainerId, horseId) PAIR, so it stops double-booking the same horse
    // but not the trainer going active on two horses at once. Mirrors
    // riderController.mjs's assignRider pattern: everything below runs
    // inside one transaction, and the trainer row is re-written (touching
    // its own `updatedAt`) BEFORE the "already assigned" read so that read
    // is serialized against any concurrent transaction for the same
    // trainerId — the second waits for the first's row lock and then
    // observes its committed result. Unlike Horse.rider, there is no
    // Horse.trainer field to write, so — unlike the rider flow — there is no
    // Horse-row lock step here; lock order stays User -> Horse (read-only
    // ownership check) -> staff row (the trainer-row lock).
    const assignment = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const trainer = await tx.trainer.findFirst({ where: { id: trainerId, userId } });
        if (!trainer) {
          throw httpError(404, 'Trainer not found');
        }

        // Equoria-oey96.24: retired trainers cannot be assigned (PRD-06 §2.3).
        // A retired trainer the player owns IS found, so reject with a
        // distinct 400 (a business-rule rejection, matching the sibling
        // "already assigned to a horse" 400 below) rather than folding it
        // into the 404 not-found path. The UI already hides retired trainers
        // (getUserTrainers filters retired:false); this is the
        // assign-endpoint boundary enforcement so a direct API call cannot
        // bypass the display-layer filter.
        if (trainer.retired) {
          throw httpError(400, 'Cannot assign a retired trainer');
        }

        const horse = await tx.horse.findFirst({
          where: { id: horseId, userId },
          select: { id: true },
        });
        if (!horse) {
          throw httpError(404, 'Horse not found');
        }

        // Lock the trainer row (real write — touches `updatedAt`) BEFORE the
        // existing-assignment read below, so a concurrent assign request for
        // this same trainerId blocks here until this transaction commits,
        // then re-reads the now-committed state instead of racing it.
        await tx.trainer.update({ where: { id: trainerId }, data: { updatedAt: new Date() } });

        const existingAssignment = await tx.trainerAssignment.findFirst({
          where: { trainerId, isActive: true },
        });
        if (existingAssignment) {
          throw httpError(400, 'Trainer is already assigned to a horse. Unassign first.');
        }

        // Deactivate existing trainer on this horse
        await tx.trainerAssignment.updateMany({
          where: { horseId, isActive: true },
          data: { isActive: false },
        });

        return tx.trainerAssignment.create({
          data: { trainerId, horseId, userId, notes, isActive: true },
        });
      }),
      { message: 'Trainer assignments are busy right now, please retry in a moment.' },
    );

    res
      .status(201)
      .json({ success: true, message: 'Trainer assigned successfully', data: assignment });
  } catch (error) {
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[trainerController] assignTrainer error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to assign trainer', data: null });
  }
}

/**
 * DELETE /api/trainers/assignments/:id
 */
export async function deleteTrainerAssignment(req, res) {
  try {
    const userId = req.user.id;
    const assignmentId = parseInt(req.params.id, 10);

    const assignment = await prisma.trainerAssignment.findFirst({
      where: { id: assignmentId, userId },
    });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await prisma.trainerAssignment.update({
      where: { id: assignmentId },
      data: { isActive: false },
    });

    res.status(200).json({ success: true, message: 'Trainer unassigned successfully', data: null });
  } catch (error) {
    logger.error(`[trainerController] deleteTrainerAssignment error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to unassign trainer', data: null });
  }
}

/**
 * GET /api/trainers/:id/discovery
 * Returns discovery slots for a trainer (career affinity discoveries).
 * 3 categories × 2 slots = 6 total.
 * Trait content is persisted in discovery_slots JSONB; visibility is computed
 * from trainer level via the stepped reveal cadence (Equoria-oey96.25):
 * slots unlock at levels 2, 4, 6, 8, 9, 10 — all 6 revealable at the level-10 cap.
 */
export async function getTrainerDiscovery(req, res) {
  try {
    const userId = req.user.id;
    const trainerId = parseInt(req.params.id, 10);

    const trainer = await prisma.trainer.findFirst({ where: { id: trainerId, userId } });
    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found' });
    }

    // Read persisted trait pool; auto-seed for legacy trainers with empty slots.
    let slotPool = await readDiscoverySlots(trainerId);
    if (slotPool.length === 0) {
      slotPool = generateDiscoverySlots(trainer.speciality, trainer.personality);
      await writeDiscoverySlots(trainerId, slotPool);
    }

    const discoveredCount = getRevealedDiscoveryCount(trainer.level);

    const slots = slotPool.map(slot => ({
      slotIndex: slot.slotIndex,
      category: slot.category,
      discovered: slot.slotIndex < discoveredCount,
      trait:
        slot.slotIndex < discoveredCount
          ? {
              id: `${slot.category}_${slot.slotIndex}`,
              label: slot.label,
              description: slot.description,
              icon: slot.icon,
              strength: slot.strength,
            }
          : undefined,
    }));

    res.status(200).json({
      success: true,
      message: 'Trainer discovery data retrieved',
      data: {
        trainerId,
        totalSlots: 6,
        discoveredCount,
        slots,
        nextDiscoveryAt: getNextDiscoveryRevealLevel(discoveredCount) ?? undefined,
      },
    });
  } catch (error) {
    logger.error(`[trainerController] getTrainerDiscovery error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get trainer discovery', data: null });
  }
}

/**
 * DELETE /api/trainers/:id/dismiss
 */
export async function dismissTrainer(req, res) {
  const userId = req.user.id;
  const trainerId = parseInt(req.params.id, 10);
  try {
    // Equoria-bvddn.8: deactivating the active assignment rows and retiring
    // the trainer were two separate, unwrapped statements — a crash or a
    // concurrent assign between them could leave assignments deactivated but
    // the trainer not retired (or vice versa). Both now commit together, in
    // the same trainer-row-lock order as assignTrainer, mirroring
    // riderController.mjs's dismissRider. There is no Horse.trainer field to
    // clear (unlike Horse.rider), so this transaction only ever locks the
    // trainer row, not a horse row.
    await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        const trainer = await tx.trainer.findFirst({ where: { id: trainerId, userId } });
        if (!trainer) {
          throw httpError(404, 'Trainer not found');
        }

        await tx.trainerAssignment.updateMany({
          where: { trainerId, isActive: true },
          data: { isActive: false },
        });
        await tx.trainer.update({ where: { id: trainerId }, data: { retired: true } });
      }),
      { message: 'Trainer assignments are busy right now, please retry in a moment.' },
    );

    logger.info(`[trainerController] Trainer ${trainerId} dismissed by user ${userId}`);

    res.status(200).json({ success: true, message: 'Trainer dismissed successfully', data: null });
  } catch (error) {
    if (typeof error?.status === 'number') {
      return res.status(error.status).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[trainerController] dismissTrainer error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to dismiss trainer', data: null });
  }
}
