/**
 * Advanced Breeding Genetics Routes
 *
 * API endpoints for enhanced genetic probability calculations, advanced lineage analysis,
 * and genetic diversity tracking systems for comprehensive breeding management.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { findOwnedResource as _findOwnedResource } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';
import AppError from '../../../errors/AppError.mjs';
import {
  validateBatchHorseOwnership,
  getUserHorseIds,
} from '../services/breedingOwnershipQueries.mjs';
// Equoria-245bt: lineage-analysis signal persistence (via the traits barrel — public-API boundary).
import { recordLineageAnalysisForPair } from '../../traits/index.mjs';

// Import genetic services
// Equoria-emkv6: all four genetics functions live in the module-local service
// (`../services/...`). The genetic-probability handler previously dynamic-imported
// calculateGeneticCompatibilityScore / calculateGeneticDiversityImpact /
// calculateMultiGenerationalPredictions from `../../../services/...` (i.e.
// backend/services/), a path that does NOT exist — every authed request to
// POST /breeding/genetic-probability threw ERR_MODULE_NOT_FOUND and surfaced as
// a 500. Imported statically from the correct path so the handler resolves them
// at module load, matching calculateEnhancedGeneticProbabilities.
import {
  calculateEnhancedGeneticProbabilities,
  calculateGeneticCompatibilityScore,
  calculateGeneticDiversityImpact,
  calculateMultiGenerationalPredictions,
} from '../services/enhancedGeneticProbabilityService.mjs';
import {
  generateLineageTree,
  calculateGeneticDiversityMetrics,
  analyzeLineagePerformance,
  createVisualizationData,
  generateLineageBreedingRecommendations,
} from '../services/advancedLineageAnalysisService.mjs';
import {
  calculateAdvancedGeneticDiversity,
  trackPopulationGeneticHealth,
  calculateDetailedInbreedingCoefficient,
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

// ===== ENHANCED GENETIC PROBABILITY ROUTES =====

/**
 * POST /api/breeding/genetic-probability
 * Calculate enhanced genetic probabilities for breeding pair
 *
 * Security: Validates stallion and mare ownership atomically
 */
router.post(
  '/breeding/genetic-probability',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required'),
    body('includeLineage').optional().isBoolean().withMessage('includeLineage must be boolean'),
    body('generations').optional().isInt({ min: 1, max: 5 }).withMessage('generations must be 1-5'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { stallionId, mareId, includeLineage = false, generations = 3 } = req.body;
      const userId = req.user.id;

      logger.info(
        `[advancedBreedingGeneticsRoutes.genetic-probability] User ${userId} calculating for stallion ${stallionId} and mare ${mareId}`,
      );

      // Validate ownership of both horses atomically
      const horses = await validateBatchOwnership([stallionId, mareId], userId);
      if (!horses) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found',
        });
      }

      const [stallion, mare] = horses;

      const probabilities = calculateEnhancedGeneticProbabilities(stallion, mare);

      // Calculate compatibility analysis (statically imported above — Equoria-emkv6)
      const compatibilityAnalysis = calculateGeneticCompatibilityScore(stallion, mare);

      // Add lineage analysis if requested
      let lineageAnalysis = null;
      if (includeLineage) {
        const lineageTree = await generateLineageTree(
          parseInt(stallionId),
          parseInt(mareId),
          generations,
        );
        lineageAnalysis = {
          diversityImpact: calculateGeneticDiversityImpact(stallion, mare, lineageTree),
          multiGenerationalPredictions: calculateMultiGenerationalPredictions(
            stallion,
            mare,
            lineageTree,
          ),
        };
      }

      const result = {
        ...probabilities,
        compatibilityAnalysis,
        ...(lineageAnalysis && { lineageAnalysis }),
      };

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.genetic-probability] Error: ${error.message}`);

      // Equoria-4xwyi: TYPE-based 404 detection. The missing-horse case is already
      // handled by the validateBatchOwnership 404 above; this catch's 404 only
      // fires if a downstream service throws a typed AppError(404). Fail-closed:
      // any other error surfaces as 500 rather than being string-matched into a
      // misleading 404 (the Equoria-93lhj antipattern).
      if (AppError.isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to calculate genetic probabilities',
      });
    }
  },
);

// ===== ADVANCED LINEAGE ANALYSIS ROUTES =====

/**
 * GET /api/breeding/lineage-analysis/:stallionId/:mareId
 * Generate comprehensive lineage analysis
 *
 * Security: Validates stallion and mare ownership atomically
 */
router.get(
  '/breeding/lineage-analysis/:stallionId/:mareId',
  authenticateToken,
  [
    param('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    param('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required'),
    query('generations')
      .optional()
      .isInt({ min: 1, max: 5 })
      .withMessage('generations must be 1-5'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.params;
      const generations = parseInt(req.query.generations) || 3;
      const userId = req.user.id;

      logger.info(
        `[advancedBreedingGeneticsRoutes.lineage-analysis] User ${userId} analyzing lineage for stallion ${stallionId} and mare ${mareId}`,
      );

      // Validate ownership of both horses atomically
      const horses = await validateBatchOwnership([stallionId, mareId], userId);
      if (!horses) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found',
        });
      }

      const [stallion, mare] = horses;

      const [lineageTree, diversityMetrics, performanceAnalysis, visualizationData] =
        await Promise.all([
          generateLineageTree(parseInt(stallionId), parseInt(mareId), generations),
          calculateGeneticDiversityMetrics([{ generation: 0, horses: [stallion, mare] }]),
          analyzeLineagePerformance([{ generation: 0, horses: [stallion, mare] }]),
          createVisualizationData(parseInt(stallionId), parseInt(mareId), generations),
        ]);

      // Equoria-245bt: the DELIBERATE action that sets the intentional per-horse
      // lineage-analysis signal for BOTH horses — best-effort, never fails the
      // analysis response (see recordLineageAnalysisForPair).
      await recordLineageAnalysisForPair(parseInt(stallionId), parseInt(mareId), generations);

      res.json({
        success: true,
        data: {
          lineageTree,
          diversityMetrics,
          performanceAnalysis,
          visualizationData,
        },
      });
    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.lineage-analysis] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze lineage',
      });
    }
  },
);

/**
 * POST /api/breeding/breeding-recommendations
 * Generate comprehensive breeding recommendations
 *
 * Security: Validates stallion and mare ownership atomically
 */
router.post(
  '/breeding/breeding-recommendations',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.body;
      const userId = req.user.id;

      logger.info(
        `[advancedBreedingGeneticsRoutes.breeding-recommendations] User ${userId} generating recommendations for stallion ${stallionId} and mare ${mareId}`,
      );

      // Validate ownership of both horses atomically
      const horses = await validateBatchOwnership([stallionId, mareId], userId);
      if (!horses) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found',
        });
      }

      const recommendations = await generateLineageBreedingRecommendations(
        parseInt(stallionId),
        parseInt(mareId),
      );

      res.json({
        success: true,
        data: recommendations,
      });
    } catch (error) {
      logger.error(
        `[advancedBreedingGeneticsRoutes.breeding-recommendations] Error: ${error.message}`,
      );

      // Equoria-4xwyi: TYPE-based 404 detection. generateLineageBreedingRecommendations
      // throws a typed AppError(404) for the missing-horse case. Fail-closed: any
      // other error surfaces as 500 rather than being string-matched into a
      // misleading 404 (the Equoria-93lhj antipattern).
      if (AppError.isAppError(error) && error.statusCode === 404) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found',
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to generate breeding recommendations',
      });
    }
  },
);

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
 * POST /api/genetics/inbreeding-analysis
 * Calculate detailed inbreeding coefficient
 *
 * Security: Validates stallion and mare ownership atomically
 */
router.post(
  '/genetics/inbreeding-analysis',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.body;
      const userId = req.user.id;

      logger.info(
        `[advancedBreedingGeneticsRoutes.inbreeding-analysis] User ${userId} analyzing inbreeding for stallion ${stallionId} and mare ${mareId}`,
      );

      // Validate ownership of both horses atomically
      const horses = await validateBatchOwnership([stallionId, mareId], userId);
      if (!horses) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found',
        });
      }

      const inbreedingAnalysis = await calculateDetailedInbreedingCoefficient(
        parseInt(stallionId),
        parseInt(mareId),
      );

      res.json({
        success: true,
        data: inbreedingAnalysis,
      });
    } catch (error) {
      logger.error(`[advancedBreedingGeneticsRoutes.inbreeding-analysis] Error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze inbreeding',
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
      if (userId !== requestingUserId && req.user.role !== 'admin') {
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
 * POST /api/genetics/breeding-compatibility
 * Assess breeding pair compatibility
 *
 * Security: Validates stallion and mare ownership atomically
 */
router.post(
  '/genetics/breeding-compatibility',
  authenticateToken,
  [
    body('stallionId').isInt({ min: 1 }).withMessage('Valid stallion ID is required'),
    body('mareId').isInt({ min: 1 }).withMessage('Valid mare ID is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { stallionId, mareId } = req.body;
      const userId = req.user.id;

      logger.info(
        `[advancedBreedingGeneticsRoutes.breeding-compatibility] User ${userId} assessing compatibility for stallion ${stallionId} and mare ${mareId}`,
      );

      // Validate ownership of both horses atomically
      const horses = await validateBatchOwnership([stallionId, mareId], userId);
      if (!horses) {
        return res.status(404).json({
          success: false,
          error: 'One or both horses not found',
        });
      }

      // Import the compatibility assessment function
      const { assessBreedingPairCompatibility } =
        await import('../services/genetics/geneticDiversityTrackingService.mjs');

      const compatibility = await assessBreedingPairCompatibility(
        parseInt(stallionId),
        parseInt(mareId),
      );

      res.json({
        success: true,
        data: compatibility,
      });
    } catch (error) {
      logger.error(
        `[advancedBreedingGeneticsRoutes.breeding-compatibility] Error: ${error.message}`,
      );
      res.status(500).json({
        success: false,
        error: 'Failed to assess breeding compatibility',
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
      if (userId !== requestingUserId && req.user.role !== 'admin') {
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
