/**
 * Groom Retirement Service
 * 
 * This service handles all aspects of groom retirement including:
 * - Career week tracking and progression
 * - Retirement eligibility checking
 * - Retirement processing and status management
 * - Integration with existing groom systems
 * 
 * Retirement Rules:
 * - Mandatory retirement at 104 weeks (2 years)
 * - Early retirement triggers: Level 10, 12+ assignments
 * - 1-week retirement notice system
 * - Retired grooms become inactive but retain data
 */

import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.mjs';

const prisma = new PrismaClient();

/**
 * Retirement reasons enum
 */
export const RETIREMENT_REASONS = {
  MANDATORY_CAREER_LIMIT: 'mandatory_career_limit',
  EARLY_LEVEL_CAP: 'early_level_cap',
  EARLY_ASSIGNMENT_LIMIT: 'early_assignment_limit',
  VOLUNTARY: 'voluntary'
};

/**
 * Career progression constants
 */
export const CAREER_CONSTANTS = {
  MANDATORY_RETIREMENT_WEEKS: 104, // 2 years
  EARLY_RETIREMENT_LEVEL: 10,
  EARLY_RETIREMENT_ASSIGNMENTS: 12,
  RETIREMENT_NOTICE_WEEKS: 1
};

/**
 * Increment career weeks for a groom
 * @param {number} groomId - The groom ID
 * @returns {Promise<Object>} Updated groom with new career weeks
 */
export async function incrementCareerWeeks(groomId) {
  try {
    const updatedGroom = await prisma.groom.update({
      where: { id: groomId },
      data: {
        careerWeeks: {
          increment: 1
        }
      },
      include: {
        groomAssignmentLogs: true
      }
    });

    logger.info(`Incremented career weeks for groom ${groomId} to ${updatedGroom.careerWeeks}`);
    return updatedGroom;
  } catch (error) {
    logger.error(`Error incrementing career weeks for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Check if a groom is eligible for retirement
 * @param {number} groomId - The groom ID
 * @returns {Promise<Object>} Retirement eligibility status
 */
export async function checkRetirementEligibility(groomId) {
  try {
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      include: {
        groomAssignmentLogs: true
      }
    });

    if (!groom) {
      throw new Error(`Groom with ID ${groomId} not found`);
    }

    if (groom.retired) {
      return {
        eligible: false,
        reason: 'already_retired',
        weeksUntilRetirement: 0,
        noticeRequired: false
      };
    }

    const assignmentCount = groom.groomAssignmentLogs.length;
    const weeksUntilMandatory = CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS - groom.careerWeeks;
    const noticeRequired = weeksUntilMandatory <= CAREER_CONSTANTS.RETIREMENT_NOTICE_WEEKS;

    // Check mandatory retirement (104 weeks)
    if (groom.careerWeeks >= CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS) {
      return {
        eligible: true,
        reason: RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT,
        weeksUntilRetirement: 0,
        noticeRequired: false,
        mandatory: true
      };
    }

    // Check early retirement - Level 10
    if (groom.level >= CAREER_CONSTANTS.EARLY_RETIREMENT_LEVEL) {
      return {
        eligible: true,
        reason: RETIREMENT_REASONS.EARLY_LEVEL_CAP,
        weeksUntilRetirement: weeksUntilMandatory,
        noticeRequired,
        mandatory: false
      };
    }

    // Check early retirement - 12+ assignments
    if (assignmentCount >= CAREER_CONSTANTS.EARLY_RETIREMENT_ASSIGNMENTS) {
      return {
        eligible: true,
        reason: RETIREMENT_REASONS.EARLY_ASSIGNMENT_LIMIT,
        weeksUntilRetirement: weeksUntilMandatory,
        noticeRequired,
        mandatory: false
      };
    }

    // Not eligible for retirement
    return {
      eligible: false,
      reason: 'not_eligible',
      weeksUntilRetirement: weeksUntilMandatory,
      noticeRequired,
      mandatory: false
    };

  } catch (error) {
    logger.error(`Error checking retirement eligibility for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Process retirement for a groom
 * @param {number} groomId - The groom ID
 * @param {string} reason - Retirement reason
 * @param {boolean} voluntary - Whether retirement is voluntary
 * @returns {Promise<Object>} Retired groom data
 */
export async function processRetirement(groomId, reason = null, voluntary = false) {
  try {
    const eligibility = await checkRetirementEligibility(groomId);
    
    if (!eligibility.eligible && !voluntary) {
      throw new Error(`Groom ${groomId} is not eligible for retirement`);
    }

    const retirementReason = reason || eligibility.reason || RETIREMENT_REASONS.VOLUNTARY;
    const retirementTimestamp = new Date();

    // Update groom status to retired
    const retiredGroom = await prisma.groom.update({
      where: { id: groomId },
      data: {
        retired: true,
        retirementReason,
        retirementTimestamp,
        isActive: false // Mark as inactive
      },
      include: {
        groomAssignmentLogs: true,
        groomHorseSynergies: true
      }
    });

    // Remove from any active assignments
    await prisma.groomAssignment.deleteMany({
      where: { groomId }
    });

    logger.info(`Processed retirement for groom ${groomId} with reason: ${retirementReason}`);
    
    return {
      groom: retiredGroom,
      retirementReason,
      retirementTimestamp,
      assignmentCount: retiredGroom.groomAssignmentLogs.length,
      synergyRecords: retiredGroom.groomHorseSynergies.length
    };

  } catch (error) {
    logger.error(`Error processing retirement for groom ${groomId}:`, error);
    throw error;
  }
}

/**
 * Get all grooms approaching retirement (within notice period)
 * @param {string} userId - User ID to filter grooms
 * @returns {Promise<Array>} Grooms approaching retirement
 */
export async function getGroomsApproachingRetirement(userId) {
  try {
    const noticeThreshold = CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS - CAREER_CONSTANTS.RETIREMENT_NOTICE_WEEKS;
    
    const grooms = await prisma.groom.findMany({
      where: {
        userId,
        retired: false,
        careerWeeks: {
          gte: noticeThreshold
        }
      },
      include: {
        groomAssignmentLogs: true
      }
    });

    const groomsWithEligibility = await Promise.all(
      grooms.map(async (groom) => {
        const eligibility = await checkRetirementEligibility(groom.id);
        return {
          ...groom,
          eligibility
        };
      })
    );

    return groomsWithEligibility;

  } catch (error) {
    logger.error(`Error getting grooms approaching retirement for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get retirement statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Retirement statistics
 */
export async function getRetirementStatistics(userId) {
  try {
    const [activeGrooms, retiredGrooms, approachingRetirement] = await Promise.all([
      prisma.groom.count({
        where: { userId, retired: false }
      }),
      prisma.groom.count({
        where: { userId, retired: true }
      }),
      getGroomsApproachingRetirement(userId)
    ]);

    return {
      activeGrooms,
      retiredGrooms,
      totalGrooms: activeGrooms + retiredGrooms,
      approachingRetirement: approachingRetirement.length,
      retirementRate: retiredGrooms / (activeGrooms + retiredGrooms) || 0
    };

  } catch (error) {
    logger.error(`Error getting retirement statistics for user ${userId}:`, error);
    throw error;
  }
}

export default {
  incrementCareerWeeks,
  checkRetirementEligibility,
  processRetirement,
  getGroomsApproachingRetirement,
  getRetirementStatistics,
  RETIREMENT_REASONS,
  CAREER_CONSTANTS
};
