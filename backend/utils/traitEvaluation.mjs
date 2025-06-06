/**
 * @fileoverview Trait Evaluation System for Horse Development
 *
 * @description
 * Comprehensive trait evaluation system handling both discovery-based traits and
 * groom interaction-based trait development. Manages trait revelation, conflict
 * resolution, epigenetic trait assignment, and permanent trait application.
 *
 * @features
 * - Discovery-based trait revelation system with bond/stress conditions
 * - Groom interaction trait influence system (+3/-3 permanence rules)
 * - Epigenetic trait marking for early development (before age 3)
 * - Trait conflict resolution and duplication prevention
 * - Task-based trait evaluation from foal care history
 * - Milestone-based trait assignment at age thresholds
 *
 * @dependencies
 * - logger: Winston logger for system logging
 * - taskInfluenceConfig: Legacy task influence mapping (foal enrichment)
 * - taskTraitInfluenceMap: New groom interaction trait influence system
 *
 * @usage
 * Used by groom system for trait development during interactions.
 * Used by foal system for epigenetic trait assignment at milestones.
 * Used by trait discovery system for revelation-based trait assignment.
 *
 * @author Equoria Development Team
 * @since 1.0.0
 * @lastModified 2025-01-02 - Enhanced with groom interaction trait influence system
 */

import logger from './logger.mjs';
import { TASK_TRAIT_INFLUENCE_MAP } from '../config/taskInfluenceConfig.mjs';
import { TRAIT_INFLUENCE_CONFIG, getTaskTraitInfluence } from './taskTraitInfluenceMap.mjs';

/**
 * Trait definitions with their revelation conditions
 */
const TRAIT_DEFINITIONS = {
  // Positive traits revealed through good bonding and low stress
  positive: {
    resilient: {
      name: 'Resilient',
      description: 'Faster stress recovery and improved training consistency',
      revealConditions: {
        minBondScore: 70,
        maxStressLevel: 30,
        minAge: 2, // days
      },
      rarity: 'common',
      baseChance: 0.25,
    },
    calm: {
      name: 'Calm',
      description: 'Reduced stress accumulation and improved focus',
      revealConditions: {
        minBondScore: 60,
        maxStressLevel: 20,
        minAge: 1,
      },
      rarity: 'common',
      baseChance: 0.3,
    },
    intelligent: {
      name: 'Intelligent',
      description: 'Accelerated learning and improved skill retention',
      revealConditions: {
        minBondScore: 75,
        maxStressLevel: 25,
        minAge: 3,
      },
      rarity: 'common',
      baseChance: 0.2,
    },
    bold: {
      name: 'Bold',
      description: 'Enhanced competition performance and better adaptability',
      revealConditions: {
        minBondScore: 65,
        maxStressLevel: 40,
        minAge: 4,
      },
      rarity: 'common',
      baseChance: 0.22,
    },
    athletic: {
      name: 'Athletic',
      description: 'Improved physical stats and better movement quality',
      revealConditions: {
        minBondScore: 80,
        maxStressLevel: 35,
        minAge: 5,
      },
      rarity: 'rare',
      baseChance: 0.15,
    },
    trainability_boost: {
      name: 'Trainability Boost',
      description: 'Major training efficiency bonus',
      revealConditions: {
        minBondScore: 85,
        maxStressLevel: 15,
        minAge: 6,
      },
      rarity: 'rare',
      baseChance: 0.1,
    },
  },

  // Negative traits revealed through poor bonding and high stress
  negative: {
    nervous: {
      name: 'Nervous',
      description: 'Increased stress sensitivity, requires gentle approach',
      revealConditions: {
        maxBondScore: 40,
        minStressLevel: 60,
        minAge: 1,
      },
      rarity: 'common',
      baseChance: 0.35,
    },
    stubborn: {
      name: 'Stubborn',
      description: 'Slower initial learning, increased training time',
      revealConditions: {
        maxBondScore: 30,
        minStressLevel: 50,
        minAge: 2,
      },
      rarity: 'common',
      baseChance: 0.25,
    },
    fragile: {
      name: 'Fragile',
      description: 'Higher injury risk, requires careful management',
      revealConditions: {
        maxBondScore: 35,
        minStressLevel: 70,
        minAge: 3,
      },
      rarity: 'common',
      baseChance: 0.2,
    },
    aggressive: {
      name: 'Aggressive',
      description: 'Handling challenges and social difficulties',
      revealConditions: {
        maxBondScore: 25,
        minStressLevel: 80,
        minAge: 4,
      },
      rarity: 'common',
      baseChance: 0.3,
    },
    lazy: {
      name: 'Lazy',
      description: 'Reduced training efficiency, requires motivation',
      revealConditions: {
        maxBondScore: 45,
        minStressLevel: 40,
        minAge: 5,
      },
      rarity: 'common',
      baseChance: 0.18,
    },
  },

  // Rare traits with special conditions
  rare: {
    legendary_bloodline: {
      name: 'Legendary Bloodline',
      description: 'Exceptional heritage with superior potential',
      revealConditions: {
        minBondScore: 90,
        maxStressLevel: 10,
        minAge: 6,
      },
      rarity: 'legendary',
      baseChance: 0.03,
    },
    weather_immunity: {
      name: 'Weather Immunity',
      description: 'Environmental resistance to weather conditions',
      revealConditions: {
        minBondScore: 75,
        maxStressLevel: 20,
        minAge: 4,
      },
      rarity: 'rare',
      baseChance: 0.08,
    },
    night_vision: {
      name: 'Night Vision',
      description: 'Enhanced performance in low-light conditions',
      revealConditions: {
        minBondScore: 70,
        maxStressLevel: 25,
        minAge: 5,
      },
      rarity: 'rare',
      baseChance: 0.06,
    },
  },
};

/**
 * Trait conflicts - traits that cannot coexist
 */
const TRAIT_CONFLICTS = {
  calm: ['nervous', 'aggressive'],
  resilient: ['fragile'],
  bold: ['nervous'],
  intelligent: ['lazy'],
  athletic: ['fragile'],
  trainability_boost: ['stubborn'],
  nervous: ['calm', 'bold'],
  aggressive: ['calm'],
  fragile: ['resilient', 'athletic'],
  lazy: ['intelligent'],
  stubborn: ['trainability_boost'],
};

/**
 * Evaluate which traits should be revealed for a foal based on current conditions
 * @param {Object} foal - Foal data with bond_score, stress_level, age
 * @param {Object} currentTraits - Current epigenetic_modifiers object
 * @param {number} currentDay - Current development day (0-6)
 * @returns {Object} - New traits to be revealed
 */
function evaluateTraitRevelation(foal, currentTraits, currentDay) {
  try {
    logger.info(
      `[traitEvaluation.evaluateTraitRevelation] Evaluating traits for foal ${foal.id} on day ${currentDay}`,
      `[traitEvaluation.evaluateTraitRevelation] Evaluating traits for foal ${foal.id} on day ${currentDay}`,
    );

    const bondScore = foal.bond_score || 50;
    const stressLevel = foal.stress_level || 0;
    const age = foal.age || 0;

    // Convert age in years to development days for young foals
    const developmentAge = age === 0 ? currentDay : Math.min(currentDay, 6);

    const newTraits = {
      positive: [],
      negative: [],
      hidden: [],
    };

    // Get all currently revealed traits to avoid duplicates
    const existingTraits = new Set([
      ...(currentTraits.positive || []),
      ...(currentTraits.negative || []),
      ...(currentTraits.hidden || []),
    ]);

    // Evaluate positive traits
    for (const [traitKey, traitDef] of Object.entries(TRAIT_DEFINITIONS.positive)) {
      if (existingTraits.has(traitKey)) {
        continue;
      }

      if (shouldRevealTrait(traitDef, bondScore, stressLevel, developmentAge)) {
        if (Math.random() < traitDef.baseChance) {
          // Check for conflicts
          if (!hasTraitConflict(traitKey, existingTraits)) {
            // Determine if trait should be hidden
            const shouldHide = shouldTraitBeHidden(traitDef, bondScore, stressLevel);
            if (shouldHide) {
              newTraits.hidden.push(traitKey);
            } else {
              newTraits.positive.push(traitKey);
            }
            existingTraits.add(traitKey);
            logger.info(
              `[traitEvaluation] Revealed positive trait: ${traitKey} (${shouldHide ? 'hidden' : 'visible'})`,
              `[traitEvaluation] Revealed positive trait: ${traitKey} (${shouldHide ? 'hidden' : 'visible'})`,
            );
          }
        }
      }
    }

    // Evaluate negative traits
    for (const [traitKey, traitDef] of Object.entries(TRAIT_DEFINITIONS.negative)) {
      if (existingTraits.has(traitKey)) {
        continue;
      }

      if (shouldRevealTrait(traitDef, bondScore, stressLevel, developmentAge)) {
        if (Math.random() < traitDef.baseChance) {
          // Check for conflicts
          if (!hasTraitConflict(traitKey, existingTraits)) {
            // Negative traits are usually visible as warnings
            const shouldHide = shouldTraitBeHidden(traitDef, bondScore, stressLevel);
            if (shouldHide) {
              newTraits.hidden.push(traitKey);
            } else {
              newTraits.negative.push(traitKey);
            }
            existingTraits.add(traitKey);
            logger.info(
              `[traitEvaluation] Revealed negative trait: ${traitKey} (${shouldHide ? 'hidden' : 'visible'})`,
              `[traitEvaluation] Revealed negative trait: ${traitKey} (${shouldHide ? 'hidden' : 'visible'})`,
            );
          }
        }
      }
    }

    // Evaluate rare traits
    for (const [traitKey, traitDef] of Object.entries(TRAIT_DEFINITIONS.rare)) {
      if (existingTraits.has(traitKey)) {
        continue;
      }

      if (shouldRevealTrait(traitDef, bondScore, stressLevel, developmentAge)) {
        if (Math.random() < traitDef.baseChance) {
          // Check for conflicts
          if (!hasTraitConflict(traitKey, existingTraits)) {
            // Rare traits are often hidden
            const shouldHide = shouldTraitBeHidden(traitDef, bondScore, stressLevel);
            if (shouldHide || traitDef.rarity === 'legendary') {
              newTraits.hidden.push(traitKey);
            } else {
              newTraits.positive.push(traitKey);
            }
            existingTraits.add(traitKey);
            logger.info(
              `[traitEvaluation] Revealed rare trait: ${traitKey} (${shouldHide ? 'hidden' : 'visible'})`,
              `[traitEvaluation] Revealed rare trait: ${traitKey} (${shouldHide ? 'hidden' : 'visible'})`,
            );
          }
        }
      }
    }

    logger.info(`[traitEvaluation] Evaluation complete. New traits: ${JSON.stringify(newTraits)}`);
    return newTraits;
  } catch (error) {
    logger.error(`[traitEvaluation.evaluateTraitRevelation] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Check if trait revelation conditions are met
 * @param {Object} traitDef - Trait definition
 * @param {number} bondScore - Current bond score
 * @param {number} stressLevel - Current stress level
 * @param {number} developmentAge - Development age in days
 * @returns {boolean} - Whether trait should be revealed
 */
function shouldRevealTrait(traitDef, bondScore, stressLevel, developmentAge) {
  const conditions = traitDef.revealConditions;

  // Check age requirement
  if (developmentAge < conditions.minAge) {
    return false;
  }

  // Check bond score conditions
  if (conditions.minBondScore && bondScore < conditions.minBondScore) {
    return false;
  }
  if (conditions.maxBondScore && bondScore > conditions.maxBondScore) {
    return false;
  }

  // Check stress level conditions
  if (conditions.minStressLevel && stressLevel < conditions.minStressLevel) {
    return false;
  }
  if (conditions.maxStressLevel && stressLevel > conditions.maxStressLevel) {
    return false;
  }

  return true;
}

/**
 * Check if a trait conflicts with existing traits
 * @param {string} traitKey - Trait to check
 * @param {Set} existingTraits - Set of existing trait keys
 * @returns {boolean} - Whether there's a conflict
 */
function hasTraitConflict(traitKey, existingTraits) {
  const conflicts = TRAIT_CONFLICTS[traitKey] || [];
  return conflicts.some(conflictTrait => existingTraits.has(conflictTrait));
}

/**
 * Determine if a trait should be hidden based on conditions
 * @param {Object} traitDef - Trait definition
 * @param {number} bondScore - Current bond score
 * @param {number} stressLevel - Current stress level
 * @returns {boolean} - Whether trait should be hidden
 */
function shouldTraitBeHidden(traitDef, bondScore, stressLevel) {
  // Legendary traits are almost always hidden
  if (traitDef.rarity === 'legendary') {
    return Math.random() < 0.9;
  }

  // Rare traits are often hidden
  if (traitDef.rarity === 'rare') {
    return Math.random() < 0.7;
  }

  // Poor conditions increase chance of traits being hidden
  const conditionScore = bondScore - stressLevel;
  if (conditionScore < 20) {
    return Math.random() < 0.3;
  }

  // Good conditions reduce chance of traits being hidden
  if (conditionScore > 60) {
    return Math.random() < 0.1;
  }

  // Normal conditions
  return Math.random() < 0.2;
}

/**
 * Get trait definition by key
 * @param {string} traitKey - Trait key
 * @returns {Object|null} - Trait definition or null if not found
 */
function getTraitDefinition(traitKey) {
  for (const category of Object.values(TRAIT_DEFINITIONS)) {
    if (category[traitKey]) {
      return category[traitKey];
    }
  }
  return null;
}

/**
 * Get all available traits
 * @returns {Object} - All trait definitions organized by category
 */
function getAllTraitDefinitions() {
  return TRAIT_DEFINITIONS;
}

/**
 * Evaluate epigenetic traits from foal task history at age 1 milestone
 * @param {Object} taskLog - Task completion history: {taskName: count}
 * @param {number} streak - Consecutive days of foal care (default: 0)
 * @returns {string[]} - Array of assigned epigenetic trait names
 */
function evaluateEpigeneticTagsFromFoalTasks(taskLog, streak = 0) {
  try {
    logger.info(
      `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Evaluating traits from task log with streak: ${streak}`,
    );

    const tags = new Set();

    // Handle null or undefined task log
    if (!taskLog || typeof taskLog !== 'object') {
      logger.info(
        '[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] No valid task log provided',
      );
      return [];
    }

    // Calculate streak bonus (burnout immunity bonus)
    const streakBonus = streak >= 7 ? 10 : 0;
    logger.info(
      `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Streak bonus: ${streakBonus} (streak: ${streak})`,
    );

    // First, accumulate trait points from all tasks
    const traitPoints = {};

    for (const [task, count] of Object.entries(taskLog)) {
      const map = TASK_TRAIT_INFLUENCE_MAP[task];

      // Skip tasks not in influence map or with zero/negative counts
      if (!map || typeof count !== 'number' || count <= 0) {
        continue;
      }

      logger.info(
        `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Processing task: ${task}, count: ${count}`,
      );

      // Accumulate points for each influenced trait
      for (const tag of map.traits) {
        const basePoints = count * map.dailyValue;
        traitPoints[tag] = (traitPoints[tag] || 0) + basePoints;

        logger.info(
          `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Accumulated ${basePoints} points for trait: ${tag} (total: ${traitPoints[tag]})`,
        );
      }
    }

    // Then, evaluate each trait for assignment
    for (const [tag, basePoints] of Object.entries(traitPoints)) {
      const totalPoints = basePoints + streakBonus;
      const chance = Math.min(totalPoints, 60); // Cap at 60%

      logger.info(
        `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Trait: ${tag}, base: ${basePoints}, total: ${totalPoints}, chance: ${chance}%`,
      );

      // Roll for trait assignment
      const roll = Math.random() * 100;
      if (roll < chance) {
        tags.add(tag);
        logger.info(
          `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Trait assigned: ${tag} (rolled: ${roll.toFixed(2)})`,
        );
      } else {
        logger.info(
          `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Trait not assigned: ${tag} (rolled: ${roll.toFixed(2)})`,
        );
      }
    }

    const result = Array.from(tags);
    logger.info(
      `[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Final assigned traits: ${JSON.stringify(result)}`,
    );

    return result;
  } catch (error) {
    logger.error(`[traitEvaluation.evaluateEpigeneticTagsFromFoalTasks] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Apply trait influence from groom interaction
 *
 * @param {Object} horse - Horse data with current traits and age
 * @param {string} taskType - Type of grooming task performed
 * @param {Object} currentTraitInfluences - Current trait influence scores
 * @returns {Object} Updated trait influences and any new permanent traits
 */
function applyGroomTraitInfluence(horse, taskType, currentTraitInfluences = {}) {
  try {
    logger.info(
      `[traitEvaluation.applyGroomTraitInfluence] Applying trait influence for task: ${taskType}`,
    );

    const influence = getTaskTraitInfluence(taskType);
    if (!influence) {
      logger.warn(
        `[traitEvaluation.applyGroomTraitInfluence] No influence found for task: ${taskType}`,
      );
      return {
        updatedInfluences: currentTraitInfluences,
        newPermanentTraits: [],
        isEpigenetic: false,
      };
    }

    const updatedInfluences = { ...currentTraitInfluences };
    const newPermanentTraits = [];
    const isEpigenetic = horse.age < TRAIT_INFLUENCE_CONFIG.EPIGENETIC_AGE_THRESHOLD;

    // Apply encouraging influences (+1)
    influence.encourages.forEach(trait => {
      updatedInfluences[trait] =
        (updatedInfluences[trait] || 0) + TRAIT_INFLUENCE_CONFIG.ENCOURAGE_VALUE;

      logger.info(
        `[traitEvaluation.applyGroomTraitInfluence] Encouraged trait: ${trait}, new score: ${updatedInfluences[trait]}`,
      );

      // Check for permanence threshold
      if (updatedInfluences[trait] >= TRAIT_INFLUENCE_CONFIG.PERMANENCE_THRESHOLD) {
        newPermanentTraits.push({
          name: trait,
          type: 'positive',
          epigenetic: isEpigenetic,
          source: 'groom_interaction',
          taskType,
        });
        logger.info(
          `[traitEvaluation.applyGroomTraitInfluence] Trait ${trait} became permanent (positive, epigenetic: ${isEpigenetic})`,
        );
      }
    });

    // Apply discouraging influences (-1)
    influence.discourages.forEach(trait => {
      updatedInfluences[trait] =
        (updatedInfluences[trait] || 0) + TRAIT_INFLUENCE_CONFIG.DISCOURAGE_VALUE;

      logger.info(
        `[traitEvaluation.applyGroomTraitInfluence] Discouraged trait: ${trait}, new score: ${updatedInfluences[trait]}`,
      );

      // Check for negative permanence threshold
      if (updatedInfluences[trait] <= TRAIT_INFLUENCE_CONFIG.NEGATIVE_PERMANENCE_THRESHOLD) {
        newPermanentTraits.push({
          name: trait,
          type: 'negative_resistance',
          epigenetic: isEpigenetic,
          source: 'groom_interaction',
          taskType,
        });
        logger.info(
          `[traitEvaluation.applyGroomTraitInfluence] Trait ${trait} became permanently discouraged (epigenetic: ${isEpigenetic})`,
        );
      }
    });

    return {
      updatedInfluences,
      newPermanentTraits,
      isEpigenetic,
    };
  } catch (error) {
    logger.error(`[traitEvaluation.applyGroomTraitInfluence] Error: ${error.message}`);
    throw error;
  }
}

export {
  evaluateTraitRevelation,
  evaluateEpigeneticTagsFromFoalTasks,
  getTraitDefinition,
  getAllTraitDefinitions,
  applyGroomTraitInfluence,
  TRAIT_DEFINITIONS,
  TRAIT_CONFLICTS,
};
