/**
 * Groom Management Routes
 * API endpoints for groom assignments, interactions, and management.
 *
 * Equoria-8mdpc god-file split: this parent keeps the foundational endpoints
 * (assign / interact / user / profile / synergy / assignment-logs /
 * bonus-traits (closed PUT)) and mounts
 * three sub-domain sub-routers at the bottom (mirroring the Equoria-y8u2j
 * horseRoutes pattern):
 *   - groomRetirementRoutes.mjs  (/retirement/*, /:id/retirement/*)
 *   - groomLegacyRoutes.mjs      (/legacy/*,     /:id/legacy/*)
 *   - groomTalentsRoutes.mjs     (/talents/*,    /:id/talents/*)
 *
 * Sub-routers are mounted AFTER the parent's own routes are registered, so the
 * relative registration order of the parent's foundational routes is preserved
 * exactly. The sub-router prefixes (/retirement, /legacy, /talents and their
 * /:id/<prefix> resource variants) do not overlap with any foundational route,
 * so mount order is not load-bearing — but the original order is preserved
 * regardless to guarantee zero behaviour change.
 */

import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  assignGroom,
  getUserGrooms,
  getGroomProfile,
  getGroomAssignmentLogs,
  getGroomHorseSynergyPreview,
} from '../controllers/groomController.mjs';
import logger from '../../../utils/logger.mjs';
import { handleValidationErrors } from './_groomRouteHelpers.mjs';
import { retiredGroomDoor } from '../controllers/groomCareController.mjs';
import groomRetirementRoutes from './groomRetirementRoutes.mjs';
import groomLegacyRoutes from './groomLegacyRoutes.mjs';
import groomTalentsRoutes from './groomTalentsRoutes.mjs';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Grooms
 *   description: Groom assignment and management endpoints
 */

/**
 * @swagger
 * /api/grooms/assign:
 *   post:
 *     summary: Assign a groom to a foal
 *     tags: [Grooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - foalId
 *               - groomId
 *             properties:
 *               foalId:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID of the foal
 *               groomId:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID of the groom
 *     responses:
 *       200:
 *         description: Groom assigned successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Internal server error
 */
router.post(
  '/assign',
  authenticateToken,
  [
    body('foalId').isInt({ min: 1 }).withMessage('foalId must be a positive integer'),
    body('groomId').isInt({ min: 1 }).withMessage('groomId must be a positive integer'),
    handleValidationErrors,
  ],
  // Dual ownership validation middleware (IDOR protection)
  async (req, res, next) => {
    try {
      const { foalId, groomId } = req.body;
      const userId = req.user.id;

      // Import findOwnedResource dynamically to avoid circular dependencies
      const { findOwnedResource } = await import('../../../middleware/ownership.mjs');

      // Validate foal ownership
      const foal = await findOwnedResource('foal', foalId, userId);
      if (!foal) {
        return res.status(404).json({
          success: false,
          message: 'Foal not found',
        });
      }

      // Validate groom ownership
      const groom = await findOwnedResource('groom', groomId, userId);
      if (!groom) {
        return res.status(404).json({
          success: false,
          message: 'Groom not found',
        });
      }

      // Attach validated resources for controller
      req.foal = foal;
      req.groom = groom;
      next();
    } catch (error) {
      logger.error('[groomRoutes] Ownership validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
  assignGroom,
);

// GET /assignments/:foalId was removed with the duplicate lookups (owner ruling 2026-10-28,
// q151, Equoria-a7f1p): the Staff page reads a player's assignments from
// GET /api/v1/groom-assignments. (POST /ensure-default/:foalId was deleted earlier: no foal
// is given a default groom, owner ruling q153.)

/**
 * POST /api/grooms/interact — retired. "Groom horse" (POST /api/grooms/care/:horseId/groom)
 * is the only way to groom; this answers 410 (owner rulings 2026-10-20, 2026-10-26).
 */
router.post('/interact', retiredGroomDoor);

/**
 * @swagger
 * /api/grooms/user/{userId}:
 * /api/grooms/user/{userId}:
 *   get:
 *     summary: Get all grooms for a user
 *     summary: Get all grooms for a user
 *     tags: [Grooms]
 *     parameters:
 *       - in: path
 *         name: userId
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the user
 *         description: ID of the user
 *     responses:
 *       200:
 *         description: Grooms retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get(
  '/user/:userId',
  authenticateToken, // IDOR Protection: Require authentication
  [param('userId').notEmpty().withMessage('userId is required'), handleValidationErrors],
  // IDOR Protection: Self-access validation middleware
  (req, res, next) => {
    const targetUserId = req.params.userId;
    const authenticatedUserId = req.user.id;

    // Validate self-access: user can only access their own grooms
    if (authenticatedUserId !== targetUserId) {
      logger.warn(
        `[groomRoutes] Self-access violation: user ${authenticatedUserId} attempted to access grooms for user ${targetUserId}`,
      );
      return res.status(404).json({
        success: false,
        message: 'User not found', // Return 404 to prevent user enumeration
      });
    }

    next();
  },
  getUserGrooms,
);

// POST /hire is gone (Equoria-bvddn.7): it let a player build a groom with a
// chosen name, skill and experience. Players never create grooms (owner,
// 2026-10-21); they hire through /groom-marketplace/hire, so this path 404s.

// GET /definitions was removed with the duplicate lookups (owner ruling 2026-10-28, q151, Equoria-a7f1p).

/**
 * @swagger
 * /api/grooms/{groomId}/horses/{horseId}/synergy:
 *   get:
 *     summary: Preview the temperament-groom synergy modifier for a groom/horse pair (31D-4, Equoria-ictn).
 *     tags: [Grooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groomId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Synergy preview computed
 *       400:
 *         description: Invalid id
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Groom or horse not found
 */
router.get(
  '/:groomId/horses/:horseId/synergy',
  authenticateToken,
  [
    param('groomId').isInt({ min: 1 }).withMessage('groomId must be a positive integer'),
    param('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer'),
    handleValidationErrors,
  ],
  getGroomHorseSynergyPreview,
);

/**
 * @swagger
 * /api/grooms/{id}/profile:
 *   get:
 *     summary: Get groom profile including personality
 *     tags: [Grooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Groom ID
 *     responses:
 *       200:
 *         description: Groom profile retrieved successfully
 *       404:
 *         description: Groom not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/profile',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  requireOwnership('groom'),
  getGroomProfile,
);

/**
 * GET /api/grooms/:id/assignment-logs
 * Equoria-wb7z — Past-assignment history for a single groom.
 * Returns up to 50 GroomAssignmentLog rows ordered by assignedAt desc,
 * including the horse name + id for display.
 */
router.get(
  '/:id/assignment-logs',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  requireOwnership('groom'),
  getGroomAssignmentLogs,
);

// GET /:id/bonus-traits was removed with the duplicate lookups (owner ruling 2026-10-28, q151, Equoria-a7f1p):
// the groom profile already carries bonusTraitMap.

/**
 * PUT /:id/bonus-traits — REMOVED (Equoria-bvddn.3, audit 2026-09-25, mirrors
 * Equoria-6p398.3's horse-XP closure and Equoria-bvddn.1's user-XP closure).
 *
 * `updateGroomBonusTraits` -> `assignBonusTraits` only checked the SHAPE of
 * the submitted map (<=3 traits, <=0.3 each, groomBonusTraitService.mjs:
 * 27-28) — never the service's own earning conditions (bond >= 60, >= 75%
 * assignment coverage, :29-30, enforced only inside checkBonusEligibility,
 * :236-237). Any owner could PUT arbitrary bonus traits into
 * `Groom.bonusTraitMap` with zero play, including 3 rare traits at 0.3
 * each, which also unlocked the `any-with-3-rare-bonuses` rare-trait
 * booster perk (groomRareTraitPerks.mjs:173-181) for free.
 *
 * No caller to preserve: the frontend only reads `bonusTraitMap`
 * (GroomBonusTraitPanel), and no server code calls `assignBonusTraits`
 * except this route's controller. The real earned-bonus path
 * (`checkBonusEligibility` -> `traitAssignmentLogic.mjs`) applies
 * probability bonuses at trait-roll time and never writes `bonusTraitMap`;
 * it is untouched. `assignBonusTraits`/`updateGroomBonusTraits` are left in
 * place (service-level tests still exercise them directly) — removing dead
 * code is out of scope. GET /:id/bonus-traits (read-only, not part of the
 * exploit) was left too; it went later as a duplicate lookup (Equoria-a7f1p,
 * q151), with the now-unused groomBonusTraitsController.
 *
 * 410 mirrors the established closed-route idiom. `authenticateToken` is
 * kept (file has no router-level auth) so anonymous still gets 401; the
 * `param('id')`/`body('bonusTraits')` validators and
 * `requireOwnership('groom')` are removed — the refusal runs before any of
 * that.
 */
router.put('/:id/bonus-traits', authenticateToken, (req, res) => {
  logger.info(
    '[groomRoutes.PUT /:id/bonus-traits] 410 Gone — self-service bonus trait assignment removed (Equoria-bvddn.3, audit 2026-09-25)',
  );
  return res.status(410).json({
    success: false,
    message:
      'Manual bonus-trait assignment has been removed. Bonus traits are earned through groom care (bond and assignment coverage) and applied automatically during trait rolls.',
  });
});

// ===== SUB-DOMAIN SUB-ROUTERS (Equoria-8mdpc god-file split) =====
// Mounted after the parent's foundational routes so the parent's relative
// registration order is preserved. Each sub-router carries a distinct
// sub-domain prefix (/retirement, /legacy, /talents and their /:id/<prefix>
// resource variants) that does not overlap with any foundational route above.
router.use(groomRetirementRoutes);
router.use(groomLegacyRoutes);
router.use(groomTalentsRoutes);

export default router;
