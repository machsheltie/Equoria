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

// Aliases
export const getTopPlayersByLevel = getTopUsersByLevel;
export const getTopPlayersByXP = getTopUsersByXP;
export const getTopPlayersByHorseEarnings = getTopUsersByHorseEarnings;

/**
 * Get a user's ranking summary across all leaderboard categories
 */
export const getUserRankSummary = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, firstName: true, lastName: true, level: true, xp: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userName = `${user.firstName} ${user.lastName}`.trim() || user.username;

    // Helper to get user rank in a category
    const getRank = async (category, value, orderByField, isHorseQuery = false) => {
      let count;
      if (isHorseQuery) {
        // Aggregate horse stats per user
        const results = await prisma.horse.groupBy({
          by: ['userId'],
          _sum: { [orderByField]: true },
          where: { [orderByField]: { gt: 0 } },
          having: {
            [orderByField]: {
              _sum: { gt: value },
            },
          },
        });
        count = results.length;
      } else {
        // Simple user stat
        count = await prisma.user.count({
          where: {
            [orderByField]: { gt: value },
          },
        });
      }
      return count + 1;
    };

    // Calculate total horse earnings for this user
    const horseEarnings = await prisma.horse.aggregate({
      where: { userId },
      _sum: { totalEarnings: true },
    });
    const totalEarnings = Number(horseEarnings._sum.totalEarnings) || 0;

    // Calculate total horses owned
    const totalHorses = await prisma.horse.count({
      where: { userId },
    });

    // Get total entries in each category for percentages
    const totalUsers = await prisma.user.count();
    const userWithHorsesCount = await prisma.horse.groupBy({ by: ['userId'] }).then(r => r.length);

    const rankings = [
      {
        category: 'level',
        categoryLabel: 'User Level',
        rank: await getRank('level', user.level, 'level'),
        totalEntries: totalUsers,
        rankChange: 0, // Placeholder as we don't track history yet
        primaryStat: user.level,
        statLabel: 'Level',
      },
      {
        category: 'prize-money',
        categoryLabel: 'Horse Earnings',
        rank: await getRank('prize-money', totalEarnings, 'totalEarnings', true),
        totalEntries: userWithHorsesCount,
        rankChange: 0,
        primaryStat: totalEarnings,
        statLabel: 'Total $',
      },
      {
        category: 'horse-count',
        categoryLabel: 'Stable Size',
        rank: await (async () => {
          const results = await prisma.horse.groupBy({
            by: ['userId'],
            _count: { id: true },
            having: { id: { _count: { gt: totalHorses } } },
          });
          return results.length + 1;
        })(),
        totalEntries: userWithHorsesCount,
        rankChange: 0,
        primaryStat: totalHorses,
        statLabel: 'Horses',
      },
    ];

    // Best Rankings (Top 3 achievements)
    const bestRankings = rankings
      .filter(r => r.rank <= 100)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map(r => ({
        category: r.category,
        categoryLabel: r.categoryLabel,
        rank: r.rank,
        achievement: r.rank <= 10 ? 'Top 10' : 'Top 100',
      }));

    res.json({
      success: true,
      message: 'User rank summary retrieved successfully',
      data: {
        userId: user.id,
        userName,
        rankings,
        bestRankings,
      },
    });
  } catch (error) {
    logger.error(`[leaderboardController.getUserRankSummary] Error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user rank summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
};

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
