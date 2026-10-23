/**
 * Enhanced Milestone Evaluation Controller
 *
 * Read-only handlers for the enhanced milestone evaluation system: milestone
 * status and definitions.
 *
 * The evaluateMilestone handler and its validateMilestoneEvaluation chain were
 * removed with POST /milestones/evaluate-milestone (Equoria-gu8jk; owner ruling
 * 2026-10-20: players must never write traits for themselves). The daily
 * milestone job is the only caller of evaluateEnhancedMilestone.
 */

import { param } from 'express-validator';
import {
  MILESTONE_TYPES,
  DEVELOPMENTAL_WINDOWS,
} from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getHorseAgeDays, getHorseAgeYears } from '../../../utils/horseAge.mjs';
import { minActiveAgeYears } from '../../../constants/horseAgePolicy.mjs';

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
        // Under game age 3 (21 days), the age the game shows (Equoria-xggat; was 1095 days)
        eligibleForEvaluation: getHorseAgeYears(horse.dateOfBirth) < minActiveAgeYears,
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

// Validation middleware for horse ID parameter
export const validateHorseIdParam = [
  param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
];
