/**
 * Epigenetic Flag Definitions
 * Configuration for epigenetic flags that can be assigned to horses based on early care patterns
 *
 * 🎯 PURPOSE:
 * Defines the 9 starter epigenetic flags with their properties, triggers, and influences.
 * These flags represent learned, conditioned, or emotionally ingrained tendencies that
 * persist across life stages and influence temperament, behavior, and trait probability.
 *
 * 📋 BUSINESS RULES:
 * - Flags are permanent once assigned (no overwrites)
 * - Maximum 5 flags per horse for gameplay clarity
 * - Flags can stack (horse can have both positive and negative flags)
 * - Flags influence trait weights and competition behavior
 * - Evaluation occurs weekly between birth and age 3
 */

// Flag types for categorization
export const FLAG_TYPES = {
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  ADAPTIVE: 'adaptive',
};

// Source categories for flag triggers
export const SOURCE_CATEGORIES = {
  GROOMING: 'grooming',
  BONDING: 'bonding',
  ENVIRONMENT: 'environment',
  NOVELTY: 'novelty',
};

// Maximum flags per horse
export const MAX_FLAGS_PER_HORSE = 5;

// Age range for flag evaluation (in years)
export const FLAG_EVALUATION_AGE_RANGE = {
  MIN: 0,
  MAX: 3,
};

/**
 * Epigenetic Flag Definitions
 * Each flag includes:
 * - name: Unique identifier
 * - description: Human-readable description
 * - type: positive | negative | adaptive
 * - sourceCategory: grooming | bonding | environment | novelty
 * - influences: Object containing trait weight modifiers and behavior modifiers
 * - triggerConditions: Conditions that must be met for flag assignment
 */
export const EPIGENETIC_FLAG_DEFINITIONS = {
  // Positive Flags
  BRAVE: {
    name: 'brave',
    displayName: 'Brave',
    description: 'Foal has developed a strong response to novelty with low fear reactivity.',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.NOVELTY,
    influences: {
      traitWeightModifiers: {
        bold: 0.3,
        spooky: -0.4,
        confident: 0.2,
      },
      behaviorModifiers: {
        statRecoveryBonus: 0.05,
        stressResistance: 0.1,
      },
    },
    triggerConditions: {
      noveltyExposure: {
        minEvents: 3,
        withCalmGroomPresent: true,
        duringFearWindow: true,
      },
      bondScore: {
        minimum: 30,
      },
    },
  },

  CONFIDENT: {
    name: 'confident',
    displayName: 'Confident',
    description: 'Foal shows strong self-assurance and resilience in new situations.',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    influences: {
      traitWeightModifiers: {
        bold: 0.25,
        timid: -0.3,
        leader: 0.2,
      },
      behaviorModifiers: {
        competitionBonus: 0.03,
        trainingEfficiency: 0.05,
      },
    },
    triggerConditions: {
      consistentCare: {
        minDays: 7,
        bondThreshold: 40,
      },
      positiveInteractions: {
        minCount: 10,
        qualityThreshold: 'good',
      },
    },
  },

  AFFECTIONATE: {
    name: 'affectionate',
    displayName: 'Affectionate',
    description: 'Foal has developed strong bonds and seeks human companionship.',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    influences: {
      traitWeightModifiers: {
        friendly: 0.4,
        aloof: -0.3,
        social: 0.2,
      },
      behaviorModifiers: {
        bondingRate: 0.15,
        groomEffectiveness: 0.1,
      },
    },
    triggerConditions: {
      dailyGrooming: {
        consecutiveDays: 7,
        bondThreshold: 50,
      },
      humanInteraction: {
        frequency: 'daily',
        quality: 'good',
      },
    },
  },

  RESILIENT: {
    name: 'resilient',
    displayName: 'Resilient',
    description: 'Foal has learned to recover quickly from stress with proper support.',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    influences: {
      traitWeightModifiers: {
        hardy: 0.3,
        fragile: -0.4,
        steady: 0.2,
      },
      behaviorModifiers: {
        stressRecovery: 0.2,
        healthBonus: 0.05,
      },
    },
    triggerConditions: {
      stressRecovery: {
        minEvents: 3,
        withGroomSupport: true,
        recoveryTime: 'fast',
      },
      moderateStress: {
        exposureCount: 3,
        managedRecovery: true,
      },
    },
  },

  // Negative Flags
  FEARFUL: {
    name: 'fearful',
    displayName: 'Fearful',
    description: 'Foal has developed heightened fear responses and anxiety.',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.NOVELTY,
    influences: {
      traitWeightModifiers: {
        spooky: 0.4,
        bold: -0.3,
        timid: 0.2,
      },
      behaviorModifiers: {
        stressVulnerability: 0.15,
        competitionPenalty: -0.05,
      },
    },
    triggerConditions: {
      fearEvents: {
        minCount: 2,
        noGroomSupport: true,
        highStressResponse: true,
      },
      lowBond: {
        threshold: 20,
        duration: 'persistent',
      },
    },
  },

  INSECURE: {
    name: 'insecure',
    displayName: 'Insecure',
    description: 'Foal lacks confidence and seeks constant reassurance.',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    influences: {
      traitWeightModifiers: {
        timid: 0.3,
        confident: -0.4,
        dependent: 0.2,
      },
      behaviorModifiers: {
        independenceReduction: -0.1,
        separationAnxiety: 0.2,
      },
    },
    triggerConditions: {
      neglect: {
        consecutiveDaysWithoutCare: 4,
        bondBelow: 25,
      },
      inconsistentCare: {
        irregularPattern: true,
        qualityVariation: 'high',
      },
    },
  },

  ALOOF: {
    name: 'aloof',
    displayName: 'Aloof',
    description: 'Foal has learned to be emotionally distant and self-reliant.',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    influences: {
      traitWeightModifiers: {
        independent: 0.3,
        friendly: -0.3,
        distant: 0.2,
      },
      behaviorModifiers: {
        bondingResistance: 0.15,
        socialReduction: -0.1,
      },
    },
    triggerConditions: {
      limitedInteraction: {
        lowFrequency: true,
        emotionalDistance: true,
      },
      selfReliance: {
        forcedIndependence: true,
        minimalSupport: true,
      },
    },
  },

  SKITTISH: {
    name: 'skittish',
    displayName: 'Skittish',
    description: 'Foal has developed hypervigilance and startle responses.',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    influences: {
      traitWeightModifiers: {
        nervous: 0.4,
        calm: -0.3,
        reactive: 0.2,
      },
      behaviorModifiers: {
        startleResponse: 0.2,
        environmentalSensitivity: 0.15,
      },
    },
    triggerConditions: {
      startleEvents: {
        minCount: 2,
        noGroomPresent: true,
        lowBondScore: true,
      },
      unpredictableEnvironment: {
        suddenChanges: true,
        lackOfRoutine: true,
      },
    },
  },

  FRAGILE: {
    name: 'fragile',
    displayName: 'Fragile',
    description: 'Foal has become emotionally and physically vulnerable to stress.',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    influences: {
      traitWeightModifiers: {
        delicate: 0.4,
        hardy: -0.4,
        sensitive: 0.3,
      },
      behaviorModifiers: {
        stressVulnerability: 0.25,
        healthPenalty: -0.1,
        recoveryDelay: 0.2,
      },
    },
    triggerConditions: {
      multipleStressSpikes: {
        minCount: 3,
        noSoothingFollowUp: true,
        poorRecovery: true,
      },
      inadequateSupport: {
        lackOfCareAfterStress: true,
        repeatedNeglect: true,
      },
    },
  },
};

/**
 * Get all flag definitions
 * @returns {Object} All flag definitions
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
  return EPIGENETIC_FLAG_DEFINITIONS[flagName.toUpperCase()] || null;
}

/**
 * Get flags by type
 * @param {string} type - Flag type (positive, negative, adaptive)
 * @returns {Array} Array of flag definitions
 */
export function getFlagsByType(type) {
  return Object.values(EPIGENETIC_FLAG_DEFINITIONS).filter(flag => flag.type === type);
}

/**
 * Get flags by source category
 * @param {string} category - Source category
 * @returns {Array} Array of flag definitions
 */
export function getFlagsBySourceCategory(category) {
  return Object.values(EPIGENETIC_FLAG_DEFINITIONS).filter(flag => flag.sourceCategory === category);
}

export default {
  FLAG_TYPES,
  SOURCE_CATEGORIES,
  MAX_FLAGS_PER_HORSE,
  FLAG_EVALUATION_AGE_RANGE,
  EPIGENETIC_FLAG_DEFINITIONS,
  getAllFlagDefinitions,
  getFlagDefinition,
  getFlagsByType,
  getFlagsBySourceCategory,
};
