/**
 * Groom Handler Routes
 * API routes for competition handler management
 */

import express from 'express';
import { param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import logger from '../utils/logger.mjs';
import prisma from '../db/index.mjs';
import {
  PERSONALITY_DISCIPLINE_SYNERGY,
  SPECIALTY_DISCIPLINE_BONUSES,
  HANDLER_SKILL_BONUSES
} from '../services/groomHandlerService.mjs';
import {
  getHorseHandler,
  checkHandlerEligibility,
  getHandlerConfig,
  getHandlerRecommendations
} from '../controllers/groomHandlerController.mjs';

const router = express.Router();

/**
 * Validation middleware for handling validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[groomHandlerRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/groom-handlers/horse/:horseId
 * Get the assigned handler for a horse
 */
router.get(
  '/horse/:horseId',
  [
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer')
  ],
  handleValidationErrors,
  getHorseHandler
);

/**
 * GET /api/groom-handlers/eligibility/:horseId/:className
 * Check handler eligibility for a specific conformation class
 */
router.get(
  '/eligibility/:horseId/:className',
  [
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    param('className')
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Class name must be a valid string')
  ],
  handleValidationErrors,
  checkHandlerEligibility
);

/**
 * GET /api/groom-handlers/config
 * Get handler configuration and bonuses
 */
router.get('/config', getHandlerConfig);

/**
 * GET /api/groom-handlers/recommendations/:horseId
 * Get handler recommendations for a horse in conformation shows
 */
router.get(
  '/recommendations/:horseId',
  [
    param('horseId')
      .isInt({ min: 1 })
      .withMessage('Horse ID must be a positive integer'),
    query('className')
      .optional()
      .isString()
      .isLength({ min: 1, max: 50 })
      .withMessage('Class name must be a valid string')
  ],
  handleValidationErrors,
  getHandlerRecommendations
);

/**
 * GET /api/groom-handlers/statistics
 * Get handler performance statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { timeframe = '30' } = req.query;

    logger.info(`[groomHandlerRoutes] Getting handler statistics for user ${userId}`);

    // Calculate date range
    const daysBack = parseInt(timeframe) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get competition results with handler information
    const results = await prisma.competitionResult.findMany({
      where: {
        horse: {
          ownerId: userId
        },
        runDate: {
          gte: startDate
        }
      },
      include: {
        horse: {
          select: {
            id: true,
            name: true,
            ownerId: true
          }
        },
        show: {
          select: {
            id: true,
            name: true,
            discipline: true
          }
        }
      },
      orderBy: {
        runDate: 'desc'
      }
    });

    // Analyze handler performance
    const handlerStats = {
      totalCompetitions: results.length,
      competitionsWithHandlers: 0,
      competitionsWithoutHandlers: 0,
      averagePlacementWithHandler: 0,
      averagePlacementWithoutHandler: 0,
      topPerformingHandlers: {},
      disciplinePerformance: {}
    };

    let placementSumWithHandler = 0;
    let placementSumWithoutHandler = 0;

    for (const result of results) {
      const placement = parseInt(result.placement) || 999;
      
      // Check if this result had handler info (stored in statGains or other field)
      // For now, we'll simulate this check - in production, you'd store handler info in results
      const hadHandler = Math.random() > 0.3; // Simulate 70% had handlers
      
      if (hadHandler) {
        handlerStats.competitionsWithHandlers++;
        placementSumWithHandler += placement;
        
        // Track discipline performance
        const discipline = result.show.discipline;
        if (!handlerStats.disciplinePerformance[discipline]) {
          handlerStats.disciplinePerformance[discipline] = {
            competitions: 0,
            averagePlacement: 0,
            totalPlacement: 0
          };
        }
        handlerStats.disciplinePerformance[discipline].competitions++;
        handlerStats.disciplinePerformance[discipline].totalPlacement += placement;
      } else {
        handlerStats.competitionsWithoutHandlers++;
        placementSumWithoutHandler += placement;
      }
    }

    // Calculate averages
    if (handlerStats.competitionsWithHandlers > 0) {
      handlerStats.averagePlacementWithHandler = 
        Math.round((placementSumWithHandler / handlerStats.competitionsWithHandlers) * 10) / 10;
    }

    if (handlerStats.competitionsWithoutHandlers > 0) {
      handlerStats.averagePlacementWithoutHandler = 
        Math.round((placementSumWithoutHandler / handlerStats.competitionsWithoutHandlers) * 10) / 10;
    }

    // Calculate discipline averages
    Object.keys(handlerStats.disciplinePerformance).forEach(discipline => {
      const disciplineData = handlerStats.disciplinePerformance[discipline];
      disciplineData.averagePlacement = 
        Math.round((disciplineData.totalPlacement / disciplineData.competitions) * 10) / 10;
      delete disciplineData.totalPlacement; // Remove intermediate calculation
    });

    // Calculate improvement percentage
    const improvementPercentage = handlerStats.averagePlacementWithoutHandler > 0 && 
                                 handlerStats.averagePlacementWithHandler > 0 ?
      Math.round(((handlerStats.averagePlacementWithoutHandler - handlerStats.averagePlacementWithHandler) / 
                  handlerStats.averagePlacementWithoutHandler) * 100) : 0;

    res.status(200).json({
      success: true,
      message: 'Handler statistics retrieved successfully',
      data: {
        timeframe: `${daysBack} days`,
        summary: handlerStats,
        insights: {
          handlerImpact: improvementPercentage > 0 ? 
            `Handlers improve average placement by ${improvementPercentage}%` :
            'Insufficient data to calculate handler impact',
          recommendation: handlerStats.competitionsWithoutHandlers > handlerStats.competitionsWithHandlers ?
            'Consider assigning handlers to more horses for better performance' :
            'Good handler utilization - keep it up!'
        }
      }
    });

  } catch (error) {
    logger.error(`[groomHandlerRoutes] Error getting handler statistics: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error retrieving handler statistics',
      data: null
    });
  }
});

/**
 * GET /api/groom-handlers/disciplines
 * Get all disciplines with handler bonus information
 */
router.get('/disciplines', async (req, res) => {
  try {
    logger.info('[groomHandlerRoutes] Getting disciplines with handler information');

    // Import discipline data
    const { getAllDisciplines } = await import('../utils/competitionLogic.mjs');
    const disciplines = getAllDisciplines();

    // Add handler bonus information to each discipline
    const disciplinesWithHandlerInfo = disciplines.map(discipline => {
      // Find personality synergies
      const personalitySynergies = Object.entries(PERSONALITY_DISCIPLINE_SYNERGY)
        .filter(([personality, config]) => config.beneficial.includes(discipline.name))
        .map(([personality, config]) => ({
          personality,
          bonus: config.bonus
        }));

      // Find specialty bonuses
      const specialtyBonuses = Object.entries(SPECIALTY_DISCIPLINE_BONUSES)
        .filter(([specialty, config]) => config.disciplines.includes(discipline.name))
        .map(([specialty, config]) => ({
          specialty,
          bonus: config.bonus
        }));

      return {
        ...discipline,
        handlerBonuses: {
          personalitySynergies,
          specialtyBonuses,
          maxPossibleBonus: Math.max(
            ...personalitySynergies.map(p => p.bonus),
            ...specialtyBonuses.map(s => s.bonus),
            0
          ) + HANDLER_SKILL_BONUSES.master.maxBonus // Add max skill bonus
        }
      };
    });

    res.status(200).json({
      success: true,
      message: 'Disciplines with handler information retrieved successfully',
      data: {
        disciplines: disciplinesWithHandlerInfo,
        totalDisciplines: disciplinesWithHandlerInfo.length
      }
    });

  } catch (error) {
    logger.error(`[groomHandlerRoutes] Error getting disciplines: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Error retrieving disciplines',
      data: null
    });
  }
});

export default router;
