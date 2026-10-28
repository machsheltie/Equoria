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

// GET /statistics was removed (owner ruling 2026-10-27: the groom reputation/performance system is retired; Equoria-a7f1p).

export default router;
