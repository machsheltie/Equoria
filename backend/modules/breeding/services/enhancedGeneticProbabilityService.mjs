/**
 * Enhanced Genetic Probability Service
 *
 * This service provides advanced genetic probability calculations for breeding predictions,
 * including trait inheritance analysis, genetic compatibility scoring, and performance prediction.
 */

import logger from '../../../utils/logger.mjs';
import { HORSE_STAT_VALUES } from '../../../constants/schema.mjs';
import { asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';
// Equoria-urqic.4: diversity/inbreeding/health and discipline-performance
// sub-calculations lifted into focused genetics/ modules. The facade delegates
// to keep the public export surface unchanged.
import { computeGeneticDiversityImpact } from './genetics/geneticDiversityImpact.mjs';
import { computeOffspringPerformance } from './genetics/offspringPerformancePrediction.mjs';
// Equoria-urqic.4.1: the Monte-Carlo breeding-simulation cluster
// (seeded RNG + single-outcome + statistics/confidence aggregation) lives in
// genetics/breedingSimulation.mjs. The facade injects its own
// calculateEnhancedGeneticProbabilities so the module needs no back-reference
// to this facade (avoids a circular import).
import { computeBreedingSimulation } from './genetics/breedingSimulation.mjs';
// Equoria-urqic.4.2: the multi-generational prediction cluster (per-generation
// weighted trait influence + lineage-pattern strengths/weaknesses/score over
// in-memory lineage.generations[].horses[]) lives in
// genetics/multiGenerationalPredictions.mjs. These are object-based calcs — NOT
// consolidated into advancedLineageAnalysisService (DB/ID-based, different data
// shape). The facade keeps the logging and delegates the computation.
import { computeMultiGenerationalPredictions } from './genetics/multiGenerationalPredictions.mjs';

// Genetic calculation constants
const GENETIC_CONSTANTS = {
  TRAIT_INHERITANCE_BASE_PROBABILITY: 50,
  SHARED_TRAIT_BONUS: 25,
  STAT_INHERITANCE_VARIANCE: 10,
  // Equoria-urqic.4.2: GENERATION_WEIGHT_DECAY moved to
  // genetics/multiGenerationalPredictions.mjs (MULTI_GEN_CONSTANTS) along with
  // the multi-generational cluster.
  INBREEDING_THRESHOLD: 0.125,
  DIVERSITY_BONUS_THRESHOLD: 0.8,
};

// Trait interaction definitions
const TRAIT_INTERACTIONS = {
  synergistic: [
    { traits: ['athletic', 'intelligent'], bonus: 15 },
    { traits: ['calm', 'focused'], bonus: 12 },
    { traits: ['resilient', 'bold'], bonus: 10 },
    { traits: ['agile', 'athletic'], bonus: 8 },
  ],
  antagonistic: [
    { traits: ['calm', 'nervous'], penalty: -20 },
    { traits: ['bold', 'timid'], penalty: -15 },
    { traits: ['focused', 'distracted'], penalty: -12 },
  ],
};

/**
 * Calculate enhanced genetic probabilities for breeding pair
 */
export function calculateEnhancedGeneticProbabilities(stallion, mare) {
  logger.info('Calculating enhanced genetic probabilities', {
    stallionId: stallion.id,
    mareId: mare.id,
  });

  const traitProbabilities = calculateTraitInheritanceProbabilities(stallion, mare);
  const statProbabilities = calculateStatInheritanceProbabilities(stallion, mare);
  const disciplineProbabilities = calculateDisciplineInheritanceProbabilities(stallion, mare);
  const overallGeneticScore = calculateOverallGeneticScore(stallion, mare);

  return {
    traitProbabilities,
    statProbabilities,
    disciplineProbabilities,
    overallGeneticScore,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate trait inheritance probabilities
 */
function calculateTraitInheritanceProbabilities(stallion, mare) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const allTraits = new Set([
    ...stallionTraits.positive,
    ...stallionTraits.negative,
    ...stallionTraits.hidden,
    ...mareTraits.positive,
    ...mareTraits.negative,
    ...mareTraits.hidden,
  ]);

  const traitProbabilities = {
    positive: [],
    negative: [],
    hidden: [],
  };

  allTraits.forEach(trait => {
    const stallionHas = hasTraitInCategory(stallionTraits, trait);
    const mareHas = hasTraitInCategory(mareTraits, trait);
    const category = getTraitCategory(stallionTraits, mareTraits, trait);

    let probability = GENETIC_CONSTANTS.TRAIT_INHERITANCE_BASE_PROBABILITY;

    // Both parents have trait
    if (stallionHas && mareHas) {
      probability += GENETIC_CONSTANTS.SHARED_TRAIT_BONUS;
    } else if (stallionHas || mareHas) {
      // Only one parent has trait
      probability = GENETIC_CONSTANTS.TRAIT_INHERITANCE_BASE_PROBABILITY;
    } else {
      // Neither parent has trait (recessive possibility)
      probability = 15; // Low probability for recessive traits
    }

    // Apply trait interaction modifiers
    probability = applyTraitInteractionModifiers(trait, stallionTraits, mareTraits, probability);

    if (category && probability > 10) {
      // Only include meaningful probabilities
      traitProbabilities[category].push({
        trait,
        probability: Math.min(95, Math.max(5, probability)), // Cap between 5-95%
        inheritancePattern:
          stallionHas && mareHas
            ? 'dominant'
            : stallionHas || mareHas
              ? 'heterozygous'
              : 'recessive',
      });
    }
  });

  return traitProbabilities;
}

/**
 * Calculate stat inheritance probabilities
 */
function calculateStatInheritanceProbabilities(stallion, mare) {
  // Extract stats from horse objects (they're stored as individual fields, not in a stats object)
  const statNames = HORSE_STAT_VALUES;
  const statProbabilities = {};

  statNames.forEach(stat => {
    // Equoria-yvxkx: ?? not || — `|| 50` corrupts stat-0 (legitimate
    // undeveloped/injury state) for parental stat inheritance, biasing
    // offspring expectedValue upward.
    const stallionValue = stallion[stat] ?? 50;
    const mareValue = mare[stat] ?? 50;

    const averageValue = (stallionValue + mareValue) / 2;
    const variance = GENETIC_CONSTANTS.STAT_INHERITANCE_VARIANCE;

    // Calculate expected range with genetic variance
    const minValue = Math.max(1, averageValue - variance);
    const maxValue = Math.min(100, averageValue + variance);

    // Bias slightly toward higher parent
    const higherParentValue = Math.max(stallionValue, mareValue);
    const expectedValue = averageValue * 0.7 + higherParentValue * 0.3;

    statProbabilities[stat] = {
      expectedValue: Math.round(expectedValue),
      expectedRange: {
        min: Math.round(minValue),
        max: Math.round(maxValue),
      },
      variance,
      distribution: {
        type: 'normal',
        mean: expectedValue,
        standardDeviation: variance / 3,
      },
      parentalContribution: {
        stallion: stallionValue,
        mare: mareValue,
      },
    };
  });

  return statProbabilities;
}

/**
 * Calculate discipline inheritance probabilities
 */
function calculateDisciplineInheritanceProbabilities(stallion, mare) {
  const stallionDisciplines = asFlagObject(stallion.disciplineScores);
  const mareDisciplines = asFlagObject(mare.disciplineScores);
  const disciplineProbabilities = {};

  const allDisciplines = new Set([
    ...Object.keys(stallionDisciplines),
    ...Object.keys(mareDisciplines),
  ]);

  allDisciplines.forEach(discipline => {
    const stallionScore = stallionDisciplines[discipline] || 0;
    const mareScore = mareDisciplines[discipline] || 0;

    if (stallionScore > 0 || mareScore > 0) {
      const averageScore = (stallionScore + mareScore) / 2;
      const potential = Math.max(stallionScore, mareScore);

      disciplineProbabilities[discipline] = {
        expectedScore: Math.round(averageScore),
        potentialScore: Math.round(potential),
        inheritanceStrength: stallionScore > 0 && mareScore > 0 ? 'strong' : 'moderate',
      };
    }
  });

  return disciplineProbabilities;
}

/**
 * Calculate overall genetic score
 */
function calculateOverallGeneticScore(stallion, mare) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  // Ensure all trait arrays exist and are arrays
  const stallionPositive = Array.isArray(stallionTraits.positive) ? stallionTraits.positive : [];
  const stallionNegative = Array.isArray(stallionTraits.negative) ? stallionTraits.negative : [];
  const stallionHidden = Array.isArray(stallionTraits.hidden) ? stallionTraits.hidden : [];

  const marePositive = Array.isArray(mareTraits.positive) ? mareTraits.positive : [];
  const mareNegative = Array.isArray(mareTraits.negative) ? mareTraits.negative : [];
  const mareHidden = Array.isArray(mareTraits.hidden) ? mareTraits.hidden : [];

  let score = 50; // Base score

  // Positive trait bonus
  const sharedPositiveTraits = stallionPositive.filter(trait => marePositive.includes(trait));
  score += sharedPositiveTraits.length * 5;

  // Negative trait penalty
  const sharedNegativeTraits = stallionNegative.filter(trait => mareNegative.includes(trait));
  score -= sharedNegativeTraits.length * 3;

  // Hidden trait bonus
  const totalHiddenTraits = stallionHidden.length + mareHidden.length;
  score += totalHiddenTraits * 2;

  // Stat compatibility bonus
  const stallionStats = stallion.stats || {};
  const mareStats = mare.stats || {};
  const statCompatibility = calculateStatCompatibility(stallionStats, mareStats);
  const compatibilityScore = statCompatibility.balanceScore || 50;
  score += (compatibilityScore - 50) * 0.3;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculate genetic compatibility score between breeding pair
 */
export function calculateGeneticCompatibilityScore(stallion, mare) {
  const traitCompatibility = calculateTraitCompatibility(stallion, mare);
  const statCompatibility = calculateStatCompatibility(stallion.stats || {}, mare.stats || {});
  const disciplineCompatibility = calculateDisciplineCompatibility(stallion, mare);
  const diversityScore = calculateBasicDiversityScore(stallion, mare);

  // Ensure all scores are numbers
  const traitScore = typeof traitCompatibility.score === 'number' ? traitCompatibility.score : 50;
  const statScore =
    typeof statCompatibility.balanceScore === 'number' ? statCompatibility.balanceScore : 50;
  const disciplineScore =
    typeof disciplineCompatibility === 'number' ? disciplineCompatibility : 50;
  const diversityScoreNum = typeof diversityScore === 'number' ? diversityScore : 50;

  const overallScore = Math.round(
    traitScore * 0.3 + statScore * 0.25 + disciplineScore * 0.25 + diversityScoreNum * 0.2,
  );

  return {
    overallScore,
    traitCompatibility,
    statCompatibility: {
      balanceScore: statScore,
      complementaryStats: statCompatibility.complementaryStats || [],
    },
    disciplineCompatibility: disciplineScore,
    diversityScore: diversityScoreNum,
  };
}

/**
 * Calculate trait compatibility
 */
function calculateTraitCompatibility(stallion, mare) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const sharedPositiveTraits = stallionTraits.positive.filter(trait =>
    mareTraits.positive.includes(trait),
  );

  const conflicts = [];

  // Check for trait conflicts (positive vs negative)
  stallionTraits.positive.forEach(trait => {
    if (mareTraits.negative.includes(trait)) {
      conflicts.push({ trait, type: 'positive_negative_conflict' });
    }
  });

  mareTraits.positive.forEach(trait => {
    if (stallionTraits.negative.includes(trait)) {
      conflicts.push({ trait, type: 'positive_negative_conflict' });
    }
  });

  let score = 50;
  score += sharedPositiveTraits.length * 8;
  score -= conflicts.length * 15;

  return {
    score: Math.min(100, Math.max(0, score)),
    sharedPositiveTraits,
    conflicts,
    compatibilityLevel: score > 75 ? 'excellent' : score > 50 ? 'good' : 'poor',
  };
}

/**
 * Calculate stat compatibility
 */
function calculateStatCompatibility(stallionStats, mareStats) {
  const stallionStatsObj = stallionStats || {};
  const mareStatsObj = mareStats || {};

  const allStats = new Set([...Object.keys(stallionStatsObj), ...Object.keys(mareStatsObj)]);
  let totalCompatibility = 0;
  let statCount = 0;

  const complementaryStats = [];

  // If no stats available, return default compatibility
  if (allStats.size === 0) {
    return {
      balanceScore: 50,
      complementaryStats: [],
    };
  }

  allStats.forEach(stat => {
    // Equoria-cdgwd: `?? 50` (not `|| 50`) so a legitimate stat value of 0
    // (undeveloped/injured) is preserved rather than silently boosted to 50,
    // which would corrupt the breeding compatibility score. The typeof guard
    // below still coerces genuinely non-numeric values to 50.
    const stallionValue = stallionStatsObj[stat] ?? 50;
    const mareValue = mareStatsObj[stat] ?? 50;

    // Ensure values are numbers
    const stallionNum = typeof stallionValue === 'number' ? stallionValue : 50;
    const mareNum = typeof mareValue === 'number' ? mareValue : 50;

    // Calculate balance (prefer complementary strengths)
    const _average = (stallionNum + mareNum) / 2;
    const difference = Math.abs(stallionNum - mareNum);

    // Moderate differences are good (complementary), extreme differences are bad
    let compatibility;
    if (difference < 10) {
      compatibility = 70; // Similar levels
    } else if (difference < 25) {
      compatibility = 85; // Complementary strengths
      complementaryStats.push({ stat, stallionValue: stallionNum, mareValue: mareNum });
    } else {
      compatibility = 40; // Too different
    }

    totalCompatibility += compatibility;
    statCount++;
  });

  const balanceScore = statCount > 0 ? totalCompatibility / statCount : 50;

  return {
    balanceScore: Math.round(balanceScore),
    complementaryStats,
  };
}

/**
 * Calculate discipline compatibility
 */
function calculateDisciplineCompatibility(stallion, mare) {
  const stallionDisciplines = asFlagObject(stallion.disciplineScores);
  const mareDisciplines = asFlagObject(mare.disciplineScores);

  const allDisciplines = new Set([
    ...Object.keys(stallionDisciplines),
    ...Object.keys(mareDisciplines),
  ]);

  if (allDisciplines.size === 0) {
    return 50;
  }

  let totalScore = 0;
  let disciplineCount = 0;

  allDisciplines.forEach(discipline => {
    const stallionScore = stallionDisciplines[discipline] || 0;
    const mareScore = mareDisciplines[discipline] || 0;

    if (stallionScore > 0 || mareScore > 0) {
      const averageScore = (stallionScore + mareScore) / 2;
      totalScore += averageScore;
      disciplineCount++;
    }
  });

  return disciplineCount > 0 ? Math.round(totalScore / disciplineCount) : 50;
}

/**
 * Calculate basic diversity score
 */
function calculateBasicDiversityScore(stallion, mare) {
  // Simple diversity calculation based on different traits
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const stallionAllTraits = [
    ...stallionTraits.positive,
    ...stallionTraits.negative,
    ...stallionTraits.hidden,
  ];

  const mareAllTraits = [...mareTraits.positive, ...mareTraits.negative, ...mareTraits.hidden];

  const uniqueTraits = new Set([...stallionAllTraits, ...mareAllTraits]);
  const sharedTraits = stallionAllTraits.filter(trait => mareAllTraits.includes(trait));

  const diversityRatio =
    uniqueTraits.size > 0 ? (uniqueTraits.size - sharedTraits.length) / uniqueTraits.size : 0;

  return Math.round(diversityRatio * 100);
}

/**
 * Helper function to check if horse has trait in any category
 */
function hasTraitInCategory(traits, trait) {
  return (
    traits.positive.includes(trait) ||
    traits.negative.includes(trait) ||
    traits.hidden.includes(trait)
  );
}

/**
 * Helper function to get trait category
 */
function getTraitCategory(stallionTraits, mareTraits, trait) {
  if (stallionTraits.positive.includes(trait) || mareTraits.positive.includes(trait)) {
    return 'positive';
  }
  if (stallionTraits.negative.includes(trait) || mareTraits.negative.includes(trait)) {
    return 'negative';
  }
  if (stallionTraits.hidden.includes(trait) || mareTraits.hidden.includes(trait)) {
    return 'hidden';
  }
  return null;
}

/**
 * Apply trait interaction modifiers
 */
function applyTraitInteractionModifiers(trait, stallionTraits, mareTraits, baseProbability) {
  let modifiedProbability = baseProbability;

  // Check for synergistic interactions
  TRAIT_INTERACTIONS.synergistic.forEach(interaction => {
    if (interaction.traits.includes(trait)) {
      const otherTrait = interaction.traits.find(t => t !== trait);
      if (
        hasTraitInCategory(stallionTraits, otherTrait) ||
        hasTraitInCategory(mareTraits, otherTrait)
      ) {
        modifiedProbability += interaction.bonus * 0.5; // Partial bonus for potential synergy
      }
    }
  });

  // Check for antagonistic interactions
  TRAIT_INTERACTIONS.antagonistic.forEach(interaction => {
    if (interaction.traits.includes(trait)) {
      const otherTrait = interaction.traits.find(t => t !== trait);
      if (
        hasTraitInCategory(stallionTraits, otherTrait) &&
        hasTraitInCategory(mareTraits, otherTrait)
      ) {
        modifiedProbability += interaction.penalty * 0.3; // Reduced penalty for breeding
      }
    }
  });

  return modifiedProbability;
}

/**
 * Helper Functions for Enhanced Genetic Calculations
 */

// Equoria-urqic.4.1: createSeededRandom, calculateOutcomeStatistics,
// calculateConfidenceIntervals, calculatePerformanceFromTraitsAndStats,
// calculateGeneticScoreFromOutcome, and simulateSingleBreedingOutcome were
// lifted into genetics/breedingSimulation.mjs. simulateBreedingOutcomes (below)
// now delegates to computeBreedingSimulation, passing in this facade's
// calculateEnhancedGeneticProbabilities.

// Equoria-urqic.4.2: calculateGenerationTraitInfluence and
// analyzeLineagePatterns were lifted into
// genetics/multiGenerationalPredictions.mjs. calculateMultiGenerationalPredictions
// (below) now delegates to computeMultiGenerationalPredictions.

// Calculate interaction inheritance probability
function calculateInteractionInheritanceProbability(
  stallionHasTrait1,
  stallionHasTrait2,
  mareHasTrait1,
  mareHasTrait2,
) {
  let probability = 0;

  // Both traits from same parent
  if ((stallionHasTrait1 && stallionHasTrait2) || (mareHasTrait1 && mareHasTrait2)) {
    probability = 60; // High chance if one parent has both
  } else if ((stallionHasTrait1 && mareHasTrait2) || (stallionHasTrait2 && mareHasTrait1)) {
    // Traits from different parents
    probability = 35; // Moderate chance for cross-inheritance
  }

  return probability;
}

// Calculate conflict resolution probability
function calculateConflictResolutionProbability(
  stallionHasTrait1,
  stallionHasTrait2,
  mareHasTrait1,
  mareHasTrait2,
) {
  // Higher probability means one trait will dominate over the other
  if ((stallionHasTrait1 && mareHasTrait2) || (stallionHasTrait2 && mareHasTrait1)) {
    return 70; // Cross-parent conflicts often resolve
  } else {
    return 40; // Same-parent conflicts are harder to resolve
  }
}

// Predict trait combinations
function predictTraitCombinations(stallionTraits, mareTraits, synergisticPairs) {
  const combinations = [];

  synergisticPairs.forEach(pair => {
    combinations.push({
      traits: [pair.trait1, pair.trait2],
      probability: pair.inheritanceProbability,
      expectedBonus: pair.synergyBonus,
      type: 'synergistic',
    });
  });

  // Add some individual high-value trait predictions
  const highValueTraits = ['athletic', 'intelligent', 'resilient', 'calm'];
  highValueTraits.forEach(trait => {
    const stallionHas = hasTraitInCategory(stallionTraits, trait);
    const mareHas = hasTraitInCategory(mareTraits, trait);

    if (stallionHas || mareHas) {
      const probability = stallionHas && mareHas ? 75 : 45;
      combinations.push({
        traits: [trait],
        probability,
        expectedBonus: 5,
        type: 'individual',
      });
    }
  });

  return combinations;
}

// Generate optimization suggestions
function generateOptimizationSuggestions(compatibility, traitInteractions) {
  const suggestions = [];

  if (compatibility.traitCompatibility.score < 60) {
    suggestions.push({
      category: 'trait_compatibility',
      suggestion: 'Consider alternative breeding partners with more compatible trait profiles',
      impact: 'high',
    });
  }

  if (traitInteractions.antagonisticPairs.length > 0) {
    suggestions.push({
      category: 'trait_conflicts',
      suggestion: 'Monitor offspring for trait conflicts and plan training accordingly',
      impact: 'medium',
    });
  }

  if (compatibility.statCompatibility.complementaryStats.length === 0) {
    suggestions.push({
      category: 'stat_balance',
      suggestion: 'Seek breeding partners with complementary stat strengths',
      impact: 'medium',
    });
  }

  if (compatibility.diversityScore < 40) {
    suggestions.push({
      category: 'genetic_diversity',
      suggestion: 'Introduce new bloodlines to improve genetic diversity',
      impact: 'high',
    });
  }

  return suggestions;
}

/**
 * Simulate multiple breeding outcomes with statistical analysis
 */
export function simulateBreedingOutcomes(stallion, mare, options = {}) {
  const { iterations = 100 } = options;

  logger.info('Simulating breeding outcomes', {
    stallionId: stallion.id,
    mareId: mare.id,
    iterations,
  });

  // Equoria-urqic.4.1: the seeded-RNG Monte-Carlo loop + statistics/confidence
  // aggregation live in genetics/breedingSimulation.mjs. This facade still owns
  // the logging and injects calculateEnhancedGeneticProbabilities so the
  // extracted module has no back-reference to this facade (avoids a circular
  // import).
  return computeBreedingSimulation(stallion, mare, calculateEnhancedGeneticProbabilities, options);
}

export function calculateMultiGenerationalPredictions(stallion, mare, lineage) {
  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];

  logger.info('Calculating multi-generational predictions', {
    stallionId: stallion.id,
    mareId: mare.id,
    generations: generations.length,
  });

  // Equoria-urqic.4.2: per-generation weighted trait influence +
  // lineage-pattern strengths/weaknesses/score live in
  // genetics/multiGenerationalPredictions.mjs. This facade owns only the
  // logging and delegates the pure in-memory computation.
  return computeMultiGenerationalPredictions(stallion, mare, lineage);
}

export function calculateGeneticDiversityImpact(stallion, mare, lineage) {
  logger.info('Calculating genetic diversity impact', {
    stallionId: stallion.id,
    mareId: mare.id,
  });

  // Equoria-urqic.4: the diversity/inbreeding/health/risk computation lives in
  // genetics/geneticDiversityImpact.mjs. This facade owns only the logging.
  return computeGeneticDiversityImpact(stallion, mare, lineage);
}

export function calculateTraitInteractions(stallion, mare) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const allStallionTraits = [
    ...stallionTraits.positive,
    ...stallionTraits.negative,
    ...stallionTraits.hidden,
  ];
  const allMareTraits = [...mareTraits.positive, ...mareTraits.negative, ...mareTraits.hidden];

  const synergisticPairs = [];
  const antagonisticPairs = [];

  // Check for synergistic interactions
  TRAIT_INTERACTIONS.synergistic.forEach(interaction => {
    const [trait1, trait2] = interaction.traits;
    const stallionHasTrait1 = allStallionTraits.includes(trait1);
    const stallionHasTrait2 = allStallionTraits.includes(trait2);
    const mareHasTrait1 = allMareTraits.includes(trait1);
    const mareHasTrait2 = allMareTraits.includes(trait2);

    if ((stallionHasTrait1 || mareHasTrait1) && (stallionHasTrait2 || mareHasTrait2)) {
      synergisticPairs.push({
        trait1,
        trait2,
        synergyBonus: interaction.bonus,
        inheritanceProbability: calculateInteractionInheritanceProbability(
          stallionHasTrait1,
          stallionHasTrait2,
          mareHasTrait1,
          mareHasTrait2,
        ),
      });
    }
  });

  // Check for antagonistic interactions
  TRAIT_INTERACTIONS.antagonistic.forEach(interaction => {
    const [trait1, trait2] = interaction.traits;
    const stallionHasTrait1 = allStallionTraits.includes(trait1);
    const stallionHasTrait2 = allStallionTraits.includes(trait2);
    const mareHasTrait1 = allMareTraits.includes(trait1);
    const mareHasTrait2 = allMareTraits.includes(trait2);

    if ((stallionHasTrait1 || mareHasTrait1) && (stallionHasTrait2 || mareHasTrait2)) {
      antagonisticPairs.push({
        trait1,
        trait2,
        conflictPenalty: Math.abs(interaction.penalty),
        resolutionProbability: calculateConflictResolutionProbability(
          stallionHasTrait1,
          stallionHasTrait2,
          mareHasTrait1,
          mareHasTrait2,
        ),
      });
    }
  });

  // Calculate overall interaction score
  const synergyScore = synergisticPairs.reduce((sum, pair) => sum + pair.synergyBonus, 0);
  const conflictScore = antagonisticPairs.reduce((sum, pair) => sum + pair.conflictPenalty, 0);
  const interactionScore = synergyScore - conflictScore;

  // Predict trait combinations
  const predictedCombinations = predictTraitCombinations(
    stallionTraits,
    mareTraits,
    synergisticPairs,
  );

  return {
    synergisticPairs,
    antagonisticPairs,
    interactionScore,
    predictedCombinations,
  };
}

// Equoria-axad9.2: renamed from generateBreedingRecommendations to a distinct
// canonical name. The advancedLineageAnalysisService also exported a
// generateBreedingRecommendations (async, ID-based, DB) and both were `export *`'d
// through breeding/index.mjs — one silently shadowed the other at the barrel.
// This SYNC, object-consuming genetic-compatibility variant is now
// generateGeneticBreedingRecommendations; the async lineage variant is
// generateLineageBreedingRecommendations.
export function generateGeneticBreedingRecommendations(stallion, mare) {
  const compatibility = calculateGeneticCompatibilityScore(stallion, mare);
  const traitInteractions = calculateTraitInteractions(stallion, mare);
  const probabilities = calculateEnhancedGeneticProbabilities(stallion, mare);

  // Determine overall recommendation
  let overallRecommendation;
  if (compatibility.overallScore >= 80) {
    overallRecommendation = 'Highly Recommended';
  } else if (compatibility.overallScore >= 65) {
    overallRecommendation = 'Recommended';
  } else if (compatibility.overallScore >= 45) {
    overallRecommendation = 'Acceptable';
  } else {
    overallRecommendation = 'Not Recommended';
  }

  // Identify strengths
  const strengths = [];
  if (compatibility.traitCompatibility.sharedPositiveTraits.length > 0) {
    strengths.push(
      `Shared positive traits: ${compatibility.traitCompatibility.sharedPositiveTraits.join(', ')}`,
    );
  }
  if (traitInteractions.synergisticPairs.length > 0) {
    strengths.push(`${traitInteractions.synergisticPairs.length} synergistic trait combinations`);
  }
  if (compatibility.statCompatibility.complementaryStats.length > 0) {
    strengths.push('Complementary stat profiles for balanced offspring');
  }

  // Identify concerns
  const concerns = [];
  if (compatibility.traitCompatibility.conflicts.length > 0) {
    concerns.push(`${compatibility.traitCompatibility.conflicts.length} trait conflicts detected`);
  }
  if (traitInteractions.antagonisticPairs.length > 0) {
    concerns.push(`${traitInteractions.antagonisticPairs.length} antagonistic trait pairs`);
  }
  if (compatibility.diversityScore < 30) {
    concerns.push('Low genetic diversity may limit offspring potential');
  }

  // Generate optimization suggestions
  const optimizationSuggestions = generateOptimizationSuggestions(compatibility, traitInteractions);

  // Calculate expected outcomes
  const expectedOutcomes = {
    traitInheritance: probabilities.traitProbabilities,
    statRanges: probabilities.statProbabilities,
    geneticScore: probabilities.overallGeneticScore,
  };

  return {
    overallRecommendation,
    strengths,
    concerns,
    optimizationSuggestions,
    expectedOutcomes,
    compatibilityScore: compatibility.overallScore,
  };
}

export function predictOffspringPerformance(stallion, mare) {
  const probabilities = calculateEnhancedGeneticProbabilities(stallion, mare);
  const traitInteractions = calculateTraitInteractions(stallion, mare);

  // Equoria-urqic.4: per-discipline scoring + strength/development-area
  // identification lives in genetics/offspringPerformancePrediction.mjs. The
  // facade still composes the two upstream probability inputs and passes them
  // in (keeps the extracted module free of a back-reference to this facade).
  return computeOffspringPerformance(stallion, mare, probabilities, traitInteractions);
}
