/**
 * Conformation Show Service
 *
 * Handles conformation-based competitions where grooms act as handlers
 * This is a SEPARATE competition system from performance disciplines
 *
 * Scoring breakdown per conformationshows.md:
 * - 60-70% conformation stats
 * - 15-25% groom's show handling skill
 * - 5-10% bond score with groom
 * - 5-10% temperament synergy
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { CONFORMATION_CLASSES } from '../constants/schema.mjs';

// Conformation show configuration per specification
export const CONFORMATION_SHOW_CONFIG = {
  // Scoring weights (per conformationshows.md)
  CONFORMATION_WEIGHT: 0.65,  // 65% - horse's physical conformation (60-70% range)
  HANDLER_WEIGHT: 0.20,       // 20% - groom's show handling skill (15-25% range)
  BOND_WEIGHT: 0.08,          // 8% - bond score with groom (5-10% range)
  TEMPERAMENT_WEIGHT: 0.07,   // 7% - temperament synergy (5-10% range)

  // Minimum days groom must be assigned before show
  MIN_GROOM_ASSIGNMENT_DAYS: 2,

  // Age requirements
  MIN_AGE: 1, // 1 year old minimum
  MAX_AGE: 999, // No maximum age
};

/**
 * Check if a class name is a valid conformation show class
 * @param {string} className - Class name to check
 * @returns {boolean} True if valid conformation class
 */
export function isValidConformationClass(className) {
  return Object.values(CONFORMATION_CLASSES).includes(className);
}

/**
 * Calculate conformation score from horse's conformation regions
 * @param {Object} conformationScores - Horse's conformation scores object
 * @returns {number} Weighted conformation score (0-100)
 */
export function calculateConformationScore(conformationScores) {
  try {
    if (!conformationScores || typeof conformationScores !== 'object') {
      logger.warn('[conformationShowService] Invalid conformation scores, using default');
      return 20; // Default score
    }

    const regions = {
      head: 0.15,        // 15% - Head and facial features
      neck: 0.12,        // 12% - Neck set and length
      shoulders: 0.13,   // 13% - Shoulder angle and slope
      back: 0.15,        // 15% - Back length and strength
      legs: 0.18,        // 18% - Leg conformation and soundness
      hooves: 0.10,      // 10% - Hoof quality and shape
      topline: 0.12,     // 12% - Topline and muscle development
      hindquarters: 0.05, // 5% - Hip and hindquarter development
    };

    let totalScore = 0;
    for (const [region, weight] of Object.entries(regions)) {
      const regionScore = conformationScores[region] || 20; // Default to 20 if missing
      totalScore += regionScore * weight;
    }

    return Math.round(totalScore * 10) / 10; // Round to 1 decimal place
  } catch (error) {
    logger.error(`[conformationShowService] Error calculating conformation score: ${error.message}`);
    return 20;
  }
}

/**
 * Calculate handler effectiveness for conformation shows
 * @param {Object} groom - Groom object
 * @returns {Object} Handler effectiveness calculation
 */
export function calculateHandlerEffectiveness(groom) {
  try {
    const skillBonuses = {
      novice: { base: 0.70, max: 0.85 },
      intermediate: { base: 0.80, max: 0.95 },
      expert: { base: 0.90, max: 1.05 },
      master: { base: 1.00, max: 1.15 },
    };

    const skillConfig = skillBonuses[groom.skillLevel] || skillBonuses.novice;
    let effectiveness = skillConfig.base;

    // Experience bonus (up to max effectiveness)
    const experienceBonus = Math.min(
      (groom.experience || 0) * 0.01, // 1% per experience point
      skillConfig.max - skillConfig.base,
    );
    effectiveness += experienceBonus;

    // Specialty bonus for show handling
    if (groom.speciality === 'showHandling') {
      effectiveness += 0.05; // 5% bonus
    }

    // Cap at maximum for skill level
    effectiveness = Math.min(effectiveness, skillConfig.max);

    return {
      effectiveness,
      baseEffectiveness: skillConfig.base,
      experienceBonus,
      specialtyBonus: groom.speciality === 'showHandling' ? 0.05 : 0,
      maxPossible: skillConfig.max,
    };

  } catch (error) {
    logger.error(`[conformationShowService] Error calculating handler effectiveness: ${error.message}`);
    return {
      effectiveness: 0.70,
      baseEffectiveness: 0.70,
      experienceBonus: 0,
      specialtyBonus: 0,
      maxPossible: 0.85,
    };
  }
}

/**
 * Calculate temperament synergy between horse and groom
 * @param {Object} horse - Horse object with temperament
 * @param {Object} groom - Groom object with personality
 * @returns {Object} Temperament synergy calculation
 */
export function calculateTemperamentSynergy(horse, groom) {
  try {
    const temperament = horse.temperament || 'calm';
    const personality = groom.personality || 'gentle';

    const synergyConfig = {
      calm: {
        beneficial: ['gentle', 'patient', 'calm'],
        detrimental: ['energetic', 'strict'],
        bonus: 0.10,
      },
      spirited: {
        beneficial: ['energetic', 'confident', 'strict'],
        detrimental: ['gentle', 'patient'],
        bonus: 0.12,
      },
      nervous: {
        beneficial: ['gentle', 'patient', 'calm'],
        detrimental: ['energetic', 'strict', 'confident'],
        bonus: 0.15,
      },
      aggressive: {
        beneficial: ['strict', 'confident'],
        detrimental: ['gentle', 'patient'],
        bonus: 0.08,
      },
    };

    let synergyScore = 0.5; // Neutral baseline (50%)
    let synergyType = 'neutral';

    const config = synergyConfig[temperament];
    if (config) {
      if (config.beneficial.includes(personality)) {
        synergyScore = 1.0 + config.bonus; // Positive synergy
        synergyType = 'beneficial';
      } else if (config.detrimental.includes(personality)) {
        synergyScore = Math.max(0.3, 1.0 - config.bonus); // Negative synergy (min 30%)
        synergyType = 'detrimental';
      } else {
        synergyScore = 0.8; // Neutral but not ideal
        synergyType = 'neutral';
      }
    }

    return {
      synergyScore,
      synergyType,
      temperament,
      personality,
    };
  } catch (error) {
    logger.error(`[conformationShowService] Error calculating temperament synergy: ${error.message}`);
    return {
      synergyScore: 0.5,
      synergyType: 'neutral',
      temperament: 'unknown',
      personality: 'unknown',
    };
  }
}

/**
 * Calculate final conformation show score
 * @param {Object} horse - Horse object with conformation scores
 * @param {Object} groom - Groom handler object
 * @param {string} className - Conformation class name
 * @returns {Object} Complete scoring breakdown
 */
export function calculateConformationShowScore(horse, groom, className) {
  try {
    if (!isValidConformationClass(className)) {
      throw new Error(`${className} is not a valid conformation show class`);
    }

    // 1. Calculate conformation component (65%)
    const conformationScore = calculateConformationScore(horse.conformationScores);
    const conformationComponent = conformationScore * CONFORMATION_SHOW_CONFIG.CONFORMATION_WEIGHT;

    // 2. Calculate handler component (20%)
    const handlerEffectiveness = calculateHandlerEffectiveness(groom);
    const handlerComponent = 100 * handlerEffectiveness.effectiveness * CONFORMATION_SHOW_CONFIG.HANDLER_WEIGHT;

    // 3. Calculate temperament synergy component (7%)
    const temperamentSynergy = calculateTemperamentSynergy(horse, groom);
    const temperamentComponent = 100 * temperamentSynergy.synergyScore * CONFORMATION_SHOW_CONFIG.TEMPERAMENT_WEIGHT;

    // 4. Calculate bond component (8%)
    const bondScore = horse.bondScore || 0;
    const bondMultiplier = 0.5 + (bondScore / 100 * 0.7); // 0.5-1.2 range
    const bondComponent = 100 * bondMultiplier * CONFORMATION_SHOW_CONFIG.BOND_WEIGHT;

    // 5. Calculate final score
    const baseScore = conformationComponent + handlerComponent + temperamentComponent + bondComponent;

    // Add small random factor for competition variability (±2%)
    const randomFactor = 0.98 + (Math.random() * 0.04); // 0.98 to 1.02
    const finalScore = Math.max(0, Math.min(100, baseScore * randomFactor));

    logger.info(`[conformationShowService] Conformation show score calculated: ${finalScore.toFixed(1)} for ${horse.name || horse.id} with handler ${groom.name}`);

    return {
      finalScore: Math.round(finalScore * 10) / 10,
      breakdown: {
        conformationScore,
        conformationComponent: Math.round(conformationComponent * 10) / 10,
        handlerComponent: Math.round(handlerComponent * 10) / 10,
        temperamentComponent: Math.round(temperamentComponent * 10) / 10,
        bondComponent: Math.round(bondComponent * 10) / 10,
        randomFactor: Math.round(randomFactor * 1000) / 1000,
      },
      handlerEffectiveness,
      temperamentSynergy,
      bondMultiplier,
      weights: {
        conformation: CONFORMATION_SHOW_CONFIG.CONFORMATION_WEIGHT,
        handler: CONFORMATION_SHOW_CONFIG.HANDLER_WEIGHT,
        temperament: CONFORMATION_SHOW_CONFIG.TEMPERAMENT_WEIGHT,
        bond: CONFORMATION_SHOW_CONFIG.BOND_WEIGHT,
      },
    };

  } catch (error) {
    logger.error(`[conformationShowService] Error calculating conformation show score: ${error.message}`);
    return {
      finalScore: 0,
      breakdown: {
        conformationScore: 0,
        conformationComponent: 0,
        handlerComponent: 0,
        temperamentComponent: 0,
        bondComponent: 0,
        randomFactor: 1.0,
      },
      handlerEffectiveness: { effectiveness: 0 },
      temperamentSynergy: { synergyScore: 0 },
      bondMultiplier: 0,
      weights: CONFORMATION_SHOW_CONFIG,
    };
  }
}

/**
 * Validate conformation show entry requirements
 * @param {Object} horse - Horse object
 * @param {Object} groom - Groom handler object
 * @param {string} className - Conformation class name
 * @param {string} userId - User ID
 * @returns {Object} Validation result
 */
export async function validateConformationEntry(horse, groom, className, userId) {
  try {
    const errors = [];
    const warnings = [];

    // Check if class is valid conformation show
    if (!isValidConformationClass(className)) {
      errors.push(`${className} is not a valid conformation show class`);
    }

    // Check horse ownership
    if (horse.userId !== userId) {
      errors.push('You do not own this horse');
    }

    // Check groom ownership and assignment
    if (groom.userId !== userId) {
      errors.push('You do not own this groom');
    }

    // Check if groom is assigned to horse
    const assignment = await prisma.groomAssignment.findFirst({
      where: {
        groomId: groom.id,
        foalId: horse.id,
        userId,
        isActive: true,
      },
    });

    if (!assignment) {
      errors.push('Groom must be assigned to this horse before entering conformation shows');
    } else {
      // Check assignment duration (must be assigned at least 2 days before)
      const assignmentDate = new Date(assignment.createdAt);
      const daysSinceAssignment = (Date.now() - assignmentDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceAssignment < CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS) {
        errors.push(`Groom must be assigned to horse for at least ${CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS} days before show entry`);
      }
    }

    // Check horse age (conformation shows for 1+ years)
    const age = horse.age || 0;
    if (age < CONFORMATION_SHOW_CONFIG.MIN_AGE) {
      errors.push(`Horse must be at least ${CONFORMATION_SHOW_CONFIG.MIN_AGE} year old for conformation shows`);
    }

    // Check horse health requirements
    if (horse.health !== 'Excellent' && horse.health !== 'Good') {
      errors.push('Horse must be healthy (weekly vet requirement met)');
    }

    // Check for injuries or burnout
    if (horse.stressLevel && horse.stressLevel > 80) {
      warnings.push('Horse has high stress levels - may affect performance');
    }

    // Check conformation scores exist
    if (!horse.conformationScores) {
      warnings.push('Horse has no conformation scores - default scores will be used');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      assignment,
    };

  } catch (error) {
    logger.error(`[conformationShowService] Error validating conformation entry: ${error.message}`);
    return {
      valid: false,
      errors: ['Validation error occurred'],
      warnings: [],
      assignment: null,
    };
  }
}
