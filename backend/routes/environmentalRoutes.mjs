/**
 * Environmental Routes
 * 
 * API endpoints for environmental factor engine including current conditions,
 * forecasts, and environmental impact calculations for horse management.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Import environmental services
import {
  calculateCurrentWeather,
  getSeasonalFactors,
  calculateEnvironmentalTriggers,
  calculateEnvironmentalImpact,
  generateWeatherForecast,
  getEnvironmentalHistory,
  calculateComfortZone,
  assessEnvironmentalStress
} from '../services/environmentalFactorEngineService.mjs';

const router = express.Router();

/**
 * Middleware to validate request and handle errors
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * GET /api/environment/current
 * Get current environmental conditions
 */
router.get('/current',
  authenticateToken,
  [
    query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    query('region').optional().isIn(['tropical', 'temperate', 'arctic', 'desert', 'coastal']).withMessage('Invalid region'),
    query('elevation').optional().isInt({ min: 0 }).withMessage('Elevation must be a positive integer')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { latitude = 40.7128, longitude = -74.0060, region = 'temperate', elevation = 10 } = req.query;
      
      const location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        region,
        elevation: parseInt(elevation)
      };

      logger.info(`[environmentalRoutes.current] Getting current conditions for ${location.latitude}, ${location.longitude}`);

      const currentWeather = calculateCurrentWeather(new Date(), location);
      const seasonalFactors = getSeasonalFactors(new Date());

      res.json({
        success: true,
        data: {
          weather: currentWeather,
          seasonal: seasonalFactors,
          location,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error(`[environmentalRoutes.current] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get current environmental conditions'
      });
    }
  }
);

/**
 * GET /api/environment/forecast
 * Get weather forecast for planning
 */
router.get('/forecast',
  authenticateToken,
  [
    query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    query('region').optional().isIn(['tropical', 'temperate', 'arctic', 'desert', 'coastal']).withMessage('Invalid region'),
    query('elevation').optional().isInt({ min: 0 }).withMessage('Elevation must be a positive integer'),
    query('days').optional().isInt({ min: 1, max: 14 }).withMessage('Days must be between 1 and 14')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { latitude = 40.7128, longitude = -74.0060, region = 'temperate', elevation = 10, days = 7 } = req.query;
      
      const location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        region,
        elevation: parseInt(elevation)
      };

      logger.info(`[environmentalRoutes.forecast] Generating ${days}-day forecast for ${location.latitude}, ${location.longitude}`);

      const forecast = generateWeatherForecast(new Date(), location, parseInt(days));

      res.json({
        success: true,
        data: {
          forecast,
          location,
          days: parseInt(days),
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error(`[environmentalRoutes.forecast] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate weather forecast'
      });
    }
  }
);

/**
 * POST /api/environment/calculate-impact
 * Calculate environmental impact on horses
 */
router.post('/calculate-impact',
  authenticateToken,
  [
    body('horseIds').isArray({ min: 1 }).withMessage('horseIds array is required'),
    body('horseIds.*').isInt({ min: 1 }).withMessage('All horse IDs must be valid integers'),
    body('location').optional().isObject().withMessage('Location must be an object'),
    body('location.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    body('location.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    body('location.region').optional().isIn(['tropical', 'temperate', 'arctic', 'desert', 'coastal']).withMessage('Invalid region'),
    body('location.elevation').optional().isInt({ min: 0 }).withMessage('Elevation must be a positive integer')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { horseIds, location: userLocation } = req.body;
      const userId = req.user.id;

      // Verify horse ownership
      const horses = await prisma.horse.findMany({
        where: {
          id: { in: horseIds.map(id => parseInt(id)) },
          ownerId: userId
        },
        select: {
          id: true,
          name: true,
          age: true,
          health: true,
          epigeneticModifiers: true,
          speed: true,
          stamina: true,
          agility: true,
          intelligence: true
        }
      });

      if (horses.length !== horseIds.length) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not own all specified horses'
        });
      }

      const location = userLocation || {
        latitude: 40.7128,
        longitude: -74.0060,
        region: 'temperate',
        elevation: 10
      };

      logger.info(`[environmentalRoutes.calculate-impact] Calculating impact for ${horses.length} horses`);

      const results = [];
      for (const horse of horses) {
        const horseData = {
          id: horse.id,
          age: horse.age,
          health: horse.health || 85,
          traits: [
            ...(horse.epigeneticModifiers?.positive || []),
            ...(horse.epigeneticModifiers?.negative || []),
            ...(horse.epigeneticModifiers?.hidden || [])
          ],
          stats: {
            speed: horse.speed || 50,
            stamina: horse.stamina || 50,
            agility: horse.agility || 50,
            intelligence: horse.intelligence || 50
          }
        };

        const impact = calculateEnvironmentalImpact(new Date(), location, horseData);
        const triggers = calculateEnvironmentalTriggers(new Date(), location, horseData);
        const stress = assessEnvironmentalStress(new Date(), location, horseData);
        const comfortZone = calculateComfortZone(horseData);

        results.push({
          horseId: horse.id,
          horseName: horse.name,
          impact,
          triggers,
          stress,
          comfortZone
        });
      }

      res.json({
        success: true,
        data: {
          results,
          location,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error(`[environmentalRoutes.calculate-impact] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate environmental impact'
      });
    }
  }
);

/**
 * GET /api/environment/history
 * Get environmental history for analysis
 */
router.get('/history',
  authenticateToken,
  [
    query('startDate').isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
    query('endDate').isISO8601().withMessage('End date must be a valid ISO 8601 date'),
    query('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
    query('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
    query('region').optional().isIn(['tropical', 'temperate', 'arctic', 'desert', 'coastal']).withMessage('Invalid region'),
    query('elevation').optional().isInt({ min: 0 }).withMessage('Elevation must be a positive integer')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { startDate, endDate, latitude = 40.7128, longitude = -74.0060, region = 'temperate', elevation = 10 } = req.query;
      
      const location = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        region,
        elevation: parseInt(elevation)
      };

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Limit history to 90 days maximum
      const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (daysDiff > 90) {
        return res.status(400).json({
          success: false,
          error: 'History period cannot exceed 90 days'
        });
      }

      logger.info(`[environmentalRoutes.history] Getting history from ${startDate} to ${endDate}`);

      const history = getEnvironmentalHistory(start, end, location);

      res.json({
        success: true,
        data: {
          history,
          location,
          period: {
            start: startDate,
            end: endDate,
            days: daysDiff
          }
        }
      });

    } catch (error) {
      logger.error(`[environmentalRoutes.history] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get environmental history'
      });
    }
  }
);

/**
 * GET /api/environment/comfort-zone/:horseId
 * Get comfort zone analysis for a specific horse
 */
router.get('/comfort-zone/:horseId',
  authenticateToken,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Valid horse ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { horseId } = req.params;
      const userId = req.user.id;

      // Verify horse ownership
      const horse = await prisma.horse.findFirst({
        where: {
          id: parseInt(horseId),
          ownerId: userId
        },
        select: {
          id: true,
          name: true,
          epigeneticModifiers: true
        }
      });

      if (!horse) {
        return res.status(404).json({
          success: false,
          error: 'Horse not found or access denied'
        });
      }

      const horseData = {
        id: horse.id,
        traits: [
          ...(horse.epigeneticModifiers?.positive || []),
          ...(horse.epigeneticModifiers?.negative || []),
          ...(horse.epigeneticModifiers?.hidden || [])
        ]
      };

      logger.info(`[environmentalRoutes.comfort-zone] Calculating comfort zone for horse ${horseId}`);

      const comfortZone = calculateComfortZone(horseData);

      res.json({
        success: true,
        data: {
          horseId: horse.id,
          horseName: horse.name,
          comfortZone,
          traits: horseData.traits
        }
      });

    } catch (error) {
      logger.error(`[environmentalRoutes.comfort-zone] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate comfort zone'
      });
    }
  }
);

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  logger.error(`[environmentalRoutes] Unhandled error: ${error.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error in environmental system'
  });
});

export default router;
