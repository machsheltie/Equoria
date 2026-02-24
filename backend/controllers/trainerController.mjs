/**
 * Trainer Controller
 * Handles CRUD and assignment operations for trainers.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

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
  try {
    const userId = req.user.id;
    const { trainerId, horseId, notes } = req.body;

    const trainer = await prisma.trainer.findFirst({ where: { id: trainerId, userId } });
    if (!trainer) return res.status(404).json({ success: false, message: 'Trainer not found' });

    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) return res.status(404).json({ success: false, message: 'Horse not found' });

    const existingAssignment = await prisma.trainerAssignment.findFirst({
      where: { trainerId, isActive: true },
    });
    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Trainer is already assigned to a horse. Unassign first.',
      });
    }

    // Deactivate existing trainer on this horse
    await prisma.trainerAssignment.updateMany({
      where: { horseId, isActive: true },
      data: { isActive: false },
    });

    const assignment = await prisma.trainerAssignment.create({
      data: { trainerId, horseId, userId, notes, isActive: true },
    });

    res
      .status(201)
      .json({ success: true, message: 'Trainer assigned successfully', data: assignment });
  } catch (error) {
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
    if (!assignment)
      return res.status(404).json({ success: false, message: 'Assignment not found' });

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
 * DELETE /api/trainers/:id/dismiss
 */
export async function dismissTrainer(req, res) {
  try {
    const userId = req.user.id;
    const trainerId = parseInt(req.params.id, 10);

    const trainer = await prisma.trainer.findFirst({ where: { id: trainerId, userId } });
    if (!trainer) return res.status(404).json({ success: false, message: 'Trainer not found' });

    await prisma.trainerAssignment.updateMany({
      where: { trainerId, isActive: true },
      data: { isActive: false },
    });
    await prisma.trainer.update({ where: { id: trainerId }, data: { retired: true } });

    logger.info(`[trainerController] Trainer ${trainerId} dismissed by user ${userId}`);

    res.status(200).json({ success: true, message: 'Trainer dismissed successfully', data: null });
  } catch (error) {
    logger.error(`[trainerController] dismissTrainer error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to dismiss trainer', data: null });
  }
}
