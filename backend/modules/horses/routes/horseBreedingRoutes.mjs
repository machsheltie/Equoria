/**
 * Horse Breeding / Stud / Foaling Sub-Router (Equoria-y8u2j split)
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split. Owns the breeding-action / stud-listing / foaling endpoints:
 *
 *   POST   /breeding/color-prediction  — offspring coat-color probabilities
 *   POST   /:id/stud-listing           — list a stallion at stud (set fee)
 *   DELETE /:id/stud-listing           — unlist a stallion from stud
 *   GET    /:id/breeding-data          — horse breeding data + trait predictions
 *   POST   /:id/foal-now               — admin/E2E: skip gestation, materialise foal
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
import { body, param, validationResult } from 'express-validator';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  getBreedingColorPrediction,
  listHorseAtStud,
  unlistHorseAtStud,
} from '../controllers/horseController.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
import logger from '../../../utils/logger.mjs';
import {
  validateHorseId,
  rejectPollutedRequest,
  handleValidationErrors,
} from './_validators.mjs';

const router = express.Router();

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
    body('foalBreedId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('foalBreedId must be a positive integer'),
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
    if (req.body.foalBreedId) {
      req.body.foalBreedId = parseInt(req.body.foalBreedId, 10);
    }

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
 * Body: { studFee: number (non-negative integer) }
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

/**
 * @swagger
 * /api/horses/{id}/breeding-data:
 *   get:
 *     summary: Get horse breeding data with trait predictions
 *     tags: [Horses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Breeding data retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 *
 * Security: Validates horse ownership before returning breeding data.
 */
router.get(
  '/:id/breeding-data',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const { generateBreedingData } =
        await import('../../../services/breedingPredictionService.mjs');
      const breedingData = await generateBreedingData(horseId);

      res.json({
        success: true,
        message: 'Breeding data retrieved successfully',
        data: {
          breedingData,
        },
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate breeding data',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * POST /api/v1/horses/:id/foal-now
 * Immediately materialise a foal for an in-foal mare, bypassing the 7-day
 * gestation wait. Requires the caller to own the mare.
 *
 * Used by E2E tests (Phase B pregnancy spec) and admin tooling.
 */
router.post(
  '/:id/foal-now',
  mutationRateLimiter,
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const damId = req.horse.id;
      if (!req.horse.inFoalSinceDate) {
        return res.status(400).json({
          success: false,
          message: 'Horse is not currently in foal',
        });
      }
      const { foal } = await createFoalFromPregnancy({ damId });
      logger.info(
        `[horseBreedingRoutes POST /:id/foal-now] Foal ${foal.id} (${foal.name}) materialised from dam ${damId}`,
      );
      return res.status(201).json({
        success: true,
        message: `${req.horse.name} has foaled!`,
        data: { foalId: foal.id, foalName: foal.name },
      });
    } catch (error) {
      const status = error.message?.includes('not in foal') ? 400 : 500;
      logger.error(`[horseBreedingRoutes POST /:id/foal-now] Error: ${error.message}`);
      return res.status(status).json({ success: false, message: error.message });
    }
  },
);

export default router;
