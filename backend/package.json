import express from 'express';
import { body, param, validationResult } from 'express-validator';
import prisma from '../db/index.mjs';
import { getHorseById } from '../models/horseModel.mjs';
import { getUserById } from '../models/userModel.mjs';
import { enterAndRunShow } from '../controllers/competitionController.mjs';
import { getResultsByShow, getResultsByHorse } from '../models/resultModel.mjs';
import {
  validateCompetitionEntry,
  executeEnhancedCompetition,
  getCompetitionEligibilitySummary,
} from '../logic/enhancedCompetitionSimulation.mjs';
import { getAllDisciplines, getDisciplineConfig } from '../utils/competitionLogic.mjs';
import auth from '../middleware/auth.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

// Validation middleware for entering a show
const validateEnterShow = [
  body('showId').isInt({ min: 1 }).withMessage('Show ID must be a positive integer'),
  body('horseIds').isArray({ min: 1 }).withMessage('Horse IDs must be a non-empty array'),
  body('horseIds.*').isInt({ min: 1 }).withMessage('Each horse ID must be a positive integer'),
];

/**
 * POST /enter-show
 * Enter horses into a show and run the competition
 *
 * Request body:
 * {
 *   "showId": 1,
 *   "horseIds": [1, 2, 3, 4, 5]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Competition completed successfully",
 *   "results": [...],
 *   "summary": {
 *     "totalEntries": 5,
 *     "validEntries": 5,
 *     "skippedEntries": 0,
 *     "topThree": [...]
 *   }
 * }
 */
router.post('/enter-show', validateEnterShow, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn(
        `[competitionRoutes.POST /enter-show] Validation errors: ${JSON.stringify(errors.array())}`,
      );
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { showId, horseIds } = req.body;

    logger.info(
      `[competitionRoutes.POST /enter-show] Entering ${horseIds.length} horses into show ${showId}`,
    );

    // Get show details from database
    const show = await prisma.show.findUnique({
      where: { id: showId },
    });

    if (!show) {
      return res.status(404).json({
        success: false,
        message: 'Show not found',
      });
    }

    // Call the controller function
    const result = await enterAndRunShow(horseIds, show);

    // Log the result
    if (result.success) {
      logger.info(
        `[competitionRoutes.POST /enter-show] Competition completed successfully: ${result.summary.validEntries} entries, ${result.summary.skippedEntries} skipped`,
      );
    } else {
      logger.warn(`[competitionRoutes.POST /enter-show] Competition failed: ${result.message}`);
    }

    // Return appropriate status code based on success
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);
  } catch (error) {
    logger.error(`[competitionRoutes.POST /enter-show] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /show/:showId/results
 * Get all results for a specific show
 */
router.get('/show/:showId/results', async (req, res) => {
  try {
    const showId = parseInt(req.params.showId, 10);

    if (isNaN(showId) || showId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid show ID',
      });
    }

    const results = await getResultsByShow(showId);

    logger.info(
      `[competitionRoutes.GET /show/${showId}/results] Retrieved ${results.length} results`,
    );

    res.json({
      success: true,
      showId,
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error(`[competitionRoutes.GET /show/:showId/results] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horse/:horseId/results
 * Get all competition results for a specific horse
 */
router.get('/horse/:horseId/results', async (req, res) => {
  try {
    const horseId = parseInt(req.params.horseId, 10);

    if (isNaN(horseId) || horseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID',
      });
    }

    const results = await getResultsByHorse(horseId);

    logger.info(
      `[competitionRoutes.GET /horse/${horseId}/results] Retrieved ${results.length} results`,
    );

    res.json({
      success: true,
      horseId,
      results,
      count: results.length,
    });
  } catch (error) {
    logger.error(`[competitionRoutes.GET /horse/:horseId/results] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * POST /api/competition/enter
 * Enter a horse in a competition with enhanced validation
 *
 * Request body:
 * {
 *   "horseId": 1,
 *   "showId": 1
 * }
 */
router.post(
  '/enter',
  auth,
  [
    body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    body('showId').isInt({ min: 1 }).withMessage('Show ID must be a positive integer'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[competitionRoutes.POST /enter] Validation errors: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { horseId, showId } = req.body;
      const userId = req.user.id;

      logger.info(
        `[competitionRoutes.POST /enter] User ${userId} entering horse ${horseId} in show ${showId}`,
      );

      // Get horse and validate ownership
      const horse = await getHorseById(horseId);
      if (!horse) {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      if (horse.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this horse',
        });
      }

      // Get show details
      const show = await prisma.show.findUnique({
        where: { id: showId },
      });

      if (!show) {
        return res.status(404).json({
          success: false,
          message: 'Show not found',
        });
      }

      // Get user details
      const user = await getUserById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Validate competition entry using enhanced validation
      const validation = await validateCompetitionEntry(horse, show, user);

      if (!validation.eligible) {
        return res.status(400).json({
          success: false,
          message: 'Horse is not eligible for this competition',
          errors: validation.errors,
          eligibilityDetails: {
            horseLevel: validation.horseLevel,
            disciplineScore: validation.disciplineScore,
          },
        });
      }

      // Check if horse is already entered
      const existingEntry = await prisma.competitionResult.findFirst({
        where: {
          horseId,
          showId,
        },
      });

      if (existingEntry) {
        return res.status(400).json({
          success: false,
          message: 'Horse is already entered in this competition',
        });
      }

      // Deduct entry fee
      await prisma.user.update({
        where: { id: userId },
        data: {
          money: { decrement: show.entryFee },
        },
      });

      // Create entry record (placeholder result)
      const entry = await prisma.competitionResult.create({
        data: {
          horseId,
          showId,
          score: 0, // Will be updated when competition runs
          placement: null,
          discipline: show.discipline,
          runDate: show.runDate,
          showName: show.name,
          prizeWon: 0,
        },
      });

      logger.info(
        `[competitionRoutes.POST /enter] Successfully entered horse ${horseId} in show ${showId}`,
      );

      res.status(201).json({
        success: true,
        message: 'Horse successfully entered in competition',
        data: {
          entryId: entry.id,
          horseId,
          showId,
          entryFee: show.entryFee,
          eligibilityDetails: {
            horseLevel: validation.horseLevel,
            disciplineScore: validation.disciplineScore,
          },
        },
      });
    } catch (error) {
      logger.error(`[competitionRoutes.POST /enter] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /api/competition/execute
 * Execute a competition with all entered horses
 *
 * Request body:
 * {
 *   "showId": 1
 * }
 */
router.post(
  '/execute',
  auth,
  [body('showId').isInt({ min: 1 }).withMessage('Show ID must be a positive integer')],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[competitionRoutes.POST /execute] Validation errors: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { showId } = req.body;
      const userId = req.user.id;

      logger.info(
        `[competitionRoutes.POST /execute] User ${userId} executing competition for show ${showId}`,
      );

      // Get show details
      const show = await prisma.show.findUnique({
        where: { id: showId },
      });

      if (!show) {
        return res.status(404).json({
          success: false,
          message: 'Show not found',
        });
      }

      // Check if user is authorized to execute (show host or admin)
      if (show.hostUserId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the show host can execute this competition',
        });
      }

      // Get all entries for this show
      const entries = await prisma.competitionResult.findMany({
        where: {
          showId,
          placement: null, // Only get entries that haven't been processed yet
        },
        include: {
          horse: {
            include: {
              user: true,
            },
          },
        },
      });

      if (entries.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No entries found for this competition',
        });
      }

      // Prepare entries for enhanced competition execution
      const competitionEntries = entries.map(entry => ({
        horse: entry.horse,
        user: entry.horse.user,
      }));

      logger.info(
        `[competitionRoutes.POST /execute] Executing competition with ${competitionEntries.length} entries`,
      );

      // Execute enhanced competition
      const competitionResult = await executeEnhancedCompetition(show, competitionEntries);

      if (!competitionResult.success) {
        return res.status(500).json({
          success: false,
          message: 'Competition execution failed',
          error: competitionResult.error,
        });
      }

      logger.info(
        `[competitionRoutes.POST /execute] Competition executed successfully for show ${showId}`,
      );

      // Return results without scores (hidden from users)
      res.status(200).json({
        success: true,
        message: 'Competition executed successfully',
        data: {
          showId,
          showName: show.name,
          discipline: show.discipline,
          totalEntries: competitionResult.totalEntries,
          results: competitionResult.results, // Already filtered to hide scores
          statGains: competitionResult.statGains,
          totalPrizeDistributed: competitionResult.totalPrizeDistributed,
          totalXPAwarded: competitionResult.totalXPAwarded,
        },
      });
    } catch (error) {
      logger.error(`[competitionRoutes.POST /execute] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /api/competition/eligibility/:horseId/:discipline
 * Check horse eligibility for a specific discipline
 */
router.get(
  '/eligibility/:horseId/:discipline',
  auth,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    param('discipline')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Discipline must be a non-empty string'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(
          `[competitionRoutes.GET /eligibility] Validation errors: ${JSON.stringify(errors.array())}`,
        );
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { horseId, discipline } = req.params;
      const userId = req.user.id;

      logger.info(
        `[competitionRoutes.GET /eligibility] Checking eligibility for horse ${horseId} in ${discipline}`,
      );

      // Get horse and validate ownership
      const horse = await getHorseById(parseInt(horseId));
      if (!horse) {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      if (horse.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this horse',
        });
      }

      // Validate discipline
      const availableDisciplines = getAllDisciplines();
      if (!availableDisciplines.includes(discipline)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid discipline',
          availableDisciplines,
        });
      }

      // Get eligibility summary
      const eligibility = getCompetitionEligibilitySummary(horse, discipline);

      logger.info(
        `[competitionRoutes.GET /eligibility] Horse ${horseId} eligibility checked for ${discipline}`,
      );

      res.status(200).json({
        success: true,
        data: {
          horseId: parseInt(horseId),
          horseName: horse.name,
          discipline,
          eligibility,
        },
      });
    } catch (error) {
      logger.error(`[competitionRoutes.GET /eligibility] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /api/competition/disciplines
 * Get all available competition disciplines
 */
router.get('/disciplines', async (req, res) => {
  try {
    const disciplines = getAllDisciplines();
    const disciplineDetails = disciplines.map(discipline => ({
      name: discipline,
      config: getDisciplineConfig(discipline),
    }));

    res.status(200).json({
      success: true,
      data: {
        disciplines,
        disciplineDetails,
        total: disciplines.length,
      },
    });
  } catch (error) {
    logger.error(`[competitionRoutes.GET /disciplines] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

export default router;
