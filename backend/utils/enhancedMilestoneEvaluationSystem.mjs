/**
 * Enhanced Milestone Evaluation System
 *
 * Implements the comprehensive milestone evaluation system that integrates groom care history,
 * bond consistency, and task diversity into trait determination logic for foals under 3 years.
 *
 * Features:
 * - Developmental window tracking (Day 1, Week 1-4)
 * - Groom assignment and history integration
 * - Bond modifier calculations
 * - Task consistency and diversity scoring
 * - Care gaps penalty system
 * - Trait confirmation scoring (>=3 confirms, <=-3 denies, otherwise randomized)
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { applyPersonalityEffectsToMilestone } from './personalityModifierEngine.mjs';

// Milestone types and their developmental windows
export const MILESTONE_TYPES = {
  IMPRINTING: 'imprinting',
  SOCIALIZATION: 'socialization',
  CURIOSITY_PLAY: 'curiosity_play',
  TRUST_HANDLING: 'trust_handling',
  CONFIDENCE_REACTIVITY: 'confidence_reactivity',
};

// Developmental windows in days
export const DEVELOPMENTAL_WINDOWS = {
  [MILESTONE_TYPES.IMPRINTING]: { start: 0, end: 1 },
  [MILESTONE_TYPES.SOCIALIZATION]: { start: 1, end: 7 },
  [MILESTONE_TYPES.CURIOSITY_PLAY]: { start: 8, end: 14 },
  [MILESTONE_TYPES.TRUST_HANDLING]: { start: 15, end: 21 },
  [MILESTONE_TYPES.CONFIDENCE_REACTIVITY]: { start: 22, end: 28 },
};

// Trait thresholds for confirmation
export const TRAIT_THRESHOLDS = {
  CONFIRM: 3,
  DENY: -3,
};

// Milestone-specific trait pools
export const MILESTONE_TRAIT_POOLS = {
  [MILESTONE_TYPES.IMPRINTING]: {
    positive: ['bonded', 'trusting', 'calm'],
    negative: ['fearful', 'reactive', 'withdrawn'],
  },
  [MILESTONE_TYPES.SOCIALIZATION]: {
    positive: ['social', 'confident', 'curious'],
    negative: ['antisocial', 'nervous', 'shy'],
  },
  [MILESTONE_TYPES.CURIOSITY_PLAY]: {
    positive: ['playful', 'intelligent', 'bold'],
    negative: ['lazy', 'dull', 'timid'],
  },
  [MILESTONE_TYPES.TRUST_HANDLING]: {
    positive: ['trusting', 'calm', 'cooperative'],
    negative: ['hesitant', 'reactive', 'wary'],
  },
  [MILESTONE_TYPES.CONFIDENCE_REACTIVITY]: {
    positive: ['confident', 'brave', 'resilient'],
    negative: ['anxious', 'fearful', 'fragile'],
  },
};

/**
 * Evaluate enhanced milestone for a horse
 * @param {number} horseId - Horse ID
 * @param {string} milestoneType - Type of milestone to evaluate
 * @param {Object} options - Additional options
 * @returns {Object} Milestone evaluation result
 */
export async function evaluateEnhancedMilestone(horseId, milestoneType, options = {}) {
  try {
    logger.info(`[enhancedMilestoneEvaluationSystem.evaluateEnhancedMilestone] Starting evaluation for horse ${horseId}, milestone ${milestoneType}`);

    // Validate milestone type
    if (!Object.values(MILESTONE_TYPES).includes(milestoneType)) {
      throw new Error(`Invalid milestone type: ${milestoneType}`);
    }

    // Get horse data
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      include: {
        groomAssignments: {
          where: { isActive: true },
          include: { groom: true },
        },
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Calculate horse age in days
    const ageInDays = Math.floor((Date.now() - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24));

    // Only evaluate horses under 3 years (1095 days)
    if (ageInDays >= 1095) {
      return {
        success: false,
        reason: 'Horse too old for milestone evaluation',
        ageInDays,
      };
    }

    // Get developmental window for this milestone
    const window = DEVELOPMENTAL_WINDOWS[milestoneType];
    if (ageInDays < window.start || ageInDays > window.end) {
      return {
        success: false,
        reason: 'Horse not in appropriate age window for this milestone',
        ageInDays,
        window,
      };
    }

    // Check if milestone already evaluated
    const existingEvaluation = await prisma.milestoneTraitLog.findFirst({
      where: {
        horseId,
        milestoneType,
      },
    });

    if (existingEvaluation && !options.forceReevaluate) {
      return {
        success: false,
        reason: 'Milestone already evaluated',
        existingEvaluation,
      };
    }

    // Get groom care history for milestone window
    const groomCareHistory = await getGroomCareHistory(horseId, window);

    // Get current groom assignment
    const currentGroom = horse.groomAssignments.length > 0 ? horse.groomAssignments[0].groom : null;

    // Calculate base milestone score
    const baseScore = 0;

    // Calculate bond modifier
    const bondModifier = calculateBondModifier(groomCareHistory, horse.bondScore || 50);

    // Calculate task consistency modifier
    const taskConsistencyModifier = calculateTaskConsistencyModifier(groomCareHistory);

    // Calculate care gaps penalty
    const careGapsPenalty = calculateCareGapsPenalty(groomCareHistory, window);

    // Calculate base score before personality effects
    const baseScoreBeforePersonality = baseScore + bondModifier + taskConsistencyModifier - careGapsPenalty;

    // Apply personality compatibility effects if groom and horse temperament are available
    let personalityEffects = null;
    let finalScore = baseScoreBeforePersonality;

    if (currentGroom && currentGroom.personality && horse.temperament) {
      personalityEffects = applyPersonalityEffectsToMilestone({
        groomPersonality: currentGroom.personality,
        foalTemperament: horse.temperament,
        bondScore: horse.bondScore || 50,
        baseMilestoneScore: baseScoreBeforePersonality,
        baseStressLevel: horse.stressLevel || 0,
        baseBondingRate: 0,
      });

      finalScore = personalityEffects.modifiedMilestoneScore;

      logger.info(
        `[enhancedMilestoneEvaluationSystem] Applied personality effects: ${currentGroom.personality} + ${horse.temperament} = ${personalityEffects.personalityMatchScore} modifier`,
      );
    } else {
      logger.info(
        '[enhancedMilestoneEvaluationSystem] No personality effects applied - missing groom personality or horse temperament',
      );
    }

    // Determine trait outcome
    const traitOutcome = determineTraitOutcome(finalScore, milestoneType);

    // Create milestone evaluation record
    const milestoneLog = await prisma.milestoneTraitLog.create({
      data: {
        horseId,
        milestoneType,
        score: finalScore,
        finalTrait: traitOutcome.trait,
        groomId: currentGroom?.id,
        bondScore: horse.bondScore,
        taskDiversity: groomCareHistory.taskDiversity,
        taskConsistency: groomCareHistory.taskConsistency,
        careGapsPenalty,
        personalityMatchScore: personalityEffects?.personalityMatchScore || 0,
        personalityEffectApplied: personalityEffects?.personalityEffectApplied || false,
        modifiersApplied: {
          bondModifier,
          taskConsistencyModifier,
          careGapsPenalty,
          personalityEffects: personalityEffects ? {
            groomPersonality: currentGroom.personality,
            foalTemperament: horse.temperament,
            traitModifier: personalityEffects.personalityMatchScore,
            stressReduction: personalityEffects.effects.stressReduction,
            bondingBonus: personalityEffects.effects.bondingRateChange,
          } : null,
        },
        reasoning: traitOutcome.reasoning + (personalityEffects ? ` (Personality: ${personalityEffects.personalityMatchScore > 0 ? '+' : ''}${personalityEffects.personalityMatchScore})` : ''),
        ageInDays,
      },
    });

    logger.info(`[enhancedMilestoneEvaluationSystem.evaluateEnhancedMilestone] Completed evaluation for horse ${horseId}: ${traitOutcome.trait || 'no trait'} (score: ${finalScore})`);

    return {
      success: true,
      milestoneLog,
      finalScore,
      traitOutcome,
      modifiers: {
        bondModifier,
        taskConsistencyModifier,
        careGapsPenalty,
        personalityEffects,
      },
      groomCareHistory,
      personalityCompatibility: personalityEffects?.personalityCompatibility || null,
    };

  } catch (error) {
    logger.error(`[enhancedMilestoneEvaluationSystem.evaluateEnhancedMilestone] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get groom care history for a specific window
 * @param {number} horseId - Horse ID
 * @param {Object} window - Developmental window
 * @returns {Object} Groom care history data
 */
async function getGroomCareHistory(horseId, window) {
  const windowStart = new Date(Date.now() - (window.end * 24 * 60 * 60 * 1000));
  const windowEnd = new Date(Date.now() - (window.start * 24 * 60 * 60 * 1000));

  const interactions = await prisma.groomInteraction.findMany({
    where: {
      foalId: horseId,
      timestamp: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      groom: true,
    },
    orderBy: {
      timestamp: 'asc',
    },
  });

  // Calculate task diversity
  const uniqueTaskTypes = new Set(interactions.map(i => i.taskType || i.interactionType)).size;
  const taskDiversity = Math.min(uniqueTaskTypes, 5); // Max 5 points for diversity

  // Calculate task consistency
  const totalDays = window.end - window.start + 1;
  const daysWithInteractions = new Set(
    interactions.map(i => i.timestamp.toDateString()),
  ).size;
  const taskConsistency = Math.round((daysWithInteractions / totalDays) * 5); // Max 5 points for consistency

  return {
    interactions,
    taskDiversity,
    taskConsistency,
    totalInteractions: interactions.length,
    averageQuality: interactions.length > 0
      ? interactions.reduce((sum, i) => sum + (i.qualityScore || 0.75), 0) / interactions.length
      : 0,
  };
}

/**
 * Calculate bond modifier based on average bond score
 * @param {Object} groomCareHistory - Groom care history
 * @param {number} currentBondScore - Current bond score
 * @returns {number} Bond modifier (-2 to +2)
 */
function calculateBondModifier(groomCareHistory, currentBondScore) {
  if (currentBondScore >= 80) { return 2; }
  if (currentBondScore >= 60) { return 1; }
  if (currentBondScore >= 40) { return 0; }
  if (currentBondScore >= 20) { return -1; }
  return -2;
}

/**
 * Calculate task consistency modifier
 * @param {Object} groomCareHistory - Groom care history
 * @returns {number} Task consistency modifier (0 to +3)
 */
function calculateTaskConsistencyModifier(groomCareHistory) {
  let modifier = 0;

  // +1 if ≥3 relevant tasks were completed
  if (groomCareHistory.totalInteractions >= 3) {
    modifier += 1;
  }

  // +1 if tasks were diverse (≥2 task types)
  if (groomCareHistory.taskDiversity >= 2) {
    modifier += 1;
  }

  // +1 if task quality average > 0.8
  if (groomCareHistory.averageQuality > 0.8) {
    modifier += 1;
  }

  return modifier;
}

/**
 * Calculate care gaps penalty
 * @param {Object} groomCareHistory - Groom care history
 * @param {Object} window - Developmental window
 * @returns {number} Care gaps penalty (0 to +2)
 */
function calculateCareGapsPenalty(groomCareHistory, _window) {
  let penalty = 0;

  // -1 if no tasks completed
  if (groomCareHistory.totalInteractions === 0) {
    penalty += 1;
  }

  // -2 if bond < 20 during window (handled in bond modifier, but additional penalty)
  if (groomCareHistory.interactions.length === 0) {
    penalty += 2;
  }

  return penalty;
}

/**
 * Determine trait outcome based on final score
 * @param {number} finalScore - Final calculated score
 * @param {string} milestoneType - Milestone type
 * @returns {Object} Trait outcome
 */
function determineTraitOutcome(finalScore, milestoneType) {
  const traitPool = MILESTONE_TRAIT_POOLS[milestoneType];

  if (finalScore >= TRAIT_THRESHOLDS.CONFIRM) {
    // Confirm positive trait
    const trait = traitPool.positive[Math.floor(Math.random() * traitPool.positive.length)];
    return {
      trait,
      type: 'positive',
      reasoning: `Score ${finalScore} >= ${TRAIT_THRESHOLDS.CONFIRM}: Positive trait confirmed`,
    };
  } else if (finalScore <= TRAIT_THRESHOLDS.DENY) {
    // Confirm negative trait
    const trait = traitPool.negative[Math.floor(Math.random() * traitPool.negative.length)];
    return {
      trait,
      type: 'negative',
      reasoning: `Score ${finalScore} <= ${TRAIT_THRESHOLDS.DENY}: Negative trait confirmed`,
    };
  } else {
    // Randomized within candidate pool
    const allTraits = [...traitPool.positive, ...traitPool.negative];
    const trait = allTraits[Math.floor(Math.random() * allTraits.length)];
    const type = traitPool.positive.includes(trait) ? 'positive' : 'negative';
    return {
      trait,
      type,
      reasoning: `Score ${finalScore} in neutral range: Random trait from candidate pool`,
    };
  }
}
