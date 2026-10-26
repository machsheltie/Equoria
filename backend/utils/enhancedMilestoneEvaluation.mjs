/**
 * Enhanced Milestone Evaluation System
 *
 * This module extends the existing milestone system to incorporate groom care history,
 * personality-based bonuses, and epigenetic flag influences for more realistic
 * trait development in horses under 3 years old.
 */

import logger from './logger.mjs';
import { gameDateKey } from './gameTime.mjs';
import { EPIGENETIC_FLAGS, GROOM_PERSONALITIES } from './epigeneticFlags.mjs';
import { evaluateUltraRareTriggers, evaluateExoticUnlocks } from './ultraRareTriggerEngine.mjs';
import { getHorseAgeYears } from './horseAge.mjs';
import { minActiveAgeYears } from '../constants/horseAgePolicy.mjs';
import { asFlagArray } from './jsonbArrayGuard.mjs';
// Note: Using existing trait effects system instead of separate definitions

/**
 * Enhanced milestone evaluation that factors in groom care history
 * @param {Object} horse - Horse data including age, current traits, bond scores
 * @param {Object} groomCareHistory - Historical groom care data
 * @param {Object} currentGroom - Current assigned groom data
 * @param {Object} milestoneData - Standard milestone evaluation data
 * @returns {Object} Enhanced milestone results with trait recommendations
 */
export async function evaluateEnhancedMilestone(
  horse,
  groomCareHistory,
  currentGroom,
  milestoneData,
) {
  // Base milestone evaluation
  const baseMilestone = await evaluateBaseMilestone(horse, milestoneData);

  // Only apply enhanced (groom/epigenetic) evaluation for horses under game age 3.
  //
  // Equoria-xggat / Equoria-oey96.73 (owner ruling 2026-10-19, decision 18):
  // "under 3" is the horse's GAME age, the same age the game shows
  // (utils/horseAge.mjs: 1 game-year = 7 days, so age 3 = 21 days), read
  // through the one age policy. It replaces the 1095-elapsed-day boundary of
  // Equoria-l06yb, which treated age 3 as three real years.
  if (getHorseAgeYears(horse.dateOfBirth) >= minActiveAgeYears) {
    return baseMilestone;
  }

  // Equoria-oey96.32: READ the horse's canonical epigenetic flags — assigned
  // by the weekly flagEvaluationEngine (config/epigeneticFlagDefinitions.mjs),
  // the single ratified flag-assignment cadence per PRD-04 §2.2. Formerly this
  // called a permanent stub whose trigger evaluators returned constant false,
  // so this field was ALWAYS [] — dead code producing false coverage on the
  // live milestone path. This is a READ, not a re-evaluation: the milestone
  // path never assigns flags (that would be a forbidden second live flag
  // engine — see the flagEngineSingleSource sentinel).
  const epigeneticFlags = asFlagArray(horse.epigeneticFlags);

  // Calculate groom care consistency bonus
  const careConsistencyBonus = calculateCareConsistencyBonus(groomCareHistory);

  // Calculate personality-based trait bonuses
  const personalityBonuses = calculatePersonalityBonuses(currentGroom, horse, groomCareHistory);

  // Apply enhanced scoring to trait recommendations
  const enhancedTraits = applyEnhancedScoring(
    baseMilestone.recommendedTraits,
    epigeneticFlags,
    careConsistencyBonus,
    personalityBonuses,
    horse,
  );

  // Evaluate ultra-rare and exotic traits at milestone completion
  let ultraRareEvaluation;
  try {
    const ultraRareResults = await evaluateUltraRareTriggers(horse.id, {
      triggerSource: 'milestone_completion',
      milestoneType: milestoneData.type,
      groomId: currentGroom?.id,
      careHistory: groomCareHistory,
    });

    const exoticResults = await evaluateExoticUnlocks(horse.id, {
      triggerSource: 'milestone_completion',
      milestoneType: milestoneData.type,
      groomId: currentGroom?.id,
      careHistory: groomCareHistory,
    });

    ultraRareEvaluation = {
      ultraRareTriggered: ultraRareResults,
      exoticUnlocked: exoticResults,
      totalRareTraits: ultraRareResults.length + exoticResults.length,
    };
  } catch (error) {
    // Log error but don't fail milestone evaluation
    logger.warn('[enhancedMilestoneEvaluation] Ultra-rare trait evaluation failed', {
      error: error.message,
    });
    ultraRareEvaluation = {
      ultraRareTriggered: [],
      exoticUnlocked: [],
      totalRareTraits: 0,
      error: error.message,
    };
  }

  return {
    ...baseMilestone,
    recommendedTraits: enhancedTraits,
    epigeneticFlags,
    careConsistencyBonus,
    personalityBonuses,
    ultraRareEvaluation,
    enhancementFactors: {
      epigeneticInfluenceType: currentGroom?.epigeneticInfluenceType || 'balanced',
      careQuality: calculateCareQuality(groomCareHistory),
      bondStability: calculateBondStability(groomCareHistory),
    },
  };
}

/**
 * Calculates care consistency bonus based on groom interaction history
 * @param {Object} groomCareHistory - Historical care data
 * @returns {number} Consistency bonus multiplier (0.8 to 1.3)
 */
function calculateCareConsistencyBonus(groomCareHistory) {
  if (!groomCareHistory || !groomCareHistory.interactions) {
    return 1.0; // Neutral if no history
  }

  const { interactions } = groomCareHistory;
  const recentInteractions = interactions.filter(
    interaction => Date.now() - new Date(interaction.timestamp) < 30 * 24 * 60 * 60 * 1000, // Last 30 days
  );

  if (recentInteractions.length === 0) {
    return 0.8; // Penalty for no recent care
  }

  // Calculate consistency metrics
  const dailyInteractionCounts = calculateDailyInteractionCounts(recentInteractions);
  const consistencyScore = calculateConsistencyScore(dailyInteractionCounts);
  const qualityScore = calculateAverageQuality(recentInteractions);

  // Combine consistency and quality for bonus
  const baseBonus = consistencyScore * 0.6 + qualityScore * 0.4;

  // Convert to multiplier (0.8 to 1.3 range)
  return Math.max(0.8, Math.min(1.3, 0.8 + baseBonus * 0.5));
}

/**
 * Calculates personality-based trait development bonuses
 * @param {Object} currentGroom - Current groom data
 * @param {Object} horse - Horse data
 * @param {Object} groomCareHistory - Care history
 * @returns {Object} Personality bonus modifiers
 */
function calculatePersonalityBonuses(currentGroom, horse, groomCareHistory) {
  if (!currentGroom?.epigeneticInfluenceType) {
    return {};
  }

  const personality = GROOM_PERSONALITIES[currentGroom.epigeneticInfluenceType.toUpperCase()];
  if (!personality) {
    return {};
  }

  const bonuses = {};

  // Apply trait bonuses based on groom personality
  Object.entries(personality.traitBonuses || {}).forEach(([flagName, bonus]) => {
    bonuses[flagName] = bonus;
  });

  // Apply temperament synergy bonuses
  if (horse.temperament && personality.temperamentSynergy) {
    const synergyBonus = personality.temperamentSynergy[horse.temperament.toLowerCase()] || 0;

    // Apply synergy bonus to all trait development
    Object.keys(bonuses).forEach(flagName => {
      bonuses[flagName] = (bonuses[flagName] || 0) + synergyBonus;
    });
  }

  // Factor in care duration - longer relationships get stronger bonuses
  const careDuration = calculateCareDuration(groomCareHistory, currentGroom.id);
  const durationMultiplier = Math.min(1.5, 1.0 + careDuration / 90); // Max 1.5x after 90 days

  Object.keys(bonuses).forEach(flagName => {
    bonuses[flagName] *= durationMultiplier;
  });

  return bonuses;
}

/**
 * Applies enhanced scoring to trait recommendations
 * @param {Array} baseTraits - Base trait recommendations
 * @param {Array} epigeneticFlags - Applicable epigenetic flags
 * @param {number} careBonus - Care consistency bonus
 * @param {Object} personalityBonuses - Personality-based bonuses
 * @param {Object} horse - Horse data
 * @returns {Array} Enhanced trait recommendations with scores
 */
function applyEnhancedScoring(baseTraits, epigeneticFlags, careBonus, personalityBonuses, _horse) {
  // JSONB-sourced flag arrays may be null / non-array; normalize defensively.
  epigeneticFlags = asFlagArray(epigeneticFlags);
  const enhancedTraits = [];

  // Process base traits with enhancements
  baseTraits.forEach(trait => {
    const enhancedTrait = {
      ...trait,
      baseScore: trait.score,
      enhancementFactors: {},
    };

    // Apply care consistency bonus
    enhancedTrait.score = trait.score * careBonus;
    enhancedTrait.enhancementFactors.careConsistency = careBonus;

    // Apply personality bonuses
    const personalityBonus = personalityBonuses[trait.name] || 0;
    enhancedTrait.score += personalityBonus;
    enhancedTrait.enhancementFactors.personalityBonus = personalityBonus;

    // Apply epigenetic flag influences
    const flagInfluence = calculateEpigeneticFlagInfluence(trait.name, epigeneticFlags);
    enhancedTrait.score += flagInfluence;
    enhancedTrait.enhancementFactors.epigeneticInfluence = flagInfluence;

    enhancedTraits.push(enhancedTrait);
  });

  // Add new traits from epigenetic flags
  epigeneticFlags.forEach(flagName => {
    const flag = EPIGENETIC_FLAGS[flagName];
    if (!flag?.effects?.traitProbability) {
      return;
    }

    Object.entries(flag.effects.traitProbability).forEach(([traitName, probability]) => {
      // Check if trait already exists in recommendations
      const existingTrait = enhancedTraits.find(t => t.name === traitName);

      if (existingTrait) {
        // Boost existing trait
        existingTrait.score += probability;
        existingTrait.enhancementFactors.epigeneticBoost = probability;
      } else {
        // Add new trait from epigenetic influence
        enhancedTraits.push({
          name: traitName,
          score: probability,
          baseScore: 0,
          source: 'epigenetic_flag',
          flagSource: flagName,
          enhancementFactors: {
            careConsistency: 1.0,
            personalityBonus: 0,
            epigeneticInfluence: probability,
          },
        });
      }
    });
  });

  // Sort by final score and return top candidates
  return enhancedTraits.sort((a, b) => b.score - a.score).slice(0, 10); // Return top 10 trait candidates
}

/**
 * Calculates the influence of epigenetic flags on specific traits
 * @param {string} traitName - Name of the trait to evaluate
 * @param {Array} epigeneticFlags - Active epigenetic flags
 * @returns {number} Combined influence score
 */
function calculateEpigeneticFlagInfluence(traitName, epigeneticFlags) {
  let totalInfluence = 0;

  asFlagArray(epigeneticFlags).forEach(flagName => {
    const flag = EPIGENETIC_FLAGS[flagName];
    if (flag?.effects?.traitProbability?.[traitName]) {
      totalInfluence += flag.effects.traitProbability[traitName];
    }
  });

  return totalInfluence;
}

/**
 * Helper functions for care analysis
 */

function calculateDailyInteractionCounts(interactions) {
  const dailyCounts = {};

  interactions.forEach(interaction => {
    const date = gameDateKey(interaction.timestamp);
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
  });

  return dailyCounts;
}

function calculateConsistencyScore(dailyCounts) {
  const days = Object.keys(dailyCounts);
  if (days.length === 0) {
    return 0;
  }

  const totalDays = 30; // Evaluate over 30 days
  const activeDays = days.length;
  const consistencyRatio = activeDays / totalDays;

  // Bonus for regular daily care
  const averageInteractionsPerDay =
    Object.values(dailyCounts).reduce((a, b) => a + b, 0) / activeDays;
  const regularityBonus = averageInteractionsPerDay >= 1 ? 0.2 : 0;

  return Math.min(1.0, consistencyRatio + regularityBonus);
}

function calculateAverageQuality(interactions) {
  if (interactions.length === 0) {
    return 0;
  }

  const qualityMap = { excellent: 1.0, good: 0.8, fair: 0.6, poor: 0.4 };
  const totalQuality = interactions.reduce((sum, interaction) => {
    return sum + (qualityMap[interaction.quality] || 0.5);
  }, 0);

  return totalQuality / interactions.length;
}

function calculateCareQuality(groomCareHistory) {
  if (!groomCareHistory?.interactions) {
    return 'unknown';
  }

  const avgQuality = calculateAverageQuality(groomCareHistory.interactions);

  if (avgQuality >= 0.9) {
    return 'excellent';
  }
  if (avgQuality >= 0.7) {
    return 'good';
  }
  if (avgQuality >= 0.5) {
    return 'fair';
  }
  return 'poor';
}

function calculateBondStability(groomCareHistory) {
  if (!groomCareHistory?.bondHistory) {
    return 'stable';
  }

  // Analyze bond score trends for stability
  const bondScores = groomCareHistory.bondHistory.map(entry => entry.bondScore);
  if (bondScores.length < 2) {
    return 'stable';
  }

  const variance = calculateVariance(bondScores);

  if (variance < 5) {
    return 'very_stable';
  }
  if (variance < 15) {
    return 'stable';
  }
  if (variance < 30) {
    return 'fluctuating';
  }
  return 'unstable';
}

function calculateCareDuration(groomCareHistory, groomId) {
  if (!groomCareHistory?.assignments) {
    return 0;
  }

  const groomAssignments = groomCareHistory.assignments.filter(a => a.groomId === groomId);
  if (groomAssignments.length === 0) {
    return 0;
  }

  const [firstAssignment] = groomAssignments;
  const daysSinceAssignment = Math.floor(
    (Date.now() - new Date(firstAssignment.startDate)) / (1000 * 60 * 60 * 24),
  );

  return daysSinceAssignment;
}

function calculateVariance(numbers) {
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * Placeholder for base milestone evaluation
 * This would integrate with the existing milestone system
 */
async function evaluateBaseMilestone(_horse, _milestoneData) {
  // This would call the existing milestone evaluation logic
  // For now, return a basic structure
  return {
    milestoneReached: true,
    recommendedTraits: [],
  };
}

// The base milestone carries no named life stage: neither `ageCategory`
// (foal / weanling / yearling / two_year_old / mature, removed in
// Equoria-fr2kg Q5, owner ruling 2026-10-15) nor `developmentalStage`
// (imprinting / socialization / fear_period / juvenile / adolescent /
// young_adult, removed in Equoria-oey96.73: it bucketed elapsed calendar days
// on a 365-day scale, no player surface read it, and the named life stages are
// not part of the design).
