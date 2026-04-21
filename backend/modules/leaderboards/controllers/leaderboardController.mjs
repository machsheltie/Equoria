/**
 * Leaderboard Controller
 * Provides ranked lists of top-performing horses and users based on various metrics
 */

import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';

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
  const { limit = 10, offset = 0 } = req.query;
  const numericLimit = parseInt(limit, 10);
  const numericOffset = parseInt(offset, 10);

  try {
    const users = await prisma.user.findMany({
      take: numericLimit,
      skip: numericOffset,
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        level: true,
        xp: true,
        money: true,
      },
    });

    const totalUsers = await prisma.user.count();

    const rankedUsers = users.map((user, index) => {
      const rank = numericOffset + index + 1;
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
          limit: numericLimit,
          offset: numericOffset,
          total: totalUsers,
          hasMore: numericOffset + numericLimit < totalUsers,
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
  const { period = 'all', limit = 10, offset = 0 } = req.query;
  const numericLimit = parseInt(limit, 10);
  const numericOffset = parseInt(offset, 10);

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

    const xpData = await prisma.xpEvent.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      where: whereClause,
      orderBy: { _sum: { amount: 'desc' } },
      take: numericLimit,
      skip: numericOffset,
    });

    const totalRecords = await prisma.xpEvent.groupBy({
      by: ['userId'],
      where: whereClause,
    });

    const userIds = xpData.map(item => item.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = Object.fromEntries(
      users.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim()]),
    );

    const rankedUsers = xpData.map((item, index) => ({
      rank: numericOffset + index + 1,
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
          limit: numericLimit,
          offset: numericOffset,
          total: totalRecords.length,
          hasMore: numericOffset + numericLimit < totalRecords.length,
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

export const getTopHorsesByPerformance = async (req, res) => {
  try {
    const horses = await prisma.horse.findMany({
      orderBy: { performanceScore: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        breed: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        performanceScore: true,
      },
    });

    const rankings = horses.map((horse, index) => ({
      rank: index + 1,
      horseId: horse.id,
      name: horse.name,
      breed: horse.breed?.name || 'Unknown',
      owner: horse.user ? `${horse.user.firstName} ${horse.user.lastName}`.trim() : 'Unknown',
      performanceScore: horse.performanceScore,
    }));

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
  const { limit = 10, offset = 0, breed } = req.query;
  const numericLimit = parseInt(limit, 10);
  const numericOffset = parseInt(offset, 10);

  try {
    const whereClause = {
      totalEarnings: { gt: 0 },
    };

    if (breed) {
      whereClause.breed = { name: breed };
    }

    const horses = await prisma.horse.findMany({
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
      take: numericLimit,
      skip: numericOffset,
    });

    const totalHorses = await prisma.horse.count({
      where: whereClause,
    });

    const rankedHorses = horses.map((horse, index) => ({
      rank: numericOffset + index + 1,
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
          limit: numericLimit,
          offset: numericOffset,
          total: totalHorses,
          hasMore: numericOffset + numericLimit < totalHorses,
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
    const result = await prisma.horse.groupBy({
      by: ['userId'],
      _sum: { totalEarnings: true },
      orderBy: { _sum: { totalEarnings: 'desc' } },
      take: 10,
    });

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

    const results = await prisma.competitionResult.findMany({
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
    });

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
    const userCount = await prisma.user.count();
    const horseCount = await prisma.horse.count();
    const showCount = await prisma.competitionResult.count();

    const { _sum: earningsSum } = await prisma.horse.aggregate({
      _sum: { totalEarnings: true },
    });

    const { _sum: xpSum } = await prisma.xpEvent.aggregate({
      _sum: { amount: true },
    });

    res.json({
      success: true,
      message: 'Leaderboard stats retrieved',
      data: {
        userCount,
        horseCount,
        showCount,
        totalEarnings: earningsSum.totalEarnings || 0,
        totalXp: xpSum.amount || 0,
      },
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
 */
export const getUserRankSummary = async (req, res) => {
  const { userId } = req.params;

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
    // then count users with strictly greater sum.
    // TODO(perf, post-beta): replace full `groupBy` scan with a SQL
    // aggregation/materialized view once the xp_events table grows large.
    const targetXpAgg = await prisma.xpEvent.aggregate({
      where: { userId: targetUser.id },
      _sum: { amount: true },
    });
    const targetXpTotal = targetXpAgg._sum.amount ?? 0;

    const xpGrouped = await prisma.xpEvent.groupBy({
      by: ['userId'],
      _sum: { amount: true },
    });
    const usersAheadByXp = xpGrouped.filter(g => (g._sum.amount ?? 0) > targetXpTotal).length;
    const xpRank = usersAheadByXp + 1;

    // ─── Horse-earnings rank ────────────────────────────────────────────────
    // TODO(perf, post-beta): `horse.groupBy` scans all rows; move to a
    // materialized `user_earnings_totals` view if latency climbs.
    const targetEarningsAgg = await prisma.horse.aggregate({
      where: { userId: targetUser.id },
      _sum: { totalEarnings: true },
    });
    const targetEarningsTotal = targetEarningsAgg._sum.totalEarnings ?? 0;

    const earningsGrouped = await prisma.horse.groupBy({
      by: ['userId'],
      _sum: { totalEarnings: true },
      where: { userId: { not: null } },
    });
    const usersAheadByEarnings = earningsGrouped.filter(
      g => (g._sum.totalEarnings ?? 0) > targetEarningsTotal,
    ).length;
    const earningsRank = usersAheadByEarnings + 1;

    // ─── Horse-performance rank ────────────────────────────────────────────
    // primaryStat = MAX(competitionResult.score) across horses owned by user.
    // Rank by counting users whose best-horse max-score exceeds target's.
    // TODO(perf, post-beta): this pulls every competition result into memory
    // to reduce to per-owner max. Acceptable at beta scale (~10K rows);
    // replace with a raw SQL aggregate
    //   SELECT h.user_id, MAX(cr.score) FROM competition_results cr
    //   JOIN horses h ON cr.horse_id = h.id GROUP BY h.user_id
    // once beta stabilizes.
    const targetPerfAgg = await prisma.competitionResult.aggregate({
      where: { horse: { userId: targetUser.id } },
      _max: { score: true },
    });
    const targetPerfMax = targetPerfAgg._max.score ? Number(targetPerfAgg._max.score) : 0;

    // Per-user best horse score. Pull all competition results, reduce to max per owner.
    const allResults = await prisma.competitionResult.findMany({
      select: {
        score: true,
        horse: { select: { userId: true } },
      },
    });
    const perUserBest = new Map();
    for (const r of allResults) {
      const ownerId = r.horse?.userId;
      if (!ownerId) {
        continue;
      }
      const s = Number(r.score);
      const current = perUserBest.get(ownerId) ?? 0;
      if (s > current) {
        perUserBest.set(ownerId, s);
      }
    }
    const usersAheadByPerformance = [...perUserBest.values()].filter(v => v > targetPerfMax).length;
    const performanceRank = usersAheadByPerformance + 1;

    // totalEntries denominator for horse-* categories — prefer distinct owner
    // count so the display matches "rank 3 of N owners", not "of all users".
    const horseOwnerCount = await prisma.user.count({
      where: { horses: { some: {} } },
    });

    const rankings = [
      {
        category: 'level',
        categoryLabel: 'Level',
        rank: levelRank,
        totalEntries: totalUsers,
        rankChange: 0,
        primaryStat: targetUser.level,
        statLabel: 'Level',
      },
      {
        category: 'xp',
        categoryLabel: 'XP',
        rank: xpRank,
        // Every xp_event has a user FK, so totalUsers >= xpGrouped.length.
        totalEntries: totalUsers,
        rankChange: 0,
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
        rankChange: 0,
        primaryStat: targetEarningsTotal,
        statLabel: 'Earnings',
      },
      {
        category: 'horse-performance',
        categoryLabel: 'Horse Performance',
        rank: performanceRank,
        totalEntries: Math.max(horseOwnerCount, performanceRank),
        rankChange: 0,
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
};
