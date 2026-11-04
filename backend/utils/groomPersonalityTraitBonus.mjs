/**
 * Groom Personality-Based Trait Bonus System
 * Implements compatibility matrix between groom personalities and foal temperaments
 *
 * This module defines and implements a system where Groom personality types interact
 * with foal temperament to dynamically influence trait development outcomes, bonding
 * success. The system adds a new layer of compatibility logic
 * to enhance grooming realism and personalize foal care outcomes.
 */

import logger from './logger.mjs';

/**
 * Groom Personality Types (from specification)
 * Each groom has a single personality drawn from this enum set
 */
export const groomPersonalityTypes = {
  calm: 'Calm',
  energetic: 'Energetic',
  softSpoken: 'Soft-Spoken',
  assertive: 'Assertive',
  playful: 'Playful',
  methodical: 'Methodical',
  affectionate: 'Affectionate',
  reserved: 'Reserved',
};

/**
 * Foal Temperament Types (from specification + temperamentService canonical set)
 * Stored in horses.temperament field
 */
export const foalTemperamentTypes = {
  SPIRITED: 'Spirited',
  STEADY: 'Steady',
  REACTIVE: 'Reactive',
  STUBBORN: 'Stubborn',
  LAZY: 'Lazy',
  // Owner ruling 2026-10-21: the Playful temperament was renamed Driven, and
  // Willing was added. (The Playful GROOM personality above is unchanged.)
  DRIVEN: 'Driven',
  WILLING: 'Willing',
  AGGRESSIVE: 'Aggressive',
  // Additional types from temperamentService — must be covered to avoid universal mismatch penalty
  CALM: 'Calm',
  BOLD: 'Bold',
  NERVOUS: 'Nervous',
  INDEPENDENT: 'Independent',
};

/**
 * Compatibility Matrix (from specification)
 * This table governs how personality alignment influences bonding and trait development
 *
 * Format: {
 *   groomPersonality: {
 *     idealMatches: [temperament1, temperament2],
 *     traitDevBonus: number,
 *     bondModifier: number
 *   }
 * }
 */
export const personalityTemperamentCompatibility = {
  [groomPersonalityTypes.calm]: {
    idealMatches: [
      foalTemperamentTypes.REACTIVE,
      foalTemperamentTypes.SPIRITED,
      foalTemperamentTypes.NERVOUS, // Calm groom is ideal for anxious foals
    ],
    traitDevBonus: 1,
    bondModifier: 10,
    description: 'Excels with reactive, spirited, and nervous foals, providing calming influence',
  },

  [groomPersonalityTypes.energetic]: {
    idealMatches: [
      foalTemperamentTypes.LAZY,
      foalTemperamentTypes.DRIVEN,
      foalTemperamentTypes.BOLD, // Energetic groom matches bold foal's confidence
      foalTemperamentTypes.CALM, // Energetic groom can stimulate calm foals
    ],
    traitDevBonus: 1,
    bondModifier: 5,
    description: 'Motivates lazy foals, matches energy with driven and bold ones',
  },

  [groomPersonalityTypes.softSpoken]: {
    idealMatches: [
      foalTemperamentTypes.AGGRESSIVE,
      foalTemperamentTypes.SPIRITED,
      foalTemperamentTypes.NERVOUS, // Quiet approach reduces anxiety in nervous foals
      foalTemperamentTypes.WILLING, // A gentle hand suits a foal eager to please
    ],
    traitDevBonus: 0,
    bondModifier: 0,
    description:
      'Gentle approach helps aggressive, spirited, nervous, and willing foals feel secure',
  },

  [groomPersonalityTypes.assertive]: {
    idealMatches: [
      foalTemperamentTypes.STUBBORN,
      foalTemperamentTypes.AGGRESSIVE,
      foalTemperamentTypes.BOLD, // Assertive groom matches bold foal's self-confidence
    ],
    traitDevBonus: 1,
    bondModifier: 5,
    description: 'Firm guidance works well with stubborn, aggressive, and bold personalities',
  },

  [groomPersonalityTypes.playful]: {
    idealMatches: [foalTemperamentTypes.DRIVEN, foalTemperamentTypes.LAZY],
    traitDevBonus: 1,
    bondModifier: 10,
    description: 'Creates engaging experiences for driven foals and motivates lazy ones',
  },

  [groomPersonalityTypes.methodical]: {
    idealMatches: [
      foalTemperamentTypes.REACTIVE,
      foalTemperamentTypes.STUBBORN,
      foalTemperamentTypes.NERVOUS, // Routine reduces anxiety in nervous foals
      foalTemperamentTypes.INDEPENDENT, // Structure suits independent foals who need consistency
    ],
    traitDevBonus: 1,
    bondModifier: 5,
    description: 'Consistent approach helps reactive, stubborn, nervous, and independent foals',
  },

  [groomPersonalityTypes.affectionate]: {
    idealMatches: [
      foalTemperamentTypes.STEADY,
      foalTemperamentTypes.LAZY,
      foalTemperamentTypes.WILLING, // Praise and care suit a foal eager to please
    ],
    traitDevBonus: 1,
    bondModifier: 10,
    description: 'Nurturing care suits steady and willing foals and encourages lazy ones',
  },

  [groomPersonalityTypes.reserved]: {
    idealMatches: [
      foalTemperamentTypes.SPIRITED,
      foalTemperamentTypes.REACTIVE,
      foalTemperamentTypes.INDEPENDENT, // Reserved groom respects the independent foal's space
    ],
    traitDevBonus: 0,
    bondModifier: -5,
    description:
      'Quiet approach may not provide enough engagement for most foals, but respects independent ones',
  },
};

/**
 * Calculate personality compatibility effects between groom and foal
 *
 * @param {string} groomPersonality - Groom's personality type
 * @param {string} foalTemperament - Foal's temperament type
 * @param {number} bondScore - Current bond score between groom and foal
 * @returns {Object} Compatibility effects object
 */
export function calculatePersonalityCompatibility(
  groomPersonality,
  foalTemperament,
  bondScore = 0,
) {
  try {
    const compatibility = personalityTemperamentCompatibility[groomPersonality];

    if (!compatibility) {
      logger.warn(`[groomPersonalityTraitBonus] Unknown groom personality: ${groomPersonality}`);
      return {
        isMatch: false,
        isStrongMatch: false,
        traitModifierScore: 0,
        bondModifier: 0,
        description: 'Unknown personality type',
      };
    }

    const isMatch = compatibility.idealMatches.includes(foalTemperament);
    const isStrongMatch = isMatch && bondScore > 60;

    // Calculate trait modifier score based on specification rules
    let traitModifierScore = 0;
    if (isStrongMatch) {
      traitModifierScore = 2; // Strong match (ideal + high bond)
    } else if (isMatch) {
      traitModifierScore = compatibility.traitDevBonus; // Regular match
    } else {
      traitModifierScore = -1; // Mismatch penalty
    }

    // Bond modifier from compatibility
    const { bondModifier } = compatibility;

    logger.info(
      `[groomPersonalityTraitBonus] Compatibility: ${groomPersonality} + ${foalTemperament} = ${isMatch ? 'MATCH' : 'MISMATCH'} (bond: ${bondScore})`,
    );

    return {
      isMatch,
      isStrongMatch,
      traitModifierScore,
      bondModifier,
      description: compatibility.description,
      compatibility,
    };
  } catch (error) {
    logger.error(`[groomPersonalityTraitBonus] Error calculating compatibility: ${error.message}`);
    return {
      isMatch: false,
      isStrongMatch: false,
      traitModifierScore: 0,
      bondModifier: 0,
      description: 'Error calculating compatibility',
    };
  }
}

/**
 * Get all compatible grooms for a specific foal temperament
 *
 * @param {string} foalTemperament - Foal's temperament type
 * @returns {Array} Array of compatible groom personalities with their effects
 */
export function getCompatibleGroomsForTemperament(foalTemperament) {
  const compatibleGrooms = [];

  Object.entries(personalityTemperamentCompatibility).forEach(([personality, config]) => {
    if (config.idealMatches.includes(foalTemperament)) {
      compatibleGrooms.push({
        personality,
        traitDevBonus: config.traitDevBonus,
        bondModifier: config.bondModifier,
        description: config.description,
      });
    }
  });

  return compatibleGrooms;
}

/**
 * Validate personality and temperament types
 *
 * @param {string} personality - Groom personality to validate
 * @param {string} temperament - Foal temperament to validate
 * @returns {Object} Validation result
 */
export function validatePersonalityTemperament(personality, temperament) {
  const validPersonalities = Object.values(groomPersonalityTypes);
  const validTemperaments = Object.values(foalTemperamentTypes);

  return {
    isValidPersonality: validPersonalities.includes(personality),
    isValidTemperament: validTemperaments.includes(temperament),
    validPersonalities,
    validTemperaments,
  };
}

export default {
  groomPersonalityTypes,
  foalTemperamentTypes,
  personalityTemperamentCompatibility,
  calculatePersonalityCompatibility,
  getCompatibleGroomsForTemperament,
  validatePersonalityTemperament,
};
