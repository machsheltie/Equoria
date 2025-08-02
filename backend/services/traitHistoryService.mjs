/**
 * Trait History Service
 *
 * This service manages the logging and retrieval of trait development history
 * for horses, providing insights into how traits were acquired and the factors
 * that influenced their development.
 */

import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.js';

const prisma = new PrismaClient();

/**
 * Logs a trait assignment to the history
 * @param {Object} traitData - Data about the trait assignment
 * @returns {Object} Created trait history log entry
 */
export async function logTraitAssignment(traitData) {
  const {
    horseId,
    traitName,
    sourceType, // 'groom', 'milestone', 'environmental', 'genetic'
    sourceId,
    influenceScore = 0,
    isEpigenetic = false,
    groomId = null,
    bondScore = null,
    stressLevel = null,
  } = traitData;

  // Calculate horse age in days
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true },
  });

  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  const ageInDays = Math.floor(
    (Date.now() - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24),
  );

  // Create the trait history log entry
  const historyEntry = await prisma.traitHistoryLog.create({
    data: {
      horseId,
      traitName,
      sourceType,
      sourceId: sourceId?.toString(),
      influenceScore,
      isEpigenetic,
      groomId,
      bondScore,
      stressLevel,
      ageInDays,
      timestamp: new Date(),
    },
    include: {
      horse: {
        select: { name: true, dateOfBirth: true },
      },
      groom: {
        select: { name: true, groomPersonality: true },
      },
    },
  });

  return historyEntry;
}

/**
 * Retrieves trait development history for a horse
 * @param {number} horseId - ID of the horse
 * @param {Object} options - Query options
 * @returns {Array} Array of trait history entries
 */
export async function getTraitHistory(horseId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    sourceType = null,
    isEpigenetic = null,
    startDate = null,
    endDate = null,
  } = options;

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
    if (startDate) { whereClause.timestamp.gte = new Date(startDate); }
    if (endDate) { whereClause.timestamp.lte = new Date(endDate); }
  }

  const history = await prisma.traitHistoryLog.findMany({
    where: whereClause,
    include: {
      horse: {
        select: { name: true, dateOfBirth: true },
      },
      groom: {
        select: { name: true, groomPersonality: true, speciality: true },
      },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
    skip: offset,
  });

  return history;
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
    summary.sourceBreakdown[entry.sourceType] = (summary.sourceBreakdown[entry.sourceType] || 0) + 1;
  });

  // Analyze groom contributions
  history.forEach(entry => {
    if (entry.groom) {
      const groomKey = `${entry.groom.name} (${entry.groom.groomPersonality})`;
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
 * Gets trait development insights for breeding decisions
 * @param {number} horseId - ID of the horse
 * @returns {Object} Breeding insights based on trait development
 */
export async function getBreedingInsights(horseId) {
  const summary = await getTraitDevelopmentSummary(horseId);
  const history = await getTraitHistory(horseId, { isEpigenetic: true });

  const insights = {
    horseId,
    epigeneticProfile: {},
    inheritanceRisk: 'low',
    recommendedCarePatterns: [],
    breedingNotes: [],
  };

  // Analyze epigenetic profile
  const epigeneticTraits = history.filter(h => h.isEpigenetic);
  epigeneticTraits.forEach(trait => {
    insights.epigeneticProfile[trait.traitName] = {
      acquiredAt: trait.ageInDays,
      source: trait.sourceType,
      groomInfluence: trait.groom?.name,
      influenceScore: trait.influenceScore,
    };
  });

  // Assess inheritance risk
  const negativeTraits = epigeneticTraits.filter(trait =>
    ['Nervous', 'Skittish', 'Anxious', 'Insecure', 'Antisocial'].includes(trait.traitName),
  );

  if (negativeTraits.length > 2) {
    insights.inheritanceRisk = 'high';
    insights.breedingNotes.push('High concentration of negative epigenetic traits may affect offspring');
  } else if (negativeTraits.length > 0) {
    insights.inheritanceRisk = 'moderate';
    insights.breedingNotes.push('Some negative traits present - consider mate selection carefully');
  }

  // Generate care pattern recommendations
  if (summary.groomContributions) {
    const bestGrooms = Object.entries(summary.groomContributions)
      .filter(([_, contrib]) => contrib.averageInfluence > 2)
      .map(([name, contrib]) => ({ name, ...contrib }));

    if (bestGrooms.length > 0) {
      insights.recommendedCarePatterns.push(
        `Successful care patterns identified with grooms: ${bestGrooms.map(g => g.name).join(', ')}`,
      );
    }
  }

  return insights;
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
    recommendations: [],
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
      patterns.epigeneticTrends[entry.traitName] = (patterns.epigeneticTrends[entry.traitName] || 0) + 1;
    });

    // Analyze groom effectiveness
    history.forEach(entry => {
      if (entry.groom) {
        const groomKey = entry.groom.groomPersonality;
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

  // Generate recommendations
  const mostEffectivePersonality = Object.entries(patterns.groomEffectiveness)
    .sort(([, a], [, b]) => b.averageInfluence - a.averageInfluence)[0];

  if (mostEffectivePersonality) {
    patterns.recommendations.push(
      `${mostEffectivePersonality[0]} personality grooms show highest trait development effectiveness`,
    );
  }

  return patterns;
}

/**
 * Helper function to determine age stage
 * @param {number} ageInDays - Age in days
 * @returns {string} Age stage name
 */
function getAgeStage(ageInDays) {
  if (ageInDays < 30) { return 'imprinting'; }
  if (ageInDays < 90) { return 'socialization'; }
  if (ageInDays < 180) { return 'fear_period'; }
  if (ageInDays < 365) { return 'juvenile'; }
  if (ageInDays < 730) { return 'adolescent'; }
  if (ageInDays < 1095) { return 'young_adult'; }
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
