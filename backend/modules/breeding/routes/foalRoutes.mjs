/**
 * Foal Routes
 *
 * Handlers extracted to foalController.mjs — pure structural refactor.
 * Validation middleware (express-validator) and ownership checks remain here.
 *
 * No route here may set or advance a foal's development day, or write its
 * bond/stress values (Equoria-mwjst; owner ruling 2026-10-05: "THEY MUST WAIT
 * OUT THE FULL 7 DAY AGING PROCESS"). PUT /:foalId/develop (client-chosen
 * day/bond/stress) and POST /:foalId/advance-day were removed; the nightly
 * trait job is the only thing that moves FoalDevelopment.currentDay.
 *
 * There is no player-run enrichment, foal activity or graduation either
 * (Equoria-fr2kg; owner ruling 2026-10-14/15: foal enrichment is the groom's
 * job, and there is no graduation). POST /:foalId/activity, /enrichment,
 * /enrich and /graduate were removed.
 *
 * No route here reveals or writes a foal's traits either (Equoria-gu8jk; owner
 * ruling 2026-10-20: players must never write traits for themselves).
 * POST /:foalId/reveal-traits was removed; traits will be activated by grooms.
 */

import express from 'express';
import { param } from 'express-validator';
import { requireOwnership } from '../../../middleware/ownership.mjs';
// Equoria-jk9oj.2: declare auth at the router that OWNS these mutations rather
// than inferring it from the authRouter mount comment. Idempotent with the
// mount-level authenticateToken; the guard travels with the file if re-mounted.
import { authenticateToken } from '../../../middleware/auth.mjs';
import {
  getFoalHandler,
  getFoalDevelopmentHandler,
  getFoalActivitiesHandler,
} from '../controllers/foalController.mjs';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/foals/:foalId
 * Get a foal's basic record. Returns 404 if not found, not owned, or age 3 or older.
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

export default router;
