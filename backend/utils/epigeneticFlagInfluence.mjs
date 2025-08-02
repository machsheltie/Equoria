/**
 * Epigenetic Flag Influence System
 * Integrates epigenetic flags with trait generation and competition behavior
 * 
 * 🎯 PURPOSE:
 * Applies epigenetic flag influences to trait weight modifiers and behavior
 * modifiers, integrating with the existing trait discovery and competition systems.
 * 
 * 📋 BUSINESS RULES:
 * - Flag influences are applied as weight modifiers to trait generation
 * - Behavior modifiers affect competition performance and training efficiency
 * - Multiple flags can stack their influences
 * - Influences are permanent once flags are assigned
 */

import logger from './logger.mjs';
import { getFlagDefinition } from '../config/epigeneticFlagDefinitions.mjs';

/**
 * Apply epigenetic flag influences to trait weights
 * @param {Array} epigeneticFlags - Array of flag names
 * @param {Object} baseTraitWeights - Base trait weights object
 * @returns {Object} Modified trait weights with flag influences applied
 */
export function applyFlagInfluencesToTraitWeights(epigeneticFlags, baseTraitWeights) {
  if (!epigeneticFlags || epigeneticFlags.length === 0) {
    return baseTraitWeights;
  }

  const modifiedWeights = { ...baseTraitWeights };
  
  try {
    epigeneticFlags.forEach(flagName => {
      const flagDefinition = getFlagDefinition(flagName);
      
      if (!flagDefinition) {
        logger.warn(`[epigeneticFlagInfluence] Unknown flag: ${flagName}`);
        return;
      }

      const traitModifiers = flagDefinition.influences.traitWeightModifiers;
      
      // Apply each trait weight modifier
      Object.entries(traitModifiers).forEach(([traitName, modifier]) => {
        if (modifiedWeights[traitName] !== undefined) {
          const originalWeight = modifiedWeights[traitName];
          const newWeight = Math.max(0, Math.min(1, originalWeight + modifier));
          modifiedWeights[traitName] = newWeight;
          
          logger.debug(`[epigeneticFlagInfluence] Flag '${flagName}' modified trait '${traitName}': ${originalWeight} -> ${newWeight} (${modifier > 0 ? '+' : ''}${modifier})`);
        }
      });
    });

    logger.info(`[epigeneticFlagInfluence] Applied influences from ${epigeneticFlags.length} flags to trait weights`);
    return modifiedWeights;

  } catch (error) {
    logger.error(`[epigeneticFlagInfluence] Error applying flag influences: ${error.message}`);
    return baseTraitWeights;
  }
}

/**
 * Calculate behavior modifiers from epigenetic flags
 * @param {Array} epigeneticFlags - Array of flag names
 * @returns {Object} Aggregated behavior modifiers
 */
export function calculateBehaviorModifiers(epigeneticFlags) {
  if (!epigeneticFlags || epigeneticFlags.length === 0) {
    return {};
  }

  const aggregatedModifiers = {};
  
  try {
    epigeneticFlags.forEach(flagName => {
      const flagDefinition = getFlagDefinition(flagName);
      
      if (!flagDefinition) {
        logger.warn(`[epigeneticFlagInfluence] Unknown flag: ${flagName}`);
        return;
      }

      const behaviorModifiers = flagDefinition.influences.behaviorModifiers;
      
      // Aggregate behavior modifiers
      Object.entries(behaviorModifiers).forEach(([modifierName, value]) => {
        if (aggregatedModifiers[modifierName] === undefined) {
          aggregatedModifiers[modifierName] = 0;
        }
        aggregatedModifiers[modifierName] += value;
      });
    });

    logger.info(`[epigeneticFlagInfluence] Calculated behavior modifiers from ${epigeneticFlags.length} flags`);
    return aggregatedModifiers;

  } catch (error) {
    logger.error(`[epigeneticFlagInfluence] Error calculating behavior modifiers: ${error.message}`);
    return {};
  }
}

/**
 * Apply epigenetic flag influences to competition performance
 * @param {number} baseScore - Base competition score
 * @param {Array} epigeneticFlags - Array of flag names
 * @param {string} discipline - Competition discipline
 * @returns {Object} Modified score and applied modifiers
 */
export function applyFlagInfluencesToCompetition(baseScore, epigeneticFlags, discipline) {
  if (!epigeneticFlags || epigeneticFlags.length === 0) {
    return {
      modifiedScore: baseScore,
      appliedModifiers: {},
      totalModifier: 0
    };
  }

  const behaviorModifiers = calculateBehaviorModifiers(epigeneticFlags);
  let totalModifier = 0;
  const appliedModifiers = {};

  try {
    // Apply competition-specific modifiers
    if (behaviorModifiers.competitionBonus) {
      const bonus = baseScore * behaviorModifiers.competitionBonus;
      totalModifier += bonus;
      appliedModifiers.competitionBonus = bonus;
    }

    if (behaviorModifiers.competitionPenalty) {
      const penalty = baseScore * behaviorModifiers.competitionPenalty;
      totalModifier += penalty; // Penalty is already negative
      appliedModifiers.competitionPenalty = penalty;
    }

    // Apply stress-related modifiers
    if (behaviorModifiers.stressVulnerability) {
      const stressPenalty = baseScore * (-behaviorModifiers.stressVulnerability * 0.5); // Reduce impact
      totalModifier += stressPenalty;
      appliedModifiers.stressVulnerability = stressPenalty;
    }

    if (behaviorModifiers.stressResistance) {
      const stressBonus = baseScore * (behaviorModifiers.stressResistance * 0.3); // Moderate impact
      totalModifier += stressBonus;
      appliedModifiers.stressResistance = stressBonus;
    }

    const modifiedScore = Math.max(0, baseScore + totalModifier);

    logger.debug(`[epigeneticFlagInfluence] Competition score modified: ${baseScore} -> ${modifiedScore} (${totalModifier > 0 ? '+' : ''}${totalModifier.toFixed(1)})`);

    return {
      modifiedScore,
      appliedModifiers,
      totalModifier
    };

  } catch (error) {
    logger.error(`[epigeneticFlagInfluence] Error applying competition influences: ${error.message}`);
    return {
      modifiedScore: baseScore,
      appliedModifiers: {},
      totalModifier: 0
    };
  }
}

/**
 * Apply epigenetic flag influences to training efficiency
 * @param {number} baseEfficiency - Base training efficiency (0-1)
 * @param {Array} epigeneticFlags - Array of flag names
 * @returns {Object} Modified efficiency and applied modifiers
 */
export function applyFlagInfluencesToTraining(baseEfficiency, epigeneticFlags) {
  if (!epigeneticFlags || epigeneticFlags.length === 0) {
    return {
      modifiedEfficiency: baseEfficiency,
      appliedModifiers: {},
      totalModifier: 0
    };
  }

  const behaviorModifiers = calculateBehaviorModifiers(epigeneticFlags);
  let totalModifier = 0;
  const appliedModifiers = {};

  try {
    // Apply training-specific modifiers
    if (behaviorModifiers.trainingEfficiency) {
      totalModifier += behaviorModifiers.trainingEfficiency;
      appliedModifiers.trainingEfficiency = behaviorModifiers.trainingEfficiency;
    }

    // Apply bonding-related modifiers that affect training
    if (behaviorModifiers.bondingRate) {
      const bondingBonus = behaviorModifiers.bondingRate * 0.5; // Moderate impact on training
      totalModifier += bondingBonus;
      appliedModifiers.bondingBonus = bondingBonus;
    }

    if (behaviorModifiers.bondingResistance) {
      const bondingPenalty = -behaviorModifiers.bondingResistance * 0.3; // Reduced impact
      totalModifier += bondingPenalty;
      appliedModifiers.bondingPenalty = bondingPenalty;
    }

    const modifiedEfficiency = Math.max(0, Math.min(1, baseEfficiency + totalModifier));

    logger.debug(`[epigeneticFlagInfluence] Training efficiency modified: ${baseEfficiency} -> ${modifiedEfficiency} (${totalModifier > 0 ? '+' : ''}${totalModifier.toFixed(3)})`);

    return {
      modifiedEfficiency,
      appliedModifiers,
      totalModifier
    };

  } catch (error) {
    logger.error(`[epigeneticFlagInfluence] Error applying training influences: ${error.message}`);
    return {
      modifiedEfficiency: baseEfficiency,
      appliedModifiers: {},
      totalModifier: 0
    };
  }
}

/**
 * Apply epigenetic flag influences to bonding interactions
 * @param {number} baseBondingChange - Base bonding change amount
 * @param {Array} epigeneticFlags - Array of flag names
 * @returns {Object} Modified bonding change and applied modifiers
 */
export function applyFlagInfluencesToBonding(baseBondingChange, epigeneticFlags) {
  if (!epigeneticFlags || epigeneticFlags.length === 0) {
    return {
      modifiedBondingChange: baseBondingChange,
      appliedModifiers: {},
      totalModifier: 0
    };
  }

  const behaviorModifiers = calculateBehaviorModifiers(epigeneticFlags);
  let totalModifier = 0;
  const appliedModifiers = {};

  try {
    // Apply bonding-specific modifiers
    if (behaviorModifiers.bondingRate) {
      const rateModifier = baseBondingChange * behaviorModifiers.bondingRate;
      totalModifier += rateModifier;
      appliedModifiers.bondingRate = rateModifier;
    }

    if (behaviorModifiers.bondingResistance) {
      const resistanceModifier = baseBondingChange * (-behaviorModifiers.bondingResistance);
      totalModifier += resistanceModifier;
      appliedModifiers.bondingResistance = resistanceModifier;
    }

    if (behaviorModifiers.groomEffectiveness) {
      const groomModifier = baseBondingChange * behaviorModifiers.groomEffectiveness;
      totalModifier += groomModifier;
      appliedModifiers.groomEffectiveness = groomModifier;
    }

    const modifiedBondingChange = baseBondingChange + totalModifier;

    logger.debug(`[epigeneticFlagInfluence] Bonding change modified: ${baseBondingChange} -> ${modifiedBondingChange} (${totalModifier > 0 ? '+' : ''}${totalModifier.toFixed(1)})`);

    return {
      modifiedBondingChange,
      appliedModifiers,
      totalModifier
    };

  } catch (error) {
    logger.error(`[epigeneticFlagInfluence] Error applying bonding influences: ${error.message}`);
    return {
      modifiedBondingChange: baseBondingChange,
      appliedModifiers: {},
      totalModifier: 0
    };
  }
}

/**
 * Get summary of all flag influences for a horse
 * @param {Array} epigeneticFlags - Array of flag names
 * @returns {Object} Complete summary of flag influences
 */
export function getFlagInfluenceSummary(epigeneticFlags) {
  if (!epigeneticFlags || epigeneticFlags.length === 0) {
    return {
      flagCount: 0,
      flags: [],
      traitInfluences: {},
      behaviorModifiers: {},
      summary: 'No epigenetic flags assigned'
    };
  }

  try {
    const flagDetails = epigeneticFlags.map(flagName => {
      const definition = getFlagDefinition(flagName);
      return definition ? {
        name: definition.name,
        displayName: definition.displayName,
        type: definition.type,
        sourceCategory: definition.sourceCategory,
        traitInfluences: definition.influences.traitWeightModifiers,
        behaviorModifiers: definition.influences.behaviorModifiers
      } : {
        name: flagName,
        displayName: flagName,
        type: 'unknown',
        sourceCategory: 'unknown',
        traitInfluences: {},
        behaviorModifiers: {}
      };
    });

    const behaviorModifiers = calculateBehaviorModifiers(epigeneticFlags);
    
    // Aggregate trait influences
    const traitInfluences = {};
    flagDetails.forEach(flag => {
      Object.entries(flag.traitInfluences).forEach(([trait, modifier]) => {
        if (!traitInfluences[trait]) {
          traitInfluences[trait] = 0;
        }
        traitInfluences[trait] += modifier;
      });
    });

    const positiveFlags = flagDetails.filter(f => f.type === 'positive').length;
    const negativeFlags = flagDetails.filter(f => f.type === 'negative').length;
    
    const summary = `${epigeneticFlags.length} flags (${positiveFlags} positive, ${negativeFlags} negative)`;

    return {
      flagCount: epigeneticFlags.length,
      flags: flagDetails,
      traitInfluences,
      behaviorModifiers,
      summary
    };

  } catch (error) {
    logger.error(`[epigeneticFlagInfluence] Error generating flag summary: ${error.message}`);
    return {
      flagCount: epigeneticFlags.length,
      flags: [],
      traitInfluences: {},
      behaviorModifiers: {},
      summary: 'Error generating summary'
    };
  }
}

export default {
  applyFlagInfluencesToTraitWeights,
  calculateBehaviorModifiers,
  applyFlagInfluencesToCompetition,
  applyFlagInfluencesToTraining,
  applyFlagInfluencesToBonding,
  getFlagInfluenceSummary
};
