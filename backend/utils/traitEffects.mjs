/**
 * Trait Effects System
 * Maps each epigenetic trait to its specific game mechanics effects
 * Used throughout training, competition, and display logic
 */

import { logger } from './logger.mjs';

/**
 * Comprehensive trait effects mapping
 * Each trait defines specific game mechanics it affects
 */
const traitEffects = {
  // ===== POSITIVE TRAITS =====

  resilient: {
    // Training effects
    suppressTemperamentDrift: true,
    trainingStressReduction: 0.15, // 15% less stress from training
    trainingConsistencyBonus: 0.1, // 10% more consistent training results

    // Competition effects
    competitionStressResistance: 0.15, // 15% less stress impact in competitions
    competitionScoreModifier: 0.03, // +3% to final competition score

    // Recovery effects
    stressRecoveryRate: 1.25, // 25% faster stress recovery
    injuryRecoveryBonus: 0.2, // 20% faster injury recovery

    // Discipline-specific bonuses
    disciplineModifiers: {
      'Cross Country': 0.05,
      Endurance: 0.06,
      Racing: 0.04,
    },
  },

  calm: {
    // Bonding effects
    bondingBonus: 0.15, // 15% faster bonding
    bondingConsistency: 0.2, // 20% more consistent bonding

    // Training effects
    suppressTemperamentDrift: true,
    trainingStressReduction: 0.2, // 20% less stress from training
    trainingFocusBonus: 0.15, // 15% better focus during training
    trainingConsistencyBonus: 0.15, // 15% more consistent training

    // Competition effects
    competitionStressResistance: 0.25, // 25% less stress impact
    competitionFocusBonus: 0.1, // 10% better focus in competitions
    competitionScoreModifier: 0.025, // +2.5% to final score
    competitionConsistency: 0.15, // 15% more consistent performance

    // General effects
    baseStressReduction: 5, // -5 base stress level
    temperamentStability: true, // Prevents negative temperament changes
    stressRecoveryBonus: 0.15, // 15% faster stress recovery

    // Discipline-specific bonuses
    disciplineModifiers: {
      Dressage: 0.05,
      Driving: 0.04,
      Trail: 0.03,
    },

    description: 'Maintains composure and bonds steadily in all situations',
  },

  bold: {
    // Training effects
    trainingConfidenceBonus: 0.15, // 15% confidence boost during training
    newExperienceAdaptation: 0.25, // 25% faster adaptation to new training

    // Competition effects
    competitionConfidenceBoost: 5, // +5 confidence in competitions
    competitionScoreModifier: 0.035, // +3.5% to final score
    competitionNerveBonus: 0.2, // 20% better performance under pressure

    // General effects
    explorationBonus: true, // Better results from enrichment activities

    // Discipline-specific bonuses
    disciplineModifiers: {
      'Show Jumping': 0.06,
      'Cross Country': 0.05,
      Racing: 0.04,
    },
  },

  intelligent: {
    // Training effects
    trainingXpModifier: 0.25, // 25% more XP from training
    statGainChanceModifier: 0.15, // 15% higher chance of stat gains
    trainingTimeReduction: 0.1, // 10% faster training sessions

    // Competition effects
    competitionScoreModifier: 0.03, // +3% to final score
    learningBonus: 0.25, // 25% faster skill acquisition

    // General effects
    problemSolvingBonus: true, // Better at overcoming obstacles
    memoryBonus: true, // Remembers training better

    // Discipline-specific bonuses
    disciplineModifiers: {
      Dressage: 0.06,
      Reining: 0.05,
      Eventing: 0.04,
    },
  },

  athletic: {
    // Training effects
    physicalTrainingBonus: 0.2, // 20% better results from physical training
    staminaTrainingBonus: 0.25, // 25% better stamina gains

    // Competition effects
    competitionScoreModifier: 0.05, // +5% to final score
    physicalBonus: 0.15, // 15% boost to physical performance
    enduranceBonus: 0.2, // 20% better endurance

    // Stat effects
    baseStatBoost: {
      stamina: 2,
      agility: 2,
      balance: 1,
    },

    // Discipline-specific bonuses
    disciplineModifiers: {
      Racing: 0.07,
      'Show Jumping': 0.06,
      'Cross Country': 0.06,
    },
  },

  trainability_boost: {
    // Training effects
    trainingXpModifier: 0.3, // 30% more XP from training
    statGainChanceModifier: 0.2, // 20% higher chance of stat gains
    trainingSuccessRate: 0.25, // 25% higher training success rate

    // Competition effects
    competitionScoreModifier: 0.04, // +4% to final score
    consistencyBonus: 0.3, // 30% more consistent performance

    // General effects
    learningAcceleration: true, // Learns new skills faster
    adaptabilityBonus: true, // Adapts to new situations better

    // Discipline-specific bonuses
    disciplineModifiers: {
      Dressage: 0.07,
      Reining: 0.06,
      Driving: 0.05,
    },
  },

  eager_learner: {
    // Training effects
    trainingXpModifier: 0.25, // 25% more XP from training
    statGainChanceModifier: 0.1, // +10% chance for stat gains
    baseStatBoost: 1, // +1 to stat gains when they occur

    // Competition effects
    competitionScoreModifier: 0.02, // +2% to final score
    learningFromCompetition: 0.15, // 15% bonus learning from competitions

    // General effects
    motivationBonus: 0.2, // 20% higher motivation
    trainingConsistencyBonus: 0.15, // 15% more consistent training results

    description: 'Learns quickly and eagerly from all experiences',
  },

  social: {
    // Bonding effects
    bondingBonus: 0.25, // 25% faster bonding
    groomingBondingBonus: 0.3, // 30% bonus from grooming
    trainingBondingBonus: 0.2, // 20% bonus from training

    // Training effects
    groupTrainingBonus: 0.15, // 15% bonus when training with others
    handlerCompatibility: 0.2, // 20% better handler relationships

    // Competition effects
    crowdComfort: 0.1, // 10% less stress from crowds
    competitionSocialBonus: 0.05, // 5% bonus in social competition environments

    // General effects
    stressReduction: 5, // -5 base stress from social interaction
    temperamentStability: true, // More stable temperament

    description: 'Thrives on social interaction and bonds easily',
  },

  specialized_lineage: {
    // Training effects
    trainingXpModifier: 0.15, // 15% more XP from training
    trainingSpecializationBonus: 0.2, // 20% bonus in specialized discipline

    // Competition effects
    competitionScoreModifier: 0.04, // +4% to final score
    disciplineConfidenceBonus: 0.15, // 15% confidence boost in specialized discipline

    // General effects
    learningRate: 1.2, // 20% faster learning in specialized areas
    adaptabilityBonus: 0.1, // 10% better adaptation to new training

    // Note: Discipline-specific bonuses are handled separately based on lineage analysis
    description: 'Benefits from specialized bloodline heritage',
  },

  people_trusting: {
    // Bonding effects
    bondingBonus: 0.3, // 30% faster bonding with humans
    handlerCompatibility: 0.25, // 25% better handler relationships
    groomingBondingBonus: 0.2, // 20% bonus from grooming

    // Training effects
    trainingCooperation: 0.2, // 20% more cooperative during training
    handlerTrustBonus: 0.15, // 15% bonus when working with trusted handlers

    // Competition effects
    crowdComfort: 0.15, // 15% less stress from crowds
    competitionHandlerBonus: 0.1, // 10% bonus with familiar handlers

    // General effects
    stressReduction: 8, // -8 base stress from human interaction
    socialComfort: true, // Comfortable in social situations

    description: 'Naturally trusting and cooperative with humans',
  },

  legacy_talent: {
    // Training effects
    trainingXpModifier: 0.2, // 20% more XP from training
    statGainChanceModifier: 0.15, // 15% higher chance of stat gains
    disciplineInheritanceBonus: 0.25, // 25% bonus in inherited discipline

    // Competition effects
    competitionScoreModifier: 0.06, // +6% to final score
    legacyPressureResistance: 0.2, // 20% resistance to legacy pressure
    competitionConfidenceBoost: 8, // +8 confidence in competitions

    // General effects
    naturalTalent: true, // Natural aptitude for inherited discipline
    prestigeBonus: 0.15, // 15% bonus to prestige gains

    // Breeding effects
    traitInheritanceBonus: 0.2, // 20% better trait inheritance to offspring

    description: 'Inherits exceptional talent from distinguished lineage',
  },

  discipline_affinity_racing: {
    // Training effects
    trainingXpModifier: 0.15, // 15% more XP in racing training
    racingTrainingBonus: 0.25, // 25% bonus to racing-specific training

    // Competition effects
    competitionScoreModifier: 0.08, // +8% to racing competition scores
    racingConfidenceBonus: 0.2, // 20% confidence boost in racing

    // Stat effects
    baseStatBoost: {
      speed: 3,
      stamina: 2,
    },

    // Discipline-specific bonuses
    disciplineModifiers: {
      Racing: 0.12,
    },

    description: 'Natural affinity for racing inherited from lineage',
  },

  discipline_affinity_jumping: {
    // Training effects
    trainingXpModifier: 0.15, // 15% more XP in jumping training
    jumpingTrainingBonus: 0.25, // 25% bonus to jumping-specific training

    // Competition effects
    competitionScoreModifier: 0.08, // +8% to jumping competition scores
    jumpingConfidenceBonus: 0.2, // 20% confidence boost in jumping

    // Stat effects
    baseStatBoost: {
      boldness: 3,
      balance: 2,
    },

    // Discipline-specific bonuses
    disciplineModifiers: {
      'Show Jumping': 0.12,
    },

    description: 'Natural affinity for jumping inherited from lineage',
  },

  discipline_affinity_dressage: {
    // Training effects
    trainingXpModifier: 0.15, // 15% more XP in dressage training
    dressageTrainingBonus: 0.25, // 25% bonus to dressage-specific training

    // Competition effects
    competitionScoreModifier: 0.08, // +8% to dressage competition scores
    dressageConfidenceBonus: 0.2, // 20% confidence boost in dressage

    // Stat effects
    baseStatBoost: {
      obedience: 3,
      flexibility: 2,
    },

    // Discipline-specific bonuses
    disciplineModifiers: {
      Dressage: 0.12,
    },

    description: 'Natural affinity for dressage inherited from lineage',
  },

  // ===== NEGATIVE TRAITS =====

  nervous: {
    // Bonding effects
    bondingPenalty: 0.2, // 20% slower bonding
    bondingInconsistency: 0.25, // 25% more inconsistent bonding

    // Training effects
    trainingStressIncrease: 0.25, // 25% more stress from training
    trainingInconsistency: 0.15, // 15% more inconsistent results

    // Competition effects
    competitionStressRisk: 10, // +10 stress risk in competitions
    competitionScoreModifier: -0.04, // -4% to final score
    competitionNervePenalty: 0.25, // 25% worse under pressure

    // General effects
    stressAccumulation: 1.2, // 20% faster stress accumulation
    temperamentInstability: true, // More prone to temperament changes

    // Discipline-specific penalties
    disciplineModifiers: {
      Racing: -0.06,
      'Show Jumping': -0.05,
      Eventing: -0.04,
    },

    description: 'Struggles with stress and performs inconsistently under pressure',
  },

  antisocial: {
    // Bonding effects
    bondingPenalty: 0.3, // 30% slower bonding
    groomingBondingPenalty: 0.25, // 25% penalty from grooming
    handlerDifficulty: 0.25, // 25% more difficult handler relationships

    // Training effects
    groupTrainingPenalty: 0.2, // 20% penalty when training with others
    isolationPreference: true, // Prefers isolated training

    // Competition effects
    crowdStress: 0.15, // 15% more stress from crowds
    competitionSocialPenalty: 0.08, // 8% penalty in social environments

    // General effects
    stressIncrease: 10, // +10 base stress from social situations
    temperamentInstability: 0.15, // 15% more temperament drift

    description: 'Prefers solitude and struggles with social interaction',
  },

  lazy: {
    // Training effects
    trainingXpModifier: -0.2, // 20% less XP from training
    trainingMotivationPenalty: 0.25, // 25% less motivation
    trainingTimeIncrease: 0.15, // 15% longer training sessions needed

    // Competition effects
    competitionScoreModifier: -0.035, // -3.5% to final score
    endurancePenalty: 0.2, // 20% worse endurance

    // General effects
    activityAvoidance: true, // Avoids strenuous activities
    motivationDecay: 0.1, // 10% faster motivation decay

    // Discipline-specific penalties
    disciplineModifiers: {
      Endurance: -0.08,
      'Cross Country': -0.06,
      Racing: -0.05,
    },
  },

  fragile: {
    // Training effects
    trainingInjuryRisk: 0.3, // 30% higher injury risk from training
    trainingIntensityLimit: 0.2, // 20% lower max training intensity

    // Competition effects
    competitionScoreModifier: -0.035, // -3.5% to final score
    injuryRisk: 0.3, // 30% higher injury risk
    performanceInconsistency: 0.25, // 25% more inconsistent performance

    // Recovery effects
    injuryRecoveryPenalty: 0.3, // 30% slower injury recovery
    stressRecoveryPenalty: 0.15, // 15% slower stress recovery

    // Discipline-specific penalties
    disciplineModifiers: {
      'Cross Country': -0.08,
      'Show Jumping': -0.06,
      Racing: -0.05,
    },
  },

  reactive: {
    // Training effects
    trainingStressIncrease: 0.3, // 30% more stress from training
    trainingUnpredictability: 0.25, // 25% more unpredictable during training
    handlerDifficulty: 0.2, // 20% more difficult for handlers

    // Competition effects
    competitionScoreModifier: -0.05, // -5% to final score
    competitionStressRisk: 15, // +15 stress risk in competitions
    crowdReactivity: 0.3, // 30% more reactive to crowds
    environmentalSensitivity: 0.25, // 25% more sensitive to environment changes

    // Bonding effects
    bondingInconsistency: 0.3, // 30% more inconsistent bonding
    trustDifficulty: 0.25, // 25% harder to build trust

    // General effects
    stressAccumulation: 1.3, // 30% faster stress accumulation
    temperamentInstability: true, // More prone to temperament changes
    unpredictableBehavior: true, // May react unpredictably

    // Discipline-specific penalties
    disciplineModifiers: {
      Racing: -0.07,
      'Show Jumping': -0.06,
      Eventing: -0.06,
      Dressage: -0.05,
    },

    description: 'Highly reactive to stimuli and prone to stress responses',
  },

  low_immunity: {
    // Health effects
    illnessRisk: 0.4, // 40% higher risk of illness
    illnessRecoveryPenalty: 0.35, // 35% slower recovery from illness
    vaccineEffectiveness: 0.7, // 30% reduced vaccine effectiveness

    // Training effects
    trainingHealthRisk: 0.25, // 25% higher health risk from training
    trainingIntensityLimit: 0.15, // 15% lower max training intensity
    trainingConsistencyPenalty: 0.2, // 20% less consistent training due to health

    // Competition effects
    competitionScoreModifier: -0.04, // -4% to final score
    competitionHealthRisk: 0.3, // 30% higher health risk in competitions
    performanceInconsistency: 0.25, // 25% more inconsistent due to health

    // General effects
    stressFromIllness: 1.25, // 25% more stress when ill
    environmentalSensitivity: 0.2, // 20% more sensitive to environmental factors
    seasonalVulnerability: true, // More vulnerable to seasonal changes

    // Recovery effects
    generalRecoveryPenalty: 0.25, // 25% slower general recovery
    stressRecoveryPenalty: 0.15, // 15% slower stress recovery when ill

    // All disciplines affected due to health concerns
    disciplineModifiers: {
      Racing: -0.05,
      Dressage: -0.03,
      'Show Jumping': -0.04,
      'Cross Country': -0.06,
      Endurance: -0.08,
      Reining: -0.03,
      Driving: -0.03,
      Trail: -0.02,
      Eventing: -0.05,
    },

    description: 'Weakened immune system leading to frequent health issues',
  },

  aggressive: {
    // Training effects
    trainingDifficultyIncrease: 0.25, // 25% harder to train
    trainerSafetyRisk: true, // Risk to trainer safety

    // Competition effects
    competitionScoreModifier: -0.045, // -4.5% to final score
    controlPenalty: 0.35, // 35% harder to control
    disqualificationRisk: 0.15, // 15% chance of disqualification

    // General effects
    socialDifficulty: true, // Harder to handle in groups
    unpredictableBehavior: true, // May act unpredictably

    // Discipline-specific penalties
    disciplineModifiers: {
      Dressage: -0.08,
      Driving: -0.07,
      Trail: -0.06,
    },
  },

  stubborn: {
    // Training effects
    trainingXpModifier: -0.15, // 15% less XP from training
    trainingResistance: 0.3, // 30% more resistance to training
    newSkillPenalty: 0.25, // 25% slower to learn new skills

    // Competition effects
    competitionScoreModifier: -0.03, // -3% to final score
    adaptabilityPenalty: 0.2, // 20% worse at adapting

    // General effects
    commandResistance: true, // Resists commands more often
    routinePreference: true, // Prefers familiar routines

    // Discipline-specific penalties
    disciplineModifiers: {
      Dressage: -0.06,
      Reining: -0.05,
      Eventing: -0.04,
    },
  },

  // ===== RARE TRAITS =====

  legendary_bloodline: {
    // Training effects
    trainingXpModifier: 0.5, // 50% more XP from training
    statGainChanceModifier: 0.3, // 30% higher chance of stat gains
    eliteTrainingAccess: true, // Access to elite training methods

    // Competition effects
    competitionScoreModifier: 0.08, // +8% to final score
    prestigeBonus: true, // Bonus prestige from competitions

    // Stat effects
    baseStatBoost: {
      stamina: 3,
      agility: 3,
      balance: 2,
      focus: 2,
    },

    // Breeding effects
    breedingValueBonus: 0.5, // 50% higher breeding value
    traitInheritanceBonus: 0.25, // 25% better trait inheritance

    // All disciplines benefit
    disciplineModifiers: {
      Racing: 0.1,
      Dressage: 0.08,
      'Show Jumping': 0.08,
      'Cross Country': 0.08,
      Endurance: 0.08,
      Reining: 0.06,
      Driving: 0.06,
      Trail: 0.06,
      Eventing: 0.08,
    },
  },

  burnout: {
    // Training effects
    statGainBlocked: true, // Blocks all stat gains from training
    trainingXpModifier: -0.5, // 50% less XP from training
    trainingMotivationPenalty: 0.5, // 50% less motivation

    // Competition effects
    competitionScoreModifier: -0.1, // -10% to final score
    performanceDecline: 0.3, // 30% performance decline

    // Recovery effects
    extendedRestRequired: true, // Requires extended rest periods
    stressRecoveryPenalty: 0.4, // 40% slower stress recovery

    // General effects
    activityAvoidance: true, // Avoids all strenuous activities
    motivationDecay: 0.25, // 25% faster motivation decay

    // All disciplines affected negatively
    disciplineModifiers: {
      Racing: -0.12,
      Dressage: -0.1,
      'Show Jumping': -0.1,
      'Cross Country': -0.12,
      Endurance: -0.15,
      Reining: -0.08,
      Driving: -0.08,
      Trail: -0.06,
      Eventing: -0.1,
    },
  },
};

/**
 * Get trait effects for a specific trait
 * @param {string} traitName - Name of the trait
 * @returns {Object|null} Trait effects object or null if not found
 */
export function getTraitEffects(traitName) {
  if (!traitName || typeof traitName !== 'string') {
    logger.warn(`[traitEffects.getTraitEffects] Invalid trait name: ${traitName}`);
    return null;
  }

  const effects = traitEffects[traitName];
  if (!effects) {
    logger.warn(`[traitEffects.getTraitEffects] No effects defined for trait: ${traitName}`);
    return null;
  }

  return effects;
}

/**
 * Get all trait effects
 * @returns {Object} Complete trait effects mapping
 */
export function getAllTraitEffects() {
  return traitEffects;
}

/**
 * Check if a trait has a specific effect
 * @param {string} traitName - Name of the trait
 * @param {string} effectName - Name of the effect to check
 * @returns {boolean} Whether the trait has the specified effect
 */
export function hasTraitEffect(traitName, effectName) {
  const effects = getTraitEffects(traitName);
  return effects ? Object.prototype.hasOwnProperty.call(effects, effectName) : false;
}

/**
 * Get trait effects for multiple traits
 * @param {string[]} traitNames - Array of trait names
 * @returns {Object} Combined effects from all traits
 */
export function getCombinedTraitEffects(traitNames) {
  if (!Array.isArray(traitNames)) {
    logger.warn('[traitEffects.getCombinedTraitEffects] Invalid trait names array');
    return {};
  }

  const combinedEffects = {};

  traitNames.forEach(traitName => {
    const effects = getTraitEffects(traitName);
    if (effects) {
      // Merge effects, handling different types appropriately
      Object.keys(effects).forEach(effectKey => {
        if (!combinedEffects[effectKey]) {
          combinedEffects[effectKey] = effects[effectKey];
        } else {
          // Handle combining different effect types
          if (
            typeof effects[effectKey] === 'number' &&
            typeof combinedEffects[effectKey] === 'number'
          ) {
            // Add numeric modifiers
            combinedEffects[effectKey] += effects[effectKey];
          } else if (typeof effects[effectKey] === 'boolean') {
            // Boolean effects - true if any trait has it
            combinedEffects[effectKey] = combinedEffects[effectKey] || effects[effectKey];
          } else if (typeof effects[effectKey] === 'object' && effects[effectKey] !== null) {
            // Merge objects (like disciplineModifiers, baseStatBoost)
            if (
              typeof combinedEffects[effectKey] === 'object' &&
              combinedEffects[effectKey] !== null
            ) {
              // For numeric properties in objects, add them together
              const mergedObject = { ...combinedEffects[effectKey] };
              Object.keys(effects[effectKey]).forEach(subKey => {
                if (
                  typeof effects[effectKey][subKey] === 'number' &&
                  typeof mergedObject[subKey] === 'number'
                ) {
                  mergedObject[subKey] += effects[effectKey][subKey];
                } else {
                  mergedObject[subKey] = effects[effectKey][subKey];
                }
              });
              combinedEffects[effectKey] = mergedObject;
            } else {
              combinedEffects[effectKey] = { ...effects[effectKey] };
            }
          }
        }
      });
    }
  });

  return combinedEffects;
}

export default traitEffects;
