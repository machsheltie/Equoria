import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

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
    throw new Error(`Database error: ${error.message}`);
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
    throw new Error(`Database error: ${error.message}`);
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

    // Query for horse age using Prisma
    const horse = await prisma.horse.findUnique({
      where: { id: parsedHorseId },
      select: { age: true },
    });

    if (!horse) {
      logger.info(`[trainingModel.getHorseAge] Horse ${parsedHorseId} not found`);
      return null;
    }

    const { age } = horse;
    logger.info(`[trainingModel.getHorseAge] Horse ${parsedHorseId} is ${age} years old`);

    return age;
  } catch (error) {
    logger.error(`[trainingModel.getHorseAge] Database error: ${error.message}`);
    throw new Error(`Database error: ${error.message}`);
  }
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
    throw new Error(`Database error: ${error.message}`);
  }
}

export { logTrainingSession, getLastTrainingDate, getHorseAge, getAnyRecentTraining };
