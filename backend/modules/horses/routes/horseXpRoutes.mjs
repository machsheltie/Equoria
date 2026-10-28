/**
 * Horse XP / Personality / Trait-Card Sub-Router (Equoria-y8u2j split)
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split. Owns the owner-scoped, per-horse progression / personality
 * endpoints:
 *
 *   GET    /:id/xp                  — XP status + progression
 *   POST   /:id/allocate-stat       — spend an unspent stat point
 *   GET    /:id/xp-history          — REMOVED, unmounted (404; Equoria-fly7a)
 *   POST   /:id/award-xp            — REMOVED, 410 Gone (Equoria-6p398.3)
 *   GET    /:id/personality-impact  — groom-compatibility ranking
 *   GET    /:id/legacy-score        — REMOVED, unmounted (404; owner ruling q242)
 *
 * Mounting: this router is mounted at the SAME path as the parent
 * (`router.use(horseXpRoutes)` in horseRoutes.mjs). All routes start with
 * `/:id/...` (2 segments) so they do NOT conflict with the parent's
 * `GET /:id` (1 segment) under Express's path-matching — order between
 * sub-router mount point and parent `/:id` is therefore safe.
 *
 * Security: every LIVE route requires authentication + horse ownership via
 * requireOwnership('horse'). Behaviour preserved verbatim from the original
 * inline definitions, including the :id → :horseId param-aliasing the XP
 * controller relies on. The one exception is the hard-deprecated
 * `POST /:id/award-xp`, which answers 410 for every authenticated caller and
 * therefore performs no ownership lookup (Equoria-6p398.3, audit Finding 3).
 */

import express from 'express';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { getHorsePersonalityImpact } from '../controllers/horseController.mjs';
import * as horseXpController from '../controllers/horseXpController.mjs';
import { validateHorseId } from './_validators.mjs';
// Equoria-jk9oj.2: declare auth at the router that OWNS these mutations rather
// than inferring it from the authRouter mount comment. Idempotent with the
// mount-level authenticateToken; the guard travels with the file if re-mounted.
import { authenticateToken } from '../../../middleware/auth.mjs';
import logger from '../../../utils/logger.mjs';

const router = express.Router();
router.use(authenticateToken);

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
 * POST /horses/:id/award-xp — REMOVED (Equoria-6p398.3, audit Finding 3, 410 Gone)
 *
 * This was labelled "system/admin XP grant" but its only authorization was
 * `requireOwnership('horse')`. Ownership answers whether the caller owns the
 * horse; it never answered whether the caller may MANUFACTURE progression. The
 * controller took `amount` and `reason` straight off `req.body`, so the
 * 2026-09-05 audit drove an ordinary `role=user` account to POST
 * `{"amount":1000,"reason":"audit fixture"}` against its own horse and got HTTP
 * 200 with `horseXp 0 -> 1000` and `availableStatPoints 0 -> 10`. Horse stats
 * feed competition scoring, which feeds prize money — a self-serve faucet.
 *
 * Resolution chosen (brief step 1, first option): remove the manual award from
 * the player API outright rather than gate it behind
 * `requireRole('admin')`. There is no supported admin use to
 * preserve — nothing in the repository called this endpoint: no admin route, no
 * script, no seed, no E2E spec, and the frontend `addXp()` / `useAddXp()` pair
 * had zero live component consumers (both removed with this change). Adding an
 * admin grant surface nobody asked for would be inventing product scope.
 *
 * Horse XP is now SERVER-AUTHORITATIVE: the only writer is the internal service
 * (`horseXpModelService.addXpToHorseCore` / `addXpToHorse`), whose live caller
 * is `competitionAwards.awardPlacementProgression` under the overnight
 * `executeClosedShows` executor, which computes the amount from the owner-ruled
 * Horse Points table (R8: 10/5/3/1, competitionAwards.mjs) and server-side placement. Owners keep `GET /:id/xp`
 * and `POST /:id/allocate-stat` for EARNED points. (`GET /:id/xp-history` was
 * removed with the points history the owner dropped on 2026-10-28, Equoria-fly7a.)
 *
 * 410 (not a silent 404) mirrors the established Equoria-kacla hard-deprecation
 * idiom for `POST /api/v1/competition/enter-show`: an unambiguous "this endpoint
 * is gone" for any stale client. `mutationRateLimiter` is kept so the
 * deprecation response still carries standard rate-limit headers, and the
 * router-level `authenticateToken` still makes an anonymous call a 401. No
 * ownership lookup runs — the answer does not depend on who owns the horse, so
 * the handler is fail-closed for every caller and leaks nothing.
 */
router.post('/:id/award-xp', mutationRateLimiter, (req, res) => {
  logger.info(
    `[horseXpRoutes.POST /:id/award-xp] 410 Gone — manual XP grants removed (Equoria-6p398.3, audit Finding 3); user ${req.user?.id}`,
  );
  return res.status(410).json({
    success: false,
    message:
      'Manual horse XP awards have been removed. Horse XP is awarded by the server from competition results; owners can read XP at GET /api/v1/horses/:id/xp and spend earned stat points at POST /api/v1/horses/:id/allocate-stat.',
  });
});

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

export default router;
