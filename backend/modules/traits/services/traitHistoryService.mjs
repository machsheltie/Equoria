/**
 * Trait History Service
 *
 * This service manages the logging and retrieval of trait development history
 * for horses, providing insights into how traits were acquired and the factors
 * that influenced their development.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { visibleTraitHistoryWhere } from './visibleTraitHistory.mjs';
import { clampLimit, findKeysetPage } from '../../../utils/paginationHelper.mjs';

/**
 * Logs a trait assignment to the history
 * @param {Object} traitData - Data about the trait assignment
 * @param {Object} [client] - Prisma client or interactive transaction; pass the
 *   caller's tx so the history row commits with the trait it records.
 * @returns {Object} Created trait history log entry
 */
export async function logTraitAssignment(traitData, client = prisma) {
  const {
    horseId,
    traitName,
    sourceType, // 'groom', 'milestone', 'environmental', 'genetic'
    sourceId,
    influenceScore = 0,
    isEpigenetic = false,
    groomId = null,
    bondScore = null,
  } = traitData;

  // Calculate horse age in days
  const horse = await client.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true },
  });

  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  const ageInDays = getHorseAgeDays(horse.dateOfBirth);

  // Create the trait history log entry
  const historyEntry = await client.traitHistoryLog.create({
    data: {
      horseId,
      traitName,
      sourceType,
      sourceId: sourceId?.toString(),
      influenceScore,
      isEpigenetic,
      groomId,
      bondScore,
      ageInDays,
      timestamp: new Date(),
    },
    include: {
      horse: {
        select: { name: true, dateOfBirth: true },
      },
      groom: {
        select: { name: true, epigeneticInfluenceType: true },
      },
    },
  });

  return historyEntry;
}

/** The where filter shared by the trait-history reads: the caller's filters, never a still-hidden trait. */
async function traitHistoryFilter(horseId, options) {
  const { sourceType = null, isEpigenetic = null, startDate = null, endDate = null } = options;

  const whereClause = {
    horseId,
  };

  if (sourceType) {
    whereClause.sourceType = sourceType;
  }

  if (isEpigenetic !== null) {
    whereClause.isEpigenetic = isEpigenetic;
  }

  if (startDate || endDate) {
    whereClause.timestamp = {};
    if (startDate) {
      whereClause.timestamp.gte = new Date(startDate);
    }
    if (endDate) {
      whereClause.timestamp.lte = new Date(endDate);
    }
  }

  // Rows naming a trait still hidden on the horse are never returned
  // (Equoria-6dace); the summaries below build on this read too.
  return visibleTraitHistoryWhere(whereClause);
}

/**
 * One keyset page of a horse's trait development history, newest first with ties
 * on the instant broken by id (Equoria-cmw85.20), and the true number of entries
 * under the same filters. `cursor` continues a list; `offset` still works
 * without one; the page size is the shared clamp (default 50, max 100).
 *
 * @param {number} horseId - ID of the horse
 * @param {Object} options - Query options (limit, offset, cursor and the filters)
 * @returns {Promise<{ items: Array, pageInfo: { nextCursor: string|null, hasMore: boolean }, total: number }>}
 * @throws {InvalidCursorError} on a cursor that cannot be decoded
 */
export async function getTraitHistoryPage(horseId, options = {}) {
  const { limit = 50, offset = 0, cursor = null } = options;
  const where = await traitHistoryFilter(horseId, options);

  const [page, total] = await Promise.all([
    findKeysetPage(args => prisma.traitHistoryLog.findMany(args), {
      where,
      sort: [
        { key: 'timestamp', dir: 'desc', type: 'date' },
        { key: 'id', dir: 'desc', type: 'int' },
      ],
      limit: clampLimit(limit, { def: 50, max: 100 }),
      cursor,
      skip: Math.max(offset, 0),
      extra: {
        include: {
          horse: {
            select: { name: true, dateOfBirth: true },
          },
          groom: {
            select: { name: true, epigeneticInfluenceType: true, speciality: true },
          },
        },
      },
    }),
    prisma.traitHistoryLog.count({ where }),
  ]);
  return { ...page, total };
}

/**
 * Retrieves trait development history for a horse (the first page of
 * getTraitHistoryPage, as an array)
 * @param {number} horseId - ID of the horse
 * @param {Object} options - Query options
 * @returns {Array} Array of trait history entries
 */
export async function getTraitHistory(horseId, options = {}) {
  const { items } = await getTraitHistoryPage(horseId, options);
  return items;
}

/**
 * Gets trait development summary for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Summary of trait development
 */
export async function getTraitDevelopmentSummary(horseId) {
  const history = await getTraitHistory(horseId);

  if (history.length === 0) {
    return {
      horseId,
      totalTraits: 0,
      epigeneticTraits: 0,
      groomInfluencedTraits: 0,
      developmentalStages: {},
      sourceBreakdown: {},
      groomContributions: {},
    };
  }

  const summary = {
    horseId,
    totalTraits: history.length,
    epigeneticTraits: history.filter(h => h.isEpigenetic).length,
    groomInfluencedTraits: history.filter(h => h.sourceType === 'groom').length,
    developmentalStages: {},
    sourceBreakdown: {},
    groomContributions: {},
    traitTimeline: [],
  };

  // Analyze developmental stages
  history.forEach(entry => {
    const stage = getAgeStage(entry.ageInDays);
    summary.developmentalStages[stage] = (summary.developmentalStages[stage] || 0) + 1;
  });

  // Analyze source breakdown
  history.forEach(entry => {
    summary.sourceBreakdown[entry.sourceType] =
      (summary.sourceBreakdown[entry.sourceType] || 0) + 1;
  });

  // Analyze groom contributions
  history.forEach(entry => {
    if (entry.groom) {
      const groomKey = `${entry.groom.name} (${entry.groom.epigeneticInfluenceType})`;
      if (!summary.groomContributions[groomKey]) {
        summary.groomContributions[groomKey] = {
          traits: 0,
          epigeneticTraits: 0,
          averageInfluence: 0,
          speciality: entry.groom.speciality,
        };
      }

      summary.groomContributions[groomKey].traits += 1;
      if (entry.isEpigenetic) {
        summary.groomContributions[groomKey].epigeneticTraits += 1;
      }
      summary.groomContributions[groomKey].averageInfluence += entry.influenceScore;
    }
  });

  // Calculate average influence scores for grooms
  Object.keys(summary.groomContributions).forEach(groomKey => {
    const contrib = summary.groomContributions[groomKey];
    contrib.averageInfluence = contrib.averageInfluence / contrib.traits;
  });

  // Create trait timeline
  summary.traitTimeline = history.map(entry => ({
    traitName: entry.traitName,
    timestamp: entry.timestamp,
    ageInDays: entry.ageInDays,
    sourceType: entry.sourceType,
    isEpigenetic: entry.isEpigenetic,
    groomName: entry.groom?.name,
    influenceScore: entry.influenceScore,
  }));

  return summary;
}

/**
 * Analyzes trait development patterns across multiple horses
 * @param {Array} horseIds - Array of horse IDs to analyze
 * @returns {Object} Pattern analysis results
 */
export async function analyzeTraitPatterns(horseIds) {
  const patterns = {
    commonTraits: {},
    epigeneticTrends: {},
    groomEffectiveness: {},
    agePatterns: {},
  };

  for (const horseId of horseIds) {
    const history = await getTraitHistory(horseId);

    // Analyze common traits
    history.forEach(entry => {
      patterns.commonTraits[entry.traitName] = (patterns.commonTraits[entry.traitName] || 0) + 1;
    });

    // Analyze epigenetic trends
    const epigeneticTraits = history.filter(h => h.isEpigenetic);
    epigeneticTraits.forEach(entry => {
      patterns.epigeneticTrends[entry.traitName] =
        (patterns.epigeneticTrends[entry.traitName] || 0) + 1;
    });

    // Analyze groom effectiveness
    history.forEach(entry => {
      if (entry.groom) {
        const groomKey = entry.groom.epigeneticInfluenceType;
        if (!patterns.groomEffectiveness[groomKey]) {
          patterns.groomEffectiveness[groomKey] = {
            totalTraits: 0,
            totalInfluence: 0,
            epigeneticTraits: 0,
          };
        }

        patterns.groomEffectiveness[groomKey].totalTraits += 1;
        patterns.groomEffectiveness[groomKey].totalInfluence += entry.influenceScore;
        if (entry.isEpigenetic) {
          patterns.groomEffectiveness[groomKey].epigeneticTraits += 1;
        }
      }
    });
  }

  // Calculate average effectiveness for groom personalities
  Object.keys(patterns.groomEffectiveness).forEach(personality => {
    const data = patterns.groomEffectiveness[personality];
    data.averageInfluence = data.totalInfluence / data.totalTraits;
    data.epigeneticRate = data.epigeneticTraits / data.totalTraits;
  });

  return patterns;
}

/**
 * Helper function to determine age stage
 *
 * Equoria-l06yb (Option 1, 2026-05-20): elapsed-time developmental-stage
 * windows. `ageInDays` here is the STORED traitHistory.ageInDays (the
 * elapsed-calendar-day count captured at log time, the fe9k-documented
 * "pre-computed days" case), aligned with the foalAgeUtils.mjs elapsed-time
 * model. Produces a developmentalStages COUNT for a summary (display/
 * aggregation only).
 * @param {number} ageInDays - Age in elapsed calendar days
 * @returns {string} Age stage name
 */
function getAgeStage(ageInDays) {
  // Equoria-fjgzp: the stored ageInDays is game days (one game week is one game
  // year), so the old 365 / 730 / 1095 year anniversaries are 7 / 14 / 21 and
  // the finer early windows scale with them. Age 3 (21 days) is 'mature'.
  if (ageInDays < 1) {
    return 'imprinting';
  }
  if (ageInDays < 2) {
    return 'socialization';
  }
  if (ageInDays < 4) {
    return 'fear_period';
  }
  if (ageInDays < 7) {
    return 'juvenile';
  }
  if (ageInDays < 14) {
    return 'adolescent';
  }
  if (ageInDays < 21) {
    return 'young_adult';
  }
  return 'mature';
}

/**
 * Cleanup function for development/testing
 * @param {string} userId - User ID to clean up data for
 */
export async function cleanupTraitHistory(userId) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cleanup not allowed in production');
  }

  const userHorses = await prisma.horse.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });

  const horseIds = userHorses.map(horse => horse.id);

  if (horseIds.length > 0) {
    await prisma.traitHistoryLog.deleteMany({
      where: {
        horseId: { in: horseIds },
      },
    });
  }

  return { deletedEntries: horseIds.length };
}
