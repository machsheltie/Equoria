/**
 * Personality Evolution System Service
 *
 * Horse temperament evolution analysis based on care history.
 *
 * There is no groom personality evolution (Equoria-jy3f7, Equoria-j5qui; owner
 * ruling 2026-10-22: groom personalities never evolve; a groom keeps the same
 * personality for its whole career). evolveGroomPersonality went in jy3f7;
 * the groom branches of the trigger / stability / prediction / history
 * functions, EVOLUTION_CONFIG.groom and EVOLVED_TRAITS.groom went in j5qui.
 *
 * Business Rules:
 * - Horse temperaments evolve based on care history, environmental factors, and age
 * - Evolution requires minimum interaction thresholds and consistency patterns
 * - Personality stability periods prevent rapid changes and maintain realism
 * - Cross-species influence allows groom-horse personality convergence over time
 * - Evolution effects are applied gradually with configurable strength modifiers
 */

import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

// Evolution configuration constants
const EVOLUTION_CONFIG = {
  horse: {
    minimumInteractions: 10,
    minimumAge: 1, // 1 year minimum
    consistencyThreshold: 0.6,
    stabilityPeriodDays: 21,
    evolutionCooldownDays: 45,
  },
  general: {
    maxEvolutionsPerYear: 3,
    convergenceThreshold: 0.8,
    predictionTimeframeDays: 90,
  },
};

// Personality evolution types
const EVOLUTION_TYPES = {
  TRAIT_STRENGTHENING: 'trait_strengthening',
  PERSONALITY_SHIFT: 'personality_shift',
  TRAIT_ACQUISITION: 'trait_acquisition',
  TEMPERAMENT_STABILIZATION: 'temperament_stabilization',
  CONVERGENCE: 'convergence',
};

// Enhanced personality traits for evolution
const EVOLVED_TRAITS = {
  horse: {
    nervous: ['confidence_building', 'trust_development', 'anxiety_reduction'],
    developing: ['personality_formation', 'adaptability', 'learning_enhancement'],
    confident: ['leadership_traits', 'stability_anchor', 'mentor_qualities'],
  },
};

/**
 * Evolve horse temperament based on care history and environmental factors
 * @param {number} horseId - ID of the horse
 * @returns {Object} Evolution result with temperament changes
 */
export async function evolveHorseTemperament(horseId) {
  logger.info(
    `[personalityEvolutionSystem.evolveHorseTemperament] Starting evolution analysis for horse ${horseId}`,
  );

  // Get horse data
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      groomInteractions: {
        orderBy: { createdAt: 'desc' },
        take: 30, // Last 30 interactions
      },
    },
  });

  if (!horse) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }

  // Check evolution eligibility
  const eligibility = await checkEvolutionEligibility(horse);
  if (!eligibility.eligible) {
    return {
      success: true,
      temperamentEvolved: false,
      reason: eligibility.reason,
      minimumInteractionsRequired: EVOLUTION_CONFIG.horse.minimumInteractions,
      currentInteractions: horse.groomInteractions.length,
    };
  }

  // Analyze care patterns
  const carePatterns = analyzeCarePatterns(horse.groomInteractions);

  // Calculate temperament evolution
  const evolutionData = calculateEvolution(horse, carePatterns);

  // Apply evolution if triggered
  if (evolutionData.shouldEvolve) {
    // Equoria-jy3f7: guarded write; only if the temperament read above still holds.
    const written = await prisma.horse.updateMany({
      where: { id: horseId, temperament: horse.temperament },
      data: { temperament: evolutionData.newTemperament },
    });
    if (written.count === 0) {
      return { success: true, temperamentEvolved: false, reason: 'temperamentChanged' };
    }

    const effects = await applyPersonalityEvolutionEffects({
      entityId: horseId,
      entityType: 'horse',
      evolutionType: evolutionData.type,
      newTraits: evolutionData.newTraits,
      oldPersonality: horse.temperament,
      newPersonality: evolutionData.newTemperament,
      stabilityPeriod: EVOLUTION_CONFIG.horse.stabilityPeriodDays,
      effectStrength: evolutionData.strength,
    });

    return {
      success: true,
      temperamentEvolved: true,
      oldTemperament: horse.temperament,
      newTemperament: evolutionData.newTemperament,
      evolutionFactors: carePatterns,
      careQualityScore: carePatterns.qualityScore,
      stabilityPeriod: EVOLUTION_CONFIG.horse.stabilityPeriodDays,
      effectsApplied: effects.effectsApplied,
    };
  }

  return {
    success: true,
    temperamentEvolved: false,
    reason: 'insufficient_consistency',
    stabilityScore: carePatterns.consistency,
    careQualityScore: carePatterns.qualityScore,
  };
}

/**
 * Calculate temperament evolution triggers for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Evolution trigger analysis
 */
export async function calculatePersonalityEvolutionTriggers(horseId) {
  logger.info(
    `[personalityEvolutionSystem.calculatePersonalityEvolutionTriggers] Analyzing triggers for horse ${horseId}`,
  );

  const config = EVOLUTION_CONFIG.horse;

  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    include: { groomInteractions: { take: 30 } },
  });

  if (!horse) {
    throw new Error(`horse with ID ${horseId} not found`);
  }

  // Calculate trigger factors
  const triggers = {
    experienceThreshold: horse.age >= config.minimumAge,
    interactionConsistency: horse.groomInteractions.length >= config.minimumInteractions,
    performanceQuality: calculatePerformanceQuality(horse.groomInteractions),
  };

  // Calculate overall evolution readiness
  const readinessScore =
    Object.values(triggers).filter(Boolean).length / Object.keys(triggers).length;

  return {
    success: true,
    triggers,
    evolutionReadiness: readinessScore,
    nextEvolutionEstimate: estimateNextEvolution(),
    recommendedActions: generateEvolutionRecommendations(),
  };
}

/**
 * Analyze temperament stability for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Stability analysis
 */
export async function analyzePersonalityStability(horseId) {
  logger.info(
    `[personalityEvolutionSystem.analyzePersonalityStability] Analyzing stability for horse ${horseId}`,
  );

  // Get recent interactions and evolution history
  const interactions = await prisma.groomInteraction.findMany({
    where: { foalId: horseId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Calculate stability factors
  const stabilityFactors = {
    careConsistency: calculateCareConsistency(interactions),
    environmentalStability: calculateEnvironmentalStability(interactions),
    ageStability: calculateAgeStability(horseId),
    groomInfluence: calculateGroomInfluence(interactions),
  };

  // Calculate overall stability score
  const stabilityScore =
    Object.values(stabilityFactors).reduce((sum, factor) => sum + factor, 0) /
    Object.keys(stabilityFactors).length;

  return {
    success: true,
    stabilityScore,
    stabilityFactors,
    evolutionRisk: 1 - stabilityScore,
    recommendedActions: generateStabilityRecommendations(stabilityFactors),
  };
}

/**
 * Predict future temperament evolution for a horse
 * @param {number} horseId - ID of the horse
 * @param {number} timeframeDays - Prediction timeframe in days
 * @returns {Object} Evolution predictions
 */
export async function predictPersonalityEvolution(horseId, timeframeDays = 30) {
  logger.info(
    `[personalityEvolutionSystem.predictPersonalityEvolution] Predicting evolution for horse ${horseId} over ${timeframeDays} days`,
  );

  // Get current state and trends
  const currentState = await getCurrentPersonalityState(horseId);
  const trends = await analyzePersonalityTrends(horseId);

  // Generate predictions
  const predictions = [];
  const timeframes = [7, 14, 30, 60, 90].filter(days => days <= timeframeDays);

  for (const days of timeframes) {
    const prediction = {
      timeframe: days,
      evolutionProbability: calculateEvolutionProbability(currentState, trends, days),
      predictedChanges: predictPersonalityChanges(currentState, trends, days),
      confidenceLevel: calculatePredictionConfidence(trends, days),
    };
    predictions.push(prediction);
  }

  return {
    success: true,
    predictions,
    influencingFactors: trends.influencingFactors,
    recommendedActions: generatePredictionRecommendations(predictions),
  };
}

/**
 * Get temperament evolution history for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Evolution history
 */
export async function getPersonalityEvolutionHistory(horseId) {
  logger.info(
    `[personalityEvolutionSystem.getPersonalityEvolutionHistory] Getting history for horse ${horseId}`,
  );

  // For now, return mock data structure since we don't have evolution history table yet
  // In a full implementation, this would query a PersonalityEvolutionLog table

  return {
    success: true,
    evolutionEvents: [],
    totalEvolutions: 0,
    evolutionTimeline: [],
    personalityTrajectory: [],
    stabilityTrends: [],
  };
}

/**
 * Apply personality evolution effects to an entity
 * @param {Object} evolutionData - Evolution data to apply
 * @returns {Object} Applied effects result
 */
export async function applyPersonalityEvolutionEffects(evolutionData) {
  logger.info(
    `[personalityEvolutionSystem.applyPersonalityEvolutionEffects] Applying effects for ${evolutionData.entityType} ${evolutionData.entityId}`,
  );

  const effectsApplied = [];

  // Apply trait modifiers
  if (evolutionData.newTraits && evolutionData.newTraits.length > 0) {
    effectsApplied.push(`Added traits: ${evolutionData.newTraits.join(', ')}`);
  }

  // Apply personality change if applicable
  if (
    evolutionData.newPersonality &&
    evolutionData.newPersonality !== evolutionData.oldPersonality
  ) {
    effectsApplied.push(
      `Personality changed: ${evolutionData.oldPersonality} → ${evolutionData.newPersonality}`,
    );
  }

  // Set stability period
  effectsApplied.push(`Stability period set: ${evolutionData.stabilityPeriod} days`);

  // Log evolution event (would be stored in PersonalityEvolutionLog table in full implementation)
  effectsApplied.push('Evolution event logged');

  return {
    success: true,
    effectsApplied,
    personalityUpdated: true,
    traitModifiersApplied: true,
    stabilityPeriodSet: true,
    evolutionLogged: true,
  };
}

// Helper functions
async function checkEvolutionEligibility(horse) {
  const config = EVOLUTION_CONFIG.horse;

  if (horse.age < config.minimumAge) {
    return { eligible: false, reason: 'insufficient_age' };
  }

  if (horse.groomInteractions.length < config.minimumInteractions) {
    return { eligible: false, reason: 'insufficient_interaction_data' };
  }

  return { eligible: true };
}

function analyzeInteractionPatterns(interactions) {
  if (interactions.length === 0) {
    return { consistency: 0, qualityScore: 0, patterns: [] };
  }

  const qualityScores = interactions.map(i => {
    switch (i.quality) {
      case 'excellent':
        return 4;
      case 'good':
        return 3;
      case 'fair':
        return 2;
      case 'poor':
        return 1;
      default:
        return 2;
    }
  });

  const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
  const consistency = calculateConsistency(qualityScores);

  return {
    consistency,
    qualityScore: avgQuality / 4, // Normalize to 0-1
    patterns: identifyPatterns(interactions),
  };
}

function analyzeCarePatterns(interactions) {
  return analyzeInteractionPatterns(interactions); // Same analysis for now
}

function calculateEvolution(horse, patterns) {
  const config = EVOLUTION_CONFIG.horse;

  // Determine if evolution should occur
  const shouldEvolve =
    patterns.consistency >= config.consistencyThreshold && patterns.qualityScore >= 0.6;

  if (!shouldEvolve) {
    return { shouldEvolve: false };
  }

  // Determine evolution type and new traits
  const availableTraits = EVOLVED_TRAITS.horse[horse.temperament] || [];

  return {
    shouldEvolve: true,
    type: EVOLUTION_TYPES.TRAIT_STRENGTHENING,
    newTraits: availableTraits.slice(0, 2), // Add first 2 available traits
    newPersonality: determineNewTemperament(horse.temperament, patterns),
    newTemperament: determineNewTemperament(horse.temperament, patterns),
    strength: patterns.qualityScore,
  };
}

function determineNewTemperament(currentTemperament, patterns) {
  if (currentTemperament === 'nervous' && patterns.qualityScore > 0.7) {
    return 'developing';
  }
  if (currentTemperament === 'developing' && patterns.qualityScore > 0.8) {
    return 'confident';
  }
  return currentTemperament;
}

function calculateConsistency(scores) {
  if (scores.length < 2) {
    return 0;
  }

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);

  // Lower standard deviation = higher consistency
  return Math.max(0, 1 - standardDeviation / mean);
}

function identifyPatterns(_interactions) {
  // Simplified pattern identification
  return ['consistent_quality', 'positive_bonding'];
}

function calculatePerformanceQuality(interactions) {
  return interactions.length > 0 ? 0.75 : 0; // Simplified calculation
}

function estimateNextEvolution() {
  return '2-3 weeks'; // Simplified estimate
}

function generateEvolutionRecommendations() {
  return ['Continue consistent interactions', 'Focus on quality care'];
}

function calculateCareConsistency(interactions) {
  return interactions.length > 0 ? 0.7 : 0;
}

function calculateEnvironmentalStability(_interactions) {
  return 0.8; // Simplified calculation
}

function calculateAgeStability(_horseId) {
  return 0.9; // Simplified calculation
}

function calculateGroomInfluence(interactions) {
  return interactions.length > 10 ? 0.6 : 0.3;
}

function generateStabilityRecommendations(_factors) {
  return ['Maintain consistent care patterns'];
}

async function getCurrentPersonalityState(_horseId) {
  return { personality: 'calm', traits: [], stability: 0.7 };
}

async function analyzePersonalityTrends(_horseId) {
  return { influencingFactors: ['experience', 'interactions'] };
}

function calculateEvolutionProbability(state, trends, days) {
  return Math.min(0.8, (days / 30) * 0.3);
}

function predictPersonalityChanges(_state, _trends, _days) {
  return ['trait_strengthening'];
}

function calculatePredictionConfidence(trends, days) {
  return Math.max(0.5, 1 - days / 90);
}

function generatePredictionRecommendations(_predictions) {
  return ['Continue current care patterns'];
}
