/**
 * Groom retirement-management sub-router (Equoria-8mdpc god-file split).
 *
 * Mounted under the parent `groomRoutes.mjs` (which is mounted at `/grooms`),
 * so the routes below resolve to:
 *   GET  /grooms/retirement/approaching
 *   GET  /grooms/retirement/statistics
 *   GET  /grooms/:id/retirement/eligibility
 *   POST /grooms/:id/retirement/process
 *
 * Extracted verbatim from groomRoutes.mjs — handler chains, validation,
 * ownership middleware, and response shapes are byte-compatible with the
 * originals (this is code-motion, not a refactor).
 *
 * Route ordering: the two-segment `/retirement/*` collection routes and the
 * three-segment `/:id/retirement/*` resource routes differ in segment count
 * and pattern, so Express cannot confuse them and mount order relative to the
 * parent's `/:id/...` routes is not load-bearing.
 */

import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  checkRetirementEligibility,
  processRetirement,
  getGroomsApproachingRetirement,
  getRetirementStatistics,
} from '../services/groomRetirementService.mjs';
import logger from '../../../utils/logger.mjs';
import { handleValidationErrors } from './_groomRouteHelpers.mjs';

const router = express.Router();

/**
 * @swagger
 * /api/grooms/{id}/retirement/eligibility:
 *   get:
 *     summary: Check retirement eligibility for a groom
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
 *         description: Retirement eligibility status
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
 * @swagger
 * /api/grooms/{id}/retirement/process:
 *   post:
 *     summary: Process retirement for a groom
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
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Retirement reason
 *               force:
 *                 type: boolean
 *                 description: Force retirement even if not eligible
 *     responses:
 *       200:
 *         description: Retirement processed successfully
 *       400:
 *         description: Groom not eligible for retirement
 *       404:
 *         description: Groom not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/retirement/process',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('force').optional().isBoolean().withMessage('Force must be a boolean'),
  handleValidationErrors,
  requireOwnership('groom'),
  async (req, res) => {
    try {
      const groomId = parseInt(req.params.id);
      const { reason, force } = req.body;

      const result = await processRetirement(groomId, reason, force);

      res.json({
        success: true,
        data: result,
        message: 'Groom retirement processed successfully',
      });
    } catch (error) {
      logger.error('Error processing retirement:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/grooms/retirement/approaching:
 *   get:
 *     summary: Get grooms approaching retirement for current user
 *     tags: [Grooms]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of grooms approaching retirement
 *       500:
 *         description: Internal server error
 */
router.get('/retirement/approaching', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const grooms = await getGroomsApproachingRetirement(userId);

    res.json({
      success: true,
      data: grooms,
    });
  } catch (error) {
    logger.error('Error getting grooms approaching retirement:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get grooms approaching retirement',
      error: error.message,
    });
  }
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
