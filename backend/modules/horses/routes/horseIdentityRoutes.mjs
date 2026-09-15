/**
 * Horse Identity Sub-Router (Equoria-qkgfh.1)
 *
 * Owns the endpoints that change who a horse IS to its owner, as opposed to
 * what it can do:
 *
 *   PATCH /:id/name   — rename a horse
 *
 * WHY A DEDICATED ENDPOINT
 *   A foal is born `unnamed` (owner ruling 2026-09-14, Equoria-4fnro:
 *   `UNNAMED_HORSE_NAME` in services/horseNamePolicy.mjs) and stays so until her
 *   player names her — so naming is a thing the player does, not a field the
 *   server fills in. The owner also ruled 2026-09-08 that "foals can be renamed
 *   at any time for any reasons" — no cooldown, no once-only limit, no
 *   justification — and 2026-09-09 that names need not be unique.
 *
 *   THIS IS NOW THE ONLY WAY TO RENAME A HORSE. `PUT /horses/:id` used to accept
 *   a `name`; as of Equoria-4fnro it REFUSES any body containing one and says so
 *   ("rename a horse with PATCH /horses/:id/name"). That route is a
 *   mass-assignment path that also takes sex, dateOfBirth, sireId and damId, and
 *   it enforced no length bound at all — the same reasoning `_validators.mjs`
 *   records for keeping breedId off its allow-list. Do not re-add `name` there.
 *
 * WHERE IT IS CALLED FROM
 *   The pencil beside the horse's name on the horse-detail header
 *   (frontend/src/pages/horse-detail/HorseProfileCard.tsx, via `useRenameHorse`).
 *   No age gate, by ruling. Failure is reported at the field; success is the
 *   header re-rendering with the committed name.
 *
 * Mounting: mounted at the SAME path as the parent (`router.use(...)` in
 * horseRoutes.mjs). `/:id/name` is 2 segments and so cannot collide with the
 * parent's `GET /:id` (1 segment); mount position is not load-bearing. The
 * parent is itself mounted on the authenticated router at /api/v1/horses, so
 * the live path is PATCH /api/v1/horses/:id/name — versioned like every
 * neighbour.
 *
 * Security: `authenticateToken` (belt-and-braces — the authRouter mount already
 * applies it, matching POST /:id/foal-now) then `validateHorseId` and
 * `requireOwnership('horse')`, whose WHERE clause is
 * `{ id, userId: req.user.id }` — real row ownership, and a single 404 for both
 * "no such horse" and "not yours" (CWE-639). PATCH is state-changing, so the
 * authRouter's csrfProtection covers it.
 */

import express from 'express';

import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';
import { renameHorseById } from '../services/renameHorseService.mjs';
import {
  rejectPollutedRequest,
  validateHorseId,
  validateHorseRenamePayload,
} from './_validators.mjs';

const router = express.Router();

/**
 * PATCH /horses/:id/name
 * Rename a horse the caller owns. Body: { name: string }
 *
 * Unrestricted by ruling: any time, any reason, any number of times, and the
 * name need not be unique.
 */
router.patch(
  '/:id/name',
  mutationRateLimiter,
  authenticateToken,
  rejectPollutedRequest,
  validateHorseId,
  validateHorseRenamePayload,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);
      const { status, body } = await renameHorseById(horseId, req.user.id, req.body.name);
      return res.status(status).json(body);
    } catch (error) {
      logger.error(`[horseIdentityRoutes PATCH /:id/name] Error: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

export default router;
