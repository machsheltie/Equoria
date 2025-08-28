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
    for (const [flagKey, flagDef] of Object.entries(EPIGENETIC_FLAG_DEFINITIONS)) {
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
  const triggered = { triggered: false, reason: '', conditions: {} };

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
function evaluateBraveTriggers(conditions, carePatterns, horse) {
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
function evaluateAffectionateTriggers(conditions, carePatterns, horse) {
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
  const { bondTrends, stressPatterns, taskDiversity } = carePatterns;
  
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
function evaluateFearfulTriggers(conditions, carePatterns, horse) {
  const { stressPatterns, neglectPatterns, consistency } = carePatterns;
  
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
function evaluateInsecureTriggers(conditions, carePatterns, horse) {
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
function evaluateGenericTriggers(flagDef, carePatterns, horse) {
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
function evaluateSocialTriggers(conditions, carePatterns, horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}

function evaluateCalmTriggers(conditions, carePatterns, horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}

function evaluateAntisocialTriggers(conditions, carePatterns, horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}

function evaluateFragileTriggers(conditions, carePatterns, horse) {
  return { triggered: false, reason: 'Not implemented', conditions: {} };
}
