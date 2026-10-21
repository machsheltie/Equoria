/**
 * Trait Management Routes
 * API endpoints for reading a horse's traits and their effects.
 *
 * No route here reveals or writes traits (Equoria-gu8jk; owner ruling
 * 2026-10-20: players must never write traits for themselves).
 * POST /discover/:horseId and POST /batch-discover, which moved hidden traits
 * into the visible lists on demand, were removed. Traits will be activated by
 * grooms (Equoria-09g33), not by a player button.
 */

import express from 'express';
import { param, query, validationResult } from 'express-validator';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  getHorseTraits,
  getTraitDefinitions,
  getDiscoveryStatus,
} from '../controllers/traitController.mjs';
import {
  analyzeHorseTraitImpact,
  compareTraitImpactAcrossDisciplines,
  getDisciplineRecommendations,
  getTraitCompetitionEffects,
} from '../controllers/traitCompetitionController.mjs';
import logger from '../../../utils/logger.mjs';
import { DISCIPLINE_VALUES } from '../../../constants/schema.mjs';
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
 *                     stressLevel:
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

/**
 * @swagger
 * /api/traits/definitions:
 *   get:
 *     summary: Get all available trait definitions
 *     tags: [Traits]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [positive, negative, all]
 *         description: Filter traits by type
 *     responses:
 *       200:
 *         description: Trait definitions retrieved successfully
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
 *                     traits:
 *                       type: object
 *                     count:
 *                       type: integer
 *                     filter:
 *                       type: string
 *       500:
 *         description: Internal server error
 */
router.get(
  '/definitions',
  [
    query('type')
      .optional()
      .isIn(['positive', 'negative', 'all'])
      .withMessage('Type must be either "all", "positive", or "negative"'),
    handleValidationErrors,
  ],
  getTraitDefinitions,
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

/**
 * @swagger
 * /api/traits/competition-impact/{horseId}:
 *   get:
 *     summary: Analyze trait impact for a specific horse and discipline
 *     tags: [Traits, Competition]
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the horse
 *       - in: query
 *         name: discipline
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Dressage, Show Jumping, Cross Country, Racing, Endurance, Reining, Driving, Trail, Eventing]
 *         description: Competition discipline
 *     responses:
 *       200:
 *         description: Trait impact analysis completed
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
 *                     discipline:
 *                       type: string
 *                     analysis:
 *                       type: object
 *                     traits:
 *                       type: object
 *                     summary:
 *                       type: object
 *       400:
 *         description: Invalid horse ID or missing discipline
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/competition-impact/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    query('discipline')
      .notEmpty()
      .withMessage('Discipline is required')
      .isIn(DISCIPLINE_VALUES)
      .withMessage('Invalid discipline'),
    handleValidationErrors,
    requireOwnership('horse', { idParam: 'horseId' }),
  ],
  analyzeHorseTraitImpact,
);

/**
 * @swagger
 * /api/traits/competition-comparison/{horseId}:
 *   get:
 *     summary: Compare trait impact across multiple disciplines for a horse
 *     tags: [Traits, Competition]
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
 *         description: Trait impact comparison completed
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
 *                     comparison:
 *                       type: array
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
  '/competition-comparison/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    handleValidationErrors,
    requireOwnership('horse', { idParam: 'horseId' }),
  ],
  compareTraitImpactAcrossDisciplines,
);

/**
 * @swagger
 * /api/traits/discipline-recommendations/{horseId}:
 *   get:
 *     summary: Get discipline recommendations based on specialized trait effects
 *     tags: [Traits, Competition]
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
 *         description: Discipline recommendations generated
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
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           discipline:
 *                             type: string
 *                           specializedTraits:
 *                             type: array
 *                           totalSpecialized:
 *                             type: integer
 *                           positiveTraits:
 *                             type: integer
 *                           negativeTraits:
 *                             type: integer
 *                           overallModifier:
 *                             type: number
 *                           percentageEffect:
 *                             type: string
 *                           recommendationScore:
 *                             type: number
 *                           recommendation:
 *                             type: string
 *                             enum: [highly_recommended, recommended, neutral, not_recommended]
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalTraits:
 *                           type: integer
 *                         specializedTraits:
 *                           type: integer
 *                         recommendedDisciplines:
 *                           type: integer
 *                         notRecommendedDisciplines:
 *                           type: integer
 *                         bestDiscipline:
 *                           type: object
 *                           nullable: true
 *       400:
 *         description: Invalid horse ID
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/discipline-recommendations/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    handleValidationErrors,
    requireOwnership('horse', { idParam: 'horseId' }),
  ],
  getDisciplineRecommendations,
);

/**
 * @swagger
 * /api/traits/competition-effects:
 *   get:
 *     summary: Get all trait competition effects and definitions
 *     tags: [Traits, Competition]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [positive, negative, all]
 *         description: Filter by trait type
 *       - in: query
 *         name: discipline
 *         required: false
 *         schema:
 *           type: string
 *           enum: [Dressage, Show Jumping, Cross Country, Racing, Endurance, Reining, Driving, Trail, Eventing]
 *         description: Highlight effects for specific discipline
 *     responses:
 *       200:
 *         description: Trait competition effects retrieved
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
 *                     totalTraits:
 *                       type: integer
 *                     positiveTraits:
 *                       type: integer
 *                     negativeTraits:
 *                       type: integer
 *                     filter:
 *                       type: object
 *                     effects:
 *                       type: array
 *       500:
 *         description: Internal server error
 */
router.get(
  '/competition-effects',
  [
    query('type')
      .optional()
      .isIn(['positive', 'negative', 'all'])
      .withMessage('Type must be positive, negative, or all'),
    query('discipline').optional().isIn(DISCIPLINE_VALUES).withMessage('Invalid discipline'),
    handleValidationErrors,
  ],
  getTraitCompetitionEffects,
);

export default router;
