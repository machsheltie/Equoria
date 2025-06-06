/**
 * Groom Management Routes
 * API endpoints for groom assignments, interactions, and management
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
// TODO: Add query validation when needed for filtering/pagination
// import { query } from 'express-validator';
import {
  assignGroom,
  cleanupTestData,
  ensureDefaultAssignment,
  getFoalAssignments,
  recordInteraction,
  getUserGrooms,
  hireGroom,
  getGroomDefinitions,
} from '../controllers/groomController.mjs';
import { GROOM_CONFIG } from '../config/groomConfig.mjs';
import logger from '../utils/logger.mjs';

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
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[groomRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
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
  assignGroom,
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
  [
    param('foalId').isInt({ min: 1 }).withMessage('foalId must be a positive integer'),
    handleValidationErrors,
  ],
  ensureDefaultAssignment,
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
  [
    param('foalId').isInt({ min: 1 }).withMessage('foalId must be a positive integer'),
    handleValidationErrors,
  ],
  getFoalAssignments,
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
  recordInteraction,
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
  [param('userId').notEmpty().withMessage('userId is required'), handleValidationErrors],
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
      .isIn(['foal_care', 'general', 'training', 'medical'])
      .withMessage('speciality must be one of: foal_care, general, training, medical'),
    body('experience')
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage('experience must be between 1 and 20 years'),
    body('skill_level')
      .isIn(['novice', 'intermediate', 'expert', 'master'])
      .withMessage('skill_level must be one of: novice, intermediate, expert, master'),
    body('personality')
      .isIn(['gentle', 'energetic', 'patient', 'strict'])
      .withMessage('personality must be one of: gentle, energetic, patient, strict'),
    body('hourly_rate')
      .optional()
      .isFloat({ min: 5, max: 100 })
      .withMessage('hourly_rate must be between 5 and 100'),
    body('bio').optional().isLength({ max: 500 }).withMessage('bio must be 500 characters or less'),
    body('availability').optional().isObject().withMessage('availability must be an object'),
    handleValidationErrors,
  ],
  hireGroom,
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

// Test cleanup endpoint (for testing only)
router.delete('/test/cleanup', cleanupTestData);

export default router;
