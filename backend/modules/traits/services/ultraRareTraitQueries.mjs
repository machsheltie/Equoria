/**
 * Ultra-rare trait route data-access helpers
 *
 * Wraps the three prisma calls used by ultraRareTraitRoutes.mjs so the
 * routes layer no longer imports prisma directly (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Record an `ultraRareTraitEvent` row for a single evaluation result.
 *
 * @param {object} params
 * @param {number} params.horseId
 * @param {{ name: string, tier: string, baseChance?: number }} params.result
 * @param {object} params.evaluationContext - JSONB-safe context object
 */
export async function logUltraRareTraitEvaluation({ horseId, result, evaluationContext }) {
  return prisma.ultraRareTraitEvent.create({
    data: {
      horseId,
      traitName: result.name,
      traitTier: result.tier,
      eventType: 'evaluation_triggered',
      baseChance: result.baseChance || null,
      finalChance: result.baseChance || null, // Would be modified by groom perks
      triggerConditions: evaluationContext,
      success: true,
      notes: `Trait ${result.tier} evaluation completed`,
    },
  });
}

/**
 * Fetch the horse row + recent ultraRareTraitEvents needed by the
 * `GET /api/ultra-rare-traits/horse/:horseId` response. Returns `null`
 * if the row no longer exists (e.g. deleted after middleware ran).
 *
 * @param {number} horseId
 * @returns {Promise<object|null>}
 */
export async function getHorseWithUltraRareTraits(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      name: true,
      ultraRareTraits: true,
      ultraRareTraitEvents: {
        orderBy: { timestamp: 'desc' },
        take: 10,
      },
    },
  });
}

/**
 * Fetch the groom row needed by the rare-trait perk assignment endpoint.
 * Returns `null` if the row no longer exists.
 *
 * @param {number} groomId
 * @returns {Promise<object|null>}
 */
export async function getGroomForRareTraitPerks(groomId) {
  return prisma.groom.findUnique({
    where: { id: groomId },
    select: {
      id: true,
      name: true,
      experience: true,
      personality: true,
      epigeneticInfluenceType: true,
      bonusTraitMap: true,
    },
  });
}
