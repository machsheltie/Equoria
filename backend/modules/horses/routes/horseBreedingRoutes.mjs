/**
 * Horse Breeding / Stud / Foaling Sub-Router (Equoria-y8u2j split)
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split. Owns the stud-listing endpoints (foaling is the nightly job
 * only: there is no route that skips gestation, Equoria-6nl3j):
 *
 *   POST   /:id/stud-listing           — list a stallion at stud (set fee)
 *   DELETE /:id/stud-listing           — unlist a stallion from stud
 *   GET    /:id/offspring              — the horse's foals, id + name only
 *
 * POST /breeding/color-prediction was removed (owner ruling q91, Equoria-m13fh):
 * players see no foal outcome, and it leaked an untested horse's genotype.
 *
 * Mounting: this router is mounted at the SAME path as the parent
 * (router.use(horseBreedingRoutes) in horseRoutes.mjs). Every route is
 * /:id/<sub-path> (2 segments), so it cannot match the parent's GET /:id
 * (1 segment); mount position is not load-bearing for Express path-matching.
 *
 * Security: every /:id/* route runs validateHorseId + requireOwnership('horse').
 */

import express from 'express';
import { body } from 'express-validator';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { listHorseAtStud, unlistHorseAtStud } from '../controllers/horseController.mjs';
import { listOffspring } from '../services/horseRouteQueries.mjs';
import logger from '../../../utils/logger.mjs';
import { validateHorseId, rejectPollutedRequest, handleValidationErrors } from './_validators.mjs';

const router = express.Router();

/**
 * GET /horses/:id/offspring (Equoria-oey96.55, owner ruling 2026-10-23)
 * The horse's foals for the pedigree tab, each as `{ id, name }` only — a foal
 * sold to another player is still listed, by name, with nothing private.
 *
 * Security: the pedigree tab sits on the owner-only horse page, so the parent
 * horse must be the caller's (requireOwnership answers 404 otherwise).
 */
router.get(
  '/:id/offspring',
  queryRateLimiter,
  authenticateToken,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const offspring = await listOffspring(req.horse.id);
      return res.json({ success: true, data: offspring });
    } catch (error) {
      logger.error(`[horseBreedingRoutes.GET /:id/offspring] Error: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

/**
 * POST /horses/:id/stud-listing  (Equoria-q072)
 * List a stallion at stud with a fee.
 * Body: { studFee: number (non-negative integer), mode?: 'public' | 'private' }
 *
 * Security: requireOwnership('horse') validates the user owns the horse.
 * Controller enforces sex === 'Stallion' and studFee shape.
 */
router.post(
  '/:id/stud-listing',
  mutationRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  [
    body('studFee')
      .exists()
      .withMessage('studFee is required')
      .bail()
      .isInt({ min: 0 })
      .withMessage('studFee must be a non-negative integer'),
    // Equoria-q4uem.9 (owner ruling 2026-10-15): Public Stud or Private Stud.
    body('mode')
      .optional()
      .isIn(['public', 'private'])
      .withMessage("mode must be 'public' or 'private'"),
  ],
  handleValidationErrors,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await listHorseAtStud(req, res);
    } catch (error) {
      logger.error(`[horseBreedingRoutes] Error in stud listing: ${error.message}`);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

/**
 * DELETE /horses/:id/stud-listing  (Equoria-q072)
 * Unlist a stallion from stud (resets studStatus + studFee).
 *
 * Security: requireOwnership('horse') validates the user owns the horse.
 */
router.delete(
  '/:id/stud-listing',
  mutationRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await unlistHorseAtStud(req, res);
    } catch (error) {
      logger.error(`[horseBreedingRoutes] Error in stud unlisting: ${error.message}`);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

export default router;
