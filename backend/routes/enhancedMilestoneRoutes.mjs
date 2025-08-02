/**
 * Enhanced Milestone Evaluation Routes
 * 
 * API routes for the enhanced milestone evaluation system that integrates
 * groom care history, bond consistency, and task diversity into trait determination.
 */

import express from 'express';
import { 
  evaluateMilestone,
  getMilestoneStatus,
  getMilestoneDefinitions,
  validateMilestoneEvaluation,
  validateHorseIdParam
} from '../controllers/enhancedMilestoneController.mjs';
import { authenticateToken } from '../middleware/auth.mjs';

const router = express.Router();

/**
 * POST /api/traits/evaluate-milestone
 * Evaluate milestone for a horse with enhanced groom care integration
 * 
 * Body:
 * - horseId: number (required) - ID of the horse to evaluate
 * - milestoneType: string (required) - Type of milestone (imprinting, socialization, etc.)
 * - groomId: number (optional) - ID of the groom involved
 * - bondScore: number (optional) - Override bond score for evaluation
 * - taskLog: array (optional) - Override task log for evaluation
 * - forceReevaluate: boolean (optional) - Force reevaluation if already completed
 */
router.post(
  '/evaluate-milestone',
  authenticateToken,
  validateMilestoneEvaluation,
  evaluateMilestone
);

/**
 * GET /api/traits/milestone-status/:horseId
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
  getMilestoneStatus
);

/**
 * GET /api/traits/milestone-definitions
 * Get milestone type definitions and developmental windows
 * 
 * Returns:
 * - Milestone types and their developmental windows
 * - Trait thresholds and scoring factors
 * - System configuration information
 */
router.get(
  '/milestone-definitions',
  getMilestoneDefinitions
);

export default router;
