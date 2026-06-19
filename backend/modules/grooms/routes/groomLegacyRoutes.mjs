/**
 * Groom legacy-system sub-router (Equoria-8mdpc god-file split).
 *
 * Mounted under the parent `groomRoutes.mjs` (which is mounted at `/grooms`),
 * so the routes below resolve to:
 *   GET  /grooms/legacy/history
 *   GET  /grooms/:id/legacy/eligibility
 *   POST /grooms/:id/legacy/create
 *
 * Extracted verbatim from groomRoutes.mjs — handler chains, validation,
 * ownership middleware, and response shapes are byte-compatible with the
 * originals (this is code-motion, not a refactor).
 *
 * Route ordering: the two-segment `/legacy/history` collection route and the
 * three-segment `/:id/legacy/*` resource routes differ in segment count and
 * pattern, so Express cannot confuse them.
 */

import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  checkLegacyEligibility,
  generateLegacyProtege,
  getUserLegacyHistory,
} from '../services/groomLegacyService.mjs';
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
 * /api/grooms/{id}/legacy/create:
 *   post:
 *     summary: Create a legacy protégé from a retired mentor groom
 *     tags: [Grooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Mentor groom ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - personality
 *               - skillLevel
 *               - speciality
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               personality:
 *                 type: string
 *                 enum: [calm, energetic, methodical]
 *               skillLevel:
 *                 type: string
 *                 enum: [novice, intermediate, expert]
 *               speciality:
 *                 type: string
 *                 enum: [foal_care, general_grooming, specialized_disciplines]
 *               sessionRate:
 *                 type: number
 *                 minimum: 5
 *                 maximum: 100
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *               availability:
 *                 type: object
 *     responses:
 *       201:
 *         description: Legacy protégé created successfully
 *       400:
 *         description: Invalid request data or mentor not eligible
 *       404:
 *         description: Mentor groom not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/legacy/create',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('personality').isIn(['calm', 'energetic', 'methodical']).withMessage('Invalid personality'),
  body('skillLevel').isIn(['novice', 'intermediate', 'expert']).withMessage('Invalid skill level'),
  body('speciality')
    .isIn(['foal_care', 'general_grooming', 'specialized_disciplines'])
    .withMessage('Invalid speciality'),
  body('sessionRate')
    .optional()
    .isFloat({ min: 5, max: 100 })
    .withMessage('Session rate must be between 5 and 100'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be 500 characters or less'),
  body('availability').optional().isObject().withMessage('Availability must be an object'),
  handleValidationErrors,
  requireOwnership('groom'),
  async (req, res) => {
    try {
      const mentorGroomId = parseInt(req.params.id);
      const userId = req.user.id;
      const protegeData = req.body;

      const result = await generateLegacyProtege(mentorGroomId, protegeData, userId);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Legacy protégé created successfully',
      });
    } catch (error) {
      // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
      if (error?.status === 503) {
        return res.status(503).json({ success: false, message: error.message });
      }
      logger.error('Error creating legacy protégé:', error);
      res.status(400).json({
        success: false,
        message: error.message,
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
