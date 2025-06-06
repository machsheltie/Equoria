/**
 * Leaderboard Controller
 * Provides ranked lists of top-performing horses and users based on various metrics
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

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
        name: true,
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
        name: user.name,
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
      select: { id: true, name: true },
    });

    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

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
        user: { select: { name: true } },
        performanceScore: true,
      },
    });

    const rankings = horses.map((horse, index) => ({
      rank: index + 1,
      horseId: horse.id,
      name: horse.name,
      breed: horse.breed?.name || 'Unknown',
      owner: horse.user?.name || 'Unknown',
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
      total_earnings: { gt: 0 },
    };

    if (breed) {
      whereClause.breed = { name: breed };
    }

    const horses = await prisma.horse.findMany({
      select: {
        id: true,
        name: true,
        total_earnings: true,
        userId: true,
        user: {
          select: { name: true },
        },
        breed: {
          select: { name: true },
        },
      },
      where: whereClause,
      orderBy: { total_earnings: 'desc' },
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
      earnings: horse.total_earnings,
      ownerName: horse.user.name,
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
      _sum: { total_earnings: true },
      orderBy: { _sum: { total_earnings: 'desc' } },
      take: 10,
    });

    const userIds = result.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    const rankings = result.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      name: userMap[entry.userId] || 'Unknown',
      totalEarnings: entry._sum.total_earnings,
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
    const results = await prisma.competitionEntry.findMany({
      where: { placement: 1 },
      orderBy: { runDate: 'desc' },
      take: 10,
      select: {
        id: true,
        runDate: true,
        showName: true,
        horse: {
          select: {
            name: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    const winners = results.map(entry => ({
      id: entry.id,
      show: entry.showName,
      runDate: entry.runDate,
      horse: entry.horse?.name || 'Unknown Horse',
      owner: entry.horse?.user?.name || 'Unknown Owner',
    }));

    res.json({
      success: true,
      message: 'Recent winners retrieved successfully',
      data: { winners },
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
    const showCount = await prisma.competitionEntry.count();

    const { _sum: earningsSum } = await prisma.horse.aggregate({
      _sum: { total_earnings: true },
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
        totalEarnings: earningsSum.total_earnings || 0,
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
};
