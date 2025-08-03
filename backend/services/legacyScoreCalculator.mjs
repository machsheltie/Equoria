/**
 * Legacy Score Calculator Service
 * 
 * Service for calculating comprehensive legacy scores for horses that incorporate
 * multiple components including base stats, achievements, competition performance,
 * and trait development quality. This score influences a horse's value as a breeder
 * and contributes to its prestige record.
 * 
 * Features:
 * - Base stats scoring component
 * - Achievement and competition performance scoring
 * - Trait development scoring integration
 * - Breeding value assessment
 * - Legacy score breakdown and analysis
 * 
 * Components:
 * - Base Stats (max 30 points): Average of all 10 core stats
 * - Achievements (max 25 points): Competition wins, records, milestones
 * - Trait Score (max 25 points): Trait development quality and diversity
 * - Breeding Value (max 20 points): Genetic contribution and offspring success
 * Total Legacy Score: max 100 points
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { calculateTraitScore } from './legacyScoreTraitCalculator.mjs';

// Constants for legacy score components
const MAX_BASE_STATS_SCORE = 30;
const MAX_ACHIEVEMENTS_SCORE = 25;
const MAX_TRAIT_SCORE = 25;
const MAX_BREEDING_VALUE_SCORE = 20;
const MAX_TOTAL_SCORE = 100;

/**
 * Calculate comprehensive legacy score for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Complete legacy score breakdown
 */
export async function calculateLegacyScore(horseId) {
  try {
    logger.info(`[legacyScoreCalculator.calculateLegacyScore] Calculating legacy score for horse ${horseId}`);

    // Get horse data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      include: {
        competitionResults: true,
        damOffspring: true,
        sireOffspring: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Calculate each component
    const baseStatsScore = calculateBaseStatsScore(horse);
    const achievementsScore = await calculateAchievementsScore(horse);
    const traitScore = await calculateTraitScore(horseId);
    const breedingValueScore = calculateBreedingValueScore(horse);

    // Calculate total legacy score
    const totalScore = baseStatsScore.score + achievementsScore.score + traitScore.totalScore + breedingValueScore.score;

    const result = {
      horseId,
      horseName: horse.name,
      totalScore,
      maxScore: MAX_TOTAL_SCORE,
      percentage: (totalScore / MAX_TOTAL_SCORE) * 100,
      grade: calculateLegacyGrade(totalScore),
      components: {
        baseStats: {
          score: baseStatsScore.score,
          maxScore: MAX_BASE_STATS_SCORE,
          percentage: (baseStatsScore.score / MAX_BASE_STATS_SCORE) * 100,
          breakdown: baseStatsScore.breakdown,
        },
        achievements: {
          score: achievementsScore.score,
          maxScore: MAX_ACHIEVEMENTS_SCORE,
          percentage: (achievementsScore.score / MAX_ACHIEVEMENTS_SCORE) * 100,
          breakdown: achievementsScore.breakdown,
        },
        traitScore: {
          score: traitScore.totalScore,
          maxScore: MAX_TRAIT_SCORE,
          percentage: (traitScore.totalScore / MAX_TRAIT_SCORE) * 100,
          breakdown: traitScore.breakdown,
        },
        breedingValue: {
          score: breedingValueScore.score,
          maxScore: MAX_BREEDING_VALUE_SCORE,
          percentage: (breedingValueScore.score / MAX_BREEDING_VALUE_SCORE) * 100,
          breakdown: breedingValueScore.breakdown,
        },
      },
      breakdown: {
        baseStatsScoring: baseStatsScore,
        achievementsScoring: achievementsScore,
        traitScoring: traitScore,
        breedingValueScoring: breedingValueScore,
      },
      calculatedAt: new Date(),
    };

    logger.info(`[legacyScoreCalculator.calculateLegacyScore] Calculated legacy score ${totalScore}/${MAX_TOTAL_SCORE} (${result.grade}) for horse ${horseId}`);

    return result;
  } catch (error) {
    logger.error(`[legacyScoreCalculator.calculateLegacyScore] Error calculating legacy score for horse ${horseId}: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate base stats score component
 * @param {Object} horse - Horse object with stats
 * @returns {Object} Base stats score breakdown
 */
function calculateBaseStatsScore(horse) {
  const stats = [
    horse.speed || 0,
    horse.stamina || 0,
    horse.agility || 0,
    horse.balance || 0,
    horse.precision || 0,
    horse.intelligence || 0,
    horse.boldness || 0,
    horse.flexibility || 0,
    horse.obedience || 0,
    horse.focus || 0,
  ];

  const totalStats = stats.reduce((sum, stat) => sum + stat, 0);
  const averageStats = totalStats / stats.length;
  
  // Scale to max 30 points (average of 100 = 30 points)
  const score = Math.round((averageStats / 100) * MAX_BASE_STATS_SCORE);

  return {
    score: Math.min(score, MAX_BASE_STATS_SCORE),
    breakdown: {
      totalStats,
      averageStats: Math.round(averageStats * 10) / 10,
      individualStats: {
        speed: horse.speed || 0,
        stamina: horse.stamina || 0,
        agility: horse.agility || 0,
        balance: horse.balance || 0,
        precision: horse.precision || 0,
        intelligence: horse.intelligence || 0,
        boldness: horse.boldness || 0,
        flexibility: horse.flexibility || 0,
        obedience: horse.obedience || 0,
        focus: horse.focus || 0,
      },
    },
  };
}

/**
 * Calculate achievements score component
 * @param {Object} horse - Horse object with competition results
 * @returns {Object} Achievements score breakdown
 */
async function calculateAchievementsScore(horse) {
  const results = horse.competitionResults || [];
  
  // Count wins by placement
  const firstPlaces = results.filter(r => r.placement === 1).length;
  const secondPlaces = results.filter(r => r.placement === 2).length;
  const thirdPlaces = results.filter(r => r.placement === 3).length;
  const totalCompetitions = results.length;

  // Calculate achievement points
  let score = 0;
  score += firstPlaces * 3; // 3 points per win
  score += secondPlaces * 2; // 2 points per second place
  score += thirdPlaces * 1; // 1 point per third place

  // Bonus for competition participation
  if (totalCompetitions >= 10) score += 2;
  if (totalCompetitions >= 25) score += 3;
  if (totalCompetitions >= 50) score += 5;

  // Bonus for win rate
  const winRate = totalCompetitions > 0 ? firstPlaces / totalCompetitions : 0;
  if (winRate >= 0.5) score += 3; // 50%+ win rate
  if (winRate >= 0.3) score += 2; // 30%+ win rate
  if (winRate >= 0.1) score += 1; // 10%+ win rate

  return {
    score: Math.min(score, MAX_ACHIEVEMENTS_SCORE),
    breakdown: {
      firstPlaces,
      secondPlaces,
      thirdPlaces,
      totalCompetitions,
      winRate: Math.round(winRate * 1000) / 10, // Percentage with 1 decimal
      competitionBonus: Math.min(
        (totalCompetitions >= 50 ? 5 : totalCompetitions >= 25 ? 3 : totalCompetitions >= 10 ? 2 : 0),
        10
      ),
      winRateBonus: winRate >= 0.5 ? 3 : winRate >= 0.3 ? 2 : winRate >= 0.1 ? 1 : 0,
    },
  };
}

/**
 * Calculate breeding value score component
 * @param {Object} horse - Horse object with offspring data
 * @returns {Object} Breeding value score breakdown
 */
function calculateBreedingValueScore(horse) {
  const offspring = [...(horse.damOffspring || []), ...(horse.sireOffspring || [])];
  const offspringCount = offspring.length;

  let score = 0;

  // Points for producing offspring
  score += Math.min(offspringCount * 2, 10); // 2 points per offspring, max 10

  // Bonus for being an active breeder
  if (offspringCount >= 5) score += 3;
  if (offspringCount >= 10) score += 5;

  // Future: Could add offspring performance analysis
  // For now, just base on breeding activity

  return {
    score: Math.min(score, MAX_BREEDING_VALUE_SCORE),
    breakdown: {
      offspringCount,
      breedingActivityBonus: offspringCount >= 10 ? 5 : offspringCount >= 5 ? 3 : 0,
      offspringPerformance: 0, // Placeholder for future implementation
    },
  };
}

/**
 * Calculate legacy grade based on total score
 * @param {number} totalScore - Total legacy score
 * @returns {string} Legacy grade (S, A, B, C, D)
 */
function calculateLegacyGrade(totalScore) {
  if (totalScore >= 90) return 'S'; // Legendary
  if (totalScore >= 80) return 'A'; // Exceptional
  if (totalScore >= 70) return 'B'; // Outstanding
  if (totalScore >= 60) return 'C'; // Good
  if (totalScore >= 50) return 'D'; // Average
  return 'F'; // Below Average
}

/**
 * Get legacy score summary for multiple horses
 * @param {Array} horseIds - Array of horse IDs
 * @returns {Array} Array of legacy score summaries
 */
export async function calculateMultipleLegacyScores(horseIds) {
  try {
    logger.info(`[legacyScoreCalculator.calculateMultipleLegacyScores] Calculating legacy scores for ${horseIds.length} horses`);

    const results = await Promise.all(
      horseIds.map(async (horseId) => {
        try {
          return await calculateLegacyScore(horseId);
        } catch (error) {
          logger.error(`[legacyScoreCalculator.calculateMultipleLegacyScores] Error calculating score for horse ${horseId}: ${error.message}`);
          return {
            horseId,
            error: error.message,
            totalScore: 0,
            grade: 'F',
          };
        }
      })
    );

    logger.info(`[legacyScoreCalculator.calculateMultipleLegacyScores] Calculated ${results.length} legacy scores`);

    return results;
  } catch (error) {
    logger.error(`[legacyScoreCalculator.calculateMultipleLegacyScores] Error calculating multiple legacy scores: ${error.message}`);
    throw error;
  }
}

/**
 * Get legacy score definitions and scoring rules
 * @returns {Object} Legacy score system definitions
 */
export function getLegacyScoreDefinitions() {
  return {
    maxScores: {
      baseStats: MAX_BASE_STATS_SCORE,
      achievements: MAX_ACHIEVEMENTS_SCORE,
      traitScore: MAX_TRAIT_SCORE,
      breedingValue: MAX_BREEDING_VALUE_SCORE,
      total: MAX_TOTAL_SCORE,
    },
    grades: {
      S: { min: 90, name: 'Legendary', description: 'Exceptional legacy with outstanding achievements' },
      A: { min: 80, name: 'Exceptional', description: 'Superior legacy with excellent performance' },
      B: { min: 70, name: 'Outstanding', description: 'Strong legacy with notable achievements' },
      C: { min: 60, name: 'Good', description: 'Solid legacy with respectable performance' },
      D: { min: 50, name: 'Average', description: 'Moderate legacy with basic achievements' },
      F: { min: 0, name: 'Below Average', description: 'Limited legacy development' },
    },
    components: {
      baseStats: 'Average of all 10 core stats (max 30 points)',
      achievements: 'Competition wins and performance records (max 25 points)',
      traitScore: 'Quality and diversity of trait development (max 25 points)',
      breedingValue: 'Breeding activity and offspring success (max 20 points)',
    },
  };
}
