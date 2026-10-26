/**
 * Leaderboard Controller
 * Provides ranked lists of top-performing horses and users based on various metrics
 */

import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';
import { isKnownDiscipline } from '../../competition/index.mjs';
import {
  loadPlayerStanding,
  playerBoardLabels,
  playerBoardNames,
} from '../services/boardService.mjs';

const CACHE_TTL = 300; // 5 minutes

/**
 * Page window for a leaderboard. The documented `offset` (swagger) wins over
 * `page` when it is a valid non-negative integer; `limit` is clamped by
 * parsePaginationParams (Equoria-9svu0).
 */
const leaderboardPaging = (req, options) => {
  const { limit, skip } = parsePaginationParams(req, options);
  const offset = Number.parseInt(req.query.offset, 10);
  return { limit, skip: Number.isInteger(offset) && offset >= 0 ? offset : skip };
};

// Controllers
export const getTopUsersByXP = async (req, res) => {
  const { period = 'all' } = req.query;
  const { limit, skip } = leaderboardPaging(req, { defaultLimit: 10, maxLimit: 100 });

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
    const [xpData, totalUsers] = await getCachedQuery(
      cacheKey,
      async () => {
        const data = await prisma.xpEvent.groupBy({
          by: ['userId'],
          _sum: { amount: true },
          where: whereClause,
          orderBy: [{ _sum: { amount: 'desc' } }, { userId: 'asc' }],
          take: limit,
          skip,
        });
        // Equoria-4qpqb: the total is a SQL COUNT, not one group per user in memory.
        const since = whereClause.timestamp?.gte;
        const [{ cnt }] = await prisma.$queryRaw(Prisma.sql`
          SELECT COUNT(DISTINCT "userId")::int AS cnt
          FROM "xp_events"
          ${since ? Prisma.sql`WHERE "timestamp" >= ${since}` : Prisma.empty}
        `);
        return [data, Number(cnt)];
      },
      CACHE_TTL,
    );

    const userIds = xpData.map(item => item.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });

    const userMap = Object.fromEntries(users.map(u => [u.id, u.username]));

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
          total: totalUsers,
          hasMore: skip + limit < totalUsers,
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
 * GET /api/leaderboards/horses/performance (/win-rate is horseRecordBoardsController, xxdqh)
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
  // Equoria-9svu0: the documented limit (default 10, max 100), offset and
  // discipline are honoured. An unknown discipline is a 400, as on /competition.
  const { limit, skip } = leaderboardPaging(req, { defaultLimit: 10, maxLimit: 100 });
  const { discipline } = req.query;
  if (discipline !== undefined && !isKnownDiscipline(discipline)) {
    return res.status(400).json({ success: false, message: 'Invalid discipline' });
  }

  try {
    const cacheKey = `leaderboard:top-horses:performance:${discipline ?? 'all'}:${limit}:${skip}`;

    const rankings = await getCachedQuery(
      cacheKey,
      async () => {
        // Step A: MAX score per horse from competition results, top N descending
        const topScores = await prisma.competitionResult.groupBy({
          by: ['horseId'],
          where: discipline ? { discipline } : {},
          _max: { score: true },
          orderBy: [{ _max: { score: 'desc' } }, { horseId: 'asc' }],
          take: limit,
          skip,
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
            user: { select: { username: true } },
          },
        });

        const horseMap = Object.fromEntries(horses.map(h => [h.id, h]));

        return topScores.map((entry, index) => {
          const horse = horseMap[entry.horseId];
          return {
            rank: skip + index + 1,
            horseId: entry.horseId,
            name: horse?.name || 'Unknown',
            breed: horse?.breed?.name || 'Unknown',
            owner: horse?.user?.username || 'Unknown',
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
  const { limit, skip } = leaderboardPaging(req, { defaultLimit: 10, maxLimit: 100 });

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
                select: { username: true },
              },
              breed: {
                select: { name: true },
              },
            },
            where: whereClause,
            orderBy: [{ totalEarnings: 'desc' }, { id: 'asc' }],
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
      ownerName: horse.user?.username || 'Unknown',
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
  const { limit, skip } = leaderboardPaging(req, { defaultLimit: 10, maxLimit: 100 });
  try {
    const cacheKey = `leaderboard:top-users:horse-earnings:${limit}:${skip}`;
    const result = await getCachedQuery(
      cacheKey,
      () =>
        prisma.horse.groupBy({
          by: ['userId'],
          _sum: { totalEarnings: true },
          orderBy: [{ _sum: { totalEarnings: 'desc' } }, { userId: 'asc' }],
          take: limit,
          skip,
        }),
      CACHE_TTL,
    );

    const userIds = result.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true },
    });

    const userMap = Object.fromEntries(users.map(u => [u.id, u.username]));

    const rankings = result.map((entry, index) => ({
      rank: skip + index + 1,
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
      select: { id: true, username: true },
    });

    if (!targetUser) {
      return res.json({
        userId,
        userName: 'Unknown',
        rankings: [],
        bestRankings: [],
      });
    }

    const userName = targetUser.username || 'Unknown';

    // Equoria-3kfne: the player's place on each player board (owner rulings
    // q10, q11), counted exactly as the board page counts it. A board the player
    // is not on (no XP, no earnings, no wins, fewer than 100 shows) is left out
    // rather than given a made-up place.
    const standings = await Promise.all(
      playerBoardNames.map(board => loadPlayerStanding(board, targetUser.id)),
    );

    const rankings = [];
    playerBoardNames.forEach((category, index) => {
      const standing = standings[index];
      if (!standing) {
        return;
      }
      rankings.push({
        category,
        categoryLabel: playerBoardLabels[category].categoryLabel,
        rank: standing.rank,
        totalEntries: standing.total,
        primaryStat: standing.primaryStat,
        statLabel: playerBoardLabels[category].statLabel,
      });
    });

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

// Aliases
export const getTopPlayersByXP = getTopUsersByXP;
export const getTopPlayersByHorseEarnings = getTopUsersByHorseEarnings;

// Export block
export default {
  getTopUsersByXP,
  getTopPlayersByXP,
  getTopHorsesByEarnings,
  getTopHorsesByPerformance,
  getTopUsersByHorseEarnings,
  getTopPlayersByHorseEarnings,
  getLeaderboardStats,
  getUserRankSummary,
};
