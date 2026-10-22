/**
 * Personality Evolution Routes — what is left of /api/v1/personality-evolution.
 *
 * Equoria-5d8ba (owner ruling 2026-10-22): the horse temperament-evolution
 * read endpoints (GET /horse/:horseId/{triggers,stability,predict,history})
 * and GET /config were removed with the personalityEvolutionSystem service
 * behind them. Temperament only affects the show matrix, groom bond and
 * trainer fit (owner ruling 2026-10-21), and players never change it
 * (Equoria-gu8jk), so nothing describes its "evolution". Those paths answer
 * the router's 404.
 *
 * Earlier removals: POST /horse/:horseId/evolve and POST /batch-evolve
 * (Equoria-gu8jk); POST /groom/:groomId/evolve (Equoria-jy3f7) and the groom
 * read paths (Equoria-j5qui) — groom personalities never evolve.
 *
 * Kept: POST /apply-effects answers 410 (Equoria-bvddn.4).
 */

import express from 'express';
import { authenticateToken } from '../../../middleware/auth.mjs';
import logger from '../../../utils/logger.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/personality-evolution/apply-effects — REMOVED (Equoria-bvddn.4,
 * audit 2026-09-25).
 *
 * This was commented "admin function" but carried no `requireRole('admin')`
 * (or any authorization beyond the router-level `authenticateToken`), so any
 * authenticated player could call it directly. It was already a no-op stub
 * that never wrote to the database.
 *
 * 410 (not 404) mirrors the established hard-deprecation idiom used for
 * other closed no-op/dead routes in this codebase (e.g. `POST
 * /api/v1/users/:id/add-xp`, Equoria-bvddn.1).
 */
router.post('/apply-effects', (req, res) => {
  logger.info(
    '[personalityEvolutionRoutes.POST /apply-effects] 410 Gone — unauthorized no-op stub removed (Equoria-bvddn.4, audit 2026-09-25)',
  );
  return res.status(410).json({
    success: false,
    message: 'Manual personality evolution effect application has been removed.',
  });
});

export default router;
