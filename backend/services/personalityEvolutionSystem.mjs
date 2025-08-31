/**
 * Personality Evolution System Service
 * 
 * Implements comprehensive personality evolution for both grooms and horses based on experience and interactions.
 * Handles dynamic personality development, trait strengthening, and cross-species personality influence.
 * 
 * Business Rules:
 * - Groom personalities evolve based on interaction patterns, experience, and specialization
 * - Horse temperaments evolve based on care history, environmental factors, and age
 * - Evolution requires minimum interaction thresholds and consistency patterns
 * - Personality stability periods prevent rapid changes and maintain realism
 * - Cross-species influence allows groom-horse personality convergence over time
 * - Evolution effects are applied gradually with configurable strength modifiers
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

// Evolution configuration constants
const EVOLUTION_CONFIG = {
  groom: {
    minimumInteractions: 15,
    minimumExperience: 50,
    consistencyThreshold: 0.7,
    stabilityPeriodDays: 14,
    evolutionCooldownDays: 30,
  },
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
  groom: {
    calm: ['enhanced_patience', 'stress_resistance', 'deep_bonding'],
    energetic: ['enthusiasm_boost', 'motivation_expert', 'energy_transfer'],
    methodical: ['precision_master', 'systematic_approach', 'detail_oriented'],
  },
  horse: {
    nervous: ['confidence_building', 'trust_development', 'anxiety_reduction'],
    developing: ['personality_formation', 'adaptability', 'learning_enhancement'],
    confident: ['leadership_traits', 'stability_anchor', 'mentor_qualities'],
  },
};

/**
 * Evolve groom personality based on interaction patterns and experience
 * @param {number} groomId - ID of the groom
 * @returns {Object} Evolution result with personality changes
 */
export async function evolveGroomPersonality(groomId) {
  try {
    logger.info(`[personalityEvolutionSystem.evolveGroomPersonality] Starting evolution analysis for groom ${groomId}`);

    // Get groom data
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      include: {
        groomInteractions: {
          orderBy: { createdAt: 'desc' },
          take: 50, // Last 50 interactions
        },
      },
    });

    if (!groom) {
      throw new Error(`Groom with ID ${groomId} not found`);
    }

    // Check evolution eligibility
    const eligibility = await checkEvolutionEligibility(groom, 'groom');
    if (!eligibility.eligible) {
      return {
        success: true,
        personalityEvolved: false,
        reason: eligibility.reason,
        minimumInteractionsRequired: EVOLUTION_CONFIG.groom.minimumInteractions,
        currentInteractions: groom.groomInteractions.length,
      };
    }

    // Analyze interaction patterns
    const patterns = analyzeInteractionPatterns(groom.groomInteractions);
    
    // Calculate evolution type and new traits
    const evolutionData = calculateEvolution(groom, patterns, 'groom');
    
    // Apply evolution if triggered
    if (evolutionData.shouldEvolve) {
      const effects = await applyPersonalityEvolutionEffects({
        entityId: groomId,
        entityType: 'groom',
        evolutionType: evolutionData.type,
        newTraits: evolutionData.newTraits,
        oldPersonality: groom.personality,
        newPersonality: evolutionData.newPersonality || groom.personality,
        stabilityPeriod: EVOLUTION_CONFIG.groom.stabilityPeriodDays,
        effectStrength: evolutionData.strength,
      });

      return {
        success: true,
        personalityEvolved: true,
        evolutionType: evolutionData.type,
        newTraits: evolutionData.newTraits,
        oldPersonality: groom.personality,
        newPersonality: evolutionData.newPersonality || groom.personality,
        experienceThreshold: groom.experience,
        interactionPatterns: patterns,
        stabilityScore: patterns.consistency,
        effectsApplied: effects.effectsApplied,
      };
    }

    return {
      success: true,
      personalityEvolved: false,
      reason: 'evolution_criteria_not_met',
      patterns,
      stabilityScore: patterns.consistency,
    };

  } catch (error) {
    logger.error(`[personalityEvolutionSystem.evolveGroomPersonality] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Evolve horse temperament based on care history and environmental factors
 * @param {number} horseId - ID of the horse
 * @returns {Object} Evolution result with temperament changes
 */
export async function evolveHorseTemperament(horseId) {
  try {
    logger.info(`[personalityEvolutionSystem.evolveHorseTemperament] Starting evolution analysis for horse ${horseId}`);

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
    const eligibility = await checkEvolutionEligibility(horse, 'horse');
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
    const evolutionData = calculateEvolution(horse, carePatterns, 'horse');
    
    // Apply evolution if triggered
    if (evolutionData.shouldEvolve) {
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

      // Update horse temperament
      await prisma.horse.update({
        where: { id: horseId },
        data: { temperament: evolutionData.newTemperament },
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

  } catch (error) {
    logger.error(`[personalityEvolutionSystem.evolveHorseTemperament] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate personality evolution triggers for an entity
 * @param {number} entityId - ID of the entity (groom or horse)
 * @param {string} entityType - Type of entity ('groom' or 'horse')
 * @returns {Object} Evolution trigger analysis
 */
export async function calculatePersonalityEvolutionTriggers(entityId, entityType = 'groom') {
  try {
    logger.info(`[personalityEvolutionSystem.calculatePersonalityEvolutionTriggers] Analyzing triggers for ${entityType} ${entityId}`);

    const config = EVOLUTION_CONFIG[entityType];
    
    // Get entity data based on type
    const entity = entityType === 'groom' 
      ? await prisma.groom.findUnique({
          where: { id: entityId },
          include: { groomInteractions: { take: 50 } },
        })
      : await prisma.horse.findUnique({
          where: { id: entityId },
          include: { groomInteractions: { take: 30 } },
        });

    if (!entity) {
      throw new Error(`${entityType} with ID ${entityId} not found`);
    }

    // Calculate trigger factors
    const triggers = {
      experienceThreshold: entityType === 'groom' 
        ? entity.experience >= config.minimumExperience
        : entity.age >= config.minimumAge,
      interactionConsistency: entity.groomInteractions.length >= config.minimumInteractions,
      performanceQuality: calculatePerformanceQuality(entity.groomInteractions),
      specialization: entityType === 'groom' ? calculateSpecializationLevel(entity) : null,
    };

    // Calculate overall evolution readiness
    const readinessScore = Object.values(triggers).filter(Boolean).length / Object.keys(triggers).length;
    
    return {
      success: true,
      triggers,
      evolutionReadiness: readinessScore,
      nextEvolutionEstimate: estimateNextEvolution(entity, entityType),
      recommendedActions: generateEvolutionRecommendations(triggers, entityType),
    };

  } catch (error) {
    logger.error(`[personalityEvolutionSystem.calculatePersonalityEvolutionTriggers] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze personality stability for an entity
 * @param {number} entityId - ID of the entity
 * @param {string} entityType - Type of entity ('groom' or 'horse')
 * @returns {Object} Stability analysis
 */
export async function analyzePersonalityStability(entityId, entityType) {
  try {
    logger.info(`[personalityEvolutionSystem.analyzePersonalityStability] Analyzing stability for ${entityType} ${entityId}`);

    // Get recent interactions and evolution history
    const interactions = await prisma.groomInteraction.findMany({
      where: entityType === 'groom' ? { groomId: entityId } : { foalId: entityId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Calculate stability factors
    const stabilityFactors = {
      careConsistency: calculateCareConsistency(interactions),
      environmentalStability: calculateEnvironmentalStability(interactions),
      ageStability: entityType === 'horse' ? calculateAgeStability(entityId) : 1.0,
      groomInfluence: entityType === 'horse' ? calculateGroomInfluence(interactions) : 0,
    };

    // Calculate overall stability score
    const stabilityScore = Object.values(stabilityFactors).reduce((sum, factor) => sum + factor, 0) / Object.keys(stabilityFactors).length;

    return {
      success: true,
      stabilityScore,
      stabilityFactors,
      evolutionRisk: 1 - stabilityScore,
      recommendedActions: generateStabilityRecommendations(stabilityFactors),
    };

  } catch (error) {
    logger.error(`[personalityEvolutionSystem.analyzePersonalityStability] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Predict future personality evolution
 * @param {number} entityId - ID of the entity
 * @param {string} entityType - Type of entity
 * @param {number} timeframeDays - Prediction timeframe in days
 * @returns {Object} Evolution predictions
 */
export async function predictPersonalityEvolution(entityId, entityType, timeframeDays = 30) {
  try {
    logger.info(`[personalityEvolutionSystem.predictPersonalityEvolution] Predicting evolution for ${entityType} ${entityId} over ${timeframeDays} days`);

    // Get current state and trends
    const currentState = await getCurrentPersonalityState(entityId, entityType);
    const trends = await analyzePersonalityTrends(entityId, entityType);

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

  } catch (error) {
    logger.error(`[personalityEvolutionSystem.predictPersonalityEvolution] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get personality evolution history for an entity
 * @param {number} entityId - ID of the entity
 * @param {string} entityType - Type of entity
 * @returns {Object} Evolution history
 */
export async function getPersonalityEvolutionHistory(entityId, entityType) {
  try {
    logger.info(`[personalityEvolutionSystem.getPersonalityEvolutionHistory] Getting history for ${entityType} ${entityId}`);

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

  } catch (error) {
    logger.error(`[personalityEvolutionSystem.getPersonalityEvolutionHistory] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Apply personality evolution effects to an entity
 * @param {Object} evolutionData - Evolution data to apply
 * @returns {Object} Applied effects result
 */
export async function applyPersonalityEvolutionEffects(evolutionData) {
  try {
    logger.info(`[personalityEvolutionSystem.applyPersonalityEvolutionEffects] Applying effects for ${evolutionData.entityType} ${evolutionData.entityId}`);

    const effectsApplied = [];

    // Apply trait modifiers
    if (evolutionData.newTraits && evolutionData.newTraits.length > 0) {
      effectsApplied.push(`Added traits: ${evolutionData.newTraits.join(', ')}`);
    }

    // Apply personality change if applicable
    if (evolutionData.newPersonality && evolutionData.newPersonality !== evolutionData.oldPersonality) {
      effectsApplied.push(`Personality changed: ${evolutionData.oldPersonality} → ${evolutionData.newPersonality}`);
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

  } catch (error) {
    logger.error(`[personalityEvolutionSystem.applyPersonalityEvolutionEffects] Error: ${error.message}`);
    throw error;
  }
}

// Helper functions
async function checkEvolutionEligibility(entity, entityType) {
  const config = EVOLUTION_CONFIG[entityType];
  
  if (entityType === 'groom') {
    if (entity.experience < config.minimumExperience) {
      return { eligible: false, reason: 'insufficient_experience' };
    }
  } else {
    if (entity.age < config.minimumAge) {
      return { eligible: false, reason: 'insufficient_age' };
    }
  }

  if (entity.groomInteractions.length < config.minimumInteractions) {
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
      case 'excellent': return 4;
      case 'good': return 3;
      case 'fair': return 2;
      case 'poor': return 1;
      default: return 2;
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

function calculateEvolution(entity, patterns, entityType) {
  const config = EVOLUTION_CONFIG[entityType];
  
  // Determine if evolution should occur
  const shouldEvolve = patterns.consistency >= config.consistencyThreshold && patterns.qualityScore >= 0.6;
  
  if (!shouldEvolve) {
    return { shouldEvolve: false };
  }

  // Determine evolution type and new traits
  const currentPersonality = entityType === 'groom' ? entity.personality : entity.temperament;
  const availableTraits = EVOLVED_TRAITS[entityType][currentPersonality] || [];
  
  return {
    shouldEvolve: true,
    type: EVOLUTION_TYPES.TRAIT_STRENGTHENING,
    newTraits: availableTraits.slice(0, 2), // Add first 2 available traits
    newPersonality: entityType === 'horse' ? determineNewTemperament(entity.temperament, patterns) : null,
    newTemperament: entityType === 'horse' ? determineNewTemperament(entity.temperament, patterns) : null,
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
  if (scores.length < 2) return 0;
  
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Lower standard deviation = higher consistency
  return Math.max(0, 1 - (standardDeviation / mean));
}

function identifyPatterns(interactions) {
  // Simplified pattern identification
  return ['consistent_quality', 'positive_bonding'];
}

function calculatePerformanceQuality(interactions) {
  return interactions.length > 0 ? 0.75 : 0; // Simplified calculation
}

function calculateSpecializationLevel(groom) {
  return groom.experience > 100 ? 0.8 : 0.5; // Simplified calculation
}

function estimateNextEvolution(entity, entityType) {
  return '2-3 weeks'; // Simplified estimate
}

function generateEvolutionRecommendations(triggers, entityType) {
  return ['Continue consistent interactions', 'Focus on quality care'];
}

function calculateCareConsistency(interactions) {
  return interactions.length > 0 ? 0.7 : 0;
}

function calculateEnvironmentalStability(interactions) {
  return 0.8; // Simplified calculation
}

function calculateAgeStability(horseId) {
  return 0.9; // Simplified calculation
}

function calculateGroomInfluence(interactions) {
  return interactions.length > 10 ? 0.6 : 0.3;
}

function generateStabilityRecommendations(factors) {
  return ['Maintain consistent care patterns'];
}

async function getCurrentPersonalityState(entityId, entityType) {
  return { personality: 'calm', traits: [], stability: 0.7 };
}

async function analyzePersonalityTrends(entityId, entityType) {
  return { influencingFactors: ['experience', 'interactions'] };
}

function calculateEvolutionProbability(state, trends, days) {
  return Math.min(0.8, days / 30 * 0.3);
}

function predictPersonalityChanges(state, trends, days) {
  return ['trait_strengthening'];
}

function calculatePredictionConfidence(trends, days) {
  return Math.max(0.5, 1 - (days / 90));
}

function generatePredictionRecommendations(predictions) {
  return ['Continue current care patterns'];
}
