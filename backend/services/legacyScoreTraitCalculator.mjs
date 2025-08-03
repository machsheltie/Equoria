/**
 * Legacy Score Trait Calculator Service
 * 
 * Service for calculating trait-based scoring components of a horse's legacy score.
 * This service analyzes trait development history to determine the depth and quality
 * of a horse's trait development, influencing its value as a breeder and prestige record.
 * 
 * Features:
 * - Trait count scoring (max 10 points)
 * - Trait diversity scoring (max 5 points)
 * - Rare trait bonus scoring (max 10 points)
 * - Groom care consistency scoring (max 5 points)
 * - Negative trait penalties
 * - Age-based trait filtering (only traits before age 4)
 * 
 * Business Rules:
 * - Only traits gained before age 4 (1460 days) count toward legacy score
 * - Negative traits reduce score (-1 to -3 each)
 * - Rare trait cap bonus: max 10 points from rare category
 * - Groom care consistency based on milestone evaluation data
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Constants for trait scoring
const MAX_TRAIT_COUNT_SCORE = 10;
const MAX_DIVERSITY_SCORE = 5;
const MAX_RARE_TRAIT_SCORE = 10;
const MAX_GROOM_CARE_SCORE = 5;
const AGE_CUTOFF_DAYS = 1460; // 4 years in days

// Trait categorization
const RARE_TRAITS = [
  'sensitive', 'noble', 'legacy_talent', 'exceptional', 'prodigy',
  'natural_leader', 'empathic', 'intuitive', 'charismatic', 'legendary'
];

const NEGATIVE_TRAITS = [
  'stubborn', 'anxious', 'aggressive', 'fearful', 'lazy', 'unpredictable',
  'difficult', 'nervous', 'spooky', 'resistant'
];

const NEGATIVE_TRAIT_PENALTIES = {
  'stubborn': -2,
  'anxious': -1,
  'aggressive': -3,
  'fearful': -2,
  'lazy': -2,
  'unpredictable': -3,
  'difficult': -2,
  'nervous': -1,
  'spooky': -1,
  'resistant': -2,
};

/**
 * Calculate trait score for a horse's legacy score
 * @param {number} horseId - ID of the horse
 * @returns {Object} Trait score breakdown and total
 */
export async function calculateTraitScore(horseId) {
  try {
    logger.info(`[legacyScoreTraitCalculator.calculateTraitScore] Calculating trait score for horse ${horseId}`);

    // Get trait history for traits gained before age 4
    const traitHistory = await prisma.traitHistoryLog.findMany({
      where: {
        horseId,
        ageInDays: {
          lt: AGE_CUTOFF_DAYS, // Only traits before age 4
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Get milestone evaluation data for groom care consistency
    const milestoneData = await prisma.milestoneTraitLog.findMany({
      where: { horseId },
      orderBy: { timestamp: 'asc' },
    });

    // Separate traits by type
    const traitsConsidered = traitHistory.filter(t => t.ageInDays < AGE_CUTOFF_DAYS);
    const traitsExcluded = await prisma.traitHistoryLog.findMany({
      where: {
        horseId,
        ageInDays: {
          gte: AGE_CUTOFF_DAYS, // Traits after age 4
        },
      },
    });

    // Calculate trait count score (max 10 points)
    const traitCount = traitsConsidered.length;
    const traitCountScore = Math.min(traitCount, MAX_TRAIT_COUNT_SCORE);

    // Calculate diversity score (max 5 points)
    const sourceTypes = new Set(traitsConsidered.map(t => t.sourceType));
    const diversityScore = Math.min(sourceTypes.size, MAX_DIVERSITY_SCORE);

    // Calculate rare trait score (max 10 points)
    const rareTraits = traitsConsidered.filter(t => RARE_TRAITS.includes(t.traitName));
    const rareTraitScore = Math.min(rareTraits.length * 3, MAX_RARE_TRAIT_SCORE); // 3 points per rare trait

    // Calculate negative trait penalties
    const negativeTraits = traitsConsidered.filter(t => NEGATIVE_TRAITS.includes(t.traitName));
    const negativeTraitPenalty = negativeTraits.reduce((penalty, trait) => {
      return penalty + (NEGATIVE_TRAIT_PENALTIES[trait.traitName] || -1);
    }, 0);

    // Calculate groom care consistency score (max 5 points)
    const groomCareScore = calculateGroomCareConsistency(milestoneData);

    // Calculate total trait score
    const totalScore = Math.max(0, 
      traitCountScore + 
      diversityScore + 
      rareTraitScore + 
      groomCareScore + 
      negativeTraitPenalty
    );

    const result = {
      totalScore,
      maxScore: MAX_TRAIT_COUNT_SCORE + MAX_DIVERSITY_SCORE + MAX_RARE_TRAIT_SCORE + MAX_GROOM_CARE_SCORE,
      breakdown: {
        traitCount: traitCountScore,
        diversity: diversityScore,
        rareTraits: rareTraitScore,
        groomCareConsistency: groomCareScore,
        negativeTraitPenalty,
        traitsConsidered: traitsConsidered.map(t => ({
          name: t.traitName,
          sourceType: t.sourceType,
          ageInDays: t.ageInDays,
          isRare: RARE_TRAITS.includes(t.traitName),
          isNegative: NEGATIVE_TRAITS.includes(t.traitName),
        })),
        traitsExcluded: traitsExcluded.map(t => ({
          name: t.traitName,
          ageInDays: t.ageInDays,
          reason: 'Too old (after age 4)',
        })),
        milestoneData: milestoneData.map(m => ({
          milestoneType: m.milestoneType,
          taskConsistency: m.taskConsistency,
          taskDiversity: m.taskDiversity,
          bondScore: m.bondScore,
        })),
        sourceTypes: Array.from(sourceTypes),
        rareTraitNames: rareTraits.map(t => t.traitName),
        negativeTraitNames: negativeTraits.map(t => t.traitName),
      },
    };

    logger.info(`[legacyScoreTraitCalculator.calculateTraitScore] Calculated trait score ${totalScore}/${result.maxScore} for horse ${horseId}`);

    return result;
  } catch (error) {
    logger.error(`[legacyScoreTraitCalculator.calculateTraitScore] Error calculating trait score for horse ${horseId}: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate groom care consistency score from milestone data
 * @param {Array} milestoneData - Array of milestone trait logs
 * @returns {number} Groom care consistency score (0-5)
 */
function calculateGroomCareConsistency(milestoneData) {
  if (milestoneData.length === 0) {
    return 0;
  }

  // Calculate average task consistency and diversity
  const avgTaskConsistency = milestoneData.reduce((sum, m) => sum + (m.taskConsistency || 0), 0) / milestoneData.length;
  const avgTaskDiversity = milestoneData.reduce((sum, m) => sum + (m.taskDiversity || 0), 0) / milestoneData.length;
  const avgBondScore = milestoneData.reduce((sum, m) => sum + (m.bondScore || 50), 0) / milestoneData.length;

  // Score based on consistency and diversity (0-10 scale each)
  const consistencyScore = avgTaskConsistency / 10; // Convert to 0-1 scale
  const diversityScore = avgTaskDiversity / 10; // Convert to 0-1 scale
  const bondScore = (avgBondScore - 50) / 50; // Convert to 0-1 scale (50-100 -> 0-1)

  // Weighted average: 40% consistency, 30% diversity, 30% bond
  const combinedScore = (consistencyScore * 0.4) + (diversityScore * 0.3) + (Math.max(0, bondScore) * 0.3);

  // Scale to 0-5 points
  return Math.round(combinedScore * MAX_GROOM_CARE_SCORE);
}

/**
 * Get trait score summary for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Summary of trait scoring potential
 */
export async function getTraitScoreSummary(horseId) {
  try {
    logger.info(`[legacyScoreTraitCalculator.getTraitScoreSummary] Getting trait score summary for horse ${horseId}`);

    const traitScore = await calculateTraitScore(horseId);
    
    const summary = {
      horseId,
      currentScore: traitScore.totalScore,
      maxPossibleScore: traitScore.maxScore,
      percentage: (traitScore.totalScore / traitScore.maxScore) * 100,
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };

    // Identify strengths
    if (traitScore.breakdown.rareTraits > 5) {
      summary.strengths.push('Exceptional rare trait collection');
    }
    if (traitScore.breakdown.diversity >= 4) {
      summary.strengths.push('Excellent trait source diversity');
    }
    if (traitScore.breakdown.groomCareConsistency >= 4) {
      summary.strengths.push('Outstanding groom care consistency');
    }

    // Identify weaknesses
    if (traitScore.breakdown.negativeTraitPenalty < -3) {
      summary.weaknesses.push('Significant negative trait burden');
    }
    if (traitScore.breakdown.traitCount < 3) {
      summary.weaknesses.push('Limited trait development');
    }
    if (traitScore.breakdown.groomCareConsistency < 2) {
      summary.weaknesses.push('Inconsistent early care');
    }

    // Generate recommendations
    if (traitScore.breakdown.traitCount < MAX_TRAIT_COUNT_SCORE) {
      summary.recommendations.push('Focus on trait development before age 4');
    }
    if (traitScore.breakdown.diversity < MAX_DIVERSITY_SCORE) {
      summary.recommendations.push('Diversify trait sources (milestone, groom, environmental)');
    }
    if (traitScore.breakdown.rareTraits === 0) {
      summary.recommendations.push('Work toward acquiring rare traits');
    }

    logger.info(`[legacyScoreTraitCalculator.getTraitScoreSummary] Generated summary for horse ${horseId}: ${summary.currentScore}/${summary.maxPossibleScore} (${summary.percentage.toFixed(1)}%)`);

    return summary;
  } catch (error) {
    logger.error(`[legacyScoreTraitCalculator.getTraitScoreSummary] Error generating summary for horse ${horseId}: ${error.message}`);
    throw error;
  }
}

/**
 * Get trait scoring definitions and constants
 * @returns {Object} Trait scoring system definitions
 */
export function getTraitScoringDefinitions() {
  return {
    maxScores: {
      traitCount: MAX_TRAIT_COUNT_SCORE,
      diversity: MAX_DIVERSITY_SCORE,
      rareTraits: MAX_RARE_TRAIT_SCORE,
      groomCare: MAX_GROOM_CARE_SCORE,
      total: MAX_TRAIT_COUNT_SCORE + MAX_DIVERSITY_SCORE + MAX_RARE_TRAIT_SCORE + MAX_GROOM_CARE_SCORE,
    },
    ageCutoff: {
      days: AGE_CUTOFF_DAYS,
      years: AGE_CUTOFF_DAYS / 365,
    },
    rareTraits: RARE_TRAITS,
    negativeTraits: NEGATIVE_TRAITS,
    negativeTraitPenalties: NEGATIVE_TRAIT_PENALTIES,
    scoringRules: {
      traitCount: 'Each trait before age 4 = 1 point (max 10)',
      diversity: 'Each unique source type = 1 point (max 5)',
      rareTraits: 'Each rare trait = 3 points (max 10)',
      groomCare: 'Based on milestone consistency and bond scores (max 5)',
      negativeTraits: 'Penalties range from -1 to -3 per negative trait',
    },
  };
}
