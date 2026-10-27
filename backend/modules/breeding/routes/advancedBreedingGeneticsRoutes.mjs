/**
 * Advanced Breeding Genetics Routes
 *
 * Herd-level genetic diversity reports for a player's own horses. The pair-prediction
 * routes (genetic-probability, lineage-analysis, breeding-recommendations,
 * inbreeding-analysis, breeding-compatibility) are removed: owner ruling q91
 * (2026-10-26), players never see a predicted outcome for their foal (Equoria-8grnh).
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import logger from '../../../utils/logger.mjs';
import { satisfiesRole } from '../../staff/index.mjs';
import {
  validateBatchHorseOwnership,
  getUserHorseIds,
} from '../services/breedingOwnershipQueries.mjs';
import {
  calculateAdvancedGeneticDiversity,
  trackPopulationGeneticHealth,
  generateOptimalBreedingRecommendations,
  analyzeGeneticTrends,
  generateGeneticDiversityReport,
} from '../services/genetics/geneticDiversityTrackingService.mjs';

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
      details: errors.array(),
    });
  }
  next();
};

/**
 * Helper to validate batch horse ownership (for routes with multiple horses)
 * Uses single-query atomic validation to prevent CWE-639
 */
const validateBatchOwnership = (horseIds, userId) => validateBatchHorseOwnership(horseIds, userId);

// ===== GENETIC DIVERSITY TRACKING ROUTES =====

/**
 * POST /api/genetics/population-analysis
 * Analyze population-level genetic diversity
 *
 * Security: Validates ownership of all horses in array atomically
 */
router.post(
  '/genetics/population-analysis',
  authenticateToken,
  [
    body('horseIds').isArray({ min: 1 }).withMessage('horseIds array is required'),
    body('horseIds.*').isInt({ min: 1 }).withMessage('All horse IDs must be valid integers'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { horseIds } = req.body;
      const userId = req.user.id;

      logger.info(
        `[advancedBreedingGeneticsRoutes.population-analysis] User ${userId} analyzing ${horseIds.length} horses`,
      );

      // Validate ownership of all horses atomically
      const horses = await validateBatchOwnership(horseIds, userId);
      if (!horses) {
        return res.status(404).json({
          success: false,
          error: 'One or more horses not found',
        });
      }

      const horseIdsInt = horseIds.map(id => parseInt(id));

      const [diversityMetrics, populationHealth, geneticTrends, breedingRecommendations] =
        await Promise.all([
          calculateAdvancedGeneticDiversity(horseIdsInt),
          trackPopulationGeneticHealth(horseIdsInt),
          analyzeGeneticTrends(horseIdsInt),
          generateOptimalBreedingRecommendations(horseIdsInt),
        ]);

      res.json({
        success: true,
        data: {
          diversityMetrics,
          populationHealth,
          geneticTrends,
          breedingRecommendations,
        },
      });
    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.population-analysis] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze population genetics',
      });
    }
  },
);

/**
 * GET /api/genetics/diversity-report/:userId
 * Generate comprehensive genetic diversity report
 */
router.get(
  '/genetics/diversity-report/:userId',
  authenticateToken,
  [param('userId').isUUID().withMessage('Valid user ID is required')],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.id;

      // Verify user can access this report (own report or admin)
      if (userId !== requestingUserId && !satisfiesRole(req.user.role, 'admin')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You can only view your own genetic diversity report',
        });
      }

      logger.info(
        `[advancedBreedingGeneticsRoutes.diversity-report] Generating report for user ${userId}`,
      );

      // Service-layer fetch (Equoria-becrm)
      const horseIds = await getUserHorseIds(userId);

      if (horseIds.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No horses found for this user',
        });
      }
      const report = await generateGeneticDiversityReport(horseIds);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.diversity-report] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate genetic diversity report',
      });
    }
  },
);

/**
 * POST /api/genetics/optimal-breeding
 * Generate optimal breeding recommendations for population
 *
 * Security: Validates ownership of all horses in array atomically
 */
router.post(
  '/genetics/optimal-breeding',
  authenticateToken,
  [
    body('horseIds').isArray({ min: 2 }).withMessage('At least 2 horse IDs are required'),
    body('horseIds.*').isInt({ min: 1 }).withMessage('All horse IDs must be valid integers'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { horseIds } = req.body;
      const userId = req.user.id;

      logger.info(
        `[advancedBreedingGeneticsRoutes.optimal-breeding] User ${userId} generating optimal breeding for ${horseIds.length} horses`,
      );

      // Validate ownership of all horses atomically
      const horses = await validateBatchOwnership(horseIds, userId);
      if (!horses) {
        return res.status(404).json({
          success: false,
          error: 'One or more horses not found',
        });
      }

      const horseIdsInt = horseIds.map(id => parseInt(id));

      const recommendations = await generateOptimalBreedingRecommendations(horseIdsInt);

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.optimal-breeding] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to generate optimal breeding recommendations',
      });
    }
  },
);

/**
 * GET /api/genetics/population-health/:userId
 * Get population genetic health for user's horses
 */
router.get(
  '/genetics/population-health/:userId',
  authenticateToken,
  // Equoria-86nbb: User.id is a UUID (String), so validate as UUID — the old
  // `isInt({ min: 1 })` rejected every real UUID with a 400, and the
  // `parseInt(userId)` ownership check below (NaN !== uuid-string) then denied
  // every legitimate non-admin caller with a 403. Mirrors the diversity-report
  // route's correct `isUUID()` + direct string compare.
  [param('userId').isUUID().withMessage('Valid user ID is required')],
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.id;

      // Verify user can access this data (own data or admin)
      if (userId !== requestingUserId && !satisfiesRole(req.user.role, 'admin')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: You can only view your own population health data',
        });
      }

      logger.info(
        `[advancedBreedingGeneticsRoutes.population-health] Getting health for user ${userId}`,
      );

      // Service-layer fetch (Equoria-becrm)
      const horseIds = await getUserHorseIds(userId);

      if (horseIds.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No horses found for this user',
        });
      }
      const populationHealth = await trackPopulationGeneticHealth(horseIds);

      res.json({
        success: true,
        data: populationHealth,
      });
    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.population-health] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to get population health data',
      });
    }
  },
);

/**
 * Error handling middleware
 */
router.use((error, req, res, _next) => {
  logger.error(`[advancedBreedingGeneticsRoutes] Unhandled error: ${error.message}`);
  res.status(500).json({
    success: false,
    error: 'Internal server error in genetic analysis',
  });
});

export default router;
