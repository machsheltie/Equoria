import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Save a competition result to the database
 * @param {Object} resultData - Result data object
 * @param {number} resultData.horseId - Horse ID
 * @param {number} resultData.showId - Show ID
 * @param {number} resultData.score - Competition score
 * @param {string|null} resultData.placement - Placement ("1st", "2nd", "3rd", or null)
 * @param {string} resultData.discipline - Competition discipline
 * @param {Date} resultData.runDate - Date when the show was run
 * @param {string} resultData.showName - Name of the show for history
 * @param {number} resultData.prizeWon - Prize amount won (default 0)
 * @param {Object|null} resultData.statGains - Stat gains from winning (default null)
 * @returns {Object} - Created result object with relations
 */
async function saveResult(resultData) {
  const {
    horseId,
    showId,
    score,
    placement,
    discipline,
    runDate,
    showName,
    prizeWon = 0,
    statGains = null,
  } = resultData;

  // Validate required fields
  if (horseId === undefined || horseId === null) {
    throw new Error('Horse ID is required');
  }
  if (showId === undefined || showId === null) {
    throw new Error('Show ID is required');
  }
  if (score === undefined || score === null) {
    throw new Error('Score is required');
  }
  if (!discipline) {
    throw new Error('Discipline is required');
  }
  if (!runDate) {
    throw new Error('Run date is required');
  }

  if (!showName || typeof showName !== 'string') {
    throw new Error('Show name is required');
  }

  // Validate data types
  if (typeof score !== 'number') {
    throw new Error('Score must be a number');
  }
  if (!Number.isInteger(horseId) || horseId <= 0) {
    throw new Error('Horse ID must be a positive integer');
  }
  if (!Number.isInteger(showId) || showId <= 0) {
    throw new Error('Show ID must be a positive integer');
  }

  try {
    // Create the result
    const result = await prisma.competitionResult.create({
      data: {
        horseId,
        showId,
        score,
        placement,
        discipline,
        runDate: new Date(runDate),
        showName,
        prizeWon: parseFloat(prizeWon),
        statGains: statGains ? JSON.stringify(statGains) : null,
      },
      include: {
        horse: {
          include: {
            breed: true,
          },
        },
        show: true,
      },
    });

    logger.info(
      `[resultModel.saveResult] Successfully saved result for horse ${horseId} in show ${showId} with score ${score}`,
    );
    return result;
  } catch (error) {
    logger.error('[resultModel.saveResult] Database error: %o', error);
    throw new Error(`Database error in saveResult: ${error.message}`);
  }
}

/**
 * Get all competition results for a specific horse
 * @param {number} horseId - Horse ID
 * @returns {Array} - Array of result objects with relations
 */
async function getResultsByHorse(horseId) {
  // Validate horseId
  const numericId = parseInt(horseId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    throw new Error('Horse ID must be a positive integer');
  }

  try {
    const results = await prisma.competitionResult.findMany({
      where: { horseId: numericId },
      include: {
        horse: {
          include: {
            breed: true,
          },
        },
        show: true,
      },
      orderBy: { runDate: 'desc' },
    });

    logger.info(
      `[resultModel.getResultsByHorse] Found ${results.length} results for horse ${numericId}`,
    );
    return results;
  } catch (error) {
    logger.error('[resultModel.getResultsByHorse] Database error: %o', error);
    throw new Error(`Database error in getResultsByHorse: ${error.message}`);
  }
}

/**
 * Get all competition results for a specific show
 * @param {number} showId - Show ID
 * @returns {Array} - Array of result objects with relations, ordered by score (highest first)
 */
async function getResultsByShow(showId) {
  // Validate showId
  const numericId = parseInt(showId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    throw new Error('Show ID must be a positive integer');
  }

  try {
    const results = await prisma.competitionResult.findMany({
      where: { showId: numericId },
      include: {
        horse: {
          include: {
            breed: true,
          },
        },
        show: true,
      },
      orderBy: { score: 'desc' },
    });

    logger.info(
      `[resultModel.getResultsByShow] Found ${results.length} results for show ${numericId}`,
    );
    return results;
  } catch (error) {
    logger.error('[resultModel.getResultsByShow] Database error: %o', error);
    throw new Error(`Database error in getResultsByShow: ${error.message}`);
  }
}

/**
 * Get a specific competition result by ID
 * @param {number} resultId - Result ID
 * @returns {Object|null} - Result object with relations or null if not found
 */
async function getResultById(resultId) {
  // Validate resultId
  const numericId = parseInt(resultId, 10);
  if (isNaN(numericId) || numericId <= 0) {
    throw new Error('Result ID must be a positive integer');
  }

  try {
    const result = await prisma.competitionResult.findUnique({
      where: { id: numericId },
      include: {
        horse: {
          include: {
            breed: true,
          },
        },
        show: true,
      },
    });

    if (result) {
      logger.info(`[resultModel.getResultById] Successfully found result: ${result.id}`);
    }

    return result; // Returns null if not found
  } catch (error) {
    logger.error('[resultModel.getResultById] Database error: %o', error);
    throw new Error(`Database error in getResultById: ${error.message}`);
  }
}

/**
 * Create a new competition result (alias for saveResult)
 * @param {Object} resultData - Competition result data
 * @returns {Object} Created result
 */
async function createResult(resultData) {
  return await saveResult(resultData);
}

/**
 * Get results by user ID
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Array} Competition results for user's horses
 */
async function getResultsByUser(userId, options = {}) {
  try {
    const { limit = 50, offset = 0, discipline = null } = options;

    const whereClause = {
      horse: {
        userId,
      },
    };

    if (discipline) {
      whereClause.discipline = discipline;
    }

    const results = await prisma.competitionResult.findMany({
      where: whereClause,
      include: {
        horse: {
          include: {
            breed: true,
          },
        },
        show: true,
      },
      orderBy: {
        runDate: 'desc',
      },
      take: Math.min(limit, 100),
      skip: Math.max(offset, 0),
    });

    logger.info(
      `[resultModel.getResultsByUser] Retrieved ${results.length} results for user ${userId}`,
    );
    return results;
  } catch (error) {
    logger.error(
      `[resultModel.getResultsByUser] Error getting results for user ${userId}: ${error.message}`,
    );
    throw error;
  }
}

export {
  saveResult,
  createResult,
  getResultsByHorse,
  getResultsByShow,
  getResultById,
  getResultsByUser,
};
