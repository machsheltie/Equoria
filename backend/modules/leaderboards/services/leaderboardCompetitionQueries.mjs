/**
 * Leaderboards — competition-result aggregation queries
 *
 * Wraps the ten prisma calls used by leaderboardRoutes.mjs so the routes
 * layer no longer imports prisma directly (Equoria-becrm).
 *
 * Each metric branch (wins / earnings / placements / average_placement)
 * exposes a small `*ByGroupBy` helper that does the actual prisma.groupBy
 * call. The horse-detail join is shared (`fetchHorseDetailsByIds`) and
 * called once per metric branch with the ordered horse-id list the
 * groupBy returned.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Fetch the per-horse user/breed details for an ordered list of horse ids.
 * Used by every metric branch to enrich the groupBy result with name +
 * owning user.
 *
 * @param {number[]} horseIds
 * @returns {Promise<Array<object>>}
 */
export function fetchHorseDetailsByIds(horseIds) {
  return prisma.horse.findMany({
    where: { id: { in: horseIds } },
    include: { user: { select: { id: true, username: true } } },
  });
}

/** Wins per horse, ordered desc, for the wins metric branch. */
export function groupWinsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: { ...whereClause, placement: '1' },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take,
    skip,
  });
}

/** Earnings sum per horse for the earnings metric branch. */
export function groupEarningsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: whereClause,
    _sum: { prizeWon: true },
    orderBy: { _sum: { prizeWon: 'desc' } },
    take,
    skip,
  });
}

/** Top-3 placements per horse for the placements metric branch. */
export function groupTopThreePlacementsByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: { ...whereClause, placement: { in: ['1', '2', '3'] } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take,
    skip,
  });
}

/**
 * Average placement per horse for the average_placement metric branch.
 * Requires a minimum of 3 competitions (HAVING count >= 3) so the
 * average is statistically meaningful.
 */
export function groupAveragePlacementByHorse(whereClause, { take, skip }) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: whereClause,
    _avg: { placement: true },
    _count: { id: true },
    having: { id: { _count: { gte: 3 } } },
    orderBy: { _avg: { placement: 'asc' } }, // Lower average is better
    take,
    skip,
  });
}

/**
 * Total-distinct-horse count for pagination metadata. Returns an array
 * whose `.length` is the count of distinct horses matching the filter.
 *
 * @param {object} whereClause
 * @returns {Promise<Array<{ horseId: number }>>}
 */
export function groupDistinctHorseCount(whereClause) {
  return prisma.competitionResult.groupBy({
    by: ['horseId'],
    where: whereClause,
    _count: { id: true },
  });
}

/**
 * Fetch the horse-leaderboard-profile row + competitionResults summary
 * used by `GET /api/leaderboards/horse/:horseId`. Returns `null` if the
 * row no longer exists.
 *
 * @param {number} horseId
 * @returns {Promise<object|null>}
 */
export function getHorseProfileForLeaderboard(horseId) {
  return prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      name: true,
      dateOfBirth: true,
      sex: true,
      speed: true,
      stamina: true,
      agility: true,
      balance: true,
      precision: true,
      intelligence: true,
      boldness: true,
      flexibility: true,
      obedience: true,
      focus: true,
      totalEarnings: true,
      breed: { select: { name: true } },
      competitionResults: {
        select: { placement: true },
        where: { placement: { not: null } },
      },
    },
  });
}
