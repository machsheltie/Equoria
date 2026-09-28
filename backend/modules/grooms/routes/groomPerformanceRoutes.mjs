/**
 * Groom Performance Routes
 *
 * API endpoints for groom performance tracking and reputation management
 */

import express from 'express';
import { param, query } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import {
  requireOwnership,
  findOwnedResource as _findOwnedResource,
} from '../../../middleware/ownership.mjs';
import { handleValidationErrors } from '../../../middleware/validationErrorHandler.mjs';
import logger from '../../../utils/logger.mjs';
import {
  getGroomPerformance,
  getTopPerformers,
  getPerformanceConfig,
  getGroomAnalytics,
} from '../controllers/groomPerformanceController.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * POST /api/groom-performance/record — REMOVED (Equoria-bvddn.6, audit
 * 2026-09-25, mirrors the Equoria-6p398.3 / Equoria-bvddn.1 / Equoria-bvddn.3
 * closed-route precedent).
 *
 * `recordPerformance` only checked the SHAPE/RANGE of the submitted
 * bondGain/taskSuccess/wellbeingImpact/playerRating (express-validator
 * bounds, formerly on this route) — it never checked that the values came
 * from a real groom/horse interaction. Any authenticated owner of a groom
 * could POST fabricated performance values straight into
 * GroomPerformanceRecord, which feeds GET /top's reputationScore ranking
 * (groomPerformanceService.mjs getTopPerformingGrooms), placing an
 * unearned groom at the top.
 *
 * Resolution: remove the write from the player API outright. No caller
 * exists to preserve: the frontend never calls this route (frontend/src has
 * no reference to groom-performance), and the real interaction flow already
 * writes performance records server-side with server-derived values —
 * processInteractionWithPerformance (enhancedGroomInteractions.mjs) computes
 * bondGain/taskSuccess/wellbeingImpact from the actual interaction effects
 * and calls recordGroomPerformance() directly (the service function, not
 * this route) fire-and-forget. That real path is untouched by this closure.
 * GET routes on this router (config, top, groom/:id, analytics/:id) are
 * read-only and were never part of the exploit, so they are untouched too.
 *
 * 410 (not 404) mirrors the established hard-deprecation idiom.
 * `authenticateToken` runs first (router.use above), so an anonymous caller
 * still gets 401.
 */
router.post('/record', (req, res) => {
  logger.info(
    '[groomPerformanceRoutes.POST /record] 410 Gone — player-authored performance records removed (Equoria-bvddn.6, audit 2026-09-25)',
  );
  return res.status(410).json({
    success: false,
    message:
      'Manual performance recording has been removed. Performance is recorded automatically from real groom interactions.',
    data: null,
  });
});

/**
 * GET /api/groom-performance/groom/:groomId
 * Get performance summary for a specific groom
 *
 * Security: Validates groom ownership before returning performance data
 */
router.get(
  '/groom/:groomId',
  [param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer')],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  getGroomPerformance,
);

/**
 * GET /api/groom-performance/analytics/:groomId
 * Get detailed analytics for a specific groom
 *
 * Security: Validates groom ownership before returning analytics data
 */
router.get(
  '/analytics/:groomId',
  [
    param('groomId').isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days must be between 1 and 365'),
  ],
  handleValidationErrors,
  requireOwnership('groom', { idParam: 'groomId' }),
  getGroomAnalytics,
);

/**
 * GET /api/groom-performance/top
 * Get top performing grooms for the user
 */
router.get(
  '/top',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('Limit must be between 1 and 20'),
  ],
  handleValidationErrors,
  getTopPerformers,
);

/**
 * GET /api/groom-performance/config
 * Get performance tracking configuration
 */
router.get('/config', getPerformanceConfig);

export default router;
