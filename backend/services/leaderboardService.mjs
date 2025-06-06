/**
 * Leaderboard Service
 * Handles leaderboard data retrieval and ranking logic
 */

import { logger } from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Get top users by XP
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of users to return (default: 10)
 * @param {number} options.offset - Number of users to skip (default: 0)
 * @returns {Array} Top users by XP
 */
export async function getTopUsersByXp(options = {}) {
  try {
    const { limit = 10, offset = 0 } = options;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        level: true,
        xp: true,
        money: true,
        createdAt: true,
      },
      orderBy: [
        { xp: 'desc' },
        { level: 'desc' },
        { createdAt: 'asc' }, // Earlier users rank higher in ties
      ],
      take: Math.min(limit, 100), // Cap at 100
      skip: Math.max(offset, 0),
    });

    // Add ranking
    const rankedUsers = users.map((user, index) => ({
      ...user,
      rank: offset + index + 1,
    }));

    logger.info(
      `[leaderboardService.getTopUsersByXp] Retrieved ${users.length} users for leaderboard`,
    );

    return rankedUsers;
  } catch (error) {
    logger.error(
      `[leaderboardService.getTopUsersByXp] Error retrieving XP leaderboard: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Get top users by level
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of users to return (default: 10)
 * @param {number} options.offset - Number of users to skip (default: 0)
 * @returns {Array} Top users by level
 */
export async function getTopUsersByLevel(options = {}) {
  try {
    const { limit = 10, offset = 0 } = options;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        level: true,
        xp: true,
        money: true,
        createdAt: true,
      },
      orderBy: [{ level: 'desc' }, { xp: 'desc' }, { createdAt: 'asc' }],
      take: Math.min(limit, 100),
      skip: Math.max(offset, 0),
    });

    const rankedUsers = users.map((user, index) => ({
      ...user,
      rank: offset + index + 1,
    }));

    logger.info(
      `[leaderboardService.getTopUsersByLevel] Retrieved ${users.length} users for level leaderboard`,
    );

    return rankedUsers;
  } catch (error) {
    logger.error(
      `[leaderboardService.getTopUsersByLevel] Error retrieving level leaderboard: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Get top users by money/earnings
 * @param {Object} options - Query options
 * @param {number} options.limit - Number of users to return (default: 10)
 * @param {number} options.offset - Number of users to skip (default: 0)
 * @returns {Array} Top users by money
 */
export async function getTopUsersByMoney(options = {}) {
  try {
    const { limit = 10, offset = 0 } = options;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        level: true,
        xp: true,
        money: true,
        createdAt: true,
      },
      orderBy: [{ money: 'desc' }, { level: 'desc' }, { createdAt: 'asc' }],
      take: Math.min(limit, 100),
      skip: Math.max(offset, 0),
    });

    const rankedUsers = users.map((user, index) => ({
      ...user,
      rank: offset + index + 1,
    }));

    logger.info(
      `[leaderboardService.getTopUsersByMoney] Retrieved ${users.length} users for money leaderboard`,
    );

    return rankedUsers;
  } catch (error) {
    logger.error(
      `[leaderboardService.getTopUsersByMoney] Error retrieving money leaderboard: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Get user's rank in XP leaderboard
 * @param {string} userId - User ID
 * @returns {Object} User's rank and stats
 */
export async function getUserXpRank(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        level: true,
        xp: true,
        money: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Count users with higher XP
    const higherXpCount = await prisma.user.count({
      where: {
        OR: [
          { xp: { gt: user.xp } },
          {
            AND: [{ xp: user.xp }, { level: { gt: user.level } }],
          },
          {
            AND: [{ xp: user.xp }, { level: user.level }, { createdAt: { lt: user.createdAt } }],
          },
        ],
      },
    });

    const rank = higherXpCount + 1;

    // Get total user count
    const totalUsers = await prisma.user.count();

    logger.info(`[leaderboardService.getUserXpRank] User ${userId} rank: ${rank}/${totalUsers}`);

    return {
      ...user,
      rank,
      totalUsers,
      percentile: Math.round(((totalUsers - rank) / totalUsers) * 100),
    };
  } catch (error) {
    logger.error(
      `[leaderboardService.getUserXpRank] Error getting user rank for ${userId}: ${error.message}`,
    );
    throw error;
  }
}

/**
 * Get leaderboard statistics
 * @returns {Object} Leaderboard statistics
 */
export async function getLeaderboardStats() {
  try {
    const stats = await prisma.user.aggregate({
      _count: {
        id: true,
      },
      _avg: {
        level: true,
        xp: true,
        money: true,
      },
      _max: {
        level: true,
        xp: true,
        money: true,
      },
      _min: {
        level: true,
        xp: true,
        money: true,
      },
    });

    logger.info('[leaderboardService.getLeaderboardStats] Retrieved leaderboard statistics');

    return {
      totalUsers: stats._count.id,
      averageLevel: Math.round(stats._avg.level || 0),
      averageXp: Math.round(stats._avg.xp || 0),
      averageMoney: Math.round(stats._avg.money || 0),
      maxLevel: stats._max.level || 0,
      maxXp: stats._max.xp || 0,
      maxMoney: stats._max.money || 0,
      minLevel: stats._min.level || 0,
      minXp: stats._min.xp || 0,
      minMoney: stats._min.money || 0,
    };
  } catch (error) {
    logger.error(
      `[leaderboardService.getLeaderboardStats] Error getting leaderboard stats: ${error.message}`,
    );
    throw error;
  }
}

// Backward compatibility aliases
export const getTopPlayersByXP = getTopUsersByXp;
export const getTopPlayersByLevel = getTopUsersByLevel;
export const getTopPlayersByMoney = getTopUsersByMoney;
export const getPlayerXpRank = getUserXpRank;
