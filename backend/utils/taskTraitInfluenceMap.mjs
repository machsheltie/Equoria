/**
 * @fileoverview Task-Trait Influence Mapping System for Groom Interactions
 *
 * @description
 * Defines the relationship between groom tasks and trait development in horses.
 * This system determines which traits are encouraged or discouraged by specific
 * grooming activities, enabling dynamic trait development based on care patterns.
 *
 * @features
 * - Task-specific trait influence mappings (encourages/discourages)
 * - Trait permanence rules (+3/-3 threshold system)
 * - Epigenetic trait marking for early development (before age 3)
 * - Duplication prevention for existing traits
 * - Integration with groom interaction system
 *
 * @dependencies
 * - None (pure configuration data)
 *
 * @usage
 * Used by traitEvaluation.mjs to determine trait changes during groom interactions.
 * Imported by groom system for trait influence calculations and permanent trait assignment.
 *
 * @author Equoria Development Team
 * @since 1.2.0
 * @lastModified 2025-01-02 - Initial implementation of trait influence system
 */

/**
 * Task-Trait Influence Mapping
 *
 * Defines which traits are encouraged (+1) or discouraged (-1) by each grooming task.
 * Traits become permanent when they reach +3 or -3 influence points.
 * Traits applied before age 3 are marked as epigenetic: true.
 *
 * @type {Object.<string, {encourages: string[], discourages: string[]}>}
 */
export const TASK_TRAIT_INFLUENCE_MAP = {
  // General Grooming Tasks (3+ years)
  brushing: {
    encourages: ['bonded', 'patient'],
    discourages: ['aloof'],
  },
  hand_walking: {
    encourages: ['trusting', 'brave'],
    discourages: ['nervous'],
  },
  stall_care: {
    encourages: ['resilient', 'routine_oriented'],
    discourages: ['high_strung'],
  },

  // Enrichment Tasks (0-2 years)
  puddle_training: {
    encourages: ['brave', 'curious'],
    discourages: ['timid'],
  },
  tarp_desensitization: {
    encourages: ['bold', 'resilient'],
    discourages: ['fearful'],
  },
  obstacle_course: {
    encourages: ['curious', 'agile'],
    discourages: ['hesitant'],
  },
  socialization: {
    encourages: ['affectionate', 'friendly'],
    discourages: ['aloof'],
  },
  grooming_game: {
    encourages: ['playful', 'bonded'],
    discourages: ['independent'],
  },

  // Foal Grooming Tasks (1-3 years)
  early_touch: {
    encourages: ['calm', 'trusting'],
    discourages: ['nervous'],
  },
  hoof_handling: {
    encourages: ['patient', 'cooperative'],
    discourages: ['resistant'],
  },
  tying_practice: {
    encourages: ['patient', 'routine_oriented'],
    discourages: ['restless'],
  },
  sponge_bath: {
    encourages: ['calm', 'cooperative'],
    discourages: ['anxious'],
  },
  coat_check: {
    encourages: ['patient', 'bonded'],
    discourages: ['fidgety'],
  },
  mane_tail_grooming: {
    encourages: ['patient', 'trusting'],
    discourages: ['head_shy'],
  },

  // Trust Building Tasks (0-2 years)
  trust_building: {
    encourages: ['bonded', 'trusting'],
    discourages: ['fearful'],
  },
  desensitization: {
    encourages: ['brave', 'confident'],
    discourages: ['nervous'],
  },
  showground_exposure: {
    encourages: ['confident', 'adaptable'],
    discourages: ['anxious'],
  },
};

/**
 * Get trait influence for a specific task
 *
 * @param {string} taskType - The type of grooming task
 * @returns {Object|null} Influence object with encourages/discourages arrays, or null if task not found
 */
export function getTaskTraitInfluence(taskType) {
  return TASK_TRAIT_INFLUENCE_MAP[taskType] || null;
}

/**
 * Get all traits that can be influenced by any task
 *
 * @returns {string[]} Array of all unique trait names
 */
export function getAllInfluenceableTraits() {
  const traits = new Set();

  Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
    influence.encourages.forEach(trait => traits.add(trait));
    influence.discourages.forEach(trait => traits.add(trait));
  });

  return Array.from(traits).sort();
}

/**
 * Get all tasks that influence a specific trait
 *
 * @param {string} traitName - Name of the trait to search for
 * @returns {Object} Object with encouraging and discouraging task arrays
 */
export function getTasksInfluencingTrait(traitName) {
  const encouraging = [];
  const discouraging = [];

  Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([taskType, influence]) => {
    if (influence.encourages.includes(traitName)) {
      encouraging.push(taskType);
    }
    if (influence.discourages.includes(traitName)) {
      discouraging.push(taskType);
    }
  });

  return { encouraging, discouraging };
}

/**
 * Validate that all traits in the influence map are properly defined
 *
 * @returns {Object} Validation result with isValid boolean and any errors
 */
export function validateTraitInfluenceMap() {
  const errors = [];
  const allTraits = getAllInfluenceableTraits();

  // Check for empty trait arrays
  Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([taskType, influence]) => {
    if (!influence.encourages || influence.encourages.length === 0) {
      errors.push(`Task ${taskType} has no encouraging traits`);
    }
    if (!influence.discourages || influence.discourages.length === 0) {
      errors.push(`Task ${taskType} has no discouraging traits`);
    }

    // Check for trait name consistency
    [...influence.encourages, ...influence.discourages].forEach(trait => {
      if (typeof trait !== 'string' || trait.length === 0) {
        errors.push(`Invalid trait name in task ${taskType}: ${trait}`);
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    totalTraits: allTraits.length,
    totalTasks: Object.keys(TASK_TRAIT_INFLUENCE_MAP).length,
  };
}

/**
 * Configuration constants for trait influence system
 */
export const TRAIT_INFLUENCE_CONFIG = {
  // Threshold for trait permanence
  PERMANENCE_THRESHOLD: 3,
  NEGATIVE_PERMANENCE_THRESHOLD: -3,

  // Age threshold for epigenetic marking
  EPIGENETIC_AGE_THRESHOLD: 3 * 365, // 3 years in days

  // Influence values
  ENCOURAGE_VALUE: 1,
  DISCOURAGE_VALUE: -1,
};
