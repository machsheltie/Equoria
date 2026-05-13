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
  getFoalDevelopmentHandler,
  completeFoalActivity,
  advanceFoalDay,
  completeFoalEnrichment,
  graduateFoalHandler,
} from '../controllers/foalController.mjs';

const router = express.Router();

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
    body('day').isInt({ min: 0, max: 6 }).withMessage('Day must be an integer between 0 and 6'),
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
