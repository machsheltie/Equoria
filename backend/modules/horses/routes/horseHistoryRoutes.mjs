/**
 * Horses history/overview/analytics sub-router (Equoria-y8u2j god-file split).
 *
 * Mounted under the parent `horseRoutes.mjs` at `/horses` (and `/api/horses`
 * via `app.use`), so the routes below resolve to:
 *   GET  /horses/:id/history
 *   GET  /horses/:id/overview
 *   GET  /horses/:id/prize-summary
 *   GET  /horses/:id/training-history
 *   GET  /horses/:horseId/competition-history
 *
 * All five routes use a 2-segment path (`/:id/<sub-path>`) so they do NOT
 * conflict with the parent's `GET /:id` catch-all — mount order is therefore
 * not load-bearing (per CONTRIBUTING.md "Route ordering" pattern).
 *
 * Auth + ownership: every route here requires authenticated horse-ownership
 * via `requireOwnership('horse')` — same security posture as the parent's
 * inline definitions before extraction.
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { getHorseOverview, getHorseCompetitionHistory } from '../controllers/horseController.mjs';
import { trainingAnalyticsService } from '../../training/services/trainingAnalyticsService.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { validateHorseId } from './_validators.mjs';
import { getHorseCompetitionResultsForPrizeSummary } from '../services/horseRouteQueries.mjs';
import logger from '../../../utils/logger.mjs';

const router = express.Router();

/**
 * GET /horses/:id/history
 * Get competition history for a specific horse
 *
 * Security: validates horse ownership before returning history.
 */
router.get(
  '/:id/history',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Dynamic import retained (matches pre-extraction shape — controller
      // exports a function that's also used elsewhere; static import here
      // would create a circular-import path through horseController.mjs).
      const { getHorseHistory } = await import('../controllers/horseController.mjs');
      await getHorseHistory(req, res);
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
 * GET /horses/:id/overview
 * Get comprehensive overview data for a specific horse
 *
 * Security: validates horse ownership before returning overview.
 */
router.get(
  '/:id/overview',
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
 * GET /horses/:id/prize-summary
 * Return aggregated prize statistics for a horse: totalPrizeMoney, firstPlaces,
 * secondPlaces, thirdPlaces, bestPlacement, totalCompetitions.
 *
 * Security: validates horse ownership before returning data.
 */
router.get(
  '/:id/prize-summary',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const results = await getHorseCompetitionResultsForPrizeSummary(horseId);

      let totalPrizeMoney = 0;
      let firstPlaces = 0;
      let secondPlaces = 0;
      let thirdPlaces = 0;
      let bestPlacement = null;

      for (const result of results) {
        totalPrizeMoney += Number(result.prizeWon) || 0;

        const placement = parseInt(result.placement);
        if (!isNaN(placement)) {
          if (placement === 1) {
            firstPlaces++;
          }
          if (placement === 2) {
            secondPlaces++;
          }
          if (placement === 3) {
            thirdPlaces++;
          }
          if (bestPlacement === null || placement < bestPlacement) {
            bestPlacement = placement;
          }
        }
      }

      logger.info(
        `[horseHistoryRoutes.GET /:id/prize-summary] Retrieved prize summary for horse ${horseId}`,
      );

      return res.json({
        success: true,
        data: {
          horseId,
          totalPrizeMoney,
          firstPlaces,
          secondPlaces,
          thirdPlaces,
          bestPlacement,
          totalCompetitions: results.length,
        },
      });
    } catch (error) {
      logger.error(`[horseHistoryRoutes.GET /:id/prize-summary] Error: ${error.message}`);
      return res.status(500).json({
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
      if (error.message && error.message.includes('not found')) {
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
 * GET /api/horses/:horseId/competition-history
 *
 * Per-horse competition history + statistics for the /my-stable Hall of
 * Fame career display (Story 21S-4). Response shape matches the
 * `CompetitionHistoryData` TypeScript interface used by
 * `useHorseCompetitionHistory` on the frontend.
 *
 * Security: horse ownership required.
 */
router.get(
  '/:horseId/competition-history',
  queryRateLimiter,
  authenticateToken,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
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
  requireOwnership('horse', { idParam: 'horseId' }),
  getHorseCompetitionHistory,
);

export default router;
