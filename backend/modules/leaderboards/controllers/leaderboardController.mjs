/**
 * Leaderboard Controller
 * Provides ranked lists of top-performing horses and users based on various metrics
 */

import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';

const CACHE_TTL = 300; // 5 minutes

// Utility Functions
const calculateXpToNextLevel = currentLevelXp => {
  const xpPerLevel = 100;
  return xpPerLevel - currentLevelXp;
};

const calculateTotalXpForLevel = level => {
  const xpPerLevel = 100;
  return (level - 1) * xpPerLevel;
};

// Controllers
export const getTopUsersByLevel = async (req, res) => {
  const { limit, skip } = parsePaginationParams(req, { defaultLimit: 10, maxLimit: 100 });

  try {
    const cacheKey = `leaderboard:top-users:level:${limit}:${skip}`;
    const [users, totalUsers] = await getCachedQuery(
      cacheKey,
      () =>
        Promise.all([
          prisma.user.findMany({
            take: limit,
            skip,
            orderBy: [{ level: 'desc' }, { xp: 'desc' }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              level: true,
              xp: true,
              money: true,
            },
          }),
          prisma.user.count(),
        ]),
      CACHE_TTL,
    );

    const rankedUsers = users.map((user, index) => {
      const rank = skip + index + 1;
      const xpToNext = calculateXpToNextLevel(user.xp);
      const totalXp = calculateTotalXpForLevel(user.level) + user.xp;
      return {
        rank,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        level: user.level,
        xp: user.xp,
        xpToNext,
        money: user.money,
        totalXp,
      };
    });

    res.json({
      success: true,
      message: 'Top users by level retrieved successfully',
      data: {
        users: rankedUsers,
        pagination: {
          limit,
          offset: skip,
          total: totalUsers,
          hasMore: skip + limit < totalUsers,
        },
      },
    });
  } catch (error) {
    logger.error(`[leaderboardController.getTopUsersByLevel] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user level leaderboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

export const getTopUsersByXP = async (req, res) => {
  const { period = 'all' } = req.query;
  const { limit, skip } = parsePaginationParams(req, { defaultLimit: 10, maxLimit: 100 });

  try {
    const whereClause = {};
    if (period !== 'all') {
      const now = new Date();
      const periodMap = {
        week: 7,
        month: 30,
        year: 365,
      };
      const days = periodMap[period] || 0;
      if (days) {
        whereClause.timestamp = { gte: new Date(now.getTime() - days * 86400000) };
      }
    }

    const cacheKey = `leaderboard:top-users:xp:${period}:${limit}:${skip}`;
    const [xpData, totalRecords] = await getCachedQuery(
      cacheKey,
      async () => {
        const data = await prisma.xpEvent.groupBy({
          by: ['userId'],
          _sum: { amount: true },
          where: whereClause,
          orderBy: { _sum: { amount: 'desc' } },
          take: limit,
          skip,
        });
        const all = await prisma.xpEvent.groupBy({
          by: ['userId'],
          where: whereClause,
        });
        return [data, all];
      },
      CACHE_TTL,
    );

    const userIds = xpData.map(item => item.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = Object.fromEntries(
      users.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    const rankedUsers = xpData.map((item, index) => ({
      rank: skip + index + 1,
      userId: item.userId,
      name: userMap[item.userId] || 'Unknown',
      totalXp: item._sum.amount,
    }));

    res.json({
      success: true,
      message: `Top users by XP (${period}) retrieved successfully`,
      data: {
        users: rankedUsers,
        pagination: {
          limit,
          offset: skip,
          total: totalRecords.length,
          hasMore: skip + limit < totalRecords.length,
        },
      },
    });
  } catch (error) {
    logger.error(`[leaderboardController.getTopUsersByXP] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user XP leaderboard',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * GET /api/leaderboards/win-rate (and /api/leaderboards/horses/performance)
 *
 * Returns top horses ranked by MAX(CompetitionResult.score).
 *
 * Fixed in Equoria-847r: the prior implementation queried
 * prisma.horse.findMany({ orderBy: { performanceScore: 'desc' } }) which
 * references a non-existent `performanceScore` column on the Horse model,
 * causing PrismaClientValidationError → 500 on every request.
 *
 * Fix: two-step query —
 *   Step A: GROUP BY horseId on competition_results, take MAX(score) per horse
 *   Step B: fetch horse + breed + owner display fields for those horseIds
 */
export const getTopHorsesByPerformance = async (req, res) => {
  const limit = 10;

  try {
    const cacheKey = `leaderboard:top-horses:performance:${limit}`;

    const rankings = await getCachedQuery(
      cacheKey,
      async () => {
        // Step A: MAX score per horse from competition results, top N descending
        const topScores = await prisma.competitionResult.groupBy({
          by: ['horseId'],
          _max: { score: true },
          orderBy: { _max: { score: 'desc' } },
          take: limit,
        });

        if (topScores.length === 0) {
          return [];
        }

        // Step B: fetch horse + breed + owner display fields
        const horseIds = topScores.map(entry => entry.horseId);
        const horses = await prisma.horse.findMany({
          where: { id: { in: horseIds } },
          select: {
            id: true,
            name: true,
            breed: { select: { name: true } },
            user: { select: { firstName: true, lastName: true } },
          },
        });

        const horseMap = Object.fromEntries(horses.map(h => [h.id, h]));

        return topScores.map((entry, index) => {
          const horse = horseMap[entry.horseId];
          return {
            rank: index + 1,
            horseId: entry.horseId,
            name: horse?.name || 'Unknown',
            breed: horse?.breed?.name || 'Unknown',
            owner: horse?.user
              ? `${horse.user.firstName} ${horse.user.lastName}`.trim()
              : 'Unknown',
            maxScore: entry._max.score !== null ? Number(entry._max.score) : 0,
          };
        });
      },
      CACHE_TTL,
    );

    res.json({
      success: true,
      message: 'Top horses by performance retrieved successfully',
      data: { rankings },
    });
  } catch (error) {
    logger.error(`[leaderboardController.getTopHorsesByPerformance] Error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve horse performance leaderboard' });
  }
};

export const getTopHorsesByEarnings = async (req, res) => {
  const { breed } = req.query;
  const { limit, skip } = parsePaginationParams(req, { defaultLimit: 10, maxLimit: 100 });

  try {
    const whereClause = {
      totalEarnings: { gt: 0 },
    };

    if (breed) {
      whereClause.breed = { name: breed };
    }

    const cacheKey = `leaderboard:top-horses:earnings:${breed ?? 'all'}:${limit}:${skip}`;
    const [horses, totalHorses] = await getCachedQuery(
      cacheKey,
      () =>
        Promise.all([
          prisma.horse.findMany({
            select: {
              id: true,
              name: true,
              totalEarnings: true,
              userId: true,
              user: {
                select: { firstName: true, lastName: true },
              },
              breed: {
                select: { name: true },
              },
            },
            where: whereClause,
            orderBy: { totalEarnings: 'desc' },
            take: limit,
            skip,
          }),
          prisma.horse.count({ where: whereClause }),
        ]),
      CACHE_TTL,
    );

    const rankedHorses = horses.map((horse, index) => ({
      rank: skip + index + 1,
      horseId: horse.id,
      name: horse.name,
      earnings: horse.totalEarnings,
      ownerName: horse.user ? `${horse.user.firstName} ${horse.user.lastName}`.trim() : 'Unknown',
      breedName: horse.breed.name,
    }));

    res.json({
      success: true,
      message: 'Top horses by earnings retrieved successfully',
      data: {
        horses: rankedHorses,
        pagination: {
          limit,
          offset: skip,
          total: totalHorses,
          hasMore: skip + limit < totalHorses,
        },
      },
    });
  } catch (error) {
    logger.error(`[leaderboardController.getTopHorsesByEarnings] Error: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve horse earnings leaderboard' });
  }
};

export const getTopUsersByHorseEarnings = async (req, res) => {
  try {
    const cacheKey = 'leaderboard:top-users:horse-earnings';
    const result = await getCachedQuery(
      cacheKey,
      () =>
        prisma.horse.groupBy({
          by: ['userId'],
          _sum: { totalEarnings: true },
          orderBy: { _sum: { totalEarnings: 'desc' } },
          take: 10,
        }),
      CACHE_TTL,
    );

    const userIds = result.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = Object.fromEntries(
      users.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    const rankings = result.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      name: userMap[entry.userId] || 'Unknown',
      totalEarnings: entry._sum.totalEarnings,
    }));

    res.json({
      success: true,
      message: 'Top users by horse earnings retrieved successfully',
      data: { rankings },
    });
  } catch (error) {
    logger.error(`[leaderboardController.getTopUsersByHorseEarnings] Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve earnings leaderboard' });
  }
};

export const getRecentWinners = async (req, res) => {
  try {
    const { discipline } = req.query;
    const whereClause = {
      OR: [{ placement: '1' }, { placement: '1st' }],
    };

    if (discipline) {
      whereClause.discipline = discipline;
    }

    const cacheKey = `leaderboard:recent-winners:${discipline ?? 'all'}`;
    const results = await getCachedQuery(
      cacheKey,
      () =>
        prisma.competitionResult.findMany({
          where: whereClause,
          orderBy: { runDate: 'desc' },
          take: 10,
          select: {
            id: true,
            runDate: true,
            showName: true,
            discipline: true,
            horse: {
              select: {
                name: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        }),
      CACHE_TTL,
    );

    const winners = results.map(entry => ({
      id: entry.id,
      show: entry.showName,
      runDate: entry.runDate,
      horse: { name: entry.horse?.name || 'Unknown Horse' },
      owner: entry.horse?.user
        ? `${entry.horse.user.firstName} ${entry.horse.user.lastName}`.trim()
        : 'Unknown Owner',
      competition: { discipline: entry.discipline },
    }));

    const responseData = { winners };
    if (discipline) {
      responseData.discipline = discipline;
    }

    res.json({
      success: true,
      message: 'Recent winners retrieved successfully',
      data: responseData,
    });
  } catch (error) {
    logger.error(`[leaderboardController.getRecentWinners] Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve recent winners' });
  }
};

export const getLeaderboardStats = async (req, res) => {
  try {
    const cacheKey = 'leaderboard:stats';
    const stats = await getCachedQuery(
      cacheKey,
      async () => {
        const [userCount, horseCount, showCount, earningsAgg, xpAgg] = await Promise.all([
          prisma.user.count(),
          prisma.horse.count(),
          prisma.competitionResult.count(),
          prisma.horse.aggregate({ _sum: { totalEarnings: true } }),
          prisma.xpEvent.aggregate({ _sum: { amount: true } }),
        ]);
        return {
          userCount,
          horseCount,
          showCount,
          totalEarnings: earningsAgg._sum.totalEarnings || 0,
          totalXp: xpAgg._sum.amount || 0,
        };
      },
      CACHE_TTL,
    );

    res.json({
      success: true,
      message: 'Leaderboard stats retrieved',
      data: stats,
    });
  } catch (error) {
    logger.error(`[leaderboardController.getLeaderboardStats] Error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to retrieve leaderboard stats' });
  }
};

/**
 * GET /api/leaderboards/user-summary/:userId
 *
 * Returns a user's rank across all leaderboard categories plus their best
 * ranking achievements. Response shape matches frontend
 * `UserRankSummaryResponse` at frontend/src/lib/api/leaderboards.ts.
 *
 * Story 21S-1: closes the missing backend endpoint that
 * /leaderboards (classified beta-live) depends on.
 *
 * Not cached: user-specific, high cardinality.
 */
export const getUserRankSummary = async (req, res) => {
  const { userId } = req.params;

  // Validate UUID format before hitting Prisma to avoid PrismaClientKnownRequestError → 500
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid userId format',
    });
  }

  try {
    // 1) Fetch the target user. If missing, return 200 + empty arrays so the
    //    frontend dashboard can render an honest empty state instead of a 404
    //    during beta. (Frontend hook type is `UserRankSummaryResponse | null`.)
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, level: true, xp: true },
    });

    if (!targetUser) {
      return res.json({
        userId,
        userName: 'Unknown',
        rankings: [],
        bestRankings: [],
      });
    }

    const userName = `${targetUser.firstName} ${targetUser.lastName}`.trim() || 'Unknown';

    // Total users — used as totalEntries for level + xp categories
    const totalUsers = await prisma.user.count();

    // ─── Level rank ─────────────────────────────────────────────────────────
    // Rank by (level DESC, xp DESC) — count users strictly ahead, then +1.
    const usersAheadByLevel = await prisma.user.count({
      where: {
        OR: [
          { level: { gt: targetUser.level } },
          { AND: [{ level: targetUser.level }, { xp: { gt: targetUser.xp } }] },
        ],
      },
    });
    const levelRank = usersAheadByLevel + 1;

    // ─── XP rank ────────────────────────────────────────────────────────────
    // Rank by total XP earned across all xpEvents. Sum for target user first,
    // then use a raw SQL COUNT to avoid loading every user's xp into memory.
    const targetXpAgg = await prisma.xpEvent.aggregate({
      where: { userId: targetUser.id },
      _sum: { amount: true },
    });
    const targetXpTotal = targetXpAgg._sum.amount ?? 0;

    // Count users whose xp total strictly exceeds the target user's total via
    // a single indexed GROUP BY + HAVING query — no full table materialisation.
    const xpAheadResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS cnt
      FROM (
        SELECT "userId", COALESCE(SUM(amount), 0) AS total_xp
        FROM "xp_events"
        GROUP BY "userId"
        HAVING COALESCE(SUM(amount), 0) > ${targetXpTotal}
      ) sub
    `;
    const usersAheadByXp = xpAheadResult[0]?.cnt ?? 0;
    const xpRank = Number(usersAheadByXp) + 1;

    // ─── Horse-earnings rank ────────────────────────────────────────────────
    // Aggregate per-user horse earnings using a scoped SQL query — avoids
    // loading every horse row into Node memory for a simple rank computation.
    const targetEarningsAgg = await prisma.horse.aggregate({
      where: { userId: targetUser.id },
      _sum: { totalEarnings: true },
    });
    const targetEarningsTotal = targetEarningsAgg._sum.totalEarnings ?? 0;

    const earningsAheadResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS cnt
      FROM (
        SELECT "userId", COALESCE(SUM("totalEarnings"), 0) AS total_earnings
        FROM "horses"
        WHERE "userId" IS NOT NULL
        GROUP BY "userId"
        HAVING COALESCE(SUM("totalEarnings"), 0) > ${targetEarningsTotal}
      ) sub
    `;
    const usersAheadByEarnings = earningsAheadResult[0]?.cnt ?? 0;
    const earningsRank = Number(usersAheadByEarnings) + 1;

    // ─── Horse-performance rank ────────────────────────────────────────────
    // primaryStat = MAX(competitionResult.score) across horses owned by user.
    // Use a raw SQL JOIN + GROUP BY to count users with a better max score —
    // avoids pulling every competition result into Node memory.
    const targetPerfAgg = await prisma.competitionResult.aggregate({
      where: { horse: { userId: targetUser.id } },
      _max: { score: true },
    });
    const targetPerfMax = targetPerfAgg._max.score ? Number(targetPerfAgg._max.score) : 0;

    const perfAheadResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS cnt
      FROM (
        SELECT h."userId", MAX(cr.score) AS best_score
        FROM "competition_results" cr
        JOIN "horses" h ON cr."horseId" = h.id
        WHERE h."userId" IS NOT NULL
        GROUP BY h."userId"
        HAVING MAX(cr.score) > ${targetPerfMax}
      ) sub
    `;
    const usersAheadByPerformance = perfAheadResult[0]?.cnt ?? 0;
    const performanceRank = Number(usersAheadByPerformance) + 1;

    // totalEntries denominator for horse-* categories — prefer distinct owner
    // count so the display matches "rank 3 of N owners", not "of all users".
    const horseOwnerCount = await prisma.user.count({
      where: { horses: { some: {} } },
    });

    // Fetch the most recent snapshot per category so we can compute rankChange.
    // rankChange = previousRank - currentRank (positive means rank improved).
    let snapshotMap = {};
    try {
      const snapshots = await prisma.$queryRaw`
        SELECT DISTINCT ON (category) category, rank
        FROM user_rank_snapshots
        WHERE "userId" = ${userId}
        ORDER BY category, "capturedAt" DESC
      `;
      snapshotMap = Object.fromEntries(snapshots.map(s => [s.category, Number(s.rank)]));
    } catch (_snapshotErr) {
      // Table may not exist in older envs — fall back to rankChange: 0
    }

    const rankings = [
      {
        category: 'level',
        categoryLabel: 'Level',
        rank: levelRank,
        totalEntries: totalUsers,
        rankChange: snapshotMap['level'] != null ? snapshotMap['level'] - levelRank : 0,
        primaryStat: targetUser.level,
        statLabel: 'Level',
      },
      {
        category: 'xp',
        categoryLabel: 'XP',
        rank: xpRank,
        // Every xp_event has a user FK, so totalUsers >= xpGrouped.length.
        totalEntries: totalUsers,
        rankChange: snapshotMap['xp'] != null ? snapshotMap['xp'] - xpRank : 0,
        primaryStat: targetXpTotal,
        statLabel: 'XP',
      },
      {
        category: 'horse-earnings',
        categoryLabel: 'Horse Earnings',
        rank: earningsRank,
        // Guard: if target has zero horses, their rank can be horseOwnerCount + 1.
        // Ensure totalEntries >= rank so the UI never renders "#N of M<N".
        totalEntries: Math.max(horseOwnerCount, earningsRank),
        rankChange: snapshotMap['horse-earnings'] != null ? snapshotMap['horse-earnings'] - earningsRank : 0,
        primaryStat: targetEarningsTotal,
        statLabel: 'Earnings',
      },
      {
        category: 'horse-performance',
        categoryLabel: 'Horse Performance',
        rank: performanceRank,
        totalEntries: Math.max(horseOwnerCount, performanceRank),
        rankChange: snapshotMap['horse-performance'] != null ? snapshotMap['horse-performance'] - performanceRank : 0,
        primaryStat: targetPerfMax,
        statLabel: 'Score',
      },
    ];

    // Best rankings — rank ≤ 10 → "Top 10", ≤ 100 → "Top 100", else omit.
    const bestRankings = rankings
      .filter(r => r.rank <= 100)
      .map(r => ({
        category: r.category,
        categoryLabel: r.categoryLabel,
        rank: r.rank,
        achievement: r.rank <= 10 ? 'Top 10' : 'Top 100',
      }));

    return res.json({
      userId: targetUser.id,
      userName,
      rankings,
      bestRankings,
    });
  } catch (error) {
    logger.error(`[leaderboardController.getUserRankSummary] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user rank summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

/**
 * POST /api/v1/leaderboards/admin/capture-rank-snapshots
 * Admin-only: capture current ranks for all users into user_rank_snapshots.
 * Intended to be called nightly (e.g., via Railway cron or an external scheduler).
 */
export const captureRankSnapshots = async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    let captured = 0;

    for (const { id: userId } of users) {
      // Re-use the same rank computations from getUserRankSummary
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
        prisma.competitionResult.aggregate({ where: { horse: { userId } }, _max: { score: true } }),
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
        await prisma.$executeRaw`
          INSERT INTO user_rank_snapshots ("userId", category, rank, "capturedAt")
          VALUES (${row.userId}, ${row.category}, ${row.rank}, NOW())
        `;
      }
      captured++;
    }

    return res.json({ success: true, message: `Captured rank snapshots for ${captured} users` });
  } catch (error) {
    logger.error(`[leaderboardController.captureRankSnapshots] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to capture rank snapshots' });
  }
};

// Aliases
export const getTopPlayersByLevel = getTopUsersByLevel;
export const getTopPlayersByXP = getTopUsersByXP;
export const getTopPlayersByHorseEarnings = getTopUsersByHorseEarnings;

// Export block
export default {
  getTopUsersByLevel,
  getTopPlayersByLevel,
  getTopUsersByXP,
  getTopPlayersByXP,
  getTopHorsesByEarnings,
  getTopHorsesByPerformance,
  getTopUsersByHorseEarnings,
  getTopPlayersByHorseEarnings,
  getRecentWinners,
  getLeaderboardStats,
  getUserRankSummary,
  captureRankSnapshots,
};
