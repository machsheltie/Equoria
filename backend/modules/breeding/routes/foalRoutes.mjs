/**
 * Foal Routes
 *
 * Handlers extracted to foalController.mjs — pure structural refactor.
 * Validation middleware (express-validator) and ownership checks remain here.
 */

import express from 'express';
import { body, param } from 'express-validator';
import { enrichmentDiscoveryMiddleware } from '../../../middleware/traitDiscoveryMiddleware.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  getFoalHandler,
  getFoalDevelopmentHandler,
  getFoalActivitiesHandler,
  completeFoalActivity,
  advanceFoalDay,
  completeFoalEnrichment,
  revealFoalTraitsHandler,
  developFoalHandler,
  graduateFoalHandler,
} from '../controllers/foalController.mjs';

const router = express.Router();

/**
 * GET /api/foals/:foalId
 * Get a foal's basic record. Returns 404 if not found, not owned, or already graduated.
 *
 * Equoria-149w
 */
router.get(
  '/:foalId',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
  requireOwnership('foal', { idParam: 'foalId' }),
  getFoalHandler,
);

/**
 * GET /api/foals/:foalId/activities
 * Get the activity log for a foal.
 *
 * Equoria-sqvy
 */
router.get(
  '/:foalId/activities',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
  requireOwnership('foal', { idParam: 'foalId' }),
  getFoalActivitiesHandler,
);

/**
 * GET /api/foals/:foalId/development
 * Get foal development data including current status and activity history
 *
 * Security: Validates foal ownership before returning development data
 */
router.get(
  '/:foalId/development',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
  requireOwnership('foal', { idParam: 'foalId' }),
  getFoalDevelopmentHandler,
);

/**
 * POST /api/foals/:foalId/activity
 * Complete a foal enrichment activity
 *
 * Security: Validates foal ownership before allowing activity completion
 */
router.post(
  '/:foalId/activity',
  [
    param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer'),
    body('activityType')
      .notEmpty()
      .withMessage('Activity type is required')
      .isString()
      .withMessage('Activity type must be a string'),
  ],
  requireOwnership('foal', { idParam: 'foalId' }),
  completeFoalActivity,
);

/**
 * POST /api/foals/:foalId/advance-day
 * Advance foal to next day (admin/cron endpoint)
 *
 * Security: Validates foal ownership before advancing day
 */
router.post(
  '/:foalId/advance-day',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
  requireOwnership('foal', { idParam: 'foalId' }),
  advanceFoalDay,
);

/**
 * POST /api/foals/:foalId/enrichment
 * Complete a foal enrichment activity (Task 5 API)
 *
 * Security: Validates foal ownership before enrichment activity
 */
router.post(
  '/:foalId/enrichment',
  [
    param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer'),
    // `day` is derived server-side from the foal's age (Equoria-g89vy); the
    // client does not supply it. Only `activity` is validated here.
    body('activity')
      .notEmpty()
      .withMessage('Activity is required')
      .isString()
      .withMessage('Activity must be a string')
      .isLength({ min: 1, max: 100 })
      .withMessage('Activity must be between 1 and 100 characters'),
  ],
  requireOwnership('foal', { idParam: 'foalId' }),
  enrichmentDiscoveryMiddleware(),
  completeFoalEnrichment,
);

/**
 * POST /api/foals/:foalId/enrich
 * Frontend contract alias for POST /:foalId/enrichment. Same validation and handler.
 *
 * Equoria-dsyu
 */
router.post(
  '/:foalId/enrich',
  [
    param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer'),
    // `day` is derived server-side from the foal's age (Equoria-g89vy); the
    // client does not supply it. Only `activity` is validated here.
    body('activity')
      .notEmpty()
      .withMessage('Activity is required')
      .isString()
      .withMessage('Activity must be a string')
      .isLength({ min: 1, max: 100 })
      .withMessage('Activity must be between 1 and 100 characters'),
  ],
  requireOwnership('foal', { idParam: 'foalId' }),
  enrichmentDiscoveryMiddleware(),
  completeFoalEnrichment,
);

/**
 * POST /api/foals/:foalId/reveal-traits
 * Trigger trait discovery for a foal.
 *
 * Equoria-xgf0
 */
router.post(
  '/:foalId/reveal-traits',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
  requireOwnership('foal', { idParam: 'foalId' }),
  revealFoalTraitsHandler,
);

/**
 * PUT /api/foals/:foalId/develop
 * Update developable fields on a foal's FoalDevelopment record.
 *
 * Equoria-rkmh
 */
router.put(
  '/:foalId/develop',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
  requireOwnership('foal', { idParam: 'foalId' }),
  developFoalHandler,
);

/**
 * POST /api/foals/:foalId/graduate
 * Graduate a foal — closes development window and clears groom assignments.
 * Called when a foal reaches age 3 (104 weeks).
 *
 * Security: Validates foal ownership before graduating
 */
router.post(
  '/:foalId/graduate',
  [param('foalId').isInt({ min: 1 }).withMessage('Foal ID must be a positive integer')],
  requireOwnership('foal', { idParam: 'foalId' }),
  graduateFoalHandler,
);

export default router;
