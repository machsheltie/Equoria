/**
 * Dynamic Compatibility Routes
 * 
 * API routes for advanced real-time compatibility analysis between groom personalities and horse temperaments.
 * Provides endpoints for compatibility scoring, factor analysis, outcome prediction, and recommendations.
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
import { handleValidationErrors } from '../middleware/validationErrorHandler.mjs';
import { authenticateToken } from '../middleware/auth.mjs';
import {
  calculateCompatibility,
  getCompatibilityFactors,
  predictOutcome,
  getRecommendations,
  getCompatibilityTrends,
  updateHistory,
  getCompatibilityConfig,
} from '../controllers/dynamicCompatibilityController.mjs';

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
    body('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    body('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    body('context')
      .isObject()
      .withMessage('Context must be an object'),
    body('context.taskType')
      .isString()
      .isIn(['trust_building', 'desensitization', 'hoof_handling', 'showground_exposure', 'sponge_bath', 'coat_check', 'tying_practice', 'early_touch'])
      .withMessage('Task type must be a valid task type'),
    body('context.timeOfDay')
      .optional()
      .isString()
      .isIn(['morning', 'afternoon', 'evening'])
      .withMessage('Time of day must be morning, afternoon, or evening'),
    body('context.horseCurrentStress')
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage('Horse current stress must be between 0 and 10'),
    body('context.environmentalFactors')
      .optional()
      .isArray()
      .withMessage('Environmental factors must be an array'),
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
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
  ],
  handleValidationErrors,
  getCompatibilityFactors,
);

/**
 * POST /api/compatibility/predict
 * Predict interaction outcome based on compatibility
 */
router.post(
  '/predict',
  [
    body('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    body('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    body('context')
      .isObject()
      .withMessage('Context must be an object'),
    body('context.taskType')
      .isString()
      .isIn(['trust_building', 'desensitization', 'hoof_handling', 'showground_exposure', 'sponge_bath', 'coat_check', 'tying_practice', 'early_touch'])
      .withMessage('Task type must be a valid task type'),
    body('context.duration')
      .optional()
      .isInt({ min: 5, max: 120 })
      .withMessage('Duration must be between 5 and 120 minutes'),
    body('context.environmentalFactors')
      .optional()
      .isArray()
      .withMessage('Environmental factors must be an array'),
  ],
  handleValidationErrors,
  predictOutcome,
);

/**
 * POST /api/compatibility/recommendations
 * Get optimal groom recommendations for a horse
 */
router.post(
  '/recommendations',
  [
    body('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    body('context')
      .isObject()
      .withMessage('Context must be an object'),
    body('context.taskType')
      .isString()
      .isIn(['trust_building', 'desensitization', 'hoof_handling', 'showground_exposure', 'sponge_bath', 'coat_check', 'tying_practice', 'early_touch'])
      .withMessage('Task type must be a valid task type'),
    body('context.timeOfDay')
      .optional()
      .isString()
      .isIn(['morning', 'afternoon', 'evening'])
      .withMessage('Time of day must be morning, afternoon, or evening'),
    body('context.urgency')
      .optional()
      .isString()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Urgency must be low, normal, high, or urgent'),
    body('context.environmentalFactors')
      .optional()
      .isArray()
      .withMessage('Environmental factors must be an array'),
  ],
  handleValidationErrors,
  getRecommendations,
);

/**
 * GET /api/compatibility/trends/:groomId/:horseId
 * Analyze compatibility trends over time
 */
router.get(
  '/trends/:groomId/:horseId',
  [
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days must be between 1 and 365'),
  ],
  handleValidationErrors,
  getCompatibilityTrends,
);

/**
 * POST /api/compatibility/history/update
 * Update compatibility history with interaction results
 */
router.post(
  '/history/update',
  [
    body('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
    body('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    body('interactionId')
      .isInt({ min: 1 })
      .withMessage('Interaction ID must be a positive integer'),
  ],
  handleValidationErrors,
  updateHistory,
);

/**
 * GET /api/compatibility/config
 * Get compatibility system configuration and definitions
 */
router.get('/config', getCompatibilityConfig);

export default router;
