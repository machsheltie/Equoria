/**
 * Conformation Show Routes
 *
 * Mounts under /competition/conformation (via competitionRoutes.mjs sub-router).
 *
 * POST /enter                  — enter a horse in a conformation show
 * GET  /eligibility/:horseId   — check if a horse is eligible to enter
 *
 * Auth is enforced at the authRouter level in app.mjs.
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  enterConformationShow,
  checkConformationEligibility,
  executeConformationShowHandler,
  getConformationTitles,
} from '../controllers/conformationShowController.mjs';

const router = express.Router();

// Equoria-s433: validationResult check must run BEFORE requireOwnership
// so a non-numeric horseId surfaces as "Validation failed" rather than
// "Invalid horse ID" (requireOwnership's malformed-ID error). See
// Equoria-8ug7 for the same pattern on competitionRoutes /enter.
const enforceValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// ---------------------------------------------------------------------------
// Validation middleware
// ---------------------------------------------------------------------------

const validateEnterBody = [
  body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
  body('groomId').isInt({ min: 1 }).withMessage('groomId must be a positive integer'),
  body('showId').isInt({ min: 1 }).withMessage('showId must be a positive integer'),
  body('className').isString().trim().notEmpty().withMessage('className is required'),
];

const validateExecuteBody = [
  body('showId').isInt({ min: 1 }).withMessage('showId must be a positive integer'),
];

const validateHorseIdParam = [
  param('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/competition/conformation/enter
 * Enter a horse in a conformation show.
 *
 * Ownership validated via requireOwnership({from:'body'}) middleware
 * (Equoria-s433); controller reads req.horse instead of inline lookup.
 */
router.post(
  '/enter',
  mutationRateLimiter,
  validateEnterBody,
  enforceValidation,
  requireOwnership('horse', { idParam: 'horseId', from: 'body' }),
  enterConformationShow,
);

/**
 * GET /api/v1/competition/conformation/eligibility/:horseId
 * Check if a horse is eligible for conformation shows.
 *
 * Ownership validated via requireOwnership middleware (params-based,
 * Equoria-s433); controller reads req.horse instead of inline lookup.
 */
router.get(
  '/eligibility/:horseId',
  queryRateLimiter,
  validateHorseIdParam,
  enforceValidation,
  requireOwnership('horse', { idParam: 'horseId' }),
  checkConformationEligibility,
);

/**
 * POST /api/v1/competition/conformation/execute
 * Execute a conformation show — score, rank, distribute rewards.
 *
 * Host authorization is enforced inside the controller via a Show.findFirst
 * scoped to hostUserId (Equoria-dmec). Per-horse ownership is N/A — this
 * endpoint operates on a show, not a single horse.
 */
router.post('/execute', mutationRateLimiter, validateExecuteBody, executeConformationShowHandler);

/**
 * GET /api/v1/competition/conformation/titles/:horseId
 * Query a horse's accumulated title points, current title, and breeding boost.
 *
 * Ownership validated via requireOwnership middleware (params-based,
 * Equoria-s433); controller reads req.horse instead of inline lookup.
 */
router.get(
  '/titles/:horseId',
  queryRateLimiter,
  validateHorseIdParam,
  enforceValidation,
  requireOwnership('horse', { idParam: 'horseId' }),
  getConformationTitles,
);

export default router;
