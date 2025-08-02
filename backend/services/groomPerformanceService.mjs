/**
 * Groom Performance Service
 *
 * Tracks groom effectiveness, builds reputation scores, and provides performance analytics
 * Implements advanced groom features for enhanced gameplay experience
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Performance tracking configuration
export const PERFORMANCE_CONFIG = {
  // Reputation score ranges
  REPUTATION_RANGES: {
    TERRIBLE: { min: 0, max: 20, label: 'Terrible', color: '#dc2626' },
    POOR: { min: 21, max: 40, label: 'Poor', color: '#ea580c' },
    AVERAGE: { min: 41, max: 60, label: 'Average', color: '#ca8a04' },
    GOOD: { min: 61, max: 80, label: 'Good', color: '#16a34a' },
    EXCELLENT: { min: 81, max: 100, label: 'Excellent', color: '#059669' },
  },

  // Performance metrics weights
  METRIC_WEIGHTS: {
    bondingEffectiveness: 0.25,    // 25% - How well groom builds bonds
    taskCompletion: 0.20,          // 20% - Task completion rate
    horseWellbeing: 0.20,          // 20% - Impact on horse health/happiness
    showPerformance: 0.15,         // 15% - Conformation show results
    consistency: 0.10,             // 10% - Consistency over time
    playerSatisfaction: 0.10,       // 10% - Player ratings
  },

  // Minimum interactions for reliable reputation
  MIN_INTERACTIONS_FOR_REPUTATION: 10,

  // Performance decay rate (reputation slowly decays without activity)
  REPUTATION_DECAY_RATE: 0.02, // 2% per week of inactivity

  // Bonus thresholds
  EXCELLENCE_BONUS_THRESHOLD: 85,
  CONSISTENCY_STREAK_THRESHOLD: 7,
};

/**
 * Record a groom interaction performance
 * @param {number} groomId - Groom ID
 * @param {string} userId - User ID
 * @param {string} interactionType - Type of interaction
 * @param {Object} performanceData - Performance metrics
 * @returns {Object} Performance record
 */
export async function recordGroomPerformance(groomId, userId, interactionType, performanceData) {
  try {
    const {
      horseId,
      bondGain = 0,
      taskSuccess = true,
      wellbeingImpact = 0,
      duration = 0,
      playerRating = null,
    } = performanceData;

    // Create performance record
    const performanceRecord = await prisma.groomPerformanceRecord.create({
      data: {
        groomId,
        userId,
        horseId,
        interactionType,
        bondGain,
        taskSuccess,
        wellbeingImpact,
        duration,
        playerRating,
        recordedAt: new Date(),
      },
    });

    // Update groom's aggregate performance metrics
    await updateGroomMetrics(groomId);

    logger.info(`[groomPerformanceService] Recorded performance for groom ${groomId}: ${interactionType}`);

    return performanceRecord;

  } catch (error) {
    logger.error(`[groomPerformanceService] Error recording groom performance: ${error.message}`);
    throw error;
  }
}

/**
 * Update groom's aggregate performance metrics
 * @param {number} groomId - Groom ID
 */
async function updateGroomMetrics(groomId) {
  try {
    // Get all performance records for this groom
    const records = await prisma.groomPerformanceRecord.findMany({
      where: { groomId },
      orderBy: { recordedAt: 'desc' },
      take: 100, // Consider last 100 interactions for metrics
    });

    if (records.length === 0) { return; }

    // Calculate metrics
    const metrics = calculatePerformanceMetrics(records);

    // Update or create groom metrics record
    await prisma.groomMetrics.upsert({
      where: { groomId },
      update: {
        ...metrics,
        lastUpdated: new Date(),
      },
      create: {
        groomId,
        ...metrics,
        lastUpdated: new Date(),
      },
    });

    logger.info(`[groomPerformanceService] Updated metrics for groom ${groomId}`);

  } catch (error) {
    logger.error(`[groomPerformanceService] Error updating groom metrics: ${error.message}`);
  }
}

/**
 * Calculate performance metrics from records
 * @param {Array} records - Performance records
 * @returns {Object} Calculated metrics
 */
function calculatePerformanceMetrics(records) {
  const totalRecords = records.length;

  // Bonding effectiveness (average bond gain per interaction)
  const avgBondGain = records.reduce((sum, r) => sum + r.bondGain, 0) / totalRecords;
  const bondingEffectiveness = Math.min(100, (avgBondGain / 5) * 100); // Normalize to 0-100

  // Task completion rate
  const successfulTasks = records.filter(r => r.taskSuccess).length;
  const taskCompletion = (successfulTasks / totalRecords) * 100;

  // Horse wellbeing impact (average wellbeing improvement)
  const avgWellbeingImpact = records.reduce((sum, r) => sum + r.wellbeingImpact, 0) / totalRecords;
  const horseWellbeing = Math.max(0, Math.min(100, 50 + (avgWellbeingImpact * 10))); // Normalize around 50

  // Show performance (placeholder - would be calculated from actual show results)
  const showPerformance = 75; // Default value, would be calculated from actual show data

  // Consistency (variance in performance)
  const bondGains = records.map(r => r.bondGain);
  const variance = calculateVariance(bondGains);
  const consistency = Math.max(0, 100 - (variance * 20)); // Lower variance = higher consistency

  // Player satisfaction (average rating)
  const ratingsRecords = records.filter(r => r.playerRating !== null);
  const playerSatisfaction = ratingsRecords.length > 0
    ? (ratingsRecords.reduce((sum, r) => sum + r.playerRating, 0) / ratingsRecords.length) * 20 // Convert 1-5 to 0-100
    : 75; // Default if no ratings

  // Calculate overall reputation score
  const reputationScore = Math.round(
    (bondingEffectiveness * PERFORMANCE_CONFIG.METRIC_WEIGHTS.bondingEffectiveness) +
    (taskCompletion * PERFORMANCE_CONFIG.METRIC_WEIGHTS.taskCompletion) +
    (horseWellbeing * PERFORMANCE_CONFIG.METRIC_WEIGHTS.horseWellbeing) +
    (showPerformance * PERFORMANCE_CONFIG.METRIC_WEIGHTS.showPerformance) +
    (consistency * PERFORMANCE_CONFIG.METRIC_WEIGHTS.consistency) +
    (playerSatisfaction * PERFORMANCE_CONFIG.METRIC_WEIGHTS.playerSatisfaction),
  );

  return {
    totalInteractions: totalRecords,
    bondingEffectiveness: Math.round(bondingEffectiveness),
    taskCompletion: Math.round(taskCompletion),
    horseWellbeing: Math.round(horseWellbeing),
    showPerformance: Math.round(showPerformance),
    consistency: Math.round(consistency),
    playerSatisfaction: Math.round(playerSatisfaction),
    reputationScore: Math.max(0, Math.min(100, reputationScore)),
  };
}

/**
 * Calculate variance for consistency metric
 * @param {Array} values - Array of values
 * @returns {number} Variance
 */
function calculateVariance(values) {
  if (values.length === 0) { return 0; }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Get groom performance summary
 * @param {number} groomId - Groom ID
 * @returns {Object} Performance summary
 */
export async function getGroomPerformanceSummary(groomId) {
  try {
    // Get groom basic info
    const groom = await prisma.groom.findUnique({
      where: { id: groomId },
      select: {
        id: true,
        name: true,
        skillLevel: true,
        speciality: true,
        experience: true,
      },
    });

    if (!groom) {
      throw new Error('Groom not found');
    }

    // Get metrics
    const metrics = await prisma.groomMetrics.findUnique({
      where: { groomId },
    });

    // Get recent performance records
    const recentRecords = await prisma.groomPerformanceRecord.findMany({
      where: { groomId },
      orderBy: { recordedAt: 'desc' },
      take: 10,
      include: {
        horse: {
          select: { id: true, name: true },
        },
      },
    });

    // Determine reputation tier
    const reputationScore = metrics?.reputationScore || 50;
    const reputationTier = getReputationTier(reputationScore);

    // Calculate performance trends
    const trends = calculatePerformanceTrends(recentRecords);

    return {
      groom,
      metrics: metrics || getDefaultMetrics(),
      reputationTier,
      recentRecords,
      trends,
      hasReliableReputation: (metrics?.totalInteractions || 0) >= PERFORMANCE_CONFIG.MIN_INTERACTIONS_FOR_REPUTATION,
    };

  } catch (error) {
    logger.error(`[groomPerformanceService] Error getting groom performance summary: ${error.message}`);
    throw error;
  }
}

/**
 * Get reputation tier for a score
 * @param {number} score - Reputation score
 * @returns {Object} Reputation tier info
 */
function getReputationTier(score) {
  for (const [tier, range] of Object.entries(PERFORMANCE_CONFIG.REPUTATION_RANGES)) {
    if (score >= range.min && score <= range.max) {
      return { tier, ...range };
    }
  }
  return PERFORMANCE_CONFIG.REPUTATION_RANGES.AVERAGE;
}

/**
 * Calculate performance trends
 * @param {Array} records - Recent performance records
 * @returns {Object} Trend analysis
 */
function calculatePerformanceTrends(records) {
  if (records.length < 3) {
    return { trend: 'insufficient_data', direction: 'stable' };
  }

  // Calculate trend in bond gains over recent interactions
  const recentBondGains = records.slice(0, 5).map(r => r.bondGain);
  const olderBondGains = records.slice(5, 10).map(r => r.bondGain);

  const recentAvg = recentBondGains.reduce((sum, val) => sum + val, 0) / recentBondGains.length;
  const olderAvg = olderBondGains.length > 0
    ? olderBondGains.reduce((sum, val) => sum + val, 0) / olderBondGains.length
    : recentAvg;

  const improvement = recentAvg - olderAvg;

  let direction = 'stable';
  if (improvement > 0.5) { direction = 'improving'; } else if (improvement < -0.5) { direction = 'declining'; }

  return {
    trend: 'calculated',
    direction,
    improvement: Math.round(improvement * 100) / 100,
    recentAverage: Math.round(recentAvg * 100) / 100,
  };
}

/**
 * Get default metrics for new grooms
 * @returns {Object} Default metrics
 */
function getDefaultMetrics() {
  return {
    totalInteractions: 0,
    bondingEffectiveness: 50,
    taskCompletion: 75,
    horseWellbeing: 50,
    showPerformance: 50,
    consistency: 50,
    playerSatisfaction: 75,
    reputationScore: 50,
  };
}

/**
 * Get top performing grooms for a user
 * @param {string} userId - User ID
 * @param {number} limit - Number of grooms to return
 * @returns {Array} Top performing grooms
 */
export async function getTopPerformingGrooms(userId, limit = 5) {
  try {
    const grooms = await prisma.groom.findMany({
      where: { userId },
      include: {
        groomMetrics: true,
      },
      orderBy: {
        groomMetrics: {
          reputationScore: 'desc',
        },
      },
      take: limit,
    });

    return grooms.map(groom => ({
      id: groom.id,
      name: groom.name,
      skillLevel: groom.skillLevel,
      speciality: groom.speciality,
      reputationScore: groom.groomMetrics?.reputationScore || 50,
      reputationTier: getReputationTier(groom.groomMetrics?.reputationScore || 50),
      totalInteractions: groom.groomMetrics?.totalInteractions || 0,
    }));

  } catch (error) {
    logger.error(`[groomPerformanceService] Error getting top performing grooms: ${error.message}`);
    return [];
  }
}
