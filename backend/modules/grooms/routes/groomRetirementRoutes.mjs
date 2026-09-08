/**
 * Groom retirement-management sub-router (Equoria-8mdpc god-file split).
 *
 * Mounted under the parent `groomRoutes.mjs` (which is mounted at `/grooms`),
 * so the routes below resolve to:
 *   GET  /grooms/retirement/statistics
 *   GET  /grooms/:id/retirement/eligibility
 *   POST /grooms/:id/retirement/process   — CLOSED to players (403)
 *
 * Route ordering: the two-segment `/retirement/*` collection route and the
 * three-segment `/:id/retirement/*` resource routes differ in segment count
 * and pattern, so Express cannot confuse them and mount order relative to the
 * parent's `/:id/...` routes is not load-bearing.
 *
 * EQUORIA-M9LZ1 — WHAT CHANGED HERE AND WHY
 *   The owner ruled (2026-09-08) that "players don't retire grooms" and that a
 *   groom's retirement age "is not known until the week they retire". Two of
 *   this router's four routes existed to do exactly the opposite:
 *
 *   1. `POST /:id/retirement/process` let any owner retire any of their grooms,
 *      with a `force` flag that skipped the eligibility check entirely. It is
 *      now a 403 (see below).
 *   2. `GET /retirement/approaching` returned the caller's grooms within one
 *      week of retiring, with the per-groom `weeksUntilRetirement` countdown
 *      attached. That IS the forbidden disclosure, so the route is deleted along
 *      with the `getGroomsApproachingRetirement` service function behind it. No
 *      frontend client called it (`frontend/src/lib/api/grooms.ts` has no
 *      retirement call at all) and no E2E spec referenced it.
 *
 *   `GET /:id/retirement/eligibility` survives, but the service behind it no
 *   longer returns `weeksUntilRetirement` or `noticeRequired` — both let a client
 *   that knows `careerWeeks` recover the hidden age by subtraction.
 *   `GET /retirement/statistics` survives without its `approachingRetirement`
 *   count, for the same reason.
 */

import express from 'express';
import { param } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  checkRetirementEligibility,
  getRetirementStatistics,
} from '../services/groomRetirementService.mjs';
import logger from '../../../utils/logger.mjs';
import { handleValidationErrors } from './_groomRouteHelpers.mjs';

const router = express.Router();

/**
 * @swagger
 * /api/grooms/{id}/retirement/eligibility:
 *   get:
 *     summary: Check whether the game will retire this groom
 *     tags: [Grooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Groom ID
 *     responses:
 *       200:
 *         description: Retirement eligibility status (no retirement age, no countdown)
 *       404:
 *         description: Groom not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/retirement/eligibility',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  handleValidationErrors,
  requireOwnership('groom'),
  async (req, res) => {
    try {
      const groomId = parseInt(req.params.id);
      const eligibility = await checkRetirementEligibility(groomId);

      res.json({
        success: true,
        data: eligibility,
      });
    } catch (error) {
      logger.error('Error checking retirement eligibility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check retirement eligibility',
        error: error.message,
      });
    }
  },
);

/**
 * POST /grooms/:id/retirement/process — CLOSED to players (owner ruling
 * 2026-09-08, Equoria-m9lz1: "Players don't retire grooms. Grooms retire
 * automatically at a randomly selected age by the game.").
 *
 * It ran `param('id')` + `body('reason')` + `body('force')` validators then
 * `requireOwnership('groom')` and handed all three straight to
 * `processRetirement(groomId, reason, force)`. Ownership answers "is this my
 * groom", never "may this groom's career be ended" — the same confusion the
 * 2026-09-05 audit closed for free horse creation (Finding 2, `POST /horses`)
 * and Equoria-9tque closed for horse deletion (`DELETE /horses/:id`). Worse,
 * `force: true` bypassed the eligibility check entirely, and the service it
 * called then ran `groomAssignment.deleteMany({ where: { groomId } })` — so one
 * player request destroyed that groom's whole assignment history and detached
 * every past `GroomInteraction` from the assignment that produced it. It was the
 * only remaining path in the codebase that destroyed assignment history and the
 * only one a player could trigger.
 *
 * 403 follows Finding 2 and Equoria-9tque, not Finding 3's 410: `/grooms/:id` is
 * not gone and `/:id/retirement/eligibility` still serves the owner; only the
 * permission to end a career is withdrawn. The rejection sits BEHIND the
 * authRouter's `authenticateToken` (so an anonymous POST is still 401) and
 * BEFORE the validators and `requireOwnership`, so it is payload- and
 * id-independent: a groom you own, a groom another player owns, an id that does
 * not exist and a malformed id all produce byte-identical responses, and the
 * route cannot be used as an existence or ownership oracle.
 *
 * The retained legitimate path is the game's own:
 * `groomRetirementService.processWeeklyCareerProgression` →
 * `processRetirement`, which retires a groom when it reaches its hidden
 * retirement age and notifies the player in the same transaction.
 *
 * Locked by __tests__/groomRetirementEndpointClosed.integration.test.mjs, whose
 * matcher needs the words "cannot be retired" — reword the message with it.
 */
router.post('/:id/retirement/process', (req, res) => {
  logger.warn(
    `[groomRetirementRoutes] Rejected groom retirement attempt by user ${req.user?.id} (Equoria-m9lz1: retirement belongs to the game)`,
  );
  return res.status(403).json({
    success: false,
    message:
      'Grooms cannot be retired. A groom retires on their own when their working years are done, and you will hear about it in time to take on someone new.',
  });
});

/**
 * @swagger
 * /api/grooms/retirement/statistics:
 *   get:
 *     summary: Get retirement statistics for current user
 *     tags: [Grooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Retirement statistics
 *       500:
 *         description: Internal server error
 */
router.get('/retirement/statistics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await getRetirementStatistics(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting retirement statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get retirement statistics',
      error: error.message,
    });
  }
});

export default router;
