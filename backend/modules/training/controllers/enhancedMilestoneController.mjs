/**
 * Enhanced Milestone Evaluation Controller
 *
 * Handles API endpoints for the enhanced milestone evaluation system that integrates
 * groom care history, bond consistency, and task diversity into trait determination.
 */

import { body, param, validationResult } from 'express-validator';
import {
  evaluateEnhancedMilestone,
  MILESTONE_TYPES,
  DEVELOPMENTAL_WINDOWS,
} from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';

/**
 * POST /api/milestones/evaluate-milestone
 * Evaluate milestone for a horse with enhanced groom care integration
 */
export async function evaluateMilestone(req, res) {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
        data: null,
      });
    }

    const { horseId, milestoneType, groomId, bondScore, taskLog, forceReevaluate } = req.body;
    const userId = req.user.id;

    logger.info(
      `[enhancedMilestoneController.evaluateMilestone] Evaluating milestone ${milestoneType} for horse ${horseId}`,
    );

    // Validate horse ownership (atomic)
    const horse = await findOwnedResource('horse', horseId, userId);
    if (!horse) {
      return res.status(404).json({
        success: false,
        message: 'Horse not found or you do not own this horse',
        data: null,
      });
    }

    // Validate groom ownership if provided (atomic)
    if (groomId) {
      const groom = await findOwnedResource('groom', groomId, userId);
      if (!groom) {
        return res.status(404).json({
          success: false,
          message: 'Groom not found or you do not own this groom',
          data: null,
        });
      }
    }

    // Perform milestone evaluation
    const evaluationResult = await evaluateEnhancedMilestone(horseId, milestoneType, {
      forceReevaluate: forceReevaluate || false,
      providedBondScore: bondScore,
      providedTaskLog: taskLog,
    });

    if (!evaluationResult.success) {
      return res.status(400).json({
        success: false,
        message: evaluationResult.reason,
        data: evaluationResult,
      });
    }

    // Return successful evaluation
    return res.status(200).json({
      success: true,
      message: 'Milestone evaluation completed successfully',
      data: {
        horseId,
        horseName: horse.name,
        milestoneType,
        finalTrait: evaluationResult.traitOutcome.trait,
        traitType: evaluationResult.traitOutcome.type,
        finalScore: evaluationResult.finalScore,
        modifiersApplied: evaluationResult.modifiers,
        reasoning: evaluationResult.traitOutcome.reasoning,
        milestoneLogId: evaluationResult.milestoneLog.id,
        groomCareHistory: {
          totalInteractions: evaluationResult.groomCareHistory.totalInteractions,
          taskDiversity: evaluationResult.groomCareHistory.taskDiversity,
          taskConsistency: evaluationResult.groomCareHistory.taskConsistency,
          averageQuality: evaluationResult.groomCareHistory.averageQuality,
        },
      },
    });
  } catch (error) {
    logger.error(`[enhancedMilestoneController.evaluateMilestone] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during milestone evaluation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      data: null,
    });
  }
}

/**
 * GET /api/milestones/milestone-status/:horseId
 * Get milestone evaluation status for a horse
 */
export async function getMilestoneStatus(req, res) {
  try {
    // Horse ownership already validated by requireOwnership middleware
    // Middleware caches validated horse in req.validatedResources
    const horse = req.validatedResources?.horse;
    if (!horse) {
      logger.error(
        '[enhancedMilestoneController.getMilestoneStatus] Horse not found in validated resources',
      );
      return res.status(404).json({
        success: false,
        message: 'Horse not found or you do not own this horse',
        data: null,
      });
    }

    const parsedHorseId = horse.id;

    // Calculate horse age in days
    const ageInDays = getHorseAgeDays(horse.dateOfBirth);

    // Get existing milestone evaluations
    const milestoneEvaluations = await prisma.milestoneTraitLog.findMany({
      where: { horseId: parsedHorseId },
      orderBy: { timestamp: 'desc' },
    });

    // Determine available milestones based on age
    const availableMilestones = [];
    const completedMilestones = milestoneEvaluations.map(m => m.milestoneType);

    for (const [milestoneType, window] of Object.entries(DEVELOPMENTAL_WINDOWS)) {
      const isInWindow = ageInDays >= window.start && ageInDays <= window.end;
      const isCompleted = completedMilestones.includes(milestoneType);
      const isPastWindow = ageInDays > window.end;

      availableMilestones.push({
        milestoneType,
        window,
        isInWindow,
        isCompleted,
        isPastWindow,
        canEvaluate: isInWindow && !isCompleted,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Milestone status retrieved successfully',
      data: {
        horseId: parsedHorseId,
        horseName: horse.name,
        ageInDays,
        availableMilestones,
        completedEvaluations: milestoneEvaluations,
        totalCompleted: milestoneEvaluations.length,
        eligibleForEvaluation: ageInDays < 1095, // Under 3 years
      },
    });
  } catch (error) {
    logger.error(`[enhancedMilestoneController.getMilestoneStatus] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving milestone status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      data: null,
    });
  }
}

/**
 * GET /api/milestones/milestone-definitions
 * Get milestone type definitions and developmental windows
 */
export async function getMilestoneDefinitions(req, res) {
  try {
    return res.status(200).json({
      success: true,
      message: 'Milestone definitions retrieved successfully',
      data: {
        milestoneTypes: MILESTONE_TYPES,
        developmentalWindows: DEVELOPMENTAL_WINDOWS,
        traitThresholds: {
          confirm: 3,
          deny: -3,
        },
        scoringFactors: {
          bondModifier: 'Based on average bond score during window (-2 to +2)',
          taskConsistency: 'Based on task completion and diversity (+0 to +3)',
          careGapsPenalty: 'Penalty for missed care or low bond (-0 to -2)',
        },
      },
    });
  } catch (error) {
    logger.error(`[enhancedMilestoneController.getMilestoneDefinitions] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving milestone definitions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      data: null,
    });
  }
}

// Validation middleware for milestone evaluation.
//
// Equoria-8x1i5: the milestoneType allow-list is evaluated LAZILY (inside a
// .custom() that runs at request time) rather than eagerly via
// `.isIn(Object.values(MILESTONE_TYPES))` at module-init. The eager form
// dereferenced the cross-module `MILESTONE_TYPES` binding while this module's
// graph was still initializing under certain import orders (e.g. when a test
// imports cronJobs.mjs / horseAgingSystem.mjs as the graph entry point, which
// pulls enhancedMilestoneEvaluationSystem.mjs -> the traits barrel -> back to
// this controller before MILESTONE_TYPES is initialized), producing a
// "Cannot access 'MILESTONE_TYPES' before initialization" TDZ crash that took
// down ALL cron test suites. Deferring the dereference to request time breaks
// that module-init dependency without changing the validation behaviour: an
// out-of-range milestoneType still fails with the identical 400 message.
export const validateMilestoneEvaluation = [
  body('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
  body('milestoneType').custom(value => {
    const allowed = Object.values(MILESTONE_TYPES);
    if (!allowed.includes(value)) {
      throw new Error(`Milestone type must be one of: ${allowed.join(', ')}`);
    }
    return true;
  }),
  body('groomId').optional().isInt({ min: 1 }).withMessage('Groom ID must be a positive integer'),
  body('bondScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Bond score must be between 0 and 100'),
  body('taskLog').optional().isArray().withMessage('Task log must be an array'),
  body('forceReevaluate').optional().isBoolean().withMessage('Force reevaluate must be a boolean'),
];

// Validation middleware for horse ID parameter
export const validateHorseIdParam = [
  param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
];
