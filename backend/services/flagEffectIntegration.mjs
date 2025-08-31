/**
 * Flag Effect Integration Service
 * 
 * Integrates epigenetic flag effects with competition system, training, and breeding outcomes.
 * Handles cumulative effects, conflict resolution, and discipline-specific bonuses/penalties.
 * 
 * Business Rules:
 * - Flags provide bonuses/penalties to specific disciplines
 * - Cumulative effects from multiple flags
 * - Conflict resolution for opposing flags
 * - Stress and bonding modifiers
 * - Training effectiveness modifiers
 * - Breeding trait probability influences
 */

import logger from '../utils/logger.mjs';
import { EPIGENETIC_FLAG_DEFINITIONS, flagsConflict } from '../config/epigeneticFlagDefinitions.mjs';

/**
 * Calculate cumulative effects from all flags on a horse
 * @param {Object} horse - Horse object with epigenetic flags
 * @returns {Object} Comprehensive flag effects breakdown
 */
export async function calculateFlagEffects(horse) {
  try {
    const flags = horse.epigeneticFlags || [];
    
    if (flags.length === 0) {
      return {
        competitionBonuses: {},
        competitionPenalties: {},
        stressModifiers: { stressReduction: 0, stressIncrease: 0, stressResistance: 0 },
        bondingModifiers: { bondingBonus: 0, bondingDifficulty: 0, bondingSpeed: 0 },
        trainingModifiers: { effectiveness: 0, adaptability: 0 },
        breedingModifiers: { traitProbabilities: {} },
        conflictResolution: { conflictsDetected: [], resolutionMethod: 'none_needed' },
      };
    }

    // Detect and resolve conflicts
    const conflictResolution = await resolveFlagConflicts(flags);
    
    // Calculate cumulative effects
    const competitionBonuses = {};
    const competitionPenalties = {};
    const stressModifiers = { stressReduction: 0, stressIncrease: 0, stressResistance: 0 };
    const bondingModifiers = { bondingBonus: 0, bondingDifficulty: 0, bondingSpeed: 0 };
    const trainingModifiers = { effectiveness: 0, adaptability: 0 };
    const breedingModifiers = { traitProbabilities: {} };

    // Process each flag
    for (const flagName of flags) {
      const flagDef = EPIGENETIC_FLAG_DEFINITIONS[flagName.toUpperCase()];
      if (!flagDef || !flagDef.influences) continue;

      const influences = flagDef.influences;
      const behaviorModifiers = influences.behaviorModifiers || {};
      const traitWeightModifiers = influences.traitWeightModifiers || {};

      // Apply competition bonuses from behavior modifiers
      if (behaviorModifiers.competitionBonus) {
        // Apply general competition bonus to common disciplines
        const disciplines = ['showJumping', 'dressage', 'racing', 'crossCountry', 'endurance'];
        disciplines.forEach(discipline => {
          competitionBonuses[discipline] = (competitionBonuses[discipline] || 0) + (behaviorModifiers.competitionBonus * 10); // Scale to score points
        });
      }

      // Apply discipline-specific bonuses based on flag type
      if (flagName.toUpperCase() === 'BRAVE') {
        competitionBonuses.showJumping = (competitionBonuses.showJumping || 0) + 2;
        competitionBonuses.crossCountry = (competitionBonuses.crossCountry || 0) + 3;
      } else if (flagName.toUpperCase() === 'CONFIDENT') {
        competitionBonuses.dressage = (competitionBonuses.dressage || 0) + 2;
        competitionBonuses.racing = (competitionBonuses.racing || 0) + 1;
      }

      // Apply negative flag penalties
      if (flagDef.type === 'negative') {
        const disciplines = ['showJumping', 'dressage', 'racing', 'crossCountry', 'endurance'];
        disciplines.forEach(discipline => {
          competitionPenalties[discipline] = (competitionPenalties[discipline] || 0) + 1; // Base penalty for negative flags
        });
      }

      // Apply stress modifiers from behavior modifiers
      if (behaviorModifiers.stressReduction) stressModifiers.stressReduction += behaviorModifiers.stressReduction;
      if (behaviorModifiers.stressIncrease) stressModifiers.stressIncrease += behaviorModifiers.stressIncrease;
      if (behaviorModifiers.stressResistance) stressModifiers.stressResistance += behaviorModifiers.stressResistance;
      if (behaviorModifiers.stressVulnerability) stressModifiers.stressIncrease += behaviorModifiers.stressVulnerability;

      // Apply bonding modifiers
      if (behaviorModifiers.bondingBonus) bondingModifiers.bondingBonus += behaviorModifiers.bondingBonus;
      if (behaviorModifiers.bondingDifficulty) bondingModifiers.bondingDifficulty += behaviorModifiers.bondingDifficulty;
      if (behaviorModifiers.bondingSpeed) bondingModifiers.bondingSpeed += behaviorModifiers.bondingSpeed;

      // Apply training modifiers
      if (behaviorModifiers.trainingEfficiency) trainingModifiers.effectiveness += behaviorModifiers.trainingEfficiency;
      if (behaviorModifiers.trainingEffectiveness) trainingModifiers.effectiveness += behaviorModifiers.trainingEffectiveness;
      if (behaviorModifiers.adaptability) trainingModifiers.adaptability += behaviorModifiers.adaptability;

      // Add default training bonuses for positive flags
      if (flagDef.type === 'positive') {
        trainingModifiers.effectiveness += 0.1; // 10% bonus for positive flags
        bondingModifiers.bondingBonus += 0.05; // 5% bonding bonus
        stressModifiers.stressReduction += 0.05; // 5% stress reduction
      }
      if (flagDef.type === 'negative') {
        trainingModifiers.effectiveness -= 0.1; // 10% penalty for negative flags
        bondingModifiers.bondingDifficulty += 0.05; // 5% bonding difficulty
        stressModifiers.stressIncrease += 0.05; // 5% stress increase
      }

      // Apply breeding modifiers from trait weight modifiers
      Object.entries(traitWeightModifiers).forEach(([trait, modifier]) => {
        breedingModifiers.traitProbabilities[trait] = (breedingModifiers.traitProbabilities[trait] || 0) + modifier;
      });

      // Add default self-trait probability for flags (e.g., brave flag increases brave trait)
      const flagNameLower = flagName.toLowerCase();
      if (flagDef.type === 'positive') {
        breedingModifiers.traitProbabilities[flagNameLower] = (breedingModifiers.traitProbabilities[flagNameLower] || 0) + 0.15;
      } else if (flagDef.type === 'negative') {
        breedingModifiers.traitProbabilities[flagNameLower] = (breedingModifiers.traitProbabilities[flagNameLower] || 0) + 0.1;
      }
    }

    // Apply conflict resolution adjustments
    if (conflictResolution.conflictsDetected.length > 0) {
      applyConflictAdjustments(conflictResolution, {
        competitionBonuses,
        competitionPenalties,
        stressModifiers,
        bondingModifiers,
        trainingModifiers,
        breedingModifiers,
      });
    }

    return {
      competitionBonuses,
      competitionPenalties,
      stressModifiers,
      bondingModifiers,
      trainingModifiers,
      breedingModifiers,
      conflictResolution,
      totalFlags: flags.length,
    };

  } catch (error) {
    logger.error(`Error calculating flag effects for horse ${horse.id}:`, error);
    throw error;
  }
}

/**
 * Apply flag effects to competition performance
 * @param {Object} horse - Horse object with flags
 * @param {Object} basePerformance - Base competition performance data
 * @returns {Object} Modified performance with flag effects
 */
export async function applyFlagEffectsToCompetition(horse, basePerformance) {
  try {
    const flagEffects = await calculateFlagEffects(horse);
    const { discipline, baseScore } = basePerformance;
    
    let modifiedScore = baseScore;
    const flagEffectsApplied = [];
    let totalBonus = 0;
    let totalPenalty = 0;

    // Apply discipline-specific bonuses
    if (flagEffects.competitionBonuses[discipline]) {
      const bonus = flagEffects.competitionBonuses[discipline];
      modifiedScore += bonus;
      totalBonus += bonus;
      flagEffectsApplied.push({
        type: 'bonus',
        discipline,
        value: bonus,
        source: 'positive_flags',
      });
    }

    // Apply discipline-specific penalties
    if (flagEffects.competitionPenalties[discipline]) {
      const penalty = flagEffects.competitionPenalties[discipline];
      modifiedScore -= penalty;
      totalPenalty += penalty;
      flagEffectsApplied.push({
        type: 'penalty',
        discipline,
        value: penalty,
        source: 'negative_flags',
      });
    }

    // Apply stress resistance effects (affects performance under pressure)
    if (flagEffects.stressModifiers.stressResistance > 0) {
      const stressBonus = flagEffects.stressModifiers.stressResistance * 2; // Convert to score bonus
      modifiedScore += stressBonus;
      totalBonus += stressBonus;
      flagEffectsApplied.push({
        type: 'bonus',
        discipline: 'all',
        value: stressBonus,
        source: 'stress_resistance',
      });
    }

    return {
      originalScore: baseScore,
      modifiedScore: Math.max(0, modifiedScore), // Ensure non-negative
      totalBonus,
      totalPenalty,
      flagEffectsApplied,
      effectiveFlags: horse.epigeneticFlags || [],
    };

  } catch (error) {
    logger.error(`Error applying flag effects to competition for horse ${horse.id}:`, error);
    throw error;
  }
}

/**
 * Apply flag effects to training effectiveness
 * @param {Object} horse - Horse object with flags
 * @param {Object} trainingSession - Training session data
 * @returns {Object} Modified training effectiveness with flag effects
 */
export async function applyFlagEffectsToTraining(horse, trainingSession) {
  try {
    const flagEffects = await calculateFlagEffects(horse);
    const { baseEffectiveness, discipline, groomPersonality } = trainingSession;
    
    let modifiedEffectiveness = baseEffectiveness;
    const flagEffectsApplied = [];
    let stressImpact = 0;
    let bondingImpact = 0;

    // Apply training effectiveness modifiers
    if (flagEffects.trainingModifiers.effectiveness !== 0) {
      modifiedEffectiveness += flagEffects.trainingModifiers.effectiveness;
      flagEffectsApplied.push({
        type: 'effectiveness',
        value: flagEffects.trainingModifiers.effectiveness,
        source: 'flag_training_modifiers',
      });
    }

    // Ensure positive flags provide meaningful training boost
    const positiveFlags = (horse.epigeneticFlags || []).filter(flag => {
      const flagDef = EPIGENETIC_FLAG_DEFINITIONS[flag.toUpperCase()];
      return flagDef && flagDef.type === 'positive';
    });

    if (positiveFlags.length > 0) {
      const positiveBonus = positiveFlags.length * 0.05; // 5% per positive flag
      modifiedEffectiveness += positiveBonus;
      flagEffectsApplied.push({
        type: 'positive_flag_bonus',
        value: positiveBonus,
        source: 'positive_flags',
      });
    }

    // Apply adaptability effects (helps with new disciplines)
    if (flagEffects.trainingModifiers.adaptability > 0) {
      const adaptabilityBonus = flagEffects.trainingModifiers.adaptability * 0.1;
      modifiedEffectiveness += adaptabilityBonus;
      flagEffectsApplied.push({
        type: 'adaptability',
        value: adaptabilityBonus,
        source: 'flag_adaptability',
      });
    }

    // Calculate stress impact from training
    stressImpact = flagEffects.stressModifiers.stressIncrease - flagEffects.stressModifiers.stressReduction;
    
    // Calculate bonding impact
    bondingImpact = flagEffects.bondingModifiers.bondingBonus - flagEffects.bondingModifiers.bondingDifficulty;

    // Apply groom personality compatibility
    const personalityCompatibility = calculateGroomPersonalityCompatibility(horse.epigeneticFlags, groomPersonality);

    // Only apply personality compatibility if it's beneficial or neutral
    if (personalityCompatibility >= 1.0) {
      modifiedEffectiveness *= personalityCompatibility;
    } else {
      // For negative compatibility, apply a smaller penalty to not override flag benefits
      modifiedEffectiveness *= Math.max(0.9, personalityCompatibility);
    }
    
    if (personalityCompatibility !== 1.0) {
      flagEffectsApplied.push({
        type: 'personality_compatibility',
        value: personalityCompatibility - 1.0,
        source: `groom_${groomPersonality}_compatibility`,
      });
    }

    return {
      originalEffectiveness: baseEffectiveness,
      modifiedEffectiveness: Math.max(0.1, modifiedEffectiveness), // Minimum 10% effectiveness
      stressImpact,
      bondingImpact,
      flagEffectsApplied,
      personalityCompatibility,
    };

  } catch (error) {
    logger.error(`Error applying flag effects to training for horse ${horse.id}:`, error);
    throw error;
  }
}

/**
 * Apply flag effects to breeding trait probabilities
 * @param {Object} mare - Mare horse object with flags
 * @param {Object} stallion - Stallion horse object with flags
 * @param {Object} breedingOutcome - Base breeding outcome data
 * @returns {Object} Modified breeding outcome with flag effects
 */
export async function applyFlagEffectsToBreeding(mare, stallion, breedingOutcome) {
  try {
    const mareEffects = await calculateFlagEffects(mare);
    const stallionEffects = await calculateFlagEffects(stallion);

    const { baseTraitProbabilities } = breedingOutcome;
    const modifiedTraitProbabilities = { ...baseTraitProbabilities };
    const flagInfluences = [];

    // Combine parent flag influences (50% each parent)
    const combinedTraitModifiers = {};

    // Process mare influences
    Object.entries(mareEffects.breedingModifiers.traitProbabilities).forEach(([trait, modifier]) => {
      combinedTraitModifiers[trait] = (combinedTraitModifiers[trait] || 0) + (modifier * 0.5);
      flagInfluences.push({
        parent: 'mare',
        trait,
        influence: modifier * 0.5,
        flags: mare.epigeneticFlags || [],
      });
    });

    // Process stallion influences
    Object.entries(stallionEffects.breedingModifiers.traitProbabilities).forEach(([trait, modifier]) => {
      combinedTraitModifiers[trait] = (combinedTraitModifiers[trait] || 0) + (modifier * 0.5);
      flagInfluences.push({
        parent: 'stallion',
        trait,
        influence: modifier * 0.5,
        flags: stallion.epigeneticFlags || [],
      });
    });

    // Apply combined modifiers to trait probabilities
    Object.entries(combinedTraitModifiers).forEach(([trait, modifier]) => {
      if (modifiedTraitProbabilities[trait] !== undefined) {
        modifiedTraitProbabilities[trait] = Math.max(0, Math.min(1,
          modifiedTraitProbabilities[trait] + modifier
        ));
      } else {
        // Add new trait probability if it doesn't exist in base
        modifiedTraitProbabilities[trait] = Math.max(0, Math.min(1, modifier));
      }
    });

    // Check for conflicting parent flags
    const allParentFlags = [...(mare.epigeneticFlags || []), ...(stallion.epigeneticFlags || [])];
    const conflictResolution = await resolveFlagConflicts(allParentFlags);

    // Apply conflict resolution to breeding
    if (conflictResolution.conflictsDetected.length > 0) {
      // Reduce extreme trait probability changes when parents have conflicting flags
      Object.keys(modifiedTraitProbabilities).forEach(trait => {
        const originalProb = baseTraitProbabilities[trait];
        const modifiedProb = modifiedTraitProbabilities[trait];
        const change = modifiedProb - originalProb;

        // Moderate the change by 50% when conflicts exist
        modifiedTraitProbabilities[trait] = originalProb + (change * 0.5);
      });
    }

    return {
      originalTraitProbabilities: baseTraitProbabilities,
      modifiedTraitProbabilities,
      flagInfluences,
      conflictResolution: {
        ...conflictResolution,
        method: conflictResolution.resolutionMethod, // Add method property for test compatibility
      },
      parentFlags: {
        mare: mare.epigeneticFlags || [],
        stallion: stallion.epigeneticFlags || [],
      },
    };

  } catch (error) {
    logger.error(`Error applying flag effects to breeding:`, error);
    throw error;
  }
}

/**
 * Resolve conflicts between opposing flags
 * @param {Array} flags - Array of flag names
 * @returns {Object} Conflict resolution data
 */
export async function resolveFlagConflicts(flags) {
  try {
    const conflictsDetected = [];

    // Check each flag against all others for conflicts
    for (let i = 0; i < flags.length; i++) {
      for (let j = i + 1; j < flags.length; j++) {
        const flag1 = flags[i];
        const flag2 = flags[j];

        if (flagsConflict(flag1, flag2)) {
          conflictsDetected.push({
            flags: [flag1, flag2],
            type: 'direct_opposition',
            severity: calculateConflictSeverity(flag1, flag2),
          });
        }
      }
    }

    if (conflictsDetected.length === 0) {
      return {
        conflictsDetected: [],
        resolutionMethod: 'none_needed',
        resolvedEffects: {},
      };
    }

    // Determine resolution method based on conflict severity
    const maxSeverity = Math.max(...conflictsDetected.map(c => c.severity));
    let resolutionMethod;

    if (maxSeverity >= 0.8) resolutionMethod = 'dominant_flag';
    else if (maxSeverity >= 0.5) resolutionMethod = 'partial_cancellation';
    else resolutionMethod = 'minor_reduction';

    const resolvedEffects = calculateResolvedEffects(conflictsDetected, resolutionMethod);

    return {
      conflictsDetected,
      resolutionMethod,
      resolvedEffects,
      totalConflicts: conflictsDetected.length,
    };

  } catch (error) {
    logger.error('Error resolving flag conflicts:', error);
    throw error;
  }
}

/**
 * Apply conflict resolution adjustments to flag effects
 */
function applyConflictAdjustments(conflictResolution, effects) {
  const { resolutionMethod, conflictsDetected } = conflictResolution;

  if (resolutionMethod === 'none_needed') return;

  const reductionFactor = getReductionFactor(resolutionMethod, conflictsDetected.length);

  // Reduce all effects by the conflict resolution factor
  Object.values(effects.competitionBonuses).forEach((value, index, arr) => {
    arr[index] = value * reductionFactor;
  });

  Object.values(effects.competitionPenalties).forEach((value, index, arr) => {
    arr[index] = value * reductionFactor;
  });

  // Apply reduction to modifiers
  Object.keys(effects.stressModifiers).forEach(key => {
    effects.stressModifiers[key] *= reductionFactor;
  });

  Object.keys(effects.bondingModifiers).forEach(key => {
    effects.bondingModifiers[key] *= reductionFactor;
  });

  Object.keys(effects.trainingModifiers).forEach(key => {
    effects.trainingModifiers[key] *= reductionFactor;
  });
}

/**
 * Calculate groom personality compatibility with horse flags
 */
function calculateGroomPersonalityCompatibility(flags, groomPersonality) {
  if (!flags || flags.length === 0) return 1.0;

  let compatibilityScore = 1.0;

  // Calm grooms work well with fearful/reactive horses
  if (groomPersonality === 'calm') {
    if (flags.includes('fearful')) compatibilityScore += 0.2;
    if (flags.includes('reactive')) compatibilityScore += 0.15;
    if (flags.includes('insecure')) compatibilityScore += 0.1;
  }

  // Energetic grooms work well with confident/brave horses
  if (groomPersonality === 'energetic') {
    if (flags.includes('brave')) compatibilityScore += 0.15;
    if (flags.includes('confident')) compatibilityScore += 0.1;
    if (flags.includes('curious')) compatibilityScore += 0.2;
    // But may stress fearful horses
    if (flags.includes('fearful')) compatibilityScore -= 0.1;
    if (flags.includes('fragile')) compatibilityScore -= 0.15;
  }

  // Methodical grooms provide consistent care for all
  if (groomPersonality === 'methodical') {
    compatibilityScore += 0.05; // Small bonus for all horses
    if (flags.includes('insecure')) compatibilityScore += 0.1; // Extra for insecure horses
  }

  return Math.max(0.5, Math.min(1.5, compatibilityScore)); // Clamp between 50% and 150%
}

/**
 * Calculate conflict severity between two flags
 */
function calculateConflictSeverity(flag1, flag2) {
  const severityMap = {
    'brave-fearful': 0.9,
    'confident-insecure': 0.8,
    'calm-reactive': 0.7,
    'social-antisocial': 0.8,
    'resilient-fragile': 0.7,
  };

  const conflictKey = [flag1, flag2].sort().join('-');
  return severityMap[conflictKey] || 0.5; // Default moderate severity
}

/**
 * Calculate resolved effects after conflict resolution
 */
function calculateResolvedEffects(conflicts, resolutionMethod) {
  // Simplified implementation - could be expanded
  return {
    method: resolutionMethod,
    effectReduction: getReductionFactor(resolutionMethod, conflicts.length),
    conflictsResolved: conflicts.length,
  };
}

/**
 * Get reduction factor based on resolution method and conflict count
 */
function getReductionFactor(resolutionMethod, conflictCount) {
  const baseReduction = {
    'dominant_flag': 0.3,
    'partial_cancellation': 0.5,
    'minor_reduction': 0.8,
  };

  const reduction = baseReduction[resolutionMethod] || 0.7;
  const conflictPenalty = Math.min(0.3, conflictCount * 0.1); // Max 30% additional reduction

  return Math.max(0.2, reduction - conflictPenalty); // Minimum 20% effectiveness
}
