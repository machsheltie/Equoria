/**
 * Groom Bonus Trait Service
 *
 * Service for managing groom bonus traits that provide probability bonuses for rare trait acquisition.
 * This service handles the assignment, validation, and retrieval of bonus traits for grooms.
 *
 * Features:
 * - Assign bonus traits to grooms with validation
 * - Retrieve groom bonus traits
 * - Validate bonus trait constraints (max 3 traits, max 30% bonus per trait)
 * - Integration with trait assignment probability calculations
 *
 * Business Rules:
 * - Maximum 3 bonus traits per groom
 * - Maximum 30% bonus per individual trait
 * - Bonus traits only apply to randomized traits (not guaranteed traits)
 * - Bonuses require bond > 60 and 75% assignment window coverage
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Constants for bonus trait validation
const MAX_BONUS_TRAITS = 3;
const MAX_TRAIT_BONUS = 0.30; // 30%
const MIN_BOND_SCORE = 60;
const MIN_COVERAGE_PERCENTAGE = 0.75; // 75%

/**
 * Assign bonus traits to a groom
 * @param {number} groomId - ID of the groom
 * @param {Object} bonusTraits - Object mapping trait names to bonus percentages
 * @returns {Object} Result object with success status and bonus traits
 */
export async function assignBonusTraits(groomId, bonusTraits) {
  try {
    logger.info(`[groomBonusTraitService.assignBonusTraits] Assigning bonus traits to groom ${groomId}`);

    // Validate bonus traits
    const validation = validateBonusTraits(bonusTraits);
    if (!validation.valid) {
      throw new Error(`Bonus trait constraints violated: ${validation.errors.join(', ')}`);
    }

    // Update groom with bonus traits
    const updatedGroom = await prisma.groom.update({
      where: { id: groomId },
      data: { bonusTraitMap: bonusTraits },
      select: { id: true, name: true, bonusTraitMap: true },
    });

    logger.info(`[groomBonusTraitService.assignBonusTraits] Successfully assigned bonus traits to groom ${groomId}`);

    return {
      success: true,
      groomId: updatedGroom.id,
      groomName: updatedGroom.name,
      bonusTraits: updatedGroom.bonusTraitMap,
    };
  } catch (error) {
    logger.error(`[groomBonusTraitService.assignBonusTraits] Error assigning bonus traits to groom ${groomId}: ${error.message}`);
    throw error;
  }
}

/**
 * Get bonus traits for a groom
 * @param {number} groomId - ID of the groom
 * @returns {Object} Bonus traits object
 */
export async function getBonusTraits(groomId) {
  try {
    logger.info(`[groomBonusTraitService.getBonusTraits] Getting bonus traits for groom ${groomId}`);

    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: { id: true, name: true, bonusTraitMap: true },
    });

    if (!groom) {
      throw new Error(`Groom with ID ${groomId} not found`);
    }

    logger.info(`[groomBonusTraitService.getBonusTraits] Retrieved bonus traits for groom ${groomId}`);

    return groom.bonusTraitMap || {};
  } catch (error) {
    logger.error(`[groomBonusTraitService.getBonusTraits] Error getting bonus traits for groom ${groomId}: ${error.message}`);
    throw error;
  }
}

/**
 * Validate bonus traits against business rules
 * @param {Object} bonusTraits - Object mapping trait names to bonus percentages
 * @returns {Object} Validation result with valid flag and errors array
 */
export function validateBonusTraits(bonusTraits) {
  const errors = [];

  // Check if bonusTraits is an object
  if (!bonusTraits || typeof bonusTraits !== 'object') {
    errors.push('Bonus traits must be an object');
    return { valid: false, errors };
  }

  const traitNames = Object.keys(bonusTraits);

  // Check maximum number of traits
  if (traitNames.length > MAX_BONUS_TRAITS) {
    errors.push(`Maximum ${MAX_BONUS_TRAITS} bonus traits allowed, got ${traitNames.length}`);
  }

  // Check individual trait bonuses
  for (const [traitName, bonus] of Object.entries(bonusTraits)) {
    // Check if trait name is valid
    if (!traitName || typeof traitName !== 'string' || traitName.trim() === '') {
      errors.push('Trait names must be non-empty strings');
      continue;
    }

    // Check if bonus is a valid number
    if (typeof bonus !== 'number' || isNaN(bonus)) {
      errors.push(`Bonus for trait '${traitName}' must be a number`);
      continue;
    }

    // Check bonus range
    if (bonus < 0 || bonus > MAX_TRAIT_BONUS) {
      errors.push(`Bonus for trait '${traitName}' must be between 0 and ${MAX_TRAIT_BONUS} (${MAX_TRAIT_BONUS * 100}%)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if groom qualifies for bonus application based on bond and coverage
 * @param {number} horseId - ID of the horse
 * @param {number} groomId - ID of the groom
 * @returns {Object} Qualification result with eligible flag and details
 */
export async function checkBonusEligibility(horseId, groomId) {
  try {
    logger.info(`[groomBonusTraitService.checkBonusEligibility] Checking bonus eligibility for horse ${horseId} and groom ${groomId}`);

    // Get horse age to determine milestone window
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    const ageInDays = Math.floor((Date.now() - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24));
    const milestoneWindowDays = Math.min(ageInDays, 30); // Consider up to 30 days for milestone window

    // Get groom assignment coverage
    const assignments = await prisma.groomAssignment.findMany({
      where: {
        groomId,
        foalId: horseId,
        startDate: {
          gte: new Date(Date.now() - milestoneWindowDays * 24 * 60 * 60 * 1000),
        },
      },
      select: { startDate: true, endDate: true },
    });

    // Calculate coverage percentage
    let totalCoverageDays = 0;
    for (const assignment of assignments) {
      const startDate = new Date(assignment.startDate);
      const endDate = assignment.endDate ? new Date(assignment.endDate) : new Date();
      const coverageDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
      totalCoverageDays += coverageDays;
    }

    const coveragePercentage = totalCoverageDays / milestoneWindowDays;

    // Get average bond score from interactions
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        groomId,
        foalId: horseId, // GroomInteraction uses foalId instead of horseId
        timestamp: {
          gte: new Date(Date.now() - milestoneWindowDays * 24 * 60 * 60 * 1000),
        },
      },
      select: { bondingChange: true }, // GroomInteraction uses bondingChange instead of bondingScore
    });

    // Calculate cumulative bond score from interactions (bondingChange is per interaction)
    const totalBondingChange = interactions.length > 0
      ? interactions.reduce((sum, interaction) => sum + interaction.bondingChange, 0)
      : 0;

    // Assume starting bond score of 50 and add cumulative changes
    const averageBondScore = 50 + totalBondingChange;

    const eligible = averageBondScore >= MIN_BOND_SCORE && coveragePercentage >= MIN_COVERAGE_PERCENTAGE;

    logger.info(`[groomBonusTraitService.checkBonusEligibility] Eligibility check complete for horse ${horseId} and groom ${groomId}: ${eligible}`);

    return {
      eligible,
      averageBondScore,
      coveragePercentage,
      milestoneWindowDays,
      totalCoverageDays,
      interactionCount: interactions.length,
      reason: !eligible
        ? averageBondScore < MIN_BOND_SCORE
          ? 'Bond score too low'
          : 'Insufficient assignment coverage'
        : 'Eligible for bonus',
    };
  } catch (error) {
    logger.error(`[groomBonusTraitService.checkBonusEligibility] Error checking bonus eligibility: ${error.message}`);
    throw error;
  }
}

/**
 * Get all grooms with their bonus traits for a user
 * @param {string} userId - ID of the user
 * @returns {Array} Array of grooms with bonus traits
 */
export async function getUserGroomsWithBonusTraits(userId) {
  try {
    logger.info(`[groomBonusTraitService.getUserGroomsWithBonusTraits] Getting grooms with bonus traits for user ${userId}`);

    const grooms = await prisma.groom.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        speciality: true,
        skillLevel: true,
        personality: true,
        bonusTraitMap: true,
      },
      orderBy: { name: 'asc' },
    });

    logger.info(`[groomBonusTraitService.getUserGroomsWithBonusTraits] Retrieved ${grooms.length} grooms for user ${userId}`);

    return grooms.map(groom => ({
      ...groom,
      bonusTraits: groom.bonusTraitMap || {},
      hasBonusTraits: Object.keys(groom.bonusTraitMap || {}).length > 0,
    }));
  } catch (error) {
    logger.error(`[groomBonusTraitService.getUserGroomsWithBonusTraits] Error getting grooms for user ${userId}: ${error.message}`);
    throw error;
  }
}
