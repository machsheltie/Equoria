import express from 'express';
import { param, body, validationResult } from 'express-validator';
import { getTrainableHorses } from '../controllers/trainingController.mjs';
import { getHorseOverview, getHorsePersonalityImpact } from '../controllers/horseController.mjs';
import { authenticateToken } from '../middleware/auth.mjs';
import * as horseXpController from '../controllers/horseXpController.mjs';

const router = express.Router();

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
router.post('/foals', validateFoalCreation, async (req, res) => {
  try {
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
