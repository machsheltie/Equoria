/**
 * Horse Breeding / Stud / Foaling Sub-Router (Equoria-y8u2j split)
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split. Owns the breeding-action / stud-listing endpoints (foaling is
 * the nightly job only: there is no route that skips gestation, Equoria-6nl3j):
 *
 *   POST   /breeding/color-prediction  — offspring coat-color probabilities
 *   POST   /:id/stud-listing           — list a stallion at stud (set fee)
 *   DELETE /:id/stud-listing           — unlist a stallion from stud
 *   GET    /:id/breeding-data          — horse breeding data + trait predictions
 *   GET    /:id/offspring              — the horse's foals, id + name only
 *
 * Mounting: this router is mounted at the SAME path as the parent
 * (`router.use(horseBreedingRoutes)` in horseRoutes.mjs).
 *
 *   - `POST /breeding/color-prediction` is /breeding/color-prediction
 *     (2 segments) — cannot match the parent's `GET /:id` (1 segment).
 *   - All other extracted routes are `/:id/<sub-path>` (2 segments) — same
 *     argument applies. Sub-router mount position is therefore not
 *     load-bearing for Express path-matching.
 *
 * Security:
 *   - POST /breeding/color-prediction: authenticated; controller validates
 *     ownership of both sire and dam.
 *   - All /:id/* routes: validateHorseId + requireOwnership('horse').
 *
 * Behaviour preserved verbatim from the original inline definitions, including
 * the body coercion (string → int) for the color-prediction endpoint and the
 * dynamic await import(...) of the breeding-prediction service.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  getBreedingColorPrediction,
  listHorseAtStud,
  unlistHorseAtStud,
} from '../controllers/horseController.mjs';
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
 * POST /horses/breeding/color-prediction
 * Calculate breeding color prediction for two parent horses.
 * Returns probability chart of possible offspring coat colors.
 *
 * Security: Validates ownership of both sire and dam in controller.
 */
router.post(
  '/breeding/color-prediction',
  mutationRateLimiter,
  rejectPollutedRequest,
  authenticateToken,
  [
    body('sireId').isInt({ min: 1 }).withMessage('sireId must be a positive integer'),
    body('damId').isInt({ min: 1 }).withMessage('damId must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    // Convert string body values to integers
    req.body.sireId = parseInt(req.body.sireId, 10);
    req.body.damId = parseInt(req.body.damId, 10);

    try {
      await getBreedingColorPrediction(req, res);
    } catch (error) {
      logger.error(`[horseBreedingRoutes] Error in breeding color prediction: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
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
