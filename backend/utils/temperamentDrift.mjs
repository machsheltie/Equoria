/**
 * Temperament Drift System
 * Handles gradual changes in horse temperament over time
 * Can be suppressed by certain traits like 'resilient' and 'calm'
 */

import { getCombinedTraitEffects } from './traitEffects.mjs';
import logger from './logger.mjs';

/**
 * Available temperament types and their characteristics
 */
const TEMPERAMENT_TYPES = {
  Calm: {
    stability: 0.9,
    stressResistance: 0.8,
    trainingBonus: 0.1,
    competitionPenalty: 0.0,
  },
  Spirited: {
    stability: 0.6,
    stressResistance: 0.4,
    trainingBonus: 0.15,
    competitionPenalty: 0.05,
  },
  Nervous: {
    stability: 0.4,
    stressResistance: 0.2,
    trainingBonus: -0.1,
    competitionPenalty: 0.15,
  },
  Aggressive: {
    stability: 0.5,
    stressResistance: 0.6,
    trainingBonus: 0.05,
    competitionPenalty: 0.1,
  },
  Docile: {
    stability: 0.8,
    stressResistance: 0.7,
    trainingBonus: 0.05,
    competitionPenalty: -0.05,
  },
  Unpredictable: {
    stability: 0.3,
    stressResistance: 0.3,
    trainingBonus: 0.0,
    competitionPenalty: 0.2,
  },
};

/**
 * Calculate temperament drift based on various factors
 * @param {Object} horse - Horse object with current temperament and traits
 * @param {Object} factors - Environmental factors affecting drift
 * @returns {Object} Drift calculation results
 */
export function calculateTemperamentDrift(horse, factors = {}) {
  try {
    logger.debug(
      `[temperamentDrift] Calculating drift for horse ${horse.id} with temperament ${horse.temperament}`,
    );

    // Get trait effects
    const traits = horse.epigenetic_modifiers || { positive: [], negative: [], hidden: [] };
    const allTraits = [...(traits.positive || []), ...(traits.negative || [])];
    const traitEffects = getCombinedTraitEffects(allTraits);

    // Check if temperament drift is suppressed by traits
    if (traitEffects.suppressTemperamentDrift) {
      logger.info(
        `[temperamentDrift] Temperament drift suppressed by traits for horse ${horse.id}`,
      );
      return {
        driftOccurred: false,
        newTemperament: horse.temperament,
        reason: 'Suppressed by traits',
        suppressingTraits: allTraits.filter(trait => ['resilient', 'calm'].includes(trait)),
      };
    }

    // Base drift probability (5% per calculation)
    let driftProbability = 0.05;

    // Environmental factors that increase drift probability
    const {
      stressLevel = horse.stress_level || 0,
      recentTraining = false,
      recentCompetition = false,
      healthStatus = horse.health_status || 'Good',
      bondScore = horse.bond_score || 50,
      age = horse.age || 1,
    } = factors;

    // Stress increases drift probability
    if (stressLevel > 50) {
      driftProbability += (stressLevel - 50) * 0.001; // +0.1% per stress point above 50
    }

    // Recent activities can trigger drift
    if (recentTraining) {
      driftProbability += 0.02; // +2% for recent training
    }

    if (recentCompetition) {
      driftProbability += 0.03; // +3% for recent competition
    }

    // Poor health increases drift
    if (healthStatus === 'Fair' || healthStatus === 'Bad') {
      driftProbability += 0.02; // +2% for poor health
    }

    // Low bond score increases drift
    if (bondScore < 30) {
      driftProbability += 0.03; // +3% for low bond
    }

    // Young horses are more susceptible to drift
    if (age < 2) {
      driftProbability += 0.02; // +2% for young horses
    }

    // Current temperament affects stability
    const currentTempData = TEMPERAMENT_TYPES[horse.temperament] || TEMPERAMENT_TYPES['Calm'];
    driftProbability *= 1 - currentTempData.stability;

    // Apply trait effects that might reduce drift probability
    if (traitEffects.temperamentStability) {
      driftProbability *= 0.5; // 50% reduction from stability traits
    }

    // Cap probability at 25%
    driftProbability = Math.min(0.25, driftProbability);

    logger.debug(
      `[temperamentDrift] Final drift probability: ${(driftProbability * 100).toFixed(2)}%`,
    );

    // Roll for drift
    if (Math.random() > driftProbability) {
      return {
        driftOccurred: false,
        newTemperament: horse.temperament,
        reason: 'No drift occurred',
        driftProbability,
      };
    }

    // Determine new temperament
    const newTemperament = selectNewTemperament(horse.temperament, factors);

    logger.info(
      `[temperamentDrift] Temperament drift occurred for horse ${horse.id}: ${horse.temperament} -> ${newTemperament}`,
    );

    return {
      driftOccurred: true,
      oldTemperament: horse.temperament,
      newTemperament,
      reason: 'Environmental factors caused drift',
      driftProbability,
      factors: {
        stressLevel,
        recentTraining,
        recentCompetition,
        healthStatus,
        bondScore,
        age,
      },
    };
  } catch (error) {
    logger.error(`[temperamentDrift] Error calculating drift: ${error.message}`);
    return {
      driftOccurred: false,
      newTemperament: horse.temperament,
      reason: 'Error in calculation',
      error: error.message,
    };
  }
}

/**
 * Select a new temperament based on current temperament and factors
 * @param {string} currentTemperament - Current temperament
 * @param {Object} factors - Environmental factors
 * @returns {string} New temperament
 */
function selectNewTemperament(currentTemperament, factors) {
  const temperamentList = Object.keys(TEMPERAMENT_TYPES);

  // Remove current temperament from options
  const availableTemperaments = temperamentList.filter(t => t !== currentTemperament);

  // Weight temperaments based on factors
  const weights = {};

  availableTemperaments.forEach(temperament => {
    weights[temperament] = 1; // Base weight

    // High stress favors nervous/unpredictable temperaments
    if (factors.stressLevel > 70) {
      if (temperament === 'Nervous' || temperament === 'Unpredictable') {
        weights[temperament] += 2;
      }
    }

    // Low bond score favors aggressive/unpredictable
    if (factors.bondScore < 30) {
      if (temperament === 'Aggressive' || temperament === 'Unpredictable') {
        weights[temperament] += 1.5;
      }
    }

    // Good conditions favor calm/docile
    if (factors.stressLevel < 30 && factors.bondScore > 70) {
      if (temperament === 'Calm' || temperament === 'Docile') {
        weights[temperament] += 2;
      }
    }
  });

  // Select weighted random temperament
  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let random = Math.random() * totalWeight;

  for (const [temperament, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return temperament;
    }
  }

  // Fallback to random selection
  return availableTemperaments[Math.floor(Math.random() * availableTemperaments.length)];
}

/**
 * Apply temperament drift to a horse if conditions are met
 * @param {number} horseId - ID of the horse
 * @returns {Object} Result of drift application
 */
export async function applyTemperamentDrift(horseId) {
  try {
    // This would need to be implemented with actual database operations
    // For now, return the calculation result
    logger.info(`[temperamentDrift] Applying temperament drift for horse ${horseId}`);

    // In a real implementation, this would:
    // 1. Fetch horse from database
    // 2. Calculate drift
    // 3. Update horse temperament if drift occurs
    // 4. Log the change

    return {
      success: true,
      message: 'Temperament drift calculation completed',
      horseId,
    };
  } catch (error) {
    logger.error(`[temperamentDrift] Error applying drift: ${error.message}`);
    throw error;
  }
}

/**
 * Get temperament characteristics
 * @param {string} temperament - Temperament name
 * @returns {Object} Temperament characteristics
 */
export function getTemperamentCharacteristics(temperament) {
  return TEMPERAMENT_TYPES[temperament] || TEMPERAMENT_TYPES['Calm'];
}

/**
 * Check if a horse's temperament is stable (resistant to drift)
 * @param {Object} horse - Horse object
 * @returns {boolean} True if temperament is stable
 */
export function isTemperamentStable(horse) {
  const traits = horse.epigenetic_modifiers || { positive: [], negative: [], hidden: [] };
  const allTraits = [...(traits.positive || []), ...(traits.negative || [])];
  const traitEffects = getCombinedTraitEffects(allTraits);

  return !!(traitEffects.suppressTemperamentDrift || traitEffects.temperamentStability);
}
