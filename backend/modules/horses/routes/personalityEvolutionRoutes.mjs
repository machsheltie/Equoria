/**
 * Personality Evolution Routes
 *
 * Read-only analysis of a HORSE's temperament evolution.
 *
 * Routes:
 * - GET /horse/:horseId/triggers - Get evolution triggers
 * - GET /horse/:horseId/stability - Analyze temperament stability
 * - GET /horse/:horseId/predict - Predict future evolution
 * - GET /horse/:horseId/history - Get evolution history
 * - GET /config - Evolution configuration (horses only)
 * - POST /apply-effects - REMOVED, answers 410 (Equoria-bvddn.4: unauthorized no-op stub)
 *
 * No route here changes a horse's temperament (Equoria-gu8jk; owner ruling
 * 2026-10-20: players must never write traits for themselves).
 * POST /horse/:horseId/evolve and POST /batch-evolve (whose 'horse' entities
 * ran the same temperament write) were removed.
 *
 * POST /groom/:groomId/evolve was removed under Equoria-jy3f7 (owner ruling
 * 2026-10-22: groom personalities never evolve; a groom keeps the same
 * personality for its whole career). Under the same ruling the read routes
 * no longer describe a groom (Equoria-j5qui): they were
 * /:entityType/:entityId/* with entityType 'groom' or 'horse' and are now
 * /horse/:horseId/*, so /groom/:groomId/* answers 404.
 */

import express from 'express';
import { param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import logger from '../../../utils/logger.mjs';
import {
  getEvolutionTriggersController,
  getPersonalityStabilityController,
  predictPersonalityEvolutionController,
  getPersonalityEvolutionHistoryController,
} from '../controllers/personalityEvolutionController.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(
      `[personalityEvolutionRoutes] Validation errors: ${JSON.stringify(errors.array())}`,
    );
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
 * Calculate temperament evolution triggers for a horse
 * GET /api/personality-evolution/horse/:horseId/triggers
 */
router.get(
  '/horse/:horseId/triggers',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  validateRequest,
  getEvolutionTriggersController,
);

/**
 * Analyze temperament stability for a horse
 * GET /api/personality-evolution/horse/:horseId/stability
 */
router.get(
  '/horse/:horseId/stability',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  validateRequest,
  getPersonalityStabilityController,
);

/**
 * Predict future temperament evolution for a horse
 * GET /api/personality-evolution/horse/:horseId/predict
 */
router.get(
  '/horse/:horseId/predict',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    query('timeframeDays')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Timeframe must be between 1 and 365 days'),
  ],
  validateRequest,
  predictPersonalityEvolutionController,
);

/**
 * Get temperament evolution history for a horse
 * GET /api/personality-evolution/horse/:horseId/history
 */
router.get(
  '/horse/:horseId/history',
  [param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer')],
  validateRequest,
  getPersonalityEvolutionHistoryController,
);

/**
 * POST /api/personality-evolution/apply-effects — REMOVED (Equoria-bvddn.4,
 * audit 2026-09-25).
 *
 * This was commented "admin function" but carried no `requireRole('admin')`
 * (or any authorization beyond the router-level `authenticateToken`), so any
 * authenticated player could call it directly. In practice it was already a
 * no-op stub: `applyPersonalityEvolutionEffects`
 * (personalityEvolutionSystem.mjs:387-423) only builds a text summary array
 * ("Added traits: ...", "Evolution event logged") and returns
 * `personalityUpdated: true` — it never writes to the database. Grepping the
 * repo (source, tests, frontend) turns up no caller of this route besides its
 * own now-removed test coverage; the two real evolution paths
 * (`evolveHorseTemperament`, and the since-removed groom evolution) call the same
 * `applyPersonalityEvolutionEffects` helper function directly as an internal
 * step, not through HTTP, so closing the route does not touch them.
 *
 * 410 (not 404) mirrors the established hard-deprecation idiom used for
 * other closed no-op/dead routes in this codebase (e.g. `POST
 * /api/v1/users/:id/add-xp`, Equoria-bvddn.1).
 */
router.post('/apply-effects', (req, res) => {
  logger.info(
    '[personalityEvolutionRoutes.POST /apply-effects] 410 Gone — unauthorized no-op stub removed (Equoria-bvddn.4, audit 2026-09-25)',
  );
  return res.status(410).json({
    success: false,
    message:
      'Manual personality evolution effect application has been removed. Evolution effects are applied automatically by the server during horse temperament evolution.',
  });
});

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
      entityTypes: ['horse'],
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
