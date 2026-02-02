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

import prisma from '../packages/database/prismaClient.mjs';
import logger from '../backend/utils/logger.mjs';

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
        bondLevel: true,
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
      orderBy: { timestamp: 'asc' },
    });

    // Get groom assignments within analysis window
    const assignments = await prisma.groomAssignment.findMany({
      where: {
        horseId,
        assignedAt: {
          gte: analysisStart,
        },
      },
      include: {
        groom: {
          select: { id: true, name: true, groomPersonality: true },
        },
      },
      orderBy: { assignedAt: 'asc' },
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
      currentBond: horse.bondLevel,
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

  interactions.forEach((interaction) => {
    const day = interaction.timestamp.toDateString();
    daysWithCare.add(day);
  });

  const careFrequency = daysWithCare.size / totalDays;
  const averageInteractionsPerDay = interactions.length / totalDays;

  // Detect care gaps (periods of 3+ days without interaction)
  const careGaps = [];
  let lastCareDate = startDate;

  interactions.forEach((interaction) => {
    const daysSinceLastCare = (interaction.timestamp - lastCareDate) / (1000 * 60 * 60 * 24);
    if (daysSinceLastCare >= 3) {
      careGaps.push({
        start: lastCareDate,
        end: interaction.timestamp,
        daysWithoutCare: Math.floor(daysSinceLastCare),
      });
    }
    lastCareDate = interaction.timestamp;
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
    .filter((i) => i.bondChange !== null && i.bondChange !== undefined)
    .map((i) => i.bondChange);

  const totalBondChange = bondChanges.reduce((sum, change) => sum + change, 0);
  const averageChange = bondChanges.length > 0 ? totalBondChange / bondChanges.length : 0;

  // Determine trend
  let trend = 'stable';
  if (averageChange > 1) trend = 'improving';
  else if (averageChange < -1) trend = 'declining';

  // Analyze consistency of positive interactions
  const positiveInteractions = bondChanges.filter((change) => change > 0).length;
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
    .filter((i) => i.stressChange !== null && i.stressChange !== undefined)
    .map((i) => i.stressChange);

  // Detect stress spikes (stress increases of 3+)
  const stressSpikes = interactions
    .filter((i) => i.stressChange >= 3)
    .map((i) => ({
      timestamp: i.timestamp,
      stressIncrease: i.stressChange,
      taskType: i.taskType,
    }));

  // Calculate stress reduction effectiveness
  const stressReductions = stressChanges.filter((change) => change < 0);
  const averageReduction =
    stressReductions.length > 0
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

  const taskTypes = [...new Set(interactions.map((i) => i.taskType))];
  const qualityDistribution = {};

  interactions.forEach((interaction) => {
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
  assignments.forEach((assignment) => uniqueGrooms.add(assignment.groomId));
  interactions.forEach((interaction) => uniqueGrooms.add(interaction.groomId));

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
  interactions.forEach((interaction) => {
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
