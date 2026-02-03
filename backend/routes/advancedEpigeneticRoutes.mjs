/**
 * Advanced Epigenetic API Routes
 *
 * Provides API endpoints for environmental triggers, trait interactions, and developmental windows.
 * Integrates with the advanced epigenetic services to expose sophisticated functionality
 * for environmental analysis, trait interaction matrices, and developmental forecasting.
 *
 * Business Rules:
 * - Authentication required for all endpoints
 * - Horse ownership validation for all horse-specific endpoints
 * - Input validation for complex epigenetic parameters
 * - Comprehensive error handling and logging
 * - Standardized response formatting
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../middleware/auth.mjs';
import { requireOwnership } from '../middleware/ownership.mjs';
import logger from '../utils/logger.mjs';
import _prisma from '../../packages/database/prismaClient.mjs';

// Import advanced epigenetic services
import {
  detectEnvironmentalTriggers,
  calculateTriggerThresholds,
  evaluateTraitExpressionProbability,
  generateEnvironmentalReport,
} from '../services/environmentalTriggerSystem.mjs';

import {
  analyzeTraitInteractions,
  calculateTraitSynergies,
  identifyTraitConflicts,
  evaluateTraitDominance,
  assessInteractionStability,
  generateInteractionMatrix,
} from '../services/traitInteractionMatrix.mjs';

import {
  identifyDevelopmentalWindows,
  calculateWindowSensitivity,
  evaluateTraitDevelopmentOpportunity,
  trackDevelopmentalMilestones,
  coordinateMultiWindowDevelopment,
  analyzeCriticalPeriodSensitivity,
  generateDevelopmentalForecast,
} from '../services/developmentalWindowSystem.mjs';

const router = express.Router();

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

// ===== ENVIRONMENTAL TRIGGER ENDPOINTS =====

/**
 * GET /api/horses/:id/environmental-analysis
 * Get comprehensive environmental trigger analysis for a horse
 */
router.get('/horses/:id/environmental-analysis',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const environmentalReport = await generateEnvironmentalReport(horseId);

      logger.info(`Environmental analysis generated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: environmentalReport,
      });
    } catch (error) {
      logger.error(`Error generating environmental analysis for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate environmental analysis',
      });
    }
  },
);

/**
 * GET /api/horses/:id/environmental-triggers
 * Detect environmental triggers from interaction patterns for a horse
 */
router.get('/horses/:id/environmental-triggers',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const triggers = await detectEnvironmentalTriggers(horseId);

      logger.info(`Environmental triggers detected for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: triggers,
      });
    } catch (error) {
      logger.error(`Error detecting environmental triggers for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to detect environmental triggers',
      });
    }
  },
);

/**
 * GET /api/horses/:id/trigger-thresholds
 * Calculate age-appropriate trigger thresholds for a horse
 */
router.get('/horses/:id/trigger-thresholds',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const thresholds = await calculateTriggerThresholds(horseId);

      logger.info(`Trigger thresholds calculated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: thresholds,
      });
    } catch (error) {
      logger.error(`Error calculating trigger thresholds for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate trigger thresholds',
      });
    }
  },
);

/**
 * POST /api/horses/:id/trait-expression-probability
 * Evaluate trait expression probability based on environmental exposure
 */
router.post('/horses/:id/trait-expression-probability',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  body('traitName').notEmpty().withMessage('Trait name is required'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const { traitName } = req.body;

      const probability = await evaluateTraitExpressionProbability(horseId, traitName);

      logger.info(`Trait expression probability evaluated for horse ${horseId} (${traitName}) by user ${req.user.id}`);

      res.json({
        success: true,
        data: probability,
      });
    } catch (error) {
      logger.error(`Error evaluating trait expression probability for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate trait expression probability',
      });
    }
  },
);

/**
 * GET /api/horses/:id/environmental-forecast
 * Get environmental forecast for a horse over specified time period
 */
router.get('/horses/:id/environmental-forecast',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const days = parseInt(req.query.days) || 30;

      const forecast = await generateDevelopmentalForecast(horseId, days);

      logger.info(`Environmental forecast generated for horse ${horseId} (${days} days) by user ${req.user.id}`);

      res.json({
        success: true,
        data: forecast,
      });
    } catch (error) {
      logger.error(`Error generating environmental forecast for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate environmental forecast',
      });
    }
  },
);

/**
 * POST /api/horses/:id/evaluate-trait-opportunity
 * Evaluate trait development opportunity during a specific window
 */
router.post('/horses/:id/evaluate-trait-opportunity',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  body('traitName').notEmpty().withMessage('Trait name is required'),
  body('windowName').notEmpty().withMessage('Window name is required'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const { traitName, windowName } = req.body;

      const opportunity = await evaluateTraitDevelopmentOpportunity(horseId, traitName, windowName);

      logger.info(`Trait opportunity evaluated for horse ${horseId} (${traitName} in ${windowName}) by user ${req.user.id}`);

      res.json({
        success: true,
        data: opportunity,
      });
    } catch (error) {
      logger.error(`Error evaluating trait opportunity for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to evaluate trait development opportunity',
      });
    }
  },
);

// ===== TRAIT INTERACTION ENDPOINTS =====

/**
 * GET /api/horses/:id/trait-interactions
 * Get trait interaction analysis for a horse
 */
router.get('/horses/:id/trait-interactions',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const interactions = await analyzeTraitInteractions(horseId);
      const synergies = await calculateTraitSynergies(horseId);
      const conflicts = await identifyTraitConflicts(horseId);
      const dominance = await evaluateTraitDominance(horseId);

      logger.info(`Trait interactions analyzed for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          horseId,
          traitInteractions: interactions,
          synergies,
          conflicts,
          dominance,
        },
      });
    } catch (error) {
      logger.error(`Error analyzing trait interactions for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze trait interactions',
      });
    }
  },
);

/**
 * GET /api/horses/:id/trait-matrix
 * Get complete trait interaction matrix for a horse
 */
router.get('/horses/:id/trait-matrix',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const matrix = await generateInteractionMatrix(horseId);

      logger.info(`Trait interaction matrix generated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: matrix,
      });
    } catch (error) {
      logger.error(`Error generating trait matrix for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate trait interaction matrix',
      });
    }
  },
);

/**
 * GET /api/horses/:id/trait-stability
 * Get trait interaction stability analysis for a horse
 */
router.get('/horses/:id/trait-stability',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const stability = await assessInteractionStability(horseId);

      logger.info(`Trait stability analyzed for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: stability,
      });
    } catch (error) {
      logger.error(`Error analyzing trait stability for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze trait stability',
      });
    }
  },
);

// ===== DEVELOPMENTAL WINDOW ENDPOINTS =====

/**
 * GET /api/horses/:id/developmental-windows
 * Get active and upcoming developmental windows for a horse
 */
router.get('/horses/:id/developmental-windows',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const windows = await identifyDevelopmentalWindows(horseId);

      logger.info(`Developmental windows identified for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: windows,
      });
    } catch (error) {
      logger.error(`Error identifying developmental windows for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to identify developmental windows',
      });
    }
  },
);

/**
 * POST /api/horses/:id/window-sensitivity
 * Calculate sensitivity for a specific developmental window
 */
router.post('/horses/:id/window-sensitivity',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  body('windowName').notEmpty().withMessage('Window name is required'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const { windowName } = req.body;

      const sensitivity = await calculateWindowSensitivity(horseId, windowName);

      logger.info(`Window sensitivity calculated for horse ${horseId} (${windowName}) by user ${req.user.id}`);

      res.json({
        success: true,
        data: sensitivity,
      });
    } catch (error) {
      logger.error(`Error calculating window sensitivity for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate window sensitivity',
      });
    }
  },
);

/**
 * GET /api/horses/:id/developmental-milestones
 * Track developmental milestones for a horse
 */
router.get('/horses/:id/developmental-milestones',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const milestones = await trackDevelopmentalMilestones(horseId);

      logger.info(`Developmental milestones tracked for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: milestones,
      });
    } catch (error) {
      logger.error(`Error tracking developmental milestones for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to track developmental milestones',
      });
    }
  },
);

/**
 * GET /api/horses/:id/developmental-forecast
 * Get developmental forecast for a horse
 */
router.get('/horses/:id/developmental-forecast',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);
      const days = parseInt(req.query.days) || 30;

      const forecast = await generateDevelopmentalForecast(horseId, days);

      logger.info(`Developmental forecast generated for horse ${horseId} (${days} days) by user ${req.user.id}`);

      res.json({
        success: true,
        data: forecast,
      });
    } catch (error) {
      logger.error(`Error generating developmental forecast for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate developmental forecast',
      });
    }
  },
);

/**
 * GET /api/horses/:id/critical-period-analysis
 * Get critical period sensitivity analysis for a horse
 */
router.get('/horses/:id/critical-period-analysis',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const analysis = await analyzeCriticalPeriodSensitivity(horseId);

      logger.info(`Critical period analysis generated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error) {
      logger.error(`Error analyzing critical periods for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze critical periods',
      });
    }
  },
);

/**
 * POST /api/horses/:id/coordinate-development
 * Coordinate multi-window development for a horse
 */
router.post('/horses/:id/coordinate-development',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const coordination = await coordinateMultiWindowDevelopment(horseId);

      logger.info(`Development coordination generated for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: coordination,
      });
    } catch (error) {
      logger.error(`Error coordinating development for horse ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to coordinate development',
      });
    }
  },
);

export default router;
