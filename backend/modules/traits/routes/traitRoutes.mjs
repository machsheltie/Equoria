/**
 * Trait Management Routes
 * API endpoints for reading a horse's traits and their effects.
 *
 * No route here reveals or writes traits (Equoria-gu8jk; owner ruling
 * 2026-10-20: players must never write traits for themselves).
 * POST /discover/:horseId and POST /batch-discover, which moved hidden traits
 * into the visible lists on demand, were removed. Traits will be activated by
 * grooms (Equoria-09g33), not by a player button.
 *
 * Equoria-a7f1p: GET /definitions went with the trait reports (owner ruling
 * 2026-10-28, q152: no trait history or trait reports for players), and the
 * three trait-competition reads (/competition-impact, /competition-comparison,
 * /competition-effects) with the ruling that traits do nothing in show scores
 * until the trait rework and that comparisons are advice (2026-10-07, 2026-10-23).
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  getHorseTraits,
  markHorseTraitsSeen,
  getDiscoveryStatus,
} from '../controllers/traitController.mjs';
import logger from '../../../utils/logger.mjs';
// Equoria-jk9oj.2: declare auth at the router that OWNS these mutations rather
// than inferring it from the authRouter mount comment. Idempotent with the
// mount-level authenticateToken; the guard travels with the file if re-mounted.
import { authenticateToken } from '../../../middleware/auth.mjs';

const router = express.Router();
router.use(authenticateToken);

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    logger.warn(`[traitRoutes] Validation errors: ${JSON.stringify(errorArray)}`);
    return res.status(400).json({
      success: false,
      message: errorArray[0].msg, // Use specific error message
      errors: errorArray,
    });
  }
  next();
};

/**
 * @swagger
 * tags:
 *   name: Traits
 *   description: Horse trait discovery and management endpoints
 */

/**
 * @swagger
 * /api/traits/horse/{horseId}:
 *   get:
 *     summary: Get all traits for a specific horse
 *     tags: [Traits]
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the horse
 *     responses:
 *       200:
 *         description: Horse traits retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     horseId:
 *                       type: integer
 *                     horseName:
 *                       type: string
 *                     bondScore:
 *                       type: integer
 *                     age:
 *                       type: integer
 *                     traits:
 *                       type: object
 *                       properties:
 *                         positive:
 *                           type: array
 *                         negative:
 *                           type: array
 *                         hiddenCount:
 *                           type: integer
 *                     summary:
 *                       type: object
 *       400:
 *         description: Invalid horse ID
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/horse/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    handleValidationErrors,
    requireOwnership('horse', { idParam: 'horseId' }),
  ],
  getHorseTraits,
);

// First-view glow marker (Equoria-lylhb): writes only the viewer's private
// "seen" list, never a trait.
router.post(
  '/horse/:horseId/seen',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    handleValidationErrors,
    requireOwnership('horse', { idParam: 'horseId' }),
  ],
  markHorseTraitsSeen,
);

/**
 * @swagger
 * /api/traits/discovery-status/{horseId}:
 *   get:
 *     summary: Get discovery status and conditions for a horse
 *     tags: [Traits]
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the horse
 *     responses:
 *       200:
 *         description: Discovery status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     horseId:
 *                       type: integer
 *                     horseName:
 *                       type: string
 *                     currentStats:
 *                       type: object
 *                     traitCounts:
 *                       type: object
 *                     discoveryConditions:
 *                       type: object
 *                     canDiscover:
 *                       type: boolean
 *       400:
 *         description: Invalid horse ID
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/discovery-status/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    handleValidationErrors,
    requireOwnership('horse', { idParam: 'horseId' }),
  ],
  getDiscoveryStatus,
);

export default router;
