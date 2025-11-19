/**
 * Groom Handler Service for Competition Integration
 * Manages groom assignments as competition handlers and calculates their impact on performance
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { isValidConformationClass } from './conformationShowService.mjs';

// Handler skill bonuses by skill level
export const HANDLER_SKILL_BONUSES = {
  novice: {
    baseBonus: 0.05,      // 5% base bonus
    maxBonus: 0.10,       // 10% max bonus
    experienceMultiplier: 0.001,  // 0.1% per experience point
  },
  intermediate: {
    baseBonus: 0.08,      // 8% base bonus
    maxBonus: 0.15,       // 15% max bonus
    experienceMultiplier: 0.0015, // 0.15% per experience point
  },
  expert: {
    baseBonus: 0.12,      // 12% base bonus
    maxBonus: 0.20,       // 20% max bonus
    experienceMultiplier: 0.002,  // 0.2% per experience point
  },
  master: {
    baseBonus: 0.15,      // 15% base bonus
    maxBonus: 0.25,       // 25% max bonus
    experienceMultiplier: 0.0025, // 0.25% per experience point
  },
};

// Personality-discipline synergy bonuses
export const PERSONALITY_DISCIPLINE_SYNERGY = {
  gentle: {
    beneficial: ['Dressage', 'Western Pleasure', 'Hunter', 'Saddleseat'],
    bonus: 0.03,  // 3% bonus
  },
  energetic: {
    beneficial: ['Racing', 'Barrel Racing', 'Gymkhana', 'Steeplechase'],
    bonus: 0.04,  // 4% bonus
  },
  patient: {
    beneficial: ['Endurance', 'Combined Driving', 'Obedience Training'],
    bonus: 0.035, // 3.5% bonus
  },
  strict: {
    beneficial: ['Show Jumping', 'Eventing', 'Reining', 'Cutting'],
    bonus: 0.045, // 4.5% bonus
  },
  calm: {
    beneficial: ['Dressage', 'Fine Harness', 'Vaulting'],
    bonus: 0.03,  // 3% bonus
  },
  confident: {
    beneficial: ['Racing', 'Steeplechase', 'Cross Country', 'Polo'],
    bonus: 0.04,  // 4% bonus
  },
};

// Specialty-discipline matching bonuses
export const SPECIALTY_DISCIPLINE_BONUSES = {
  showHandling: {
    disciplines: ['Dressage', 'Show Jumping', 'Hunter', 'Saddleseat', 'Fine Harness'],
    bonus: 0.06,  // 6% bonus
  },
  racing: {
    disciplines: ['Racing', 'Steeplechase', 'Harness Racing'],
    bonus: 0.07,  // 7% bonus
  },
  western: {
    disciplines: ['Western Pleasure', 'Reining', 'Cutting', 'Barrel Racing', 'Roping'],
    bonus: 0.06,  // 6% bonus
  },
  training: {
    disciplines: ['Obedience Training', 'Combined Driving'],
    bonus: 0.05,  // 5% bonus
  },
  foalCare: {
    disciplines: [], // No direct competition bonus, but helps with young horses
    bonus: 0.02,  // 2% general bonus
  },
  general: {
    disciplines: [], // No specific bonus
    bonus: 0.01,  // 1% minimal bonus
  },
};

/**
 * Calculate groom handler performance bonus (ONLY for conformation shows)
 * @param {Object} groom - Groom object with skills and personality
 * @param {Object} horse - Horse object
 * @param {string} classNameOrDiscipline - Conformation class name or discipline
 * @param {Object} assignment - Groom assignment with bond data
 * @returns {Object} Handler performance calculation
 */
export function calculateHandlerBonus(groom, horse, classNameOrDiscipline, _assignment) {
  try {
    // Check if this is a conformation show class
    if (!isValidConformationClass(classNameOrDiscipline)) {
      logger.info(`[groomHandlerService] ${classNameOrDiscipline} is not a conformation show class - no handler bonus applied`);
      return {
        handlerBonus: 0,
        bonusBreakdown: {
          skillBonus: 0,
          experienceBonus: 0,
          personalityBonus: 0,
          specialtyBonus: 0,
          bondBonus: 0,
          totalBonus: 0,
        },
        groomName: groom.name,
        groomSkillLevel: groom.skillLevel,
        groomSpecialty: groom.speciality,
        groomPersonality: groom.personality,
        isConformationShow: false,
      };
    }

    // For conformation shows, return a simple placeholder bonus
    // The actual scoring should be done by conformationShowService
    logger.info(`[groomHandlerService] Conformation show detected: ${classNameOrDiscipline}`);

    return {
      handlerBonus: 0.15, // 15% placeholder bonus for conformation shows
      bonusBreakdown: {
        skillBonus: 0.10,
        experienceBonus: 0.03,
        personalityBonus: 0.02,
        specialtyBonus: 0.00,
        bondBonus: 0.00,
        totalBonus: 0.15,
      },
      groomName: groom.name,
      groomSkillLevel: groom.skillLevel,
      groomSpecialty: groom.speciality,
      groomPersonality: groom.personality,
      isConformationShow: true,
    };

  } catch (error) {
    logger.error(`[groomHandlerService] Error calculating handler bonus: ${error.message}`);
    return {
      handlerBonus: 0,
      bonusBreakdown: {
        skillBonus: 0,
        experienceBonus: 0,
        personalityBonus: 0,
        specialtyBonus: 0,
        bondBonus: 0,
        totalBonus: 0,
      },
      groomName: 'Unknown',
      groomSkillLevel: 'novice',
      groomSpecialty: 'general',
      groomPersonality: 'calm',
    };
  }
}

/**
 * Get assigned handler for a horse in a competition
 * @param {number} horseId - Horse ID
 * @param {string} userId - User ID
 * @returns {Object} Handler assignment data
 */
export async function getAssignedHandler(horseId, userId) {
  try {
    // Find active groom assignment for this horse
    const assignment = await prisma.groomAssignment.findFirst({
      where: {
        foalId: horseId,
        userId,
        isActive: true,
        priority: 1, // Primary assignment only
      },
      include: {
        groom: {
          select: {
            id: true,
            name: true,
            skillLevel: true,
            speciality: true,
            personality: true,
            experience: true,
          },
        },
        foal: {
          select: {
            id: true,
            name: true,
            bondScore: true,
            stressLevel: true,
          },
        },
      },
    });

    if (!assignment) {
      return {
        hasHandler: false,
        assignment: null,
        groom: null,
        horse: null,
      };
    }

    return {
      hasHandler: true,
      assignment,
      groom: assignment.groom,
      horse: assignment.foal,
    };

  } catch (error) {
    logger.error(`[groomHandlerService] Error getting assigned handler: ${error.message}`);
    return {
      hasHandler: false,
      assignment: null,
      groom: null,
      horse: null,
    };
  }
}

/**
 * Validate handler eligibility for competition (ONLY for conformation shows)
 * @param {number} horseId - Horse ID
 * @param {string} userId - User ID
 * @param {string} classNameOrDiscipline - Conformation class name or discipline
 * @returns {Object} Validation result
 */
export async function validateHandlerEligibility(horseId, userId, classNameOrDiscipline) {
  try {
    // Check if this is a conformation show class
    if (!isValidConformationClass(classNameOrDiscipline)) {
      return {
        eligible: true,
        reason: 'Performance competition - no handler required',
        recommendation: `${classNameOrDiscipline} is a performance competition that does not require a groom handler`,
        handlerBonus: 0,
        isConformationShow: false,
      };
    }

    const handlerData = await getAssignedHandler(horseId, userId);

    if (!handlerData.hasHandler) {
      return {
        eligible: false,
        reason: 'No handler assigned',
        recommendation: 'Conformation shows require a groom handler - assign a groom to this horse',
        handlerBonus: 0,
        isConformationShow: true,
      };
    }

    const { groom, horse, assignment } = handlerData;

    // Check if groom is active
    if (!groom || !assignment.isActive) {
      return {
        eligible: false,
        reason: 'Handler is not active',
        recommendation: 'Ensure the assigned groom is active and available',
        handlerBonus: 0,
      };
    }

    // Calculate potential bonus
    const bonusCalculation = calculateHandlerBonus(groom, horse, classNameOrDiscipline, assignment);

    return {
      eligible: true,
      reason: 'Handler is eligible and ready',
      recommendation: `${groom.name} will provide a ${(bonusCalculation.handlerBonus * 100).toFixed(1)}% performance bonus`,
      handlerBonus: bonusCalculation.handlerBonus,
      bonusBreakdown: bonusCalculation.bonusBreakdown,
      groom,
      assignment,
    };

  } catch (error) {
    logger.error(`[groomHandlerService] Error validating handler eligibility: ${error.message}`);
    return {
      eligible: false,
      reason: 'Validation error occurred',
      recommendation: 'Please try again or contact support',
      handlerBonus: 0,
    };
  }
}

/**
 * Record handler performance in competition
 * @param {Object} competitionResult - Competition result data
 * @param {Object} handlerData - Handler performance data
 * @returns {Object} Updated result with handler information
 */
export async function recordHandlerPerformance(competitionResult, handlerData) {
  try {
    if (!handlerData.hasHandler) {
      return competitionResult;
    }

    // Add handler information to competition result
    const enhancedResult = {
      ...competitionResult,
      handlerInfo: {
        groomId: handlerData.groom.id,
        groomName: handlerData.groom.name,
        handlerBonus: handlerData.handlerBonus,
        bonusBreakdown: handlerData.bonusBreakdown,
      },
    };

    // Award experience to the groom based on performance
    const experienceGain = calculateGroomExperienceGain(
      competitionResult.placement,
      competitionResult.totalEntries,
      handlerData.groom.skillLevel,
    );

    if (experienceGain > 0) {
      await prisma.groom.update({
        where: { id: handlerData.groom.id },
        data: {
          experience: {
            increment: experienceGain,
          },
        },
      });

      enhancedResult.handlerInfo.experienceGained = experienceGain;
    }

    logger.info(`[groomHandlerService] Recorded handler performance for ${handlerData.groom.name}: +${experienceGain} experience`);

    return enhancedResult;

  } catch (error) {
    logger.error(`[groomHandlerService] Error recording handler performance: ${error.message}`);
    return competitionResult;
  }
}

/**
 * Calculate experience gain for groom based on competition performance
 * @param {number} placement - Competition placement
 * @param {number} totalEntries - Total number of entries
 * @param {string} skillLevel - Groom skill level
 * @returns {number} Experience points gained
 */
function calculateGroomExperienceGain(placement, totalEntries, skillLevel) {
  // Base experience for participation
  let experience = 1;

  // Bonus for good placements
  if (placement === 1) {
    experience += 3; // +3 for 1st place
  } else if (placement === 2) {
    experience += 2; // +2 for 2nd place
  } else if (placement === 3) {
    experience += 1; // +1 for 3rd place
  }

  // Bonus for competitive fields
  if (totalEntries >= 10) {
    experience += 1; // +1 for large competitions
  }

  // Skill level affects experience gain (higher skill = slower gain)
  const skillMultipliers = {
    novice: 1.0,
    intermediate: 0.8,
    expert: 0.6,
    master: 0.4,
  };

  experience *= skillMultipliers[skillLevel] || 1.0;

  return Math.round(experience);
}
