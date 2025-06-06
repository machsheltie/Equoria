/**
 * XP Events API Routes
 * Provides endpoints for accessing XP event logs and summaries
 */

import express from 'express';
import { getUserXpEvents, getUserXpSummary, getRecentXpEvents } from '../models/xpLogModel.mjs';
import logger from '../utils/logger.mjs';

const router = express.Router();

/**
 * GET /api/xp/user/:userId/events
 * Get XP events for a specific user
 */
router.get('/user/:userId/events', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, startDate, endDate } = req.query;

    logger.info(
      `[xpRoutes] GET /api/xp/user/${userId}/events - limit: ${limit}, offset: ${offset}`,
    );

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Parse optional date filters
    const options = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };

    if (startDate) {
      options.startDate = new Date(startDate);
      if (isNaN(options.startDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid startDate format',
        });
      }
    }

    if (endDate) {
      options.endDate = new Date(endDate);
      if (isNaN(options.endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid endDate format',
        });
      }
    }

    // Get XP events
    const xpEvents = await getUserXpEvents(userId, options);

    res.json({
      success: true,
      data: {
        userId,
        events: xpEvents,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: xpEvents.length,
        },
      },
    });
  } catch (error) {
    logger.error(`[xpRoutes] GET /api/xp/user/:userId/events error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve XP events',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/xp/user/:userId/summary
 * Get XP summary for a specific user
 */
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    logger.info(`[xpRoutes] GET /api/xp/user/${userId}/summary`);

    // Validate userId
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Parse optional date filters
    let parsedStartDate = null;
    let parsedEndDate = null;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid startDate format',
        });
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid endDate format',
        });
      }
    }

    // Get XP summary
    const xpSummary = await getUserXpSummary(userId, parsedStartDate, parsedEndDate);

    res.json({
      success: true,
      data: {
        userId,
        summary: xpSummary,
        dateRange: {
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        },
      },
    });
  } catch (error) {
    logger.error(`[xpRoutes] GET /api/xp/user/:userId/summary error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve XP summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/xp/recent
 * Get recent XP events across all users (for admin/analytics)
 */
router.get('/recent', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    logger.info(`[xpRoutes] GET /api/xp/recent - limit: ${limit}, offset: ${offset}`);

    // Parse pagination parameters
    const options = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    };

    // Validate pagination parameters
    if (options.limit < 1 || options.limit > 500) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 500',
      });
    }

    if (options.offset < 0) {
      return res.status(400).json({
        success: false,
        message: 'Offset must be non-negative',
      });
    }

    // Get recent XP events
    const xpEvents = await getRecentXpEvents(options);

    res.json({
      success: true,
      data: {
        events: xpEvents,
        pagination: {
          limit: options.limit,
          offset: options.offset,
          total: xpEvents.length,
        },
      },
    });
  } catch (error) {
    logger.error(`[xpRoutes] GET /api/xp/recent error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve recent XP events',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
  return null;
});

/**
 * GET /api/xp/stats
 * Get overall XP statistics (for admin dashboard)
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('[xpRoutes] GET /api/xp/stats');

    // Get recent events to calculate basic stats
    const recentEvents = await getRecentXpEvents({ limit: 1000, offset: 0 });

    // Calculate basic statistics
    const stats = {
      totalEvents: recentEvents.length,
      totalXpAwarded: recentEvents.reduce((sum, event) => sum + Math.max(0, event.amount), 0),
      totalXpDeducted: recentEvents.reduce((sum, event) => sum + Math.max(0, -event.amount), 0),
      netXp: recentEvents.reduce((sum, event) => sum + event.amount, 0),
      uniqueUsers: new Set(recentEvents.map(event => event.userId)).size,
      averageXpPerEvent:
        recentEvents.length > 0
          ? recentEvents.reduce((sum, event) => sum + event.amount, 0) / recentEvents.length
          : 0,

      // Breakdown by reason type
      reasonBreakdown: {},

      // Recent activity (last 24 hours)
      recentActivity: {
        last24Hours: 0,
        last7Days: 0,
        last30Days: 0,
      },
    };

    // Calculate reason breakdown
    recentEvents.forEach(event => {
      const reasonKey = event.reason.includes('Trained')
        ? 'Training'
        : event.reason.includes('place')
          ? 'Competition'
          : 'Other';

      if (!stats.reasonBreakdown[reasonKey]) {
        stats.reasonBreakdown[reasonKey] = { count: 0, totalXp: 0 };
      }

      stats.reasonBreakdown[reasonKey].count++;
      stats.reasonBreakdown[reasonKey].totalXp += event.amount;
    });

    // Calculate recent activity
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    recentEvents.forEach(event => {
      const eventDate = new Date(event.timestamp);
      if (eventDate >= oneDayAgo) {
        stats.recentActivity.last24Hours++;
      }
      if (eventDate >= sevenDaysAgo) {
        stats.recentActivity.last7Days++;
      }
      if (eventDate >= thirtyDaysAgo) {
        stats.recentActivity.last30Days++;
      }
    });

    res.json({
      success: true,
      data: {
        statistics: stats,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`[xpRoutes] GET /api/xp/stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve XP statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
  }
});

export default router;
