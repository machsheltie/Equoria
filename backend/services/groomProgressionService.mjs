/**
 * Groom Progression Service
 * 
 * Handles groom experience, leveling, synergy tracking, and assignment history.
 * Implements the groom progression and personality system as specified in
 * groomprogressionpersonality.md.
 * 
 * Features:
 * - XP gain and leveling system (cap at level 10)
 * - Groom-horse synergy tracking with effects
 * - Assignment history logging
 * - Enhanced profile data aggregation
 */

import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.js';
import logger from '../utils/logger.mjs';

const prisma = new PrismaClient();

/**
 * XP requirements per level: 100 * level
 * Level 1: 0-99 XP
 * Level 2: 100-299 XP (100 + 200)
 * Level 3: 300-599 XP (100 + 200 + 300)
 * etc.
 */
const LEVEL_CAP = 10;

/**
 * Calculate groom level from total experience
 * @param {number} experience - Total experience points
 * @returns {number} Current level (1-10)
 */
export function calculateGroomLevel(experience) {
  if (experience < 100) return 1;
  
  let totalXpRequired = 0;
  for (let level = 1; level <= LEVEL_CAP; level++) {
    const xpForThisLevel = 100 * level;
    if (experience < totalXpRequired + xpForThisLevel) {
      return level;
    }
    totalXpRequired += xpForThisLevel;
  }
  
  return LEVEL_CAP; // Cap at level 10
}

/**
 * Award XP to a groom and handle leveling
 * @param {number} groomId - ID of the groom
 * @param {string} source - Source of XP (milestone_completion, trait_shaped, show_win)
 * @param {number} amount - Amount of XP to award
 * @returns {Object} Result with XP gained, new experience, level info
 */
export async function awardGroomXP(groomId, source, amount) {
  try {
    logger.info(`[groomProgressionService.awardGroomXP] Awarding ${amount} XP to groom ${groomId} for ${source}`);

    // Get current groom data
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: { experience: true, level: true }
    });

    if (!groom) {
      throw new Error(`Groom with ID ${groomId} not found`);
    }

    const oldExperience = groom.experience || 0;
    const oldLevel = groom.level || 1;
    const newExperience = oldExperience + amount;
    const newLevel = calculateGroomLevel(newExperience);
    const levelUp = newLevel > oldLevel;

    // Update groom with new experience and level
    await prisma.groom.update({
      where: { id: groomId },
      data: {
        experience: newExperience,
        level: newLevel
      }
    });

    logger.info(`[groomProgressionService.awardGroomXP] Groom ${groomId} gained ${amount} XP: ${oldExperience} → ${newExperience} (Level ${oldLevel} → ${newLevel})`);

    return {
      success: true,
      xpGained: amount,
      oldExperience,
      newExperience,
      oldLevel,
      newLevel,
      levelUp
    };

  } catch (error) {
    logger.error(`[groomProgressionService.awardGroomXP] Error awarding XP to groom ${groomId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update synergy between groom and horse
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {string} action - Action type (milestone_completed, trait_shaped, rare_trait_influenced, reassigned_early)
 * @param {number} sessions - Number of sessions to add
 * @returns {Object} Result with synergy changes
 */
export async function updateGroomSynergy(groomId, horseId, action, sessions = 1) {
  try {
    logger.info(`[groomProgressionService.updateGroomSynergy] Updating synergy for groom ${groomId} and horse ${horseId}: ${action}`);

    // Synergy gain amounts based on action
    const synergyGains = {
      milestone_completed: 1,
      trait_shaped: 2,
      rare_trait_influenced: 3,
      reassigned_early: -5
    };

    const synergyGain = synergyGains[action] || 0;

    // Find or create synergy record
    let synergyRecord = await prisma.groomHorseSynergy.findFirst({
      where: { groomId, horseId }
    });

    if (!synergyRecord) {
      synergyRecord = await prisma.groomHorseSynergy.create({
        data: {
          groomId,
          horseId,
          synergyScore: Math.max(0, synergyGain), // Minimum 0
          sessionsTogether: sessions,
          lastAssignedAt: new Date()
        }
      });
    } else {
      const newSynergyScore = Math.max(0, synergyRecord.synergyScore + synergyGain);
      synergyRecord = await prisma.groomHorseSynergy.update({
        where: { id: synergyRecord.id },
        data: {
          synergyScore: newSynergyScore,
          sessionsTogether: synergyRecord.sessionsTogether + sessions,
          lastAssignedAt: new Date()
        }
      });
    }

    logger.info(`[groomProgressionService.updateGroomSynergy] Synergy updated: ${synergyRecord.synergyScore} (${synergyGain >= 0 ? '+' : ''}${synergyGain})`);

    return {
      success: true,
      synergyGained: synergyGain,
      newSynergyScore: synergyRecord.synergyScore,
      sessionsTogether: synergyRecord.sessionsTogether
    };

  } catch (error) {
    logger.error(`[groomProgressionService.updateGroomSynergy] Error updating synergy:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Log groom assignment start/end with performance data
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {string} action - 'assigned' or 'unassigned'
 * @param {Object} performanceData - Optional performance data for unassignment
 * @returns {Object} Result with assignment log
 */
export async function logGroomAssignment(groomId, horseId, action, performanceData = {}) {
  try {
    logger.info(`[groomProgressionService.logGroomAssignment] Logging assignment ${action} for groom ${groomId} and horse ${horseId}`);

    if (action === 'assigned') {
      // Create new assignment log
      const assignmentLog = await prisma.groomAssignmentLog.create({
        data: {
          groomId,
          horseId,
          assignedAt: new Date(),
          milestonesCompleted: 0,
          traitsShaped: [],
          xpGained: 0
        }
      });

      return {
        success: true,
        assignmentLog
      };

    } else if (action === 'unassigned') {
      // Find and update existing assignment log
      const assignmentLog = await prisma.groomAssignmentLog.findFirst({
        where: {
          groomId,
          horseId,
          unassignedAt: null
        },
        orderBy: { assignedAt: 'desc' }
      });

      if (!assignmentLog) {
        throw new Error('No active assignment found to complete');
      }

      const updatedLog = await prisma.groomAssignmentLog.update({
        where: { id: assignmentLog.id },
        data: {
          unassignedAt: new Date(),
          milestonesCompleted: performanceData.milestonesCompleted || 0,
          traitsShaped: performanceData.traitsShaped || [],
          xpGained: performanceData.xpGained || 0
        }
      });

      return {
        success: true,
        assignmentLog: updatedLog
      };
    }

    throw new Error(`Invalid action: ${action}`);

  } catch (error) {
    logger.error(`[groomProgressionService.logGroomAssignment] Error logging assignment:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get comprehensive groom profile with progression data
 * @param {number} groomId - ID of the groom
 * @returns {Object} Complete groom profile with progression data
 */
export async function getGroomProfile(groomId) {
  try {
    logger.info(`[groomProgressionService.getGroomProfile] Getting profile for groom ${groomId}`);

    // Get groom with all related data
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      include: {
        groomAssignments: {
          where: { isActive: true },
          include: {
            foal: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!groom) {
      throw new Error(`Groom with ID ${groomId} not found`);
    }

    // Get synergy records with effects calculation
    const synergyRecords = await prisma.groomHorseSynergy.findMany({
      where: { groomId },
      include: {
        horse: {
          select: { id: true, name: true }
        }
      }
    });

    // Calculate synergy effects
    const synergyWithEffects = synergyRecords.map(synergy => ({
      ...synergy,
      effects: calculateSynergyEffects(synergy.synergyScore)
    }));

    // Get assignment history
    const assignmentHistory = await prisma.groomAssignmentLog.findMany({
      where: { groomId },
      include: {
        horse: {
          select: { id: true, name: true }
        }
      },
      orderBy: { assignedAt: 'desc' },
      take: 10 // Last 10 assignments
    });

    return {
      success: true,
      groom: {
        ...groom,
        synergyRecords: synergyWithEffects,
        assignmentHistory,
        currentAssignments: groom.groomAssignments
      }
    };

  } catch (error) {
    logger.error(`[groomProgressionService.getGroomProfile] Error getting groom profile:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate synergy effects based on synergy score
 * @param {number} synergyScore - Current synergy score
 * @returns {Object} Effects object with bonuses
 */
function calculateSynergyEffects(synergyScore) {
  const effects = {
    bondGrowthBonus: 0,
    milestoneTraitModifier: 0,
    cosmeticBonus: null
  };

  if (synergyScore >= 25) {
    effects.bondGrowthBonus = 5; // +5% bond growth
  }

  if (synergyScore >= 50) {
    effects.milestoneTraitModifier = 1; // +1 to milestone trait modifier
  }

  if (synergyScore >= 100) {
    effects.cosmeticBonus = 'nameplate'; // Unlock nameplate
  }

  return effects;
}
