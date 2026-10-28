/**
 * GET /horses/:id/visit — any horse, seen as a visitor (Equoria-q4uem.9;
 * owner rulings q90 2026-10-26 and q107 2026-10-27).
 *
 * Mounted by backend/app/routers.mjs at /horses on the authRouter (session +
 * CSRF), after the query router and before the horses module router. Its one
 * two-segment path has no competing pattern in either. Not owner-gated: the
 * view is the public projection in horseVisitQuery.mjs, the same facts any
 * player may see of a horse (revealed traits are public forever, S-Q9).
 */
import express from 'express';
import { authenticateToken } from '../../middleware/auth.mjs';
import { queryRateLimiter } from '../../middleware/rateLimiting.mjs';
// Request validators are HTTP-layer helpers the horses barrel does not export
// (Equoria-q4uem.4 ruling 4); the application layer imports them directly.
import {
  validateHorseId,
  rejectPollutedRequest,
} from '../../modules/horses/routes/_validators.mjs';
import logger from '../../utils/logger.mjs';
import { parsePaginationParams, buildPaginatedResponse } from '../../utils/paginationHelper.mjs';
import { getHorseVisit, getHorseVisitShowResults } from './horseVisitQuery.mjs';

const router = express.Router();

router.get(
  '/:id/visit',
  queryRateLimiter,
  authenticateToken,
  rejectPollutedRequest,
  validateHorseId,
  async (req, res) => {
    try {
      const visit = await getHorseVisit(Number.parseInt(req.params.id, 10), req.user.id);
      if (!visit) {
        return res.status(404).json({ success: false, message: 'Horse not found', status: 'fail' });
      }
      return res.json({ success: true, data: visit });
    } catch (error) {
      logger.error(`[horseVisitRoutes GET /:id/visit] ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

/**
 * GET /horses/:id/visit/show-results?page&limit — the horse's show ledger for
 * the visitor page's Show Results tab (q205: visitors see everything on a
 * horse's page, read-only). The same rows and paging as the owner's
 * GET /competition/results/horse/:horseId; 404 when there is no such horse.
 */
router.get(
  '/:id/visit/show-results',
  queryRateLimiter,
  authenticateToken,
  rejectPollutedRequest,
  validateHorseId,
  async (req, res) => {
    try {
      const horseId = Number.parseInt(req.params.id, 10);
      const { page, limit, skip } = parsePaginationParams(req, { defaultLimit: 50, maxLimit: 100 });
      const ledger = await getHorseVisitShowResults(horseId, { skip, take: limit });
      if (!ledger) {
        return res.status(404).json({ success: false, message: 'Horse not found', status: 'fail' });
      }
      return buildPaginatedResponse(res, ledger.rows, { page, limit, total: ledger.total });
    } catch (error) {
      logger.error(`[horseVisitRoutes GET /:id/visit/show-results] ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

export default router;
