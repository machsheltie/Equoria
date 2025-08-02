/**
 * Groom Personality-Based Trait Bonus System
 * Implements compatibility matrix between groom personalities and foal temperaments
 * 
 * This module defines and implements a system where Groom personality types interact 
 * with foal temperament to dynamically influence trait development outcomes, bonding 
 * success, and stress resistance. The system adds a new layer of compatibility logic 
 * to enhance grooming realism and personalize foal care outcomes.
 */

import logger from './logger.mjs';

/**
 * Groom Personality Types (from specification)
 * Each groom has a single personality drawn from this enum set
 */
export const GROOM_PERSONALITY_TYPES = {
  CALM: 'Calm',
  ENERGETIC: 'Energetic',
  SOFT_SPOKEN: 'Soft-Spoken',
  ASSERTIVE: 'Assertive',
  PLAYFUL: 'Playful',
  METHODICAL: 'Methodical',
  AFFECTIONATE: 'Affectionate',
  RESERVED: 'Reserved',
};

/**
 * Foal Temperament Types (from specification)
 * Stored in horses.temperament field
 */
export const FOAL_TEMPERAMENT_TYPES = {
  SPIRITED: 'Spirited',
  STEADY: 'Steady',
  REACTIVE: 'Reactive',
  STUBBORN: 'Stubborn',
  LAZY: 'Lazy',
  PLAYFUL: 'Playful',
  AGGRESSIVE: 'Aggressive',
};

/**
 * Compatibility Matrix (from specification)
 * This table governs how personality alignment influences bonding, stress, and trait development
 * 
 * Format: {
 *   groomPersonality: {
 *     idealMatches: [temperament1, temperament2],
 *     traitDevBonus: number,
 *     stressMod: number (percentage),
 *     bondModifier: number
 *   }
 * }
 */
export const PERSONALITY_TEMPERAMENT_COMPATIBILITY = {
  [GROOM_PERSONALITY_TYPES.CALM]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.REACTIVE, FOAL_TEMPERAMENT_TYPES.SPIRITED],
    traitDevBonus: 1,
    stressMod: -15, // -15% stress
    bondModifier: 10,
    description: 'Excels with reactive and spirited foals, providing calming influence',
  },
  
  [GROOM_PERSONALITY_TYPES.ENERGETIC]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.LAZY, FOAL_TEMPERAMENT_TYPES.PLAYFUL],
    traitDevBonus: 1,
    stressMod: -5, // -5% stress
    bondModifier: 5,
    description: 'Motivates lazy foals and matches energy with playful ones',
  },
  
  [GROOM_PERSONALITY_TYPES.SOFT_SPOKEN]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.AGGRESSIVE, FOAL_TEMPERAMENT_TYPES.SPIRITED],
    traitDevBonus: 0,
    stressMod: -10, // -10% stress
    bondModifier: 0,
    description: 'Gentle approach helps aggressive and spirited foals feel secure',
  },
  
  [GROOM_PERSONALITY_TYPES.ASSERTIVE]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.STUBBORN, FOAL_TEMPERAMENT_TYPES.AGGRESSIVE],
    traitDevBonus: 1,
    stressMod: 0, // No stress modification
    bondModifier: 5,
    description: 'Firm guidance works well with stubborn and aggressive personalities',
  },
  
  [GROOM_PERSONALITY_TYPES.PLAYFUL]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.PLAYFUL, FOAL_TEMPERAMENT_TYPES.LAZY],
    traitDevBonus: 1,
    stressMod: -10, // -10% stress
    bondModifier: 10,
    description: 'Creates engaging experiences for playful foals and motivates lazy ones',
  },
  
  [GROOM_PERSONALITY_TYPES.METHODICAL]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.REACTIVE, FOAL_TEMPERAMENT_TYPES.STUBBORN],
    traitDevBonus: 1,
    stressMod: -5, // -5% stress
    bondModifier: 5,
    description: 'Consistent approach helps reactive foals and manages stubborn behavior',
  },
  
  [GROOM_PERSONALITY_TYPES.AFFECTIONATE]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.STEADY, FOAL_TEMPERAMENT_TYPES.LAZY],
    traitDevBonus: 1,
    stressMod: -5, // -5% stress
    bondModifier: 10,
    description: 'Nurturing care suits steady foals and encourages lazy ones',
  },
  
  [GROOM_PERSONALITY_TYPES.RESERVED]: {
    idealMatches: [FOAL_TEMPERAMENT_TYPES.SPIRITED, FOAL_TEMPERAMENT_TYPES.REACTIVE],
    traitDevBonus: 0,
    stressMod: 5, // +5% stress (less effective)
    bondModifier: -5,
    description: 'Quiet approach may not provide enough engagement for most foals',
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
export function calculatePersonalityCompatibility(groomPersonality, foalTemperament, bondScore = 0) {
  try {
    const compatibility = PERSONALITY_TEMPERAMENT_COMPATIBILITY[groomPersonality];
    
    if (!compatibility) {
      logger.warn(`[groomPersonalityTraitBonus] Unknown groom personality: ${groomPersonality}`);
      return {
        isMatch: false,
        isStrongMatch: false,
        traitModifierScore: 0,
        stressResistanceBonus: 0,
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
    
    // Calculate stress resistance bonus (convert percentage to decimal)
    const stressResistanceBonus = compatibility.stressMod / 100;
    
    // Bond modifier from compatibility
    const bondModifier = compatibility.bondModifier;
    
    logger.info(
      `[groomPersonalityTraitBonus] Compatibility: ${groomPersonality} + ${foalTemperament} = ${isMatch ? 'MATCH' : 'MISMATCH'} (bond: ${bondScore})`
    );
    
    return {
      isMatch,
      isStrongMatch,
      traitModifierScore,
      stressResistanceBonus,
      bondModifier,
      description: compatibility.description,
      compatibility: compatibility,
    };
  } catch (error) {
    logger.error(`[groomPersonalityTraitBonus] Error calculating compatibility: ${error.message}`);
    return {
      isMatch: false,
      isStrongMatch: false,
      traitModifierScore: 0,
      stressResistanceBonus: 0,
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
  
  Object.entries(PERSONALITY_TEMPERAMENT_COMPATIBILITY).forEach(([personality, config]) => {
    if (config.idealMatches.includes(foalTemperament)) {
      compatibleGrooms.push({
        personality,
        traitDevBonus: config.traitDevBonus,
        stressMod: config.stressMod,
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
  const validPersonalities = Object.values(GROOM_PERSONALITY_TYPES);
  const validTemperaments = Object.values(FOAL_TEMPERAMENT_TYPES);
  
  return {
    isValidPersonality: validPersonalities.includes(personality),
    isValidTemperament: validTemperaments.includes(temperament),
    validPersonalities,
    validTemperaments,
  };
}

export default {
  GROOM_PERSONALITY_TYPES,
  FOAL_TEMPERAMENT_TYPES,
  PERSONALITY_TEMPERAMENT_COMPATIBILITY,
  calculatePersonalityCompatibility,
  getCompatibleGroomsForTemperament,
  validatePersonalityTemperament,
};
