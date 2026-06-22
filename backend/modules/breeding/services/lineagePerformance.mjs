/**
 * Lineage Performance Service (Equoria-urqic.6 split from advancedLineageAnalysisService.mjs)
 *
 * Owns per-generation performance-trend analysis: discipline strength/weakness
 * profiling and improvement-area detection over the lineageData generation
 * arrays produced by organizeByGenerations (lineageTree.mjs).
 *
 * The breeding-RECOMMENDATION synthesis that consumes this analysis lives in
 * the sibling lineageBreedingRecommendations.mjs — kept separate so both files
 * stay under the urqic.6 ~500-line target (performance ANALYSIS and breeding
 * RECOMMENDATION are distinct concerns even though the latter consumes the
 * former).
 */

import logger from '../../../utils/logger.mjs';
import { asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';

/**
 * Analyze lineage performance trends across generations
 * @param {Array} lineageData - Lineage generation data
 * @returns {Object} Performance analysis results
 */
export async function analyzeLineagePerformance(lineageData) {
  logger.info(
    `[lineagePerformance.analyzeLineagePerformance] Analyzing performance for ${lineageData.length} generations`,
  );

  const generationalTrends = [];
  const allDisciplines = new Set();
  const performanceData = [];

  // Analyze each generation
  lineageData.forEach((generation, index) => {
    const { horses } = generation;
    const stats = { speed: [], stamina: [], agility: [], intelligence: [] };
    const disciplineScores = {};
    const topPerformers = [];

    horses.forEach(horse => {
      // Collect stats
      if (horse.stats) {
        Object.keys(stats).forEach(stat => {
          if (horse.stats[stat]) {
            stats[stat].push(horse.stats[stat]);
          }
        });
      }

      // Collect discipline scores
      if (horse.disciplineScores) {
        Object.entries(horse.disciplineScores).forEach(([discipline, score]) => {
          allDisciplines.add(discipline);
          if (!disciplineScores[discipline]) {
            disciplineScores[discipline] = [];
          }
          disciplineScores[discipline].push(score);
        });
      }

      // Calculate performance score for this horse
      const avgStats = horse.stats
        ? Object.values(horse.stats).reduce((sum, val) => sum + val, 0) /
          Object.keys(horse.stats).length
        : 50;
      const avgDiscipline = horse.disciplineScores
        ? Object.values(horse.disciplineScores).reduce((sum, val) => sum + val, 0) /
          Object.keys(horse.disciplineScores).length
        : 50;

      const performanceScore = (avgStats + avgDiscipline) / 2;

      performanceData.push({
        id: horse.id,
        name: horse.name,
        generation: index,
        performanceScore,
        specialties: Object.entries(asFlagObject(horse.disciplineScores))
          .filter(([_, score]) => score > 80)
          .map(([discipline, _]) => discipline),
      });

      if (performanceScore > 75) {
        topPerformers.push({
          id: horse.id,
          name: horse.name,
          performanceScore: Math.round(performanceScore),
          specialties: Object.entries(asFlagObject(horse.disciplineScores))
            .filter(([_, score]) => score > 80)
            .map(([discipline, _]) => discipline),
        });
      }
    });

    // Calculate averages for this generation
    const averageStats = {};
    Object.keys(stats).forEach(stat => {
      if (stats[stat].length > 0) {
        averageStats[stat] = Math.round(
          stats[stat].reduce((sum, val) => sum + val, 0) / stats[stat].length,
        );
      }
    });

    const averageDisciplines = {};
    Object.keys(disciplineScores).forEach(discipline => {
      const scores = disciplineScores[discipline];
      if (scores.length > 0) {
        averageDisciplines[discipline] = Math.round(
          scores.reduce((sum, val) => sum + val, 0) / scores.length,
        );
      }
    });

    generationalTrends.push({
      generation: index,
      horseCount: horses.length,
      averageStats,
      averageDisciplines,
      topPerformers: topPerformers.slice(0, 3), // Top 3 performers
    });
  });

  // Identify discipline strengths and weaknesses
  const disciplineStrengths = analyzeDisciplineStrengths(lineageData, allDisciplines);

  // Identify improvement areas
  const improvementAreas = identifyImprovementAreas(generationalTrends);

  return {
    generationalTrends,
    disciplineStrengths,
    performanceMetrics: {
      topPerformers: performanceData
        .sort((a, b) => b.performanceScore - a.performanceScore)
        .slice(0, 10),
      averagePerformance: Math.round(
        performanceData.reduce((sum, horse) => sum + horse.performanceScore, 0) /
          Math.max(1, performanceData.length),
      ),
    },
    improvementAreas,
  };
}

/**
 * Analyze discipline strengths across lineage
 * @param {Array} lineageData - Lineage generation data
 * @param {Set} allDisciplines - Set of all disciplines found
 * @returns {Object} Discipline strength analysis
 */
function analyzeDisciplineStrengths(lineageData, allDisciplines) {
  const disciplineAverages = {};

  // Calculate average scores for each discipline
  allDisciplines.forEach(discipline => {
    const scores = [];
    lineageData.forEach(generation => {
      generation.horses.forEach(horse => {
        if (horse.disciplineScores && horse.disciplineScores[discipline]) {
          scores.push(horse.disciplineScores[discipline]);
        }
      });
    });

    if (scores.length > 0) {
      disciplineAverages[discipline] =
        scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  });

  // Sort disciplines by average score
  const sortedDisciplines = Object.entries(disciplineAverages).sort(([, a], [, b]) => b - a);

  return {
    strongest: sortedDisciplines.slice(0, 3).map(([discipline, avg]) => ({
      discipline,
      averageScore: Math.round(avg),
    })),
    weakest: sortedDisciplines.slice(-3).map(([discipline, avg]) => ({
      discipline,
      averageScore: Math.round(avg),
    })),
    balanced: sortedDisciplines
      .filter(([, avg]) => avg >= 70 && avg <= 85)
      .map(([discipline, avg]) => ({
        discipline,
        averageScore: Math.round(avg),
      })),
  };
}

/**
 * Identify areas for improvement based on generational trends
 * @param {Array} generationalTrends - Trends across generations
 * @returns {Array} Array of improvement areas
 */
function identifyImprovementAreas(generationalTrends) {
  const improvements = [];

  if (generationalTrends.length < 2) {
    return improvements;
  }

  // Compare recent vs older generations
  const [recent] = generationalTrends;
  const older = generationalTrends[generationalTrends.length - 1];

  // Check stat trends
  Object.keys(recent.averageStats || {}).forEach(stat => {
    const recentAvg = recent.averageStats[stat];
    const olderAvg = older.averageStats[stat];

    if (olderAvg && recentAvg < olderAvg - 5) {
      improvements.push({
        area: `${stat} decline`,
        description: `${stat} has decreased from ${olderAvg} to ${recentAvg} across generations`,
        priority: 'medium',
        suggestion: `Focus on breeding for improved ${stat} characteristics`,
      });
    }
  });

  // Check for low diversity
  if (recent.horseCount < 4) {
    improvements.push({
      area: 'genetic diversity',
      description: 'Limited number of horses in recent generation may reduce genetic diversity',
      priority: 'high',
      suggestion: 'Introduce new bloodlines to increase genetic diversity',
    });
  }

  return improvements;
}
