/**
 * Lineage Trait Check Utility
 * Utility function to check lineage for discipline affinity
 */

import logger from './logger.mjs';

/**
 * Check lineage for discipline affinity
 * Takes in 3 generations of ancestors and returns the most common discipline
 * If 3 or more share the same one, return { affinity: true, discipline: 'jumping' }
 * Otherwise, return { affinity: false }
 *
 * @param {Array} ancestors - Array of ancestor objects with discipline preferences
 * @returns {Object} - Affinity result { affinity: boolean, discipline?: string }
 */
function checkLineageForDisciplineAffinity(ancestors) {
  try {
    logger.info(
      `[lineageTraitCheck.checkLineageForDisciplineAffinity] Analyzing ${ancestors?.length || 0} ancestors for discipline affinity`,
    );

    // Handle edge cases
    if (!ancestors || ancestors.length === 0) {
      logger.info('[lineageTraitCheck.checkLineageForDisciplineAffinity] No ancestors provided');
      return { affinity: false };
    }

    // Count discipline preferences from ancestors
    const disciplineCount = {};

    for (const ancestor of ancestors) {
      // Determine the ancestor's preferred discipline
      const preferredDiscipline = getAncestorPreferredDiscipline(ancestor);

      if (preferredDiscipline) {
        disciplineCount[preferredDiscipline] = (disciplineCount[preferredDiscipline] || 0) + 1;
        logger.info(
          `[lineageTraitCheck.checkLineageForDisciplineAffinity] Ancestor ${ancestor.name || ancestor.id} prefers ${preferredDiscipline}`,
        );
      }
    }

    logger.info(
      `[lineageTraitCheck.checkLineageForDisciplineAffinity] Discipline counts: ${JSON.stringify(disciplineCount)}`,
    );

    // Find the most common discipline
    let mostCommonDiscipline = null;
    let maxCount = 0;

    for (const [discipline, count] of Object.entries(disciplineCount)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDiscipline = discipline;
      }
    }

    // Check if 3 or more ancestors share the same discipline
    const hasAffinity = maxCount >= 3;

    const result = {
      affinity: hasAffinity,
      discipline: hasAffinity ? mostCommonDiscipline : undefined,
    };

    logger.info(
      `[lineageTraitCheck.checkLineageForDisciplineAffinity] Result: ${JSON.stringify(result)}`,
    );

    return result;
  } catch (error) {
    logger.error(`[lineageTraitCheck.checkLineageForDisciplineAffinity] Error: ${error.message}`);
    return { affinity: false };
  }
}

/**
 * Determine an ancestor's preferred discipline from available data
 * @param {Object} ancestor - Ancestor object
 * @returns {string|null} - Preferred discipline or null
 */
function getAncestorPreferredDiscipline(ancestor) {
  // Priority 1: Direct discipline field
  if (ancestor.discipline) {
    return ancestor.discipline;
  }

  // Priority 2: Competition history analysis
  if (ancestor.competitionHistory && Array.isArray(ancestor.competitionHistory)) {
    return getMostCommonDisciplineFromHistory(ancestor.competitionHistory);
  }

  // Priority 3: Discipline scores analysis
  if (ancestor.disciplineScores && typeof ancestor.disciplineScores === 'object') {
    return getHighestScoringDiscipline(ancestor.disciplineScores);
  }

  // Priority 4: Check for individual competition results
  if (ancestor.competitions && Array.isArray(ancestor.competitions)) {
    return getMostCommonDisciplineFromHistory(ancestor.competitions);
  }

  // Priority 5: Check for specialty field
  if (ancestor.specialty) {
    return ancestor.specialty;
  }

  return null;
}

/**
 * Get the most common discipline from competition history
 * @param {Array} competitionHistory - Array of competition results
 * @returns {string|null} - Most common discipline or null
 */
function getMostCommonDisciplineFromHistory(competitionHistory) {
  if (!competitionHistory || competitionHistory.length === 0) {
    return null;
  }

  const disciplineCount = {};
  for (const competition of competitionHistory) {
    if (competition.discipline) {
      disciplineCount[competition.discipline] = (disciplineCount[competition.discipline] || 0) + 1;
    }
  }

  let mostCommon = null;
  let maxCount = 0;
  for (const [discipline, count] of Object.entries(disciplineCount)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = discipline;
    }
  }

  return mostCommon;
}

/**
 * Get the highest scoring discipline from discipline scores
 * @param {Object} disciplineScores - Object with discipline scores
 * @returns {string|null} - Highest scoring discipline or null
 */
function getHighestScoringDiscipline(disciplineScores) {
  if (!disciplineScores || typeof disciplineScores !== 'object') {
    return null;
  }

  let highestDiscipline = null;
  let highestScore = -1;

  for (const [discipline, score] of Object.entries(disciplineScores)) {
    if (typeof score === 'number' && score > highestScore) {
      highestScore = score;
      highestDiscipline = discipline;
    }
  }

  return highestDiscipline;
}

/**
 * Extended version that provides detailed analysis
 * @param {Array} ancestors - Array of ancestor objects
 * @returns {Object} - Detailed affinity analysis
 */
function checkLineageForDisciplineAffinityDetailed(ancestors) {
  try {
    const basicResult = checkLineageForDisciplineAffinity(ancestors);

    if (!ancestors || ancestors.length === 0) {
      return {
        ...basicResult,
        totalAnalyzed: 0,
        totalWithDisciplines: 0,
        disciplineBreakdown: {},
        affinityStrength: 0,
      };
    }

    // Count all disciplines
    const disciplineCount = {};
    let totalAncestorsWithDisciplines = 0;

    for (const ancestor of ancestors) {
      const preferredDiscipline = getAncestorPreferredDiscipline(ancestor);
      if (preferredDiscipline) {
        disciplineCount[preferredDiscipline] = (disciplineCount[preferredDiscipline] || 0) + 1;
        totalAncestorsWithDisciplines++;
      }
    }

    // Calculate affinity strength (percentage of ancestors with the dominant discipline)
    const maxCount = Math.max(...Object.values(disciplineCount), 0);
    const affinityStrength =
      totalAncestorsWithDisciplines > 0 ? (maxCount / totalAncestorsWithDisciplines) * 100 : 0;

    return {
      ...basicResult,
      totalAnalyzed: ancestors.length,
      totalWithDisciplines: totalAncestorsWithDisciplines,
      disciplineBreakdown: disciplineCount,
      affinityStrength: Math.round(affinityStrength),
      dominantCount: maxCount,
    };
  } catch (error) {
    logger.error(
      `[lineageTraitCheck.checkLineageForDisciplineAffinityDetailed] Error: ${error.message}`,
    );
    return {
      affinity: false,
      totalAnalyzed: 0,
      totalWithDisciplines: 0,
      disciplineBreakdown: {},
      affinityStrength: 0,
      error: error.message,
    };
  }
}

/**
 * Check if ancestors meet specific discipline affinity requirements
 * @param {Array} ancestors - Array of ancestor objects
 * @param {string} targetDiscipline - Target discipline to check for
 * @param {number} minimumCount - Minimum number of ancestors required (default: 3)
 * @returns {Object} - Specific discipline affinity result
 */
function checkSpecificDisciplineAffinity(ancestors, targetDiscipline, minimumCount = 3) {
  try {
    if (!ancestors || ancestors.length === 0 || !targetDiscipline) {
      return {
        hasAffinity: false,
        count: 0,
        required: minimumCount,
        discipline: targetDiscipline,
      };
    }

    let count = 0;
    const matchingAncestors = [];

    for (const ancestor of ancestors) {
      const preferredDiscipline = getAncestorPreferredDiscipline(ancestor);
      if (preferredDiscipline === targetDiscipline) {
        count++;
        matchingAncestors.push(ancestor.name || ancestor.id);
      }
    }

    const hasAffinity = count >= minimumCount;

    logger.info(
      `[lineageTraitCheck.checkSpecificDisciplineAffinity] ${targetDiscipline} affinity: ${hasAffinity} (${count}/${minimumCount})`,
    );

    return {
      hasAffinity,
      count,
      required: minimumCount,
      discipline: targetDiscipline,
      matchingAncestors,
      percentage: Math.round((count / ancestors.length) * 100),
    };
  } catch (error) {
    logger.error(`[lineageTraitCheck.checkSpecificDisciplineAffinity] Error: ${error.message}`);
    return {
      hasAffinity: false,
      count: 0,
      required: minimumCount,
      discipline: targetDiscipline,
      error: error.message,
    };
  }
}

export {
  checkLineageForDisciplineAffinity,
  checkLineageForDisciplineAffinityDetailed,
  checkSpecificDisciplineAffinity,
  getAncestorPreferredDiscipline,
  getMostCommonDisciplineFromHistory,
  getHighestScoringDiscipline,
};
