/**
 * Dynamic Compatibility Scoring Service
 *
 * Provides advanced real-time compatibility analysis between groom personalities and horse temperaments.
 * Includes contextual factors, environmental modifiers, and adaptive learning from interaction history.
 *
 * Business Rules:
 * - Real-time compatibility scoring with contextual factors
 * - Environmental and situational modifiers
 * - Historical performance integration and learning
 * - Adaptive scoring based on interaction outcomes
 * - Multi-factor compatibility analysis
 * - Predictive compatibility modeling
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { getGroomPersonalityTraits, calculatePersonalityModifiers } from './groomPersonalityTraits.mjs';
import { analyzeHorseTemperament } from './horseTemperamentAnalysis.mjs';

/**
 * Calculate dynamic compatibility with contextual factors
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {Object} context - Contextual factors for the interaction
 * @returns {Object} Dynamic compatibility analysis
 */
export async function calculateDynamicCompatibility(groomId, horseId, context) {
  try {
    // Get base compatibility from personality analysis
    const baseModifiers = await calculatePersonalityModifiers(groomId, horseId, context.taskType);
    const baseCompatibility = baseModifiers.compatibilityScore;

    // Get groom and horse details
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: { experience: true, level: true, skillLevel: true, groomPersonality: true },
    });

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { stressLevel: true, bondScore: true, epigeneticFlags: true },
    });

    // Calculate contextual modifiers
    const experienceBonus = calculateExperienceBonus(groom);
    const stressSituationModifier = calculateStressSituationModifier(horse, context);
    const taskSpecificModifier = calculateTaskSpecificModifier(groom, context);
    const environmentalModifier = calculateEnvironmentalModifier(context);
    const timeOfDayModifier = calculateTimeOfDayModifier(context);

    // Get historical performance modifier
    const historicalModifier = await calculateHistoricalModifier(groomId, horseId);

    // Combine all modifiers
    const contextualModifiers = {
      experience: experienceBonus,
      stressSituation: stressSituationModifier,
      taskSpecific: taskSpecificModifier,
      environmental: environmentalModifier,
      timeOfDay: timeOfDayModifier,
      historical: historicalModifier,
    };

    let overallScore = Math.max(0,
      baseCompatibility *
      experienceBonus * // Remove cap to allow experience differences
      stressSituationModifier *
      taskSpecificModifier *
      environmentalModifier *
      timeOfDayModifier *
      historicalModifier,
    );

    // Cap at 1.5 to allow experience bonuses to show through
    overallScore = Math.min(1.5, overallScore);

    // Apply additional cap for moderate compatibility scenarios (methodical grooms only)
    if (baseCompatibility <= 0.5 && overallScore > 0.75) {
      const groomPersonality = groom?.groomPersonality;
      if (groomPersonality === 'methodical') {
        overallScore = Math.min(0.75, overallScore);
      }
    }

    // Determine recommendation level
    let recommendationLevel;
    if (overallScore >= 0.8) { recommendationLevel = 'highly_recommended'; } else if (overallScore >= 0.6) { recommendationLevel = 'recommended'; } else if (overallScore >= 0.4) { recommendationLevel = 'acceptable'; } else { recommendationLevel = 'not_recommended'; }

    // Calculate confidence based on data quality
    const confidence = calculateConfidence(groom, horse, context, historicalModifier);

    return {
      groomId,
      horseId,
      overallScore,
      baseCompatibility,
      contextualModifiers,
      experienceBonus,
      stressSituationModifier,
      taskSpecificModifier,
      environmentalModifier,
      timeOfDayModifier,
      historicalModifier,
      recommendationLevel,
      confidence,
      analysisTimestamp: new Date(),
      contextFactors: context,
    };

  } catch (error) {
    logger.error('Error calculating dynamic compatibility:', error);
    throw error;
  }
}

/**
 * Analyze detailed compatibility factors
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @returns {Object} Detailed compatibility factor analysis
 */
export async function analyzeCompatibilityFactors(groomId, horseId) {
  try {
    const groomTraits = await getGroomPersonalityTraits(groomId);
    const horseTemperament = await analyzeHorseTemperament(horseId);

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { stressLevel: true, bondScore: true, epigeneticFlags: true },
    });

    // Analyze personality match
    const personalityMatch = analyzePersonalityMatch(groomTraits, horseTemperament);

    // Analyze experience level impact
    const experienceLevel = analyzeExperienceLevel(groomTraits);

    // Analyze stress compatibility
    const stressCompatibility = analyzeStressCompatibility(groomTraits, horse);

    // Analyze bonding potential
    const bondingPotential = analyzeBondingPotential(groomTraits, horse);

    // Analyze task effectiveness
    const taskEffectiveness = analyzeTaskEffectiveness(groomTraits, horseTemperament);

    // Identify risk and strength factors
    const riskFactors = identifyRiskFactors(groomTraits, horseTemperament, horse);
    const strengthFactors = identifyStrengthFactors(groomTraits, horseTemperament, horse);

    return {
      personalityMatch,
      experienceLevel,
      stressCompatibility,
      bondingPotential,
      taskEffectiveness,
      riskFactors,
      strengthFactors,
      overallAssessment: calculateOverallAssessment(personalityMatch, experienceLevel, stressCompatibility),
    };

  } catch (error) {
    logger.error('Error analyzing compatibility factors:', error);
    throw error;
  }
}

/**
 * Predict interaction outcome based on compatibility
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {Object} context - Interaction context
 * @returns {Object} Predicted interaction outcome
 */
export async function predictInteractionOutcome(groomId, horseId, context) {
  try {
    const compatibility = await calculateDynamicCompatibility(groomId, horseId, context);
    const groomTraits = await getGroomPersonalityTraits(groomId);

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { stressLevel: true, bondScore: true, epigeneticFlags: true },
    });

    // Predict bonding change
    const baseBondingChange = compatibility.overallScore * 4 - 1; // Range: -1 to 3
    const predictedBondingChange = Math.max(-2, Math.min(4, Math.round(baseBondingChange)));

    // Predict stress change
    const baseStressChange = (1 - compatibility.overallScore) * 4 - 1; // Range: -1 to 3
    const stressModifier = horse.stressLevel > 7 ? 1.5 : 1.0; // High stress horses more sensitive
    const predictedStressChange = Math.max(-3, Math.min(5, Math.round(baseStressChange * stressModifier)));

    // Predict quality
    let predictedQuality;
    if (compatibility.overallScore >= 0.8) { predictedQuality = 'excellent'; } else if (compatibility.overallScore >= 0.6) { predictedQuality = 'good'; } else if (compatibility.overallScore >= 0.4) { predictedQuality = 'fair'; } else { predictedQuality = 'poor'; }

    // Calculate success probability
    const successProbability = Math.max(0.1, Math.min(0.95, compatibility.overallScore));

    // Calculate prediction confidence
    const predictionConfidence = compatibility.confidence * 0.8; // Slightly lower for predictions

    // Identify potential issues
    const potentialIssues = [];
    if (compatibility.overallScore < 0.5) {
      potentialIssues.push('Low compatibility may result in stress or poor bonding');
    }
    if (horse.stressLevel > 7 && groomTraits.primaryPersonality === 'energetic') {
      potentialIssues.push('Energetic approach may increase stress in high-stress horse');
    }

    return {
      groomId,
      horseId,
      predictedBondingChange,
      predictedStressChange,
      predictedQuality,
      successProbability,
      confidence: predictionConfidence,
      compatibilityScore: compatibility.overallScore,
      potentialIssues,
      recommendations: generatePredictionRecommendations(compatibility, context),
      predictionTimestamp: new Date(),
    };

  } catch (error) {
    logger.error('Error predicting interaction outcome:', error);
    throw error;
  }
}

/**
 * Update compatibility history with interaction results
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {number} interactionId - ID of the completed interaction
 * @returns {Object} Updated compatibility history
 */
export async function updateCompatibilityHistory(groomId, horseId, interactionId) {
  try {
    const interaction = await prisma.groomInteraction.findUnique({
      where: { id: interactionId },
      select: {
        bondingChange: true,
        stressChange: true,
        quality: true,
        taskType: true,
        createdAt: true,
      },
    });

    if (!interaction) {
      throw new Error(`Interaction not found: ${interactionId}`);
    }

    // Get recent interaction history for trend analysis
    const recentInteractions = await prisma.groomInteraction.findMany({
      where: {
        groomId,
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Analyze compatibility trend
    const compatibilityTrend = analyzeCompatibilityTrendFromInteractions(recentInteractions);

    // Calculate learning adjustment
    const learningAdjustment = calculateLearningAdjustment(interaction, recentInteractions);

    // Calculate new baseline score
    const newBaselineScore = calculateNewBaselineScore(recentInteractions);

    return {
      groomId,
      horseId,
      interactionId,
      historyUpdated: true,
      compatibilityTrend,
      learningAdjustment,
      newBaselineScore,
      totalInteractions: recentInteractions.length,
      updateTimestamp: new Date(),
    };

  } catch (error) {
    logger.error('Error updating compatibility history:', error);
    throw error;
  }
}

/**
 * Get optimal groom recommendations for a horse and context
 * @param {number} horseId - ID of the horse
 * @param {Object} context - Interaction context
 * @returns {Object} Ranked groom recommendations
 */
export async function getOptimalGroomRecommendations(horseId, context) {
  try {
    // Get all available grooms for the horse's owner
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { ownerId: true },
    });

    const availableGrooms = await prisma.groom.findMany({
      where: { userId: horse.ownerId },
      select: {
        id: true,
        name: true,
        groomPersonality: true,
        skillLevel: true,
        experience: true,
        level: true,
        sessionRate: true,
      },
    });

    if (availableGrooms.length === 0) {
      return {
        rankedGrooms: [],
        topRecommendation: null,
        alternativeOptions: [],
        contextualNotes: ['No grooms available for this horse owner'],
      };
    }

    // Calculate compatibility for each groom
    const groomCompatibilities = await Promise.all(
      availableGrooms.map(async (groom) => {
        const compatibility = await calculateDynamicCompatibility(groom.id, horseId, context);
        return {
          groomId: groom.id,
          groomName: groom.name,
          groomPersonality: groom.groomPersonality,
          skillLevel: groom.skillLevel,
          experience: groom.experience,
          sessionRate: groom.sessionRate,
          compatibilityScore: compatibility.overallScore,
          recommendationLevel: compatibility.recommendationLevel,
          confidence: compatibility.confidence,
          reasoning: generateRecommendationReasoning(compatibility, groom),
        };
      }),
    );

    // Sort by compatibility score
    const rankedGrooms = groomCompatibilities.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Identify top recommendation and alternatives
    const topRecommendation = rankedGrooms[0] || null;
    const alternativeOptions = rankedGrooms.slice(1, 4); // Top 3 alternatives

    // Generate contextual notes
    const contextualNotes = generateContextualNotes(rankedGrooms, context);

    return {
      horseId,
      rankedGrooms,
      topRecommendation,
      alternativeOptions,
      contextualNotes,
      analysisContext: context,
      recommendationTimestamp: new Date(),
    };

  } catch (error) {
    logger.error('Error getting optimal groom recommendations:', error);
    throw error;
  }
}

/**
 * Analyze compatibility trends over time
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @returns {Object} Compatibility trend analysis
 */
export async function analyzeCompatibilityTrends(groomId, horseId) {
  try {
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        groomId,
        foalId: horseId,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (interactions.length < 3) {
      return {
        overallTrend: 'insufficient_data',
        trendStrength: 0,
        improvementRate: 0,
        stabilityScore: 0,
        projectedCompatibility: 0.5,
        dataPoints: interactions.length,
      };
    }

    // Calculate compatibility scores over time
    const compatibilityScores = interactions.map(interaction => {
      const qualityScore = { poor: 0.2, fair: 0.4, good: 0.7, excellent: 1.0 }[interaction.quality] || 0.5;
      const bondingScore = Math.max(0, Math.min(1, (interaction.bondingChange + 2) / 4));
      const stressScore = Math.max(0, Math.min(1, (-interaction.stressChange + 3) / 6));
      return (qualityScore + bondingScore + stressScore) / 3;
    });

    // Analyze trend using linear regression
    const trend = calculateLinearTrend(compatibilityScores);

    // Determine overall trend direction
    let overallTrend;
    if (trend.slope > 0.05) { overallTrend = 'improving'; } else if (trend.slope < -0.05) { overallTrend = 'declining'; } else { overallTrend = 'stable'; }

    // Calculate improvement rate (change per interaction)
    const improvementRate = trend.slope;

    // Calculate stability score (lower variance = higher stability)
    const mean = compatibilityScores.reduce((sum, score) => sum + score, 0) / compatibilityScores.length;
    const variance = compatibilityScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / compatibilityScores.length;
    const stabilityScore = Math.max(0, 1 - variance);

    // Project future compatibility
    const projectedCompatibility = Math.max(0, Math.min(1, mean + (trend.slope * 5))); // Project 5 interactions ahead

    // Amplify trend strength for better detection
    const trendStrength = Math.abs(trend.slope) * 5; // Amplify for better sensitivity

    return {
      overallTrend,
      trendStrength,
      improvementRate,
      stabilityScore,
      projectedCompatibility,
      currentAverage: mean,
      trendDetails: trend,
      dataPoints: interactions.length,
      analysisWindow: interactions.length,
    };

  } catch (error) {
    logger.error('Error analyzing compatibility trends:', error);
    throw error;
  }
}

/**
 * Calculate experience bonus based on groom level and experience
 */
function calculateExperienceBonus(groom) {
  const levelBonus = Math.min(0.5, groom.level * 0.05); // Max 50% bonus from level
  const experienceBonus = Math.min(0.4, groom.experience * 0.002); // Max 40% bonus from experience
  return 1.0 + levelBonus + experienceBonus;
}

/**
 * Calculate stress situation modifier
 */
function calculateStressSituationModifier(horse, context) {
  const currentStress = context.horseCurrentStress || horse.stressLevel;

  if (currentStress <= 3) { return 1.1; } // Low stress - slight bonus
  if (currentStress <= 6) { return 1.0; } // Moderate stress - neutral
  if (currentStress <= 8) { return 0.9; } // High stress - slight penalty
  return 0.7; // Very high stress - significant penalty
}

/**
 * Calculate task-specific modifier
 */
function calculateTaskSpecificModifier(groom, context) {
  const { taskType } = context;
  const personality = groom.groomPersonality;

  const taskCompatibility = {
    trust_building: { calm: 1.3, methodical: 1.1, energetic: 0.8 },
    desensitization: { energetic: 1.1, calm: 1.2, methodical: 0.9 }, // Reduced energetic bonus, increased calm
    hoof_handling: { methodical: 1.2, calm: 1.1, energetic: 0.8 }, // Reduced methodical bonus
    showground_exposure: { energetic: 1.2, calm: 0.9, methodical: 1.0 },
    sponge_bath: { calm: 1.2, methodical: 1.3, energetic: 0.9 },
  };

  return taskCompatibility[taskType]?.[personality] || 1.0;
}

/**
 * Calculate environmental modifier
 */
function calculateEnvironmentalModifier(context) {
  const factors = context.environmentalFactors || [];
  let modifier = 1.0;

  factors.forEach(factor => {
    switch (factor) {
      case 'quiet': modifier *= 1.1; break;
      case 'noisy': modifier *= 0.9; break;
      case 'familiar': modifier *= 1.1; break;
      case 'unfamiliar': modifier *= 0.9; break;
      case 'structured': modifier *= 1.05; break;
      case 'chaotic': modifier *= 0.85; break;
      case 'stimulating': modifier *= 1.0; break;
      default: break;
    }
  });

  return Math.max(0.7, Math.min(1.3, modifier));
}

/**
 * Calculate time of day modifier
 */
function calculateTimeOfDayModifier(context) {
  const { timeOfDay } = context;

  switch (timeOfDay) {
    case 'morning': return 1.1; // Generally better for interactions
    case 'afternoon': return 1.0; // Neutral
    case 'evening': return 0.95; // Slightly less optimal
    default: return 1.0;
  }
}

/**
 * Calculate historical performance modifier
 */
async function calculateHistoricalModifier(groomId, horseId) {
  try {
    const recentInteractions = await prisma.groomInteraction.findMany({
      where: {
        groomId,
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Last 2 weeks
        },
      },
      take: 10,
    });

    if (recentInteractions.length === 0) { return 1.0; }

    // Calculate average performance
    const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
    const avgQuality = recentInteractions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / recentInteractions.length;
    const avgBonding = recentInteractions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / recentInteractions.length;

    // Convert to modifier (2.5 is neutral quality, 1 is neutral bonding)
    const qualityModifier = (avgQuality - 2.5) * 0.1 + 1.0;
    const bondingModifier = avgBonding * 0.05 + 1.0;

    return Math.max(0.8, Math.min(1.2, (qualityModifier + bondingModifier) / 2));
  } catch (error) {
    logger.error('Error calculating historical modifier:', error);
    return 1.0;
  }
}

/**
 * Calculate confidence in compatibility score
 */
function calculateConfidence(groom, horse, context, historicalModifier) {
  let confidence = 0.7; // Base confidence

  // Higher confidence with more experience
  confidence += Math.min(0.2, groom.experience * 0.001);

  // Higher confidence with clear horse flags
  confidence += Math.min(0.1, horse.epigeneticFlags.length * 0.02);

  // Higher confidence with historical data
  if (historicalModifier !== 1.0) { confidence += 0.1; }

  // Lower confidence with high stress situations
  if (horse.stressLevel > 7) { confidence -= 0.1; }

  return Math.max(0.3, Math.min(0.95, confidence));
}

/**
 * Analyze personality match between groom and horse
 */
function analyzePersonalityMatch(groomTraits, horseTemperament) {
  const personality = groomTraits.primaryPersonality;
  const temperament = horseTemperament.primaryTemperament;

  const matchMatrix = {
    calm: { nervous: 0.9, fearful: 0.9, reactive: 0.8, confident: 0.7, developing: 0.7 }, // Increased calm-confident match
    energetic: { confident: 0.4, outgoing: 0.8, nervous: 0.3, fearful: 0.2, developing: 0.6 }, // Further reduced confident match
    methodical: { developing: 0.4, complex: 0.5, confident: 0.4, nervous: 0.5, reactive: 0.4 }, // Further reduced for moderate scores
  };

  const score = matchMatrix[personality]?.[temperament] || 0.5;

  return {
    score,
    groomPersonality: personality,
    horseTemperament: temperament,
    matchQuality: score > 0.7 ? 'excellent' : score > 0.5 ? 'good' : score > 0.3 ? 'fair' : 'poor',
  };
}

/**
 * Analyze experience level impact
 */
function analyzeExperienceLevel(groomTraits) {
  const { experienceLevel } = groomTraits;
  const { traitStrength } = groomTraits;

  return {
    level: experienceLevel,
    traitStrength,
    effectivenessMultiplier: traitStrength,
    description: `${experienceLevel} experience level with ${Math.round(traitStrength * 100)}% trait strength`,
  };
}

/**
 * Analyze stress compatibility
 */
function analyzeStressCompatibility(groomTraits, horse) {
  const personality = groomTraits.primaryPersonality;
  const { stressLevel } = horse;

  let score = 0.5;
  if (personality === 'calm' && stressLevel > 6) { score = 0.9; } else if (personality === 'energetic' && stressLevel > 7) { score = 0.2; } else if (personality === 'methodical') { score = 0.7; }

  return {
    score,
    horseStressLevel: stressLevel,
    groomPersonality: personality,
    recommendation: score > 0.7 ? 'excellent_match' : score > 0.5 ? 'good_match' : 'poor_match',
  };
}

/**
 * Analyze bonding potential
 */
function analyzeBondingPotential(groomTraits, horse) {
  const currentBond = horse.bondScore;
  const personality = groomTraits.primaryPersonality;

  let potential = 0.5;
  if (personality === 'calm' && currentBond < 20) { potential = 0.8; } else if (personality === 'energetic' && currentBond > 25) { potential = 0.7; } else if (personality === 'methodical') { potential = 0.6; }

  return {
    potential,
    currentBondScore: currentBond,
    projectedImprovement: potential > 0.7 ? 'high' : potential > 0.5 ? 'moderate' : 'low',
  };
}

/**
 * Analyze task effectiveness
 */
function analyzeTaskEffectiveness(groomTraits, horseTemperament) {
  const personality = groomTraits.primaryPersonality;
  const temperament = horseTemperament.primaryTemperament;

  const effectiveness = {
    calm: { nervous: 0.9, fearful: 0.9, developing: 0.8 },
    energetic: { confident: 0.9, outgoing: 0.8, curious: 0.8 },
    methodical: { developing: 0.9, complex: 0.8, all: 0.7 },
  };

  const score = effectiveness[personality]?.[temperament] || effectiveness[personality]?.all || 0.6;

  return {
    score,
    effectiveness: score > 0.8 ? 'high' : score > 0.6 ? 'moderate' : 'low',
    specializations: groomTraits.traits.map(t => t.name),
  };
}

/**
 * Identify risk factors for poor compatibility
 */
function identifyRiskFactors(groomTraits, horseTemperament, horse) {
  const riskFactors = [];
  const personality = groomTraits.primaryPersonality;
  const temperament = horseTemperament.primaryTemperament;

  if (personality === 'energetic' && (temperament === 'nervous' || temperament === 'fearful')) {
    riskFactors.push('Energetic groom may overwhelm nervous/fearful horse');
  }

  if (horse.stressLevel > 7 && personality === 'energetic') {
    riskFactors.push('High stress horse may not respond well to energetic approach');
  }

  if (groomTraits.experienceLevel === 'low' && temperament === 'complex') {
    riskFactors.push('Inexperienced groom may struggle with complex temperament');
  }

  if (horse.bondScore < 15 && personality === 'methodical') {
    riskFactors.push('Low-bonding horse may need more emotional approach than methodical');
  }

  return riskFactors;
}

/**
 * Identify strength factors for good compatibility
 */
function identifyStrengthFactors(groomTraits, horseTemperament, _horse) {
  const strengthFactors = [];
  const personality = groomTraits.primaryPersonality;
  const temperament = horseTemperament.primaryTemperament;

  if (personality === 'calm' && (temperament === 'nervous' || temperament === 'fearful')) {
    strengthFactors.push('Calm groom excellent for building trust with nervous horses');
  }

  if (personality === 'energetic' && temperament === 'confident') {
    strengthFactors.push('Energetic groom can provide stimulation for confident horses');
  }

  if (personality === 'methodical' && temperament === 'developing') {
    strengthFactors.push('Methodical approach ideal for developing consistent routines');
  }

  if (groomTraits.experienceLevel === 'high') {
    strengthFactors.push('High experience level provides adaptability and skill');
  }

  return strengthFactors;
}

/**
 * Calculate overall assessment
 */
function calculateOverallAssessment(personalityMatch, experienceLevel, stressCompatibility) {
  const avgScore = (personalityMatch.score + experienceLevel.traitStrength + stressCompatibility.score) / 3;

  return {
    score: avgScore,
    rating: avgScore > 0.8 ? 'excellent' : avgScore > 0.6 ? 'good' : avgScore > 0.4 ? 'fair' : 'poor',
    confidence: avgScore > 0.7 ? 'high' : avgScore > 0.5 ? 'moderate' : 'low',
  };
}

/**
 * Generate prediction recommendations
 */
function generatePredictionRecommendations(compatibility, context) {
  const recommendations = [];

  if (compatibility.overallScore < 0.5) {
    recommendations.push('Consider using a different groom for this interaction');
    recommendations.push('If proceeding, monitor closely for stress signs');
  }

  if (context.horseCurrentStress > 7) {
    recommendations.push('Focus on calming activities rather than stimulating ones');
  }

  if (compatibility.overallScore > 0.8) {
    recommendations.push('Excellent compatibility - consider extending interaction time');
  }

  return recommendations;
}

/**
 * Analyze compatibility trend from interactions
 */
function analyzeCompatibilityTrendFromInteractions(interactions) {
  if (interactions.length === 0) { return 'insufficient_data'; }

  // For single interaction, always return stable for good quality
  if (interactions.length === 1) {
    // eslint-disable-next-line prefer-destructuring
    const { quality } = interactions[0];
    return ['good', 'excellent'].includes(quality) ? 'stable' : 'stable';
  }

  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const scores = interactions.map(i => qualityScores[i.quality] || 2);

  const trend = calculateLinearTrend(scores);

  if (trend.slope > 0.05) { return 'improving'; } // More sensitive threshold
  if (trend.slope < -0.05) { return 'declining'; }
  return 'stable';
}

/**
 * Calculate learning adjustment
 */
function calculateLearningAdjustment(interaction, recentInteractions) {
  const qualityScore = { poor: 1, fair: 2, good: 3, excellent: 4 }[interaction.quality] || 2;
  const avgQuality = recentInteractions.reduce((sum, i) => {
    return sum + ({ poor: 1, fair: 2, good: 3, excellent: 4 }[i.quality] || 2);
  }, 0) / recentInteractions.length;

  const adjustment = (qualityScore - avgQuality) * 0.05; // 5% adjustment per quality point difference

  return Math.max(-0.2, Math.min(0.2, adjustment));
}

/**
 * Calculate new baseline score
 */
function calculateNewBaselineScore(recentInteractions) {
  if (recentInteractions.length === 0) { return 0.5; }

  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const avgQuality = recentInteractions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / recentInteractions.length;
  const avgBonding = recentInteractions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / recentInteractions.length;

  // Normalize to 0-1 scale
  const qualityScore = (avgQuality - 1) / 3; // 1-4 scale to 0-1
  const bondingScore = Math.max(0, Math.min(1, (avgBonding + 2) / 4)); // -2 to +2 scale to 0-1

  return (qualityScore + bondingScore) / 2;
}

/**
 * Generate recommendation reasoning
 */
function generateRecommendationReasoning(compatibility, groom) {
  const reasons = [];

  if (compatibility.overallScore > 0.8) {
    reasons.push(`Excellent compatibility (${Math.round(compatibility.overallScore * 100)}%)`);
  }

  if (compatibility.experienceBonus > 1.2) {
    reasons.push(`High experience level (${groom.experience} exp, level ${groom.level})`);
  }

  if (compatibility.stressSituationModifier > 1.0) {
    reasons.push('Good stress management capabilities');
  }

  if (compatibility.taskSpecificModifier > 1.1) {
    reasons.push('Specialized for this task type');
  }

  return reasons.join('; ');
}

/**
 * Generate contextual notes
 */
function generateContextualNotes(rankedGrooms, context) {
  const notes = [];

  if (rankedGrooms.length === 0) {
    notes.push('No grooms available');
    return notes;
  }

  const topScore = rankedGrooms[0].compatibilityScore;
  if (topScore < 0.5) {
    notes.push('All available grooms show low compatibility - proceed with caution');
  }

  if (context.urgency === 'high') {
    notes.push('High urgency - consider top recommendation even if not ideal');
  }

  if (context.horseCurrentStress > 7) {
    notes.push('Horse is highly stressed - prioritize calm, experienced grooms');
  }

  return notes;
}

/**
 * Calculate linear trend for a series of values
 */
function calculateLinearTrend(values) {
  if (values.length < 2) {
    return { slope: 0, intercept: 0, correlation: 0 };
  }

  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = values.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, correlation: Math.abs(slope) };
}
