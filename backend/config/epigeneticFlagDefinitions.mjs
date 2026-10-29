/**
 * Epigenetic Flag Definitions
 *
 * The names, authored labels, polarity and conflicts of the stored epigenetic
 * flags (Horse.epigeneticFlags).
 *
 * Equoria-cmakh: the per-flag `triggerConditions` (care consistency, task
 * diversity, bond trend...) were removed. The evaluator that once had its own
 * hard-coded copy of those rules was deleted (Equoria-1vep2), and owner rulings
 * 2026-10-27 (q112-q118) make the grooming-day reveal ladder
 * (modules/traits/services/traitRevealEngine.mjs) the only thing that changes a
 * horse's traits, so care-pattern trigger rules described nothing that runs.
 *
 * Equoria-v6sp2 / Equoria-rqz1z: the per-flag `influences` (trait-weight and
 * competition/training/bonding/health modifiers) were removed. No live gameplay
 * code read them, so they only advertised effects the game never applied, and
 * the owner has not yet ruled what any trait does (2026-10-27, q117: "Do not
 * add what each actually does yet"). Add an effect here only with her ruling
 * and a live consumer.
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
    conflictsWith: ['fearful', 'anxious'],
  },

  CONFIDENT: {
    name: 'confident',
    displayName: 'Confident',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse displays self-assurance and composure',
    conflictsWith: ['insecure', 'fearful'],
  },

  AFFECTIONATE: {
    name: 'affectionate',
    displayName: 'Affectionate',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse forms strong bonds with handlers and shows trust',
    conflictsWith: ['antisocial', 'withdrawn'],
  },

  RESILIENT: {
    name: 'resilient',
    displayName: 'Resilient',
    type: FLAG_TYPES.POSITIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    description: 'Horse adapts well to challenges',
    conflictsWith: ['fragile', 'sensitive'],
  },

  // NEGATIVE FLAGS (5)
  FEARFUL: {
    name: 'fearful',
    displayName: 'Fearful',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.NOVELTY,
    description: 'Horse shows excessive fear and anxiety in new situations',
    conflictsWith: ['brave', 'confident'],
  },

  INSECURE: {
    name: 'insecure',
    displayName: 'Insecure',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse lacks confidence and seeks constant reassurance',
    conflictsWith: ['confident', 'brave'],
  },

  ALOOF: {
    name: 'aloof',
    displayName: 'Aloof',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.BONDING,
    description: 'Horse maintains emotional distance and resists bonding',
    conflictsWith: ['affectionate', 'social'],
  },

  SKITTISH: {
    name: 'skittish',
    displayName: 'Skittish',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    description: 'Horse is easily startled and overreacts to environmental stimuli',
    conflictsWith: ['calm', 'steady'],
  },

  FRAGILE: {
    name: 'fragile',
    displayName: 'Fragile',
    type: FLAG_TYPES.NEGATIVE,
    sourceCategory: SOURCE_CATEGORIES.ENVIRONMENT,
    description: 'Horse is emotionally sensitive and easily overwhelmed',
    conflictsWith: ['resilient', 'hardy'],
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
  return Object.values(EPIGENETIC_FLAG_DEFINITIONS).filter(flag => flag.type === type);
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
