/**
 * Groom Assignment Handlers
 *
 * Equoria-8kuhf: extracted from groomController.mjs (god-file split to satisfy
 * the 800-line max-lines cap). Behavior, signatures, response shapes, and
 * route wiring are unchanged — groomController.mjs re-exports these so the
 * public import surface is identical.
 *
 * Handlers: assignGroom, getGroomAssignmentLogs.
 * (ensureDefaultAssignment was deleted: no foal is given a default groom, owner
 * ruling 2026-10-28, q153. getFoalAssignments went with GET
 * /grooms/assignments/:foalId, owner ruling 2026-10-28, q151, Equoria-a7f1p.)
 */

import { assignGroomToFoal } from '../../../utils/groomSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { horseRetiredCode } from '../../../errors/HorseRetiredError.mjs';

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
    // Equoria-6p398.14 follow-up (owner ruling 2026-10-23): a retired horse is a
    // business-rule refusal, not a server failure — 400 with its code.
    if (error?.code === horseRetiredCode) {
      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
        data: null,
      });
    }
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
