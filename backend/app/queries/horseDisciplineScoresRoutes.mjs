/**
 * GET /horses/:id/discipline-scores — the owner's Discipline Scores for the
 * horse page's Progression section (Equoria-a0fim).
 *
 * Mounted by backend/app/routers.mjs at /horses on the authRouter, after the
 * visitor router and before the horses module router. Its one two-segment path
 * has no competing pattern in either. Owner-only: requireOwnership answers 404
 * for another player's horse, as the horse's other owner reads do.
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.mjs';
import { requireOwnership } from '../../middleware/ownership.mjs';
import { queryRateLimiter } from '../../middleware/rateLimiting.mjs';
// Request validators are HTTP-layer helpers the horses barrel does not export
// (Equoria-q4uem.4 ruling 4); the application layer imports them directly.
import {
  validateHorseId,
  rejectPollutedRequest,
} from '../../modules/horses/routes/_validators.mjs';
import logger from '../../utils/logger.mjs';
import { getHorseDisciplineScores } from './horseDisciplineScoresQuery.mjs';

const router = express.Router();

router.get(
  '/:id/discipline-scores',
  queryRateLimiter,
  authenticateToken,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const disciplines = await getHorseDisciplineScores(Number.parseInt(req.params.id, 10));
      if (!disciplines) {
        return res.status(404).json({ success: false, message: 'Horse not found' });
      }
      return res.json({ success: true, data: { disciplines } });
    } catch (error) {
      logger.error(`[horseDisciplineScoresRoutes GET /:id/discipline-scores] ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

export default router;
