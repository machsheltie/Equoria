/**
 * Breeding Prediction Service
 *
 * Service for calculating inheritance probabilities and breeding predictions based on
 * parent trait development history. This service provides epigenetic preview functionality
 * for the breeding screen, analyzing trait inheritance, flag inheritance scores, and
 * child prediction algorithms.
 *
 * Features:
 * - Inheritance probability logic based on trait_history_log
 * - Trait summary generation for breeding parents
 * - Flag inheritance score calculation
 * - Epigenetic flag analysis and inheritance prediction
 * - Temperament and influence modifier calculations
 * - Child prediction algorithms with probability ranges
 *
 * Business Rules:
 * - Flag inheritance odds capped at 50% without trait stacking
 * - Trait stacking can increase probabilities up to 75%
 * - Only traits before age 4 are considered for inheritance
 * - Preview is an estimate with confidence levels
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Constants for inheritance calculations
const AGE_CUTOFF_DAYS = 1460; // 4 years in days
const BASE_INHERITANCE_RATE = 25; // Base 25% inheritance chance
const MAX_INHERITANCE_RATE = 75; // Maximum with stacking
const MAX_SINGLE_TRAIT_RATE = 50; // Maximum without stacking

// Trait categorization for prediction
const TRAIT_CATEGORIES = {
  empathy: ['sensitive', 'empathic', 'gentle', 'caring', 'intuitive'],
  boldness: ['bold', 'brave', 'confident', 'fearless', 'daring'],
  intelligence: ['quick_learner', 'clever', 'smart', 'wise', 'analytical'],
  physical: ['athletic', 'strong', 'agile', 'fast', 'enduring'],
  temperament: ['calm', 'spirited', 'gentle', 'fiery', 'steady'],
  social: ['charismatic', 'friendly', 'leader', 'cooperative', 'outgoing'],
};

const RARE_TRAITS = [
  'sensitive', 'noble', 'legacy_talent', 'exceptional', 'prodigy',
  'natural_leader', 'empathic', 'intuitive', 'charismatic', 'legendary',
];

const NEGATIVE_TRAITS = [
  'stubborn', 'anxious', 'aggressive', 'fearful', 'lazy', 'unpredictable',
  'difficult', 'nervous', 'spooky', 'resistant',
];

/**
 * Calculate inheritance probabilities from parent trait history
 * @param {number} stallionId - ID of the stallion
 * @param {number} mareId - ID of the mare
 * @returns {Object} Inheritance probability analysis
 */
export async function calculateInheritanceProbabilities(stallionId, mareId) {
  try {
    logger.info(`[breedingPredictionService.calculateInheritanceProbabilities] Calculating inheritance for stallion ${stallionId} and mare ${mareId}`);

    // Get trait history for both parents (before age 4)
    const stallionTraits = await prisma.traitHistoryLog.findMany({
      where: {
        horseId: stallionId,
        ageInDays: { lt: AGE_CUTOFF_DAYS },
      },
      orderBy: { ageInDays: 'asc' },
    });

    const mareTraits = await prisma.traitHistoryLog.findMany({
      where: {
        horseId: mareId,
        ageInDays: { lt: AGE_CUTOFF_DAYS },
      },
      orderBy: { ageInDays: 'asc' },
    });

    // Combine all traits and calculate inheritance probabilities
    const allTraits = [...stallionTraits, ...mareTraits];
    const traitMap = new Map();

    // Process each trait and calculate inheritance probability
    allTraits.forEach(trait => {
      const key = trait.traitName;
      if (!traitMap.has(key)) {
        traitMap.set(key, {
          traitName: trait.traitName,
          stallionHas: false,
          mareHas: false,
          stallionData: null,
          mareData: null,
          isRare: RARE_TRAITS.includes(trait.traitName),
          isNegative: NEGATIVE_TRAITS.includes(trait.traitName),
          isEpigenetic: trait.isEpigenetic,
        });
      }

      const traitData = traitMap.get(key);
      if (trait.horseId === stallionId) {
        traitData.stallionHas = true;
        traitData.stallionData = trait;
      } else {
        traitData.mareHas = true;
        traitData.mareData = trait;
      }
    });

    // Calculate probabilities for each trait
    const traitProbabilities = Array.from(traitMap.values()).map(trait => {
      let probability = 0;
      let hasStacking = false;
      let stackingBonus = 0;

      if (trait.stallionHas && trait.mareHas) {
        // Both parents have trait - stacking bonus
        probability = BASE_INHERITANCE_RATE + 25; // 50% base for both parents
        stackingBonus = 15; // Additional 15% for stacking
        probability = Math.min(probability + stackingBonus, MAX_INHERITANCE_RATE);
        hasStacking = true;
      } else if (trait.stallionHas || trait.mareHas) {
        // One parent has trait
        probability = BASE_INHERITANCE_RATE;

        // Bonus for rare traits
        if (trait.isRare) {
          probability += 10;
        }

        // Penalty for negative traits
        if (trait.isNegative) {
          probability -= 5;
        }

        // Bonus for epigenetic traits
        if (trait.isEpigenetic) {
          probability += 5;
        }

        probability = Math.min(probability, MAX_SINGLE_TRAIT_RATE);
      }

      return {
        traitName: trait.traitName,
        probability: Math.max(0, probability),
        hasStacking,
        stackingBonus,
        isRare: trait.isRare,
        isNegative: trait.isNegative,
        isEpigenetic: trait.isEpigenetic,
        parentSources: {
          stallion: trait.stallionHas,
          mare: trait.mareHas,
        },
        sourceData: {
          stallion: trait.stallionData,
          mare: trait.mareData,
        },
      };
    }).filter(trait => trait.probability > 0);

    // Calculate summary statistics
    const summary = {
      totalTraitsConsidered: traitProbabilities.length,
      epigeneticTraits: traitProbabilities.filter(t => t.isEpigenetic).length,
      rareTraits: traitProbabilities.filter(t => t.isRare).length,
      negativeTraits: traitProbabilities.filter(t => t.isNegative).length,
      stackingTraits: traitProbabilities.filter(t => t.hasStacking).length,
      averageInheritanceChance: traitProbabilities.length > 0
        ? traitProbabilities.reduce((sum, t) => sum + t.probability, 0) / traitProbabilities.length
        : 0,
    };

    const result = {
      stallionId,
      mareId,
      traitProbabilities,
      summary,
      hasInsufficientData: traitProbabilities.length === 0,
      calculatedAt: new Date(),
    };

    logger.info(`[breedingPredictionService.calculateInheritanceProbabilities] Calculated ${traitProbabilities.length} trait probabilities`);

    return result;
  } catch (error) {
    logger.error(`[breedingPredictionService.calculateInheritanceProbabilities] Error calculating inheritance: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate flag inheritance score based on trait categories
 * @param {number} stallionId - ID of the stallion
 * @param {number} mareId - ID of the mare
 * @returns {Object} Flag inheritance analysis
 */
export async function calculateFlagInheritanceScore(stallionId, mareId) {
  try {
    logger.info(`[breedingPredictionService.calculateFlagInheritanceScore] Calculating flag inheritance for stallion ${stallionId} and mare ${mareId}`);

    const inheritanceData = await calculateInheritanceProbabilities(stallionId, mareId);

    // Categorize traits by type
    const inheritanceCategories = {};
    Object.keys(TRAIT_CATEGORIES).forEach(category => {
      inheritanceCategories[category] = 0;
    });

    inheritanceData.traitProbabilities.forEach(trait => {
      Object.entries(TRAIT_CATEGORIES).forEach(([category, traits]) => {
        if (traits.includes(trait.traitName)) {
          inheritanceCategories[category] += trait.probability;
        }
      });
    });

    // Calculate flag scores for each parent
    const stallionFlags = await calculateIndividualFlags(stallionId);
    const mareFlags = await calculateIndividualFlags(mareId);

    // Calculate combined inheritance score
    const combinedScore = Object.values(inheritanceCategories).reduce((sum, score) => sum + score, 0) / Object.keys(inheritanceCategories).length;

    const result = {
      stallionId,
      mareId,
      stallionFlags,
      mareFlags,
      inheritanceCategories,
      combinedScore,
      calculatedAt: new Date(),
    };

    logger.info(`[breedingPredictionService.calculateFlagInheritanceScore] Calculated flag inheritance score: ${combinedScore.toFixed(1)}`);

    return result;
  } catch (error) {
    logger.error(`[breedingPredictionService.calculateFlagInheritanceScore] Error calculating flag inheritance: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate individual flag scores for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Individual flag analysis
 */
async function calculateIndividualFlags(horseId) {
  const traits = await prisma.traitHistoryLog.findMany({
    where: {
      horseId,
      ageInDays: { lt: AGE_CUTOFF_DAYS },
    },
  });

  const flags = {};
  Object.keys(TRAIT_CATEGORIES).forEach(category => {
    flags[category] = traits.filter(trait =>
      TRAIT_CATEGORIES[category].includes(trait.traitName),
    ).length;
  });

  return {
    horseId,
    flags,
    totalFlags: Object.values(flags).reduce((sum, count) => sum + count, 0),
    dominantCategories: Object.entries(flags)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category),
  };
}

/**
 * Calculate temperament influence and compatibility
 * @param {number} stallionId - ID of the stallion
 * @param {number} mareId - ID of the mare
 * @returns {Object} Temperament influence analysis
 */
export async function calculateTemperamentInfluence(stallionId, mareId) {
  try {
    logger.info(`[breedingPredictionService.calculateTemperamentInfluence] Calculating temperament influence for stallion ${stallionId} and mare ${mareId}`);

    // Get horse temperaments
    const stallion = await prisma.horse.findUnique({
      where: { id: stallionId },
      select: { temperament: true },
    });

    const mare = await prisma.horse.findUnique({
      where: { id: mareId },
      select: { temperament: true },
    });

    if (!stallion || !mare) {
      throw new Error('Horse not found');
    }

    // Calculate compatibility score
    const compatibilityMatrix = {
      'calm-calm': 85,
      'calm-spirited': 70,
      'calm-gentle': 90,
      'spirited-spirited': 60,
      'spirited-calm': 70,
      'spirited-gentle': 65,
      'gentle-gentle': 95,
      'gentle-calm': 90,
      'gentle-spirited': 65,
    };

    const compatibilityKey = `${stallion.temperament}-${mare.temperament}`;
    const compatibilityScore = compatibilityMatrix[compatibilityKey] || 50;

    // Predict offspring temperament
    const temperamentPredictions = {
      'calm-calm': ['calm', 'gentle'],
      'calm-spirited': ['calm', 'spirited', 'balanced'],
      'spirited-spirited': ['spirited', 'fiery'],
      'gentle-gentle': ['gentle', 'calm'],
    };

    const predictedOffspringTemperament = temperamentPredictions[compatibilityKey] || ['balanced'];

    // Calculate trait influence modifiers
    const traitInfluenceModifiers = {
      boldness: stallion.temperament === 'spirited' ? 1.2 : mare.temperament === 'spirited' ? 1.1 : 1.0,
      empathy: mare.temperament === 'gentle' ? 1.3 : stallion.temperament === 'gentle' ? 1.2 : 1.0,
      calmness: stallion.temperament === 'calm' ? 1.2 : mare.temperament === 'calm' ? 1.1 : 1.0,
      energy: stallion.temperament === 'spirited' ? 1.3 : mare.temperament === 'spirited' ? 1.2 : 1.0,
    };

    const result = {
      stallionId,
      mareId,
      stallionTemperament: stallion.temperament,
      mareTemperament: mare.temperament,
      compatibilityScore,
      predictedOffspringTemperament,
      traitInfluenceModifiers,
      calculatedAt: new Date(),
    };

    logger.info(`[breedingPredictionService.calculateTemperamentInfluence] Calculated temperament compatibility: ${compatibilityScore}`);

    return result;
  } catch (error) {
    logger.error(`[breedingPredictionService.calculateTemperamentInfluence] Error calculating temperament influence: ${error.message}`);
    throw error;
  }
}

/**
 * Predict offspring traits with probability ranges
 * @param {number} stallionId - ID of the stallion
 * @param {number} mareId - ID of the mare
 * @returns {Object} Offspring trait predictions
 */
export async function predictOffspringTraits(stallionId, mareId) {
  try {
    logger.info(`[breedingPredictionService.predictOffspringTraits] Predicting offspring traits for stallion ${stallionId} and mare ${mareId}`);

    const inheritanceData = await calculateInheritanceProbabilities(stallionId, mareId);
    const flagData = await calculateFlagInheritanceScore(stallionId, mareId);

    // Calculate category probabilities
    const categoryProbabilities = flagData.inheritanceCategories;

    // Estimate trait count based on parent trait counts
    const parentTraitCounts = inheritanceData.summary.totalTraitsConsidered;
    const estimatedTraitCount = {
      min: Math.max(1, Math.floor(parentTraitCounts * 0.3)),
      max: Math.min(8, Math.ceil(parentTraitCounts * 0.7)),
      expected: Math.round(parentTraitCounts * 0.5),
    };

    // Calculate confidence level
    const confidenceLevel = inheritanceData.hasInsufficientData ? 'low'
      : parentTraitCounts >= 6 ? 'high'
        : parentTraitCounts >= 3 ? 'medium'
          : 'low';

    const result = {
      stallionId,
      mareId,
      categoryProbabilities,
      estimatedTraitCount,
      confidenceLevel,
      isEstimate: true,
      parentTraitData: {
        totalParentTraits: parentTraitCounts,
        epigeneticTraits: inheritanceData.summary.epigeneticTraits,
        rareTraits: inheritanceData.summary.rareTraits,
      },
      calculatedAt: new Date(),
    };

    logger.info(`[breedingPredictionService.predictOffspringTraits] Predicted ${estimatedTraitCount.expected} traits with ${confidenceLevel} confidence`);

    return result;
  } catch (error) {
    logger.error(`[breedingPredictionService.predictOffspringTraits] Error predicting offspring traits: ${error.message}`);
    throw error;
  }
}

/**
 * Generate comprehensive breeding data for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Complete breeding data summary
 */
export async function generateBreedingData(horseId) {
  try {
    logger.info(`[breedingPredictionService.generateBreedingData] Generating breeding data for horse ${horseId}`);

    // Get horse basic info
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        sex: true,
        temperament: true,
        epigeneticModifiers: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Get trait history for summary
    const traitHistory = await prisma.traitHistoryLog.findMany({
      where: {
        horseId,
        ageInDays: { lt: AGE_CUTOFF_DAYS },
      },
      orderBy: { ageInDays: 'asc' },
    });

    // Calculate trait summary
    const traitSummary = {
      totalTraits: traitHistory.length,
      epigeneticTraits: traitHistory.filter(t => t.isEpigenetic).length,
      rareTraits: traitHistory.filter(t => RARE_TRAITS.includes(t.traitName)).length,
      negativeTraits: traitHistory.filter(t => NEGATIVE_TRAITS.includes(t.traitName)).length,
      traitsByCategory: {},
      traitsBySource: {
        milestone: traitHistory.filter(t => t.sourceType === 'milestone').length,
        groom: traitHistory.filter(t => t.sourceType === 'groom').length,
        breeding: traitHistory.filter(t => t.sourceType === 'breeding').length,
        environmental: traitHistory.filter(t => t.sourceType === 'environmental').length,
      },
      averageBondScore: traitHistory.length > 0
        ? traitHistory.reduce((sum, t) => sum + (t.bondScore || 50), 0) / traitHistory.length
        : 50,
      averageInfluenceScore: traitHistory.length > 0
        ? traitHistory.reduce((sum, t) => sum + (t.influenceScore || 0), 0) / traitHistory.length
        : 0,
    };

    // Categorize traits
    Object.keys(TRAIT_CATEGORIES).forEach(category => {
      traitSummary.traitsByCategory[category] = traitHistory.filter(trait =>
        TRAIT_CATEGORIES[category].includes(trait.traitName),
      ).length;
    });

    // Calculate individual flag inheritance score
    const flagInheritanceScore = await calculateIndividualFlags(horseId);

    // Extract epigenetic flags from horse data
    const epigeneticFlags = {
      positive: horse.epigeneticModifiers?.positive || [],
      negative: horse.epigeneticModifiers?.negative || [],
      hidden: horse.epigeneticModifiers?.hidden || [],
      totalFlags: (horse.epigeneticModifiers?.positive?.length || 0) +
                  (horse.epigeneticModifiers?.negative?.length || 0) +
                  (horse.epigeneticModifiers?.hidden?.length || 0),
    };

    // Calculate temperament influence data
    const temperamentInfluence = {
      temperament: horse.temperament,
      traitAffinities: {
        boldness: horse.temperament === 'spirited' ? 'high' : horse.temperament === 'calm' ? 'low' : 'medium',
        empathy: horse.temperament === 'gentle' ? 'high' : horse.temperament === 'spirited' ? 'low' : 'medium',
        calmness: horse.temperament === 'calm' ? 'high' : horse.temperament === 'spirited' ? 'low' : 'medium',
        energy: horse.temperament === 'spirited' ? 'high' : horse.temperament === 'calm' ? 'low' : 'medium',
      },
      breedingCompatibility: {
        bestMatches: getCompatibleTemperaments(horse.temperament),
        worstMatches: getIncompatibleTemperaments(horse.temperament),
      },
    };

    const result = {
      horseId,
      horseName: horse.name,
      sex: horse.sex,
      traitSummary,
      flagInheritanceScore,
      epigeneticFlags,
      temperamentInfluence,
      hasInsufficientData: traitHistory.length === 0,
      breedingQuality: calculateBreedingQuality(traitSummary, epigeneticFlags),
      generatedAt: new Date(),
    };

    logger.info(`[breedingPredictionService.generateBreedingData] Generated breeding data for horse ${horseId} with ${traitSummary.totalTraits} traits`);

    return result;
  } catch (error) {
    logger.error(`[breedingPredictionService.generateBreedingData] Error generating breeding data for horse ${horseId}: ${error.message}`);
    throw error;
  }
}

/**
 * Get compatible temperaments for breeding
 * @param {string} temperament - Horse temperament
 * @returns {Array} Compatible temperaments
 */
function getCompatibleTemperaments(temperament) {
  const compatibility = {
    calm: ['gentle', 'calm', 'spirited'],
    spirited: ['calm', 'spirited'],
    gentle: ['calm', 'gentle'],
  };
  return compatibility[temperament] || ['calm', 'gentle'];
}

/**
 * Get incompatible temperaments for breeding
 * @param {string} temperament - Horse temperament
 * @returns {Array} Incompatible temperaments
 */
function getIncompatibleTemperaments(temperament) {
  const incompatibility = {
    calm: [],
    spirited: ['aggressive'],
    gentle: ['aggressive'],
  };
  return incompatibility[temperament] || [];
}

/**
 * Calculate overall breeding quality score
 * @param {Object} traitSummary - Trait summary data
 * @param {Object} epigeneticFlags - Epigenetic flags data
 * @returns {string} Breeding quality assessment
 */
function calculateBreedingQuality(traitSummary, epigeneticFlags) {
  let score = 0;

  // Trait quantity (max 3 points)
  if (traitSummary.totalTraits >= 6) { score += 3; } else if (traitSummary.totalTraits >= 4) { score += 2; } else if (traitSummary.totalTraits >= 2) { score += 1; }

  // Rare traits (max 2 points)
  if (traitSummary.rareTraits >= 2) { score += 2; } else if (traitSummary.rareTraits >= 1) { score += 1; }

  // Epigenetic flags (max 2 points)
  if (epigeneticFlags.totalFlags >= 3) { score += 2; } else if (epigeneticFlags.totalFlags >= 1) { score += 1; }

  // Negative trait penalty
  score -= traitSummary.negativeTraits;

  // Bond score bonus (max 1 point)
  if (traitSummary.averageBondScore >= 80) { score += 1; }

  // Determine quality level
  if (score >= 7) { return 'exceptional'; }
  if (score >= 5) { return 'excellent'; }
  if (score >= 3) { return 'good'; }
  if (score >= 1) { return 'fair'; }
  return 'poor';
}
