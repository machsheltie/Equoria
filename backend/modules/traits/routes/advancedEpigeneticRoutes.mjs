/**
 * Advanced Epigenetic API Routes
 *
 * Provides API endpoints for environmental triggers and trait interactions.
 * Integrates with the advanced epigenetic services to expose environmental
 * analysis and trait interaction matrices.
 *
 * Owner ruling 2026-10-07 (Equoria-huuaf): no potential, no developmental windows,
 * no forecasts, no advice. The developmental-window, milestone, forecast and
 * critical-period routes, the trait-opportunity evaluator, the environmental
 * forecast and the trait-expression-probability route are gone.
 *
 * Business Rules:
 * - Authentication required for all endpoints
 * - Horse ownership validation for all horse-specific endpoints
 * - Input validation for complex epigenetic parameters
 * - Comprehensive error handling and logging
 * - Standardized response formatting
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';

// Import advanced epigenetic services
import {
  detectTriggers,
  generateEnvironmentalReport,
  loadEnvironmentalTriggerSnapshot,
  triggerThresholds,
} from '../services/environmentalTriggerSystem.mjs';

import {
  analyzeTraitSnapshot,
  toTraitAnalysisSnapshot,
} from '../services/traitInteractionMatrix.mjs';

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
router.get(
  '/horses/:id/environmental-analysis',
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
router.get(
  '/horses/:id/environmental-triggers',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const triggers = detectTriggers(await loadEnvironmentalTriggerSnapshot(horseId));

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
router.get(
  '/horses/:id/trigger-thresholds',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const thresholds = triggerThresholds(await loadEnvironmentalTriggerSnapshot(horseId));

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

// ===== TRAIT INTERACTION ENDPOINTS =====

/**
 * GET /api/horses/:id/trait-interactions
 * Get trait interaction analysis for a horse
 */
router.get(
  '/horses/:id/trait-interactions',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      // requireOwnership already loaded the horse row into req.horse: analyze that
      // one row, no second read; every section shares one snapshot (Equoria-q4uem.5).
      const { traitInteractions, synergies, conflicts, dominance } = analyzeTraitSnapshot(
        toTraitAnalysisSnapshot(req.horse),
      );

      logger.info(`Trait interactions analyzed for horse ${horseId} by user ${req.user.id}`);

      res.json({
        success: true,
        data: {
          horseId,
          traitInteractions,
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
router.get(
  '/horses/:id/trait-matrix',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const matrix = analyzeTraitSnapshot(toTraitAnalysisSnapshot(req.horse));

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
router.get(
  '/horses/:id/trait-stability',
  authenticateToken,
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  handleValidationErrors,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      const { stability } = analyzeTraitSnapshot(toTraitAnalysisSnapshot(req.horse));

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

export default router;
