/**
 * Ultra-Rare & Exotic Trait Mechanical Effects Integration
 * Integrates ultra-rare and exotic trait effects with existing game systems
 * Provides modifiers for stress, training, competition, and other mechanics
 */

import logger from './logger.mjs';
import { getUltraRareTraitDefinition } from './ultraRareTraits.mjs';

/**
 * Apply ultra-rare trait effects to stress calculations
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {number} baseStress - Base stress amount
 * @param {string} stressSource - Source of stress (training, competition, etc.)
 * @returns {Object} Modified stress and applied effects
 */
export function applyUltraRareStressEffects(horse, baseStress, stressSource = 'general') {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    let modifiedStress = baseStress;
    const appliedEffects = [];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      // Apply stress resistance
      if (effects.stressResistance) {
        const reduction = baseStress * effects.stressResistance;
        modifiedStress -= reduction;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'stress_resistance',
          value: effects.stressResistance,
          reduction,
        });
      }

      // Apply competition stress resistance
      if (effects.competitionStressResistance && stressSource === 'competition') {
        const reduction = baseStress * effects.competitionStressResistance;
        modifiedStress -= reduction;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'competition_stress_resistance',
          value: effects.competitionStressResistance,
          reduction,
        });
      }

      // Apply stress immunity (Ghostwalker)
      if (effects.stressImmunity) {
        modifiedStress = 0;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'stress_immunity',
          value: true,
          reduction: baseStress,
        });
        break; // Immunity overrides all other effects
      }

      // Apply stress gain multiplier (Stormtouched)
      if (effects.stressGainMultiplier) {
        const increase = baseStress * (effects.stressGainMultiplier - 1);
        modifiedStress += increase;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'stress_gain_multiplier',
          value: effects.stressGainMultiplier,
          increase,
        });
      }
    }

    // Ensure stress doesn't go below 0
    modifiedStress = Math.max(0, modifiedStress);

    return {
      originalStress: baseStress,
      modifiedStress,
      appliedEffects,
      totalReduction: baseStress - modifiedStress,
    };
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error applying stress effects: ${error.message}`);
    return {
      originalStress: baseStress,
      modifiedStress: baseStress,
      appliedEffects: [],
      totalReduction: 0,
    };
  }
}

/**
 * Apply ultra-rare trait effects to stress decay calculations
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {number} baseDecay - Base stress decay amount
 * @returns {Object} Modified decay and applied effects
 */
export function applyUltraRareStressDecayEffects(horse, baseDecay) {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    let modifiedDecay = baseDecay;
    const appliedEffects = [];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      // Apply stress decay multiplier (Phoenix-Born)
      if (effects.stressDecayMultiplier) {
        const bonus = baseDecay * (effects.stressDecayMultiplier - 1);
        modifiedDecay += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'stress_decay_multiplier',
          value: effects.stressDecayMultiplier,
          bonus,
        });
      }
    }

    return {
      originalDecay: baseDecay,
      modifiedDecay,
      appliedEffects,
      totalBonus: modifiedDecay - baseDecay,
    };
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error applying stress decay effects: ${error.message}`);
    return {
      originalDecay: baseDecay,
      modifiedDecay: baseDecay,
      appliedEffects: [],
      totalBonus: 0,
    };
  }
}

/**
 * Apply ultra-rare trait effects to training calculations
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {Object} trainingData - Training session data
 * @returns {Object} Modified training effects
 */
export function applyUltraRareTrainingEffects(horse, trainingData) {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    const modifiedTrainingData = { ...trainingData };
    const appliedEffects = [];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      // Apply training fatigue immunity (Iron-Willed)
      if (effects.trainingFatigueImmunity) {
        modifiedTrainingData.fatigueImmune = true;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'training_fatigue_immunity',
          value: true,
        });
      }

      // Apply training consistency bonus (Iron-Willed)
      if (effects.trainingConsistencyBonus) {
        const consistencyBonus = effects.trainingConsistencyBonus;
        modifiedTrainingData.consistencyBonus = (modifiedTrainingData.consistencyBonus || 0) + consistencyBonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'training_consistency_bonus',
          value: consistencyBonus,
        });
      }

      // Apply stat growth bonus (Stormtouched)
      if (effects.statGrowthBonus) {
        const growthBonus = effects.statGrowthBonus;
        modifiedTrainingData.statGrowthBonus = (modifiedTrainingData.statGrowthBonus || 0) + growthBonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'stat_growth_bonus',
          value: growthBonus,
        });
      }

      // Apply group training bonus (Born Leader)
      if (effects.groupTrainingBonus && trainingData.isGroupTraining) {
        const groupBonus = effects.groupTrainingBonus;
        modifiedTrainingData.groupBonus = (modifiedTrainingData.groupBonus || 0) + groupBonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'group_training_bonus',
          value: groupBonus,
        });
      }

      // Apply double training bonus for twins (Dreamtwin)
      if (effects.doubleTraining && trainingData.withTwin) {
        const twinBonus = effects.doubleTraining;
        modifiedTrainingData.twinBonus = (modifiedTrainingData.twinBonus || 0) + twinBonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'twin_training_bonus',
          value: twinBonus,
        });
      }
    }

    return {
      originalTrainingData: trainingData,
      modifiedTrainingData,
      appliedEffects,
    };
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error applying training effects: ${error.message}`);
    return {
      originalTrainingData: trainingData,
      modifiedTrainingData: trainingData,
      appliedEffects: [],
    };
  }
}

/**
 * Apply ultra-rare trait effects to competition performance
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {number} baseScore - Base competition score
 * @param {Object} competitionContext - Competition context data
 * @returns {Object} Modified score and applied effects
 */
export function applyUltraRareCompetitionEffects(horse, baseScore, competitionContext = {}) {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    let modifiedScore = baseScore;
    const appliedEffects = [];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      // Apply competition score modifier
      if (effects.competitionScoreModifier) {
        const bonus = baseScore * effects.competitionScoreModifier;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'competition_score_modifier',
          value: effects.competitionScoreModifier,
          bonus,
        });
      }

      // Apply presence bonus (Fey-Kissed, Born Leader)
      if (effects.presenceBonus) {
        const bonus = baseScore * effects.presenceBonus;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'presence_bonus',
          value: effects.presenceBonus,
          bonus,
        });
      }

      // Apply competition presence (Born Leader)
      if (effects.competitionPresence) {
        const bonus = baseScore * effects.competitionPresence;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'competition_presence',
          value: effects.competitionPresence,
          bonus,
        });
      }

      // Apply pair event bonus (Empathic Mirror)
      if (effects.pairEventBonus && competitionContext.isPairEvent) {
        const bonus = baseScore * effects.pairEventBonus;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'pair_event_bonus',
          value: effects.pairEventBonus,
          bonus,
        });
      }

      // Apply loyalty bonus (Shadow-Follower)
      if (effects.loyaltyBonus && competitionContext.withBondedHandler) {
        const bonus = baseScore * effects.loyaltyBonus;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'loyalty_bonus',
          value: effects.loyaltyBonus,
          bonus,
        });
      }

      // Apply same groom performance bonus (Soulbonded)
      if (effects.sameGroomPerformanceBonus && competitionContext.withSameGroom) {
        const bonus = baseScore * effects.sameGroomPerformanceBonus;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'same_groom_performance_bonus',
          value: effects.sameGroomPerformanceBonus,
          bonus,
        });
      }

      // Apply independence bonus (Ghostwalker)
      if (effects.independenceBonus && competitionContext.workingAlone) {
        const bonus = baseScore * effects.independenceBonus;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'independence_bonus',
          value: effects.independenceBonus,
          bonus,
        });
      }

      // Apply novelty bonus (Stormtouched)
      if (effects.noveltyBonus && competitionContext.newExperience) {
        const bonus = baseScore * effects.noveltyBonus;
        modifiedScore += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'novelty_bonus',
          value: effects.noveltyBonus,
          bonus,
        });
      }
    }

    return {
      originalScore: baseScore,
      modifiedScore,
      appliedEffects,
      totalBonus: modifiedScore - baseScore,
    };
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error applying competition effects: ${error.message}`);
    return {
      originalScore: baseScore,
      modifiedScore: baseScore,
      appliedEffects: [],
      totalBonus: 0,
    };
  }
}

/**
 * Apply ultra-rare trait effects to bonding calculations
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {number} baseBondChange - Base bond change amount
 * @param {Object} bondingContext - Bonding context data
 * @returns {Object} Modified bond change and applied effects
 */
export function applyUltraRareBondingEffects(horse, baseBondChange, bondingContext = {}) {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    let modifiedBondChange = baseBondChange;
    const appliedEffects = [];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      // Apply bonding rate multiplier (Empathic Mirror)
      if (effects.bondingRateMultiplier) {
        const bonus = baseBondChange * (effects.bondingRateMultiplier - 1);
        modifiedBondChange += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'bonding_rate_multiplier',
          value: effects.bondingRateMultiplier,
          bonus,
        });
      }

      // Apply first handler bond bonus (Shadow-Follower)
      if (effects.firstHandlerBondBonus && bondingContext.isFirstHandler) {
        const bonus = effects.firstHandlerBondBonus;
        modifiedBondChange += bonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'first_handler_bond_bonus',
          value: bonus,
          bonus,
        });
      }

      // Apply other handler penalty (Shadow-Follower)
      if (effects.otherHandlerPenalty && !bondingContext.isFirstHandler) {
        const penalty = baseBondChange * effects.otherHandlerPenalty;
        modifiedBondChange += penalty; // penalty is negative
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'other_handler_penalty',
          value: effects.otherHandlerPenalty,
          penalty: Math.abs(penalty),
        });
      }

      // Apply bond cap (Ghostwalker)
      if (effects.bondCap) {
        const currentBond = horse.bondScore || 0;
        const maxAllowedChange = Math.max(0, effects.bondCap - currentBond);
        if (modifiedBondChange > maxAllowedChange) {
          modifiedBondChange = maxAllowedChange;
          appliedEffects.push({
            trait: traitDef.name,
            effect: 'bond_cap',
            value: effects.bondCap,
            cappedAt: effects.bondCap,
          });
        }
      }
    }

    return {
      originalBondChange: baseBondChange,
      modifiedBondChange,
      appliedEffects,
      totalModification: modifiedBondChange - baseBondChange,
    };
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error applying bonding effects: ${error.message}`);
    return {
      originalBondChange: baseBondChange,
      modifiedBondChange: baseBondChange,
      appliedEffects: [],
      totalModification: 0,
    };
  }
}

/**
 * Apply ultra-rare trait effects to burnout calculations
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {number} baseBurnoutDays - Base burnout duration in days
 * @returns {Object} Modified burnout duration and applied effects
 */
export function applyUltraRareBurnoutEffects(horse, baseBurnoutDays) {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    let modifiedBurnoutDays = baseBurnoutDays;
    const appliedEffects = [];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      // Apply burnout immunity (Iron-Willed)
      if (effects.burnoutImmunity) {
        modifiedBurnoutDays = 0;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'burnout_immunity',
          value: true,
          reduction: baseBurnoutDays,
        });
        break; // Immunity overrides all other effects
      }

      // Apply burnout recovery bonus (Phoenix-Born)
      if (effects.burnoutRecoveryBonus) {
        const reduction = baseBurnoutDays * effects.burnoutRecoveryBonus;
        modifiedBurnoutDays -= reduction;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'burnout_recovery_bonus',
          value: effects.burnoutRecoveryBonus,
          reduction,
        });
      }
    }

    // Ensure burnout days don't go below 0
    modifiedBurnoutDays = Math.max(0, modifiedBurnoutDays);

    return {
      originalBurnoutDays: baseBurnoutDays,
      modifiedBurnoutDays,
      appliedEffects,
      totalReduction: baseBurnoutDays - modifiedBurnoutDays,
    };
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error applying burnout effects: ${error.message}`);
    return {
      originalBurnoutDays: baseBurnoutDays,
      modifiedBurnoutDays: baseBurnoutDays,
      appliedEffects: [],
      totalReduction: 0,
    };
  }
}

/**
 * Apply ultra-rare trait effects to base stats
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {Object} baseStats - Base stat values
 * @returns {Object} Modified stats and applied effects
 */
export function applyUltraRareStatEffects(horse, baseStats) {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    const modifiedStats = { ...baseStats };
    const appliedEffects = [];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      // Apply stamina bonus (Iron-Willed)
      if (effects.staminaBonus) {
        modifiedStats.stamina = (modifiedStats.stamina || 0) + effects.staminaBonus;
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'stamina_bonus',
          value: effects.staminaBonus,
        });
      }

      // Apply all stat bonus (Fey-Kissed)
      if (effects.allStatBonus) {
        const statNames = ['speed', 'stamina', 'agility', 'balance', 'precision', 'intelligence', 'boldness', 'flexibility', 'obedience', 'focus'];
        for (const statName of statNames) {
          modifiedStats[statName] = (modifiedStats[statName] || 0) + effects.allStatBonus;
        }
        appliedEffects.push({
          trait: traitDef.name,
          effect: 'all_stat_bonus',
          value: effects.allStatBonus,
        });
      }
    }

    return {
      originalStats: baseStats,
      modifiedStats,
      appliedEffects,
    };
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error applying stat effects: ${error.message}`);
    return {
      originalStats: baseStats,
      modifiedStats: baseStats,
      appliedEffects: [],
    };
  }
}

/**
 * Check if a horse has specific ultra-rare trait immunities or special abilities
 * @param {Object} horse - Horse data with ultra-rare traits
 * @param {string} abilityType - Type of ability to check
 * @returns {boolean} True if horse has the ability
 */
export function hasUltraRareAbility(horse, abilityType) {
  try {
    const ultraRareTraits = horse.ultraRareTraits || { ultraRare: [], exotic: [] };
    const allTraits = [...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic];

    for (const traitData of allTraits) {
      const traitDef = getUltraRareTraitDefinition(traitData.name);
      if (!traitDef || !traitDef.mechanicalEffects) { continue; }

      const effects = traitDef.mechanicalEffects;

      switch (abilityType) {
        case 'stress_immunity':
          if (effects.stressImmunity) { return true; }
          break;
        case 'burnout_immunity':
          if (effects.burnoutImmunity) { return true; }
          break;
        case 'training_fatigue_immunity':
          if (effects.trainingFatigueImmunity) { return true; }
          break;
        case 'weather_immunity':
          if (effects.weatherImmunity) { return true; }
          break;
        case 'mystical_resilience':
          if (effects.mysticalResilience) { return true; }
          break;
        case 'exclusive_bonding':
          if (effects.exclusiveBonding) { return true; }
          break;
        case 'reassignment_impossible':
          if (effects.reassignmentImpossible) { return true; }
          break;
        default:
          return false;
      }
    }

    return false;
  } catch (error) {
    logger.error(`[ultraRareMechanicalEffects] Error checking ability: ${error.message}`);
    return false;
  }
}
