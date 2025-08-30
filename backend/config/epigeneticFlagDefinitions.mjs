/**
 * Epigenetic Flag Definitions
 * 
 * Defines epigenetic flags that can be applied to horses based on their care history,
 * environmental factors, and developmental milestones. These flags influence trait
 * development probabilities and behavioral characteristics.
 */

export const FLAG_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  ADAPTIVE: 'adaptive',
};

export const MAX_FLAGS_PER_HORSE = 5;

export const FLAG_EVALUATION_AGE_RANGE = {
  MIN: 0,
  MAX: 3,
};

export const SOURCE_CATEGORIES = {
  GROOMING: 'grooming',
  BONDING: 'bonding',
  ENVIRONMENT: 'environment',
  NOVELTY: 'novelty',
};

export const EPIGENETIC_FLAG_DEFINITIONS = {
  // POSITIVE FLAGS (4)
  BRAVE: {
    name: 'brave',
    displayName: 'Brave',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.NOVELTY,
    description: 'Horse shows courage and confidence in new situations',
    influences: {
      traitWeightModifiers: {
        bold: 0.3,
        spooky: -0.4,
        confident: 0.2,
        fearful: -0.3,
      },
      behaviorModifiers: {
        stressReduction: 0.1,
        competitionBonus: 0.15,
      },
    },
    conflictsWith: ['fearful', 'anxious'],
    triggerConditions: {
      careConsistency: 0.7,
      stressManagement: 'effective',
      taskDiversity: 0.5,
      stressSpikes: 'low',
    },
  },

  CONFIDENT: {
    name: 'confident',
    displayName: 'Confident',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse displays self-assurance and composure',
    influences: {
      traitWeightModifiers: {
        bold: 0.25,
        insecure: -0.3,
        self_assured: 0.3,
        timid: -0.25,
      },
      behaviorModifiers: {
        stressResistance: 0.2,
        competitionBonus: 0.1,
      },
    },
    conflictsWith: ['insecure', 'fearful'],
    triggerConditions: {
      strongBondGrowth: true,
      lowStress: true,
      diverseExperiences: true,
      excellentQuality: 0.5,
    },
  },

  AFFECTIONATE: {
    name: 'affectionate',
    displayName: 'Affectionate',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse forms strong bonds with handlers and shows trust',
    influences: {
      traitWeightModifiers: {
        social: 0.3,
        antisocial: -0.4,
        friendly: 0.25,
        withdrawn: -0.3,
      },
      behaviorModifiers: {
        bondingBonus: 0.2,
        groomEffectiveness: 0.15,
      },
    },
    conflictsWith: ['antisocial', 'withdrawn'],
    triggerConditions: {
      frequentInteractions: true,
      positiveBondTrend: true,
      consistentGroom: true,
      highPositiveRatio: 0.7,
    },
  },

  RESILIENT: {
    name: 'resilient',
    displayName: 'Resilient',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    description: 'Horse recovers quickly from stress and adapts well to challenges',
    influences: {
      traitWeightModifiers: {
        hardy: 0.4,
        fragile: -0.5,
        adaptable: 0.3,
        sensitive: -0.3,
      },
      behaviorModifiers: {
        stressRecovery: 0.2,
        adaptability: 0.25,
      },
    },
    conflictsWith: ['fragile', 'sensitive'],
    triggerConditions: {
      stressRecovery: 'fast',
      adaptabilityShown: true,
      challengeOvercome: true,
    },
  },

  // NEGATIVE FLAGS (5)
  FEARFUL: {
    name: 'fearful',
    displayName: 'Fearful',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.NOVELTY,
    description: 'Horse shows excessive fear and anxiety in new situations',
    influences: {
      traitWeightModifiers: {
        spooky: 0.4,
        bold: -0.3,
        anxious: 0.3,
        confident: -0.4,
      },
      behaviorModifiers: {
        stressIncrease: 0.2,
        competitionPenalty: -0.15,
      },
    },
    conflictsWith: ['brave', 'confident'],
    triggerConditions: {
      careGaps: 'frequent',
      highStressSpikes: true,
      inconsistentCare: true,
      poorStressManagement: true,
    },
  },

  INSECURE: {
    name: 'insecure',
    displayName: 'Insecure',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse lacks confidence and seeks constant reassurance',
    influences: {
      traitWeightModifiers: {
        confident: -0.3,
        dependent: 0.25,
        timid: 0.3,
        bold: -0.2,
      },
      behaviorModifiers: {
        bondingDifficulty: 0.15,
        competitionPenalty: -0.1,
      },
    },
    conflictsWith: ['confident', 'brave'],
    triggerConditions: {
      decliningBond: true,
      frequentGroomChanges: true,
      lowPositiveRatio: true,
      neglectPeriods: true,
    },
  },

  ALOOF: {
    name: 'aloof',
    displayName: 'Aloof',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse maintains emotional distance and resists bonding',
    influences: {
      traitWeightModifiers: {
        antisocial: 0.3,
        friendly: -0.4,
        withdrawn: 0.25,
        social: -0.3,
      },
      behaviorModifiers: {
        bondingDifficulty: 0.2,
        groomEffectiveness: -0.15,
      },
    },
    conflictsWith: ['affectionate', 'social'],
    triggerConditions: {
      avoidanceBehavior: true,
      lowInteractionQuality: true,
      emotionalWithdrawal: true,
      resistanceToHandling: true,
    },
  },

  SKITTISH: {
    name: 'skittish',
    displayName: 'Skittish',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    description: 'Horse is easily startled and overreacts to environmental stimuli',
    influences: {
      traitWeightModifiers: {
        spooky: 0.4,
        calm: -0.3,
        reactive: 0.3,
        steady: -0.25,
      },
      behaviorModifiers: {
        stressIncrease: 0.15,
        environmentalSensitivity: 0.2,
      },
    },
    conflictsWith: ['calm', 'steady'],
    triggerConditions: {
      overreactions: 'frequent',
      stimuliSensitivity: 'high',
      unpredictableBehavior: true,
      environmentalStress: true,
    },
  },

  FRAGILE: {
    name: 'fragile',
    displayName: 'Fragile',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    description: 'Horse is emotionally sensitive and easily overwhelmed',
    influences: {
      traitWeightModifiers: {
        resilient: -0.3,
        sensitive: 0.3,
        hardy: -0.4,
        delicate: 0.25,
      },
      behaviorModifiers: {
        stressIncrease: 0.3,
        recoveryTime: 0.2,
      },
    },
    conflictsWith: ['resilient', 'hardy'],
    triggerConditions: {
      overwhelmingSituations: true,
      poorStressRecovery: true,
      sensitiveReactions: true,
      emotionalBreakdowns: true,
    },
  },
};

/**
 * Get all flag definitions
 * @returns {Object} All epigenetic flag definitions
 */
export function getAllFlagDefinitions() {
  return EPIGENETIC_FLAG_DEFINITIONS;
}

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
 * @param {string} type - Flag type (positive, negative, adaptive)
 * @returns {Array} Array of flag definitions
 */
export function getFlagsByType(type) {
  return Object.values(EPIGENETIC_FLAG_DEFINITIONS)
    .filter(flag => flag.type === type);
}

/**
 * Get flags by source category
 * @param {string} category - Source category (bonding, novelty, environment, grooming)
 * @returns {Array} Flags of the specified source category
 */
export function getFlagsBySourceCategory(category) {
  const flagsByCategory = [];
  Object.values(EPIGENETIC_FLAG_DEFINITIONS).forEach(flag => {
    if (flag.sourceCategory === category) {
      flagsByCategory.push(flag);
    }
  });
  return flagsByCategory;
}

/**
 * Check if two flags conflict with each other
 * @param {string} flag1 - First flag name
 * @param {string} flag2 - Second flag name
 * @returns {boolean} True if flags conflict
 */
export function flagsConflict(flag1, flag2) {
  const flag1Def = getFlagDefinition(flag1);
  const flag2Def = getFlagDefinition(flag2);

  if (!flag1Def || !flag2Def) {
    return false;
  }

  // Check if flag1 conflicts with flag2
  if (flag1Def.conflictsWith && flag1Def.conflictsWith.includes(flag2.toLowerCase())) {
    return true;
  }

  // Check if flag2 conflicts with flag1
  if (flag2Def.conflictsWith && flag2Def.conflictsWith.includes(flag1.toLowerCase())) {
    return true;
  }

  return false;
}
