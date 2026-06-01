/**
 * Groom Assignment Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: assignGroom, ensureDefaultAssignment, getFoalAssignments,
 * getGroomAssignmentLogs.
 */

import { assignGroomToFoal, ensureDefaultGroomAssignment } from '../../../utils/groomSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * POST /api/grooms/assign
 * Assign a groom to a foal
 */
export async function assignGroom(req, res) {
  try {
    const { foalId, groomId, priority = 1, notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      logger.error('[groomController.assignGroom] No authenticated user ID found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        data: null,
      });
    }

    logger.info(`[groomController.assignGroom] Assigning groom ${groomId} to foal ${foalId}`);

    // Validate required fields
    if (!foalId || !groomId) {
      return res.status(400).json({
        success: false,
        message: 'foalId and groomId are required',
        data: null,
      });
    }

    // Ownership validated by inline dual-ownership middleware on the route
    // (groomRoutes.mjs `POST /assign`), which uses findOwnedResource('foal',...)
    // and findOwnedResource('groom',...) and returns 404 for both not-found
    // and not-owned (CWE-639 disclosure resistance).

    const result = await assignGroomToFoal(foalId, groomId, userId, {
      priority,
      notes,
      isDefault: false,
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.assignment,
    });
    return null;
  } catch (error) {
    logger.error(`[groomController.assignGroom] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign groom',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
    return null;
  }
}

/**
 * POST /api/grooms/ensure-default/:foalId
 * Ensure a foal has a default groom assignment
 */
export async function ensureDefaultAssignment(req, res) {
  try {
    const { foalId } = req.params;
    const userId = req.user?.id;

    // Validate user authentication
    if (!userId) {
      logger.error('[groomController.ensureDefaultAssignment] No authenticated user ID found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        data: null,
      });
    }

    // Validate foalId parameter
    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid foal ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(
      `[groomController.ensureDefaultAssignment] Ensuring default assignment for foal ${parsedFoalId}`,
    );

    // Ownership validated by requireOwnership('foal') middleware on the route.
    // req.foal is the validated, owned record. The middleware returns 404 for
    // both not-found and not-owned (CWE-639 disclosure resistance).

    // Call the ensureDefaultGroomAssignment service
    const result = await ensureDefaultGroomAssignment(parsedFoalId, userId);

    // Handle the result based on success status
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        data: {
          requiresManualAssignment: result.requiresManualAssignment || false,
          foalId: parsedFoalId,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        assignment: result.assignment,
        isNew: result.isNew || false,
        isExisting: result.isExisting || false,
      },
    });
  } catch (error) {
    logger.error(`[groomController.ensureDefaultAssignment] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to ensure default assignment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}

/**
 * GET /api/grooms/assignments/:foalId
 * Get all assignments for a foal
 */
export async function getFoalAssignments(req, res) {
  try {
    const { foalId } = req.params;

    const parsedFoalId = parseInt(foalId, 10);
    if (isNaN(parsedFoalId) || parsedFoalId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid foal ID. Must be a positive integer.',
        data: null,
      });
    }

    logger.info(
      `[groomController.getFoalAssignments] Getting assignments for foal ${parsedFoalId}`,
    );

    const assignments = await prisma.groomAssignment.findMany({
      where: { foalId: parsedFoalId },
      include: {
        groom: true,
        foal: {
          select: { id: true, name: true, bondScore: true, stressLevel: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
    });

    res.status(200).json({
      success: true,
      message: `Retrieved ${assignments.length} assignments for foal`,
      data: {
        foalId: parsedFoalId,
        assignments,
        activeAssignments: assignments.filter(a => a.isActive),
        totalAssignments: assignments.length,
      },
    });
    return null;
  } catch (error) {
    logger.error(`[groomController.getFoalAssignments] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve foal assignments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
    return null;
  }
}

/**
 * GET /api/grooms/:id/assignment-logs
 * Equoria-wb7z — Surface GroomAssignmentLog rows for a single groom so the
 * frontend can render assignment history (milestonesCompleted, traitsShaped,
 * xpGained per past assignment). Ownership is enforced by route middleware.
 */
export async function getGroomAssignmentLogs(req, res) {
  try {
    const { id } = req.params;
    const groomId = parseInt(id, 10);
    if (isNaN(groomId)) {
      return res.status(400).json({ success: false, message: 'Invalid groom ID' });
    }

    const logs = await prisma.groomAssignmentLog.findMany({
      where: { groomId },
      orderBy: { assignedAt: 'desc' },
      include: {
        horse: { select: { id: true, name: true } },
      },
      take: 50,
    });

    logger.info(
      `[groomController.getGroomAssignmentLogs] Retrieved ${logs.length} assignment logs for groom ${groomId}`,
    );

    return res.json({ success: true, logs });
  } catch (error) {
    logger.error(`[groomController.getGroomAssignmentLogs] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve groom assignment logs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
}
