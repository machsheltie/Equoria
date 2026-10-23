import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import { getHorseXpLevel } from '../../../utils/horseCompetitionLevel.mjs';
import { checkTraitRequirements } from '../../../utils/competitionLogic.mjs';
import { getAllDisciplines } from '../../../utils/statMap.mjs';
import { asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';
import { getUserWithHorses } from '../../users/index.mjs';
import { trainingRefusalReason } from './trainingEligibility.mjs';

/**
 * Log a training session for a horse in a specific discipline
 * @param {Object} trainingData - Training session data
 * @param {number} trainingData.horseId - ID of the horse being trained
 * @param {string} trainingData.discipline - Discipline being trained
 * @returns {Object} - Created training log record
 * @throws {Error} - If validation fails or database error occurs
 */
async function logTrainingSession({ horseId, discipline }) {
  try {
    // Validate required fields
    if (horseId === undefined || horseId === null) {
      throw new Error('Horse ID is required');
    }

    if (!discipline) {
      throw new Error('Discipline is required');
    }

    // Validate horseId is a positive integer
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      throw new Error('Horse ID must be a positive integer');
    }

    logger.info(
      `[trainingModel.logTrainingSession] Logging training session for horse ${parsedHorseId} in ${discipline}`,
    );

    // Insert training log record using Prisma
    const trainingLog = await prisma.trainingLog.create({
      data: {
        horseId: parsedHorseId,
        discipline,
        trainedAt: new Date(),
      },
    });

    logger.info(
      `[trainingModel.logTrainingSession] Successfully logged training session: ID ${trainingLog.id}`,
    );

    return trainingLog;
  } catch (error) {
    logger.error(`[trainingModel.logTrainingSession] Database error: ${error.message}`);
    throw new Error(`Database error: ${error.message}`, { cause: error });
  }
}

/**
 * Get the most recent training date for a horse in a specific discipline
 * @param {number} horseId - ID of the horse
 * @param {string} discipline - Discipline to check
 * @returns {Date|null} - Most recent training date or null if never trained
 * @throws {Error} - If validation fails or database error occurs
 */
async function getLastTrainingDate(horseId, discipline) {
  try {
    // Validate horseId is a positive integer
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      throw new Error('Horse ID must be a positive integer');
    }

    // Validate discipline is provided
    if (!discipline) {
      throw new Error('Discipline is required');
    }

    logger.info(
      `[trainingModel.getLastTrainingDate] Checking last training date for horse ${parsedHorseId} in ${discipline}`,
    );

    // Query for most recent training date using Prisma
    const trainingLog = await prisma.trainingLog.findFirst({
      where: {
        horseId: parsedHorseId,
        discipline,
      },
      orderBy: {
        trainedAt: 'desc',
      },
    });

    if (!trainingLog) {
      logger.info(
        `[trainingModel.getLastTrainingDate] No training records found for horse ${parsedHorseId} in ${discipline}`,
      );
      return null;
    }

    const lastTrainingDate = trainingLog.trainedAt;
    logger.info(
      `[trainingModel.getLastTrainingDate] Last training date for horse ${parsedHorseId} in ${discipline}: ${lastTrainingDate}`,
    );

    return lastTrainingDate;
  } catch (error) {
    logger.error(`[trainingModel.getLastTrainingDate] Database error: ${error.message}`);
    throw new Error(`Database error: ${error.message}`, { cause: error });
  }
}

/**
 * Get the age of a horse from the database
 * @param {number} horseId - ID of the horse
 * @returns {number|null} - Age of the horse or null if horse not found
 * @throws {Error} - If validation fails or database error occurs
 */
async function getHorseAge(horseId) {
  try {
    // Validate horseId is a positive integer
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      throw new Error('Horse ID must be a positive integer');
    }

    logger.info(`[trainingModel.getHorseAge] Getting age for horse ${parsedHorseId}`);

    // Query for horse dateOfBirth using Prisma
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: { dateOfBirth: true },
    });

    if (!horse || !horse.dateOfBirth) {
      logger.info(
        `[trainingModel.getHorseAge] Horse ${parsedHorseId} not found or missing dateOfBirth`,
      );
      return null;
    }

    // Equoria-ffsi: age MUST be canonical game-years (1 game-week = 1
    // game-year, floor(realDays / 7)) — NOT calendar-years. trainingController
    // gates training eligibility on age >= 3; the old /365.25 calendar math
    // wrongly blocked horses that are 3+ game-years old (21+ real days) but
    // < 3 real calendar years. Delegate to the canonical helper.
    const age = getHorseAgeYears(horse.dateOfBirth);

    logger.info(`[trainingModel.getHorseAge] Horse ${parsedHorseId} is ${age} years old`);

    return age;
  } catch (error) {
    logger.error(`[trainingModel.getHorseAge] Database error: ${error.message}`);
    throw new Error(`Database error: ${error.message}`, { cause: error });
  }
}

/**
 * When a horse's training cooldown ends, from Horse.trainingCooldown, the one
 * source of truth (Equoria-w0qb7). The train call claims it atomically
 * (trainingSessionTx), so every reader of "can this horse train yet" asks here
 * instead of inferring it from TrainingLog, which is history only.
 *
 * @param {Date|string|null|undefined} trainingCooldown - the column value
 * @param {Date} [now]
 * @returns {Date|null} the end of the running cooldown, or null when none is running
 */
function activeTrainingCooldownEnd(trainingCooldown, now = new Date()) {
  if (!trainingCooldown) {
    return null;
  }
  const end = new Date(trainingCooldown);
  return Number.isNaN(end.getTime()) || end <= now ? null : end;
}

/**
 * Get the most recent training date for a horse across all disciplines
 * @param {number} horseId - ID of the horse
 * @returns {Date|null} - Most recent training date across all disciplines or null if never trained
 * @throws {Error} - If validation fails or database error occurs
 */
async function getAnyRecentTraining(horseId) {
  try {
    // Validate horseId is a positive integer
    const parsedHorseId = parseInt(horseId, 10);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      throw new Error('Horse ID must be a positive integer');
    }

    logger.info(
      `[trainingModel.getAnyRecentTraining] Checking most recent training date for horse ${parsedHorseId} across all disciplines`,
    );

    // Query for most recent training date across all disciplines using Prisma
    const trainingLog = await prisma.trainingLog.findFirst({
      where: {
        horseId: parsedHorseId,
      },
      orderBy: {
        trainedAt: 'desc',
      },
    });

    if (!trainingLog) {
      logger.info(
        `[trainingModel.getAnyRecentTraining] No training records found for horse ${parsedHorseId}`,
      );
      return null;
    }

    const lastTrainingDate = trainingLog.trainedAt;
    logger.info(
      `[trainingModel.getAnyRecentTraining] Most recent training date for horse ${parsedHorseId}: ${lastTrainingDate} (discipline: ${trainingLog.discipline})`,
    );

    return lastTrainingDate;
  } catch (error) {
    logger.error(`[trainingModel.getAnyRecentTraining] Database error: ${error.message}`);
    throw new Error(`Database error: ${error.message}`, { cause: error });
  }
}

/**
 * Get all horses owned by a user that are eligible for training in at least one discipline
 * @param {string} userId - UUID of the user
 * @returns {Array} - Array of horses with their trainable disciplines
 * @throws {Error} - If validation fails or database error occurs
 */
async function getTrainableHorses(userId) {
  try {
    // Validate input parameters
    if (!userId) {
      throw new Error('User ID is required');
    }

    logger.info(
      `[trainingModelService.getTrainableHorses] Getting trainable horses for user ${userId}`,
    );

    // Get user with their horses
    const player = await getUserWithHorses(userId);

    if (!player) {
      logger.warn(`[trainingModelService.getTrainableHorses] User ${userId} not found`);
      return [];
    }

    if (!player.horses || player.horses.length === 0) {
      logger.info(`[trainingModelService.getTrainableHorses] User ${userId} has no horses`);
      return [];
    }

    // All 24 disciplines — Gaited filtered per horse trait
    const allDisciplines = getAllDisciplines();

    const allHorses = [];

    for (const horse of player.horses) {
      try {
        // Compute age from dateOfBirth — used as primary age signal when dateOfBirth is set
        const computedAge = await getHorseAge(horse.id);

        // Effective age: prefer the stored integer `age` field (the "game age") when
        // computedAge would incorrectly under-count due to a wrong dateOfBirth (e.g.
        // horses created before the dateOfBirth-from-age fix).  Fall back to computedAge
        // if horse.age is absent, then default to 0.
        const effectiveAge =
          horse.age !== null && horse.age !== undefined ? horse.age : (computedAge ?? 0);

        // Gaited is only available if horse has the required trait
        const availableDisciplines = allDisciplines.filter(
          d => d !== 'Gaited' || checkTraitRequirements(horse, 'Gaited'),
        );

        // Equoria-lvjy: ageYears is computed from dateOfBirth at response
        // time (not the cached horse.age column). The legacy `age` field
        // continues to surface the cached/effective integer for backwards
        // compat during the Equoria-son6 → Equoria-x49d rollout.
        // Equoria-7l75: phenotype surfaced for HorseCard.tsx coat-color chip
        // (sibling fix of tkyx for the /horses list endpoint).
        const horseData = {
          id: horse.id,
          horseId: horse.id,
          name: horse.name,
          age: effectiveAge,
          ageYears: getHorseAgeYears(horse.dateOfBirth),
          // horseXp is an Int column, so `.level` off it was always undefined and
          // every horse read as level 1 (Equoria-fdwly). The pinned XP-bracket
          // level is the one the show brackets use.
          level: getHorseXpLevel(horse.horseXp),
          breed: horse.breed?.name ?? null,
          sex: horse.sex ?? null,
          phenotype: horse.phenotype ?? null,
          trainableDisciplines: availableDisciplines,
          // disciplineScores is a Json column: asFlagObject (Equoria-8sic9) so a
          // drifted string/array/null yields [] rather than Object.entries garbage.
          bestDisciplines: Object.entries(asFlagObject(horse.disciplineScores))
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([name]) => name),
          nextEligibleAt: null,
          // The server's verdict, from the same rules the train call applies (age
          // window, injury, Fair-or-better health: Equoria-du9bn), so a client never
          // has to re-derive it. Cooldown is reported by nextEligibleAt below.
          canTrain: true,
          ineligibleReason: null,
        };

        // Age and health refusals use effectiveAge so horses with a stale dateOfBirth
        // but a correct stored age field are not incorrectly blocked
        const refusal = trainingRefusalReason(horse, effectiveAge);
        if (refusal) {
          horseData.canTrain = false;
          horseData.ineligibleReason = refusal;
          horseData.trainableDisciplines = [];
          allHorses.push(horseData);
          continue;
        }

        // Cooldown check: Horse.trainingCooldown is the single source of truth
        // (Equoria-w0qb7); the train call claims that same column.
        const cooldownEnd = activeTrainingCooldownEnd(horse.trainingCooldown);
        if (cooldownEnd) {
          horseData.nextEligibleAt = cooldownEnd.toISOString();
          horseData.canTrain = false;
        }

        allHorses.push(horseData);
      } catch (error) {
        logger.warn(
          `[trainingModelService.getTrainableHorses] Error checking training eligibility for horse ${horse.id}: ${error.message}`,
        );
      }
    }

    logger.info(
      `[trainingModelService.getTrainableHorses] Returning ${allHorses.length} horses for user ${userId}`,
    );
    return allHorses;
  } catch (error) {
    logger.error(
      `[trainingModelService.getTrainableHorses] Error getting trainable horses: ${error.message}`,
    );
    throw new Error(`Failed to get trainable horses: ${error.message}`, { cause: error });
  }
}

export {
  logTrainingSession,
  getLastTrainingDate,
  getHorseAge,
  getAnyRecentTraining,
  getTrainableHorses,
  activeTrainingCooldownEnd,
};
