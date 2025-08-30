/**
 * Epigenetic Flag Definitions
 * 
 * Defines all epigenetic flags that can be assigned to horses based on care patterns.
 * These flags influence trait development, competition performance, and breeding outcomes.
 * 
 * Business Rules:
 * - Maximum 5 flags per horse
 * - Flags are permanent once assigned
 * - Conflicting flags cannot coexist
 * - Trigger conditions must be met for assignment
 */

export const FLAG_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral',
};

export const MAX_FLAGS_PER_HORSE = 5;

export const FLAG_EVALUATION_AGE_RANGE = {
  MIN: 0,
  MAX: 3,
};

export const EPIGENETIC_FLAG_DEFINITIONS = {
  // Positive Behavioral Flags
  BRAVE: {
    name: 'brave',
    type: FLAG_TYPES.POSITIVE,
    description: 'Horse shows courage and confidence in new situations',
    effects: {
      traitProbability: { confident: +0.2, fearful: -0.3 },
      competitionBonus: { showJumping: +2, crossCountry: +3 },
      stressReduction: +0.1,
    },
    conflictsWith: ['fearful', 'anxious'],
    triggerConditions: {
      careConsistency: 0.7,
      stressManagement: 'effective',
      taskDiversity: 0.5,
      stressSpikes: 'low',
    },
  },

  AFFECTIONATE: {
    name: 'affectionate',
    type: FLAG_TYPES.POSITIVE,
    description: 'Horse forms strong bonds with handlers and shows trust',
    effects: {
      traitProbability: { social: +0.3, antisocial: -0.4 },
      bondingBonus: +0.2,
      groomEffectiveness: +0.15,
    },
    conflictsWith: ['antisocial', 'withdrawn'],
    triggerConditions: {
      frequentInteractions: true,
      positiveBondTrend: true,
      consistentGroom: true,
      highPositiveRatio: 0.7,
    },
  },

  CONFIDENT: {
    name: 'confident',
    type: FLAG_TYPES.POSITIVE,
    description: 'Horse displays self-assurance and composure',
    effects: {
      traitProbability: { bold: +0.25, insecure: -0.3 },
      competitionBonus: { dressage: +2, racing: +1 },
      stressResistance: +0.2,
    },
    conflictsWith: ['insecure', 'fearful'],
    triggerConditions: {
      strongBondGrowth: true,
      lowStress: true,
      diverseExperiences: true,
      excellentQuality: 0.5,
    },
  },

  SOCIAL: {
    name: 'social',
    type: FLAG_TYPES.POSITIVE,
    description: 'Horse enjoys interaction and responds well to handlers',
    effects: {
      traitProbability: { friendly: +0.3, shy: -0.2 },
      groomEffectiveness: +0.1,
      bondingSpeed: +0.15,
    },
    conflictsWith: ['antisocial', 'aggressive'],
    triggerConditions: {
      multipleGroomInteractions: true,
      positiveResponseRate: 0.8,
      socialExposure: true,
    },
  },

  CALM: {
    name: 'calm',
    type: FLAG_TYPES.POSITIVE,
    description: 'Horse maintains composure under pressure',
    effects: {
      traitProbability: { steady: +0.25, reactive: -0.3 },
      stressResistance: +0.25,
      competitionBonus: { dressage: +3, endurance: +2 },
    },
    conflictsWith: ['reactive', 'nervous'],
    triggerConditions: {
      lowStressSpikes: true,
      consistentBehavior: true,
      stressRecovery: 'fast',
    },
  },

  // Negative Behavioral Flags
  FEARFUL: {
    name: 'fearful',
    type: FLAG_TYPES.NEGATIVE,
    description: 'Horse shows excessive fear and anxiety',
    effects: {
      traitProbability: { anxious: +0.3, brave: -0.4 },
      competitionPenalty: { showJumping: -3, crossCountry: -4 },
      stressIncrease: +0.2,
    },
    conflictsWith: ['brave', 'confident'],
    triggerConditions: {
      highStressSpikes: true,
      poorStressManagement: true,
      inconsistentCare: true,
      careGaps: 'frequent',
    },
  },

  INSECURE: {
    name: 'insecure',
    type: FLAG_TYPES.NEGATIVE,
    description: 'Horse lacks confidence and seeks constant reassurance',
    effects: {
      traitProbability: { dependent: +0.25, confident: -0.3 },
      bondingDifficulty: +0.15,
      competitionPenalty: { racing: -2, polo: -2 },
    },
    conflictsWith: ['confident', 'brave'],
    triggerConditions: {
      frequentGroomChanges: true,
      decliningBond: true,
      lowPositiveRatio: true,
      neglectPeriods: true,
    },
  },

  ANTISOCIAL: {
    name: 'antisocial',
    type: FLAG_TYPES.NEGATIVE,
    description: 'Horse avoids interaction and shows resistance to handling',
    effects: {
      traitProbability: { aggressive: +0.2, friendly: -0.4 },
      groomEffectiveness: -0.2,
      bondingDifficulty: +0.25,
    },
    conflictsWith: ['social', 'affectionate'],
    triggerConditions: {
      negativeInteractions: 'frequent',
      avoidanceBehavior: true,
      poorHandlerRelationship: true,
    },
  },

  FRAGILE: {
    name: 'fragile',
    type: FLAG_TYPES.NEGATIVE,
    description: 'Horse is emotionally sensitive and easily overwhelmed',
    effects: {
      traitProbability: { sensitive: +0.3, resilient: -0.3 },
      stressIncrease: +0.3,
      competitionPenalty: { racing: -2, eventing: -3 },
    },
    conflictsWith: ['resilient', 'steady'],
    triggerConditions: {
      overwhelmingSituations: true,
      poorStressRecovery: true,
      sensitiveReactions: true,
    },
  },

  REACTIVE: {
    name: 'reactive',
    type: FLAG_TYPES.NEGATIVE,
    description: 'Horse overreacts to stimuli and situations',
    effects: {
      traitProbability: { explosive: +0.25, calm: -0.3 },
      stressIncrease: +0.15,
      competitionPenalty: { dressage: -3, endurance: -2 },
    },
    conflictsWith: ['calm', 'steady'],
    triggerConditions: {
      overreactions: 'frequent',
      stimuliSensitivity: 'high',
      unpredictableBehavior: true,
    },
  },

  // Neutral/Specialized Flags
  CURIOUS: {
    name: 'curious',
    type: FLAG_TYPES.NEUTRAL,
    description: 'Horse shows interest in new experiences and learning',
    effects: {
      traitProbability: { intelligent: +0.2, stubborn: -0.1 },
      trainingEffectiveness: +0.1,
      adaptability: +0.15,
    },
    conflictsWith: ['withdrawn', 'fearful'],
    triggerConditions: {
      exploratoryBehavior: true,
      noveltyExposure: true,
      learningEngagement: true,
    },
  },

  INDEPENDENT: {
    name: 'independent',
    type: FLAG_TYPES.NEUTRAL,
    description: 'Horse prefers to work autonomously',
    effects: {
      traitProbability: { selfReliant: +0.2, dependent: -0.2 },
      competitionBonus: { endurance: +2, racing: +1 },
      groomDependency: -0.1,
    },
    conflictsWith: ['dependent', 'clingy'],
    triggerConditions: {
      selfDirectedBehavior: true,
      lowGroomDependency: true,
      autonomousDecisions: true,
    },
  },
};

/**
 * Get flag definition by name
 * @param {string} flagName - Name of the flag
 * @returns {Object|null} Flag definition or null if not found
 */
export function getFlagDefinition(flagName) {
  const upperName = flagName.toUpperCase();
  return EPIGENETIC_FLAG_DEFINITIONS[upperName] || null;
}

/**
 * Get all flags of a specific type
 * @param {string} type - Flag type (positive, negative, neutral)
 * @returns {Array} Array of flag definitions
 */
export function getFlagsByType(type) {
  return Object.values(EPIGENETIC_FLAG_DEFINITIONS)
    .filter(flag => flag.type === type);
}

/**
 * Check if two flags conflict with each other
 * @param {string} flag1 - First flag name
 * @param {string} flag2 - Second flag name
 * @returns {boolean} True if flags conflict
 */
export function flagsConflict(flag1, flag2) {
  const def1 = getFlagDefinition(flag1);
  const def2 = getFlagDefinition(flag2);
  
  if (!def1 || !def2) return false;
  
  return (def1.conflictsWith && def1.conflictsWith.includes(flag2.toLowerCase())) ||
         (def2.conflictsWith && def2.conflictsWith.includes(flag1.toLowerCase()));
}

/**
 * Get all valid flags that can be assigned to a horse
 * @param {Array} currentFlags - Current flags on the horse
 * @returns {Array} Array of valid flag names
 */
export function getValidFlags(currentFlags = []) {
  const availableFlags = [];
  
  for (const [flagKey, flagDef] of Object.entries(EPIGENETIC_FLAG_DEFINITIONS)) {
    const flagName = flagDef.name;
    
    // Skip if horse already has this flag
    if (currentFlags.includes(flagName)) continue;
    
    // Check for conflicts with existing flags
    const hasConflict = currentFlags.some(existingFlag => 
      flagsConflict(flagName, existingFlag)
    );
    
    if (!hasConflict) {
      availableFlags.push(flagName);
    }
  }
  
  return availableFlags;
}

/**
 * Get all flag definitions
 * @returns {Object} All epigenetic flag definitions
 */
export function getAllFlagDefinitions() {
  return EPIGENETIC_FLAG_DEFINITIONS;
}


