import express from 'express';
import { body, param, validationResult } from 'express-validator';
import {
  canTrain,
  getTrainingStatus,
  trainRouteHandler,
  getTrainableHorses,
} from '../controllers/trainingController.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware to handle express-validator errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[trainingRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * POST /api/training/check-eligibility
 * Check if a horse is eligible to train in a specific discipline
 */
router.post(
  '/check-eligibility',
  [
    body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('discipline')
      .notEmpty()
      .withMessage('Discipline is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Discipline must be between 1 and 50 characters'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { horseId, discipline } = req.body;

      logger.info(
        `[trainingRoutes.checkEligibility] Checking eligibility for horse ${horseId} in ${discipline}`,
      );

      const result = await canTrain(horseId, discipline);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(`[trainingRoutes.checkEligibility] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to check training eligibility',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * POST /api/training/train
 * Train a horse in a specific discipline
 */
router.post(
  '/train',
  [
    body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('discipline')
      .notEmpty()
      .withMessage('Discipline is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Discipline must be between 1 and 50 characters'),
    handleValidationErrors,
  ],
  trainRouteHandler,
);

/**
 * GET /api/training/status/:horseId/:discipline
 * Get training status for a horse in a specific discipline
 */
router.get(
  '/status/:horseId/:discipline',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    param('discipline')
      .notEmpty()
      .withMessage('Discipline is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Discipline must be between 1 and 50 characters'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { horseId, discipline } = req.params;

      logger.info(
        `[trainingRoutes.getStatus] Getting training status for horse ${horseId} in ${discipline}`,
      );

      const status = await getTrainingStatus(parseInt(horseId), discipline);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error(`[trainingRoutes.getStatus] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get training status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * GET /api/training/status/:horseId
 * Get training status for a horse across all disciplines
 */
router.get(
  '/status/:horseId',
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const { horseId } = req.params;
      logger.info(
        `[trainingRoutes.getStatusAll] Getting all training statuses for horse ${horseId}`,
      );

      const disciplines = ['Racing', 'Show Jumping', 'Dressage', 'Cross Country', 'Western'];
      const statusPromises = disciplines.map(async discipline => {
        return getTrainingStatus(parseInt(horseId), discipline);
      });
      const statuses = await Promise.all(statusPromises);

      res.json({
        success: true,
        data: statuses.reduce((acc, current, index) => {
          acc[disciplines[index]] = current;
          return acc;
        }, {}),
      });
    } catch (error) {
      logger.error(`[trainingRoutes.getStatusAll] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get all training statuses for horse',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * GET /api/training/trainable/:userId
 * Get all horses owned by a user that are eligible for training
 */
router.get(
  '/trainable/:userId',
  [param('userId').isUUID().withMessage('User ID must be a valid UUID'), handleValidationErrors],
  async (req, res) => {
    try {
      const { userId } = req.params;

      logger.info(
        `[trainingRoutes.getTrainableHorses] Getting trainable horses for user ${userId}`,
      );

      const horses = await getTrainableHorses(userId);

      res.json({
        success: true,
        data: horses,
      });
    } catch (error) {
      logger.error(`[trainingRoutes.getTrainableHorses] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get trainable horses',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

export default router;
