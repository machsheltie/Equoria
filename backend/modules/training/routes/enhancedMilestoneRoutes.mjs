/**
 * Enhanced Milestone Evaluation Routes
 *
 * Read-only API routes for the enhanced milestone evaluation system (status and
 * definitions).
 *
 * No route here evaluates a milestone (Equoria-gu8jk; owner ruling 2026-10-20:
 * players must never write traits for themselves). POST /evaluate-milestone,
 * which wrote MilestoneTraitLog and UltraRareTraitEvent rows on demand and
 * accepted a client-chosen bondScore / taskLog / forceReevaluate, was removed.
 * Milestones are evaluated only by the daily milestone job
 * (utils/horseAgingSystem.mjs → enhancedMilestoneEvaluationSystem).
 */

import express from 'express';
import {
  getMilestoneStatus,
  getMilestoneDefinitions,
  validateHorseIdParam,
} from '../controllers/enhancedMilestoneController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';

const router = express.Router();

/**
 * GET /api/milestones/milestone-status/:horseId
 * Get milestone evaluation status for a horse
 *
 * Params:
 * - horseId: number (required) - ID of the horse
 *
 * Returns:
 * - Horse milestone status
 * - Available milestones based on age
 * - Completed evaluations
 * - Eligibility information
 */
router.get(
  '/milestone-status/:horseId',
  authenticateToken,
  validateHorseIdParam,
  requireOwnership('horse', { idParam: 'horseId' }),
  getMilestoneStatus,
);

/**
 * GET /api/milestones/milestone-definitions
 * Get milestone type definitions and developmental windows
 *
 * Returns:
 * - Milestone types and their developmental windows
 * - Trait thresholds and scoring factors
 * - System configuration information
 */
router.get('/milestone-definitions', getMilestoneDefinitions);

export default router;
