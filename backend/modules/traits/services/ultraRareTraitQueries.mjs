/**
 * Ultra-rare trait route data-access helpers
 *
 * Wraps the prisma call used by ultraRareTraitRoutes.mjs so the routes layer
 * no longer imports prisma directly (Equoria-becrm).
 *
 * Read-only. Equoria-gu8jk (owner ruling 2026-10-20: players must never write
 * traits for themselves) removed the player-reachable writers that lived here:
 * logUltraRareTraitEvaluation (POST /ultra-rare-traits/evaluate/:horseId),
 * getGroomForRareTraitPerks (POST /ultra-rare-traits/groom/:groomId/assign-perks)
 * and the `_lineage_analysis` UltraRareTraitEvent signal that
 * GET /breeding/lineage-analysis recorded for the caller's horses
 * (recordLineageAnalysisPerformed / recordLineageAnalysisForPair /
 * hasLineageAnalysisBeenPerformed, Equoria-245bt).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

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
