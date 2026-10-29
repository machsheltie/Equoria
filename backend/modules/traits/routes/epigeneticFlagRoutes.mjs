/**
 * Epigenetic Flag Routes
 * API routes for epigenetic flag evaluation and management
 *
 * 🎯 PURPOSE:
 * Defines REST API endpoints for the epigenetic flag system including
 * flag evaluation, retrieval, and care pattern analysis.
 *
 * 📋 API ENDPOINTS:
 * - GET /api/flags/definitions - Get flag definitions
 * - GET /api/horses/:id/care-patterns - Get care patterns (debug)
 *
 * No player route assigns flags (Equoria-gu8jk; owner ruling 2026-10-20:
 * players must never write traits for themselves). POST /evaluate, which let an
 * owner run the flag engine on demand, was removed. The weekly flag job that
 * ran the engine over every horse under 3 was retired too (Equoria-koxep; owner
 * rulings 2026-10-27: traits change only through the nightly reveal ladder), and
 * the admin-only POST /batch-evaluate went with owner ruling 2026-10-28 (q203,
 * Equoria-a7f1p: "Remove it"; traits reveal only through grooming days).
 *
 * GET /analytics (stable-wide trait distribution) is gone (Equoria-a7f1p; owner
 * ruling 2026-10-21: flags are not a separate system).
 *
 * GET /horses/:id/flags, which only showed the old epigeneticFlags store, is gone
 * with the store (owner ruling 2026-10-29, q300, Equoria-efs4j).
 */

import express from 'express';
import { param, query, validationResult } from 'express-validator';
import { getFlagDefinitions, getCarePatterns } from '../controllers/epigeneticFlagController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import logger from '../../../utils/logger.mjs';

const router = express.Router();

/**
 * Validation middleware for horse ID parameter
 */
const validateHorseIdParam = [
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
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
 * GET /api/flags/definitions
 * Get epigenetic flag definitions
 *
 * @query {string} [type] - Filter by flag type (positive, negative, adaptive)
 * @returns {Object} Flag definitions
 */
router.get('/definitions', authenticateToken, validateFlagTypeQuery, async (req, res) => {
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
});

/**
 * GET /api/horses/:id/care-patterns
 * Get care pattern analysis for a horse (Debug/Admin endpoint)
 *
 * @param {number} id - Horse ID
 * @returns {Object} Care pattern analysis results
 */
router.get(
  '/horses/:id/care-patterns',
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
