/**
 * Epigenetic Flag Routes
 * API routes for epigenetic flag evaluation and management
 *
 * 🎯 PURPOSE:
 * Defines REST API endpoints for the epigenetic flag system including
 * flag evaluation, retrieval, and care pattern analysis.
 *
 * 📋 API ENDPOINTS:
 * - POST /api/flags/evaluate - Evaluate flags for a horse
 * - GET /api/horses/:id/flags - Get horse flags
 * - GET /api/flags/definitions - Get flag definitions
 * - POST /api/flags/batch-evaluate - Batch evaluate (admin)
 * - GET /api/horses/:id/care-patterns - Get care patterns (debug)
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import {
  evaluateFlags,
  getHorseFlags,
  getFlagDefinitions,
  batchEvaluateFlags,
  getCarePatterns,
} from '../controllers/epigeneticFlagController.mjs';
import { authenticateToken } from '../middleware/auth.mjs';
import { requireOwnership } from '../middleware/ownership.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware for flag evaluation
 */
const validateFlagEvaluation = [
  body('horseId')
    .isInt({ min: 1 })
    .withMessage('Horse ID must be a positive integer'),
];

/**
 * Validation middleware for horse ID parameter
 */
const validateHorseIdParam = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Horse ID must be a positive integer'),
];

/**
 * Validation middleware for batch evaluation
 */
const validateBatchEvaluation = [
  body('horseIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('horseIds must be an array with 1-50 horse IDs'),
  body('horseIds.*')
    .isInt({ min: 1 })
    .withMessage('Each horse ID must be a positive integer'),
];

/**
 * Validation middleware for flag type query
 */
const validateFlagTypeQuery = [
  query('type')
    .optional()
    .isIn(['positive', 'negative', 'adaptive'])
    .withMessage('Flag type must be positive, negative, or adaptive'),
];

/**
 * POST /api/flags/evaluate
 * Evaluate epigenetic flags for a specific horse
 *
 * @body {number} horseId - ID of the horse to evaluate
 * @returns {Object} Evaluation results with newly assigned flags
 */
router.post('/evaluate',
  authenticateToken,
  validateFlagEvaluation,
  async (req, res) => {
    try {
      await evaluateFlags(req, res);
    } catch (error) {
      logger.error(`[epigeneticFlagRoutes] Error in /evaluate: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
);

/**
 * GET /api/horses/:id/flags
 * Get all epigenetic flags for a specific horse
 *
 * @param {number} id - Horse ID
 * @returns {Object} Horse flags with definitions and details
 */
router.get('/horses/:id/flags',
  authenticateToken,
  validateHorseIdParam,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      await getHorseFlags(req, res);
    } catch (error) {
      logger.error(`[epigeneticFlagRoutes] Error in /horses/:id/flags: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
);

/**
 * GET /api/flags/definitions
 * Get epigenetic flag definitions
 *
 * @query {string} [type] - Filter by flag type (positive, negative, adaptive)
 * @returns {Object} Flag definitions
 */
router.get('/definitions',
  authenticateToken,
  validateFlagTypeQuery,
  async (req, res) => {
    try {
      await getFlagDefinitions(req, res);
    } catch (error) {
      logger.error(`[epigeneticFlagRoutes] Error in /definitions: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
);

/**
 * POST /api/flags/batch-evaluate
 * Batch evaluate flags for multiple horses (Admin only)
 *
 * @body {number[]} horseIds - Array of horse IDs to evaluate
 * @returns {Object} Batch evaluation results
 */
router.post('/batch-evaluate',
  authenticateToken,
  validateBatchEvaluation,
  async (req, res) => {
    try {
      await batchEvaluateFlags(req, res);
    } catch (error) {
      logger.error(`[epigeneticFlagRoutes] Error in /batch-evaluate: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
);

/**
 * GET /api/horses/:id/care-patterns
 * Get care pattern analysis for a horse (Debug/Admin endpoint)
 *
 * @param {number} id - Horse ID
 * @returns {Object} Care pattern analysis results
 */
router.get('/horses/:id/care-patterns',
  authenticateToken,
  validateHorseIdParam,
  requireOwnership('horse', { idParam: 'id' }),
  async (req, res) => {
    try {
      await getCarePatterns(req, res);
    } catch (error) {
      logger.error(`[epigeneticFlagRoutes] Error in /horses/:id/care-patterns: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
);

/**
 * Error handling middleware for validation errors
 */
router.use((error, req, res, next) => {
  if (error instanceof validationResult) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.array(),
    });
  }
  next(error);
});

/**
 * Health check endpoint for flag system
 * GET /api/flags/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Epigenetic flag system is operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
