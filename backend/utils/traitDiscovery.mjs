/**
 * Trait Discovery Engine
 * Handles the revelation of hidden traits based on specific conditions
 */

import prisma from '../db/index.mjs';
import logger from './logger.mjs';
import { getTraitDefinition } from './epigeneticTraits.mjs';
import { isFoalAge, FOAL_LIMITS } from '../constants/schema.mjs';

/**
 * Discovery conditions that trigger trait revelation
 */
const DISCOVERY_CONDITIONS = {
  // Bonding-based discoveries
  HIGH_BOND: {
    name: 'High Bond',
    condition: horse => (horse.bondScore || horse.bond_score || 0) >= 80,
    description: 'Strong bond formed',
    priority: 'high',
    category: 'bonding',
    revealableTraits: ['loyal', 'trusting', 'calm'],
  },

  EXCELLENT_BOND: {
    name: 'Excellent Bond',
    condition: horse => (horse.bondScore || horse.bond_score || 0) >= 95,
    description: 'Exceptional bond achieved',
    priority: 'legendary',
    category: 'bonding',
    revealableTraits: ['devoted', 'empathetic', 'intuitive'],
  },

  // Stress-based discoveries
  LOW_STRESS: {
    name: 'Low Stress',
    condition: horse => (horse.stressLevel || horse.stress_level || 100) <= 20,
    description: 'Stress levels minimized',
    priority: 'medium',
    category: 'stress',
    revealableTraits: ['calm', 'relaxed', 'confident'],
  },

  MINIMAL_STRESS: {
    name: 'Minimal Stress',
    condition: horse => (horse.stressLevel || horse.stress_level || 100) <= 5,
    description: 'Perfect stress management',
    priority: 'high',
    category: 'stress',
    revealableTraits: ['zen', 'unflappable', 'serene'],
  },

  // Combined conditions
  PERFECT_CARE: {
    name: 'Perfect Care',
    condition: horse => (horse.bondScore || horse.bond_score || 0) >= 80 && (horse.stressLevel || horse.stress_level || 100) <= 20,
    description: 'Perfect care conditions achieved',
    priority: 'legendary',
    category: 'milestones',
    revealableTraits: ['exceptional', 'thriving', 'balanced'],
  },

  // Age-based discoveries
  MATURE_BOND: {
    name: 'Mature Bond',
    condition: horse => horse.age >= 3 && (horse.bondScore || horse.bond_score || 0) >= 70,
    description: 'Mature relationship developed with adult horse',
    priority: 'medium',
    category: 'milestones',
    revealableTraits: ['resilient', 'calm', 'confident', 'bonded'],
  },

  // Training-based discoveries (requires training data)
  CONSISTENT_TRAINING: {
    name: 'Consistent Training',
    condition: async horse => {
      const recentTraining = await prisma.trainingLog.count({
        where: {
          horseId: horse.id,
          trainedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      });
      return recentTraining >= 5;
    },
    description: 'Consistent training regimen maintained',
    priority: 'medium',
    category: 'activities',
    revealableTraits: ['disciplined', 'focused', 'trainable'],
    async: true,
  },
};

/**
 * Enrichment activity-based discovery conditions
 */
const ENRICHMENT_DISCOVERIES = {
  SOCIALIZATION_COMPLETE: {
    activities: ['social_interaction', 'group_play'],
    minCount: 3,
    description: 'Socialization activities completed',
    priority: 'medium',
  },

  MENTAL_STIMULATION_COMPLETE: {
    activities: ['puzzle_feeding', 'obstacle_course'],
    minCount: 2,
    description: 'Mental stimulation activities completed',
    priority: 'high',
  },

  PHYSICAL_DEVELOPMENT_COMPLETE: {
    activities: ['free_exercise', 'controlled_movement'],
    minCount: 4,
    description: 'Physical development activities completed',
    priority: 'medium',
  },

  ALL_ENRICHMENT_COMPLETE: {
    activities: [
      'social_interaction',
      'group_play',
      'puzzle_feeding',
      'obstacle_course',
      'free_exercise',
      'controlled_movement',
    ],
    minCount: 6,
    description: 'All enrichment activities completed',
    priority: 'legendary',
  },
};

/**
 * Main trait revelation function
 * @param {number} horseId - ID of the horse to check
 * @param {Object} options - Options for discovery
 * @param {boolean} options.checkEnrichment - Whether to check enrichment activities
 * @param {boolean} options.forceCheck - Force check even if recently checked
 * @returns {Object} Discovery results
 */
export async function revealTraits(horseId, options = {}) {
  try {
    // Convert horseId to integer if it's a string
    const horseIdInt = typeof horseId === 'string' ? parseInt(horseId, 10) : horseId;

    if (isNaN(horseIdInt)) {
      throw new Error(`Invalid horse ID: ${horseId}`);
    }

    logger.info(`[traitDiscovery.revealTraits] Starting trait discovery for horse ${horseIdInt}`);

    // Get horse data with current traits
    const horse = await prisma.horse.findUnique({
      where: { id: horseIdInt },
      include: {
        breed: true,
        foalActivities: options.checkEnrichment
          ? {
            orderBy: { createdAt: 'desc' },
            take: 20,
          }
          : false,
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseIdInt} not found`);
    }

    // Check if horse is eligible for trait discovery
    // Foals (under 3) can discover any traits, adults (3+) can only discover mature traits
    const isEligibleForTraitDiscovery = isFoalAge(horse.age) || horse.age >= FOAL_LIMITS.ADULT_AGE;

    if (!isEligibleForTraitDiscovery) {
      throw new Error(`Horse with ID ${horseIdInt} is not eligible for trait discovery (age: ${horse.age}).`);
    }

    // Parse current traits - handle both camelCase and snake_case for compatibility
    const currentTraits = horse.epigeneticModifiers || horse.epigenetic_modifiers || { positive: [], negative: [], hidden: [] };
    const hiddenTraits = currentTraits.hidden || [];

    logger.info(
      `[traitDiscovery.revealTraits] Found ${hiddenTraits.length} hidden traits for horse ${horseIdInt}`,
    );

    if (hiddenTraits.length === 0) {
      logger.info(`[traitDiscovery.revealTraits] No hidden traits to reveal for horse ${horseIdInt}`);
      return {
        success: true,
        horseId: horseIdInt,
        horseName: horse.name,
        revealed: [],
        conditions: [],
        conditionsMet: [],
        traitsRevealed: [],
        totalHiddenBefore: 0,
        totalHiddenAfter: 0,
        message: 'No hidden traits available for discovery',
      };
    }

    // Check discovery conditions
    const metConditions = await checkDiscoveryConditions(horse);

    // Check enrichment-based discoveries if requested
    let enrichmentConditions = [];
    if (options.checkEnrichment && horse.foalActivities) {
      enrichmentConditions = checkEnrichmentDiscoveries(horse.foalActivities);
    }

    // Filter conditions based on horse age
    const isAdult = horse.age >= FOAL_LIMITS.ADULT_AGE;
    const ageAppropriateConditions = [...metConditions, ...enrichmentConditions].filter(condition => {
      // Adults (3+) can trigger mature bonds and milestone conditions
      if (isAdult) {
        return condition.name === 'Mature Bond' ||
               condition.category === 'milestones' ||
               condition.category === 'bonding' ||
               condition.category === 'stress';
      }
      // Foals (under 3) can trigger all conditions except mature bond
      return condition.name !== 'Mature Bond';
    });

    const allConditions = ageAppropriateConditions;

    if (allConditions.length === 0) {
      logger.info(`[traitDiscovery.revealTraits] No discovery conditions met for horse ${horseIdInt}`);
      return {
        success: true,
        horseId: horseIdInt,
        horseName: horse.name,
        revealed: [],
        conditions: [],
        conditionsMet: [],
        traitsRevealed: [],
        totalHiddenBefore: hiddenTraits.length,
        totalHiddenAfter: hiddenTraits.length,
        message: 'No discovery conditions currently met',
      };
    }

    // Determine which traits to reveal based on conditions
    const traitsToReveal = selectTraitsToReveal(hiddenTraits, allConditions);

    if (traitsToReveal.length === 0) {
      logger.info(
        `[traitDiscovery.revealTraits] No suitable traits selected for revelation for horse ${horseIdInt}`,
      );
      return {
        success: true,
        horseId: horseIdInt,
        horseName: horse.name,
        revealed: [],
        conditions: allConditions,
        conditionsMet: allConditions,
        traitsRevealed: [],
        totalHiddenBefore: hiddenTraits.length,
        totalHiddenAfter: hiddenTraits.length,
        message: 'Discovery conditions met but no suitable traits found',
      };
    }

    // Update horse traits in database
    const updatedTraits = await updateHorseTraits(horseIdInt, currentTraits, traitsToReveal);

    logger.info(
      `[traitDiscovery.revealTraits] Successfully revealed ${traitsToReveal.length} traits for horse ${horseIdInt}: ${traitsToReveal.join(', ')}`,
    );

    return {
      success: true,
      horseId: horseIdInt,
      horseName: horse.name,
      revealed: traitsToReveal.map(trait => ({
        trait,
        definition: getTraitDefinition(trait),
        discoveryReason: getDiscoveryReason(trait, allConditions),
      })),
      conditions: allConditions,
      conditionsMet: allConditions,
      traitsRevealed: traitsToReveal.map(trait => ({
        trait,
        definition: getTraitDefinition(trait),
        discoveryReason: getDiscoveryReason(trait, allConditions),
      })),
      totalHiddenBefore: hiddenTraits.length,
      totalHiddenAfter: updatedTraits.hidden.length,
      updatedTraits,
      message: `Discovered ${traitsToReveal.length} new trait${traitsToReveal.length > 1 ? 's' : ''}!`,
    };
  } catch (error) {
    logger.error(
      `[traitDiscovery.revealTraits] Error revealing traits for horse ${horseId}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Check which discovery conditions are currently met
 * @param {Object} horse - Horse data
 * @returns {Array} Array of met conditions
 */
async function checkDiscoveryConditions(horse) {
  const metConditions = [];

  for (const [conditionName, condition] of Object.entries(DISCOVERY_CONDITIONS)) {
    try {
      let isMet = false;

      if (condition.async) {
        isMet = await condition.condition(horse);
      } else {
        isMet = condition.condition(horse);
      }

      if (isMet) {
        metConditions.push({
          name: conditionName,
          description: condition.description,
          priority: condition.priority,
          category: condition.category,
          type: 'condition',
        });
      }
    } catch (error) {
      logger.warn(
        `[traitDiscovery.checkDiscoveryConditions] Error checking condition ${conditionName}: ${error.message}`,
      );
    }
  }

  return metConditions;
}

/**
 * Check enrichment-based discovery conditions
 * @param {Array} activities - Foal activities
 * @returns {Array} Array of met enrichment conditions
 */
function checkEnrichmentDiscoveries(activities) {
  const metConditions = [];

  // Count activities by type
  const activityCounts = {};
  activities.forEach(activity => {
    activityCounts[activity.activityType] = (activityCounts[activity.activityType] || 0) + 1;
  });

  for (const [discoveryName, discovery] of Object.entries(ENRICHMENT_DISCOVERIES)) {
    const completedCount = discovery.activities.reduce((count, activityType) => {
      return count + (activityCounts[activityType] || 0);
    }, 0);

    if (completedCount >= discovery.minCount) {
      metConditions.push({
        name: discoveryName,
        description: discovery.description,
        priority: discovery.priority,
        type: 'enrichment',
        completedCount,
        requiredCount: discovery.minCount,
      });
    }
  }

  return metConditions;
}

/**
 * Select which traits to reveal based on met conditions
 * @param {Array} hiddenTraits - Array of hidden trait names
 * @param {Array} conditions - Array of met conditions
 * @returns {Array} Array of trait names to reveal
 */
function selectTraitsToReveal(hiddenTraits, conditions) {
  const traitsToReveal = [];
  const priorityOrder = ['legendary', 'high', 'medium', 'low'];

  // Sort conditions by priority
  const sortedConditions = conditions.sort((a, b) => {
    return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
  });

  // Reveal traits based on condition priority and trait rarity
  for (const condition of sortedConditions) {
    if (traitsToReveal.length >= 3) {
      break;
    } // Limit revelations per check

    const suitableTraits = hiddenTraits.filter(trait => {
      if (traitsToReveal.includes(trait)) {
        return false;
      }

      const traitDef = getTraitDefinition(trait);
      if (!traitDef) {
        return false;
      }

      // Match trait rarity to condition priority
      if (condition.priority === 'legendary' && traitDef.rarity === 'legendary') {
        return true;
      }
      if (condition.priority === 'high' && ['rare', 'legendary'].includes(traitDef.rarity)) {
        return true;
      }
      if (condition.priority === 'medium' && ['common', 'rare'].includes(traitDef.rarity)) {
        return true;
      }

      return traitDef.rarity === 'common';
    });

    if (suitableTraits.length > 0) {
      // Randomly select one suitable trait
      const selectedTrait = suitableTraits[Math.floor(Math.random() * suitableTraits.length)];
      traitsToReveal.push(selectedTrait);
    }
  }

  return traitsToReveal;
}

/**
 * Update horse traits in database
 * @param {number} horseId - Horse ID
 * @param {Object} currentTraits - Current trait structure
 * @param {Array} traitsToReveal - Traits to move from hidden to visible
 * @returns {Object} Updated traits structure
 */
async function updateHorseTraits(horseId, currentTraits, traitsToReveal) {
  const updatedTraits = {
    positive: [...(currentTraits.positive || [])],
    negative: [...(currentTraits.negative || [])],
    hidden: [...(currentTraits.hidden || [])],
  };

  // Move traits from hidden to appropriate visible category
  traitsToReveal.forEach(trait => {
    const traitDef = getTraitDefinition(trait);
    if (traitDef) {
      // Remove from hidden
      updatedTraits.hidden = updatedTraits.hidden.filter(t => t !== trait);

      // Add to appropriate visible category
      if (traitDef.type === 'positive') {
        updatedTraits.positive.push(trait);
      } else {
        updatedTraits.negative.push(trait);
      }
    }
  });

  // Update in database
  await prisma.horse.update({
    where: { id: horseId },
    data: {
      epigeneticModifiers: updatedTraits,
    },
  });

  return updatedTraits;
}

/**
 * Get discovery reason for a trait
 * @param {string} trait - Trait name
 * @param {Array} conditions - Met conditions
 * @returns {string} Discovery reason
 */
function getDiscoveryReason(trait, conditions) {
  const traitDef = getTraitDefinition(trait);
  if (!traitDef) {
    return 'Unknown discovery condition';
  }

  // Find the most relevant condition
  const relevantCondition = conditions.find(condition => {
    if (condition.priority === 'legendary' && traitDef.rarity === 'legendary') {
      return true;
    }
    if (condition.priority === 'high' && ['rare', 'legendary'].includes(traitDef.rarity)) {
      return true;
    }
    return condition.priority === 'medium' || condition.priority === 'low';
  });

  return relevantCondition ? relevantCondition.description : 'Special discovery condition met';
}

/**
 * Batch reveal traits for multiple horses
 * @param {Array} horseIds - Array of horse IDs
 * @param {Object} options - Discovery options
 * @returns {Array} Batch discovery results
 */
export async function batchRevealTraits(horseIds, options = {}) {
  const results = [];

  for (const horseId of horseIds) {
    try {
      const result = await revealTraits(horseId, options);
      results.push({
        horseId: horseId,
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error(`[traitDiscovery.batchRevealTraits] Error for horse ${horseId}:`, error);
      results.push({
        horseId: horseId,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Get discovery progress for a horse
 * @param {number} horseId - Horse ID
 * @returns {Object} Discovery progress information
 */
export async function getDiscoveryProgress(horseId) {
  try {
    // Convert horseId to integer if it's a string
    const horseIdInt = typeof horseId === 'string' ? parseInt(horseId, 10) : horseId;

    if (isNaN(horseIdInt)) {
      throw new Error(`Invalid horse ID: ${horseId}`);
    }

    const horse = await prisma.horse.findUnique({
      where: { id: horseIdInt },
      include: {
        foalDevelopment: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Get traits from epigeneticModifiers JSON field
    const epigeneticModifiers = horse.epigeneticModifiers || { positive: [], negative: [], hidden: [] };
    const hiddenTraits = epigeneticModifiers.hidden || [];
    const visibleTraits = [
      ...(epigeneticModifiers.positive || []),
      ...(epigeneticModifiers.negative || []),
    ];
    const allTraits = [...visibleTraits, ...hiddenTraits];

    const totalPossibleTraits = Object.keys(DISCOVERY_CONDITIONS).length;
    const discoveredTraits = allTraits.length;
    const progressPercentage = Math.round((discoveredTraits / totalPossibleTraits) * 100);

    // Get current stats for condition checking
    const currentStats = {
      bondScore: horse.bondScore || horse.bond_score || 50,
      stressLevel: horse.stressLevel || horse.stress_level || 0,
      developmentDay: horse.foalDevelopment?.currentDay || 0,
    };

    // Check discovery conditions
    const conditions = await checkDiscoveryConditions(horse);

    return {
      horseId: horseIdInt,
      horseName: horse.name,
      discoveredTraits,
      totalPossibleTraits,
      progressPercentage,
      traits: allTraits,
      hiddenTraitsCount: hiddenTraits.length,
      visibleTraitsCount: visibleTraits.length,
      currentStats,
      conditions,
    };
  } catch (error) {
    logger.error(`[traitDiscovery.getDiscoveryProgress] Error for horse ${horseId}:`, error);
    throw error;
  }
}

export {
  DISCOVERY_CONDITIONS,
  ENRICHMENT_DISCOVERIES,
  checkDiscoveryConditions,
  checkEnrichmentDiscoveries,
};
