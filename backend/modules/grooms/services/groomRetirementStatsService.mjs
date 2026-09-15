/**
 * Groom Retirement Statistics — a READ over retirement history.
 *
 * Split out of groomRetirementService.mjs by Equoria-ypb7d.1 for one honest
 * reason and one good one. The honest reason: the retirement service sat at 598
 * lines against a 600-line cap, and the age model had to go in it. The good
 * reason: this function is a reporting read over rows retirement has ALREADY
 * written, and it shares nothing with the mechanic — no transaction, no guard, no
 * schedule, no notification. Retirement decides; this counts.
 *
 * `groomRetirementService.mjs` re-exports it, so every existing importer and the
 * `GET /grooms/retirement/statistics` route are unchanged. This file is
 * deliberately NOT in the grooms barrel: adding it there would make
 * `getRetirementStatistics` an ambiguous star export alongside the retirement
 * service's re-export (the Equoria-p7z26 failure mode).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Get retirement statistics for a user.
 *
 * Equoria-m9lz1: the former `approachingRetirement` key is GONE. It counted the
 * user's grooms within one week of retiring, which is exactly the disclosure the
 * owner's ruling forbids (invariant I3 in groomRetirementService.mjs). Do not
 * reinstate it, and do not add a groom's age or hidden retirement age here.
 *
 * `retirementReasons` groups over `Groom.retirementReason` and therefore still
 * reports historical `mandatory_career_limit` / `early_level_cap` /
 * `early_assignment_limit` rows alongside the current `age`.
 *
 * Equoria-ypb7d: this read still works after the engagement model landed because
 * retirement deliberately does NOT clear `Groom.userId` — see the field's comment
 * in schema.prisma. A groom RELEASED for non-payment does have it cleared and so
 * leaves these counts, which is correct: they are no longer this player's staff.
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Retirement statistics
 */
export async function getRetirementStatistics(userId) {
  const [activeGrooms, retiredGrooms] = await Promise.all([
    prisma.groom.count({
      where: { userId, retired: false },
    }),
    prisma.groom.count({
      where: { userId, retired: true },
    }),
  ]);

  // Get retirement reasons breakdown
  const retirementReasons = await prisma.groom.groupBy({
    by: ['retirementReason'],
    where: { userId, retired: true },
    _count: { retirementReason: true },
  });

  // Average career length, IN GAME-YEARS. Equoria-maeba (owner, 2026-09-14):
  // one weekly pass is one game-year, so the counter behind this column measures
  // years served — the key is named for the unit rather than for the tick, which
  // is the last place the retired career-weeks vocabulary reached a player.
  const retiredGroomsData = await prisma.groom.findMany({
    where: { userId, retired: true },
    select: { careerWeeks: true },
  });

  const averageCareerYears =
    retiredGroomsData.length > 0
      ? retiredGroomsData.reduce((sum, groom) => sum + groom.careerWeeks, 0) /
        retiredGroomsData.length
      : 0;

  return {
    activeGrooms,
    retiredGrooms,
    totalGrooms: activeGrooms + retiredGrooms,
    retirementRate: retiredGrooms / (activeGrooms + retiredGrooms) || 0,
    retirementReasons: retirementReasons.reduce((acc, reason) => {
      acc[reason.retirementReason] = reason._count.retirementReason;
      return acc;
    }, {}),
    averageCareerYears: Math.round(averageCareerYears * 100) / 100,
  };
}

export default { getRetirementStatistics };
