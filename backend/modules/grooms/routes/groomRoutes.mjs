/**
 * Groom Management Routes
 * API endpoints for groom assignments, interactions, and management.
 *
 * Equoria-8mdpc god-file split: this parent keeps the foundational endpoints
 * (hire / assign / interact / assignments / user / profile / synergy /
 * assignment-logs / bonus-traits / definitions / ensure-default) and mounts
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
  ensureDefaultAssignment,
  getFoalAssignments,
  recordInteraction,
  getUserGrooms,
  hireGroom,
  getGroomDefinitions,
  getGroomProfile,
  getGroomAssignmentLogs,
  getGroomBonusTraits,
  updateGroomBonusTraits,
  getGroomHorseSynergyPreview,
} from '../controllers/groomController.mjs';
import { GROOM_CONFIG } from '../../../config/groomConfig.mjs';
import {
  GROOM_SPECIALTY_VALUES,
  GROOM_SKILL_LEVEL_VALUES,
  GROOM_PERSONALITY_VALUES,
} from '../../../constants/schema.mjs';
import logger from '../../../utils/logger.mjs';
import { handleValidationErrors } from './_groomRouteHelpers.mjs';
import groomRetirementRoutes from './groomRetirementRoutes.mjs';
import groomLegacyRoutes from './groomLegacyRoutes.mjs';
import groomTalentsRoutes from './groomTalentsRoutes.mjs';

const router = express.Router();

/**
 * Get all valid interaction types from configuration
 * @returns {Array} Array of all valid interaction type strings
 */
function getAllValidInteractionTypes() {
  return [
    // Legacy interaction types (for backward compatibility)
    'daily_care',
    'feeding',
    'grooming',
    'exercise',
    'medical_check',
    // New foal enrichment tasks (0-2 years)
    ...GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS,
    // New foal grooming tasks (1-3 years)
    ...GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS,
    // New general grooming tasks (3+ years)
    ...GROOM_CONFIG.ELIGIBLE_GENERAL_GROOMING_TASKS,
  ];
}

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
 *               priority:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 default: 1
 *                 description: Assignment priority (1 = primary)
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional assignment notes
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
    body('priority')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('priority must be an integer between 1 and 5'),
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('notes must be 500 characters or less'),
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

/**
 * @swagger
 * /api/grooms/ensure-default/{foalId}:
 *   post:
 *     summary: Ensure a foal has a default groom assignment
 *     tags: [Grooms]
 *     parameters:
 *       - in: path
 *         name: foalId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the foal
 *     responses:
 *       200:
 *         description: Default assignment ensured
 *       400:
 *         description: Invalid foal ID
 *       500:
 *         description: Internal server error
 */
router.post(
  '/ensure-default/:foalId',
  authenticateToken, // IDOR Protection: Require authentication
  [
    param('foalId').isInt({ min: 1 }).withMessage('foalId must be a positive integer'),
    handleValidationErrors,
  ],
  requireOwnership('foal', { idParam: 'foalId' }), // IDOR Protection: Validate foal ownership
  ensureDefaultAssignment,
);

/**
 * @swagger
 * /api/grooms/assignments/{foalId}:
 *   get:
 *     summary: Get all assignments for a foal
 *     tags: [Grooms]
 *     parameters:
 *       - in: path
 *         name: foalId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the foal
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
 *       400:
 *         description: Invalid foal ID
 *       500:
 *         description: Internal server error
 */
router.get(
  '/assignments/:foalId',
  authenticateToken, // IDOR Protection: Require authentication
  [
    param('foalId').isInt({ min: 1 }).withMessage('foalId must be a positive integer'),
    handleValidationErrors,
  ],
  requireOwnership('foal', { idParam: 'foalId' }), // IDOR Protection: Validate foal ownership
  getFoalAssignments,
);

/**
 * @swagger
 * /api/grooms/interact:
 *   post:
 *     summary: Record a groom interaction with a foal
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
 *               - interactionType
 *               - duration
 *             properties:
 *               foalId:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID of the foal
 *               groomId:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID of the groom
 *               interactionType:
 *                 type: string
 *                 description: Type of interaction (includes legacy types, foal enrichment tasks, foal grooming tasks, and general grooming tasks)
 *               duration:
 *                 type: integer
 *                 minimum: 5
 *                 maximum: 480
 *                 description: Duration in minutes
 *               assignmentId:
 *                 type: integer
 *                 minimum: 1
 *                 description: Optional assignment ID
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional interaction notes
 *     responses:
 *       200:
 *         description: Interaction recorded successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Foal or groom not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/interact',
  authenticateToken,
  [
    body('foalId').isInt({ min: 1 }).withMessage('foalId must be a positive integer'),
    body('groomId').isInt({ min: 1 }).withMessage('groomId must be a positive integer'),
    body('interactionType')
      .isIn(getAllValidInteractionTypes())
      .withMessage(`interactionType must be one of: ${getAllValidInteractionTypes().join(', ')}`),
    body('duration')
      .isInt({ min: 5, max: 480 })
      .withMessage('duration must be between 5 and 480 minutes'),
    body('assignmentId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('assignmentId must be a positive integer'),
    body('notes')
      .optional()
      .isLength({ max: 500 })
      .withMessage('notes must be 500 characters or less'),
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
  recordInteraction,
);

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

/**
 * @swagger
 * /api/grooms/hire:
 *   post:
 *     summary: Hire a new groom for a user
 *     summary: Hire a new groom for a user
 *     tags: [Grooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - speciality
 *               - skill_level
 *               - personality
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Groom's name
 *               speciality:
 *                 type: string
 *                 enum: [foal_care, general, training, medical]
 *                 description: Groom's speciality
 *               experience:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 description: Years of experience
 *               skill_level:
 *                 type: string
 *                 enum: [novice, intermediate, expert, master]
 *                 description: Skill level
 *               personality:
 *                 type: string
 *                 enum: [gentle, energetic, patient, strict]
 *                 description: Personality trait
 *               hourly_rate:
 *                 type: number
 *                 minimum: 5
 *                 maximum: 100
 *                 description: Hourly rate in currency
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional biography
 *               availability:
 *                 type: object
 *                 description: Available days/hours
 *     responses:
 *       201:
 *         description: Groom hired successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Internal server error
 */
router.post(
  '/hire',
  [
    body('name')
      .isLength({ min: 2, max: 100 })
      .withMessage('name must be between 2 and 100 characters'),
    body('speciality')
      .isIn(GROOM_SPECIALTY_VALUES)
      .withMessage(`speciality must be one of: ${GROOM_SPECIALTY_VALUES.join(', ')}`),
    body('experience')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('experience must be between 1 and 20 years'),
    body('skill_level')
      .isIn(GROOM_SKILL_LEVEL_VALUES)
      .withMessage(`skill_level must be one of: ${GROOM_SKILL_LEVEL_VALUES.join(', ')}`),
    body('personality')
      .isIn(GROOM_PERSONALITY_VALUES)
      .withMessage(`personality must be one of: ${GROOM_PERSONALITY_VALUES.join(', ')}`),
    body('session_rate')
      .optional()
      .isFloat({ min: 5, max: 100 })
      .withMessage('session_rate must be between 5 and 100'),
    body('bio').optional().isLength({ max: 500 }).withMessage('bio must be 500 characters or less'),
    body('availability').optional().isObject().withMessage('availability must be an object'),
    handleValidationErrors,
  ],
  hireGroom,
);

/**
 * @swagger
 * /api/grooms/definitions:
 *   get:
 *     summary: Get groom system definitions
 *     tags: [Grooms]
 *     responses:
 *       200:
 *         description: Definitions retrieved successfully
 *       500:
 *         description: Internal server error
 */
router.get('/definitions', getGroomDefinitions);

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

/**
 * @swagger
 * /api/grooms/{id}/bonus-traits:
 *   get:
 *     summary: Get groom bonus traits
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
 *         description: Bonus traits retrieved successfully
 *       404:
 *         description: Groom not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:id/bonus-traits',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  requireOwnership('groom'),
  getGroomBonusTraits,
);

/**
 * @swagger
 * /api/grooms/{id}/bonus-traits:
 *   put:
 *     summary: Update groom bonus traits
 *     tags: [Grooms]
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
 *             properties:
 *               bonusTraits:
 *                 type: object
 *                 description: Object mapping trait names to bonus percentages
 *     responses:
 *       200:
 *         description: Bonus traits updated successfully
 *       400:
 *         description: Invalid bonus traits
 *       404:
 *         description: Groom not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:id/bonus-traits',
  param('id').isInt().withMessage('Groom ID must be an integer'),
  body('bonusTraits').isObject().withMessage('Bonus traits must be an object'),
  requireOwnership('groom'),
  updateGroomBonusTraits,
);

// ===== SUB-DOMAIN SUB-ROUTERS (Equoria-8mdpc god-file split) =====
// Mounted after the parent's foundational routes so the parent's relative
// registration order is preserved. Each sub-router carries a distinct
// sub-domain prefix (/retirement, /legacy, /talents and their /:id/<prefix>
// resource variants) that does not overlap with any foundational route above.
router.use(groomRetirementRoutes);
router.use(groomLegacyRoutes);
router.use(groomTalentsRoutes);

export default router;
