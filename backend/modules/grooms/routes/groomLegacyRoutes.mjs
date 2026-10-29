/**
 * Groom legacy-system sub-router (Equoria-8mdpc god-file split).
 *
 * Mounted under the parent `groomRoutes.mjs` (which is mounted at `/grooms`),
 * so the routes below resolve to:
 *   GET  /grooms/legacy/history
 *   GET  /grooms/:id/legacy/eligibility
 *
 * POST /grooms/:id/legacy/create was removed (Equoria-bhoka): players never create
 * grooms (owner ruling 2026-10-21, Q14); the game generates new grooms weekly and
 * pairs a retiring mentor with an existing groom itself (autoCreateLegacyOnRetirement).
 *
 * Extracted verbatim from groomRoutes.mjs — handler chains, validation,
 * ownership middleware, and response shapes are byte-compatible with the
 * originals (this is code-motion, not a refactor).
 *
 * Route ordering: the two-segment `/legacy/history` collection route and the
 * three-segment `/:id/legacy/eligibility` resource route differ in segment count and
 * pattern, so Express cannot confuse them.
 */

import express from 'express';
import { param } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import { checkLegacyEligibility, getUserLegacyHistory } from '../services/groomLegacyService.mjs';
import logger from '../../../utils/logger.mjs';
import { handleValidationErrors } from './_groomRouteHelpers.mjs';

const router = express.Router();

/**
 * @swagger
 * /api/grooms/{id}/legacy/eligibility:
 *   get:
 *     summary: Check legacy creation eligibility for a retired groom
 *     tags: [Grooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Retired groom ID
 *     responses:
 *       200:
 *         description: Legacy eligibility status
 *       404:
 *         description: Groom not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/legacy/eligibility',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  handleValidationErrors,
  requireOwnership('groom'),
  async (req, res) => {
    try {
      const groomId = parseInt(req.params.id);
      const eligibility = await checkLegacyEligibility(groomId);

      res.json({
        success: true,
        data: eligibility,
      });
    } catch (error) {
      logger.error('Error checking legacy eligibility:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check legacy eligibility',
        error: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/grooms/legacy/history:
 *   get:
 *     summary: Get legacy history for current user
 *     tags: [Grooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Legacy history
 *       500:
 *         description: Internal server error
 */
router.get('/legacy/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await getUserLegacyHistory(userId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error getting legacy history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get legacy history',
      error: error.message,
    });
  }
});

export default router;
