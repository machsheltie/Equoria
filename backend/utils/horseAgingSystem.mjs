/**
 * Horse Aging System
 * Handles automatic horse aging with trait milestone integration
 *
 * 🎯 FEATURES:
 * - Automatic age calculation from dateOfBirth
 * - Daily aging process with birthday detection
 * - Trait milestone evaluation at age 1 (7 days)
 * - Retirement detection at age 21 (147 days)
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
 * - Age calculated as days since dateOfBirth (1 year = 7 days)
 * - Birthday triggers age increment and milestone checks
 * - Age 1 milestone (7 days) triggers trait evaluation from task history
 * - Horses retire at age 21 (147 days)
 * - Age affects training/competition eligibility
 * - Process runs daily via cron job integration
 *
 * 🎯 MILESTONES:
 * - Age 1 (7 days): Epigenetic trait evaluation from foal task history
 * - Age 21 (147 days): Retirement from competition
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';
import { evaluateEpigeneticTagsFromFoalTasks } from './traitEvaluation.mjs';
import {
  evaluateEnhancedMilestone,
  DEVELOPMENTAL_WINDOWS,
  MILESTONE_TYPES,
} from './enhancedMilestoneEvaluationSystem.mjs';
import { getHorseAgeDays } from './horseAge.mjs';
import { setEpigeneticModifiersKey } from '../modules/traits/index.mjs';
import { writeBirthdayTx } from '../modules/horses/index.mjs';

/** The epigeneticModifiers key the age-1 milestone records its tags under. */
export const ageOneTagsKey = 'epigenetic_tags';

/**
 * GAME-DESIGN UNIT CONTRACT (Equoria-son6 / Equoria-j9ip):
 *   1 real-time week (7 days) = 1 game year.
 *   Horse.age column stores GAME YEARS, not real-time days.
 *
 * `calculateAgeFromBirth()` returns real-time DAYS (used by internal cron
 * milestone-day-threshold logic and any callers that want fine granularity).
 *
 * `calculateAgeInGameYears()` is what gets persisted to Horse.age:
 *   floor(real-time-days / 7).
 *
 * Pre-fix bug: `updateHorseAge` wrote calculateAgeFromBirth() (days) directly
 * to Horse.age. Every controller/serializer/frontend in the codebase treats
 * Horse.age as game years (e.g. "horse.age < 3" means under 3 game years).
 * The mismatch produced 1111-year displays for users.
 */

const DAYS_PER_GAME_YEAR = 7;

/**
 * Calculate age in REAL-TIME days from date of birth.
 * Used internally by milestone day-threshold checks (7, 14, 21, 147 days).
 * Equoria-kha18: whole Eastern game days (getHorseAgeDays), never a
 * millisecond delta, which ran a day ahead of the date-only dob from 20:00 ET.
 *
 * @param {Date} dateOfBirth - Horse's date of birth
 * @param {Date} currentDate - Current date (default: now)
 * @returns {number} Age in real-time days
 */
export function calculateAgeFromBirth(dateOfBirth, currentDate = new Date()) {
  try {
    const birthTime = new Date(dateOfBirth).getTime();
    const currentTime = currentDate.getTime();

    if (birthTime > currentTime) {
      logger.warn('[horseAgingSystem.calculateAgeFromBirth] Birth date is in the future');
      return 0;
    }

    return getHorseAgeDays(dateOfBirth, currentDate);
  } catch (error) {
    logger.error(`[horseAgingSystem.calculateAgeFromBirth] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Calculate age in GAME YEARS from date of birth.
 * This is the value persisted to Horse.age. 1 game year = 7 real-time days.
 *
 * @param {Date} dateOfBirth - Horse's date of birth
 * @param {Date} currentDate - Current date (default: now)
 * @returns {number} Age in game years (floor(days/7))
 */
export function calculateAgeInGameYears(dateOfBirth, currentDate = new Date()) {
  const ageInDays = calculateAgeFromBirth(dateOfBirth, currentDate);
  return Math.floor(ageInDays / DAYS_PER_GAME_YEAR);
}

/** Lower bound, in days, of the game-year bucket a horse is stored in. */
const previousAgeInDays = storedAge => storedAge * DAYS_PER_GAME_YEAR;

/** True when the age moved from `previousDays` to `newDays` across `threshold` days. */
const crossesThreshold = (previousDays, newDays, threshold) =>
  previousDays < threshold && newDays >= threshold;

const ageOneMilestoneDays = 7;
const retirementMilestoneDays = 147;

/**
 * Whether a birthday from `storedAge` to a horse now `ageInDays` old triggers an
 * age milestone (age-1 trait evaluation, retirement). Mirrors the day-threshold
 * tests in checkForMilestones; a horse that crosses neither needs only its age
 * column written.
 */
function birthdayHasMilestone(storedAge, ageInDays) {
  const previousDays = previousAgeInDays(storedAge);
  return (
    crossesThreshold(previousDays, ageInDays, ageOneMilestoneDays) ||
    crossesThreshold(previousDays, ageInDays, retirementMilestoneDays)
  );
}

/**
 * Update a single horse's age based on dateOfBirth
 * @param {number} horseId - Horse ID to update
 * @param {Object|null} knownHorse - The horse's {id, name, dateOfBirth, age} when the
 *   caller already holds it (the nightly scan does); skips a second read of the same row.
 * @returns {Object} Update result
 */
export async function updateHorseAge(horseId, knownHorse = null) {
  logger.info(`[horseAgingSystem.updateHorseAge] Processing horse ${horseId}`);

  // Get horse data
  const horse =
    knownHorse ??
    (await prisma.horse.findUnique({
      where: { id: horseId },
      select: { id: true, name: true, dateOfBirth: true, age: true },
    }));

  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  // Compute both day-granular age (for milestone day-threshold checks) and
  // game-year age (the value persisted to Horse.age). Equoria-son6: previously
  // the days value was written directly to Horse.age, producing 1111-year
  // displays since the rest of the codebase reads Horse.age as game-years.
  const ageInDays = calculateAgeFromBirth(horse.dateOfBirth);
  const calculatedAge = Math.floor(ageInDays / DAYS_PER_GAME_YEAR); // game-years
  const storedAge = horse.age || 0;

  // Check if age needs updating
  if (calculatedAge === storedAge) {
    logger.info(
      `[horseAgingSystem.updateHorseAge] Horse ${horse.name} age is current: ${calculatedAge} game-years (${ageInDays} days)`,
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

  // Update age in database (game-years, not days — Equoria-son6 fix). A 21st
  // birthday also releases the horse's staff in the same transaction unless it
  // is in foal (Equoria-6p398.14, owner rulings 2026-10-23).
  const hadBirthday = calculatedAge > storedAge;
  const retiring =
    hadBirthday &&
    crossesThreshold(previousAgeInDays(storedAge), ageInDays, retirementMilestoneDays);
  await prisma.$transaction(tx => writeBirthdayTx(tx, { horseId, age: calculatedAge, retiring }));

  logger.info(
    `[horseAgingSystem.updateHorseAge] Updated horse ${horse.name} age: ${storedAge} → ${calculatedAge} game-years (${ageInDays} days)${hadBirthday ? ' (BIRTHDAY!)' : ''}`,
  );

  // Check for milestones if this was a birthday. We pass the previous and
  // current day-equivalents so milestone day-threshold logic (7, 14, 21,
  // 147 days) keeps working at fine granularity. The previous day-equivalent
  // is `storedAge * DAYS_PER_GAME_YEAR` (lower bound of the previous game-year
  // bucket); the current day-equivalent is `ageInDays`.
  let milestoneResult = { milestonesTriggered: [], traitsAssigned: [] };
  if (hadBirthday) {
    milestoneResult = await checkForMilestones(horseId, previousAgeInDays(storedAge), ageInDays);
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

    // Age 1 milestone (7 days) - Trait evaluation
    // Trigger when crossing the 7-day threshold
    if (crossesThreshold(previousAge, newAge, ageOneMilestoneDays)) {
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
          },
        });

        if (horse) {
          // Evaluate traits from foal task history
          const assignedTraits = evaluateEpigeneticTagsFromFoalTasks(
            horse.taskLog || {},
            horse.daysGroomedInARow || 0,
          );

          if (assignedTraits.length > 0) {
            // Equoria-m1sf8: set only this milestone's key, in one statement
            // against the row's current value, so a trait revealed since the
            // read above is kept.
            await setEpigeneticModifiersKey(prisma, horseId, ageOneTagsKey, assignedTraits);

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

    // Age 2/3 milestone trait evaluation (14/21 real-time days) is NOT handled
    // here. Equoria-bvddn.16: the code that used to live in this branch called
    // prisma.horse.findUnique({ select: { task_log, trait_milestones, ... } }) —
    // neither field exists on the Horse model (schema has `taskLog` and no
    // `trait_milestones` column at all), so every invocation threw a
    // PrismaClientValidationError that the surrounding try/catch swallowed
    // into a log line. The equivalent developmental windows (8-14 real-time
    // days = age 2, 15-21 real-time days = age 3 — see
    // enhancedMilestoneEvaluationSystem.DEVELOPMENTAL_WINDOWS
    // CURIOSITY_PLAY/TRUST_HANDLING) are evaluated for real by the daily
    // `dailyMilestoneJob` cron (backend/services/jobs/dailyMilestoneJob.mjs ->
    // processFoalMilestones -> processFoalMilestoneEvaluations below in this
    // file -> evaluateEnhancedMilestone), which reads real Horse columns
    // (dateOfBirth, groomAssignments) and persists to the real
    // MilestoneTraitLog table. That path was deleted rather than repaired.

    // Retirement milestone (21 years = 147 days)
    if (crossesThreshold(previousAge, newAge, retirementMilestoneDays)) {
      // Retirement enforcement is implicit: competition entry for horses over
      // 20 game-years is refused by the shared entry rules
      // (backend/utils/competitionEntryRules.mjs ageRefusal → AGE_TOO_OLD).
      // No Horse.retired flag is
      // persisted here — a stored flag duplicating the age-derived gate would
      // have to be kept in sync with it and could drift. This milestone's job
      // is to make the retirement event observable.
      const retiree = await prisma.horse.findUnique({
        where: { id: horseId },
        select: { name: true, age: true },
      });
      logger.info('[horseAgingSystem.checkForMilestones] Retirement milestone reached', {
        event: 'horse_retirement',
        horseId,
        name: retiree?.name ?? 'unknown',
        age: retiree?.age ?? Math.floor(newAge / DAYS_PER_GAME_YEAR),
        ageInDays: newAge,
      });

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

  const { dryRun = false, specificHorseId = null, horseIds = null } = options;

  // Build query conditions
  const whereConditions = {};
  if (specificHorseId) {
    whereConditions.id = specificHorseId;
  } else if (horseIds && Array.isArray(horseIds) && horseIds.length > 0) {
    whereConditions.id = { in: horseIds };
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
  // Results are kept in scan order; plain birthdays fill their slot after the
  // batched write below.
  const resultSlots = [];
  // Birthdays with no milestone write only `age`: group them by new age so each
  // age is ONE updateMany (Equoria-cmw85.27).
  const plainBirthdaysByAge = new Map();

  // Process each horse
  for (const [index, horse] of horses.entries()) {
    try {
      // Compare game-years (the unit persisted to Horse.age) — Equoria-son6
      const ageInDays = calculateAgeFromBirth(horse.dateOfBirth);
      const calculatedAge = Math.floor(ageInDays / DAYS_PER_GAME_YEAR);
      const storedAge = horse.age || 0;

      if (calculatedAge !== storedAge) {
        birthdaysFound++;

        if (!dryRun) {
          const hadBirthday = calculatedAge > storedAge;
          if (hadBirthday && birthdayHasMilestone(storedAge, ageInDays)) {
            // Milestone writes differ per horse: keep the individual path, but
            // hand it the row the scan already read.
            const result = await updateHorseAge(horse.id, horse);
            resultSlots[index] = result;

            if (result.milestonesTriggered.length > 0) {
              milestonesTriggered++;
            }
          } else {
            if (!plainBirthdaysByAge.has(calculatedAge)) {
              plainBirthdaysByAge.set(calculatedAge, []);
            }
            plainBirthdaysByAge.get(calculatedAge).push({ index, horse, hadBirthday });
          }
        } else {
          // Dry run - just log what would happen
          const hadBirthday = calculatedAge > storedAge;
          logger.info(
            `[horseAgingSystem.processHorseBirthdays] DRY RUN: Would update ${horse.name} age: ${storedAge} → ${calculatedAge} game-years (${ageInDays}d)${hadBirthday ? ' (BIRTHDAY!)' : ''}`,
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

  for (const [newAge, group] of plainBirthdaysByAge) {
    try {
      await prisma.horse.updateMany({
        where: { id: { in: group.map(entry => entry.horse.id) } },
        data: { age: newAge },
      });
      logger.info(
        `[horseAgingSystem.processHorseBirthdays] Aged ${group.length} horses to ${newAge} game-years in one update`,
      );
      for (const { index, horse, hadBirthday } of group) {
        resultSlots[index] = {
          horseId: horse.id,
          horseName: horse.name,
          ageUpdated: true,
          newAge,
          hadBirthday,
          milestonesTriggered: [],
          traitsAssigned: [],
        };
      }
    } catch (error) {
      errors += group.length;
      logger.error(
        `[horseAgingSystem.processHorseBirthdays] Error aging ${group.length} horses to ${newAge}: ${error.message}`,
      );
    }
  }
  const results = resultSlots.filter(Boolean);

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
}

/**
 * Equoria-3yxz: Daily cron pass that fires MilestoneTraitLog writes for
 * every foal that has just entered (and not yet been evaluated for) a
 * developmental window from enhancedMilestoneEvaluationSystem.DEVELOPMENTAL_WINDOWS.
 *
 * Without this, the system relies on the manual POST /api/v1/milestones/evaluate-milestone
 * endpoint — meaning a foal's developmental milestones never trigger organically
 * and the MilestoneTraitLog table stays empty for most accounts.
 *
 * Algorithm:
 *   1. Find horses born within the last 30 days (covers all five windows
 *      0-28d with a small safety margin).
 *   2. For each, compute ageInDays and identify any window whose [start,end]
 *      includes that day.
 *   3. For each matching window: if no existing MilestoneTraitLog row exists
 *      for (horseId, milestoneType), call evaluateEnhancedMilestone — which
 *      writes the row (or returns a 'already evaluated' / 'window mismatch'
 *      reason that we tally rather than treat as error).
 *
 * @param {Object} options - { dryRun, specificHorseId }
 * @returns {Promise<Object>} { totalProcessed, milestonesEvaluated, milestonesSkipped, errors, duration }
 */
export async function processFoalMilestoneEvaluations(options = {}) {
  const startTime = Date.now();
  const { dryRun = false, specificHorseId = null } = options;

  logger.info(
    '[horseAgingSystem.processFoalMilestoneEvaluations] Starting daily foal milestone evaluation pass',
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const where = specificHorseId ? { id: specificHorseId } : { dateOfBirth: { gte: cutoff } };

  const foals = await prisma.horse.findMany({
    where,
    select: { id: true, name: true, dateOfBirth: true },
    orderBy: { id: 'asc' },
  });

  let milestonesEvaluated = 0;
  let milestonesSkipped = 0;
  let errors = 0;

  for (const foal of foals) {
    // Equoria-kha18: whole Eastern game days, as evaluateEnhancedMilestone reads it.
    // A millisecond delta from the date-only dob ran a day ahead from 20:00 ET.
    const ageInDays = getHorseAgeDays(foal.dateOfBirth);

    for (const milestoneType of Object.values(MILESTONE_TYPES)) {
      const window = DEVELOPMENTAL_WINDOWS[milestoneType];
      if (!window || ageInDays < window.start || ageInDays > window.end) {
        continue;
      }

      try {
        const existing = await prisma.milestoneTraitLog.findFirst({
          where: { horseId: foal.id, milestoneType },
          select: { id: true },
        });
        if (existing) {
          milestonesSkipped++;
          continue;
        }

        if (dryRun) {
          logger.info(
            `[horseAgingSystem.processFoalMilestoneEvaluations] DRY RUN: would evaluate milestone '${milestoneType}' for foal ${foal.id} (${foal.name}, ${ageInDays}d)`,
          );
          milestonesEvaluated++;
          continue;
        }

        const result = await evaluateEnhancedMilestone(foal.id, milestoneType);
        if (result?.success === false) {
          milestonesSkipped++;
          logger.info(
            `[horseAgingSystem.processFoalMilestoneEvaluations] Skipped ${milestoneType} for foal ${foal.id}: ${result.reason}`,
          );
        } else {
          milestonesEvaluated++;
        }
      } catch (error) {
        errors++;
        logger.error(
          `[horseAgingSystem.processFoalMilestoneEvaluations] Error evaluating ${milestoneType} for foal ${foal.id}: ${error.message}`,
        );
      }
    }
  }

  const duration = Date.now() - startTime;
  logger.info(
    `[horseAgingSystem.processFoalMilestoneEvaluations] Completed in ${duration}ms — foals checked: ${foals.length}, evaluated: ${milestonesEvaluated}, skipped: ${milestonesSkipped}, errors: ${errors}`,
  );

  return {
    totalProcessed: foals.length,
    milestonesEvaluated,
    milestonesSkipped,
    errors,
    duration,
  };
}

export default {
  calculateAgeFromBirth,
  calculateAgeInGameYears,
  updateHorseAge,
  checkForMilestones,
  processHorseBirthdays,
  processFoalMilestoneEvaluations,
};
