/**
 * Dynamic Compatibility Scoring Service
 *
 * Real-time compatibility between groom personalities and a horse, with
 * contextual, environmental and history modifiers (Equoria-q4uem.7 S6):
 *
 *   loadCompatibilityInputs(horseId, { groomIds } | { ownerGrooms: true })
 *     three reads: the horse, the grooms, their interactions with the horse
 *   -> scoreCompatibility / predictInteraction / rankGrooms /
 *      compatibilityTrends                         pure projections
 *   analyzeCompatibilityFactors(groomId, horseId)  load + the horses module's
 *                                                  temperament analysis + the
 *                                                  breakdown (compatibilityFactorAnalysis)
 *
 * Every projection of one input set shares one clock (`inputs.now`).
 */

import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { calculateOverallCompatibility, personalityTraitsFor } from './groomPersonalityTraits.mjs';
import { analyzeHorseTemperament } from '../../horses/index.mjs';
import { factorBreakdown } from './compatibilityFactorAnalysis.mjs';
import {
  assertCompatibilityTaskType,
  getTaskCompatibilityModifier,
} from './groomHorseCompatibilityTaskPolicy.mjs';
import {
  ENVIRONMENT_FACTOR_MULTIPLIERS,
  ENVIRONMENT_MODIFIER_RANGE,
  PREDICTION_RECOMMENDATION_RULES,
  STRESS_SITUATION_BANDS,
  STRESS_SITUATION_FALLBACK,
  TIME_OF_DAY_DEFAULT,
  TIME_OF_DAY_MODIFIERS,
  ruleTexts,
} from './dynamicCompatibilityRules.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_WINDOW_DAYS = 14;
const HISTORY_SAMPLE = 10;
const GROOM_SELECT = {
  id: true,
  name: true,
  epigeneticInfluenceType: true,
  skillLevel: true,
  experience: true,
  level: true,
  sessionRate: true,
};

/**
 * Everything compatibility reads, read once: the horse (null when missing), the
 * grooms (the given ids, or every groom of the horse's owner, by id), and their
 * interactions with the horse, oldest first. A failed interaction read is kept
 * as `interactionsError` (history then counts as neutral, as before S6; trends
 * rethrow it).
 * @param {number} horseId
 * @param {{groomIds?: number[], ownerGrooms?: boolean, now?: Date, client?: object}} [options]
 */
export async function loadCompatibilityInputs(
  horseId,
  { groomIds = [], ownerGrooms = false, now = new Date(), client = prisma } = {},
) {
  const horse = await client.horse.findUnique({
    where: { id: horseId },
    select: { id: true, userId: true, stressLevel: true, bondScore: true, epigeneticFlags: true },
  });
  let grooms = [];
  if (!ownerGrooms) {
    grooms = await client.groom.findMany({ where: { id: { in: groomIds } }, select: GROOM_SELECT });
  } else if (horse) {
    grooms = await client.groom.findMany({
      where: { userId: horse.userId },
      select: GROOM_SELECT,
      orderBy: { id: 'asc' },
    });
  }
  let interactions = [];
  let interactionsError = null;
  try {
    interactions = await client.groomInteraction.findMany({
      where: { foalId: horseId, groomId: { in: grooms.map(g => g.id) } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  } catch (error) {
    interactionsError = error;
  }
  return Object.freeze({
    horseId,
    horse,
    grooms: Object.freeze(grooms),
    interactions: Object.freeze(interactions),
    interactionsError,
    now,
  });
}

// The loaded groom with this id; throws "Groom not found: <id>" as before S6.
function requireGroom(inputs, groomId) {
  const groom = inputs.grooms.find(g => g.id === groomId);
  if (!groom) {
    throw new Error(`Groom not found: ${groomId}`);
  }
  return groom;
}

function horseIn(inputs, horseId) {
  if (!inputs.horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }
  return inputs.horse;
}

/**
 * Dynamic compatibility of one groom with the horse in a context.
 * @param {ReturnType<typeof loadCompatibilityInputs>} inputs
 * @param {number} groomId
 * @param {Object} context - Contextual factors for the interaction
 * @returns {Object} Dynamic compatibility analysis
 */
export function scoreCompatibility(inputs, groomId, context) {
  assertCompatibilityTaskType(context.taskType);
  const horseId = inputs.horseId;

  // Base compatibility from personality analysis
  const groom = requireGroom(inputs, groomId);
  const groomTraits = personalityTraitsFor(groom);
  const horse = horseIn(inputs, horseId);
  const baseCompatibility = calculateOverallCompatibility(groomTraits, horse);

  // Calculate contextual modifiers
  const experienceBonus = calculateExperienceBonus(groom);
  const stressSituationModifier = calculateStressSituationModifier(horse, context);
  const taskSpecificModifier = getTaskCompatibilityModifier(
    context.taskType,
    groom.epigeneticInfluenceType,
  );
  const environmentalModifier = calculateEnvironmentalModifier(context);
  const timeOfDayModifier = calculateTimeOfDayModifier(context);
  const historicalModifier = calculateHistoricalModifier(inputs, groomId);

  const contextualModifiers = {
    experience: experienceBonus,
    stressSituation: stressSituationModifier,
    taskSpecific: taskSpecificModifier,
    environmental: environmentalModifier,
    timeOfDay: timeOfDayModifier,
    historical: historicalModifier,
  };

  let overallScore = Math.max(
    0,
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
    const groomPersonality = groom?.epigeneticInfluenceType;
    if (groomPersonality === 'methodical') {
      overallScore = Math.min(0.75, overallScore);
    }
  }

  let recommendationLevel;
  if (overallScore >= 0.8) {
    recommendationLevel = 'highly_recommended';
  } else if (overallScore >= 0.6) {
    recommendationLevel = 'recommended';
  } else if (overallScore >= 0.4) {
    recommendationLevel = 'acceptable';
  } else {
    recommendationLevel = 'not_recommended';
  }

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
    analysisTimestamp: inputs.now,
    contextFactors: context,
  };
}

/**
 * Detailed compatibility factors: loads the inputs, validates the groom (groom
 * errors first, as before), then reads the horses module's temperament analysis
 * (its own reads) and returns the pure factor breakdown.
 * @returns {Promise<Object>} Detailed compatibility factor analysis
 */
export async function analyzeCompatibilityFactors(groomId, horseId) {
  const inputs = await loadCompatibilityInputs(horseId, { groomIds: [groomId] });
  const groomTraits = personalityTraitsFor(requireGroom(inputs, groomId));
  const horseTemperament = await analyzeHorseTemperament(horseId);
  return factorBreakdown(groomTraits, horseTemperament, inputs.horse);
}

/**
 * Predicted outcome of one interaction in a context.
 * @returns {Object} Predicted interaction outcome
 */
export function predictInteraction(inputs, groomId, context) {
  const compatibility = scoreCompatibility(inputs, groomId, context);
  const groomTraits = personalityTraitsFor(requireGroom(inputs, groomId));
  const { horse, horseId } = inputs;

  // Predict bonding change
  const baseBondingChange = compatibility.overallScore * 4 - 1; // Range: -1 to 3
  const predictedBondingChange = Math.max(-2, Math.min(4, Math.round(baseBondingChange)));

  // Predict stress change
  const baseStressChange = (1 - compatibility.overallScore) * 4 - 1; // Range: -1 to 3
  const stressModifier = horse.stressLevel > 7 ? 1.5 : 1.0; // High stress horses more sensitive
  const predictedStressChange = Math.max(
    -3,
    Math.min(5, Math.round(baseStressChange * stressModifier)),
  );

  let predictedQuality;
  if (compatibility.overallScore >= 0.8) {
    predictedQuality = 'excellent';
  } else if (compatibility.overallScore >= 0.6) {
    predictedQuality = 'good';
  } else if (compatibility.overallScore >= 0.4) {
    predictedQuality = 'fair';
  } else {
    predictedQuality = 'poor';
  }

  const successProbability = Math.max(0.1, Math.min(0.95, compatibility.overallScore));
  const predictionConfidence = compatibility.confidence * 0.8; // Slightly lower for predictions

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
    predictionTimestamp: inputs.now,
  };
}

/**
 * The owner's grooms ranked for the horse in a context (inputs loaded with
 * `ownerGrooms: true`).
 * @returns {Object} Ranked groom recommendations
 */
export function rankGrooms(inputs, context) {
  assertCompatibilityTaskType(context.taskType);
  // A missing horse fails here, as before (reading its owner).
  void inputs.horse.userId;

  if (inputs.grooms.length === 0) {
    return {
      rankedGrooms: [],
      topRecommendation: null,
      alternativeOptions: [],
      contextualNotes: ['No grooms available for this horse owner'],
    };
  }

  const rankedGrooms = inputs.grooms
    .map(groom => {
      const compatibility = scoreCompatibility(inputs, groom.id, context);
      return {
        groomId: groom.id,
        groomName: groom.name,
        epigeneticInfluenceType: groom.epigeneticInfluenceType,
        skillLevel: groom.skillLevel,
        experience: groom.experience,
        sessionRate: groom.sessionRate,
        compatibilityScore: compatibility.overallScore,
        recommendationLevel: compatibility.recommendationLevel,
        confidence: compatibility.confidence,
        reasoning: generateRecommendationReasoning(compatibility, groom),
      };
    })
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

  return {
    horseId: inputs.horseId,
    rankedGrooms,
    topRecommendation: rankedGrooms[0] || null,
    alternativeOptions: rankedGrooms.slice(1, 4), // Top 3 alternatives
    contextualNotes: generateContextualNotes(rankedGrooms, context),
    analysisContext: context,
    recommendationTimestamp: inputs.now,
  };
}

/**
 * Compatibility trend over every interaction of this groom with the horse.
 * @returns {Object} Compatibility trend analysis
 */
export function compatibilityTrends(inputs, groomId) {
  if (inputs.interactionsError) {
    throw inputs.interactionsError;
  }
  const interactions = inputs.interactions.filter(i => i.groomId === groomId);

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
    const qualityScore =
      { poor: 0.2, fair: 0.4, good: 0.7, excellent: 1.0 }[interaction.quality] || 0.5;
    const bondingScore = Math.max(0, Math.min(1, (interaction.bondingChange + 2) / 4));
    const stressScore = Math.max(0, Math.min(1, (-interaction.stressChange + 3) / 6));
    return (qualityScore + bondingScore + stressScore) / 3;
  });

  const trend = calculateLinearTrend(compatibilityScores);

  let overallTrend;
  if (trend.slope > 0.05) {
    overallTrend = 'improving';
  } else if (trend.slope < -0.05) {
    overallTrend = 'declining';
  } else {
    overallTrend = 'stable';
  }

  const improvementRate = trend.slope;

  // Stability: lower variance = higher stability
  const mean =
    compatibilityScores.reduce((sum, score) => sum + score, 0) / compatibilityScores.length;
  const variance =
    compatibilityScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
    compatibilityScores.length;
  const stabilityScore = Math.max(0, 1 - variance);

  // Project 5 interactions ahead; amplify trend strength for detection
  const projectedCompatibility = Math.max(0, Math.min(1, mean + trend.slope * 5));
  const trendStrength = Math.abs(trend.slope) * 5;

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
}

/**
 * History modifier from this groom's recent interactions with the horse: the
 * NEWEST HISTORY_SAMPLE in the last HISTORY_WINDOW_DAYS, by createdAt then id,
 * both descending (owner ruling 2026-10-23, Equoria-ld219). A failed
 * interaction read counts as neutral (1.0), as before S6.
 */
function calculateHistoricalModifier(inputs, groomId) {
  if (inputs.interactionsError) {
    logger.error('Error calculating historical modifier:', inputs.interactionsError);
    return 1.0;
  }
  const since = new Date(inputs.now.getTime() - HISTORY_WINDOW_DAYS * DAY_MS);
  const recentInteractions = inputs.interactions
    .filter(i => i.groomId === groomId && i.createdAt >= since)
    .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
    .slice(0, HISTORY_SAMPLE);

  if (recentInteractions.length === 0) {
    return 1.0;
  }

  // Calculate average performance
  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const avgQuality =
    recentInteractions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) /
    recentInteractions.length;
  const avgBonding =
    recentInteractions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) /
    recentInteractions.length;

  // Convert to modifier (2.5 is neutral quality, 1 is neutral bonding)
  const qualityModifier = (avgQuality - 2.5) * 0.1 + 1.0;
  const bondingModifier = avgBonding * 0.05 + 1.0;

  return Math.max(0.8, Math.min(1.2, (qualityModifier + bondingModifier) / 2));
}

// ===== CONTEXTUAL MODIFIERS =====

function calculateExperienceBonus(groom) {
  const levelBonus = Math.min(0.5, groom.level * 0.05); // Max 50% bonus from level
  const experienceBonus = Math.min(0.4, groom.experience * 0.002); // Max 40% bonus from experience
  return 1.0 + levelBonus + experienceBonus;
}

function calculateStressSituationModifier(horse, context) {
  const currentStress = context.horseCurrentStress || horse.stressLevel;
  const band = STRESS_SITUATION_BANDS.find(([max]) => currentStress <= max);
  return band ? band[1] : STRESS_SITUATION_FALLBACK;
}

function calculateEnvironmentalModifier(context) {
  const factors = context.environmentalFactors || [];
  let modifier = 1.0;
  factors.forEach(factor => {
    // Only a string names a factor (the old switch compared with ===).
    if (typeof factor === 'string' && Object.hasOwn(ENVIRONMENT_FACTOR_MULTIPLIERS, factor)) {
      modifier *= ENVIRONMENT_FACTOR_MULTIPLIERS[factor];
    }
  });
  const [min, max] = ENVIRONMENT_MODIFIER_RANGE;
  return Math.max(min, Math.min(max, modifier));
}

function calculateTimeOfDayModifier(context) {
  const { timeOfDay } = context;
  return typeof timeOfDay === 'string' && Object.hasOwn(TIME_OF_DAY_MODIFIERS, timeOfDay)
    ? TIME_OF_DAY_MODIFIERS[timeOfDay]
    : TIME_OF_DAY_DEFAULT;
}

function calculateConfidence(groom, horse, context, historicalModifier) {
  let confidence = 0.7; // Base confidence

  // Higher confidence with more experience
  confidence += Math.min(0.2, groom.experience * 0.001);

  // Higher confidence with clear horse flags (epigeneticFlags may be null)
  confidence += Math.min(0.1, (horse.epigeneticFlags?.length ?? 0) * 0.02);

  // Higher confidence with historical data
  if (historicalModifier !== 1.0) {
    confidence += 0.1;
  }

  // Lower confidence with high stress situations
  if (horse.stressLevel > 7) {
    confidence -= 0.1;
  }

  return Math.max(0.3, Math.min(0.95, confidence));
}

// ===== ADVICE =====

function generatePredictionRecommendations(compatibility, context) {
  return ruleTexts(PREDICTION_RECOMMENDATION_RULES, {
    overallScore: compatibility.overallScore,
    horseCurrentStress: context.horseCurrentStress,
  });
}

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

// ===== MATHS =====

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

  const denominator = n * sumXX - sumX * sumX;
  // Guard against zero denominator (all x-values identical — uniform series)
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, correlation: Math.abs(slope) };
}
