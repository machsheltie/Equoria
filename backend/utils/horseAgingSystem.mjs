/**
 * Horse Aging System
 * Handles automatic horse aging with trait milestone integration
 *
 * 🎯 FEATURES:
 * - Automatic age calculation from dateOfBirth
 * - Daily aging process with birthday detection
 * - Trait milestone evaluation at age 1 (365 days)
 * - Retirement detection at age 21 (7665 days)
 * - Integration with existing cron job system
 * - Batch processing for daily updates
 *
 * 🔧 DEPENDENCIES:
 * - traitEvaluation.mjs (milestone evaluation)
 * - foalTaskLogManager.mjs (task log utilities)
 * - prisma (database operations)
 * - logger (logging)
 *
 * 📋 BUSINESS RULES:
 * - Age calculated as days since dateOfBirth
 * - Birthday triggers age increment and milestone checks
 * - Age 1 milestone (365 days) triggers trait evaluation from task history
 * - Horses retire at age 21 (7665 days)
 * - Age affects training/competition eligibility
 * - Process runs daily via cron job integration
 *
 * 🎯 MILESTONES:
 * - Age 1 (365 days): Epigenetic trait evaluation from foal task history
 * - Age 21 (7665 days): Retirement from competition
 */

import prisma from '../db/index.mjs';
import logger from './logger.mjs';
import { evaluateEpigeneticTagsFromFoalTasks } from './traitEvaluation.mjs';
import { evaluateTraitMilestones, checkMilestoneEligibility } from './milestoneTraitEvaluator.mjs';

/**
 * Calculate age in days from date of birth
 * @param {Date} dateOfBirth - Horse's date of birth
 * @param {Date} currentDate - Current date (default: now)
 * @returns {number} Age in days
 */
export function calculateAgeFromBirth(dateOfBirth, currentDate = new Date()) {
  try {
    const birthTime = new Date(dateOfBirth).getTime();
    const currentTime = currentDate.getTime();

    if (birthTime > currentTime) {
      logger.warn('[horseAgingSystem.calculateAgeFromBirth] Birth date is in the future');
      return 0;
    }

    const diffTime = currentTime - birthTime;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  } catch (error) {
    logger.error(`[horseAgingSystem.calculateAgeFromBirth] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Update a single horse's age based on dateOfBirth
 * @param {number} horseId - Horse ID to update
 * @returns {Object} Update result
 */
export async function updateHorseAge(horseId) {
  try {
    logger.info(`[horseAgingSystem.updateHorseAge] Processing horse ${horseId}`);

    // Get horse data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        age: true,
        taskLog: true,
        daysGroomedInARow: true,
        epigeneticModifiers: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Calculate current age
    const calculatedAge = calculateAgeFromBirth(horse.dateOfBirth);
    const storedAge = horse.age || 0;

    // Check if age needs updating
    if (calculatedAge === storedAge) {
      logger.info(
        `[horseAgingSystem.updateHorseAge] Horse ${horse.name} age is current: ${calculatedAge} days`,
      );
      return {
        horseId,
        horseName: horse.name,
        ageUpdated: false,
        newAge: calculatedAge,
        hadBirthday: false,
        milestonesTriggered: [],
      };
    }

    // Update age in database
    await prisma.horse.update({
      where: { id: horseId },
      data: { age: calculatedAge },
    });

    const hadBirthday = calculatedAge > storedAge;

    logger.info(
      `[horseAgingSystem.updateHorseAge] Updated horse ${horse.name} age: ${storedAge} → ${calculatedAge} days${hadBirthday ? ' (BIRTHDAY!)' : ''}`,
    );

    // Check for milestones if this was a birthday
    let milestoneResult = { milestonesTriggered: [], traitsAssigned: [] };
    if (hadBirthday) {
      milestoneResult = await checkForMilestones(horseId, storedAge, calculatedAge);
    }

    return {
      horseId,
      horseName: horse.name,
      ageUpdated: true,
      newAge: calculatedAge,
      hadBirthday,
      milestonesTriggered: milestoneResult.milestonesTriggered,
      traitsAssigned: milestoneResult.traitsAssigned,
    };
  } catch (error) {
    logger.error(
      `[horseAgingSystem.updateHorseAge] Error processing horse ${horseId}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Check for and process age milestones
 * @param {number} horseId - Horse ID
 * @param {number} previousAge - Previous age in days
 * @param {number} newAge - New age in days
 * @returns {Object} Milestone processing result
 */
export async function checkForMilestones(horseId, previousAge, newAge) {
  try {
    const milestonesTriggered = [];
    let traitsAssigned = [];
    let retirementTriggered = false;

    logger.info(
      `[horseAgingSystem.checkForMilestones] Checking milestones for horse ${horseId}: ${previousAge} → ${newAge} days`,
    );

    // Age 1 milestone (365 days) - Trait evaluation
    // Trigger when crossing the 365-day threshold
    if (previousAge < 365 && newAge >= 365) {
      logger.info(
        `[horseAgingSystem.checkForMilestones] Horse ${horseId} reached age 1 milestone - evaluating traits`,
      );

      try {
        // Get horse data for trait evaluation
        const horse = await prisma.horse.findUnique({
          where: { id: horseId },
          select: {
            id: true,
            name: true,
            taskLog: true,
            daysGroomedInARow: true,
            epigeneticModifiers: true,
          },
        });

        if (horse) {
          // Evaluate traits from foal task history
          const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(
            horse.taskLog || {},
            horse.daysGroomedInARow || 0,
          );

          if (assignedTraits.length > 0) {
            // Add traits to horse's epigenetic modifiers
            const currentModifiers = horse.epigeneticModifiers || {
              positive: [],
              negative: [],
              hidden: [],
            };
            const updatedModifiers = {
              ...currentModifiers,
              epigenetic_tags: assignedTraits,
            };

            await prisma.horse.update({
              where: { id: horseId },
              data: { epigeneticModifiers: updatedModifiers },
            });

            traitsAssigned = assignedTraits;
            logger.info(
              `[horseAgingSystem.checkForMilestones] Assigned ${assignedTraits.length} epigenetic traits to horse ${horse.name}: ${assignedTraits.join(', ')}`,
            );
          } else {
            logger.info(
              `[horseAgingSystem.checkForMilestones] No traits qualified for assignment to horse ${horse.name}`,
            );
          }
        }

        milestonesTriggered.push('age_1_trait_evaluation');
      } catch (error) {
        logger.error(
          `[horseAgingSystem.checkForMilestones] Error in age 1 trait evaluation for horse ${horseId}: ${error.message}`,
        );
      }
    }

    // Enhanced milestone trait evaluation (ages 2 and 3) - New comprehensive system
    const additionalMilestoneAges = [730, 1095]; // 2, 3 years in days

    for (const milestoneAge of additionalMilestoneAges) {
      if (previousAge < milestoneAge && newAge >= milestoneAge) {
        const milestoneYear = Math.floor(milestoneAge / 365);
        logger.info(
          `[horseAgingSystem.checkForMilestones] Horse ${horseId} reached age ${milestoneYear} milestone - evaluating traits`,
        );

        try {
          // Get complete horse data for milestone evaluation
          const horse = await prisma.horse.findUnique({
            where: { id: horseId },
            select: {
              id: true,
              name: true,
              age: true,
              task_log: true,
              taskLog: true, // Legacy field
              daysGroomedInARow: true,
              epigeneticModifiers: true,
              trait_milestones: true,
            },
          });

          if (horse) {
            // Check eligibility for milestone evaluation
            const eligibility = checkMilestoneEligibility(horse);

            if (eligibility.eligible) {
              // Evaluate traits using new milestone system
              const milestoneResult = evaluateTraitMilestones(horse);

              if (milestoneResult.success) {
                // Update horse with new traits and milestone completion
                const updatedModifiers = { ...horse.epigeneticModifiers };

                // Apply new traits from milestone evaluation
                milestoneResult.traitsApplied.forEach(trait => {
                  if (trait.epigenetic) {
                    updatedModifiers.epigenetic = updatedModifiers.epigenetic || [];
                    updatedModifiers.epigenetic.push({
                      name: trait.name,
                      type: trait.type,
                      source: 'milestone_evaluation',
                      milestoneAge: milestoneYear,
                      appliedAt: new Date().toISOString(),
                    });
                  } else if (trait.type === 'resistance') {
                    updatedModifiers.negative = updatedModifiers.negative || [];
                    updatedModifiers.negative.push(trait.name);
                  } else {
                    updatedModifiers.positive = updatedModifiers.positive || [];
                    updatedModifiers.positive.push(trait.name);
                  }
                });

                // Update database with new traits and milestone completion
                await prisma.horse.update({
                  where: { id: horseId },
                  data: {
                    epigeneticModifiers: updatedModifiers,
                    trait_milestones: milestoneResult.updatedMilestones,
                  },
                });

                traitsAssigned = [...traitsAssigned, ...milestoneResult.traitsApplied];
                milestonesTriggered.push(`age_${milestoneYear}_trait_evaluation`);

                logger.info(
                  `[horseAgingSystem.checkForMilestones] Milestone age ${milestoneYear}: Applied ${milestoneResult.traitsApplied.length} traits to horse ${horseId}: ${milestoneResult.traitsApplied.map(t => t.name).join(', ')}`,
                );
              } else {
                logger.info(
                  `[horseAgingSystem.checkForMilestones] Milestone age ${milestoneYear}: No traits applied to horse ${horseId} (${milestoneResult.reason})`,
                );
                milestonesTriggered.push(`age_${milestoneYear}_milestone_checked`);
              }
            } else {
              logger.info(
                `[horseAgingSystem.checkForMilestones] Horse ${horseId} not eligible for age ${milestoneYear} milestone evaluation`,
              );
            }
          }
        } catch (error) {
          logger.error(
            `[horseAgingSystem.checkForMilestones] Error in age ${milestoneYear} trait evaluation for horse ${horseId}: ${error.message}`,
          );
        }
      }
    }

    // Retirement milestone (21 years = 7665 days)
    if (previousAge < 7665 && newAge >= 7665) {
      logger.info(
        `[horseAgingSystem.checkForMilestones] Horse ${horseId} reached retirement age (21 years)`,
      );

      // TODO: Implement retirement logic (remove from competitions, etc.)
      retirementTriggered = true;
      milestonesTriggered.push('retirement');
    }

    // Future milestones can be added here
    // Example: Age 3 (training eligibility), Age 5 (peak performance), etc.

    return {
      milestonesTriggered,
      traitsAssigned,
      retirementTriggered,
    };
  } catch (error) {
    logger.error(`[horseAgingSystem.checkForMilestones] Error: ${error.message}`);
    return {
      milestonesTriggered: [],
      traitsAssigned: [],
      retirementTriggered: false,
    };
  }
}

/**
 * Process all horses for birthday updates (daily cron job function)
 * @param {Object} options - Processing options
 * @returns {Object} Processing results
 */
export async function processHorseBirthdays(options = {}) {
  const startTime = Date.now();
  logger.info('[horseAgingSystem.processHorseBirthdays] Starting daily horse aging process');

  try {
    const { dryRun = false, specificHorseId = null } = options;

    // Build query conditions
    const whereConditions = {};
    if (specificHorseId) {
      whereConditions.id = specificHorseId;
    }

    // Get all horses that need age checking
    const horses = await prisma.horse.findMany({
      where: whereConditions,
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        age: true,
      },
      orderBy: { id: 'asc' },
    });

    if (horses.length === 0) {
      logger.info('[horseAgingSystem.processHorseBirthdays] No horses found for processing');
      return {
        totalProcessed: 0,
        birthdaysFound: 0,
        milestonesTriggered: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    logger.info(
      `[horseAgingSystem.processHorseBirthdays] Processing ${horses.length} horses${dryRun ? ' (DRY RUN)' : ''}`,
    );

    let birthdaysFound = 0;
    let milestonesTriggered = 0;
    let errors = 0;
    const results = [];

    // Process each horse
    for (const horse of horses) {
      try {
        const calculatedAge = calculateAgeFromBirth(horse.dateOfBirth);
        const storedAge = horse.age || 0;

        if (calculatedAge !== storedAge) {
          birthdaysFound++;

          if (!dryRun) {
            const result = await updateHorseAge(horse.id);
            results.push(result);

            if (result.milestonesTriggered.length > 0) {
              milestonesTriggered++;
            }
          } else {
            // Dry run - just log what would happen
            const hadBirthday = calculatedAge > storedAge;
            logger.info(
              `[horseAgingSystem.processHorseBirthdays] DRY RUN: Would update ${horse.name} age: ${storedAge} → ${calculatedAge}${hadBirthday ? ' (BIRTHDAY!)' : ''}`,
            );
          }
        }
      } catch (error) {
        errors++;
        logger.error(
          `[horseAgingSystem.processHorseBirthdays] Error processing horse ${horse.id} (${horse.name}): ${error.message}`,
        );
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[horseAgingSystem.processHorseBirthdays] Completed in ${duration}ms`);
    logger.info(
      `[horseAgingSystem.processHorseBirthdays] Summary: ${horses.length} processed, ${birthdaysFound} birthdays, ${milestonesTriggered} milestones, ${errors} errors`,
    );

    return {
      totalProcessed: horses.length,
      birthdaysFound,
      milestonesTriggered,
      errors,
      duration,
      results: dryRun ? [] : results,
    };
  } catch (error) {
    logger.error(`[horseAgingSystem.processHorseBirthdays] Error: ${error.message}`);
    throw error;
  }
}

export default {
  calculateAgeFromBirth,
  updateHorseAge,
  checkForMilestones,
  processHorseBirthdays,
};
