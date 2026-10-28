/**
 * Leaderboards — competition-result queries the routes and boards share
 *
 * The routes layer does not import prisma directly (Equoria-becrm). The
 * groupBy helpers behind the old GET /leaderboards/competition list went with
 * that route (owner ruling 2026-10-28, q151, Equoria-a7f1p).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Equoria-xxdqh (owner ruling 2026-10-22): the minimum shows entered before a
 * horse appears on the win-percentage board.
 */
export const winPercentageMinShows = 100;

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
