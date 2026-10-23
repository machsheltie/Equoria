/**
 * A show's recorded score inputs, read for staff (Equoria-4q02c).
 *
 * Owner ruling q01 (2026-10-23): the luck roll and the other factors that made
 * each entry's score are recorded on its result and visible only to the Owner
 * and Admins. This reads them for GET /api/v1/staff/shows/:showId/score-inputs
 * (capability results.scoreInputs.view). Staff module reads CompetitionResult
 * directly, like quarantinedShowsService, so it takes no dependency on the
 * competition module.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * @param {number} showId
 * @param {Object} [client] - Prisma client (default: the shared one)
 * @returns {Promise<Array<{ horseId: number, horseName: string|null,
 *   placement: number|null, score: number, scoreInputs: object|null }>>}
 *   best placement first; scoreInputs is null on results recorded before the
 *   inputs were kept.
 */
export async function listShowScoreInputs(showId, client = prisma) {
  const rows = await client.competitionResult.findMany({
    where: { showId },
    select: {
      horseId: true,
      placement: true,
      score: true,
      scoreInputs: true,
      horse: { select: { name: true } },
    },
    orderBy: [{ placement: 'asc' }, { horseId: 'asc' }],
  });
  return rows.map(({ horse, score, ...row }) => ({
    ...row,
    horseName: horse?.name ?? null,
    score: Number(score),
  }));
}
