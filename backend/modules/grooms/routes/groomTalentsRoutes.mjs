/**
 * Groom talent-tree sub-router (Equoria-8mdpc god-file split).
 *
 * Mounted under the parent `groomRoutes.mjs` (which is mounted at `/grooms`),
 * so the routes below resolve to:
 *   GET  /grooms/talents/definitions
 *   GET  /grooms/:id/talents
 *   POST /grooms/:id/talents/validate
 *   POST /grooms/:id/talents/select
 *
 * Extracted verbatim from groomRoutes.mjs — handler chains, validation,
 * ownership middleware, and response shapes are byte-compatible with the
 * originals (this is code-motion, not a refactor).
 *
 * Route ordering: `/talents/definitions` (literal first segment `talents`) and
 * `/:id/talents` (literal second segment `talents`) cannot collide — the first
 * segment of `/talents/definitions` is the literal `talents`, which never
 * matches the numeric `:id` param pattern used by the resource routes.
 */

import express from 'express';
import { body, param } from 'express-validator';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  getTalentTreeDefinitions,
  getGroomTalentSelections,
  selectTalent,
  validateTalentSelection,
} from '../services/groomTalentService.mjs';
import logger from '../../../utils/logger.mjs';
import { handleValidationErrors } from './_groomRouteHelpers.mjs';
// Equoria-jk9oj.2: declare auth at the router that OWNS these mutations rather
// than inferring it from the authRouter mount comment. Idempotent with the
// mount-level authenticateToken; the guard travels with the file if re-mounted.
import { authenticateToken } from '../../../middleware/auth.mjs';

const router = express.Router();
router.use(authenticateToken);

/**
 * @swagger
 * /api/grooms/talents/definitions:
 *   get:
 *     summary: Get talent tree definitions for all personality types
 *     tags: [Grooms]
 *     responses:
 *       200:
 *         description: Talent tree definitions
 */
router.get('/talents/definitions', (req, res) => {
  try {
    const definitions = getTalentTreeDefinitions();

    res.json({
      success: true,
      data: definitions,
    });
  } catch (error) {
    logger.error('Error getting talent definitions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get talent definitions',
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/grooms/{id}/talents:
 *   get:
 *     summary: Get talent selections for a groom
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
 *         description: Groom talent selections
 *       404:
 *         description: Groom not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/talents',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  handleValidationErrors,
  requireOwnership('groom'),
  async (req, res) => {
    try {
      const groomId = parseInt(req.params.id);
      const selections = await getGroomTalentSelections(groomId);

      res.json({
        success: true,
        data: selections || 'none',
      });
    } catch (error) {
      logger.error('Error getting talent selections:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get talent selections',
        error: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/grooms/{id}/talents/validate:
 *   post:
 *     summary: Validate a talent selection for a groom
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tier
 *               - talentId
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [tier1, tier2, tier3]
 *               talentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Talent selection validation result
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/talents/validate',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  body('tier').isIn(['tier1', 'tier2', 'tier3']).withMessage('Invalid tier'),
  body('talentId').isString().withMessage('Talent ID must be a string'),
  handleValidationErrors,
  requireOwnership('groom'),
  async (req, res) => {
    try {
      const groomId = parseInt(req.params.id);
      const { tier, talentId } = req.body;

      const validation = await validateTalentSelection(groomId, tier, talentId);

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('Error validating talent selection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate talent selection',
        error: error.message,
      });
    }
  },
);

/**
 * @swagger
 * /api/grooms/{id}/talents/select:
 *   post:
 *     summary: Select a talent for a groom
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tier
 *               - talentId
 *             properties:
 *               tier:
 *                 type: string
 *                 enum: [tier1, tier2, tier3]
 *               talentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Talent selected successfully
 *       400:
 *         description: Invalid selection or groom not eligible
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:id/talents/select',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  body('tier').isIn(['tier1', 'tier2', 'tier3']).withMessage('Invalid tier'),
  body('talentId').isString().withMessage('Talent ID must be a string'),
  handleValidationErrors,
  requireOwnership('groom'),
  async (req, res) => {
    try {
      const groomId = parseInt(req.params.id);
      const { tier, talentId } = req.body;

      const result = await selectTalent(groomId, tier, talentId);

      res.json({
        success: true,
        data: result,
        message: 'Talent selected successfully',
      });
    } catch (error) {
      logger.error('Error selecting talent:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  },
);

export default router;
