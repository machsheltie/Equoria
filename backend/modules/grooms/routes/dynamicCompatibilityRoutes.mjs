/**
 * Dynamic Compatibility Routes
 *
 * API routes for advanced real-time compatibility analysis between groom personalities and horse temperaments.
 * Provides endpoints for compatibility scoring and factor analysis. The outcome-prediction and
 * groom-recommendation routes were removed (Equoria-a7f1p; owner ruling 2026-10-07: no advice);
 * the compatibility tables themselves stay parked until trait effects are ruled (2026-10-28).
 *
 * Business Rules:
 * - Real-time compatibility scoring with contextual factors
 * - Environmental and situational modifiers
 * - Historical performance integration and learning
 * - Adaptive scoring based on interaction outcomes
 * - Multi-factor compatibility analysis
 * - Predictive compatibility modeling
 */

import express from 'express';
import { body, param, query } from 'express-validator';
import { handleValidationErrors } from '../../../middleware/validationErrorHandler.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  calculateCompatibility,
  getCompatibilityFactors,
  getCompatibilityTrends,
  getCompatibilityConfig,
} from '../controllers/dynamicCompatibilityController.mjs';
import { GROOM_HORSE_COMPATIBILITY_TASK_TYPES } from '../services/groomHorseCompatibilityTaskPolicy.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/compatibility/calculate
 * Calculate dynamic compatibility between a groom and horse
 */
router.post(
  '/calculate',
  [
    body('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
    body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('context').isObject().withMessage('Context must be an object'),
    body('context.taskType')
      .isString()
      .isIn(GROOM_HORSE_COMPATIBILITY_TASK_TYPES)
      .withMessage('Task type must be a valid task type'),
    body('context.timeOfDay')
      .optional()
      .isString()
      .isIn(['morning', 'afternoon', 'evening'])
      .withMessage('Time of day must be morning, afternoon, or evening'),
    body('context.environmentalFactors')
      .optional()
      .isArray()
      .withMessage('Environmental factors must be an array'),
    body('context.environmentalFactors.*')
      .isString()
      .withMessage('Each environmental factor must be a string'),
    body('context.recentInteractions')
      .optional()
      .isArray()
      .withMessage('Recent interactions must be an array'),
  ],
  handleValidationErrors,
  calculateCompatibility,
);

/**
 * GET /api/compatibility/factors/:groomId/:horseId
 * Analyze detailed compatibility factors
 */
router.get(
  '/factors/:groomId/:horseId',
  [
    param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  ],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  requireOwnership('horse', { idParam: 'horseId' }),
  getCompatibilityFactors,
);

/**
 * GET /api/compatibility/trends/:groomId/:horseId
 * Analyze compatibility trends over time
 */
router.get(
  '/trends/:groomId/:horseId',
  [
    param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days must be between 1 and 365'),
  ],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  requireOwnership('horse', { idParam: 'horseId' }),
  getCompatibilityTrends,
);

/**
 * GET /api/compatibility/config
 * Get compatibility system configuration and definitions
 */
router.get('/config', getCompatibilityConfig);

export default router;
