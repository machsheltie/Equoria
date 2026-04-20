/**
 * Rider Controller
 * Handles CRUD and assignment operations for riders.
 *
 * Mirrors groomController.mjs patterns with ownership protection.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

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
      // totalCompetitions is not yet tracked at the rider level — return 0
      // so the UI shows an honest "—" win rate instead of a fabricated estimate.
      // When rider-level competition tracking lands, this will return the real count.
      totalCompetitions: 0,
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
  try {
    const userId = req.user.id;
    const { riderId, horseId, notes } = req.body;

    // Verify rider belongs to user
    const rider = await prisma.rider.findFirst({ where: { id: riderId, userId } });
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    // Verify horse belongs to user
    const horse = await prisma.horse.findFirst({ where: { id: horseId, userId } });
    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }

    // Check if rider is already actively assigned to another horse
    const existingRiderAssignment = await prisma.riderAssignment.findFirst({
      where: { riderId, isActive: true },
    });
    if (existingRiderAssignment) {
      return res
        .status(400)
        .json({ success: false, message: 'Rider is already assigned to a horse. Unassign first.' });
    }

    // Deactivate any existing active rider on this horse
    await prisma.riderAssignment.updateMany({
      where: { horseId, isActive: true },
      data: { isActive: false },
    });

    const assignment = await prisma.riderAssignment.create({
      data: { riderId, horseId, userId, notes, isActive: true },
    });

    logger.info(
      `[riderController] Rider ${riderId} assigned to horse ${horseId} by user ${userId}`,
    );

    res.status(201).json({
      success: true,
      message: 'Rider assigned successfully',
      data: assignment,
    });
  } catch (error) {
    logger.error(`[riderController] assignRider error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to assign rider', data: null });
  }
}

/**
 * DELETE /api/riders/assignments/:id
 * Remove (deactivate) a rider assignment.
 */
export async function deleteRiderAssignment(req, res) {
  try {
    const userId = req.user.id;
    const assignmentId = parseInt(req.params.id, 10);

    const assignment = await prisma.riderAssignment.findFirst({
      where: { id: assignmentId, userId },
    });
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await prisma.riderAssignment.update({ where: { id: assignmentId }, data: { isActive: false } });

    logger.info(`[riderController] Assignment ${assignmentId} deactivated by user ${userId}`);

    res.status(200).json({ success: true, message: 'Rider unassigned successfully', data: null });
  } catch (error) {
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

    // Discovery unlocks at level thresholds (level 2, 4, 6, 8, 10, 12+)
    const discoveredCount = Math.min(Math.floor(rider.level / 2), 6);
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
        nextDiscoveryAt: discoveredCount < 6 ? (discoveredCount + 1) * 2 : null,
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
  try {
    const userId = req.user.id;
    const riderId = parseInt(req.params.id, 10);

    const rider = await prisma.rider.findFirst({ where: { id: riderId, userId } });
    if (!rider) {
      return res.status(404).json({ success: false, message: 'Rider not found' });
    }

    // Deactivate all active assignments before dismissing
    await prisma.riderAssignment.updateMany({
      where: { riderId, isActive: true },
      data: { isActive: false },
    });
    await prisma.rider.update({ where: { id: riderId }, data: { retired: true } });

    logger.info(`[riderController] Rider ${riderId} dismissed by user ${userId}`);

    res.status(200).json({ success: true, message: 'Rider dismissed successfully', data: null });
  } catch (error) {
    logger.error(`[riderController] dismissRider error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to dismiss rider', data: null });
  }
}
