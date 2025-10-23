/**
 * Flag Assignment Engine
 *
 * Core flag assignment logic with trigger condition validation.
 * Evaluates care patterns against epigenetic flag definitions to determine
 * which flags should be assigned to horses based on their care history.
 *
 * Business Rules:
 * - Maximum 5 flags per horse
 * - Flags are permanent once assigned
 * - Trigger conditions must be met for flag assignment
 * - Conflicting flags cannot coexist
 * - Pattern-based evaluation using real care data
 */

import logger from '../utils/logger.mjs';
import { EPIGENETIC_FLAG_DEFINITIONS, FLAG_TYPES } from '../config/epigeneticFlagDefinitions.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Evaluate flag triggers based on care patterns
 * @param {Object} horse - Horse object with current flags
 * @param {Object} carePatterns - Care pattern analysis results
 * @returns {Object} Flag evaluation results with eligible flags and trigger conditions
 */
export async function evaluateFlagTriggers(horse, carePatterns) {
  try {
    const eligibleFlags = [];
    const triggerConditions = {};
    const currentFlags = horse.epigeneticFlags || [];

    // Evaluate each flag definition against care patterns
    for (const [_flagKey, flagDef] of Object.entries(EPIGENETIC_FLAG_DEFINITIONS)) {
      const flagName = flagDef.name;

      // Skip if horse already has this flag
      if (currentFlags.includes(flagName)) {
        continue;
      }

      // Skip if horse already has maximum flags
      if (currentFlags.length >= 5) {
        break;
      }

      // Check for conflicting flags
      if (hasConflictingFlags(flagDef, currentFlags)) {
        continue;
      }

      // Evaluate trigger conditions
      const triggerResult = evaluateTriggerConditions(flagDef, carePatterns, horse);

      if (triggerResult.triggered) {
        eligibleFlags.push(flagName);
        triggerConditions[flagName] = triggerResult.conditions;

        logger.info(`Flag ${flagName} triggered for horse ${horse.name}: ${triggerResult.reason}`);
      }
    }

    return {
      eligibleFlags,
      triggerConditions,
      evaluatedFlags: Object.keys(EPIGENETIC_FLAG_DEFINITIONS).length,
      currentFlagCount: currentFlags.length,
    };

  } catch (error) {
    logger.error('Error evaluating flag triggers:', error);
    throw error;
  }
}

/**
 * Check if a flag conflicts with existing flags
 * @param {Object} flagDef - Flag definition
 * @param {Array} currentFlags - Current flags on the horse
 * @returns {boolean} True if there are conflicts
 */
function hasConflictingFlags(flagDef, currentFlags) {
  // Check for direct conflicts defined in flag definition
  if (flagDef.conflictsWith) {
    for (const conflictFlag of flagDef.conflictsWith) {
      if (currentFlags.includes(conflictFlag)) {
        return true;
      }
    }
  }

  // Check for type-based conflicts (e.g., positive vs negative of same trait)
  const oppositeTypes = {
    [FLAG_TYPES.POSITIVE]: FLAG_TYPES.NEGATIVE,
    [FLAG_TYPES.NEGATIVE]: FLAG_TYPES.POSITIVE,
  };

  if (oppositeTypes[flagDef.type]) {
    // This would require more complex logic to check semantic conflicts
    // For now, we rely on explicit conflicts defined in flag definitions
  }

  return false;
}

/**
 * Evaluate trigger conditions for a specific flag
 * @param {Object} flagDef - Flag definition with trigger conditions
 * @param {Object} carePatterns - Care pattern analysis
 * @param {Object} horse - Horse object
 * @returns {Object} Trigger evaluation result
 */
function evaluateTriggerConditions(flagDef, carePatterns, horse) {
  const conditions = flagDef.triggerConditions;
  const _triggered = { triggered: false, reason: '', conditions: {} };

  try {
    // Evaluate based on flag name and common patterns
    switch (flagDef.name) {
      case 'brave':
        return evaluateBraveTriggers(conditions, carePatterns, horse);

      case 'affectionate':
        return evaluateAffectionateTriggers(conditions, carePatterns, horse);

      case 'confident':
        return evaluateConfidentTriggers(conditions, carePatterns, horse);

      case 'social':
        return evaluateSocialTriggers(conditions, carePatterns, horse);

      case 'calm':
        return evaluateCalmTriggers(conditions, carePatterns, horse);

      case 'fearful':
        return evaluateFearfulTriggers(conditions, carePatterns, horse);

      case 'insecure':
        return evaluateInsecureTriggers(conditions, carePatterns, horse);

      case 'antisocial':
        return evaluateAntisocialTriggers(conditions, carePatterns, horse);

      case 'fragile':
        return evaluateFragileTriggers(conditions, carePatterns, horse);

      default:
        // Generic evaluation for undefined flags
        return evaluateGenericTriggers(flagDef, carePatterns, horse);
    }

  } catch (error) {
    logger.error(`Error evaluating triggers for flag ${flagDef.name}:`, error);
    return { triggered: false, reason: 'Evaluation error', conditions: {} };
  }
}

/**
 * Evaluate triggers for BRAVE flag
 */
function evaluateBraveTriggers(conditions, carePatterns, _horse) {
  const { consistency, stressPatterns, taskDiversity } = carePatterns;

  // Brave flag: consistent care with stress management and task variety
  const consistentCare = consistency.consistencyScore > 0.7;
  const goodStressManagement = stressPatterns.averageReduction < -1; // Effective stress reduction
  const diverseTasks = taskDiversity.diversity > 0.5;
  const lowStressSpikes = stressPatterns.stressSpikes.length <= 2;

  const triggered = consistentCare && goodStressManagement && diverseTasks && lowStressSpikes;

  return {
    triggered,
    reason: triggered ? 'Consistent care with good stress management and task diversity' : 'Conditions not met',
    conditions: {
      consistentCare,
      goodStressManagement,
      diverseTasks,
      lowStressSpikes,
    },
  };
}

/**
 * Evaluate triggers for AFFECTIONATE flag
 */
function evaluateAffectionateTriggers(conditions, carePatterns, _horse) {
  const { consistency, bondTrends, groomConsistency } = carePatterns;

  // Affectionate flag: frequent positive interactions with consistent groom
  const frequentCare = consistency.averageInteractionsPerDay > 0.8;
  const positiveBondTrend = bondTrends.trend === 'improving' || bondTrends.averageChange > 0;
  const consistentGroom = groomConsistency.consistencyScore > 0.8;
  const highPositiveRatio = bondTrends.positiveRatio > 0.7;

  const triggered = frequentCare && positiveBondTrend && consistentGroom && highPositiveRatio;

  return {
    triggered,
    reason: triggered ? 'Frequent positive interactions with consistent groom care' : 'Conditions not met',
    conditions: {
      frequentCare,
      positiveBondTrend,
      consistentGroom,
      highPositiveRatio,
    },
  };
}

/**
 * Evaluate triggers for CONFIDENT flag
 */
function evaluateConfidentTriggers(conditions, carePatterns, horse) {
  const { bondTrends, _stressPatterns, taskDiversity } = carePatterns;

  // Confident flag: positive bond development with diverse experiences
  const strongBondGrowth = bondTrends.averageChange > 1.5;
  const lowStress = horse.stressLevel < 5;
  const diverseExperiences = taskDiversity.diversity > 0.6;
  const excellentQuality = taskDiversity.excellentQualityRatio > 0.5;

  const triggered = strongBondGrowth && lowStress && diverseExperiences && excellentQuality;

  return {
    triggered,
    reason: triggered ? 'Strong bond growth with diverse, high-quality experiences' : 'Conditions not met',
    conditions: {
      strongBondGrowth,
      lowStress,
      diverseExperiences,
      excellentQuality,
    },
  };
}

/**
 * Evaluate triggers for FEARFUL flag (negative)
 */
function evaluateFearfulTriggers(conditions, carePatterns, _horse) {
  const { stressPatterns, _neglectPatterns, consistency } = carePatterns;

  // Fearful flag: high stress with poor care consistency
  const highStressSpikes = stressPatterns.stressSpikes.length > 3;
  const poorStressManagement = stressPatterns.averageReduction > -0.5;
  const inconsistentCare = consistency.consistencyScore < 0.4;
  const careGaps = consistency.careGaps.length > 2;

  const triggered = (highStressSpikes && poorStressManagement) || (inconsistentCare && careGaps);

  return {
    triggered,
    reason: triggered ? 'High stress with poor care consistency' : 'Conditions not met',
    conditions: {
      highStressSpikes,
      poorStressManagement,
      inconsistentCare,
      careGaps,
    },
  };
}

/**
 * Evaluate triggers for INSECURE flag (negative)
 */
function evaluateInsecureTriggers(conditions, carePatterns, _horse) {
  const { groomConsistency, bondTrends, neglectPatterns } = carePatterns;

  // Insecure flag: frequent groom changes with declining bond
  const frequentGroomChanges = groomConsistency.groomChanges > 2;
  const decliningBond = bondTrends.trend === 'declining';
  const lowPositiveRatio = bondTrends.positiveRatio < 0.3;
  const someNeglect = neglectPatterns.neglectRatio > 0.3;

  const triggered = (frequentGroomChanges && decliningBond) || (lowPositiveRatio && someNeglect);

  return {
    triggered,
    reason: triggered ? 'Frequent groom changes with declining bond or neglect' : 'Conditions not met',
    conditions: {
      frequentGroomChanges,
      decliningBond,
      lowPositiveRatio,
      someNeglect,
    },
  };
}

/**
 * Generic trigger evaluation for undefined flags
 */
function evaluateGenericTriggers(flagDef, carePatterns, _horse) {
  // Basic evaluation based on flag type
  if (flagDef.type === FLAG_TYPES.POSITIVE) {
    const goodCare = carePatterns.consistency.consistencyScore > 0.6;
    const positiveBond = carePatterns.bondTrends.averageChange > 0;

    return {
      triggered: goodCare && positiveBond,
      reason: 'Generic positive flag evaluation',
      conditions: { goodCare, positiveBond },
    };
  } else if (flagDef.type === FLAG_TYPES.NEGATIVE) {
    const poorCare = carePatterns.consistency.consistencyScore < 0.4;
    const negativeBond = carePatterns.bondTrends.averageChange < 0;

    return {
      triggered: poorCare || negativeBond,
      reason: 'Generic negative flag evaluation',
      conditions: { poorCare, negativeBond },
    };
  }

  return {
    triggered: false,
    reason: 'No evaluation criteria defined',
    conditions: {},
  };
}

// Placeholder functions for other flag types
function evaluateSocialTriggers(_conditions, _carePatterns, _horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}

function evaluateCalmTriggers(_conditions, _carePatterns, _horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}

function evaluateAntisocialTriggers(_conditions, _carePatterns, _horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}

function evaluateFragileTriggers(_conditions, _carePatterns, _horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}

/**
 * Evaluate flag triggers with personality-based modifiers
 * @param {Object} horse - Horse object with current flags
 * @param {Object} carePatterns - Care pattern analysis results
 * @returns {Object} Enhanced flag evaluation with personality modifiers
 */
export async function evaluatePersonalityModifiedTriggers(horse, carePatterns) {
  try {
    // Get recent groom interactions to analyze personality patterns
    const recentInteractions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horse.id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      include: {
        groom: {
          select: { groomPersonality: true, skillLevel: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Analyze personality distribution
    const personalityStats = analyzeGroomPersonalities(recentInteractions);

    // Calculate personality modifiers
    const personalityModifiers = calculatePersonalityModifiers(personalityStats, horse);

    // Apply modifiers to trigger conditions
    const adjustedTriggers = applyPersonalityModifiers(carePatterns, personalityModifiers);

    return {
      personalityModifiers,
      adjustedTriggers,
      personalityStats,
      originalPatterns: carePatterns,
    };

  } catch (error) {
    logger.error('Error evaluating personality modified triggers:', error);
    throw error;
  }
}

/**
 * Calculate comprehensive flag assignment score with multiple factors
 * @param {Object} horse - Horse object
 * @param {string} flagName - Name of flag to evaluate
 * @param {Object} carePatterns - Care pattern analysis
 * @returns {Object} Detailed scoring breakdown
 */
export async function calculateFlagAssignmentScore(horse, flagName, carePatterns) {
  try {
    const flagDef = EPIGENETIC_FLAG_DEFINITIONS[flagName.toUpperCase()];
    if (!flagDef) {
      throw new Error(`Flag definition not found: ${flagName}`);
    }

    // Calculate base score from care patterns
    const baseScore = calculateBaseScore(flagDef, carePatterns);

    // Apply age-based sensitivity modifier
    const ageModifier = calculateAgeModifier(horse);

    // Apply personality-based modifier
    const personalityModifier = await calculatePersonalityModifier(horse, flagName);

    // Calculate temporal consistency modifier
    const temporalModifier = await calculateTemporalModifier(horse.id, flagName);

    // Combine all factors
    const totalScore = baseScore * ageModifier * personalityModifier * temporalModifier;

    // Determine threshold based on flag type and horse age
    const threshold = calculateAssignmentThreshold(flagDef, horse);

    return {
      totalScore,
      threshold,
      shouldAssign: totalScore >= threshold,
      components: {
        baseScore,
        ageModifier,
        personalityModifier,
        temporalModifier,
      },
      flagName,
      flagType: flagDef.type,
    };

  } catch (error) {
    logger.error(`Error calculating flag assignment score for ${flagName}:`, error);
    throw error;
  }
}

/**
 * Analyze temporal patterns in care quality and interactions
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Temporal pattern analysis
 */
export async function analyzeTemporalPatterns(horseId) {
  try {
    // Get interactions over the last 60 days
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (interactions.length === 0) {
      return {
        trendAnalysis: { bondTrend: 'no_data', stressTrend: 'no_data', qualityTrend: 'no_data' },
        periodicPatterns: [],
        criticalPeriods: [],
      };
    }

    // Analyze trends over time
    const trendAnalysis = analyzeTrends(interactions);

    // Identify periodic patterns (weekly, bi-weekly)
    const periodicPatterns = identifyPeriodicPatterns(interactions);

    // Identify critical periods (high stress, poor care)
    const criticalPeriods = identifyCriticalPeriods(interactions);

    return {
      trendAnalysis,
      periodicPatterns,
      criticalPeriods,
      totalInteractions: interactions.length,
      analysisWindow: 60, // days
    };

  } catch (error) {
    logger.error(`Error analyzing temporal patterns for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Analyze groom personality distribution in recent interactions
 */
function analyzeGroomPersonalities(interactions) {
  const personalityCount = {};
  const personalityEffects = {};

  interactions.forEach(interaction => {
    const personality = interaction.groom?.groomPersonality || 'unknown';
    personalityCount[personality] = (personalityCount[personality] || 0) + 1;

    if (!personalityEffects[personality]) {
      personalityEffects[personality] = {
        totalBondChange: 0,
        totalStressChange: 0,
        interactions: 0,
      };
    }

    personalityEffects[personality].totalBondChange += interaction.bondingChange || 0;
    personalityEffects[personality].totalStressChange += interaction.stressChange || 0;
    personalityEffects[personality].interactions += 1;
  });

  // Calculate averages
  Object.keys(personalityEffects).forEach(personality => {
    const effects = personalityEffects[personality];
    effects.avgBondChange = effects.totalBondChange / effects.interactions;
    effects.avgStressChange = effects.totalStressChange / effects.interactions;
  });

  return {
    distribution: personalityCount,
    effects: personalityEffects,
    totalInteractions: interactions.length,
  };
}

/**
 * Calculate personality-based modifiers for flag triggers
 */
function calculatePersonalityModifiers(personalityStats, _horse) {
  const modifiers = {};

  // Calm personality effects
  if (personalityStats.effects.calm) {
    const calmEffects = personalityStats.effects.calm;
    modifiers.calm = {
      stressReduction: Math.max(0.8, 1 + (calmEffects.avgStressChange / 10)), // Better stress management
      bondingBonus: Math.max(0.9, 1 + (calmEffects.avgBondChange / 20)), // Steady bonding
      flagBias: ['confident', 'calm', 'social'], // Favors positive flags
    };
  }

  // Energetic personality effects
  if (personalityStats.effects.energetic) {
    const _energeticEffects = personalityStats.effects.energetic;
    modifiers.energetic = {
      stimulationBonus: 1.2, // Better for curious, brave flags
      stressSensitivity: 1.1, // Slightly more stress-inducing
      flagBias: ['brave', 'curious'], // Favors adventurous flags
    };
  }

  // Methodical personality effects
  if (personalityStats.effects.methodical) {
    const _methodicalEffects = personalityStats.effects.methodical;
    modifiers.methodical = {
      consistencyBonus: 1.3, // Excellent for consistent care
      qualityBonus: 1.2, // Higher quality interactions
      flagBias: ['confident', 'calm'], // Favors stable flags
    };
  }

  return modifiers;
}

/**
 * Apply personality modifiers to care patterns
 */
function applyPersonalityModifiers(carePatterns, personalityModifiers) {
  const adjusted = JSON.parse(JSON.stringify(carePatterns)); // Deep copy

  // Apply calm modifiers
  if (personalityModifiers.calm) {
    if (adjusted.stressPatterns?.averageReduction !== undefined) {
      adjusted.stressPatterns.averageReduction *= personalityModifiers.calm.stressReduction;
    }
    if (adjusted.bondTrends?.averageChange !== undefined) {
      adjusted.bondTrends.averageChange *= personalityModifiers.calm.bondingBonus;
    }
  }

  // Apply energetic modifiers
  if (personalityModifiers.energetic) {
    if (adjusted.taskDiversity?.diversity !== undefined) {
      adjusted.taskDiversity.diversity *= personalityModifiers.energetic.stimulationBonus;
    }
    if (adjusted.stressPatterns?.averageReduction !== undefined) {
      adjusted.stressPatterns.averageReduction *= personalityModifiers.energetic.stressSensitivity;
    }
  }

  // Apply methodical modifiers
  if (personalityModifiers.methodical) {
    if (adjusted.consistency?.consistencyScore !== undefined) {
      adjusted.consistency.consistencyScore *= personalityModifiers.methodical.consistencyBonus;
    }
    if (adjusted.taskDiversity?.excellentQualityRatio !== undefined) {
      adjusted.taskDiversity.excellentQualityRatio *= personalityModifiers.methodical.qualityBonus;
    }
  }

  return adjusted;
}

/**
 * Calculate base score from care patterns
 */
function calculateBaseScore(flagDef, carePatterns) {
  let score = 0;

  // Positive flags benefit from good care
  if (flagDef.type === FLAG_TYPES.POSITIVE) {
    score += carePatterns.consistency?.consistencyScore * 0.3 || 0;
    score += Math.max(0, carePatterns.bondTrends?.averageChange * 0.1) || 0;
    score += Math.max(0, -carePatterns.stressPatterns?.averageReduction * 0.1) || 0;
    score += carePatterns.taskDiversity?.diversity * 0.2 || 0;
    score += carePatterns.taskDiversity?.excellentQualityRatio * 0.2 || 0;
  }

  // Negative flags benefit from poor care
  if (flagDef.type === FLAG_TYPES.NEGATIVE) {
    score += (1 - (carePatterns.consistency?.consistencyScore || 0)) * 0.3;
    score += Math.max(0, -carePatterns.bondTrends?.averageChange * 0.1) || 0;
    score += Math.max(0, carePatterns.stressPatterns?.averageReduction * 0.1) || 0;
    score += carePatterns.stressPatterns?.stressSpikes?.length * 0.1 || 0;
    score += carePatterns.neglectPatterns?.neglectRatio * 0.2 || 0;
  }

  return Math.max(0, Math.min(1, score)); // Normalize to 0-1
}

/**
 * Calculate age-based sensitivity modifier
 */
function calculateAgeModifier(horse) {
  const ageInDays = Math.floor(
    (Date.now() - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24),
  );

  // Younger horses are more sensitive to flag triggers
  if (ageInDays <= 30) { return 1.5; } // Very young (0-1 month)
  if (ageInDays <= 90) { return 1.3; } // Young (1-3 months)
  if (ageInDays <= 180) { return 1.1; } // Moderate (3-6 months)
  if (ageInDays <= 365) { return 1.0; } // Older (6-12 months)
  return 0.8; // Mature (1+ years)
}

/**
 * Calculate personality-based modifier for specific flag
 */
async function calculatePersonalityModifier(horse, flagName) {
  try {
    // Get recent groom personality distribution
    const recentInteractions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horse.id,
        createdAt: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Last 2 weeks
        },
      },
      include: {
        groom: { select: { groomPersonality: true } },
      },
    });

    if (recentInteractions.length === 0) { return 1.0; }

    const personalityStats = analyzeGroomPersonalities(recentInteractions);
    const modifiers = calculatePersonalityModifiers(personalityStats, horse);

    // Apply flag-specific personality bonuses
    let modifier = 1.0;

    Object.values(modifiers).forEach(mod => {
      if (mod.flagBias && mod.flagBias.includes(flagName)) {
        modifier *= 1.2; // 20% bonus for compatible personality
      }
    });

    return modifier;
  } catch (error) {
    logger.error('Error calculating personality modifier:', error);
    return 1.0;
  }
}

/**
 * Calculate temporal consistency modifier
 */
async function calculateTemporalModifier(horseId, flagName) {
  try {
    const patterns = await analyzeTemporalPatterns(horseId);

    // Positive flags benefit from improving trends
    if (['brave', 'confident', 'affectionate', 'social', 'calm'].includes(flagName)) {
      if (patterns.trendAnalysis.bondTrend === 'improving' &&
          patterns.trendAnalysis.stressTrend === 'decreasing') {
        return 1.3;
      }
      if (patterns.trendAnalysis.qualityTrend === 'improving') {
        return 1.2;
      }
    }

    // Negative flags benefit from declining trends
    if (['fearful', 'insecure', 'antisocial', 'fragile', 'reactive'].includes(flagName)) {
      if (patterns.trendAnalysis.bondTrend === 'declining' ||
          patterns.trendAnalysis.stressTrend === 'increasing') {
        return 1.3;
      }
      if (patterns.criticalPeriods.length > 0) {
        return 1.4;
      }
    }

    return 1.0;
  } catch (error) {
    logger.error('Error calculating temporal modifier:', error);
    return 1.0;
  }
}

/**
 * Calculate assignment threshold based on flag type and horse characteristics
 */
function calculateAssignmentThreshold(flagDef, horse) {
  let baseThreshold = 0.6; // Default threshold

  // Adjust based on flag type
  if (flagDef.type === FLAG_TYPES.POSITIVE) {
    baseThreshold = 0.7; // Higher threshold for positive flags
  } else if (flagDef.type === FLAG_TYPES.NEGATIVE) {
    baseThreshold = 0.5; // Lower threshold for negative flags (easier to trigger)
  }

  // Adjust based on horse age (younger horses have lower thresholds)
  const ageInDays = Math.floor(
    (Date.now() - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24),
  );

  if (ageInDays <= 30) {
    baseThreshold *= 0.8; // Very young
  } else if (ageInDays <= 90) {
    baseThreshold *= 0.9; // Young
  }

  return baseThreshold;
}

/**
 * Analyze trends in interaction data over time
 */
function analyzeTrends(interactions) {
  if (interactions.length < 3) {
    return {
      bondTrend: 'insufficient_data',
      stressTrend: 'insufficient_data',
      qualityTrend: 'insufficient_data',
    };
  }

  // Split interactions into early and late periods
  const midpoint = Math.floor(interactions.length / 2);
  const early = interactions.slice(0, midpoint);
  const late = interactions.slice(midpoint);

  // Calculate averages for each period
  const earlyBond = early.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / early.length;
  const lateBond = late.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / late.length;

  const earlyStress = early.reduce((sum, i) => sum + (i.stressChange || 0), 0) / early.length;
  const lateStress = late.reduce((sum, i) => sum + (i.stressChange || 0), 0) / late.length;

  // Quality scoring
  const qualityScore = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const earlyQuality = early.reduce((sum, i) => sum + (qualityScore[i.quality] || 2), 0) / early.length;
  const lateQuality = late.reduce((sum, i) => sum + (qualityScore[i.quality] || 2), 0) / late.length;

  return {
    bondTrend: lateBond > earlyBond + 0.5 ? 'improving' :
      lateBond < earlyBond - 0.5 ? 'declining' : 'stable',
    stressTrend: lateStress < earlyStress - 0.5 ? 'decreasing' :
      lateStress > earlyStress + 0.5 ? 'increasing' : 'stable',
    qualityTrend: lateQuality > earlyQuality + 0.3 ? 'improving' :
      lateQuality < earlyQuality - 0.3 ? 'declining' : 'stable',
  };
}

/**
 * Identify periodic patterns in care
 */
function identifyPeriodicPatterns(interactions) {
  // Simple implementation - could be enhanced with more sophisticated analysis
  const patterns = [];

  // Group by day of week
  const dayGroups = {};
  interactions.forEach(interaction => {
    const dayOfWeek = interaction.createdAt.getDay();
    if (!dayGroups[dayOfWeek]) { dayGroups[dayOfWeek] = []; }
    dayGroups[dayOfWeek].push(interaction);
  });

  // Identify days with consistently high or low quality
  Object.entries(dayGroups).forEach(([day, dayInteractions]) => {
    if (dayInteractions.length >= 2) {
      const avgQuality = dayInteractions.reduce((sum, i) => {
        const qualityScore = { poor: 1, fair: 2, good: 3, excellent: 4 };
        return sum + (qualityScore[i.quality] || 2);
      }, 0) / dayInteractions.length;

      if (avgQuality >= 3.5) {
        patterns.push({
          type: 'weekly_high_quality',
          dayOfWeek: parseInt(day),
          avgQuality,
          frequency: dayInteractions.length,
        });
      } else if (avgQuality <= 1.5) {
        patterns.push({
          type: 'weekly_low_quality',
          dayOfWeek: parseInt(day),
          avgQuality,
          frequency: dayInteractions.length,
        });
      }
    }
  });

  return patterns;
}

/**
 * Identify critical periods that may trigger negative flags
 */
function identifyCriticalPeriods(interactions) {
  const criticalPeriods = [];

  // Look for periods of high stress or poor bonding
  for (let i = 0; i < interactions.length - 1; i++) {
    const current = interactions[i];
    const next = interactions[i + 1];

    // Check for stress spikes
    if ((current.stressChange || 0) >= 3 && (next.stressChange || 0) >= 2) {
      criticalPeriods.push({
        period: 'stress_spike',
        start: current.createdAt,
        end: next.createdAt,
        severity: 'high',
        flagRisk: ['fearful', 'reactive', 'fragile'],
      });
    }

    // Check for bonding failures
    if ((current.bondingChange || 0) <= -2 && (next.bondingChange || 0) <= -1) {
      criticalPeriods.push({
        period: 'bonding_failure',
        start: current.createdAt,
        end: next.createdAt,
        severity: 'moderate',
        flagRisk: ['insecure', 'antisocial'],
      });
    }
  }

  return criticalPeriods;
}
