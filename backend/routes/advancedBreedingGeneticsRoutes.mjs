/**
 * Advanced Breeding Genetics Routes
 * 
 * API endpoints for enhanced genetic probability calculations, advanced lineage analysis,
 * and genetic diversity tracking systems for comprehensive breeding management.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Import genetic services
import { calculateEnhancedGeneticProbabilities } from '../services/enhancedGeneticProbabilityService.mjs';
import {
  generateLineageTree,
  calculateGeneticDiversityMetrics,
  analyzeLineagePerformance,
  createVisualizationData,
  generateBreedingRecommendations
} from '../services/advancedLineageAnalysisService.mjs';
import {
  calculateAdvancedGeneticDiversity,
  trackPopulationGeneticHealth,
  calculateDetailedInbreedingCoefficient,
  generateOptimalBreedingRecommendations,
  analyzeGeneticTrends,
  generateGeneticDiversityReport
} from '../services/geneticDiversityTrackingService.mjs';

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
 * Middleware to verify horse ownership
 */
const verifyHorseOwnership = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { stallionId, mareId, horseIds } = req.body;
    const horseIdsToCheck = [];

    if (stallionId) horseIdsToCheck.push(parseInt(stallionId));
    if (mareId) horseIdsToCheck.push(parseInt(mareId));
    if (horseIds && Array.isArray(horseIds)) {
      horseIdsToCheck.push(...horseIds.map(id => parseInt(id)));
    }

    // Check URL parameters as well
    if (req.params.stallionId) horseIdsToCheck.push(parseInt(req.params.stallionId));
    if (req.params.mareId) horseIdsToCheck.push(parseInt(req.params.mareId));

    if (horseIdsToCheck.length > 0) {
      // First check if all horses exist
      const allHorses = await prisma.horse.findMany({
        where: {
          id: { in: horseIdsToCheck }
        },
        select: { id: true, userId: true }
      });

      // If some horses don't exist, let the route handler deal with it (404)
      if (allHorses.length !== horseIdsToCheck.length) {
        return next(); // Let route handler return 404
      }

      // Check if user owns all existing horses
      const ownedHorses = allHorses.filter(horse => horse.userId === userId);
      if (ownedHorses.length !== horseIdsToCheck.length) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You do not own all specified horses'
        });
      }
    }

    next();
  } catch (error) {
    logger.error(`[advancedBreedingGeneticsRoutes.verifyHorseOwnership] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: 'Failed to verify horse ownership'
    });
  }
};

// ===== ENHANCED GENETIC PROBABILITY ROUTES =====

/**
 * POST /api/breeding/genetic-probability
 * Calculate enhanced genetic probabilities for breeding pair
 */
router.post('/breeding/genetic-probability',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required'),
    body('includeLineage').optional().isBoolean().withMessage('includeLineage must be boolean'),
    body('generations').optional().isInt({ min: 1, max: 5 }).withMessage('generations must be 1-5')
  ],
  validateRequest,
  verifyHorseOwnership,
  async (req, res) => {
    try {
      const { stallionId, mareId, includeLineage = false, generations = 3 } = req.body;

      logger.info(`[advancedBreedingGeneticsRoutes.genetic-probability] Calculating for stallion ${stallionId} and mare ${mareId}`);

      // Get horse data first
      const [stallion, mare] = await Promise.all([
        prisma.horse.findUnique({ where: { id: parseInt(stallionId) } }),
        prisma.horse.findUnique({ where: { id: parseInt(mareId) } })
      ]);

      if (!stallion || !mare) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found'
        });
      }

      const probabilities = calculateEnhancedGeneticProbabilities(stallion, mare);

      // Add lineage analysis if requested
      let lineageAnalysis = null;
      if (includeLineage) {
        const { calculateGeneticDiversityImpact, calculateMultiGenerationalPredictions } = await import('../services/enhancedGeneticProbabilityService.mjs');
        const lineageTree = await generateLineageTree(parseInt(stallionId), parseInt(mareId), generations);
        lineageAnalysis = {
          diversityImpact: calculateGeneticDiversityImpact(stallion, mare, lineageTree),
          multiGenerationalPredictions: calculateMultiGenerationalPredictions(stallion, mare, lineageTree)
        };
      }

      const result = {
        ...probabilities,
        ...(lineageAnalysis && { lineageAnalysis })
      };

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.genetic-probability] Error: ${error.message}`);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to calculate genetic probabilities'
      });
    }
  }
);

// ===== ADVANCED LINEAGE ANALYSIS ROUTES =====

/**
 * GET /api/breeding/lineage-analysis/:stallionId/:mareId
 * Generate comprehensive lineage analysis
 */
router.get('/breeding/lineage-analysis/:stallionId/:mareId',
  authenticateToken,
  [
    param('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    param('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required'),
    query('generations').optional().isInt({ min: 1, max: 5 }).withMessage('generations must be 1-5')
  ],
  validateRequest,
  verifyHorseOwnership,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.params;
      const generations = parseInt(req.query.generations) || 3;

      logger.info(`[advancedBreedingGeneticsRoutes.lineage-analysis] Analyzing lineage for stallion ${stallionId} and mare ${mareId}`);

      // Check if horses exist
      const [stallion, mare] = await Promise.all([
        prisma.horse.findUnique({ where: { id: parseInt(stallionId) } }),
        prisma.horse.findUnique({ where: { id: parseInt(mareId) } })
      ]);

      if (!stallion || !mare) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found'
        });
      }

      const [lineageTree, diversityMetrics, performanceAnalysis, visualizationData] = await Promise.all([
        generateLineageTree(parseInt(stallionId), parseInt(mareId), generations),
        calculateGeneticDiversityMetrics([{ generation: 0, horses: [stallion, mare] }]),
        analyzeLineagePerformance([{ generation: 0, horses: [stallion, mare] }]),
        createVisualizationData(parseInt(stallionId), parseInt(mareId), generations)
      ]);

      res.json({
        success: true,
        data: {
          lineageTree,
          diversityMetrics,
          performanceAnalysis,
          visualizationData
        }
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.lineage-analysis] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze lineage'
      });
    }
  }
);

/**
 * POST /api/breeding/breeding-recommendations
 * Generate comprehensive breeding recommendations
 */
router.post('/breeding/breeding-recommendations',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required')
  ],
  validateRequest,
  verifyHorseOwnership,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.body;

      logger.info(`[advancedBreedingGeneticsRoutes.breeding-recommendations] Generating recommendations for stallion ${stallionId} and mare ${mareId}`);

      const recommendations = await generateBreedingRecommendations(
        parseInt(stallionId),
        parseInt(mareId)
      );

      res.json({
        success: true,
        data: recommendations
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.breeding-recommendations] Error: ${error.message}`);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to generate breeding recommendations'
      });
    }
  }
);

// ===== GENETIC DIVERSITY TRACKING ROUTES =====

/**
 * POST /api/genetics/population-analysis
 * Analyze population-level genetic diversity
 */
router.post('/genetics/population-analysis',
  authenticateToken,
  [
    body('horseIds').isArray({ min: 1 }).withMessage('horseIds array is required'),
    body('horseIds.*').isInt({ min: 1 }).withMessage('All horse IDs must be valid integers')
  ],
  validateRequest,
  verifyHorseOwnership,
  async (req, res) => {
    try {
      const { horseIds } = req.body;
      const horseIdsInt = horseIds.map(id => parseInt(id));

      logger.info(`[advancedBreedingGeneticsRoutes.population-analysis] Analyzing ${horseIdsInt.length} horses`);

      const [diversityMetrics, populationHealth, geneticTrends, breedingRecommendations] = await Promise.all([
        calculateAdvancedGeneticDiversity(horseIdsInt),
        trackPopulationGeneticHealth(horseIdsInt),
        analyzeGeneticTrends(horseIdsInt),
        generateOptimalBreedingRecommendations(horseIdsInt)
      ]);

      res.json({
        success: true,
        data: {
          diversityMetrics,
          populationHealth,
          geneticTrends,
          breedingRecommendations
        }
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.population-analysis] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze population genetics'
      });
    }
  }
);

/**
 * POST /api/genetics/inbreeding-analysis
 * Calculate detailed inbreeding coefficient
 */
router.post('/genetics/inbreeding-analysis',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required')
  ],
  validateRequest,
  verifyHorseOwnership,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.body;

      logger.info(`[advancedBreedingGeneticsRoutes.inbreeding-analysis] Analyzing inbreeding for stallion ${stallionId} and mare ${mareId}`);

      const inbreedingAnalysis = await calculateDetailedInbreedingCoefficient(
        parseInt(stallionId),
        parseInt(mareId)
      );

      res.json({
        success: true,
        data: inbreedingAnalysis
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.inbreeding-analysis] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze inbreeding'
      });
    }
  }
);

/**
 * GET /api/genetics/diversity-report/:userId
 * Generate comprehensive genetic diversity report
 */
router.get('/genetics/diversity-report/:userId',
  authenticateToken,
  [
    param('userId').isInt({ min: 1 }).withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.id;

      // Verify user can access this report (own report or admin)
      if (parseInt(userId) !== requestingUserId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You can only view your own genetic diversity report'
        });
      }

      logger.info(`[advancedBreedingGeneticsRoutes.diversity-report] Generating report for user ${userId}`);

      // Get all horses owned by the user
      const userHorses = await prisma.horse.findMany({
        where: { ownerId: parseInt(userId) },
        select: { id: true }
      });

      if (userHorses.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No horses found for this user'
        });
      }

      const horseIds = userHorses.map(h => h.id);
      const report = await generateGeneticDiversityReport(horseIds);

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.diversity-report] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate genetic diversity report'
      });
    }
  }
);

/**
 * POST /api/genetics/optimal-breeding
 * Generate optimal breeding recommendations for population
 */
router.post('/genetics/optimal-breeding',
  authenticateToken,
  [
    body('horseIds').isArray({ min: 2 }).withMessage('At least 2 horse IDs are required'),
    body('horseIds.*').isInt({ min: 1 }).withMessage('All horse IDs must be valid integers')
  ],
  validateRequest,
  verifyHorseOwnership,
  async (req, res) => {
    try {
      const { horseIds } = req.body;
      const horseIdsInt = horseIds.map(id => parseInt(id));

      logger.info(`[advancedBreedingGeneticsRoutes.optimal-breeding] Generating optimal breeding for ${horseIdsInt.length} horses`);

      const recommendations = await generateOptimalBreedingRecommendations(horseIdsInt);

      res.json({
        success: true,
        data: recommendations
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.optimal-breeding] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate optimal breeding recommendations'
      });
    }
  }
);

/**
 * POST /api/genetics/breeding-compatibility
 * Assess breeding pair compatibility
 */
router.post('/genetics/breeding-compatibility',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required')
  ],
  validateRequest,
  verifyHorseOwnership,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.body;

      logger.info(`[advancedBreedingGeneticsRoutes.breeding-compatibility] Assessing compatibility for stallion ${stallionId} and mare ${mareId}`);

      // Import the compatibility assessment function
      const { assessBreedingPairCompatibility } = await import('../services/geneticDiversityTrackingService.mjs');

      const compatibility = await assessBreedingPairCompatibility(
        parseInt(stallionId),
        parseInt(mareId)
      );

      res.json({
        success: true,
        data: compatibility
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.breeding-compatibility] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to assess breeding compatibility'
      });
    }
  }
);

/**
 * GET /api/genetics/population-health/:userId
 * Get population genetic health for user's horses
 */
router.get('/genetics/population-health/:userId',
  authenticateToken,
  [
    param('userId').isInt({ min: 1 }).withMessage('Valid user ID is required')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.id;

      // Verify user can access this data (own data or admin)
      if (parseInt(userId) !== requestingUserId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You can only view your own population health data'
        });
      }

      logger.info(`[advancedBreedingGeneticsRoutes.population-health] Getting health for user ${userId}`);

      // Get all horses owned by the user
      const userHorses = await prisma.horse.findMany({
        where: { ownerId: parseInt(userId) },
        select: { id: true }
      });

      if (userHorses.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No horses found for this user'
        });
      }

      const horseIds = userHorses.map(h => h.id);
      const populationHealth = await trackPopulationGeneticHealth(horseIds);

      res.json({
        success: true,
        data: populationHealth
      });

    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.population-health] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get population health data'
      });
    }
  }
);

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  logger.error(`[advancedBreedingGeneticsRoutes] Unhandled error: ${error.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error in genetic analysis'
  });
});

export default router;
