/**
 * userRankSnapshotService.mjs
 *
 * Equoria-dbdk — Scheduled capture of UserRankSnapshot rows.
 *
 * Mirrors the inner logic of leaderboardController.captureRankSnapshots so the
 * nightly cron can write snapshots without going through the admin HTTP route.
 * The controller endpoint remains the manual/admin path; this service is the
 * scheduled-job path.
 *
 * Side note (out of scope): the controller still uses raw SQL for three of the
 * four "users ahead" subqueries. Migrating those to Prisma queries is tracked
 * by a separate architectural-cleanup issue and is not done here so that the
 * cron output is byte-identical to the existing admin endpoint output.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Capture one batch of rank snapshots (level, xp, horse-earnings, horse-performance)
 * for every user. Returns the number of users processed.
 *
 * @returns {Promise<{captured: number}>}
 */
export async function captureAllUserRankSnapshots() {
  const users = await prisma.user.findMany({ select: { id: true } });
  let captured = 0;

  for (const { id: userId } of users) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { level: true, xp: true },
      });
      if (!user) continue;

      const [usersAheadLevel, targetXpAgg, targetEarningsAgg, targetPerfAgg] = await Promise.all([
        prisma.user.count({
          where: {
            OR: [
              { level: { gt: user.level } },
              { AND: [{ level: user.level }, { xp: { gt: user.xp } }] },
            ],
          },
        }),
        prisma.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } }),
        prisma.horse.aggregate({ where: { userId }, _sum: { totalEarnings: true } }),
        prisma.competitionResult.aggregate({
          where: { horse: { userId } },
          _max: { score: true },
        }),
      ]);

      const targetXpTotal = targetXpAgg._sum.amount ?? 0;
      const targetEarnings = targetEarningsAgg._sum.totalEarnings ?? 0;
      const targetPerf = targetPerfAgg._max.score ? Number(targetPerfAgg._max.score) : 0;

      const [xpAhead, earningsAhead, perfAhead] = await Promise.all([
        prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM (SELECT "userId", COALESCE(SUM(amount),0) AS t FROM xp_events GROUP BY "userId" HAVING COALESCE(SUM(amount),0) > ${targetXpTotal}) sub`,
        prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM (SELECT "userId", COALESCE(SUM("totalEarnings"),0) AS t FROM horses WHERE "userId" IS NOT NULL GROUP BY "userId" HAVING COALESCE(SUM("totalEarnings"),0) > ${targetEarnings}) sub`,
        prisma.$queryRaw`SELECT COUNT(*)::int AS cnt FROM (SELECT h."userId", MAX(cr.score) AS s FROM competition_results cr JOIN horses h ON cr."horseId"=h.id WHERE h."userId" IS NOT NULL GROUP BY h."userId" HAVING MAX(cr.score) > ${targetPerf}) sub`,
      ]);

      const rows = [
        { userId, category: 'level', rank: Number(usersAheadLevel) + 1 },
        { userId, category: 'xp', rank: Number(xpAhead[0]?.cnt ?? 0) + 1 },
        { userId, category: 'horse-earnings', rank: Number(earningsAhead[0]?.cnt ?? 0) + 1 },
        { userId, category: 'horse-performance', rank: Number(perfAhead[0]?.cnt ?? 0) + 1 },
      ];

      for (const row of rows) {
        await prisma.userRankSnapshot.create({
          data: { userId: row.userId, category: row.category, rank: row.rank },
        });
      }
      captured++;
    } catch (perUserErr) {
      // Don't let one user's failure abort the whole pass.
      logger.warn(
        `[userRankSnapshotService.captureAllUserRankSnapshots] Skipping user ${userId} after error: ${perUserErr.message}`,
      );
    }
  }

  logger.info(
    `[userRankSnapshotService.captureAllUserRankSnapshots] Captured rank snapshots for ${captured} users`,
  );
  return { captured };
}
