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
 * Equoria-a7f1p: the environmental-triggers and trigger-thresholds routes (owner
 * ruling 2026-10-16: no weather, seasons or environment effects) and the
 * trait-matrix and trait-stability routes (owner ruling 2026-10-27: new trait
 * roster, effects not yet ruled) are gone too.
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
import { generateEnvironmentalReport } from '../services/environmentalTriggerSystem.mjs';

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

export default router;
