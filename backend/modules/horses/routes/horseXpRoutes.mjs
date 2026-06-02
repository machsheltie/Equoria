/**
 * Horse XP / Personality / Trait-Card Sub-Router (Equoria-y8u2j split)
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split. Owns the 7 owner-scoped, per-horse progression / personality
 * endpoints:
 *
 *   GET    /:id/xp                  — XP status + progression
 *   POST   /:id/allocate-stat       — spend an unspent stat point
 *   GET    /:id/xp-history          — paginated XP event history
 *   POST   /:id/award-xp            — system/admin XP grant
 *   GET    /:id/personality-impact  — groom-compatibility ranking
 *   GET    /:id/legacy-score        — legacy-score calculation
 *   GET    /:id/trait-card          — trait-timeline card
 *
 * Mounting: this router is mounted at the SAME path as the parent
 * (`router.use(horseXpRoutes)` in horseRoutes.mjs). All routes start with
 * `/:id/...` (2 segments) so they do NOT conflict with the parent's
 * `GET /:id` (1 segment) under Express's path-matching — order between
 * sub-router mount point and parent `/:id` is therefore safe.
 *
 * Security: every route requires authentication + horse ownership via
 * requireOwnership('horse'). Behaviour preserved verbatim from the original
 * inline definitions, including the :id → :horseId param-aliasing the XP
 * controller relies on.
 *
 * Note: legacy-score and trait-card use dynamic `await import(...)` to load
 * their services — preserved exactly because removing the laziness without
 * profiling startup cost would be a behavioural change.
 */

import express from 'express';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { getHorsePersonalityImpact } from '../controllers/horseController.mjs';
import * as horseXpController from '../controllers/horseXpController.mjs';
import { validateHorseId } from './_validators.mjs';
import AppError from '../../../errors/AppError.mjs';

const router = express.Router();

/**
 * GET /horses/:id/xp
 * Get horse XP status and progression information.
 *
 * Security: Validates horse ownership before returning XP data.
 */
router.get(
  '/:id/xp',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.getHorseXpStatus(req, res);
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
 * POST /horses/:id/allocate-stat
 * Allocate a stat point to a specific horse stat.
 *
 * Security: Validates horse ownership before allowing stat allocation.
 */
router.post(
  '/:id/allocate-stat',
  mutationRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.allocateStatPoint(req, res);
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
 * GET /horses/:id/xp-history
 * Get horse XP event history with pagination.
 *
 * Security: Validates horse ownership before returning XP history.
 */
router.get(
  '/:id/xp-history',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.getHorseXpHistory(req, res);
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
 * POST /horses/:id/award-xp
 * Award XP to a horse (for system/admin use).
 *
 * Security: Validates horse ownership before awarding XP.
 */
router.post(
  '/:id/award-xp',
  mutationRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.awardXpToHorse(req, res);
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
 * GET /api/horses/:id/personality-impact
 * Get most compatible grooms for a horse based on temperament.
 *
 * Security: Validates horse ownership before returning personality data.
 */
router.get(
  '/:id/personality-impact',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  getHorsePersonalityImpact,
);

/**
 * @swagger
 * /api/horses/{id}/legacy-score:
 *   get:
 *     summary: Get horse legacy score with trait integration
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
 *         description: Legacy score retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 *
 * Security: Validates horse ownership before calculating legacy score
 */
router.get(
  '/:id/legacy-score',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      // Equoria-93lhj: legacyScoreCalculator was moved into the horses module
      // (efonm wave 5). Import the same-module service via its relative deep path
      // — the prior `../../../services/legacyScoreCalculator.mjs` resolved to the
      // now-nonexistent backend/modules/services/, so the dynamic import rejected
      // with ERR_MODULE_NOT_FOUND and the handler returned 500 for valid horses.
      const { calculateLegacyScore } = await import('../services/legacyScoreCalculator.mjs');
      const legacyScore = await calculateLegacyScore(horseId);

      res.json({
        success: true,
        message: 'Legacy score retrieved successfully',
        data: {
          legacyScore,
        },
      });
    } catch (error) {
      // Equoria-vkzvx: TYPE-based 404 detection. The service throws a typed
      // NotFoundError (AppError subclass, statusCode 404) for a missing horse,
      // so we branch on the error's type/status — NOT on error.message.includes('not
      // found'). The old string-sniffing (Equoria-93lhj) misclassified a
      // 'Cannot find module' load failure: the message did not contain 'not found'
      // so it correctly fell through to 500 in that case, but the broader risk is
      // the inverse — any future internal error whose message happened to contain
      // 'not found' would have masqueraded as a clean 404. Type-based dispatch is
      // fail-closed: only a real typed 404 yields 404; every other error (including
      // a future import/module-load failure) surfaces loudly as 500.
      // AppError.isAppError survives module-cache duplication (see errors/AppError.mjs).
      if (AppError.isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to calculate legacy score',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * @swagger
 * /api/horses/{id}/trait-card:
 *   get:
 *     summary: Get horse trait timeline card
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
 *         description: Trait timeline card retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 *
 * Security: Validates horse ownership before returning trait card
 */
router.get(
  '/:id/trait-card',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      // Equoria-93lhj: traitTimelineService was moved into the traits module
      // (efonm wave 5). Import it through the traits module's public-API barrel
      // (cross-module boundary, per CONTRIBUTING.md). The prior
      // `../../../services/traitTimelineService.mjs` resolved to the now-nonexistent
      // backend/modules/services/, so the dynamic import rejected with
      // ERR_MODULE_NOT_FOUND and the handler returned 500 for valid horses.
      const { generateTraitTimeline } = await import('../../traits/index.mjs');
      const timeline = await generateTraitTimeline(horseId);

      res.json({
        success: true,
        message: 'Trait timeline card retrieved successfully',
        data: {
          timeline,
        },
      });
    } catch (error) {
      // Equoria-vkzvx: TYPE-based 404 detection (mirrors the legacy-score handler).
      // generateTraitTimeline does NOT itself throw not-found — for a missing horse
      // it returns an empty timeline (isEmpty:true), and ownership is already proven
      // by requireOwnership('horse') before this handler runs — so a real 404 here
      // would only originate from a typed NotFoundError thrown by a future dependency.
      // We branch on the typed AppError(404) rather than error.message.includes('not
      // found') so that an UNEXPECTED error (e.g. a future ERR_MODULE_NOT_FOUND import
      // failure like Equoria-93lhj) surfaces loudly as 500 instead of being silently
      // string-matched into a misleading 404 or a masked module-load 500.
      // AppError.isAppError survives module-cache duplication (see errors/AppError.mjs).
      if (AppError.isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate trait timeline',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

export default router;
