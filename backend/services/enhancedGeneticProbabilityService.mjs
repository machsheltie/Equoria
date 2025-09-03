/**
 * Enhanced Genetic Probability Service
 * 
 * This service provides advanced genetic probability calculations for breeding predictions,
 * including trait inheritance analysis, genetic compatibility scoring, and performance prediction.
 */

import logger from '../utils/logger.mjs';

// Genetic calculation constants
const GENETIC_CONSTANTS = {
  TRAIT_INHERITANCE_BASE_PROBABILITY: 50,
  SHARED_TRAIT_BONUS: 25,
  STAT_INHERITANCE_VARIANCE: 10,
  GENERATION_WEIGHT_DECAY: 0.5,
  INBREEDING_THRESHOLD: 0.125,
  DIVERSITY_BONUS_THRESHOLD: 0.8
};

// Trait interaction definitions
const TRAIT_INTERACTIONS = {
  synergistic: [
    { traits: ['athletic', 'intelligent'], bonus: 15 },
    { traits: ['calm', 'focused'], bonus: 12 },
    { traits: ['resilient', 'bold'], bonus: 10 },
    { traits: ['agile', 'athletic'], bonus: 8 }
  ],
  antagonistic: [
    { traits: ['calm', 'nervous'], penalty: -20 },
    { traits: ['bold', 'timid'], penalty: -15 },
    { traits: ['focused', 'distracted'], penalty: -12 }
  ]
};

/**
 * Calculate enhanced genetic probabilities for breeding pair
 */
export function calculateEnhancedGeneticProbabilities(stallion, mare) {
  try {
    logger.info('Calculating enhanced genetic probabilities', {
      stallionId: stallion.id,
      mareId: mare.id
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
      calculatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error calculating enhanced genetic probabilities', { error: error.message });
    throw error;
  }
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
    ...mareTraits.hidden
  ]);

  const traitProbabilities = {
    positive: [],
    negative: [],
    hidden: []
  };

  allTraits.forEach(trait => {
    const stallionHas = hasTraitInCategory(stallionTraits, trait);
    const mareHas = hasTraitInCategory(mareTraits, trait);
    const category = getTraitCategory(stallionTraits, mareTraits, trait);

    let probability = GENETIC_CONSTANTS.TRAIT_INHERITANCE_BASE_PROBABILITY;

    // Both parents have trait
    if (stallionHas && mareHas) {
      probability += GENETIC_CONSTANTS.SHARED_TRAIT_BONUS;
    }
    // Only one parent has trait
    else if (stallionHas || mareHas) {
      probability = GENETIC_CONSTANTS.TRAIT_INHERITANCE_BASE_PROBABILITY;
    }
    // Neither parent has trait (recessive possibility)
    else {
      probability = 15; // Low probability for recessive traits
    }

    // Apply trait interaction modifiers
    probability = applyTraitInteractionModifiers(trait, stallionTraits, mareTraits, probability);

    if (category && probability > 10) { // Only include meaningful probabilities
      traitProbabilities[category].push({
        trait,
        probability: Math.min(95, Math.max(5, probability)), // Cap between 5-95%
        inheritancePattern: stallionHas && mareHas ? 'dominant' : 
                           stallionHas || mareHas ? 'heterozygous' : 'recessive'
      });
    }
  });

  return traitProbabilities;
}

/**
 * Calculate stat inheritance probabilities
 */
function calculateStatInheritanceProbabilities(stallion, mare) {
  const stallionStats = stallion.stats || {};
  const mareStats = mare.stats || {};
  const statProbabilities = {};

  const allStats = new Set([...Object.keys(stallionStats), ...Object.keys(mareStats)]);

  allStats.forEach(stat => {
    const stallionValue = stallionStats[stat] || 50;
    const mareValue = mareStats[stat] || 50;
    
    const averageValue = (stallionValue + mareValue) / 2;
    const variance = GENETIC_CONSTANTS.STAT_INHERITANCE_VARIANCE;
    
    // Calculate expected range with genetic variance
    const minValue = Math.max(1, averageValue - variance);
    const maxValue = Math.min(100, averageValue + variance);
    
    // Bias slightly toward higher parent
    const higherParentValue = Math.max(stallionValue, mareValue);
    const expectedValue = (averageValue * 0.7) + (higherParentValue * 0.3);

    statProbabilities[stat] = {
      expectedValue: Math.round(expectedValue),
      expectedRange: {
        min: Math.round(minValue),
        max: Math.round(maxValue)
      },
      variance,
      parentalContribution: {
        stallion: stallionValue,
        mare: mareValue
      }
    };
  });

  return statProbabilities;
}

/**
 * Calculate discipline inheritance probabilities
 */
function calculateDisciplineInheritanceProbabilities(stallion, mare) {
  const stallionDisciplines = stallion.disciplineScores || {};
  const mareDisciplines = mare.disciplineScores || {};
  const disciplineProbabilities = {};

  const allDisciplines = new Set([...Object.keys(stallionDisciplines), ...Object.keys(mareDisciplines)]);

  allDisciplines.forEach(discipline => {
    const stallionScore = stallionDisciplines[discipline] || 0;
    const mareScore = mareDisciplines[discipline] || 0;
    
    if (stallionScore > 0 || mareScore > 0) {
      const averageScore = (stallionScore + mareScore) / 2;
      const potential = Math.max(stallionScore, mareScore);
      
      disciplineProbabilities[discipline] = {
        expectedScore: Math.round(averageScore),
        potentialScore: Math.round(potential),
        inheritanceStrength: stallionScore > 0 && mareScore > 0 ? 'strong' : 'moderate'
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
  const sharedPositiveTraits = stallionPositive.filter(trait =>
    marePositive.includes(trait)
  );
  score += sharedPositiveTraits.length * 5;

  // Negative trait penalty
  const sharedNegativeTraits = stallionNegative.filter(trait =>
    mareNegative.includes(trait)
  );
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
  try {
    const traitCompatibility = calculateTraitCompatibility(stallion, mare);
    const statCompatibility = calculateStatCompatibility(stallion.stats || {}, mare.stats || {});
    const disciplineCompatibility = calculateDisciplineCompatibility(stallion, mare);
    const diversityScore = calculateBasicDiversityScore(stallion, mare);

    // Ensure all scores are numbers
    const traitScore = typeof traitCompatibility.score === 'number' ? traitCompatibility.score : 50;
    const statScore = typeof statCompatibility.balanceScore === 'number' ? statCompatibility.balanceScore : 50;
    const disciplineScore = typeof disciplineCompatibility === 'number' ? disciplineCompatibility : 50;
    const diversityScoreNum = typeof diversityScore === 'number' ? diversityScore : 50;

    const overallScore = Math.round(
      (traitScore * 0.3) +
      (statScore * 0.25) +
      (disciplineScore * 0.25) +
      (diversityScoreNum * 0.2)
    );

    return {
      overallScore,
      traitCompatibility,
      statCompatibility: {
        balanceScore: statScore,
        complementaryStats: statCompatibility.complementaryStats || []
      },
      disciplineCompatibility: disciplineScore,
      diversityScore: diversityScoreNum
    };
  } catch (error) {
    logger.error('Error calculating genetic compatibility score', { error: error.message });
    throw error;
  }
}

/**
 * Calculate trait compatibility
 */
function calculateTraitCompatibility(stallion, mare) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const sharedPositiveTraits = stallionTraits.positive.filter(trait => 
    mareTraits.positive.includes(trait)
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
    compatibilityLevel: score > 75 ? 'excellent' : score > 50 ? 'good' : 'poor'
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
      complementaryStats: []
    };
  }

  allStats.forEach(stat => {
    const stallionValue = stallionStatsObj[stat] || 50;
    const mareValue = mareStatsObj[stat] || 50;

    // Ensure values are numbers
    const stallionNum = typeof stallionValue === 'number' ? stallionValue : 50;
    const mareNum = typeof mareValue === 'number' ? mareValue : 50;

    // Calculate balance (prefer complementary strengths)
    const average = (stallionNum + mareNum) / 2;
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
    complementaryStats
  };
}

/**
 * Calculate discipline compatibility
 */
function calculateDisciplineCompatibility(stallion, mare) {
  const stallionDisciplines = stallion.disciplineScores || {};
  const mareDisciplines = mare.disciplineScores || {};
  
  const allDisciplines = new Set([...Object.keys(stallionDisciplines), ...Object.keys(mareDisciplines)]);
  
  if (allDisciplines.size === 0) return 50;

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
    ...stallionTraits.hidden
  ];

  const mareAllTraits = [
    ...mareTraits.positive,
    ...mareTraits.negative,
    ...mareTraits.hidden
  ];

  const uniqueTraits = new Set([...stallionAllTraits, ...mareAllTraits]);
  const sharedTraits = stallionAllTraits.filter(trait => mareAllTraits.includes(trait));

  const diversityRatio = uniqueTraits.size > 0 ? 
    (uniqueTraits.size - sharedTraits.length) / uniqueTraits.size : 0;

  return Math.round(diversityRatio * 100);
}

/**
 * Helper function to check if horse has trait in any category
 */
function hasTraitInCategory(traits, trait) {
  return traits.positive.includes(trait) || 
         traits.negative.includes(trait) || 
         traits.hidden.includes(trait);
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
      if (hasTraitInCategory(stallionTraits, otherTrait) || hasTraitInCategory(mareTraits, otherTrait)) {
        modifiedProbability += interaction.bonus * 0.5; // Partial bonus for potential synergy
      }
    }
  });

  // Check for antagonistic interactions
  TRAIT_INTERACTIONS.antagonistic.forEach(interaction => {
    if (interaction.traits.includes(trait)) {
      const otherTrait = interaction.traits.find(t => t !== trait);
      if (hasTraitInCategory(stallionTraits, otherTrait) && hasTraitInCategory(mareTraits, otherTrait)) {
        modifiedProbability += interaction.penalty * 0.3; // Reduced penalty for breeding
      }
    }
  });

  return modifiedProbability;
}

/**
 * Helper Functions for Enhanced Genetic Calculations
 */

// Seeded random number generator for deterministic testing
function createSeededRandom(seed) {
  let currentSeed = seed;
  return function() {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
}

// Calculate outcome statistics from simulation results
function calculateOutcomeStatistics(outcomes) {
  const traitFrequency = {};
  const statTotals = {};
  const performanceTotals = {};

  outcomes.forEach(outcome => {
    // Count trait frequencies
    Object.entries(outcome.traits).forEach(([category, traits]) => {
      traits.forEach(trait => {
        if (!traitFrequency[trait]) traitFrequency[trait] = 0;
        traitFrequency[trait]++;
      });
    });

    // Sum stats
    Object.entries(outcome.stats).forEach(([stat, value]) => {
      if (!statTotals[stat]) statTotals[stat] = 0;
      statTotals[stat] += value;
    });

    // Sum performance scores
    Object.entries(outcome.predictedPerformance).forEach(([discipline, score]) => {
      if (!performanceTotals[discipline]) performanceTotals[discipline] = 0;
      performanceTotals[discipline] += score;
    });
  });

  // Calculate averages
  const averageStats = {};
  Object.entries(statTotals).forEach(([stat, total]) => {
    averageStats[stat] = Math.round(total / outcomes.length);
  });

  const performanceDistribution = {};
  Object.entries(performanceTotals).forEach(([discipline, total]) => {
    performanceDistribution[discipline] = Math.round(total / outcomes.length);
  });

  return {
    traitFrequency,
    averageStats,
    performanceDistribution
  };
}

// Calculate confidence intervals from outcomes
function calculateConfidenceIntervals(outcomes) {
  const stats = {};
  const performance = {};

  // Calculate stat confidence intervals
  const statNames = Object.keys(outcomes[0].stats);
  statNames.forEach(stat => {
    const values = outcomes.map(outcome => outcome.stats[stat]).sort((a, b) => a - b);
    const lowerIndex = Math.floor(values.length * 0.025);
    const upperIndex = Math.floor(values.length * 0.975);

    stats[stat] = {
      min: values[lowerIndex],
      max: values[upperIndex],
      confidence: 95
    };
  });

  // Calculate performance confidence intervals
  const disciplineNames = Object.keys(outcomes[0].predictedPerformance);
  disciplineNames.forEach(discipline => {
    const values = outcomes.map(outcome => outcome.predictedPerformance[discipline]).sort((a, b) => a - b);
    const lowerIndex = Math.floor(values.length * 0.025);
    const upperIndex = Math.floor(values.length * 0.975);

    performance[discipline] = {
      min: values[lowerIndex],
      max: values[upperIndex],
      confidence: 95
    };
  });

  return { stats, performance };
}

// Calculate performance from traits and stats
function calculatePerformanceFromTraitsAndStats(traits, stats) {
  const performance = {};
  const disciplines = ['racing', 'dressage', 'showJumping', 'crossCountry', 'western', 'gaited'];

  disciplines.forEach(discipline => {
    let baseScore = 50;

    // Add stat contributions
    switch (discipline) {
      case 'racing':
        baseScore += (stats.speed || 50) * 0.4 + (stats.stamina || 50) * 0.3 + (stats.agility || 50) * 0.3;
        break;
      case 'dressage':
        baseScore += (stats.intelligence || 50) * 0.4 + (stats.precision || 50) * 0.3 + (stats.balance || 50) * 0.3;
        break;
      case 'showJumping':
        baseScore += (stats.agility || 50) * 0.4 + (stats.boldness || 50) * 0.3 + (stats.precision || 50) * 0.3;
        break;
      default:
        baseScore += Object.values(stats).reduce((sum, val) => sum + val, 0) / Object.keys(stats).length;
    }

    // Add trait bonuses
    const allTraits = [...traits.positive, ...traits.negative, ...traits.hidden];
    allTraits.forEach(trait => {
      if (trait === 'athletic' && ['racing', 'showJumping'].includes(discipline)) {
        baseScore += 5;
      }
      if (trait === 'intelligent' && discipline === 'dressage') {
        baseScore += 5;
      }
      if (trait === 'calm' && discipline === 'dressage') {
        baseScore += 3;
      }
    });

    performance[discipline] = Math.min(100, Math.max(0, Math.round(baseScore)));
  });

  return performance;
}

// Calculate genetic score from outcome
function calculateGeneticScoreFromOutcome(traits, stats) {
  let score = 50;

  // Positive trait bonus
  score += traits.positive.length * 3;

  // Negative trait penalty
  score -= traits.negative.length * 2;

  // Hidden trait bonus
  score += traits.hidden.length * 4;

  // Stat bonus for high stats
  const avgStat = Object.values(stats).reduce((sum, val) => sum + val, 0) / Object.keys(stats).length;
  score += (avgStat - 50) * 0.5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

// Calculate generation trait influence
function calculateGenerationTraitInfluence(horses, weight) {
  const traitCounts = {};
  let totalInfluence = 0;

  horses.forEach(horse => {
    const traits = horse.traits || { positive: [], negative: [], hidden: [] };
    // Ensure all trait arrays exist and are arrays
    const positiveTraits = Array.isArray(traits.positive) ? traits.positive : [];
    const negativeTraits = Array.isArray(traits.negative) ? traits.negative : [];
    const hiddenTraits = Array.isArray(traits.hidden) ? traits.hidden : [];

    const allTraits = [...positiveTraits, ...negativeTraits, ...hiddenTraits];

    allTraits.forEach(trait => {
      if (!traitCounts[trait]) traitCounts[trait] = 0;
      traitCounts[trait] += weight;
      totalInfluence += weight;
    });
  });

  return {
    traitInfluence: traitCounts,
    totalInfluence,
    averageInfluence: horses.length > 0 ? totalInfluence / horses.length : 0
  };
}

// Analyze lineage patterns
function analyzeLineagePatterns(lineage) {
  const allTraits = {};
  const traitFrequency = {};
  let totalHorses = 0;

  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];

  // Collect all traits from lineage
  generations.forEach(generation => {
    if (generation.horses) {
      generation.horses.forEach(horse => {
        totalHorses++;
        const traits = horse.traits || { positive: [], negative: [], hidden: [] };
        const allHorseTraits = [...traits.positive, ...traits.negative, ...traits.hidden];

        allHorseTraits.forEach(trait => {
          if (!traitFrequency[trait]) traitFrequency[trait] = 0;
          traitFrequency[trait]++;
        });
      });
    }
  });

  // Identify strengths (common positive traits)
  const strengths = Object.entries(traitFrequency)
    .filter(([trait, count]) => count / totalHorses > 0.3) // Present in >30% of lineage
    .map(([trait, count]) => ({
      trait,
      frequency: count / totalHorses,
      strength: 'lineage_consistency'
    }));

  // Identify weaknesses (common negative traits)
  const weaknesses = Object.entries(traitFrequency)
    .filter(([trait, count]) =>
      trait.includes('negative') || ['nervous', 'stubborn', 'lazy'].includes(trait)
    )
    .map(([trait, count]) => ({
      trait,
      frequency: count / totalHorses,
      concern: 'recurring_negative_trait'
    }));

  const score = Math.max(0, 75 - (weaknesses.length * 10) + (strengths.length * 5));

  return { strengths, weaknesses, score };
}

// Calculate inbreeding coefficient
function calculateInbreedingCoefficient(stallion, mare, lineage) {
  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];
  if (!generations || generations.length < 2) return 0;

  // Simple inbreeding detection - check for shared ancestors
  const stallionAncestors = new Set();
  const mareAncestors = new Set();

  // Add immediate parents
  if (stallion.sireId) stallionAncestors.add(stallion.sireId);
  if (stallion.damId) stallionAncestors.add(stallion.damId);
  if (mare.sireId) mareAncestors.add(mare.sireId);
  if (mare.damId) mareAncestors.add(mare.damId);

  // Add lineage ancestors
  generations.forEach(generation => {
    if (generation.horses) {
      generation.horses.forEach(horse => {
        stallionAncestors.add(horse.id);
        mareAncestors.add(horse.id);
      });
    }
  });

  // Calculate shared ancestors
  const sharedAncestors = [...stallionAncestors].filter(id => mareAncestors.has(id));

  // Simple coefficient calculation
  const totalAncestors = stallionAncestors.size + mareAncestors.size;
  return totalAncestors > 0 ? sharedAncestors.length / totalAncestors : 0;
}

// Calculate genetic diversity score
function calculateGeneticDiversityScore(stallion, mare, lineage) {
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  // Ensure all trait arrays exist and are arrays
  const stallionPositive = Array.isArray(stallionTraits.positive) ? stallionTraits.positive : [];
  const stallionNegative = Array.isArray(stallionTraits.negative) ? stallionTraits.negative : [];
  const stallionHidden = Array.isArray(stallionTraits.hidden) ? stallionTraits.hidden : [];

  const marePositive = Array.isArray(mareTraits.positive) ? mareTraits.positive : [];
  const mareNegative = Array.isArray(mareTraits.negative) ? mareTraits.negative : [];
  const mareHidden = Array.isArray(mareTraits.hidden) ? mareTraits.hidden : [];

  const stallionAllTraits = [...stallionPositive, ...stallionNegative, ...stallionHidden];
  const mareAllTraits = [...marePositive, ...mareNegative, ...mareHidden];

  // Calculate trait diversity
  const uniqueTraits = new Set([...stallionAllTraits, ...mareAllTraits]);
  const sharedTraits = stallionAllTraits.filter(trait => mareAllTraits.includes(trait));

  const diversityRatio = uniqueTraits.size > 0 ?
    (uniqueTraits.size - sharedTraits.length) / uniqueTraits.size : 0;

  // Add lineage diversity bonus
  let lineageBonus = 0;
  // Handle case where lineage is an object with generations property
  const generations = lineage?.generations || lineage || [];
  if (generations && generations.length > 0) {
    const lineageTraits = new Set();
    generations.forEach(generation => {
      if (generation.horses) {
        generation.horses.forEach(horse => {
          const traits = horse.traits || { positive: [], negative: [], hidden: [] };
          const positive = Array.isArray(traits.positive) ? traits.positive : [];
          const negative = Array.isArray(traits.negative) ? traits.negative : [];
          const hidden = Array.isArray(traits.hidden) ? traits.hidden : [];

          [...positive, ...negative, ...hidden].forEach(trait => {
            lineageTraits.add(trait);
          });
        });
      }
    });

    lineageBonus = Math.min(20, lineageTraits.size * 2);
  }

  return Math.min(100, Math.round((diversityRatio * 80) + lineageBonus));
}

// Calculate genetic health score
function calculateGeneticHealthScore(diversityScore, inbreedingCoefficient) {
  let healthScore = 85; // Base health score

  // Diversity bonus/penalty
  if (diversityScore > 70) {
    healthScore += 10;
  } else if (diversityScore < 30) {
    healthScore -= 15;
  }

  // Inbreeding penalty
  if (inbreedingCoefficient > GENETIC_CONSTANTS.INBREEDING_THRESHOLD) {
    healthScore -= (inbreedingCoefficient * 100);
  }

  return Math.min(100, Math.max(0, Math.round(healthScore)));
}

// Generate diversity recommendations
function generateDiversityRecommendations(diversityScore, inbreedingCoefficient, geneticHealthScore) {
  const recommendations = [];

  if (inbreedingCoefficient > GENETIC_CONSTANTS.INBREEDING_THRESHOLD) {
    recommendations.push('Consider outcrossing to improve genetic diversity');
  }

  if (diversityScore < 40) {
    recommendations.push('Seek breeding partners with different trait profiles');
  }

  if (geneticHealthScore < 70) {
    recommendations.push('Focus on genetic health improvement before breeding');
  }

  if (diversityScore > 80 && inbreedingCoefficient < 0.05) {
    recommendations.push('Excellent genetic diversity - proceed with confidence');
  }

  return recommendations;
}

// Get risk level based on genetic factors
function getRiskLevel(inbreedingCoefficient, geneticHealthScore) {
  if (inbreedingCoefficient > 0.25 || geneticHealthScore < 50) {
    return 'high';
  } else if (inbreedingCoefficient > 0.125 || geneticHealthScore < 70) {
    return 'moderate';
  } else {
    return 'low';
  }
}

// Calculate interaction inheritance probability
function calculateInteractionInheritanceProbability(stallionHasTrait1, stallionHasTrait2, mareHasTrait1, mareHasTrait2) {
  let probability = 0;

  // Both traits from same parent
  if ((stallionHasTrait1 && stallionHasTrait2) || (mareHasTrait1 && mareHasTrait2)) {
    probability = 60; // High chance if one parent has both
  }
  // Traits from different parents
  else if ((stallionHasTrait1 && mareHasTrait2) || (stallionHasTrait2 && mareHasTrait1)) {
    probability = 35; // Moderate chance for cross-inheritance
  }

  return probability;
}

// Calculate conflict resolution probability
function calculateConflictResolutionProbability(stallionHasTrait1, stallionHasTrait2, mareHasTrait1, mareHasTrait2) {
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
      type: 'synergistic'
    });
  });

  // Add some individual high-value trait predictions
  const highValueTraits = ['athletic', 'intelligent', 'resilient', 'calm'];
  highValueTraits.forEach(trait => {
    const stallionHas = hasTraitInCategory(stallionTraits, trait);
    const mareHas = hasTraitInCategory(mareTraits, trait);

    if (stallionHas || mareHas) {
      let probability = stallionHas && mareHas ? 75 : 45;
      combinations.push({
        traits: [trait],
        probability,
        expectedBonus: 5,
        type: 'individual'
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
      impact: 'high'
    });
  }

  if (traitInteractions.antagonisticPairs.length > 0) {
    suggestions.push({
      category: 'trait_conflicts',
      suggestion: 'Monitor offspring for trait conflicts and plan training accordingly',
      impact: 'medium'
    });
  }

  if (compatibility.statCompatibility.complementaryStats.length === 0) {
    suggestions.push({
      category: 'stat_balance',
      suggestion: 'Seek breeding partners with complementary stat strengths',
      impact: 'medium'
    });
  }

  if (compatibility.diversityScore < 40) {
    suggestions.push({
      category: 'genetic_diversity',
      suggestion: 'Introduce new bloodlines to improve genetic diversity',
      impact: 'high'
    });
  }

  return suggestions;
}

// Predict discipline performance
function predictDisciplinePerformance(stallion, mare, discipline, probabilities, traitInteractions) {
  let baseScore = 50;
  let confidence = 70;

  // Get relevant stats for discipline
  const disciplineStats = getDisciplineRelevantStats(discipline);
  disciplineStats.forEach(stat => {
    if (probabilities.statProbabilities[stat]) {
      baseScore += (probabilities.statProbabilities[stat].expectedValue - 50) * 0.3;
    }
  });

  // Add trait bonuses
  const relevantTraits = getDisciplineRelevantTraits(discipline);
  Object.entries(probabilities.traitProbabilities).forEach(([category, traits]) => {
    traits.forEach(trait => {
      if (relevantTraits.includes(trait.trait)) {
        baseScore += (trait.probability / 100) * 10;
        confidence += 5;
      }
    });
  });

  // Add synergy bonuses
  traitInteractions.synergisticPairs.forEach(pair => {
    if (relevantTraits.includes(pair.trait1) || relevantTraits.includes(pair.trait2)) {
      baseScore += pair.synergyBonus * 0.3;
    }
  });

  return {
    predictedScore: Math.min(100, Math.max(0, Math.round(baseScore))),
    confidence: Math.min(100, confidence),
    relevantFactors: disciplineStats.concat(relevantTraits)
  };
}

// Get discipline relevant stats
function getDisciplineRelevantStats(discipline) {
  const statMap = {
    racing: ['speed', 'stamina', 'agility'],
    dressage: ['intelligence', 'precision', 'balance'],
    showJumping: ['agility', 'boldness', 'precision'],
    crossCountry: ['stamina', 'boldness', 'agility'],
    western: ['agility', 'intelligence', 'calm'],
    gaited: ['balance', 'precision', 'intelligence']
  };

  return statMap[discipline] || ['speed', 'stamina', 'agility'];
}

// Get discipline relevant traits
function getDisciplineRelevantTraits(discipline) {
  const traitMap = {
    racing: ['athletic', 'fast', 'competitive'],
    dressage: ['intelligent', 'calm', 'focused', 'precise'],
    showJumping: ['athletic', 'bold', 'agile'],
    crossCountry: ['resilient', 'bold', 'athletic'],
    western: ['calm', 'intelligent', 'responsive'],
    gaited: ['balanced', 'smooth', 'natural_gait']
  };

  return traitMap[discipline] || ['athletic', 'intelligent'];
}

// Calculate overall potential
function calculateOverallPotential(disciplinePredictions, probabilities) {
  const scores = Object.values(disciplinePredictions).map(pred => pred.predictedScore);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

  // Add genetic score bonus
  const geneticBonus = (probabilities.overallGeneticScore - 50) * 0.3;

  return Math.min(100, Math.max(0, Math.round(averageScore + geneticBonus)));
}

// Identify strength areas
function identifyStrengthAreas(disciplinePredictions, probabilities) {
  const strengths = [];

  Object.entries(disciplinePredictions).forEach(([discipline, prediction]) => {
    if (prediction.predictedScore > 75) {
      strengths.push({
        area: discipline,
        score: prediction.predictedScore,
        reasoning: `Strong genetic predisposition with ${prediction.confidence}% confidence`
      });
    }
  });

  // Add trait-based strengths
  Object.entries(probabilities.traitProbabilities).forEach(([category, traits]) => {
    traits.forEach(trait => {
      if (trait.probability > 70 && category === 'positive') {
        strengths.push({
          area: `${trait.trait} trait expression`,
          score: trait.probability,
          reasoning: `High probability of inheriting positive trait`
        });
      }
    });
  });

  return strengths;
}

// Identify development areas
function identifyDevelopmentAreas(disciplinePredictions, probabilities) {
  const developmentAreas = [];

  Object.entries(disciplinePredictions).forEach(([discipline, prediction]) => {
    if (prediction.predictedScore < 60) {
      developmentAreas.push({
        area: discipline,
        score: prediction.predictedScore,
        reasoning: `Lower genetic predisposition - will require focused training`
      });
    }
  });

  // Add stat-based development areas
  Object.entries(probabilities.statProbabilities).forEach(([stat, data]) => {
    if (data.expectedValue < 60) {
      developmentAreas.push({
        area: `${stat} development`,
        score: data.expectedValue,
        reasoning: `Below-average genetic potential - focus on training and conditioning`
      });
    }
  });

  return developmentAreas;
}

// Calculate prediction confidence
function calculatePredictionConfidence(stallion, mare) {
  let confidence = 70; // Base confidence

  // Higher confidence with more trait data
  const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
  const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

  const totalTraits = stallionTraits.positive.length + stallionTraits.negative.length +
                     stallionTraits.hidden.length + mareTraits.positive.length +
                     mareTraits.negative.length + mareTraits.hidden.length;

  confidence += Math.min(20, totalTraits * 2);

  // Higher confidence with stat data
  const stallionStats = Object.keys(stallion.stats || {}).length;
  const mareStats = Object.keys(mare.stats || {}).length;

  confidence += Math.min(10, (stallionStats + mareStats));

  return Math.min(95, confidence);
}

/**
 * Simulate multiple breeding outcomes with statistical analysis
 */
export function simulateBreedingOutcomes(stallion, mare, options = {}) {
  const { iterations = 100, seed } = options;

  try {
    logger.info('Simulating breeding outcomes', {
      stallionId: stallion.id,
      mareId: mare.id,
      iterations
    });

    const outcomes = [];
    const rng = seed ? createSeededRandom(seed) : Math.random;

    // Generate multiple breeding outcomes
    for (let i = 0; i < iterations; i++) {
      const outcome = simulateSingleBreedingOutcome(stallion, mare, rng);
      outcomes.push(outcome);
    }

    // Calculate statistics
    const statistics = calculateOutcomeStatistics(outcomes);
    const confidenceIntervals = calculateConfidenceIntervals(outcomes);

    return {
      outcomes,
      statistics,
      confidenceIntervals,
      simulationParameters: { iterations, seed }
    };
  } catch (error) {
    logger.error('Error simulating breeding outcomes', { error: error.message });
    throw error;
  }
}

/**
 * Simulate single breeding outcome
 */
function simulateSingleBreedingOutcome(stallion, mare, rng = Math.random) {
  const probabilities = calculateEnhancedGeneticProbabilities(stallion, mare);

  // Simulate trait inheritance
  const inheritedTraits = {
    positive: [],
    negative: [],
    hidden: []
  };

  Object.entries(probabilities.traitProbabilities).forEach(([category, traits]) => {
    traits.forEach(trait => {
      if (rng() * 100 < trait.probability) {
        inheritedTraits[category].push(trait.trait);
      }
    });
  });

  // Simulate stat inheritance
  const inheritedStats = {};
  Object.entries(probabilities.statProbabilities).forEach(([stat, data]) => {
    const range = data.expectedRange.max - data.expectedRange.min;
    const randomValue = data.expectedRange.min + (rng() * range);
    inheritedStats[stat] = Math.round(randomValue);
  });

  // Predict performance based on inherited traits and stats
  const predictedPerformance = calculatePerformanceFromTraitsAndStats(inheritedTraits, inheritedStats);

  return {
    traits: inheritedTraits,
    stats: inheritedStats,
    predictedPerformance,
    geneticScore: calculateGeneticScoreFromOutcome(inheritedTraits, inheritedStats)
  };
}

export function calculateMultiGenerationalPredictions(stallion, mare, lineage) {
  try {
    // Handle case where lineage is an object with generations property
    const generations = lineage?.generations || lineage || [];

    logger.info('Calculating multi-generational predictions', {
      stallionId: stallion.id,
      mareId: mare.id,
      generations: generations.length
    });

    const generationalImpact = {};
    const ancestralTraitInfluence = {};

    // Analyze each generation's influence
    generations.forEach((generation, index) => {
      const generationNumber = index + 1;
      const weight = Math.pow(GENETIC_CONSTANTS.GENERATION_WEIGHT_DECAY, index);

      const horses = generation.horses || [];
      generationalImpact[`generation${generationNumber}`] = {
        weight,
        horseCount: horses.length,
        influence: weight * horses.length
      };

      // Calculate trait influence from this generation
      const traitInfluence = calculateGenerationTraitInfluence(horses, weight);
      ancestralTraitInfluence[`generation${generationNumber}`] = traitInfluence;
    });

    // Identify lineage strengths and weaknesses
    const lineageAnalysis = analyzeLineagePatterns(lineage);

    return {
      generationalImpact,
      ancestralTraitInfluence,
      lineageStrengths: lineageAnalysis.strengths,
      lineageWeaknesses: lineageAnalysis.weaknesses,
      overallLineageScore: lineageAnalysis.score
    };
  } catch (error) {
    logger.error('Error calculating multi-generational predictions', { error: error.message });
    throw error;
  }
}

export function calculateGeneticDiversityImpact(stallion, mare, lineage) {
  try {
    logger.info('Calculating genetic diversity impact', {
      stallionId: stallion.id,
      mareId: mare.id
    });

    // Calculate inbreeding coefficient
    const inbreedingCoefficient = calculateInbreedingCoefficient(stallion, mare, lineage);

    // Calculate genetic diversity score
    const diversityScore = calculateGeneticDiversityScore(stallion, mare, lineage);

    // Calculate genetic health score
    const geneticHealthScore = calculateGeneticHealthScore(diversityScore, inbreedingCoefficient);

    // Generate diversity recommendations
    const diversityRecommendations = generateDiversityRecommendations(
      diversityScore,
      inbreedingCoefficient,
      geneticHealthScore
    );

    return {
      diversityScore,
      inbreedingCoefficient,
      geneticHealthScore,
      diversityRecommendations,
      riskLevel: getRiskLevel(inbreedingCoefficient, geneticHealthScore)
    };
  } catch (error) {
    logger.error('Error calculating genetic diversity impact', { error: error.message });
    throw error;
  }
}

export function calculateTraitInteractions(stallion, mare) {
  try {
    const stallionTraits = stallion.traits || { positive: [], negative: [], hidden: [] };
    const mareTraits = mare.traits || { positive: [], negative: [], hidden: [] };

    const allStallionTraits = [...stallionTraits.positive, ...stallionTraits.negative, ...stallionTraits.hidden];
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
            stallionHasTrait1, stallionHasTrait2, mareHasTrait1, mareHasTrait2
          )
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
            stallionHasTrait1, stallionHasTrait2, mareHasTrait1, mareHasTrait2
          )
        });
      }
    });

    // Calculate overall interaction score
    const synergyScore = synergisticPairs.reduce((sum, pair) => sum + pair.synergyBonus, 0);
    const conflictScore = antagonisticPairs.reduce((sum, pair) => sum + pair.conflictPenalty, 0);
    const interactionScore = synergyScore - conflictScore;

    // Predict trait combinations
    const predictedCombinations = predictTraitCombinations(stallionTraits, mareTraits, synergisticPairs);

    return {
      synergisticPairs,
      antagonisticPairs,
      interactionScore,
      predictedCombinations
    };
  } catch (error) {
    logger.error('Error calculating trait interactions', { error: error.message });
    throw error;
  }
}

export function generateBreedingRecommendations(stallion, mare) {
  try {
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
      strengths.push(`Shared positive traits: ${compatibility.traitCompatibility.sharedPositiveTraits.join(', ')}`);
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
      geneticScore: probabilities.overallGeneticScore
    };

    return {
      overallRecommendation,
      strengths,
      concerns,
      optimizationSuggestions,
      expectedOutcomes,
      compatibilityScore: compatibility.overallScore
    };
  } catch (error) {
    logger.error('Error generating breeding recommendations', { error: error.message });
    throw error;
  }
}

export function predictOffspringPerformance(stallion, mare) {
  try {
    const probabilities = calculateEnhancedGeneticProbabilities(stallion, mare);
    const traitInteractions = calculateTraitInteractions(stallion, mare);

    // Predict performance for each discipline
    const disciplinePredictions = {};
    const disciplines = ['racing', 'dressage', 'showJumping', 'crossCountry', 'western', 'gaited'];

    disciplines.forEach(discipline => {
      const prediction = predictDisciplinePerformance(stallion, mare, discipline, probabilities, traitInteractions);
      disciplinePredictions[discipline] = prediction;
    });

    // Calculate overall potential
    const overallPotential = calculateOverallPotential(disciplinePredictions, probabilities);

    // Identify strength and development areas
    const strengthAreas = identifyStrengthAreas(disciplinePredictions, probabilities);
    const developmentAreas = identifyDevelopmentAreas(disciplinePredictions, probabilities);

    return {
      disciplinePredictions,
      overallPotential,
      strengthAreas,
      developmentAreas,
      confidenceLevel: calculatePredictionConfidence(stallion, mare)
    };
  } catch (error) {
    logger.error('Error predicting offspring performance', { error: error.message });
    throw error;
  }
}
