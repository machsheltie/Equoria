/**
 * @fileoverview Groom Personality Effects System for Enhanced Task Performance
 *
 * @description
 * Comprehensive personality-based effects system for grooms that provides task-specific
 * bonuses, trait influence modifications, and specialized interactions based on groom
 * personality types. Integrates with the existing groom system to provide dynamic
 * personality-driven effects during grooming and enrichment activities.
 *
 * @features
 * - Task-specific personality bonuses and penalties
 * - Dynamic success rate modifications based on horse traits
 * - Streak growth and bonding rate adjustments
 * - Burnout risk modifications for high-energy personalities
 * - Trait influence amplification for specific personality-task combinations
 * - Integration with existing groom interaction system
 * - Comprehensive personality effect calculations
 *
 * @dependencies
 * - groomSystem: Core groom interaction and calculation system
 * - taskTraitInfluenceMap: Task-to-trait influence mapping
 * - logger: Winston logger for personality effect tracking
 *
 * @usage
 * Imported by groom interaction system to apply personality-based modifications
 * to task outcomes, bonding effects, and trait influences during grooming sessions.
 *
 * @author Equoria Development Team
 * @since 1.2.0
 * @lastModified 2025-01-02 - Initial groom personality effects implementation
 */

import logger from './logger.mjs';

/**
 * Comprehensive groom personality effects configuration
 *
 * Each personality type defines:
 * - bonusTasks: Tasks where this personality excels
 * - effect: Description of the personality's special abilities
 * - successRateModifier: Base success rate modification
 * - bondingModifier: Bonding rate modification
 * - stressReductionModifier: Stress reduction effectiveness
 * - streakGrowthModifier: Consecutive days streak growth rate
 * - burnoutRiskModifier: Burnout risk modification
 * - traitInfluenceModifier: Trait development influence modification
 * - specialConditions: Special conditions for enhanced effects
 */
export const GROOM_PERSONALITY_EFFECTS = {
  gentle: {
    bonusTasks: ['brushing', 'stall_care', 'early_touch', 'quiet_bonding'],
    effect: '10% increased success rate on nervous or timid horses',
    successRateModifier: 1.1,
    bondingModifier: 1.2,
    stressReductionModifier: 1.4,
    streakGrowthModifier: 1.0,
    burnoutRiskModifier: 0.8,
    traitInfluenceModifier: 1.0,
    specialConditions: {
      horseTraits: ['nervous', 'timid', 'anxious', 'fearful'],
      bonusSuccessRate: 0.1,
      bonusDescription: 'Calms nervous horses effectively',
    },
  },

  playful: {
    bonusTasks: ['grooming_game', 'socialization', 'water_play', 'treat_training'],
    effect: 'Better bonding with foals; 15% faster streak gain',
    successRateModifier: 1.0,
    bondingModifier: 1.3,
    stressReductionModifier: 1.1,
    streakGrowthModifier: 1.15,
    burnoutRiskModifier: 0.9,
    traitInfluenceModifier: 1.2,
    specialConditions: {
      ageRange: [0, 1095], // 0-3 years (foals and young horses)
      bonusBonding: 0.2,
      bonusDescription: 'Exceptional with young horses and foals',
    },
  },

  firm: {
    bonusTasks: ['hand_walking', 'obstacle_course', 'leading_practice', 'boundary_setting'],
    effect: 'Increased trait influence for stubborn or independent horses',
    successRateModifier: 1.05,
    bondingModifier: 0.9,
    stressReductionModifier: 0.9,
    streakGrowthModifier: 1.0,
    burnoutRiskModifier: 1.0,
    traitInfluenceModifier: 1.3,
    specialConditions: {
      horseTraits: ['stubborn', 'independent', 'pushy', 'resistant'],
      bonusTraitInfluence: 0.5,
      bonusDescription: 'Effectively manages difficult personalities',
    },
  },

  patient: {
    bonusTasks: ['puddle_training', 'tarp_desensitization', 'hoof_handling', 'patience_training'],
    effect: 'Reduces burnout risk and failure chance on enrichment tasks',
    successRateModifier: 1.15,
    bondingModifier: 1.3,
    stressReductionModifier: 1.2,
    streakGrowthModifier: 1.05,
    burnoutRiskModifier: 0.6,
    traitInfluenceModifier: 1.1,
    specialConditions: {
      taskCategories: ['enrichment', 'desensitization', 'training'],
      bonusSuccessRate: 0.15,
      bonusDescription: 'Excels at challenging enrichment activities',
    },
  },

  high_energy: {
    bonusTasks: ['obstacle_course', 'hand_walking', 'fitness_work', 'emergency_handling'],
    effect: 'Extra trait point on success, but 20% higher burnout risk',
    successRateModifier: 1.1,
    bondingModifier: 1.1,
    stressReductionModifier: 0.8,
    streakGrowthModifier: 1.2,
    burnoutRiskModifier: 1.2,
    traitInfluenceModifier: 1.4,
    specialConditions: {
      extraTraitPoints: true,
      bonusTraitInfluence: 1.0,
      bonusDescription: 'Provides intense, effective sessions with higher risk',
    },
  },

  aloof: {
    penalty: true,
    bonusTasks: [],
    effect: 'No bonuses; 10% lower streak growth and slower bonding',
    successRateModifier: 0.9,
    bondingModifier: 0.8,
    stressReductionModifier: 0.9,
    streakGrowthModifier: 0.9,
    burnoutRiskModifier: 1.1,
    traitInfluenceModifier: 0.8,
    specialConditions: {
      penalty: true,
      bonusDescription: 'Provides minimal engagement and slower progress',
    },
  },
};

/**
 * Calculate personality-based effects for a groom interaction
 *
 * @param {Object} groom - Groom object with personality
 * @param {Object} horse - Horse object with traits and age
 * @param {string} taskType - Type of grooming/enrichment task
 * @param {Object} baseEffects - Base interaction effects before personality modification
 * @returns {Object} Modified effects with personality bonuses applied
 */
export function calculatePersonalityEffects(groom, horse, taskType, baseEffects) {
  try {
    const personality = groom.personality;
    const personalityConfig = GROOM_PERSONALITY_EFFECTS[personality];

    if (!personalityConfig) {
      logger.warn(
        `[groomPersonalityEffects.calculatePersonalityEffects] Unknown personality: ${personality}`,
      );
      return baseEffects;
    }

    logger.info(
      `[groomPersonalityEffects.calculatePersonalityEffects] Applying ${personality} personality effects for task ${taskType}`,
    );

    // Start with base effects
    const modifiedEffects = { ...baseEffects };
    const personalityBonuses = {
      taskBonus: false,
      specialConditionMet: false,
      bonusesApplied: [],
    };

    // Check if this is a bonus task for the personality
    const isTaskBonus = personalityConfig.bonusTasks.includes(taskType);
    if (isTaskBonus) {
      personalityBonuses.taskBonus = true;
      personalityBonuses.bonusesApplied.push('task_specialty');
    }

    // Apply base personality modifiers
    modifiedEffects.bondingChange = Math.round(
      modifiedEffects.bondingChange * personalityConfig.bondingModifier,
    );
    modifiedEffects.stressChange = Math.round(
      modifiedEffects.stressChange * personalityConfig.stressReductionModifier,
    );

    // Apply success rate modifications
    const baseSuccessRate = modifiedEffects.successRate || 0.85;
    modifiedEffects.successRate = Math.min(
      0.99,
      baseSuccessRate * personalityConfig.successRateModifier,
    );

    // Check and apply special conditions
    const specialConditions = personalityConfig.specialConditions;
    if (specialConditions) {
      // Horse trait-based bonuses
      if (specialConditions.horseTraits && horse.traits) {
        const hasMatchingTrait = horse.traits.some(trait =>
          specialConditions.horseTraits.includes(trait.name || trait),
        );

        if (hasMatchingTrait) {
          personalityBonuses.specialConditionMet = true;
          personalityBonuses.bonusesApplied.push('trait_match');

          if (specialConditions.bonusSuccessRate) {
            modifiedEffects.successRate = Math.min(
              0.99,
              modifiedEffects.successRate + specialConditions.bonusSuccessRate,
            );
          }

          if (specialConditions.bonusBonding) {
            modifiedEffects.bondingChange += Math.round(
              modifiedEffects.bondingChange * specialConditions.bonusBonding,
            );
          }
        }
      }

      // Age-based bonuses (for playful personality with foals)
      if (specialConditions.ageRange && horse.age) {
        const [minAge, maxAge] = specialConditions.ageRange;
        if (horse.age >= minAge && horse.age <= maxAge) {
          personalityBonuses.specialConditionMet = true;
          personalityBonuses.bonusesApplied.push('age_match');

          if (specialConditions.bonusBonding) {
            modifiedEffects.bondingChange += Math.round(
              modifiedEffects.bondingChange * specialConditions.bonusBonding,
            );
          }
        }
      }

      // Task category bonuses (for patient personality with enrichment)
      if (specialConditions.taskCategories) {
        const taskCategory = categorizeTaskForPersonality(taskType);
        if (specialConditions.taskCategories.includes(taskCategory)) {
          personalityBonuses.specialConditionMet = true;
          personalityBonuses.bonusesApplied.push('category_match');

          if (specialConditions.bonusSuccessRate) {
            modifiedEffects.successRate = Math.min(
              0.99,
              modifiedEffects.successRate + specialConditions.bonusSuccessRate,
            );
          }
        }
      }
    }

    // Apply trait influence modifications
    if (modifiedEffects.traitInfluence !== undefined) {
      modifiedEffects.traitInfluence = Math.round(
        modifiedEffects.traitInfluence * personalityConfig.traitInfluenceModifier,
      );

      // High-energy personality gets extra trait points on success
      if (personality === 'high_energy' && specialConditions?.extraTraitPoints) {
        modifiedEffects.traitInfluence += 1;
        personalityBonuses.bonusesApplied.push('extra_trait_points');
      }
    }

    // Apply streak growth modifications
    if (modifiedEffects.streakGrowth !== undefined) {
      modifiedEffects.streakGrowth = Math.round(
        modifiedEffects.streakGrowth * personalityConfig.streakGrowthModifier,
      );
    }

    // Apply burnout risk modifications
    if (modifiedEffects.burnoutRisk !== undefined) {
      modifiedEffects.burnoutRisk = Math.max(
        0,
        modifiedEffects.burnoutRisk * personalityConfig.burnoutRiskModifier,
      );
    }

    // Add personality effect summary
    modifiedEffects.personalityEffects = {
      personality,
      bonusesApplied: personalityBonuses.bonusesApplied,
      taskBonus: personalityBonuses.taskBonus,
      specialConditionMet: personalityBonuses.specialConditionMet,
      description: personalityConfig.effect,
    };

    logger.info(
      `[groomPersonalityEffects.calculatePersonalityEffects] Applied ${personality} effects: ${personalityBonuses.bonusesApplied.join(', ')}`,
    );

    return modifiedEffects;
  } catch (error) {
    logger.error(`[groomPersonalityEffects.calculatePersonalityEffects] Error: ${error.message}`);
    return baseEffects;
  }
}

/**
 * Categorize a task for personality effect matching
 *
 * @param {string} taskType - Type of task
 * @returns {string} Task category
 */
function categorizeTaskForPersonality(taskType) {
  const enrichmentTasks = [
    'puddle_training',
    'tarp_desensitization',
    'obstacle_course',
    'desensitization',
    'showground_exposure',
    'trust_building',
  ];

  const trainingTasks = [
    'leading_practice',
    'voice_commands',
    'patience_training',
    'boundary_setting',
    'emergency_handling',
  ];

  const groomingTasks = [
    'brushing',
    'stall_care',
    'early_touch',
    'hoof_handling',
    'tying_practice',
    'quiet_bonding',
  ];

  if (enrichmentTasks.includes(taskType)) return 'enrichment';
  if (trainingTasks.includes(taskType)) return 'training';
  if (groomingTasks.includes(taskType)) return 'grooming';

  return 'general';
}

/**
 * Get personality effect summary for a specific groom and task combination
 *
 * @param {string} personality - Groom personality type
 * @param {string} taskType - Type of task
 * @returns {Object} Summary of expected effects
 */
export function getPersonalityEffectSummary(personality, taskType) {
  const personalityConfig = GROOM_PERSONALITY_EFFECTS[personality];

  if (!personalityConfig) {
    return {
      hasEffect: false,
      description: 'Unknown personality type',
    };
  }

  const isTaskBonus = personalityConfig.bonusTasks.includes(taskType);

  return {
    hasEffect: true,
    personality,
    taskBonus: isTaskBonus,
    effect: personalityConfig.effect,
    modifiers: {
      bonding: personalityConfig.bondingModifier,
      stressReduction: personalityConfig.stressReductionModifier,
      successRate: personalityConfig.successRateModifier,
      streakGrowth: personalityConfig.streakGrowthModifier,
      burnoutRisk: personalityConfig.burnoutRiskModifier,
      traitInfluence: personalityConfig.traitInfluenceModifier,
    },
    specialConditions: personalityConfig.specialConditions,
  };
}

/**
 * Get all available personality types and their descriptions
 *
 * @returns {Object} All personality types with descriptions
 */
export function getAllPersonalityTypes() {
  return Object.entries(GROOM_PERSONALITY_EFFECTS).map(([key, config]) => ({
    type: key,
    name: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
    effect: config.effect,
    bonusTasks: config.bonusTasks,
    isPenalty: config.penalty || false,
  }));
}

export default GROOM_PERSONALITY_EFFECTS;
