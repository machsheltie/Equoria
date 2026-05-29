/**
 * Horse Genetics / Phenotype Sub-Router (Equoria-y8u2j split)
 *
 * Extracted from backend/modules/horses/routes/horseRoutes.mjs as part of the
 * god-file split. Owns the 5 read-only phenotype / genetics endpoints under
 * /horses/:id/...
 *
 *   GET    /:id/conformation            — 8-region conformation scores + overall
 *   GET    /:id/conformation/analysis   — percentile rankings vs breed
 *   GET    /:id/gaits                   — gait quality scores (walk/trot/etc)
 *   GET    /:id/genetics                — full color genotype + phenotype
 *   GET    /:id/color                   — player-facing coat color + markings
 *
 * Mounting: this router is mounted at the SAME path as the parent
 * (`router.use(horseGeneticsRoutes)` in horseRoutes.mjs). All routes start
 * with `/:id/...` (2+ segments) so they do NOT conflict with the parent's
 * `GET /:id` (1 segment) under Express's path-matching — order between
 * sub-router mount point and parent `/:id` is therefore safe.
 *
 * Security: every route requires authentication + horse ownership via
 * requireOwnership('horse'). Behaviour preserved verbatim from the original
 * inline definitions, including the `rejectPollutedRequest` guard on the
 * genetics + color endpoints (matches the original — conformation and gaits
 * did NOT have it inline, so they don't here either).
 */

import express from 'express';
import { queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  getConformation,
  getConformationAnalysis,
  getGaits,
  getGenetics,
  getColor,
} from '../controllers/horseController.mjs';
import logger from '../../../utils/logger.mjs';
import { validateHorseId, rejectPollutedRequest } from './_validators.mjs';

const router = express.Router();

/**
 * GET /horses/:id/conformation
 * Get conformation scores for a specific horse (8 regions + overall).
 *
 * Security: Validates horse ownership before returning conformation data.
 */
router.get(
  '/:id/conformation',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getConformation(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/conformation/analysis
 * Get conformation analysis with percentile rankings compared to breed.
 *
 * Security: Validates horse ownership before returning analysis data.
 */
router.get(
  '/:id/conformation/analysis',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getConformationAnalysis(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/gaits
 * Get gait quality scores for a specific horse (walk, trot, canter, gallop +
 * gaiting).
 *
 * Security: Validates horse ownership before returning gait data.
 */
router.get(
  '/:id/gaits',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getGaits(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/genetics
 * Get full color genotype + phenotype for a specific horse.
 *
 * Security: Validates horse ownership before returning genetics data.
 */
router.get(
  '/:id/genetics',
  queryRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getGenetics(req, res);
    } catch (error) {
      logger.error(`[horseGeneticsRoutes] Error in genetics endpoint: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
);

/**
 * GET /horses/:id/color
 * Get player-facing coat color and markings summary for a specific horse.
 *
 * Security: Validates horse ownership before returning color data.
 */
router.get(
  '/:id/color',
  queryRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getColor(req, res);
    } catch (error) {
      logger.error(`[horseGeneticsRoutes] Error in color endpoint: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
);

export default router;
