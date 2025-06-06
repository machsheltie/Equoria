// DO NOT MODIFY: Configuration locked for consistency
/**
 * Task Influence Configuration for Epigenetic Traits
 * Maps foal tasks to epigenetic traits and defines trait point accumulation
 *
 * 🎯 PURPOSE:
 * Links task names to epigenetic traits and defines how many "trait points"
 * each successful repetition contributes to trait probability during foal development.
 *
 * 📋 BUSINESS RULES:
 * - Each foal task influences specific epigenetic traits
 * - Daily value determines trait points gained per successful task completion
 * - Trait points accumulate over time to influence trait expression probability
 * - Tasks are categorized by their developmental focus:
 *   * Enrichment tasks (0-2 years): Build foundational traits like confidence and bonding
 *   * Grooming tasks (1-3 years): Develop presentation and handling traits
 *
 * 🔧 INTEGRATION:
 * - Used by trait evaluation system to calculate epigenetic development
 * - Integrates with foal task logging to track trait point accumulation
 * - Supports daily task exclusivity enforcement
 * - Links to existing trait definitions for validation
 *
 * 💡 TRAIT CATEGORIES:
 * - Foundational: confident, bonded, resilient, calm
 * - Show/Presentation: show_calm, presentation_boosted, crowd_ready
 * - Development: These traits influence future behavior and performance
 */

/**
 * Task to Trait Influence Mapping
 *
 * Structure:
 * {
 *   taskName: {
 *     traits: [array of trait names influenced by this task],
 *     dailyValue: number of trait points gained per successful completion
 *   }
 * }
 */
export const TASK_TRAIT_INFLUENCE_MAP = {
  // ENRICHMENT TASKS (0-2 years) - Foundational trait development

  /**
   * Desensitization - Early exposure and confidence building
   * Helps foals become comfortable with new stimuli and environments
   */
  desensitization: {
    traits: ['confident'],
    dailyValue: 5,
  },

  /**
   * Trust Building - Foundational relationship and resilience development
   * Builds core bonding and emotional stability
   */
  trust_building: {
    traits: ['bonded', 'resilient'],
    dailyValue: 5,
  },

  /**
   * Showground Exposure - Crowd readiness and confidence in public settings
   * Prepares foals for competition and public environments
   */
  showground_exposure: {
    traits: ['crowd_ready', 'confident'],
    dailyValue: 5,
  },

  // GROOMING TASKS (1-3 years) - Handling and presentation development

  /**
   * Early Touch - Basic handling tolerance and calmness
   * Introduces gentle physical contact and handling
   */
  early_touch: {
    traits: ['calm'],
    dailyValue: 5,
  },

  /**
   * Hoof Handling - Show ring calmness and handling compliance
   * Critical for veterinary care and show presentation
   */
  hoof_handling: {
    traits: ['show_calm'],
    dailyValue: 5,
  },

  /**
   * Tying Practice - Restraint tolerance and show calmness
   * Essential for safe handling and show preparation
   */
  tying_practice: {
    traits: ['show_calm'],
    dailyValue: 5,
  },

  /**
   * Sponge Bath - Presentation skills and show calmness
   * Combines handling with appearance preparation
   */
  sponge_bath: {
    traits: ['show_calm', 'presentation_boosted'],
    dailyValue: 5,
  },

  /**
   * Coat Check - Visual inspection tolerance and presentation enhancement
   * Develops acceptance of detailed examination
   */
  coat_check: {
    traits: ['presentation_boosted'],
    dailyValue: 5,
  },

  /**
   * Mane and Tail Grooming - Presentation enhancement and handling tolerance
   * Advanced grooming for show preparation
   */
  mane_tail_grooming: {
    traits: ['presentation_boosted'],
    dailyValue: 5,
  },
};

/**
 * Get trait influence for a specific task
 * @param {string} taskName - Name of the task
 * @returns {Object|null} Influence object with traits and dailyValue, or null if not found
 */
export function getTaskInfluence(taskName) {
  return TASK_TRAIT_INFLUENCE_MAP[taskName] || null;
}

/**
 * Get all traits influenced by a specific task
 * @param {string} taskName - Name of the task
 * @returns {string[]} Array of trait names, or empty array if task not found
 */
export function getTraitsInfluencedByTask(taskName) {
  const influence = TASK_TRAIT_INFLUENCE_MAP[taskName];
  return influence ? [...influence.traits] : [];
}

/**
 * Get daily trait point value for a specific task
 * @param {string} taskName - Name of the task
 * @returns {number} Daily trait point value, or 0 if task not found
 */
export function getDailyTraitValue(taskName) {
  const influence = TASK_TRAIT_INFLUENCE_MAP[taskName];
  return influence ? influence.dailyValue : 0;
}

/**
 * Get all tasks that influence a specific trait
 * @param {string} traitName - Name of the trait
 * @returns {string[]} Array of task names that influence this trait
 */
export function getTasksInfluencingTrait(traitName) {
  const tasks = [];

  Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([taskName, influence]) => {
    if (influence.traits.includes(traitName)) {
      tasks.push(taskName);
    }
  });

  return tasks;
}

/**
 * Get all unique traits defined in the influence map
 * @returns {string[]} Array of all unique trait names
 */
export function getAllInfluencedTraits() {
  const traits = new Set();

  Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
    influence.traits.forEach(trait => traits.add(trait));
  });

  return Array.from(traits).sort();
}

/**
 * Calculate total trait points for multiple task completions
 * @param {Object} taskCompletions - Object with task names as keys and completion counts as values
 * @returns {Object} Object with trait names as keys and total points as values
 */
export function calculateTraitPoints(taskCompletions) {
  const traitPoints = {};

  Object.entries(taskCompletions).forEach(([taskName, completionCount]) => {
    const influence = TASK_TRAIT_INFLUENCE_MAP[taskName];
    if (influence && completionCount > 0) {
      const pointsPerCompletion = influence.dailyValue;
      const totalPoints = pointsPerCompletion * completionCount;

      influence.traits.forEach(trait => {
        traitPoints[trait] = (traitPoints[trait] || 0) + totalPoints;
      });
    }
  });

  return traitPoints;
}

/**
 * Validate task influence map structure
 * @returns {Object} Validation result with isValid boolean and any errors
 */
export function validateTaskInfluenceMap() {
  const errors = [];

  Object.entries(TASK_TRAIT_INFLUENCE_MAP).forEach(([taskName, influence]) => {
    // Check required properties
    if (!influence.traits || !Array.isArray(influence.traits)) {
      errors.push(`Task ${taskName}: traits must be an array`);
    }

    if (typeof influence.dailyValue !== 'number' || influence.dailyValue <= 0) {
      errors.push(`Task ${taskName}: dailyValue must be a positive number`);
    }

    // Check trait array
    if (influence.traits) {
      if (influence.traits.length === 0) {
        errors.push(`Task ${taskName}: must influence at least one trait`);
      }

      influence.traits.forEach((trait, index) => {
        if (typeof trait !== 'string' || trait.length === 0) {
          errors.push(`Task ${taskName}: trait at index ${index} must be a non-empty string`);
        }
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export default TASK_TRAIT_INFLUENCE_MAP;
