/**
 * Cross-domain reads under the /horses prefix (application query layer, Equoria-q4uem.4 / WS4 S3).
 *
 * Mounted by backend/app/routers.mjs at /horses immediately BEFORE the horses module router, so each
 * route keeps its URL, middleware chain and first-match position. The routes were moved verbatim from
 * backend/modules/horses/routes/{horseRoutes,horseHistoryRoutes,horseBreedingRoutes,horseXpRoutes}.mjs;
 * the only edits are three in-handler dynamic imports that became the static imports below, and
 * one executed-chain compensation: at base, horseRoutes.mjs mounted horseXpRoutes (which applies
 * `router.use(authenticateToken)` router-wide at :48) AHEAD of the breeding and history sub-routers,
 * so every request that reached /:id/history, /:id/overview, /:id/training-history,
 * /:id/breeding-data or /:id/trait-card first passed through that router-level authenticateToken.
 * This router is mounted before horseRoutes, so those five routes carry `authenticateToken` as their
 * FIRST route-level handler instead; the executed middleware sequence per URL is identical to base.
 * /trainable/:userId was registered in horseRoutes before the sub-router mounts and never took that
 * pass, so it gets nothing. This router registers no path-less `router.use` (a path-less use here
 * would run for every /horses/* request, which base never did); the app-level mounting sentinel
 * asserts that.
 *
 *   GET /trainable/:userId        — Training: horses eligible for training
 *   GET /:id/overview             — Horses + Training + Competition composition
 *   GET /:id/training-history     — Training: analytics for a horse
 *   GET /:id/breeding-data        — Breeding: breeding data + trait predictions
 *
 * Equoria-a7f1p: GET /:id/trait-card went with the trait reports (owner ruling
 * 2026-10-28, q152). GET /:id/history went with the duplicate lookups (owner
 * ruling 2026-10-28, q151): the Show Results tab reads
 * GET /competition/results/horse/:horseId.
 */
import express from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken } from '../../middleware/auth.mjs';
import { requireOwnership } from '../../middleware/ownership.mjs';
import { queryRateLimiter } from '../../middleware/rateLimiting.mjs';
// Equoria-q4uem.4 (WS4 S4, ruling 4): request validators are HTTP-layer helpers,
// not domain capabilities, so the horses barrel does not export them; the
// application layer imports the route-local validators file directly.
import { validateHorseId, validateUserId } from '../../modules/horses/routes/_validators.mjs';
import { getTrainableHorses, trainingAnalyticsService } from '../../modules/training/index.mjs';
import { generateBreedingData } from '../../modules/breeding/index.mjs';
import AppError from '../../errors/AppError.mjs';
import logger from '../../utils/logger.mjs';
import { getHorseOverview } from './horseOverviewQuery.mjs';

const router = express.Router();

/**
 * GET /horses/trainable/:userId
 * Get all horses owned by a user that are eligible for training
 *
 * Security: Validates that user can only access their own trainable horses
 */
router.get(
  '/trainable/:userId',
  queryRateLimiter,
  authenticateToken,
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Test bypass mechanism removed for production security (2025-01-16)
      // Tests now use real JWT tokens via backend/tests/helpers/authHelper.mjs

      // Verify user can only access their own trainable horses
      if (!req.user || req.user.id !== userId) {
        logger.warn(
          `[horseRoutes] User ${req.user?.id} attempted to access trainable horses for user ${userId}`,
        );
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Cannot access trainable horses for another user',
        });
      }

      const trainableHorses = await getTrainableHorses(userId);

      res.json({
        success: true,
        message: `Found ${trainableHorses.length} trainable horses`,
        data: trainableHorses,
      });
    } catch (error) {
      logger.error('[trainable horses route] Error occurred:', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/overview
 * Get comprehensive overview data for a specific horse
 *
 * Security: validates horse ownership before returning overview.
 */
router.get(
  '/:id/overview',
  authenticateToken, // base pass-through of horseXpRoutes.mjs:48 (see header)
  queryRateLimiter,
  validateHorseId,
  authenticateToken,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getHorseOverview(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/training-history
 *
 * Returns training history and discipline analytics for a specific horse.
 * Delegates to trainingAnalyticsService.getTrainingHistory() which queries
 * TrainingLog records for the horse.
 *
 * Wired in Equoria-kbr0: the service existed but had no HTTP route.
 *
 * Security: validates horse ownership before returning training data.
 */
router.get(
  '/:id/training-history',
  authenticateToken, // base pass-through of horseXpRoutes.mjs:48 (see header)
  queryRateLimiter,
  authenticateToken,
  [
    param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ success: false, message: 'Validation failed', errors: errors.array() });
      }
      return next();
    },
  ],
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);
      const data = await trainingAnalyticsService.getTrainingHistory(horseId);
      return res.json({
        success: true,
        message: 'Training history retrieved successfully',
        data,
      });
    } catch (error) {
      // Equoria-4xwyi: TYPE-based 404 detection. getTrainingHistory throws a typed
      // AppError(404) for a missing horse. Fail-closed: any other error surfaces as
      // 500 rather than being string-matched into a misleading 404 (the
      // Equoria-93lhj antipattern).
      if (AppError.isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({ success: false, message: error.message });
      }
      logger.error(`[horseHistoryRoutes GET /:id/training-history] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve training history',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
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
  authenticateToken, // base pass-through of horseXpRoutes.mjs:48 (see header)
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const breedingData = await generateBreedingData(horseId);

      res.json({
        success: true,
        message: 'Breeding data retrieved successfully',
        data: {
          breedingData,
        },
      });
    } catch (error) {
      // Equoria-4xwyi: TYPE-based 404 detection. generateBreedingData throws a
      // typed NotFoundError (AppError, statusCode 404) for a missing horse.
      // Fail-closed: any other error surfaces as 500 rather than being string-
      // matched into a misleading 404 (the Equoria-93lhj antipattern).
      if (AppError.isAppError(error) && error.statusCode === 404) {
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

export default router;
