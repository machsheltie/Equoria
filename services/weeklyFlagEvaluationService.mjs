/**
 * Weekly Flag Evaluation Service
 *
 * Automated weekly flag evaluation system for horses 0-3 years old.
 * Analyzes care patterns, bond trends, and stress patterns to assign epigenetic flags.
 *
 * Business Rules:
 * - Only evaluates horses under 3 years old (1095 days)
 * - Maximum 5 flags per horse
 * - Pattern recognition for care consistency, bond trends, stress patterns
 * - Integration with existing groom interaction and assignment data
 * - Weekly automation through horse aging system integration
 */

import prisma from '../packages/database/prismaClient.mjs';
import logger from '../backend/utils/logger.mjs';
import { EPIGENETIC_FLAG_DEFINITIONS } from '../config/epigeneticFlagDefinitions.mjs';
import { analyzeCarePatterns } from './carePatternAnalyzer.mjs';
import { evaluateFlagTriggers } from './flagAssignmentEngine.mjs';

/**
 * Get all horses eligible for flag evaluation (under 3 years old)
 * @returns {Array} Array of horses eligible for flag evaluation
 */
export async function getEligibleHorsesForFlagEvaluation() {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 1095); // 3 years in days

    const eligibleHorses = await prisma.horse.findMany({
      where: {
        dateOfBirth: {
          gte: threeDaysAgo, // Born within last 3 years
        },
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
        groomAssignments: {
          include: {
            groom: {
              select: { id: true, name: true, groomPersonality: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
          take: 5, // Recent assignments
        },
      },
    });

    logger.info(`Found ${eligibleHorses.length} horses eligible for flag evaluation`);
    return eligibleHorses;
  } catch (error) {
    logger.error('Error getting eligible horses for flag evaluation:', error);
    throw error;
  }
}

/**
 * Process a single horse for flag evaluation
 * @param {number} horseId - ID of the horse to evaluate
 * @returns {Object} Evaluation result with flags assigned and patterns analyzed
 */
export async function processHorseForFlagEvaluation(horseId) {
  try {
    // Get horse with current flags
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      include: {
        groomAssignments: {
          include: {
            groom: true,
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Check if horse already has maximum flags
    const currentFlags = horse.epigeneticFlags || [];
    if (currentFlags.length >= 5) {
      return {
        horseId,
        evaluated: true,
        flagsAssigned: [],
        reason: 'Horse already has maximum 5 flags',
        currentFlags,
      };
    }

    // Calculate horse age in days
    const ageInDays = Math.floor(
      (Date.now() - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24)
    );

    // Skip if horse is over 3 years old
    if (ageInDays > 1095) {
      return {
        horseId,
        evaluated: false,
        reason: 'Horse is over 3 years old',
        ageInDays,
      };
    }

    // Analyze care patterns
    const carePatterns = await analyzeCarePatterns(horseId);

    // Evaluate flag triggers based on patterns
    const flagEvaluation = await evaluateFlagTriggers(horse, carePatterns);

    // Assign new flags if triggers are met
    const newFlags = [];
    const flagsConsidered = [];

    for (const flagName of flagEvaluation.eligibleFlags) {
      if (currentFlags.length + newFlags.length >= 5) {
        break; // Respect maximum flag limit
      }

      if (!currentFlags.includes(flagName) && !newFlags.includes(flagName)) {
        const flagDef = EPIGENETIC_FLAG_DEFINITIONS[flagName.toUpperCase()];
        if (flagDef) {
          newFlags.push(flagName);
          flagsConsidered.push({
            flag: flagName,
            triggerMet: true,
            conditions: flagEvaluation.triggerConditions[flagName],
          });
        }
      }
    }

    // Update horse with new flags if any
    if (newFlags.length > 0) {
      const updatedFlags = [...currentFlags, ...newFlags];
      await prisma.horse.update({
        where: { id: horseId },
        data: {
          epigeneticFlags: updatedFlags,
        },
      });

      logger.info(
        `Assigned ${newFlags.length} new flags to horse ${horse.name}: ${newFlags.join(', ')}`
      );
    }

    return {
      horseId,
      horseName: horse.name,
      evaluated: true,
      ageInDays,
      carePatterns,
      flagsConsidered,
      flagsAssigned: newFlags,
      currentFlags: [...currentFlags, ...newFlags],
      bondLevel: horse.bondLevel,
      stressLevel: horse.stressLevel,
    };
  } catch (error) {
    logger.error(`Error processing horse ${horseId} for flag evaluation:`, error);
    return {
      horseId,
      evaluated: false,
      error: error.message,
    };
  }
}

/**
 * Main weekly flag evaluation function
 * Processes all eligible horses and assigns flags based on care patterns
 * @returns {Object} Summary of evaluation results
 */
export async function evaluateWeeklyFlags() {
  try {
    logger.info('Starting weekly flag evaluation process');

    const eligibleHorses = await getEligibleHorsesForFlagEvaluation();
    const results = {
      totalHorsesEvaluated: eligibleHorses.length,
      flagsAssigned: 0,
      horsesProcessed: [],
      errors: [],
      timestamp: new Date(),
    };

    // Process each eligible horse
    for (const horse of eligibleHorses) {
      try {
        const evaluation = await processHorseForFlagEvaluation(horse.id);
        results.horsesProcessed.push(evaluation);

        if (evaluation.flagsAssigned) {
          results.flagsAssigned += evaluation.flagsAssigned.length;
        }
      } catch (error) {
        logger.error(`Error evaluating horse ${horse.id}:`, error);
        results.errors.push({
          horseId: horse.id,
          horseName: horse.name,
          error: error.message,
        });
      }
    }

    logger.info(
      `Weekly flag evaluation completed: ${results.flagsAssigned} flags assigned to ${results.totalHorsesEvaluated} horses`
    );
    return results;
  } catch (error) {
    logger.error('Error in weekly flag evaluation:', error);
    throw error;
  }
}

/**
 * Integration point for horse aging system
 * Called during daily aging process to trigger weekly flag evaluation
 * @returns {Object} Evaluation results if it's time for weekly evaluation
 */
export async function triggerWeeklyFlagEvaluation() {
  try {
    // Check if it's time for weekly evaluation (could be based on day of week or interval)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Run weekly evaluation on Mondays (day 1)
    if (dayOfWeek === 1) {
      return await evaluateWeeklyFlags();
    }

    return {
      skipped: true,
      reason: 'Not scheduled for weekly evaluation',
      nextEvaluation: 'Next Monday',
    };
  } catch (error) {
    logger.error('Error triggering weekly flag evaluation:', error);
    throw error;
  }
}
