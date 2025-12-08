/**
 * Personality Evolution Routes
 *
 * Defines API routes for personality evolution system including groom and horse personality development,
 * evolution triggers, stability analysis, prediction capabilities, and batch processing.
 *
 * Routes:
 * - POST /groom/:groomId/evolve - Evolve groom personality
 * - POST /horse/:horseId/evolve - Evolve horse temperament
 * - GET /:entityType/:entityId/triggers - Get evolution triggers
 * - GET /:entityType/:entityId/stability - Analyze personality stability
 * - GET /:entityType/:entityId/predict - Predict future evolution
 * - GET /:entityType/:entityId/history - Get evolution history
 * - POST /apply-effects - Apply evolution effects (admin)
 * - POST /batch-evolve - Batch process multiple entities
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import { requireOwnership } from '../middleware/ownership.mjs';
import logger from '../utils/logger.mjs';
import {
  evolveGroomPersonalityController,
  evolveHorseTemperamentController,
  getEvolutionTriggersController,
  getPersonalityStabilityController,
  predictPersonalityEvolutionController,
  getPersonalityEvolutionHistoryController,
  applyPersonalityEvolutionEffectsController,
  batchEvolvePersonalitiesController,
} from '../controllers/personalityEvolutionController.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[personalityEvolutionRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
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
 * Evolve groom personality based on interaction patterns
 * POST /api/personality-evolution/groom/:groomId/evolve
 */
router.post('/groom/:groomId/evolve',
  [
    param('groomId')
      .isInt({ min: 1 })
      .withMessage('Groom ID must be a positive integer'),
  ],
  validateRequest,
  requireOwnership('groom', { idParam: 'groomId' }),
  evolveGroomPersonalityController,
);

/**
 * Evolve horse temperament based on care history
 * POST /api/personality-evolution/horse/:horseId/evolve
 */
router.post('/horse/:horseId/evolve',
  [
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
  ],
  validateRequest,
  requireOwnership('horse', { idParam: 'horseId' }),
  evolveHorseTemperamentController,
);

/**
 * Calculate personality evolution triggers for an entity
 * GET /api/personality-evolution/:entityType/:entityId/triggers
 */
router.get('/:entityType/:entityId/triggers',
  [
    param('entityType')
      .isIn(['groom', 'horse'])
      .withMessage('Entity type must be either "groom" or "horse"'),
    param('entityId')
      .isInt({ min: 1 })
      .withMessage('Entity ID must be a positive integer'),
  ],
  validateRequest,
  getEvolutionTriggersController,
);

/**
 * Analyze personality stability for an entity
 * GET /api/personality-evolution/:entityType/:entityId/stability
 */
router.get('/:entityType/:entityId/stability',
  [
    param('entityType')
      .isIn(['groom', 'horse'])
      .withMessage('Entity type must be either "groom" or "horse"'),
    param('entityId')
      .isInt({ min: 1 })
      .withMessage('Entity ID must be a positive integer'),
  ],
  validateRequest,
  getPersonalityStabilityController,
);

/**
 * Predict future personality evolution
 * GET /api/personality-evolution/:entityType/:entityId/predict
 */
router.get('/:entityType/:entityId/predict',
  [
    param('entityType')
      .isIn(['groom', 'horse'])
      .withMessage('Entity type must be either "groom" or "horse"'),
    param('entityId')
      .isInt({ min: 1 })
      .withMessage('Entity ID must be a positive integer'),
    query('timeframeDays')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Timeframe must be between 1 and 365 days'),
  ],
  validateRequest,
  predictPersonalityEvolutionController,
);

/**
 * Get personality evolution history for an entity
 * GET /api/personality-evolution/:entityType/:entityId/history
 */
router.get('/:entityType/:entityId/history',
  [
    param('entityType')
      .isIn(['groom', 'horse'])
      .withMessage('Entity type must be either "groom" or "horse"'),
    param('entityId')
      .isInt({ min: 1 })
      .withMessage('Entity ID must be a positive integer'),
  ],
  validateRequest,
  getPersonalityEvolutionHistoryController,
);

/**
 * Apply personality evolution effects manually (admin function)
 * POST /api/personality-evolution/apply-effects
 */
router.post('/apply-effects',
  [
    body('entityId')
      .isInt({ min: 1 })
      .withMessage('Entity ID must be a positive integer'),
    body('entityType')
      .isIn(['groom', 'horse'])
      .withMessage('Entity type must be either "groom" or "horse"'),
    body('evolutionType')
      .isIn(['trait_strengthening', 'personality_shift', 'trait_acquisition', 'temperament_stabilization', 'convergence'])
      .withMessage('Invalid evolution type'),
    body('newTraits')
      .optional()
      .isArray()
      .withMessage('New traits must be an array'),
    body('newTraits.*')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Each trait must be a string between 1 and 100 characters'),
    body('oldPersonality')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Old personality must be a string between 1 and 50 characters'),
    body('newPersonality')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('New personality must be a string between 1 and 50 characters'),
    body('stabilityPeriod')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Stability period must be between 1 and 365 days'),
    body('effectStrength')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('Effect strength must be between 0 and 1'),
  ],
  validateRequest,
  applyPersonalityEvolutionEffectsController,
);

/**
 * Batch process personality evolution for multiple entities
 * POST /api/personality-evolution/batch-evolve
 */
router.post('/batch-evolve',
  [
    body('entities')
      .isArray({ min: 1, max: 50 })
      .withMessage('Entities must be an array with 1-50 items'),
    body('entities.*.entityId')
      .isInt({ min: 1 })
      .withMessage('Each entity ID must be a positive integer'),
    body('entities.*.entityType')
      .isIn(['groom', 'horse'])
      .withMessage('Each entity type must be either "groom" or "horse"'),
  ],
  validateRequest,
  batchEvolvePersonalitiesController,
);

/**
 * Get personality evolution system configuration
 * GET /api/personality-evolution/config
 */
router.get('/config', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Personality evolution system configuration retrieved successfully',
    data: {
      evolutionTypes: [
        'trait_strengthening',
        'personality_shift',
        'trait_acquisition',
        'temperament_stabilization',
        'convergence',
      ],
      entityTypes: ['groom', 'horse'],
      groomConfig: {
        minimumInteractions: 15,
        minimumExperience: 50,
        consistencyThreshold: 0.7,
        stabilityPeriodDays: 14,
        evolutionCooldownDays: 30,
      },
      horseConfig: {
        minimumInteractions: 10,
        minimumAge: 1,
        consistencyThreshold: 0.6,
        stabilityPeriodDays: 21,
        evolutionCooldownDays: 45,
      },
      generalConfig: {
        maxEvolutionsPerYear: 3,
        convergenceThreshold: 0.8,
        predictionTimeframeDays: 90,
      },
      availableTraits: {
        groom: {
          calm: ['enhanced_patience', 'stress_resistance', 'deep_bonding'],
          energetic: ['enthusiasm_boost', 'motivation_expert', 'energy_transfer'],
          methodical: ['precision_master', 'systematic_approach', 'detail_oriented'],
        },
        horse: {
          nervous: ['confidence_building', 'trust_development', 'anxiety_reduction'],
          developing: ['personality_formation', 'adaptability', 'learning_enhancement'],
          confident: ['leadership_traits', 'stability_anchor', 'mentor_qualities'],
        },
      },
    },
  });
});

export default router;
