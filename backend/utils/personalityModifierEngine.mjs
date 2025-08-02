/**
 * Personality Modifier Engine
 * Core logic engine for applying groom personality-temperament compatibility effects
 * 
 * This module implements the personality modifier engine that calculates trait_modifier_score,
 * stress_resistance_bonus, and bond_modifier based on groom-foal personality compatibility.
 * Integrates with the milestone evaluation system to apply personality effects during 
 * trait development calculations.
 */

import { calculatePersonalityCompatibility } from './groomPersonalityTraitBonus.mjs';
import logger from './logger.mjs';

/**
 * Apply personality compatibility effects to milestone evaluation
 * 
 * @param {Object} params - Parameters for personality effect calculation
 * @param {string} params.groomPersonality - Groom's personality type
 * @param {string} params.foalTemperament - Foal's temperament type
 * @param {number} params.bondScore - Current bond score between groom and foal
 * @param {number} params.baseMilestoneScore - Base milestone score before personality effects
 * @param {number} params.baseStressLevel - Base stress level before personality effects
 * @param {number} params.baseBondingRate - Base bonding rate before personality effects
 * @returns {Object} Modified scores with personality effects applied
 */
export function applyPersonalityEffectsToMilestone(params) {
  try {
    const {
      groomPersonality,
      foalTemperament,
      bondScore = 0,
      baseMilestoneScore = 0,
      baseStressLevel = 0,
      baseBondingRate = 0,
    } = params;

    // Check if we have valid personality and temperament
    if (!groomPersonality || !foalTemperament) {
      return {
        baseMilestoneScore,
        baseStressLevel,
        baseBondingRate,
        modifiedMilestoneScore: baseMilestoneScore,
        modifiedStressLevel: baseStressLevel,
        modifiedBondingRate: baseBondingRate,
        personalityCompatibility: null,
        personalityMatchScore: 0,
        personalityEffectApplied: false,
        effects: {
          milestoneScoreChange: 0,
          stressReduction: 0,
          bondingRateChange: 0,
          isMatch: false,
          isStrongMatch: false,
        },
      };
    }

    // Calculate personality compatibility
    const compatibility = calculatePersonalityCompatibility(
      groomPersonality,
      foalTemperament,
      bondScore
    );

    // Apply trait modifier score to milestone score
    const modifiedMilestoneScore = baseMilestoneScore + compatibility.traitModifierScore;

    // Apply stress resistance bonus (reduce stress by percentage)
    const stressReduction = baseStressLevel * Math.abs(compatibility.stressResistanceBonus);
    const modifiedStressLevel = Math.max(0, baseStressLevel - stressReduction);

    // Apply bond modifier to bonding rate
    const modifiedBondingRate = baseBondingRate + compatibility.bondModifier;

    const result = {
      // Original values
      baseMilestoneScore,
      baseStressLevel,
      baseBondingRate,

      // Modified values
      modifiedMilestoneScore,
      modifiedStressLevel,
      modifiedBondingRate,

      // Personality effect details
      personalityCompatibility: compatibility,
      personalityMatchScore: compatibility.traitModifierScore,
      personalityEffectApplied: true,
      
      // Effect summary
      effects: {
        milestoneScoreChange: compatibility.traitModifierScore,
        stressReduction: stressReduction,
        bondingRateChange: compatibility.bondModifier,
        isMatch: compatibility.isMatch,
        isStrongMatch: compatibility.isStrongMatch,
      },
    };

    logger.info(
      `[personalityModifierEngine] Applied personality effects: ${groomPersonality} + ${foalTemperament} = ${compatibility.traitModifierScore} trait modifier, ${stressReduction.toFixed(1)} stress reduction, ${compatibility.bondModifier} bonding bonus`
    );

    return result;
  } catch (error) {
    logger.error(`[personalityModifierEngine] Error applying personality effects: ${error.message}`);
    
    // Return original values with no modifications on error
    return {
      baseMilestoneScore: params.baseMilestoneScore || 0,
      baseStressLevel: params.baseStressLevel || 0,
      baseBondingRate: params.baseBondingRate || 0,
      modifiedMilestoneScore: params.baseMilestoneScore || 0,
      modifiedStressLevel: params.baseStressLevel || 0,
      modifiedBondingRate: params.baseBondingRate || 0,
      personalityCompatibility: null,
      personalityMatchScore: 0,
      personalityEffectApplied: false,
      effects: {
        milestoneScoreChange: 0,
        stressReduction: 0,
        bondingRateChange: 0,
        isMatch: false,
        isStrongMatch: false,
      },
    };
  }
}

/**
 * Calculate personality bonus for trait development
 * Implements the specification rules for trait development effects
 * 
 * @param {Object} params - Parameters for trait development calculation
 * @param {string} params.groomPersonality - Groom's personality type
 * @param {string} params.foalTemperament - Foal's temperament type
 * @param {number} params.bondScore - Current bond score between groom and foal
 * @param {number} params.baseMilestoneScore - Base milestone score
 * @returns {Object} Trait development effects
 */
export function calculateTraitDevelopmentBonus(params) {
  try {
    const { groomPersonality, foalTemperament, bondScore = 0, baseMilestoneScore = 0 } = params;

    const compatibility = calculatePersonalityCompatibility(
      groomPersonality,
      foalTemperament,
      bondScore
    );

    let traitModifier = 0;
    let finalTraitAssignment = null;
    let reasoning = '';

    // Apply specification rules for trait development
    if (compatibility.isStrongMatch) {
      // Strong match (ideal + high bond) → Apply +2
      traitModifier = 2;
      reasoning = `Strong personality match (${groomPersonality} + ${foalTemperament}) with high bond (${bondScore})`;
    } else if (compatibility.isMatch) {
      // Match → Apply +1
      traitModifier = 1;
      reasoning = `Personality match (${groomPersonality} + ${foalTemperament})`;
    } else {
      // Mismatch → Apply -1 or stress penalty
      traitModifier = -1;
      reasoning = `Personality mismatch (${groomPersonality} + ${foalTemperament})`;
    }

    const finalScore = baseMilestoneScore + traitModifier;

    // Determine trait assignment based on final score (specification rules)
    if (finalScore >= 3) {
      finalTraitAssignment = 'positive';
      reasoning += ' - Score ≥3: Positive trait confirmed';
    } else if (finalScore <= -3) {
      finalTraitAssignment = 'negative';
      reasoning += ' - Score ≤-3: Negative trait confirmed';
    } else {
      finalTraitAssignment = 'randomized';
      reasoning += ' - Score between -2 and 2: Randomized trait assignment';
    }

    return {
      traitModifier,
      finalScore,
      finalTraitAssignment,
      reasoning,
      personalityCompatibility: compatibility,
      personalityMatchScore: traitModifier,
      personalityEffectApplied: true,
    };
  } catch (error) {
    logger.error(`[personalityModifierEngine] Error calculating trait development bonus: ${error.message}`);
    
    return {
      traitModifier: 0,
      finalScore: params.baseMilestoneScore || 0,
      finalTraitAssignment: 'randomized',
      reasoning: 'Error calculating personality effects',
      personalityCompatibility: null,
      personalityMatchScore: 0,
      personalityEffectApplied: false,
    };
  }
}

/**
 * Get personality effect preview for UI display
 * 
 * @param {string} groomPersonality - Groom's personality type
 * @param {string} foalTemperament - Foal's temperament type
 * @param {number} bondScore - Current bond score
 * @returns {Object} Preview of personality effects
 */
export function getPersonalityEffectPreview(groomPersonality, foalTemperament, bondScore = 0) {
  try {
    const compatibility = calculatePersonalityCompatibility(
      groomPersonality,
      foalTemperament,
      bondScore
    );

    return {
      isCompatible: compatibility.isMatch,
      compatibilityLevel: compatibility.isStrongMatch ? 'strong' : compatibility.isMatch ? 'good' : 'poor',
      traitBonus: compatibility.traitModifierScore,
      stressReduction: Math.abs(compatibility.stressResistanceBonus * 100), // Convert to percentage
      bondingBonus: compatibility.bondModifier,
      description: compatibility.description,
      recommendation: compatibility.isMatch 
        ? 'This groom is well-suited for this foal\'s temperament'
        : 'This groom may not be the best match for this foal\'s temperament',
    };
  } catch (error) {
    logger.error(`[personalityModifierEngine] Error getting personality effect preview: ${error.message}`);
    
    return {
      isCompatible: false,
      compatibilityLevel: 'unknown',
      traitBonus: 0,
      stressReduction: 0,
      bondingBonus: 0,
      description: 'Unable to calculate compatibility',
      recommendation: 'Compatibility could not be determined',
    };
  }
}

export default {
  applyPersonalityEffectsToMilestone,
  calculateTraitDevelopmentBonus,
  getPersonalityEffectPreview,
};
