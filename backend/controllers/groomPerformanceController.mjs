/**
 * Groom Performance Controller
 * 
 * Handles API endpoints for groom performance tracking and reputation management
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import {
  recordGroomPerformance,
  getGroomPerformanceSummary,
  getTopPerformingGrooms,
  PERFORMANCE_CONFIG
} from '../services/groomPerformanceService.mjs';

/**
 * POST /api/groom-performance/record
 * Record a groom performance interaction
 */
export async function recordPerformance(req, res) {
  try {
    const userId = req.user?.id;
    const {
      groomId,
      horseId,
      interactionType,
      bondGain = 0,
      taskSuccess = true,
      wellbeingImpact = 0,
      duration = 0,
      playerRating = null
    } = req.body;

    logger.info(`[groomPerformanceController] Recording performance for groom ${groomId}`);

    // Validate groom ownership
    const groom = await prisma.groom.findUnique({
      where: { id: parseInt(groomId) },
      select: { id: true, name: true, userId: true }
    });

    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
        data: null
      });
    }

    if (groom.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this groom',
        data: null
      });
    }

    // Validate horse ownership if provided
    if (horseId) {
      const horse = await prisma.horse.findUnique({
        where: { id: parseInt(horseId) },
        select: { id: true, ownerId: true }
      });

      if (!horse || horse.ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not own this horse',
          data: null
        });
      }
    }

    // Record performance
    const performanceRecord = await recordGroomPerformance(
      parseInt(groomId),
      userId,
      interactionType,
      {
        horseId: horseId ? parseInt(horseId) : null,
        bondGain: parseFloat(bondGain),
        taskSuccess: Boolean(taskSuccess),
        wellbeingImpact: parseFloat(wellbeingImpact),
        duration: parseInt(duration),
        playerRating: playerRating ? parseInt(playerRating) : null
      }
    );

    res.status(201).json({
      success: true,
      message: 'Performance recorded successfully',
      data: performanceRecord
    });

  } catch (error) {
    logger.error(`[groomPerformanceController] Error recording performance: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to record performance',
      data: null
    });
  }
}

/**
 * GET /api/groom-performance/groom/:groomId
 * Get performance summary for a specific groom
 */
export async function getGroomPerformance(req, res) {
  try {
    const { groomId } = req.params;
    const userId = req.user?.id;

    logger.info(`[groomPerformanceController] Getting performance for groom ${groomId}`);

    // Validate groom ID
    const parsedGroomId = parseInt(groomId);
    if (isNaN(parsedGroomId) || parsedGroomId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
        data: null
      });
    }

    // Check groom ownership
    const groom = await prisma.groom.findUnique({
      where: { id: parsedGroomId },
      select: { id: true, userId: true }
    });

    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
        data: null
      });
    }

    if (groom.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this groom',
        data: null
      });
    }

    // Get performance summary
    const performanceSummary = await getGroomPerformanceSummary(parsedGroomId);

    res.json({
      success: true,
      message: 'Groom performance retrieved successfully',
      data: performanceSummary
    });

  } catch (error) {
    logger.error(`[groomPerformanceController] Error getting groom performance: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get groom performance',
      data: null
    });
  }
}

/**
 * GET /api/groom-performance/top
 * Get top performing grooms for the user
 */
export async function getTopPerformers(req, res) {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit) || 5;

    logger.info(`[groomPerformanceController] Getting top performers for user ${userId}`);

    if (limit < 1 || limit > 20) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 20',
        data: null
      });
    }

    const topPerformers = await getTopPerformingGrooms(userId, limit);

    res.json({
      success: true,
      message: 'Top performing grooms retrieved successfully',
      data: {
        grooms: topPerformers,
        count: topPerformers.length
      }
    });

  } catch (error) {
    logger.error(`[groomPerformanceController] Error getting top performers: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get top performing grooms',
      data: null
    });
  }
}

/**
 * GET /api/groom-performance/config
 * Get performance tracking configuration
 */
export async function getPerformanceConfig(req, res) {
  try {
    const userId = req.user?.id;

    logger.info(`[groomPerformanceController] Getting performance config for user ${userId}`);

    res.json({
      success: true,
      message: 'Performance configuration retrieved successfully',
      data: {
        reputationRanges: PERFORMANCE_CONFIG.REPUTATION_RANGES,
        metricWeights: PERFORMANCE_CONFIG.METRIC_WEIGHTS,
        minInteractionsForReputation: PERFORMANCE_CONFIG.MIN_INTERACTIONS_FOR_REPUTATION,
        excellenceBonusThreshold: PERFORMANCE_CONFIG.EXCELLENCE_BONUS_THRESHOLD,
        consistencyStreakThreshold: PERFORMANCE_CONFIG.CONSISTENCY_STREAK_THRESHOLD
      }
    });

  } catch (error) {
    logger.error(`[groomPerformanceController] Error getting performance config: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance configuration',
      data: null
    });
  }
}

/**
 * GET /api/groom-performance/analytics/:groomId
 * Get detailed analytics for a specific groom
 */
export async function getGroomAnalytics(req, res) {
  try {
    const { groomId } = req.params;
    const userId = req.user?.id;
    const days = parseInt(req.query.days) || 30;

    logger.info(`[groomPerformanceController] Getting analytics for groom ${groomId}, last ${days} days`);

    // Validate groom ID
    const parsedGroomId = parseInt(groomId);
    if (isNaN(parsedGroomId) || parsedGroomId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid groom ID',
        data: null
      });
    }

    // Check groom ownership
    const groom = await prisma.groom.findUnique({
      where: { id: parsedGroomId },
      select: { id: true, name: true, userId: true }
    });

    if (!groom) {
      return res.status(404).json({
        success: false,
        message: 'Groom not found',
        data: null
      });
    }

    if (groom.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not own this groom',
        data: null
      });
    }

    // Get performance records for the specified period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const records = await prisma.groomPerformanceRecord.findMany({
      where: {
        groomId: parsedGroomId,
        recordedAt: {
          gte: startDate
        }
      },
      include: {
        horse: {
          select: { id: true, name: true }
        }
      },
      orderBy: { recordedAt: 'desc' }
    });

    // Calculate analytics
    const analytics = {
      totalInteractions: records.length,
      averageBondGain: records.length > 0 
        ? records.reduce((sum, r) => sum + r.bondGain, 0) / records.length 
        : 0,
      successRate: records.length > 0 
        ? (records.filter(r => r.taskSuccess).length / records.length) * 100 
        : 0,
      averageWellbeingImpact: records.length > 0 
        ? records.reduce((sum, r) => sum + r.wellbeingImpact, 0) / records.length 
        : 0,
      averageDuration: records.length > 0 
        ? records.reduce((sum, r) => sum + r.duration, 0) / records.length 
        : 0,
      interactionTypes: {},
      dailyActivity: {},
      horsesWorkedWith: []
    };

    // Group by interaction type
    records.forEach(record => {
      analytics.interactionTypes[record.interactionType] = 
        (analytics.interactionTypes[record.interactionType] || 0) + 1;
    });

    // Group by day
    records.forEach(record => {
      const day = record.recordedAt.toISOString().split('T')[0];
      analytics.dailyActivity[day] = (analytics.dailyActivity[day] || 0) + 1;
    });

    // Get unique horses worked with
    const uniqueHorses = [...new Map(
      records
        .filter(r => r.horse)
        .map(r => [r.horse.id, r.horse])
    ).values()];
    analytics.horsesWorkedWith = uniqueHorses;

    res.json({
      success: true,
      message: 'Groom analytics retrieved successfully',
      data: {
        groom: {
          id: groom.id,
          name: groom.name
        },
        period: {
          days,
          startDate,
          endDate: new Date()
        },
        analytics,
        records: records.slice(0, 20) // Return last 20 records
      }
    });

  } catch (error) {
    logger.error(`[groomPerformanceController] Error getting groom analytics: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to get groom analytics',
      data: null
    });
  }
}
