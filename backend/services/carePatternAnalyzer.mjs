/**
 * Care Pattern Analyzer Service
 * 
 * Analyzes groom care patterns for flag triggers including:
 * - Care consistency and frequency
 * - Bond trend analysis over time
 * - Stress spike detection and recovery patterns
 * - Neglect pattern identification
 * - Task diversity and quality assessment
 * 
 * Used by the weekly flag evaluation system to determine epigenetic flag eligibility.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

/**
 * Analyze care patterns for a specific horse
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Comprehensive care pattern analysis
 */
export async function analyzeCarePatterns(horseId) {
  try {
    // Get horse basic info
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        dateOfBirth: true,
        bondScore: true,
        stressLevel: true,
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Calculate analysis window (last 30 days or since birth if younger)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const birthDate = new Date(horse.dateOfBirth);
    const analysisStart = birthDate > thirtyDaysAgo ? birthDate : thirtyDaysAgo;

    // Get groom interactions within analysis window
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: analysisStart,
        },
      },
      include: {
        groom: {
          select: { id: true, name: true, groomPersonality: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get groom assignments within analysis window
    const assignments = await prisma.groomAssignment.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: analysisStart,
        },
      },
      include: {
        groom: {
          select: { id: true, name: true, groomPersonality: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Analyze care consistency
    const consistencyAnalysis = analyzeCareConsistency(interactions, analysisStart, now);

    // Analyze bond trends
    const bondAnalysis = analyzeBondTrends(interactions);

    // Analyze stress patterns
    const stressAnalysis = analyzeStressPatterns(interactions);

    // Analyze task diversity
    const taskAnalysis = analyzeTaskDiversity(interactions);

    // Analyze groom consistency
    const groomAnalysis = analyzeGroomConsistency(assignments, interactions);

    // Detect neglect patterns
    const neglectAnalysis = detectNeglectPatterns(interactions, analysisStart, now);

    return {
      horseId,
      horseName: horse.name,
      analysisWindow: {
        start: analysisStart,
        end: now,
        daysAnalyzed: Math.ceil((now - analysisStart) / (1000 * 60 * 60 * 24)),
      },
      totalInteractions: interactions.length,
      consistency: consistencyAnalysis,
      bondTrends: bondAnalysis,
      stressPatterns: stressAnalysis,
      taskDiversity: taskAnalysis,
      groomConsistency: groomAnalysis,
      neglectPatterns: neglectAnalysis,
      currentBond: horse.bondScore,
      currentStress: horse.stressLevel,
    };

  } catch (error) {
    logger.error(`Error analyzing care patterns for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Analyze care consistency over time
 */
function analyzeCareConsistency(interactions, startDate, endDate) {
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const daysWithCare = new Set();
  
  interactions.forEach(interaction => {
    const day = interaction.createdAt.toDateString();
    daysWithCare.add(day);
  });

  const careFrequency = daysWithCare.size / totalDays;
  const averageInteractionsPerDay = interactions.length / totalDays;

  // Detect care gaps (periods of 3+ days without interaction)
  const careGaps = [];
  let lastCareDate = startDate;
  
  interactions.forEach(interaction => {
    const daysSinceLastCare = (interaction.createdAt - lastCareDate) / (1000 * 60 * 60 * 24);
    if (daysSinceLastCare >= 3) {
      careGaps.push({
        start: lastCareDate,
        end: interaction.createdAt,
        daysWithoutCare: Math.floor(daysSinceLastCare),
      });
    }
    lastCareDate = interaction.createdAt;
  });

  return {
    careFrequency, // Percentage of days with care
    averageInteractionsPerDay,
    daysWithCare: daysWithCare.size,
    totalDays,
    careGaps,
    consistencyScore: careFrequency * (1 - Math.min(careGaps.length * 0.1, 0.5)), // Penalize gaps
  };
}

/**
 * Analyze bond trends over time
 */
function analyzeBondTrends(interactions) {
  if (interactions.length === 0) {
    return { trend: 'no_data', bondChanges: [], averageChange: 0 };
  }

  const bondChanges = interactions
    .filter(i => i.bondChange !== null && i.bondChange !== undefined)
    .map(i => i.bondChange);

  const totalBondChange = bondChanges.reduce((sum, change) => sum + change, 0);
  const averageChange = bondChanges.length > 0 ? totalBondChange / bondChanges.length : 0;

  // Determine trend
  let trend = 'stable';
  if (averageChange > 1) trend = 'improving';
  else if (averageChange < -1) trend = 'declining';

  // Analyze consistency of positive interactions
  const positiveInteractions = bondChanges.filter(change => change > 0).length;
  const positiveRatio = bondChanges.length > 0 ? positiveInteractions / bondChanges.length : 0;

  return {
    trend,
    totalBondChange,
    averageChange,
    positiveRatio,
    bondChanges,
    interactionsWithBondData: bondChanges.length,
  };
}

/**
 * Analyze stress patterns and recovery
 */
function analyzeStressPatterns(interactions) {
  if (interactions.length === 0) {
    return { pattern: 'no_data', stressSpikes: [], recoveryRate: 0 };
  }

  const stressChanges = interactions
    .filter(i => i.stressChange !== null && i.stressChange !== undefined)
    .map(i => i.stressChange);

  // Detect stress spikes (stress increases of 3+)
  const stressSpikes = interactions
    .filter(i => i.stressChange >= 3)
    .map(i => ({
      timestamp: i.createdAt,
      stressIncrease: i.stressChange,
      taskType: i.taskType,
    }));

  // Calculate stress reduction effectiveness
  const stressReductions = stressChanges.filter(change => change < 0);
  const averageReduction = stressReductions.length > 0 
    ? stressReductions.reduce((sum, change) => sum + change, 0) / stressReductions.length 
    : 0;

  return {
    pattern: stressSpikes.length > 3 ? 'high_stress' : 'normal',
    stressSpikes,
    averageReduction,
    totalStressChange: stressChanges.reduce((sum, change) => sum + change, 0),
    stressReductionSessions: stressReductions.length,
  };
}

/**
 * Analyze task diversity and quality
 */
function analyzeTaskDiversity(interactions) {
  if (interactions.length === 0) {
    return { diversity: 0, taskTypes: [], qualityDistribution: {} };
  }

  const taskTypes = [...new Set(interactions.map(i => i.taskType))];
  const qualityDistribution = {};
  
  interactions.forEach(interaction => {
    const quality = interaction.quality || 'unknown';
    qualityDistribution[quality] = (qualityDistribution[quality] || 0) + 1;
  });

  const diversityScore = taskTypes.length / Math.max(interactions.length * 0.3, 1);
  const excellentQualityRatio = (qualityDistribution.excellent || 0) / interactions.length;

  return {
    diversity: Math.min(diversityScore, 1),
    taskTypes,
    uniqueTaskCount: taskTypes.length,
    qualityDistribution,
    excellentQualityRatio,
  };
}

/**
 * Analyze groom consistency
 */
function analyzeGroomConsistency(assignments, interactions) {
  const uniqueGrooms = new Set();
  assignments.forEach(assignment => uniqueGrooms.add(assignment.groomId));
  interactions.forEach(interaction => uniqueGrooms.add(interaction.groomId));

  const groomChanges = assignments.length - 1; // Number of groom changes
  const consistencyScore = assignments.length > 0 ? 1 / (1 + groomChanges * 0.2) : 0;

  return {
    uniqueGroomsCount: uniqueGrooms.size,
    groomChanges,
    consistencyScore,
    currentAssignments: assignments.length,
  };
}

/**
 * Detect neglect patterns
 */
function detectNeglectPatterns(interactions, startDate, endDate) {
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Calculate days without any care
  const daysWithCare = new Set();
  interactions.forEach(interaction => {
    const day = interaction.timestamp.toDateString();
    daysWithCare.add(day);
  });

  const daysWithoutCare = totalDays - daysWithCare.size;
  const neglectRatio = daysWithoutCare / totalDays;

  // Detect extended neglect periods (5+ consecutive days without care)
  const extendedNeglectPeriods = [];
  // This would require more complex date analysis - simplified for now

  return {
    daysWithoutCare,
    neglectRatio,
    isNeglected: neglectRatio > 0.5, // More than 50% of days without care
    extendedNeglectPeriods,
    severity: neglectRatio > 0.7 ? 'severe' : neglectRatio > 0.5 ? 'moderate' : 'minimal',
  };
}

/**
 * Calculate advanced consistency score with weighted factors
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Advanced consistency scoring breakdown
 */
export async function calculateAdvancedConsistencyScore(horseId) {
  try {
    // Get interactions over the last 30 days
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        groom: {
          select: { id: true, name: true, groomPersonality: true, skillLevel: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (interactions.length === 0) {
      return {
        overallScore: 0,
        components: {
          frequencyConsistency: 0,
          qualityConsistency: 0,
          durationConsistency: 0,
          groomConsistency: 0,
          timingConsistency: 0,
        },
        dataPoints: 0,
      };
    }

    // Calculate frequency consistency (regularity of interactions)
    const frequencyConsistency = calculateFrequencyConsistency(interactions);

    // Calculate quality consistency (variance in interaction quality)
    const qualityConsistency = calculateQualityConsistency(interactions);

    // Calculate duration consistency (variance in interaction duration)
    const durationConsistency = calculateDurationConsistency(interactions);

    // Calculate groom consistency (stability of groom assignments)
    const groomConsistency = calculateGroomConsistency(interactions);

    // Calculate timing consistency (regularity of interaction times)
    const timingConsistency = calculateTimingConsistency(interactions);

    // Weighted overall score
    const weights = {
      frequency: 0.25,
      quality: 0.30,
      duration: 0.15,
      groom: 0.20,
      timing: 0.10,
    };

    const overallScore =
      frequencyConsistency * weights.frequency +
      qualityConsistency * weights.quality +
      durationConsistency * weights.duration +
      groomConsistency * weights.groom +
      timingConsistency * weights.timing;

    return {
      overallScore,
      components: {
        frequencyConsistency,
        qualityConsistency,
        durationConsistency,
        groomConsistency,
        timingConsistency,
      },
      dataPoints: interactions.length,
      analysisWindow: 30, // days
    };

  } catch (error) {
    logger.error(`Error calculating advanced consistency score for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Detect care quality trends with multi-dimensional analysis
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Comprehensive trend analysis
 */
export async function detectCareQualityTrends(horseId) {
  try {
    // Get interactions over the last 21 days for trend analysis
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (interactions.length < 3) {
      return {
        qualityTrend: 'insufficient_data',
        bondTrend: 'insufficient_data',
        stressTrend: 'insufficient_data',
        trendStrength: 0,
        projectedOutcome: 'unknown',
        dataPoints: interactions.length,
      };
    }

    // Analyze quality trend
    const qualityTrend = analyzeQualityTrend(interactions);

    // Analyze bond trend
    const bondTrend = analyzeBondTrend(interactions);

    // Analyze stress trend
    const stressTrend = analyzeStressTrend(interactions);

    // Calculate overall trend strength
    const trendStrength = calculateTrendStrength(qualityTrend, bondTrend, stressTrend);

    // Project outcome based on trends
    const projectedOutcome = projectOutcome(qualityTrend, bondTrend, stressTrend, trendStrength);

    return {
      qualityTrend: qualityTrend.direction,
      bondTrend: bondTrend.direction,
      stressTrend: stressTrend.direction,
      trendStrength,
      projectedOutcome,
      trendDetails: {
        quality: qualityTrend,
        bond: bondTrend,
        stress: stressTrend,
      },
      dataPoints: interactions.length,
      analysisWindow: 21, // days
    };

  } catch (error) {
    logger.error(`Error detecting care quality trends for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Analyze individual groom effectiveness
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Groom effectiveness analysis
 */
export async function analyzeGroomEffectiveness(horseId) {
  try {
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        groom: {
          select: { id: true, name: true, groomPersonality: true, skillLevel: true },
        },
      },
    });

    if (interactions.length === 0) {
      return {
        groomStats: [],
        overallEffectiveness: 0,
        mostEffective: null,
        leastEffective: null,
        recommendations: [],
      };
    }

    // Group interactions by groom
    const groomGroups = {};
    interactions.forEach(interaction => {
      const groomId = interaction.groomId;
      if (!groomGroups[groomId]) {
        groomGroups[groomId] = {
          groom: interaction.groom,
          interactions: [],
        };
      }
      groomGroups[groomId].interactions.push(interaction);
    });

    // Calculate effectiveness for each groom
    const groomStats = Object.values(groomGroups).map(group => {
      const stats = calculateGroomStats(group.groom, group.interactions);
      return stats;
    });

    // Sort by effectiveness
    groomStats.sort((a, b) => b.effectivenessScore - a.effectivenessScore);

    const overallEffectiveness = groomStats.reduce((sum, stat) => sum + stat.effectivenessScore, 0) / groomStats.length;
    const mostEffective = groomStats[0] || null;
    const leastEffective = groomStats[groomStats.length - 1] || null;

    // Generate recommendations
    const recommendations = generateGroomRecommendations(groomStats);

    return {
      groomStats,
      overallEffectiveness,
      mostEffective,
      leastEffective,
      recommendations,
      totalInteractions: interactions.length,
    };

  } catch (error) {
    logger.error(`Error analyzing groom effectiveness for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Calculate comprehensive care risk score
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Care risk assessment
 */
export async function calculateCareRiskScore(horseId) {
  try {
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        groom: {
          select: { groomPersonality: true, skillLevel: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate individual risk factors
    const consistencyRisk = calculateConsistencyRisk(interactions);
    const qualityRisk = calculateQualityRisk(interactions);
    const frequencyRisk = calculateFrequencyRisk(interactions);
    const groomStabilityRisk = calculateGroomStabilityRisk(interactions);
    const stressRisk = calculateStressRisk(interactions);

    // Weighted overall risk score
    const weights = {
      consistency: 0.25,
      quality: 0.30,
      frequency: 0.20,
      groomStability: 0.15,
      stress: 0.10,
    };

    const overallRisk =
      consistencyRisk * weights.consistency +
      qualityRisk * weights.quality +
      frequencyRisk * weights.frequency +
      groomStabilityRisk * weights.groomStability +
      stressRisk * weights.stress;

    // Determine risk level
    let riskLevel;
    if (overallRisk >= 0.8) riskLevel = 'critical';
    else if (overallRisk >= 0.6) riskLevel = 'high';
    else if (overallRisk >= 0.4) riskLevel = 'moderate';
    else riskLevel = 'low';

    // Generate recommendations based on risk factors
    const recommendations = generateRiskRecommendations({
      consistencyRisk,
      qualityRisk,
      frequencyRisk,
      groomStabilityRisk,
      stressRisk,
    });

    return {
      overallRisk,
      riskLevel,
      riskFactors: {
        consistencyRisk,
        qualityRisk,
        frequencyRisk,
        groomStabilityRisk,
        stressRisk,
      },
      recommendations,
      dataPoints: interactions.length,
      analysisWindow: 21, // days
    };

  } catch (error) {
    logger.error(`Error calculating care risk score for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Calculate frequency consistency (regularity of interactions)
 */
function calculateFrequencyConsistency(interactions) {
  if (interactions.length < 2) return 0;

  // Calculate intervals between interactions
  const intervals = [];
  for (let i = 1; i < interactions.length; i++) {
    const interval = (interactions[i].createdAt - interactions[i-1].createdAt) / (1000 * 60 * 60 * 24);
    intervals.push(interval);
  }

  // Calculate coefficient of variation (lower = more consistent)
  const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

  // Convert to consistency score (0-1, higher = more consistent)
  return Math.max(0, 1 - Math.min(coefficientOfVariation, 1));
}

/**
 * Calculate quality consistency (variance in interaction quality)
 */
function calculateQualityConsistency(interactions) {
  if (interactions.length === 0) return 0;

  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const scores = interactions.map(i => qualityScores[i.quality] || 2);

  if (scores.length < 2) return scores[0] ? scores[0] / 4 : 0;

  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Normalize consistency (lower variance = higher consistency)
  const maxVariance = 1.5; // Reasonable max for quality variance
  const consistency = Math.max(0, 1 - (stdDev / maxVariance));

  return Math.min(1, consistency);
}

/**
 * Calculate duration consistency (variance in interaction duration)
 */
function calculateDurationConsistency(interactions) {
  if (interactions.length === 0) return 0;

  const durations = interactions.map(i => i.duration || 30); // Default 30 minutes

  if (durations.length < 2) return 0.8; // Assume good if only one data point

  const mean = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  const variance = durations.reduce((sum, duration) => sum + Math.pow(duration - mean, 2), 0) / durations.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;

  // Convert to consistency score
  return Math.max(0, 1 - Math.min(coefficientOfVariation * 2, 1));
}

/**
 * Calculate groom consistency (stability of groom assignments)
 */
function calculateGroomConsistency(interactions) {
  if (interactions.length === 0) return 0;

  const uniqueGrooms = new Set(interactions.map(i => i.groomId));
  const groomChanges = uniqueGrooms.size - 1;

  // Penalize frequent groom changes
  const maxChanges = Math.max(1, interactions.length / 3); // Allow some changes
  const consistency = Math.max(0, 1 - (groomChanges / maxChanges));

  return Math.min(1, consistency);
}

/**
 * Calculate timing consistency (regularity of interaction times)
 */
function calculateTimingConsistency(interactions) {
  if (interactions.length < 2) return 0.8; // Assume good if insufficient data

  // Extract hour of day for each interaction
  const hours = interactions.map(i => i.createdAt.getHours());

  // Calculate variance in timing
  const mean = hours.reduce((sum, hour) => sum + hour, 0) / hours.length;
  const variance = hours.reduce((sum, hour) => sum + Math.pow(hour - mean, 2), 0) / hours.length;
  const stdDev = Math.sqrt(variance);

  // Normalize (lower variance = higher consistency)
  const maxStdDev = 6; // 6 hours standard deviation is quite variable
  const consistency = Math.max(0, 1 - (stdDev / maxStdDev));

  return Math.min(1, consistency);
}

/**
 * Analyze quality trend over time
 */
function analyzeQualityTrend(interactions) {
  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const scores = interactions.map(i => qualityScores[i.quality] || 2);

  return calculateLinearTrend(scores);
}

/**
 * Analyze bond trend over time
 */
function analyzeBondTrend(interactions) {
  const bondChanges = interactions.map(i => i.bondingChange || 0);
  return calculateLinearTrend(bondChanges);
}

/**
 * Analyze stress trend over time
 */
function analyzeStressTrend(interactions) {
  const stressChanges = interactions.map(i => -(i.stressChange || 0)); // Negative stress change is good
  return calculateLinearTrend(stressChanges);
}

/**
 * Calculate linear trend for a series of values
 */
function calculateLinearTrend(values) {
  if (values.length < 2) {
    return { direction: 'insufficient_data', slope: 0, strength: 0 };
  }

  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = values.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const strength = Math.abs(slope);

  let direction;
  if (slope > 0.1) direction = 'improving';
  else if (slope < -0.1) direction = 'declining';
  else direction = 'stable';

  return { direction, slope, strength };
}

/**
 * Calculate overall trend strength from multiple trend analyses
 */
function calculateTrendStrength(qualityTrend, bondTrend, stressTrend) {
  const strengths = [qualityTrend.strength, bondTrend.strength, stressTrend.strength];
  return strengths.reduce((sum, strength) => sum + strength, 0) / strengths.length;
}

/**
 * Project outcome based on trend analysis
 */
function projectOutcome(qualityTrend, bondTrend, stressTrend, trendStrength) {
  const improvingCount = [qualityTrend, bondTrend, stressTrend]
    .filter(trend => trend.direction === 'improving').length;
  const decliningCount = [qualityTrend, bondTrend, stressTrend]
    .filter(trend => trend.direction === 'declining').length;

  if (improvingCount >= 2 && trendStrength > 0.3) return 'positive';
  if (decliningCount >= 2 && trendStrength > 0.3) return 'negative';
  return 'neutral';
}

/**
 * Calculate individual groom statistics
 */
function calculateGroomStats(groom, interactions) {
  const bondChanges = interactions.map(i => i.bondingChange || 0);
  const stressChanges = interactions.map(i => i.stressChange || 0);
  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };

  const avgBondChange = bondChanges.reduce((sum, change) => sum + change, 0) / bondChanges.length;
  const avgStressChange = stressChanges.reduce((sum, change) => sum + change, 0) / stressChanges.length;

  // Quality distribution
  const qualityDistribution = {};
  interactions.forEach(i => {
    const quality = i.quality || 'unknown';
    qualityDistribution[quality] = (qualityDistribution[quality] || 0) + 1;
  });

  const avgQuality = interactions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / interactions.length;

  // Calculate effectiveness score (0-1)
  const bondScore = Math.max(0, Math.min(1, (avgBondChange + 3) / 6)); // Normalize -3 to +3 range
  const stressScore = Math.max(0, Math.min(1, (-avgStressChange + 3) / 6)); // Negative stress change is good
  const qualityScore = (avgQuality - 1) / 3; // Normalize 1-4 to 0-1

  const effectivenessScore = (bondScore * 0.4 + stressScore * 0.3 + qualityScore * 0.3);

  return {
    groomId: groom.id,
    groomName: groom.name,
    groomPersonality: groom.groomPersonality,
    skillLevel: groom.skillLevel,
    effectivenessScore,
    avgBondChange,
    avgStressChange,
    avgQuality,
    qualityDistribution,
    totalInteractions: interactions.length,
  };
}

/**
 * Generate recommendations based on groom effectiveness
 */
function generateGroomRecommendations(groomStats) {
  const recommendations = [];

  if (groomStats.length === 0) {
    recommendations.push('No groom data available for analysis');
    return recommendations;
  }

  const avgEffectiveness = groomStats.reduce((sum, stat) => sum + stat.effectivenessScore, 0) / groomStats.length;

  if (avgEffectiveness < 0.4) {
    recommendations.push('Overall groom effectiveness is low. Consider training or replacing underperforming grooms.');
  }

  const topGroom = groomStats[0];
  const bottomGroom = groomStats[groomStats.length - 1];

  if (topGroom.effectivenessScore > 0.7) {
    recommendations.push(`${topGroom.groomName} shows excellent effectiveness. Consider increasing their responsibilities.`);
  }

  if (bottomGroom.effectivenessScore < 0.3) {
    recommendations.push(`${bottomGroom.groomName} shows poor effectiveness. Consider additional training or reassignment.`);
  }

  // Personality-based recommendations
  const personalityGroups = {};
  groomStats.forEach(stat => {
    const personality = stat.groomPersonality;
    if (!personalityGroups[personality]) personalityGroups[personality] = [];
    personalityGroups[personality].push(stat);
  });

  Object.entries(personalityGroups).forEach(([personality, grooms]) => {
    const avgScore = grooms.reduce((sum, groom) => sum + groom.effectivenessScore, 0) / grooms.length;
    if (avgScore > 0.6) {
      recommendations.push(`${personality} personality grooms are performing well with this horse.`);
    }
  });

  return recommendations;
}

/**
 * Calculate consistency risk factor
 */
function calculateConsistencyRisk(interactions) {
  if (interactions.length === 0) return 1.0; // Maximum risk if no data

  const frequencyConsistency = calculateFrequencyConsistency(interactions);
  const qualityConsistency = calculateQualityConsistency(interactions);

  // Higher consistency = lower risk
  const avgConsistency = (frequencyConsistency + qualityConsistency) / 2;
  return 1 - avgConsistency;
}

/**
 * Calculate quality risk factor
 */
function calculateQualityRisk(interactions) {
  if (interactions.length === 0) return 1.0;

  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const avgQuality = interactions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / interactions.length;

  // Normalize to risk score (lower quality = higher risk)
  return Math.max(0, 1 - ((avgQuality - 1) / 3));
}

/**
 * Calculate frequency risk factor
 */
function calculateFrequencyRisk(interactions) {
  const daysInWindow = 21;
  const expectedMinInteractions = daysInWindow * 0.3; // Expect at least 30% coverage

  const actualInteractions = interactions.length;
  const frequencyRatio = actualInteractions / expectedMinInteractions;

  // Higher frequency = lower risk
  return Math.max(0, 1 - Math.min(frequencyRatio, 1));
}

/**
 * Calculate groom stability risk factor
 */
function calculateGroomStabilityRisk(interactions) {
  if (interactions.length === 0) return 1.0;

  const uniqueGrooms = new Set(interactions.map(i => i.groomId));
  const groomChanges = uniqueGrooms.size - 1;
  const maxAcceptableChanges = Math.max(1, interactions.length / 5); // Allow some changes

  return Math.min(1, groomChanges / maxAcceptableChanges);
}

/**
 * Calculate stress risk factor
 */
function calculateStressRisk(interactions) {
  if (interactions.length === 0) return 0.5; // Neutral risk if no data

  const stressChanges = interactions.map(i => i.stressChange || 0);
  const avgStressChange = stressChanges.reduce((sum, change) => sum + change, 0) / stressChanges.length;
  const stressSpikes = stressChanges.filter(change => change >= 3).length;

  // Positive stress change and spikes increase risk
  const avgStressRisk = Math.max(0, Math.min(1, (avgStressChange + 3) / 6));
  const spikeRisk = Math.min(1, stressSpikes / (interactions.length * 0.2)); // 20% spike tolerance

  return (avgStressRisk + spikeRisk) / 2;
}

/**
 * Generate risk-based recommendations
 */
function generateRiskRecommendations(riskFactors) {
  const recommendations = [];
  const threshold = 0.6; // Risk threshold for recommendations

  if (riskFactors.consistencyRisk > threshold) {
    recommendations.push('Improve care consistency by establishing regular interaction schedules.');
  }

  if (riskFactors.qualityRisk > threshold) {
    recommendations.push('Focus on improving interaction quality through better training or groom selection.');
  }

  if (riskFactors.frequencyRisk > threshold) {
    recommendations.push('Increase frequency of interactions to ensure adequate care coverage.');
  }

  if (riskFactors.groomStabilityRisk > threshold) {
    recommendations.push('Reduce groom changes to provide more stable care relationships.');
  }

  if (riskFactors.stressRisk > threshold) {
    recommendations.push('Address stress-inducing factors and improve stress management techniques.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Care patterns appear to be within acceptable risk levels.');
  }

  return recommendations;
}
