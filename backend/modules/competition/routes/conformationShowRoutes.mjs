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
import { body, param } from 'express-validator';
import { queryRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import {
  enterConformationShow,
  checkConformationEligibility,
  executeConformationShowHandler,
  getConformationTitles,
} from '../controllers/conformationShowController.mjs';

const router = express.Router();

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
 */
router.post('/enter', mutationRateLimiter, validateEnterBody, enterConformationShow);

/**
 * GET /api/v1/competition/conformation/eligibility/:horseId
 * Check if a horse is eligible for conformation shows.
 */
router.get(
  '/eligibility/:horseId',
  queryRateLimiter,
  validateHorseIdParam,
  checkConformationEligibility,
);

/**
 * POST /api/v1/competition/conformation/execute
 * Execute a conformation show — score, rank, distribute rewards.
 */
router.post('/execute', mutationRateLimiter, validateExecuteBody, executeConformationShowHandler);

/**
 * GET /api/v1/competition/conformation/titles/:horseId
 * Query a horse's accumulated title points, current title, and breeding boost.
 */
router.get('/titles/:horseId', queryRateLimiter, validateHorseIdParam, getConformationTitles);

export default router;
