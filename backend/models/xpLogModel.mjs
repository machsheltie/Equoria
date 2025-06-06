/**
 * XP Log Model
 * Handles logging of all XP events for auditing and analytics
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Log an XP event to the database
 *
 * @param {Object} params - XP event parameters
 * @param {string} params.userId - User ID who received/lost XP (Changed from userId)
 * @param {number} params.amount - Amount of XP gained/lost (positive or negative)
 * @param {string} params.reason - Reason for XP change (e.g., "Trained horse in Dressage")
 * @returns {Promise<Object>} The created XP event record
 */
export const logXpEvent = async ({ userId, amount, reason }) => {
  // Changed userId to userId
  try {
    logger.info(
      `[xpLogModel.logXpEvent] Logging XP event: User ${userId}, Amount: ${amount}, Reason: ${reason}`,
    ); // Changed User to User

    // Validate input parameters
    if (!userId) {
      // Changed userId to userId
      throw new Error('User ID is required'); // Changed User ID to User ID
    }

    if (typeof amount !== 'number') {
      throw new Error('Amount must be a number');
    }

    if (!reason || typeof reason !== 'string') {
      throw new Error('Reason is required and must be a string');
    }

    // Insert XP event into database using Prisma
    const xpEvent = await prisma.xpEvent.create({
      data: {
        userId, // Changed userId to userId
        amount,
        reason,
      },
    });

    logger.info(
      `[xpLogModel.logXpEvent] Successfully logged XP event: ID ${xpEvent.id}, User ${xpEvent.userId}, Amount: ${xpEvent.amount}`,
    ); // Changed User to User, userId to userId

    return {
      id: xpEvent.id,
      userId: xpEvent.userId, // Changed userId to userId
      amount: xpEvent.amount,
      reason: xpEvent.reason,
      timestamp: xpEvent.timestamp,
    };
  } catch (error) {
    logger.error(`[xpLogModel.logXpEvent] Error logging XP event: ${error.message}`);
    throw error;
  }
};

/**
 * Get XP events for a specific user
 *
 * @param {string} userId - User ID to get XP events for (Changed from userId)
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of events to return (default: 50)
 * @param {number} options.offset - Number of events to skip (default: 0)
 * @param {Date} options.startDate - Start date filter (optional)
 * @param {Date} options.endDate - End date filter (optional)
 * @returns {Promise<Array>} Array of XP events
 */
export const getUserXpEvents = async (userId, options = {}) => {
  // Renamed function, changed userId to userId
  try {
    const { limit = 50, offset = 0, startDate, endDate } = options;

    logger.info(
      `[xpLogModel.getUserXpEvents] Getting XP events for user ${userId}, limit: ${limit}, offset: ${offset}`,
    ); // Changed user to user, function name

    // Build where clause for date filters
    const where = {
      userId, // Changed userId to userId
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    // Query XP events using Prisma
    const xpEvents = await prisma.xpEvent.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
    });

    logger.info(
      `[xpLogModel.getUserXpEvents] Retrieved ${xpEvents.length} XP events for user ${userId}`,
    ); // Changed user to user, function name

    return xpEvents;
  } catch (error) {
    logger.error(`[xpLogModel.getUserXpEvents] Error getting XP events: ${error.message}`); // Changed function name
    throw error;
  }
};

/**
 * Get total XP gained by a user within a date range
 *
 * @param {string} userId - User ID (Changed from userId)
 * @param {Date} startDate - Start date (optional)
 * @param {Date} endDate - End date (optional)
 * @returns {Promise<Object>} Object with total XP gained and lost
 */
export const getUserXpSummary = async (userId, startDate = null, endDate = null) => {
  // Renamed function, changed userId to userId
  try {
    logger.info(`[xpLogModel.getUserXpSummary] Getting XP summary for user ${userId}`); // Changed user to user, function name

    // Build where clause for date filters
    const where = {
      userId, // Changed userId to userId
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    // Get all XP events for the user within the date range
    const xpEvents = await prisma.xpEvent.findMany({
      where,
      select: {
        amount: true,
      },
    });

    // Calculate summary statistics
    let totalGained = 0;
    let totalLost = 0;
    let netTotal = 0;

    for (const event of xpEvents) {
      if (event.amount > 0) {
        totalGained += event.amount;
      } else {
        totalLost += Math.abs(event.amount);
      }
      netTotal += event.amount;
    }

    const xpSummary = {
      totalGained,
      totalLost,
      netTotal,
      totalEvents: xpEvents.length,
    };

    logger.info(
      `[xpLogModel.getUserXpSummary] XP summary for user ${userId}: Gained ${xpSummary.totalGained}, Lost ${xpSummary.totalLost}, Net ${xpSummary.netTotal}`,
    ); // Changed user to user, function name

    return xpSummary;
  } catch (error) {
    logger.error(`[xpLogModel.getUserXpSummary] Error getting XP summary: ${error.message}`); // Changed function name
    throw error;
  }
};

/**
 * Get recent XP events across all users (for admin/analytics)
 *
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of events to return (default: 100)
 * @param {number} options.offset - Number of events to skip (default: 0)
 * @returns {Promise<Array>} Array of recent XP events
 */
export const getRecentXpEvents = async (options = {}) => {
  try {
    const { limit = 100, offset = 0 } = options;

    logger.info(
      `[xpLogModel.getRecentXpEvents] Getting recent XP events, limit: ${limit}, offset: ${offset}`,
    );

    // Query recent XP events using Prisma
    const xpEvents = await prisma.xpEvent.findMany({
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        // Added include to show which user the XP event belongs to
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    logger.info(`[xpLogModel.getRecentXpEvents] Retrieved ${xpEvents.length} recent XP events`);

    return xpEvents;
  } catch (error) {
    logger.error(`[xpLogModel.getRecentXpEvents] Error getting recent XP events: ${error.message}`);
    throw error;
  }
};
