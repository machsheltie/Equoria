/**
 * Enhanced Reporting API Routes
 *
 * Provides enhanced trait history API with advanced epigenetic data and insights.
 * Integrates with advanced epigenetic services to provide comprehensive reporting,
 * multi-horse analysis, trend analysis, and export capabilities.
 *
 * Business Rules:
 * - Authentication required for all endpoints
 * - Horse ownership validation for horse-specific endpoints
 * - Advanced filtering and aggregation capabilities
 * - Multi-horse comparison and analysis features
 * - Comprehensive error handling and logging
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

// Import advanced epigenetic services
import { generateEnvironmentalReport } from '../services/environmentalTriggerSystem.mjs';
import { generateInteractionMatrix } from '../services/traitInteractionMatrix.mjs';
import { generateDevelopmentalForecast, trackDevelopmentalMilestones } from '../services/developmentalWindowSystem.mjs';

// Import enhanced reporting service functions
import {
  generateTraitHistoryInsights,
  generateEpigeneticRecommendations,
  buildTraitTimeline,
  identifyCriticalPeriods,
  mapEnvironmentalEvents,
  generateStableOverview,
  analyzeTraitDistribution,
  analyzeDevelopmentalStages,
  analyzeStableEnvironmentalFactors,
  generateStableRecommendations,
  generateHorseComparison,
  identifyTraitSimilarities,
  identifyTraitDifferences,
  generateHorseRankings,
  generateComparisonInsights,
  analyzeTraitTrends,
  identifyTraitPatterns,
  generateTrendPredictions,
  generateSummaryReport,
  generateDetailedReport,
  generateComprehensiveReport,
} from '../services/enhancedReportingService.mjs';

const router = express.Router();

/**
 * Middleware to validate horse ownership
 */
async function validateHorseOwnership(req, res, next) {
  try {
    const horseId = parseInt(req.params.id);
    const userId = req.user.id;

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { id: true, ownerId: true },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found',
      });
    }

    if (horse.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not own this horse',
      });
    }

    req.horse = horse;
    next();
  } catch (error) {
    logger.error('Error validating horse ownership:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
}

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
}

// ===== ENHANCED TRAIT HISTORY ENDPOINTS =====

/**
 * GET /api/horses/:id/enhanced-trait-history
 * Get comprehensive trait history with environmental context
 */
router.get('/horses/:id/enhanced-trait-history',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  query('traitType').optional().isIn(['positive', 'negative', 'neutral']).withMessage('Invalid trait type'),
  query('discoveryMethod').optional().isString().withMessage('Discovery method must be a string'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid ISO date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid ISO date'),
  handleValidationErrors,
  validateHorseOwnership,
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const { traitType, discoveryMethod, dateFrom, dateTo } = req.query;

      // Build filter conditions
      const whereConditions = { horseId };
      if (discoveryMethod) { whereConditions.sourceType = discoveryMethod; } // Map discoveryMethod to sourceType
      if (dateFrom || dateTo) {
        whereConditions.timestamp = {};
        if (dateFrom) { whereConditions.timestamp.gte = new Date(dateFrom); }
        if (dateTo) { whereConditions.timestamp.lte = new Date(dateTo); }
      }

      // Get trait history
      const traitHistory = await prisma.traitHistoryLog.findMany({
        where: whereConditions,
        orderBy: { timestamp: 'desc' },
      });

      // Get environmental context
      const environmentalContext = await generateEnvironmentalReport(horseId);

      // Get developmental timeline
      const developmentalTimeline = await trackDevelopmentalMilestones(horseId);

      // Get trait interactions
      const traitInteractions = await generateInteractionMatrix(horseId);

      // Generate insights
      const insights = generateTraitHistoryInsights(traitHistory, environmentalContext, traitInteractions);

      logger.info(`Enhanced trait history generated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          horseId,
          traitHistory,
          environmentalContext,
          developmentalTimeline,
          traitInteractions,
          insights,
          filters: { traitType, discoveryMethod, dateFrom, dateTo },
        },
      });
    } catch (error) {
      logger.error(`Error generating enhanced trait history for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate enhanced trait history',
      });
    }
  },
);

/**
 * GET /api/horses/:id/epigenetic-insights
 * Get advanced epigenetic analysis and insights
 */
router.get('/horses/:id/epigenetic-insights',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  validateHorseOwnership,
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      // Get horse details
      const horse = await prisma.horse.findUnique({
        where: { id: horseId },
        include: {
          traitHistoryLogs: {
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      // Get comprehensive analysis
      const [
        environmentalInfluences,
        traitAnalysis,
        developmentalProgress,
        predictiveInsights,
      ] = await Promise.all([
        generateEnvironmentalReport(horseId),
        generateInteractionMatrix(horseId),
        trackDevelopmentalMilestones(horseId),
        generateDevelopmentalForecast(horseId, 60),
      ]);

      // Generate recommendations
      const recommendations = generateEpigeneticRecommendations(
        horse,
        environmentalInfluences,
        traitAnalysis,
        developmentalProgress,
      );

      logger.info(`Epigenetic insights generated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          horseId,
          traitAnalysis,
          environmentalInfluences,
          developmentalProgress,
          predictiveInsights,
          recommendations,
        },
      });
    } catch (error) {
      logger.error(`Error generating epigenetic insights for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate epigenetic insights',
      });
    }
  },
);

/**
 * GET /api/horses/:id/trait-timeline
 * Get detailed trait development timeline
 */
router.get('/horses/:id/trait-timeline',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  validateHorseOwnership,
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      // Get trait history and interactions
      const [traitHistory, milestones, interactions] = await Promise.all([
        prisma.traitHistoryLog.findMany({
          where: { horseId },
          orderBy: { timestamp: 'asc' },
        }),
        trackDevelopmentalMilestones(horseId),
        prisma.groomInteraction.findMany({
          where: { foalId: horseId },
          orderBy: { createdAt: 'asc' },
          include: {
            groom: {
              select: { name: true, groomPersonality: true },
            },
          },
        }),
      ]);

      // Build timeline
      const timeline = buildTraitTimeline(traitHistory, interactions);

      // Identify critical periods
      const criticalPeriods = identifyCriticalPeriods(timeline, milestones);

      // Map environmental events
      const environmentalEvents = mapEnvironmentalEvents(interactions);

      logger.info(`Trait timeline generated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          horseId,
          timeline,
          milestones: milestones.achievedMilestones,
          criticalPeriods,
          environmentalEvents,
        },
      });
    } catch (error) {
      logger.error(`Error generating trait timeline for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate trait timeline',
      });
    }
  },
);

// ===== MULTI-HORSE ANALYSIS ENDPOINTS =====

/**
 * GET /api/users/:id/stable-epigenetic-report
 * Get stable-wide epigenetic analysis
 */
router.get('/users/:id/stable-epigenetic-report',
  authenticateToken,
  param('id').custom((value, { req }) => {
    if (value !== req.user.id) {
      throw new Error('Access denied: Can only access your own stable report');
    }
    return true;
  }),
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.params.id;

      // Get all user's horses
      const horses = await prisma.horse.findMany({
        where: { ownerId: userId },
        include: {
          traitHistoryLogs: true,
        },
      });

      if (horses.length === 0) {
        return res.json({
          success: true,
          data: {
            userId,
            stableOverview: { totalHorses: 0 },
            traitDistribution: {},
            developmentalStages: {},
            environmentalFactors: {},
            recommendations: ['No horses in stable'],
          },
        });
      }

      // Generate stable overview
      const stableOverview = generateStableOverview(horses);
      const traitDistribution = analyzeTraitDistribution(horses);
      const developmentalStages = analyzeDevelopmentalStages(horses);
      const environmentalFactors = await analyzeStableEnvironmentalFactors(horses);
      const recommendations = generateStableRecommendations(stableOverview, traitDistribution, developmentalStages);

      logger.info(`Stable epigenetic report generated for user ${userId}`);

      res.json({
        success: true,
        data: {
          userId,
          stableOverview,
          traitDistribution,
          developmentalStages,
          environmentalFactors,
          recommendations,
        },
      });
    } catch (error) {
      logger.error(`Error generating stable epigenetic report for user ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate stable epigenetic report',
      });
    }
  },
);

/**
 * POST /api/horses/compare-epigenetics
 * Compare multiple horses' epigenetic profiles
 */
router.post('/horses/compare-epigenetics',
  authenticateToken,
  body('horseIds').isArray({ min: 2, max: 10 }).withMessage('Must provide 2-10 horse IDs'),
  body('horseIds.*').isInt({ min: 1 }).withMessage('Each horse ID must be a positive integer'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { horseIds } = req.body;
      const userId = req.user.id;

      // Validate horse ownership
      const horses = await prisma.horse.findMany({
        where: {
          id: { in: horseIds },
          ownerId: userId,
        },
        include: {
          traitHistoryLogs: true,
        },
      });

      if (horses.length !== horseIds.length) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not own all specified horses',
        });
      }

      // Generate comparison analysis
      const comparison = await generateHorseComparison(horses);
      const similarities = identifyTraitSimilarities(horses);
      const differences = identifyTraitDifferences(horses);
      const rankings = generateHorseRankings(horses);
      const insights = generateComparisonInsights(comparison, similarities, differences);

      logger.info(`Horse comparison generated for ${horseIds.length} horses by user ${userId}`);

      res.json({
        success: true,
        data: {
          comparison,
          similarities,
          differences,
          rankings,
          insights,
        },
      });
    } catch (error) {
      logger.error('Error comparing horses:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to compare horses',
      });
    }
  },
);


/**
 * GET /api/horses/:id/epigenetic-report-export
 * Get exportable epigenetic report data
 */
router.get('/horses/:id/epigenetic-report-export',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  query('format').optional().isIn(['summary', 'detailed', 'comprehensive']).withMessage('Invalid format'),
  handleValidationErrors,
  validateHorseOwnership,
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const format = req.query.format || 'detailed';

      // Get comprehensive horse data
      const horse = await prisma.horse.findUnique({
        where: { id: horseId },
        include: {
          traitHistoryLogs: {
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      // Generate report data based on format
      let reportData;
      switch (format) {
        case 'summary':
          reportData = await generateSummaryReport(horse);
          break;
        case 'comprehensive':
          reportData = await generateComprehensiveReport(horse);
          break;
        default: // detailed
          reportData = await generateDetailedReport(horse);
      }

      const metadata = {
        horseId,
        horseName: horse.name,
        reportType: 'epigenetic_analysis',
        format,
        generatedBy: req.user.id,
        generatedAt: new Date(),
        dataVersion: '1.0',
      };

      logger.info(`Epigenetic report export generated for horse ${horseId} (${format}) by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          reportData,
          metadata,
          format,
          generatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error generating epigenetic report export for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate epigenetic report export',
      });
    }
  },
);

export default router;
