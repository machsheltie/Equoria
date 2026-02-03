/**
 * Groom Performance Routes
 *
 * API endpoints for groom performance tracking and reputation management
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import { requireOwnership, findOwnedResource as _findOwnedResource } from '../middleware/ownership.mjs';
import { handleValidationErrors } from '../middleware/validationErrorHandler.mjs';
import {
  recordPerformance,
  getGroomPerformance,
  getTopPerformers,
  getPerformanceConfig,
  getGroomAnalytics,
} from '../controllers/groomPerformanceController.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/groom-performance/record
 * Record a groom performance interaction
 */
router.post(
  '/record',
  [
    body('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    body('horseId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    body('interactionType')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Interaction type must be a valid string'),
    body('bondGain')
      .optional()
      .isFloat({ min: -10, max: 10 })
      .withMessage('Bond gain must be between -10 and 10'),
    body('taskSuccess')
      .optional()
      .isBoolean()
      .withMessage('Task success must be a boolean'),
    body('wellbeingImpact')
      .optional()
      .isFloat({ min: -10, max: 10 })
      .withMessage('Wellbeing impact must be between -10 and 10'),
    body('duration')
      .optional()
      .isInt({ min: 0, max: 1440 })
      .withMessage('Duration must be between 0 and 1440 minutes'),
    body('playerRating')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('Player rating must be between 1 and 5'),
  ],
  handleValidationErrors,
  recordPerformance,
);

/**
 * GET /api/groom-performance/groom/:groomId
 * Get performance summary for a specific groom
 *
 * Security: Validates groom ownership before returning performance data
 */
router.get(
  '/groom/:groomId',
  [
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
  ],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  getGroomPerformance,
);

/**
 * GET /api/groom-performance/analytics/:groomId
 * Get detailed analytics for a specific groom
 *
 * Security: Validates groom ownership before returning analytics data
 */
router.get(
  '/analytics/:groomId',
  [
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days must be between 1 and 365'),
  ],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  getGroomAnalytics,
);

/**
 * GET /api/groom-performance/top
 * Get top performing grooms for the user
 */
router.get(
  '/top',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20'),
  ],
  handleValidationErrors,
  getTopPerformers,
);

/**
 * GET /api/groom-performance/config
 * Get performance tracking configuration
 */
router.get('/config', getPerformanceConfig);

export default router;
