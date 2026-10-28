/**
 * Enhanced Groom Assignment Routes
 * API routes for advanced groom-horse assignment management
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';
import {
  createGroomAssignment,
  removeGroomAssignment,
  getMyAssignments,
} from '../controllers/groomAssignmentController.mjs';
import { getAssignmentStatisticsRaw } from '../services/groomAssignmentService.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[groomAssignmentRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/groom-assignments
 * Create a new groom assignment
 */
router.post(
  '/',
  [
    body('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
    body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('priority')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Priority must be between 1 and 5'),
    body('notes')
      .optional()
      .isString()
      .isLength({ max: 500 })
      .withMessage('Notes must be a string (max 500 characters)'),
    body('replacePrimary').optional().isBoolean().withMessage('replacePrimary must be a boolean'),
  ],
  handleValidationErrors,
  createGroomAssignment,
);

/**
 * DELETE /api/groom-assignments/:assignmentId
 * Remove a groom assignment
 *
 * Security: Validates assignment ownership before removal
 */
router.delete(
  '/:assignmentId',
  [
    param('assignmentId').isInt({ min: 1 }).withMessage('Assignment ID must be a positive integer'),
    body('reason')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Reason must be a string (max 200 characters)'),
  ],
  handleValidationErrors,
  requireOwnership('groom-assignment', { idParam: 'assignmentId' }),
  removeGroomAssignment,
);

/**
 * GET /api/groom-assignments
 * Get all assignments for the authenticated user
 */
router.get(
  '/',
  [
    query('includeInactive')
      .optional()
      .isBoolean()
      .withMessage('includeInactive must be a boolean'),
    query('groomId').optional().isInt({ min: 1 }).withMessage('groomId must be a positive integer'),
    query('horseId').optional().isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
  ],
  handleValidationErrors,
  getMyAssignments,
);

// GET /groom/:groomId/limits, GET /salary-costs, POST /validate, GET /dashboard and
// GET /config were removed with the duplicate lookups (owner ruling 2026-10-28, q151, Equoria-a7f1p):
// the Staff page reads GET /groom-assignments and GET /groom-salaries/cost.

/**
 * GET /api/groom-assignments/statistics
 * Get assignment statistics and analytics
 */
router.get('/statistics', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { timeframe = '30' } = req.query;

    logger.info(`[groomAssignmentRoutes] Getting assignment statistics for user ${userId}`);

    // Calculate date range
    const daysBack = parseInt(timeframe) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get assignment statistics (service-layer fetch, Equoria-becrm)
    const { totalAssignments, recentAssignments, assignmentHistory } =
      await getAssignmentStatisticsRaw(userId, startDate);

    // Analyze assignment patterns
    const skillLevelDistribution = assignmentHistory.reduce((acc, assignment) => {
      const skill = assignment.groom.skillLevel;
      acc[skill] = (acc[skill] || 0) + 1;
      return acc;
    }, {});

    const specialityDistribution = assignmentHistory.reduce((acc, assignment) => {
      const { speciality } = assignment.groom;
      acc[speciality] = (acc[speciality] || 0) + 1;
      return acc;
    }, {});

    const activeAssignments = assignmentHistory.filter(a => a.isActive).length;
    const completedAssignments = assignmentHistory.filter(a => !a.isActive && a.endDate).length;

    res.status(200).json({
      success: true,
      message: 'Assignment statistics retrieved successfully',
      data: {
        timeframe: `${daysBack} days`,
        summary: {
          totalAssignments,
          recentAssignments,
          activeAssignments,
          completedAssignments,
          averageAssignmentsPerDay:
            daysBack > 0 ? Math.round((recentAssignments / daysBack) * 10) / 10 : 0,
        },
        distributions: {
          skillLevels: skillLevelDistribution,
          specialities: specialityDistribution,
        },
        trends: {
          assignmentGrowth: recentAssignments > 0 ? 'positive' : 'stable',
          mostUsedSkillLevel: Object.keys(skillLevelDistribution).reduce(
            (a, b) => (skillLevelDistribution[a] > skillLevelDistribution[b] ? a : b),
            'novice',
          ),
          mostUsedSpeciality: Object.keys(specialityDistribution).reduce(
            (a, b) => (specialityDistribution[a] > specialityDistribution[b] ? a : b),
            'general',
          ),
        },
      },
    });
  } catch (error) {
    logger.error(`[groomAssignmentRoutes] Error getting statistics: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error retrieving assignment statistics',
      data: null,
    });
  }
});

export default router;
