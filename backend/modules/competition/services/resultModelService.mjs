import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Save a competition result to the database
 * Updates existing placeholder result if found, otherwise creates new result
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
 * @returns {Object} - Created or updated result object with relations
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
    // Check if there's already a placeholder result for this horse/show combination
    const existingResult = await prisma.competitionResult.findFirst({
      where: {
        horseId,
        showId,
        score: 0, // Placeholder results have score 0
        placement: null, // Placeholder results have null placement
      },
    });

    let result;
    if (existingResult) {
      // Update the existing placeholder result
      result = await prisma.competitionResult.update({
        where: { id: existingResult.id },
        data: {
          score,
          placement,
          prizeWon: parseFloat(prizeWon),
          statGains: statGains ? JSON.stringify(statGains) : null,
          // Keep original entry data (horseId, showId, discipline, runDate, showName)
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
        `[resultModel.saveResult] Successfully updated placeholder result for horse ${horseId} in show ${showId} with score ${score}`,
      );
    } else {
      // Create new result (for cases where no placeholder exists)
      result = await prisma.competitionResult.create({
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
        `[resultModel.saveResult] Successfully created new result for horse ${horseId} in show ${showId} with score ${score}`,
      );
    }

    return result;
  } catch (error) {
    logger.error('[resultModel.saveResult] Database error: %o', error);
    throw new Error(`Database error in saveResult: ${error.message}`, { cause: error });
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
    throw new Error(`Database error in getResultsByHorse: ${error.message}`, { cause: error });
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
    throw new Error(`Database error in getResultsByShow: ${error.message}`, { cause: error });
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
    throw new Error(`Database error in getResultById: ${error.message}`, { cause: error });
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
}

/**
 * Build the CompetitionResultSummary[] payload for the CompetitionResultsPage
 * My Results list. Groups the users raw results by show and enriches each
 * group with totalParticipants + a per-horse rank (Equoria-oey96.5).
 *
 * Design notes:
 *   - Ownership scoping delegated to getResultsByUser (horse.userId).
 *   - Rank resolution: prefer the persisted placement string (1st/2nd/3rd)
 *     as the authoritative game-generated rank; fall back to position
 *     within the show ordered by score DESC when placement is null
 *     (below top 3). Score is Decimal(10,2) so exact ties are rare.
 *   - Runs one extra findMany to fetch peer results for the distinct set
 *     of shows the user touched. Cheap even with hundreds of shows
 *     because we only select { id, showId, horseId, score, placement }.
 *
 * @param {string} userId - Authenticated users id.
 * @returns {Promise<Array>} Array of CompetitionResultSummary-shaped rows,
 *   already sorted newest-first (via getResultsByUser).
 */
async function getUserResultsSummary(userId) {
  const rawResults = await getResultsByUser(userId, { limit: 100, offset: 0 });
  if (rawResults.length === 0) {
    return [];
  }

  const showIds = Array.from(new Set(rawResults.map(r => r.showId)));
  const allShowResults = await prisma.competitionResult.findMany({
    where: { showId: { in: showIds } },
    orderBy: [{ showId: 'asc' }, { score: 'desc' }],
    select: { showId: true, horseId: true, score: true, placement: true },
  });

  const resultsByShow = new Map();
  for (const r of allShowResults) {
    if (!resultsByShow.has(r.showId)) {
      resultsByShow.set(r.showId, []);
    }
    resultsByShow.get(r.showId).push(r);
  }

  const placementToRank = placement => {
    if (!placement) {
      return null;
    }
    const m = String(placement).match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  };
  const rankFromPosition = (showId, horseId) => {
    const list = resultsByShow.get(showId) || [];
    const idx = list.findIndex(r => r.horseId === horseId);
    return idx >= 0 ? idx + 1 : 0;
  };

  const summariesByShow = new Map();
  for (const r of rawResults) {
    const showId = r.showId;
    if (!summariesByShow.has(showId)) {
      summariesByShow.set(showId, {
        competitionId: showId,
        competitionName: r.show?.name ?? r.showName,
        discipline: r.discipline,
        date: (r.runDate instanceof Date ? r.runDate : new Date(r.runDate)).toISOString(),
        totalParticipants: (resultsByShow.get(showId) || []).length,
        prizePool: Number(r.show?.prize ?? 0),
        userResults: [],
      });
    }
    summariesByShow.get(showId).userResults.push({
      horseId: r.horseId,
      horseName: r.horse?.name ?? 'Unknown',
      rank: placementToRank(r.placement) ?? rankFromPosition(showId, r.horseId),
      score: Number(r.score),
      prizeWon: Number(r.prizeWon ?? 0),
      xpGained: 0,
    });
  }

  return Array.from(summariesByShow.values());
}

export {
  saveResult,
  createResult,
  getResultsByHorse,
  getResultsByShow,
  getResultById,
  getResultsByUser,
  getUserResultsSummary,
};
