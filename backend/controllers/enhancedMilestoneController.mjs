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
} from '../utils/enhancedMilestoneEvaluationSystem.mjs';
import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * POST /api/traits/evaluate-milestone
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

    logger.info(`[enhancedMilestoneController.evaluateMilestone] Evaluating milestone ${milestoneType} for horse ${horseId}`);

    // Validate horse exists and user owns it
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        dateOfBirth: true,
        bondScore: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: `Horse with ID ${horseId} not found`,
        data: null,
      });
    }

    // Check ownership (assuming req.user is set by auth middleware)
    if (req.user && horse.ownerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to evaluate milestones for this horse',
        data: null,
      });
    }

    // Validate groom exists if provided
    if (groomId) {
      const groom = await prisma.groom.findUnique({
        where: { id: groomId },
        select: { id: true, name: true, userId: true },
      });

      if (!groom) {
        return res.status(404).json({
          success: false,
          message: `Groom with ID ${groomId} not found`,
          data: null,
        });
      }

      // Check groom ownership
      if (req.user && groom.userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to use this groom',
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
 * GET /api/traits/milestone-status/:horseId
 * Get milestone evaluation status for a horse
 */
export async function getMilestoneStatus(req, res) {
  try {
    const { horseId } = req.params;
    const parsedHorseId = parseInt(horseId, 10);

    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID. Must be a positive integer.',
        data: null,
      });
    }

    // Get horse data
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: {
        id: true,
        name: true,
        userId: true,
        dateOfBirth: true,
      },
    });

    if (!horse) {
      return res.status(404).json({
        success: false,
        message: `Horse with ID ${horseId} not found`,
        data: null,
      });
    }

    // Check ownership
    if (req.user && horse.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this horse',
        data: null,
      });
    }

    // Calculate horse age in days
    const ageInDays = Math.floor((Date.now() - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24));

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
 * GET /api/traits/milestone-definitions
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

// Validation middleware for milestone evaluation
export const validateMilestoneEvaluation = [
  body('horseId')
    .isInt({ min: 1 })
    .withMessage('Horse ID must be a positive integer'),
  body('milestoneType')
    .isIn(Object.values(MILESTONE_TYPES))
    .withMessage(`Milestone type must be one of: ${Object.values(MILESTONE_TYPES).join(', ')}`),
  body('groomId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Groom ID must be a positive integer'),
  body('bondScore')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Bond score must be between 0 and 100'),
  body('taskLog')
    .optional()
    .isArray()
    .withMessage('Task log must be an array'),
  body('forceReevaluate')
    .optional()
    .isBoolean()
    .withMessage('Force reevaluate must be a boolean'),
];

// Validation middleware for horse ID parameter
export const validateHorseIdParam = [
  param('horseId')
    .isInt({ min: 1 })
    .withMessage('Horse ID must be a positive integer'),
];
