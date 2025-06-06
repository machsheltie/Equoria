/**
 * Trait Management Routes
 * API endpoints for trait discovery, revelation, and management
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  discoverTraits,
  getHorseTraits,
  getTraitDefinitions,
  getDiscoveryStatus,
  batchDiscoverTraits,
} from '../controllers/traitController.mjs';
import {
  analyzeHorseTraitImpact,
  compareTraitImpactAcrossDisciplines,
  getTraitCompetitionEffects,
} from '../controllers/traitCompetitionController.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[traitRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
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
 * /api/traits/discover/{horseId}:
 *   post:
 *     summary: Trigger trait discovery for a specific horse
 *     tags: [Traits]
 *     parameters:
 *       - in: path
 *         name: horseId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the horse
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkEnrichment:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to check enrichment activities for discovery
 *               forceCheck:
 *                 type: boolean
 *                 default: false
 *                 description: Force check even if recently checked
 *     responses:
 *       200:
 *         description: Trait discovery completed successfully
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
 *                     revealed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           trait:
 *                             type: string
 *                           definition:
 *                             type: object
 *                           discoveryReason:
 *                             type: string
 *                     conditions:
 *                       type: array
 *                     updatedTraits:
 *                       type: object
 *       400:
 *         description: Invalid horse ID
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/discover/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('checkEnrichment').optional().isBoolean().withMessage('checkEnrichment must be a boolean'),
    body('forceCheck').optional().isBoolean().withMessage('forceCheck must be a boolean'),
    handleValidationErrors,
  ],
  discoverTraits,
);

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
 *                         hidden:
 *                           type: array
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
      .withMessage('Type must be positive, negative, or all'),
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
  ],
  getDiscoveryStatus,
);

/**
 * @swagger
 * /api/traits/batch-discover:
 *   post:
 *     summary: Trigger trait discovery for multiple horses
 *     tags: [Traits]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - horseIds
 *             properties:
 *               horseIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                 minItems: 1
 *                 maxItems: 10
 *                 description: Array of horse IDs (max 10)
 *               checkEnrichment:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to check enrichment activities
 *     responses:
 *       200:
 *         description: Batch discovery completed
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
 *                     results:
 *                       type: array
 *                     errors:
 *                       type: array
 *                     summary:
 *                       type: object
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Internal server error
 */
router.post(
  '/batch-discover',
  [
    body('horseIds')
      .isArray({ min: 1, max: 10 })
      .withMessage('horseIds must be an array with 1-10 elements')
      .custom(value => {
        if (!value.every(id => Number.isInteger(id) && id > 0)) {
          throw new Error('All horse IDs must be positive integers');
        }
        return true;
      }),
    body('checkEnrichment').optional().isBoolean().withMessage('checkEnrichment must be a boolean'),
    handleValidationErrors,
  ],
  batchDiscoverTraits,
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
      .isIn([
        'Dressage',
        'Show Jumping',
        'Cross Country',
        'Racing',
        'Endurance',
        'Reining',
        'Driving',
        'Trail',
        'Eventing',
      ])
      .withMessage('Invalid discipline'),
    handleValidationErrors,
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
  ],
  compareTraitImpactAcrossDisciplines,
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
    query('discipline')
      .optional()
      .isIn([
        'Dressage',
        'Show Jumping',
        'Cross Country',
        'Racing',
        'Endurance',
        'Reining',
        'Driving',
        'Trail',
        'Eventing',
      ])
      .withMessage('Invalid discipline'),
    handleValidationErrors,
  ],
  getTraitCompetitionEffects,
);

export default router;
