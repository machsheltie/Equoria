/**
 * Horse Feed Sub-Router (Equoria-y8u2j split)
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split. Owns the 5 feed/equippable endpoints under /horses/:id/...
 *
 *   POST   /:id/equip-feed       — equip a feed type from user's inventory
 *   POST   /:id/unequip-feed     — clear the horse's equipped feed type
 *   POST   /:id/feed             — daily feed action (inventory decrement)
 *   POST   /:id/reset-last-fed   — owner test-helper: rewind lastFedDate
 *   GET    /:id/equippable       — list tack + feed items equippable on horse
 *
 * Mounting: this router is mounted at the SAME path as the parent
 * (`router.use(horseFeedRoutes)` in horseRoutes.mjs). All routes start with
 * `/:id/...` (2 segments) so they do NOT conflict with the parent's `GET /:id`
 * (1 segment) under Express's path-matching — order between sub-router mount
 * point and parent `/:id` is therefore safe.
 *
 * Security: every route requires authentication + horse ownership via
 * requireOwnership('horse'). Behaviour preserved verbatim from the original
 * inline definitions.
 */

import express from 'express';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  equipFeedHandler,
  unequipFeedHandler,
  feedHorseHandler,
  getEquippableHandler,
} from '../controllers/horseFeedController.mjs';
import { resetHorseLastFed } from '../controllers/horseController.mjs';
import { validateHorseId } from './_validators.mjs';

const router = express.Router();

/**
 * POST /horses/:id/equip-feed
 * Set Horse.equippedFeedType from the authenticated user's pooled inventory
 * (feed-system redesign 2026-04-29, Equoria-wr30).
 *
 * Security: ownership enforced via requireOwnership('horse') middleware
 * (CWE-639 disclosure resistance — returns 404 for both missing and
 * not-owned). Inventory ownership enforced inside the controller.
 */
router.post(
  '/:id/equip-feed',
  mutationRateLimiter,
  validateHorseId,
  authenticateToken,
  requireOwnership('horse'),
  equipFeedHandler,
);

/**
 * POST /horses/:id/unequip-feed
 * Clear Horse.equippedFeedType for an owned horse.
 *
 * Security: ownership enforced via requireOwnership('horse') middleware
 * (CWE-639 disclosure resistance — returns 404 for both missing and
 * not-owned).
 */
router.post(
  '/:id/unequip-feed',
  mutationRateLimiter,
  validateHorseId,
  authenticateToken,
  requireOwnership('horse'),
  unequipFeedHandler,
);

/**
 * POST /horses/:id/feed
 * Daily feed action — transactional inventory decrement, lastFedDate set,
 * stat-boost RNG roll (feed-system redesign 2026-04-29, Equoria-l5kf).
 *
 * Security: ownership enforced via requireOwnership('horse') middleware
 * (CWE-639 disclosure resistance — returns 404 for both missing and
 * not-owned). Service performs a defense-in-depth owner check inside its
 * transaction (also returns 404 on mismatch).
 */
router.post(
  '/:id/feed',
  mutationRateLimiter,
  validateHorseId,
  authenticateToken,
  requireOwnership('horse'),
  feedHorseHandler,
);

/**
 * POST /horses/:id/reset-last-fed
 * Owner-scoped test/fixture helper: rewinds the horse's lastFedDate so the
 * same-day feed gate (alreadyFedToday) no longer blocks a subsequent feed.
 * Body: { days?: number } (default 1, max 30).
 *
 * See horseController.resetHorseLastFed for full rationale (Equoria-4sqr).
 */
router.post(
  '/:id/reset-last-fed',
  mutationRateLimiter,
  validateHorseId,
  authenticateToken,
  requireOwnership('horse'),
  resetHorseLastFed,
);

/**
 * GET /horses/:id/equippable
 * Returns the tack + feed items the user can equip on this horse
 * (feed-system redesign 2026-04-29, Equoria-o0af).
 *
 * Security: ownership enforced via requireOwnership('horse') middleware
 * (CWE-639 disclosure resistance).
 */
router.get(
  '/:id/equippable',
  queryRateLimiter,
  validateHorseId,
  authenticateToken,
  requireOwnership('horse'),
  getEquippableHandler,
);

export default router;
