/**
 * User Prize History service
 *
 * Data-access layer for GET /api/users/:userId/prize-history. Extracted
 * from userRoutes.mjs so the routes layer never touches prisma directly
 * (Equoria-becrm).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * Fetch a user's competition prize-history with pagination metadata.
 * Returns `{ total, results }` where `results` is the page of raw
 * `CompetitionResult` rows (with horse `id` + `name` joined). Caller
 * is responsible for serializer-shaping the API response.
 *
 * @param {string} userId - owning user id
 * @param {{ limit: number, offset: number }} pagination
 * @returns {Promise<{ total: number, results: Array<object> }>}
 */
export async function getUserPrizeHistory(userId, { limit, offset }) {
  const [total, results] = await Promise.all([
    prisma.competitionResult.count({
      where: { horse: { userId } },
    }),
    prisma.competitionResult.findMany({
      where: { horse: { userId } },
      orderBy: { runDate: 'desc' },
      take: limit,
      skip: offset,
      include: {
        horse: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { total, results };
}
