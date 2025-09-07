import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import { getTrainableHorses } from '../controllers/trainingController.mjs';
import { getHorseOverview, getHorsePersonalityImpact } from '../controllers/horseController.mjs';
import { authenticateToken } from '../middleware/auth.mjs';
import * as horseXpController from '../controllers/horseXpController.mjs';
import { createHorse, getHorseById } from '../models/horseModel.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

const router = express.Router();

/**
 * Validation middleware for horse creation
 */
const validateHorseCreation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('breedId').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
  body('age').optional().isInt({ min: 0, max: 50 }).withMessage('Age must be between 0 and 50'),
  body('sex')
    .optional()
    .isIn(['stallion', 'mare', 'gelding'])
    .withMessage('Sex must be stallion, mare, or gelding'),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * Validation middleware for horse ID parameter
 */
const validateHorseId = [
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * Validation middleware for user ID parameter
 */
const validateUserId = [
  param('userId')
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * GET /horses
 * Get all horses with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { userId, breedId, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (userId) where.userId = userId;
    if (breedId) where.breedId = parseInt(breedId);

    const horses = await prisma.horse.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        breed: true,
        user: {
          select: { id: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      message: `Found ${horses.length} horses`,
      data: horses,
    });
  } catch (error) {
    logger.error(`[horseRoutes] Error getting horses: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horses/trait-trends
 * Get trait development trends across user's horses
 */
router.get('/trait-trends',
  authenticateToken,
  query('userId').custom((value, { req }) => {
    if (value !== req.user.id) {
      throw new Error('Access denied: Can only access your own trait trends');
    }
    return true;
  }),
  query('timeframe').optional().isInt({ min: 1, max: 365 }).withMessage('Timeframe must be 1-365 days'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.query.userId;
      const timeframe = parseInt(req.query.timeframe) || 30;

      // Get trait history for user's horses within timeframe
      const cutoffDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const traitHistory = await prisma.traitHistoryLog.findMany({
        where: {
          horse: { ownerId: userId },
          timestamp: { gte: cutoffDate },
        },
        include: {
          horse: {
            select: { id: true, name: true, dateOfBirth: true },
          },
        },
        orderBy: { timestamp: 'asc' },
      });

      // Analyze trends (using simple mock functions for now)
      const trends = [];
      const patterns = {};
      const predictions = {};

      logger.info(`Trait trends analyzed for user ${userId} (${timeframe} days)`);

      res.json({
        success: true,
        data: {
          trends,
          patterns,
          predictions,
          timeframe,
          analysisDate: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error analyzing trait trends:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze trait trends',
      });
    }
  }
);

/**
 * GET /horses/:id
 * Get a specific horse by ID
 */
router.get('/:id', validateHorseId, async (req, res) => {
  try {
    const horseId = parseInt(req.params.id);
    const horse = await getHorseById(horseId);

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    res.json({
      success: true,
      data: horse,
    });
  } catch (error) {
    logger.error(`[horseRoutes] Error getting horse: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * POST /horses
 * Create a new horse
 */
router.post('/', authenticateToken, validateHorseCreation, async (req, res) => {
  try {
    const horseData = {
      ...req.body,
      userId: req.user.id, // Set the owner from the authenticated user
      dateOfBirth: new Date().toISOString(),
      healthStatus: req.body.healthStatus || 'Good',
    };

    const newHorse = await createHorse(horseData);

    logger.info(`[horseRoutes] Created new horse: ${newHorse.name} (ID: ${newHorse.id})`);

    res.status(201).json({
      success: true,
      message: 'Horse created successfully',
      data: newHorse,
    });
  } catch (error) {
    logger.error(`[horseRoutes] Error creating horse: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * PUT /horses/:id
 * Update a horse
 */
router.put('/:id', validateHorseId, async (req, res) => {
  try {
    const horseId = parseInt(req.params.id);

    const updatedHorse = await prisma.horse.update({
      where: { id: horseId },
      data: req.body,
      include: {
        breed: true,
        user: {
          select: { id: true, username: true }
        }
      }
    });

    logger.info(`[horseRoutes] Updated horse: ${updatedHorse.name} (ID: ${horseId})`);

    res.json({
      success: true,
      message: 'Horse updated successfully',
      data: updatedHorse,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    logger.error(`[horseRoutes] Error updating horse: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * DELETE /horses/:id
 * Delete a horse
 */
router.delete('/:id', validateHorseId, async (req, res) => {
  try {
    const horseId = parseInt(req.params.id);

    await prisma.horse.delete({
      where: { id: horseId }
    });

    logger.info(`[horseRoutes] Deleted horse ID: ${horseId}`);

    res.json({
      success: true,
      message: 'Horse deleted successfully',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    logger.error(`[horseRoutes] Error deleting horse: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horses/trainable/:userId
 * Get all horses owned by a user that are eligible for training
 */
router.get('/trainable/:userId', validateUserId, async (req, res) => {
  try {
    const { userId } = req.params;

    const trainableHorses = await getTrainableHorses(userId);

    res.json({
      success: true,
      message: `Found ${trainableHorses.length} trainable horses`,
      data: trainableHorses,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horses/:id/history
 * Get competition history for a specific horse
 */
router.get('/:id/history', validateHorseId, async (req, res) => {
  try {
    // Dynamic import for ES module
    const { getHorseHistory } = await import('../controllers/horseController.js');
    await getHorseHistory(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * Validation middleware for foal creation
 */
const validateFoalCreation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('breedId').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
  body('sireId').isInt({ min: 1 }).withMessage('Sire ID must be a positive integer'),
  body('damId').isInt({ min: 1 }).withMessage('Dam ID must be a positive integer'),
  body('sex')
    .optional()
    .custom(async (value) => {
      const { isValidHorseSex } = await import('../constants/schema.mjs');
      if (value && !isValidHorseSex(value)) {
        const { HORSE_SEX_VALUES } = await import('../constants/schema.mjs');
        throw new Error(`Sex must be one of: ${HORSE_SEX_VALUES.join(', ')}`);
      }
      return true;
    }),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),
  body('stableId').optional().isInt({ min: 1 }).withMessage('Stable ID must be a positive integer'),
  body('healthStatus')
    .optional()
    .isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Critical'])
    .withMessage('Health status must be one of: Excellent, Good, Fair, Poor, Critical'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * POST /horses/foals
 * Create a new foal with epigenetic traits applied at birth
 */
router.post('/foals', authenticateToken, validateFoalCreation, async (req, res) => {
  try {
    // Set the owner from the authenticated user
    req.body.ownerId = req.user.id;

    // Dynamic import for ES module
    const { createFoal } = await import('../controllers/horseController.js');
    await createFoal(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error during foal creation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horses/:id/overview
 * Get comprehensive overview data for a specific horse
 */
router.get('/:id/overview', validateHorseId, async (req, res) => {
  try {
    await getHorseOverview(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

// Horse XP System Routes (require authentication)

/**
 * GET /horses/:id/xp
 * Get horse XP status and progression information
 */
router.get('/:id/xp', authenticateToken, validateHorseId, async (req, res) => {
  try {
    // Map :id to :horseId for the controller
    req.params.horseId = req.params.id;
    await horseXpController.getHorseXpStatus(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * POST /horses/:id/allocate-stat
 * Allocate a stat point to a specific horse stat
 */
router.post('/:id/allocate-stat', authenticateToken, validateHorseId, async (req, res) => {
  try {
    // Map :id to :horseId for the controller
    req.params.horseId = req.params.id;
    await horseXpController.allocateStatPoint(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horses/:id/xp-history
 * Get horse XP event history with pagination
 */
router.get('/:id/xp-history', authenticateToken, validateHorseId, async (req, res) => {
  try {
    // Map :id to :horseId for the controller
    req.params.horseId = req.params.id;
    await horseXpController.getHorseXpHistory(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * POST /horses/:id/award-xp
 * Award XP to a horse (for system/admin use)
 */
router.post('/:id/award-xp', authenticateToken, validateHorseId, async (req, res) => {
  try {
    // Map :id to :horseId for the controller
    req.params.horseId = req.params.id;
    await horseXpController.awardXpToHorse(req, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /api/horses/:id/personality-impact
 * Get most compatible grooms for a horse based on temperament
 */
router.get('/:id/personality-impact', authenticateToken, validateHorseId, getHorsePersonalityImpact);

/**
 * @swagger
 * /api/horses/{id}/legacy-score:
 *   get:
 *     summary: Get horse legacy score with trait integration
 *     tags: [Horses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Legacy score retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/legacy-score', authenticateToken, validateHorseId, async (req, res) => {
  try {
    const horseId = parseInt(req.params.id, 10);

    const { calculateLegacyScore } = await import('../services/legacyScoreCalculator.mjs');
    const legacyScore = await calculateLegacyScore(horseId);

    res.json({
      success: true,
      message: 'Legacy score retrieved successfully',
      data: {
        legacyScore,
      },
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to calculate legacy score',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/horses/{id}/trait-card:
 *   get:
 *     summary: Get horse trait timeline card
 *     tags: [Horses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Trait timeline card retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/trait-card', authenticateToken, validateHorseId, async (req, res) => {
  try {
    const horseId = parseInt(req.params.id, 10);

    const { generateTraitTimeline } = await import('../services/traitTimelineService.mjs');
    const timeline = await generateTraitTimeline(horseId);

    res.json({
      success: true,
      message: 'Trait timeline card retrieved successfully',
      data: {
        timeline,
      },
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate trait timeline',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

/**
 * @swagger
 * /api/horses/{id}/breeding-data:
 *   get:
 *     summary: Get horse breeding data with trait predictions
 *     tags: [Horses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Breeding data retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id/breeding-data', authenticateToken, validateHorseId, async (req, res) => {
  try {
    const horseId = parseInt(req.params.id, 10);

    const { generateBreedingData } = await import('../services/breedingPredictionService.mjs');
    const breedingData = await generateBreedingData(horseId);

    res.json({
      success: true,
      message: 'Breeding data retrieved successfully',
      data: {
        breedingData,
      },
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate breeding data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

export default router;
