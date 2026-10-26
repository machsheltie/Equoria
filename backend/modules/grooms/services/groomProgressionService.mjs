/**
 * Groom Progression Service
 *
 * Handles groom-horse synergy tracking, assignment history and profile data.
 * Implements the groom progression and personality system as specified in
 * groomprogressionpersonality.md.
 *
 * Owner ruling 2026-10-21 (Equoria-dea06): grooms are game-generated NPCs that
 * never earn XP and keep the level they were generated with. The groom XP award
 * and the XP-to-level curve that lived here are gone; nothing writes a groom's
 * `experience` or `level` after it is created.
 *
 * Features:
 * - Groom-horse synergy tracking with effects
 * - Assignment history logging
 * - Enhanced profile data aggregation
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Update synergy between groom and horse
 * @param {number} groomId - ID of the groom
 * @param {number} horseId - ID of the horse
 * @param {string} action - Action type (milestone_completed, trait_shaped, rare_trait_influenced, reassigned_early)
 * @param {number} sessions - Number of sessions to add
 * @param {object} [client] - Prisma client or interactive-transaction client.
 *   Pass a `tx` to enlist this write in the caller's transaction (Equoria-po1fl);
 *   when a tx is passed, failures are RETHROWN instead of fail-softed.
 * @returns {Object} Result with synergy changes
 */
/** The action a grooming session reports (camelCase name for new callers, Equoria-pjvp8). */
export const interactionCompletedAction = 'interaction_completed';

export async function updateGroomSynergy(groomId, horseId, action, sessions = 1, client = prisma) {
  try {
    logger.info(
      `[groomProgressionService.updateGroomSynergy] Updating synergy for groom ${groomId} and horse ${horseId}: ${action}`,
    );

    // Synergy gain amounts based on action
    const synergyGains = {
      milestone_completed: 1,
      trait_shaped: 2,
      rare_trait_influenced: 3,
      reassigned_early: -5,
      // Equoria-5v6g: generic interactions track sessions every time, with a small
      // synergyScore delta every 4th session (handled inline via sessionsTogether modulo).
      interaction_completed: 0,
    };

    let synergyGain = synergyGains[action] || 0;

    // Find or create synergy record
    let synergyRecord = await client.groomHorseSynergy.findFirst({
      where: { groomId, horseId },
    });

    // Equoria-5v6g: for generic interactions, award +1 synergy every 4th session crossed.
    // This keeps synergy growth small relative to milestone events (+1) but ensures
    // sustained grooming still increases the score over time.
    if (action === interactionCompletedAction) {
      const oldSessions = synergyRecord?.sessionsTogether ?? 0;
      const newSessions = oldSessions + sessions;
      synergyGain = Math.floor(newSessions / 4) - Math.floor(oldSessions / 4);
    }

    if (!synergyRecord) {
      synergyRecord = await client.groomHorseSynergy.create({
        data: {
          groomId,
          horseId,
          synergyScore: Math.max(0, synergyGain), // Minimum 0
          sessionsTogether: sessions,
          lastAssignedAt: new Date(),
        },
      });
    } else {
      const newSynergyScore = Math.max(0, synergyRecord.synergyScore + synergyGain);
      synergyRecord = await client.groomHorseSynergy.update({
        where: { id: synergyRecord.id },
        data: {
          synergyScore: newSynergyScore,
          sessionsTogether: synergyRecord.sessionsTogether + sessions,
          lastAssignedAt: new Date(),
        },
      });
    }

    logger.info(
      `[groomProgressionService.updateGroomSynergy] Synergy updated: ${synergyRecord.synergyScore} (${synergyGain >= 0 ? '+' : ''}${synergyGain})`,
    );

    return {
      success: true,
      synergyGained: synergyGain,
      newSynergyScore: synergyRecord.synergyScore,
      sessionsTogether: synergyRecord.sessionsTogether,
    };
  } catch (error) {
    logger.error('[groomProgressionService.updateGroomSynergy] Error updating synergy:', error);
    // Equoria-po1fl: inside a caller's transaction the failed statement has
    // already aborted that transaction, so a swallowed error would be a
    // half-written player state. Propagate; standalone callers stay fail-soft.
    if (client !== prisma) {
      throw error;
    }
    return {
      success: false,
      error: error.message,
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
    logger.info(
      `[groomProgressionService.logGroomAssignment] Logging assignment ${action} for groom ${groomId} and horse ${horseId}`,
    );

    if (action === 'assigned') {
      // Create new assignment log
      const assignmentLog = await prisma.groomAssignmentLog.create({
        data: {
          groomId,
          horseId,
          assignedAt: new Date(),
          milestonesCompleted: 0,
          traitsShaped: [],
          xpGained: 0,
        },
      });

      return {
        success: true,
        assignmentLog,
      };
    } else if (action === 'unassigned') {
      // Find and update existing assignment log
      const assignmentLog = await prisma.groomAssignmentLog.findFirst({
        where: {
          groomId,
          horseId,
          unassignedAt: null,
        },
        orderBy: { assignedAt: 'desc' },
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
          xpGained: performanceData.xpGained || 0,
        },
      });

      return {
        success: true,
        assignmentLog: updatedLog,
      };
    }

    throw new Error(`Invalid action: ${action}`);
  } catch (error) {
    logger.error('[groomProgressionService.logGroomAssignment] Error logging assignment:', error);
    return {
      success: false,
      error: error.message,
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
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!groom) {
      throw new Error(`Groom with ID ${groomId} not found`);
    }

    // Get synergy records with effects calculation
    const synergyRecords = await prisma.groomHorseSynergy.findMany({
      where: { groomId },
      include: {
        horse: {
          select: { id: true, name: true },
        },
      },
    });

    // Calculate synergy effects
    const synergyWithEffects = synergyRecords.map(synergy => ({
      ...synergy,
      effects: calculateSynergyEffects(synergy.synergyScore),
    }));

    // Get assignment history
    const assignmentHistory = await prisma.groomAssignmentLog.findMany({
      where: { groomId },
      include: {
        horse: {
          select: { id: true, name: true },
        },
      },
      orderBy: { assignedAt: 'desc' },
      take: 10, // Last 10 assignments
    });

    return {
      success: true,
      groom: {
        ...groom,
        synergyRecords: synergyWithEffects,
        assignmentHistory,
        currentAssignments: groom.groomAssignments,
      },
    };
  } catch (error) {
    logger.error('[groomProgressionService.getGroomProfile] Error getting groom profile:', error);
    return {
      success: false,
      error: error.message,
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
    cosmeticBonus: null,
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
