/**
 * Enhanced Groom Assignment Controller
 * Handles advanced groom-horse assignment management
 */

import logger from '../../../utils/logger.mjs';
import {
  createAssignment,
  removeAssignment,
  getUserAssignments,
} from '../services/groomAssignmentService.mjs';

/**
 * POST /api/groom-assignments
 * Create a new groom assignment
 */
export async function createGroomAssignment(req, res) {
  try {
    const { groomId, horseId, priority, notes, replacePrimary } = req.body;
    const userId = req.user?.id;

    logger.info(
      `[groomAssignmentController] Creating assignment: groom ${groomId} -> horse ${horseId}`,
    );

    // Validate required fields
    if (!groomId || !horseId) {
      return res.status(400).json({
        success: false,
        message: 'groomId and horseId are required',
        data: null,
      });
    }

    // Create the assignment
    const result = await createAssignment(groomId, horseId, userId, {
      priority: priority || 1,
      notes,
      replacePrimary: replacePrimary || false,
    });

    res.status(201).json({
      success: true,
      message: result.message,
      data: {
        assignment: result.assignment,
      },
    });
  } catch (error) {
    logger.error(`[groomAssignmentController] Error creating assignment: ${error.message}`);
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      // A machine-readable refusal code when the error carries one ('horseRetired').
      ...(error.code ? { code: error.code } : {}),
      data: null,
    });
  }
}

/**
 * DELETE /api/groom-assignments/:assignmentId
 * Remove a groom assignment
 */
export async function removeGroomAssignment(req, res) {
  try {
    const { assignmentId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    logger.info(`[groomAssignmentController] Removing assignment ${assignmentId}`);

    // Validate assignment ID
    const parsedAssignmentId = parseInt(assignmentId);
    if (isNaN(parsedAssignmentId) || parsedAssignmentId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignment ID',
        data: null,
      });
    }

    // Remove the assignment
    const result = await removeAssignment(parsedAssignmentId, userId, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        assignment: result.assignment,
      },
    });
  } catch (error) {
    logger.error(`[groomAssignmentController] Error removing assignment: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message,
      data: null,
    });
  }
}

/**
 * GET /api/groom-assignments
 * Get all assignments for the authenticated user
 */
export async function getMyAssignments(req, res) {
  try {
    const userId = req.user?.id;
    const { includeInactive, groomId, horseId } = req.query;

    logger.info(`[groomAssignmentController] Getting assignments for user ${userId}`);

    // Parse query parameters
    const filters = {
      includeInactive: includeInactive === 'true',
      groomId: groomId ? parseInt(groomId) : null,
      horseId: horseId ? parseInt(horseId) : null,
    };

    // Get assignments
    const result = await getUserAssignments(userId, filters);

    res.status(200).json({
      success: true,
      message: 'Assignments retrieved successfully',
      data: {
        assignments: result.assignments,
        assignmentsByGroom: result.assignmentsByGroom,
        statistics: result.stats,
      },
    });
  } catch (error) {
    logger.error(`[groomAssignmentController] Error getting assignments: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}
