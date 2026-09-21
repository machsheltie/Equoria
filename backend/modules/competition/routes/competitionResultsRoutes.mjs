/**
 * Competition-results routes (Equoria-oey96.28).
 *
 * Mounted at `/api/v1/competition/results` from the app composition root
 * (backend/app/routers.mjs), immediately BEFORE `/competition`, so the literal
 * prefix is matched before the broader competition router sees the path.
 *
 * WHY A SEPARATE ROUTER FILE rather than one more handler in
 * `competitionRoutes.mjs`: that file is 685 lines and sits in
 * `scripts/doctrine-checks/file-size-baseline.json` at exactly that count. The
 * shrink-only ratchet fails on any growth, and raising a baseline entry needs an
 * owner-approved reason (`.claude/rules/CONTRIBUTING.md`) — which "I wanted to
 * add a route" is not. The results-viewed write is its own small concern, so it
 * gets its own small file instead.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import auth from '../../../middleware/auth.mjs';
import { mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';
import { markUserResultsViewed } from '../services/resultModelService.mjs';

const router = express.Router();

/**
 * POST /api/v1/competition/results/viewed
 * Mark the authenticated player's results for the named shows as seen.
 *
 * Request body: { showIds: number[] } — the shows whose results the player has
 * just been shown. The results surface (Equoria-oey96.5 /
 * CompetitionResultsPage) sends the ids of the summaries it rendered.
 *
 * Response: { success: true, markedCount: <rows newly marked> }
 *
 * Why this exists: the Hub's `check-results` next-action (Story 23.4 priority 2)
 * fires while any of the player's results still has `viewedAt` NULL. Without a
 * write, the nudge would never clear.
 *
 * Security:
 *   - Auth-gated + CSRF-protected (inherited from authRouter in app/routers.mjs).
 *   - Owner derived from `req.user.id` ONLY. The service scopes the update
 *     through the horse relation, so a show id naming another player's result
 *     matches nothing. No userId is accepted from the client — accepting one
 *     would be the same IDOR the sibling GET /user-results route refuses.
 *   - `mutationRateLimiter`, matching every other mutation in this module.
 *   - Body validated before any database work.
 */
router.post(
  '/viewed',
  mutationRateLimiter,
  auth,
  [
    body('showIds')
      .isArray({ min: 1, max: 100 })
      .withMessage('showIds must be a non-empty array of at most 100 show IDs'),
    body('showIds.*').isInt({ min: 1 }).withMessage('Each show ID must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[competitionResultsRoutes.POST /viewed] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      // Defensive — authenticateToken rejects upstream; fail closed here too.
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    try {
      const showIds = req.body.showIds.map(id => parseInt(id, 10));
      const markedCount = await markUserResultsViewed(userId, showIds);

      logger.info(
        `[competitionResultsRoutes.POST /viewed] user=${userId} shows=${showIds.length} marked=${markedCount}`,
      );

      return res.json({ success: true, markedCount });
    } catch (error) {
      // withRetryableTxMapping stamps a transient transaction timeout with 503
      // so the client can retry; anything else is a genuine 500.
      const status = error.status === 503 ? 503 : 500;
      logger[status === 503 ? 'warn' : 'error'](
        `[competitionResultsRoutes.POST /viewed] Error: ${error.message}`,
      );
      return res.status(status).json({
        success: false,
        message: status === 503 ? error.message : 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

export default router;
