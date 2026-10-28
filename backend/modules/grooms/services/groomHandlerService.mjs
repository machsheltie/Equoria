/**
 * Groom Handler Service
 *
 * A show handler is the horse's groom (owner ruling 2026-10-28 q154,
 * Equoria-4fa7s): conformation shows and parades need a groom, every other
 * discipline a rider, and any groom may handle in any class: the only check
 * is that the horse has a groom.
 *
 * Old contract: this module also judged a groom per conformation class
 * (validateHandlerEligibility, calculateHandlerBonus) and carried
 * per-discipline handler bonus tables by groom skill, personality and
 * specialty for ridden disciplines. They contradicted the ruling, had no
 * player-facing caller, and were removed. Groom handler bonuses (personality
 * against temperament) come later.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

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
      },
      // The horse's longest-standing active groom (no priority: Equoria-ekrab).
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
