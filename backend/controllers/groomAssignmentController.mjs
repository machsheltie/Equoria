/**
 * Enhanced Groom Assignment Controller
 * Handles advanced groom-horse assignment management
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import {
  createAssignment,
  removeAssignment,
  getUserAssignments,
  getGroomAssignmentLimits,
  calculateWeeklySalaryCosts,
  validateAssignmentEligibility,
} from '../services/groomAssignmentService.mjs';

/**
 * POST /api/groom-assignments
 * Create a new groom assignment
 */
export async function createGroomAssignment(req, res) {
  try {
    const { groomId, horseId, priority, notes, replacePrimary } = req.body;
    const userId = req.user?.id;

    logger.info(`[groomAssignmentController] Creating assignment: groom ${groomId} -> horse ${horseId}`);

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
    res.status(400).json({
      success: false,
      message: error.message,
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

/**
 * GET /api/groom-assignments/groom/:groomId/limits
 * Get assignment limits for a specific groom
 */
export async function getGroomLimits(req, res) {
  try {
    const { groomId } = req.params;
    const userId = req.user?.id;

    logger.info(`[groomAssignmentController] Getting limits for groom ${groomId}`);

    // Validate groom ID
    const parsedGroomId = parseInt(groomId);
    if (isNaN(parsedGroomId) || parsedGroomId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
        data: null,
      });
    }

    // Get groom data
    const groom = await prisma.groom.findUnique({
      where: { id: parsedGroomId },
      select: {
        id: true,
        name: true,
        skillLevel: true,
        userId: true,
      },
    });

    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
        data: null,
      });
    }

    if (groom.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this groom',
        data: null,
      });
    }

    // Get assignment limits
    const limits = await getGroomAssignmentLimits(groom);

    res.status(200).json({
      success: true,
      message: 'Groom limits retrieved successfully',
      data: {
        groom: {
          id: groom.id,
          name: groom.name,
          skillLevel: groom.skillLevel,
        },
        limits,
      },
    });

  } catch (error) {
    logger.error(`[groomAssignmentController] Error getting groom limits: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

/**
 * GET /api/groom-assignments/salary-costs
 * Calculate weekly salary costs for all assignments
 */
export async function getSalaryCosts(req, res) {
  try {
    const userId = req.user?.id;

    logger.info(`[groomAssignmentController] Calculating salary costs for user ${userId}`);

    // Calculate salary costs
    const costs = await calculateWeeklySalaryCosts(userId);

    res.status(200).json({
      success: true,
      message: 'Salary costs calculated successfully',
      data: {
        totalWeeklyCost: costs.totalWeeklyCost,
        groomCosts: costs.groomCosts,
        summary: {
          totalAssignments: costs.assignmentCount,
          groomsWithAssignments: costs.groomCount,
          averageCostPerGroom: costs.groomCount > 0 ? Math.round(costs.totalWeeklyCost / costs.groomCount) : 0,
        },
      },
    });

  } catch (error) {
    logger.error(`[groomAssignmentController] Error calculating salary costs: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

/**
 * POST /api/groom-assignments/validate
 * Validate assignment eligibility without creating assignment
 */
export async function validateAssignment(req, res) {
  try {
    const { groomId, horseId } = req.body;
    const userId = req.user?.id;

    logger.info(`[groomAssignmentController] Validating assignment: groom ${groomId} -> horse ${horseId}`);

    // Validate required fields
    if (!groomId || !horseId) {
      return res.status(400).json({
        success: false,
        message: 'groomId and horseId are required',
        data: null,
      });
    }

    // Validate assignment eligibility
    const validation = await validateAssignmentEligibility(groomId, horseId, userId);

    res.status(200).json({
      success: true,
      message: 'Assignment validation completed',
      data: {
        valid: validation.valid,
        errors: validation.errors,
        groom: validation.groom ? {
          id: validation.groom.id,
          name: validation.groom.name,
          skillLevel: validation.groom.skillLevel,
        } : null,
        horse: validation.horse ? {
          id: validation.horse.id,
          name: validation.horse.name,
        } : null,
      },
    });

  } catch (error) {
    logger.error(`[groomAssignmentController] Error validating assignment: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}

/**
 * GET /api/groom-assignments/dashboard
 * Get comprehensive assignment dashboard data
 */
export async function getAssignmentDashboard(req, res) {
  try {
    const userId = req.user?.id;

    logger.info(`[groomAssignmentController] Getting assignment dashboard for user ${userId}`);

    // Get assignments and salary costs in parallel
    const [assignmentsResult, salaryCosts] = await Promise.all([
      getUserAssignments(userId, { includeInactive: false }),
      calculateWeeklySalaryCosts(userId),
    ]);

    // Get groom limits for all grooms
    const groomLimits = {};
    const uniqueGrooms = Object.values(assignmentsResult.assignmentsByGroom);

    for (const groomData of uniqueGrooms) {
      const limits = await getGroomAssignmentLimits(groomData.groom);
      groomLimits[groomData.groom.id] = limits;
    }

    res.status(200).json({
      success: true,
      message: 'Assignment dashboard retrieved successfully',
      data: {
        assignments: assignmentsResult.assignments,
        assignmentsByGroom: assignmentsResult.assignmentsByGroom,
        statistics: assignmentsResult.stats,
        salaryCosts,
        groomLimits,
        summary: {
          totalActiveAssignments: assignmentsResult.stats.activeAssignments,
          totalWeeklyCost: salaryCosts.totalWeeklyCost,
          groomsWithAssignments: assignmentsResult.stats.groomsWithAssignments,
          averageAssignmentsPerGroom: Math.round(assignmentsResult.stats.averageAssignmentsPerGroom * 10) / 10,
        },
      },
    });

  } catch (error) {
    logger.error(`[groomAssignmentController] Error getting assignment dashboard: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}
