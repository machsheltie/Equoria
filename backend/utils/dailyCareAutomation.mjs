/**
 * Daily Care Automation System
 * Handles automatic daily care routines for foals with assigned grooms
 */

import prisma from '../db/index.mjs';
import logger from './logger.mjs';
import { calculateGroomInteractionEffects } from './groomSystem.mjs';

/**
 * Daily care routine types and their characteristics
 */
export const DAILY_CARE_ROUTINES = {
  morning_care: {
    name: 'Morning Care',
    interactionType: 'daily_care',
    duration: 45, // minutes
    description: 'Morning feeding, grooming, and health check',
    timeOfDay: 'morning',
    priority: 1,
  },
  feeding: {
    name: 'Feeding',
    interactionType: 'feeding',
    duration: 20,
    description: 'Regular feeding routine',
    timeOfDay: 'multiple',
    priority: 2,
  },
  grooming: {
    name: 'Grooming',
    interactionType: 'grooming',
    duration: 30,
    description: 'Brushing and basic grooming',
    timeOfDay: 'afternoon',
    priority: 3,
  },
  exercise: {
    name: 'Exercise',
    interactionType: 'exercise',
    duration: 60,
    description: 'Light exercise and movement',
    timeOfDay: 'afternoon',
    priority: 4,
  },
  evening_care: {
    name: 'Evening Care',
    interactionType: 'daily_care',
    duration: 30,
    description: 'Evening check-up and settling',
    timeOfDay: 'evening',
    priority: 5,
  },
};

/**
 * Run daily care automation for all active assignments
 * @param {Object} options - Automation options
 * @returns {Object} Automation results
 */
export async function runDailyCareAutomation(options = {}) {
  try {
    const {
      dryRun = false,
      specificFoalId = null,
      routineTypes = Object.keys(DAILY_CARE_ROUTINES),
    } = options;

    logger.info(
      `[dailyCareAutomation.runDailyCareAutomation] Starting daily care automation${dryRun ? ' (DRY RUN)' : ''}`,
    );

    // Get all active groom assignments
    const assignments = await prisma.groomAssignment.findMany({
      where: {
        isActive: true,
        ...(specificFoalId && { foalId: specificFoalId }),
      },
      include: {
        groom: true,
        foal: {
          select: {
            id: true,
            name: true,
            bond_score: true,
            stress_level: true,
            age: true,
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    if (assignments.length === 0) {
      logger.info('[dailyCareAutomation.runDailyCareAutomation] No active assignments found');
      return {
        success: true,
        processed: 0,
        interactions: [],
        message: 'No active groom assignments found',
      };
    }

    const results = [];
    const errors = [];

    // Process each assignment
    for (const assignment of assignments) {
      try {
        // Check if groom is available today
        if (!isGroomAvailableToday(assignment.groom)) {
          logger.debug(`[dailyCareAutomation] Groom ${assignment.groom.name} not available today`);
          continue;
        }

        // Check if daily care already completed today
        const existingCareToday = await checkExistingCareToday(
          assignment.foalId,
          assignment.groomId,
        );
        if (existingCareToday.hasCompleteCare) {
          logger.debug(
            `[dailyCareAutomation] Daily care already completed for foal ${assignment.foal.name}`,
          );
          continue;
        }

        // Determine which routines to perform
        const routinesToPerform = determineRoutinesToPerform(
          routineTypes,
          existingCareToday.completedRoutines,
        );

        if (routinesToPerform.length === 0) {
          logger.debug(`[dailyCareAutomation] No routines needed for foal ${assignment.foal.name}`);
          continue;
        }

        // Perform each routine
        for (const routineType of routinesToPerform) {
          const routine = DAILY_CARE_ROUTINES[routineType];

          if (!dryRun) {
            const interactionResult = await performAutomaticCare(assignment, routine);
            results.push(interactionResult);
          } else {
            // Dry run - just calculate what would happen
            const effects = calculateGroomInteractionEffects(
              assignment.groom,
              assignment.foal,
              routine.interactionType,
              routine.duration,
            );

            results.push({
              foalId: assignment.foalId,
              foalName: assignment.foal.name,
              groomId: assignment.groomId,
              groomName: assignment.groom.name,
              routine: routine.name,
              effects,
              dryRun: true,
            });
          }
        }
      } catch (error) {
        logger.error(
          `[dailyCareAutomation] Error processing assignment ${assignment.id}: ${error.message}`,
        );
        errors.push({
          assignmentId: assignment.id,
          foalName: assignment.foal.name,
          groomName: assignment.groom.name,
          error: error.message,
        });
      }
    }

    const totalInteractions = results.length;
    const totalBondingGain = results.reduce((sum, r) => sum + (r.effects?.bondingChange || 0), 0);
    const totalCost = results.reduce((sum, r) => sum + (r.effects?.cost || 0), 0);

    logger.info(
      `[dailyCareAutomation.runDailyCareAutomation] Completed: ${totalInteractions} interactions, ${totalBondingGain} total bonding gain, $${totalCost.toFixed(2)} total cost`,
    );

    return {
      success: true,
      processed: assignments.length,
      interactions: results,
      errors,
      summary: {
        totalInteractions,
        totalBondingGain,
        totalCost: Math.round(totalCost * 100) / 100,
        errorCount: errors.length,
      },
      message: `Daily care automation completed: ${totalInteractions} interactions performed`,
    };
  } catch (error) {
    logger.error(`[dailyCareAutomation.runDailyCareAutomation] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Perform automatic care routine
 * @param {Object} assignment - Groom assignment
 * @param {Object} routine - Care routine
 * @returns {Object} Interaction result
 */
async function performAutomaticCare(assignment, routine) {
  try {
    // Calculate interaction effects
    const effects = calculateGroomInteractionEffects(
      assignment.groom,
      assignment.foal,
      routine.interactionType,
      routine.duration,
    );

    // Record the interaction
    const interaction = await prisma.groomInteraction.create({
      data: {
        foalId: assignment.foalId,
        groomId: assignment.groomId,
        assignmentId: assignment.id,
        interactionType: routine.interactionType,
        duration: routine.duration,
        bondingChange: effects.bondingChange,
        stressChange: effects.stressChange,
        quality: effects.quality,
        cost: effects.cost,
        notes: `Automatic ${routine.name} - ${routine.description}`,
      },
    });

    // Update foal's bond score and stress level
    const newBondScore = Math.max(
      0,
      Math.min(100, (assignment.foal.bond_score || 50) + effects.bondingChange),
    );
    const newStressLevel = Math.max(
      0,
      Math.min(100, (assignment.foal.stress_level || 0) + effects.stressChange),
    );

    await prisma.horse.update({
      where: { id: assignment.foalId },
      data: {
        bond_score: newBondScore,
        stress_level: newStressLevel,
      },
    });

    logger.debug(
      `[dailyCareAutomation.performAutomaticCare] ${routine.name} completed for ${assignment.foal.name}: +${effects.bondingChange} bonding, ${effects.stressChange} stress`,
    );

    return {
      foalId: assignment.foalId,
      foalName: assignment.foal.name,
      groomId: assignment.groomId,
      groomName: assignment.groom.name,
      routine: routine.name,
      interaction,
      effects,
      foalUpdates: {
        previousBondScore: assignment.foal.bond_score,
        newBondScore,
        previousStressLevel: assignment.foal.stress_level,
        newStressLevel,
      },
    };
  } catch (error) {
    logger.error(`[dailyCareAutomation.performAutomaticCare] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Check if groom is available today
 * @param {Object} groom - Groom object
 * @returns {boolean} Whether groom is available
 */
function isGroomAvailableToday(groom) {
  try {
    if (!groom.is_active) {
      return false;
    }

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[new Date().getDay()];

    // Check availability (default to true if not specified)
    const availability = groom.availability || {};
    return availability[todayName] !== false;
  } catch (error) {
    logger.warn(
      `[dailyCareAutomation.isGroomAvailableToday] Error checking availability: ${error.message}`,
    );
    return true; // Default to available if error
  }
}

/**
 * Check existing care completed today
 * @param {number} foalId - Foal ID
 * @param {number} groomId - Groom ID
 * @returns {Object} Existing care status
 */
async function checkExistingCareToday(foalId, groomId) {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todaysInteractions = await prisma.groomInteraction.findMany({
      where: {
        foalId,
        groomId,
        timestamp: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      select: {
        interactionType: true,
      },
    });

    const completedRoutines = todaysInteractions.map(i => i.interactionType);
    const uniqueRoutines = [...new Set(completedRoutines)];

    // Check if all essential routines are completed
    const essentialRoutines = ['daily_care', 'feeding'];
    const hasCompleteCare = essentialRoutines.every(routine => uniqueRoutines.includes(routine));

    return {
      hasCompleteCare,
      completedRoutines: uniqueRoutines,
      totalInteractions: todaysInteractions.length,
    };
  } catch (error) {
    logger.error(`[dailyCareAutomation.checkExistingCareToday] Error: ${error.message}`);
    return {
      hasCompleteCare: false,
      completedRoutines: [],
      totalInteractions: 0,
    };
  }
}

/**
 * Determine which routines to perform
 * @param {Array} requestedRoutines - Requested routine types
 * @param {Array} completedRoutines - Already completed routine types
 * @returns {Array} Routines to perform
 */
function determineRoutinesToPerform(requestedRoutines, completedRoutines) {
  return requestedRoutines.filter(routineType => {
    const routine = DAILY_CARE_ROUTINES[routineType];
    if (!routine) {
      return false;
    }

    // Don't repeat routines already completed today
    return !completedRoutines.includes(routine.interactionType);
  });
}

/**
 * Schedule daily care automation (for cron jobs)
 * @param {string} schedule - Cron schedule expression
 * @returns {Object} Scheduler result
 */
export function scheduleDailyCareAutomation(schedule = '0 8,14,20 * * *') {
  // This would integrate with a job scheduler like node-cron
  // For now, just return the configuration
  return {
    schedule,
    description: 'Daily care automation at 8 AM, 2 PM, and 8 PM',
    enabled: true,
    handler: runDailyCareAutomation,
  };
}

export default {
  runDailyCareAutomation,
  DAILY_CARE_ROUTINES,
  scheduleDailyCareAutomation,
};
