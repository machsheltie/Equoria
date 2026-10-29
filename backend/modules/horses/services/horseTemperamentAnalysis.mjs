/**
 * Horse Temperament Analysis Service
 *
 * Analyzes horse temperaments based on interaction history.
 * Provides comprehensive temperament classification and behavioral analysis.
 *
 * Owner ruling 2026-10-29 (q300, Equoria-efs4j): the old epigeneticFlags store and
 * its flag-based classification are gone. Real horses never had a flag, so they
 * always took the interaction or basic-stats path, which is unchanged.
 *
 * Business Rules:
 * - Temperament analysis from interaction patterns
 * - Behavioral trend analysis over time
 * - Bonding preference analysis based on groom interactions
 * - Temperament stability and change detection
 * - Confidence scoring based on data quality and consistency
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

// Temperament classification definitions
const TEMPERAMENT_CLASSIFICATIONS = {
  confident: {
    name: 'Confident',
    description: 'Self-assured, bold, and adaptable',
    traits: ['brave', 'confident', 'social', 'curious'],
    characteristics: {
      confidenceLevel: [0.7, 1.0],
      socialTendency: [0.5, 1.0],
      adaptability: [0.6, 1.0],
    },
  },
  nervous: {
    name: 'Nervous',
    description: 'Anxious, sensitive, and cautious',
    traits: ['fearful', 'insecure', 'reactive', 'fragile'],
    characteristics: {
      confidenceLevel: [0.0, 0.4],
      socialTendency: [0.0, 0.5],
      adaptability: [0.0, 0.4],
    },
  },
  reactive: {
    name: 'Reactive',
    description: 'Quick to respond, emotionally volatile',
    traits: ['reactive', 'sensitive', 'energetic'],
    characteristics: {
      confidenceLevel: [0.3, 0.7],
      socialTendency: [0.3, 0.8],
      adaptability: [0.3, 0.7],
    },
  },
  calm: {
    name: 'Calm',
    description: 'Steady, patient, and reliable',
    traits: ['calm', 'patient', 'stable'],
    characteristics: {
      confidenceLevel: [0.5, 0.8],
      socialTendency: [0.4, 0.8],
      adaptability: [0.5, 0.8],
    },
  },
  outgoing: {
    name: 'Outgoing',
    description: 'Social, friendly, and engaging',
    traits: ['social', 'affectionate', 'curious'],
    characteristics: {
      confidenceLevel: [0.6, 0.9],
      socialTendency: [0.7, 1.0],
      adaptability: [0.6, 0.9],
    },
  },
  complex: {
    name: 'Complex',
    description: 'Mixed traits, variable responses',
    traits: ['mixed', 'variable'],
    characteristics: {
      confidenceLevel: [0.3, 0.7],
      socialTendency: [0.3, 0.7],
      adaptability: [0.4, 0.8],
    },
  },
  developing: {
    name: 'Developing',
    description: 'Temperament still forming, insufficient data',
    traits: [],
    characteristics: {
      confidenceLevel: [0.4, 0.6],
      socialTendency: [0.4, 0.6],
      adaptability: [0.4, 0.6],
    },
  },
};

/**
 * Analyze comprehensive horse temperament
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Complete temperament analysis
 */
export async function analyzeHorseTemperament(horseId) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      name: true,
      bondScore: true,
      dateOfBirth: true,
    },
  });

  if (!horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }

  // Get interaction history
  const interactions = await prisma.groomInteraction.findMany({
    where: {
      foalId: horseId,
      createdAt: {
        gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // Last 60 days
      },
    },
    include: {
      groom: {
        select: { epigeneticInfluenceType: true, skillLevel: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let dataSource;
  let reliabilityScore;

  // Determine primary analysis method based on available data
  if (interactions.length >= 5) {
    // Use interaction-based analysis
    dataSource = 'interactions';
    reliabilityScore = Math.min(1.0, interactions.length / 20); // Max reliability at 20+ interactions
  } else {
    // Use basic stats only
    dataSource = 'basic_stats';
    reliabilityScore = 0.3;
  }

  // Analyze temperament using available data
  const temperamentAnalysis = performTemperamentAnalysis(horse, interactions, dataSource);

  return {
    horseId: horse.id,
    horseName: horse.name,
    primaryTemperament: temperamentAnalysis.primaryTemperament,
    temperamentTraits: temperamentAnalysis.traits,
    confidenceLevel: temperamentAnalysis.confidenceLevel,
    socialTendency: temperamentAnalysis.socialTendency,
    adaptability: temperamentAnalysis.adaptability,
    dataSource,
    reliabilityScore,
    analysisDate: new Date(),
    interactionCount: interactions.length,
  };
}

/**
 * Analyze behavioral trends over time
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Behavioral trend analysis
 */
export async function analyzeBehavioralTrends(horseId) {
  const interactions = await prisma.groomInteraction.findMany({
    where: {
      foalId: horseId,
      createdAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (interactions.length < 3) {
    return {
      bondingTrend: 'insufficient_data',
      qualityTrend: 'insufficient_data',
      overallDirection: 'unknown',
      trendStrength: 0,
      dataPoints: interactions.length,
    };
  }

  // Analyze trends using linear regression approach
  const bondingTrend = calculateTrend(interactions.map(i => i.bondingChange || 0));
  const qualityTrend = calculateQualityTrend(interactions);

  // Determine overall direction
  const trendScores = [bondingTrend.score, qualityTrend.score];
  const avgTrendScore = trendScores.reduce((sum, score) => sum + score, 0) / trendScores.length;

  let overallDirection;
  if (avgTrendScore > 0.3) {
    overallDirection = 'positive';
  } else if (avgTrendScore < -0.3) {
    overallDirection = 'negative';
  } else {
    overallDirection = 'stable';
  }

  const trendStrength = Math.abs(avgTrendScore);

  return {
    bondingTrend: bondingTrend.direction,
    qualityTrend: qualityTrend.direction,
    overallDirection,
    trendStrength,
    trendDetails: {
      bonding: bondingTrend,
      quality: qualityTrend,
    },
    dataPoints: interactions.length,
    analysisWindow: 30, // days
  };
}

/**
 * Analyze bonding preferences
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Bonding preference analysis
 */
export async function analyzeBondingPreferences(horseId) {
  const interactions = await prisma.groomInteraction.findMany({
    where: { foalId: horseId },
    include: {
      groom: {
        select: { epigeneticInfluenceType: true, skillLevel: true },
      },
    },
  });

  if (interactions.length === 0) {
    return {
      preferredGroomTypes: [],
      preferredInteractionTypes: [],
      bondingSpeed: 0.5,
      socialNature: 0.5,
      trustLevel: 0.5,
      dataAvailable: false,
    };
  }

  // Analyze groom type preferences
  const groomTypePerformance = {};
  const interactionTypePerformance = {};

  interactions.forEach(interaction => {
    const personality = interaction.groom?.epigeneticInfluenceType;
    const { interactionType } = interaction;
    const bondingChange = interaction.bondingChange || 0;

    if (personality) {
      if (!groomTypePerformance[personality]) {
        groomTypePerformance[personality] = { total: 0, count: 0, avg: 0 };
      }
      groomTypePerformance[personality].total += bondingChange;
      groomTypePerformance[personality].count += 1;
      groomTypePerformance[personality].avg =
        groomTypePerformance[personality].total / groomTypePerformance[personality].count;
    }

    if (interactionType) {
      if (!interactionTypePerformance[interactionType]) {
        interactionTypePerformance[interactionType] = { total: 0, count: 0, avg: 0 };
      }
      interactionTypePerformance[interactionType].total += bondingChange;
      interactionTypePerformance[interactionType].count += 1;
      interactionTypePerformance[interactionType].avg =
        interactionTypePerformance[interactionType].total /
        interactionTypePerformance[interactionType].count;
    }
  });

  // Identify preferences
  const preferredGroomTypes = Object.entries(groomTypePerformance)
    .filter(([_, data]) => data.avg > 1 && data.count >= 2)
    .map(([type, _]) => type);

  const preferredInteractionTypes = Object.entries(interactionTypePerformance)
    .filter(([_, data]) => data.avg > 1 && data.count >= 2)
    .map(([type, _]) => type);

  // Calculate bonding metrics
  const avgBondingChange =
    interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / interactions.length;
  const bondingSpeed = Math.max(0, Math.min(1, (avgBondingChange + 2) / 4)); // Normalize -2 to +2 range

  const positiveInteractions = interactions.filter(i => (i.bondingChange || 0) > 0).length;
  const socialNature = positiveInteractions / interactions.length;

  const trustLevel = calculateTrustLevel(interactions);

  return {
    preferredGroomTypes,
    preferredInteractionTypes,
    bondingSpeed,
    socialNature,
    trustLevel,
    groomTypeAnalysis: groomTypePerformance,
    interactionTypeAnalysis: interactionTypePerformance,
    totalInteractions: interactions.length,
    dataAvailable: true,
  };
}

/**
 * Detect temperament changes over time
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Temperament change analysis
 */
export async function detectTemperamentChanges(horseId) {
  const interactions = await prisma.groomInteraction.findMany({
    where: { foalId: horseId },
    orderBy: { createdAt: 'asc' },
  });

  if (interactions.length < 6) {
    return {
      changeDetected: false,
      changeDirection: 'insufficient_data',
      changeStrength: 0,
      timeframe: 'unknown',
      contributingFactors: [],
      dataPoints: interactions.length,
    };
  }

  // Split interactions into early and recent periods
  const midpoint = Math.floor(interactions.length / 2);
  const earlyPeriod = interactions.slice(0, midpoint);
  const recentPeriod = interactions.slice(midpoint);

  // Analyze each period
  const earlyMetrics = calculatePeriodMetrics(earlyPeriod);
  const recentMetrics = calculatePeriodMetrics(recentPeriod);

  // Detect changes
  const bondingChange = recentMetrics.avgBonding - earlyMetrics.avgBonding;
  const qualityChange = recentMetrics.avgQuality - earlyMetrics.avgQuality;

  const overallChange = (bondingChange + qualityChange) / 2;
  const changeStrength = Math.abs(overallChange);

  let changeDirection;
  if (overallChange > 0.5) {
    changeDirection = 'positive';
  } else if (overallChange < -0.5) {
    changeDirection = 'negative';
  } else {
    changeDirection = 'neutral';
  }

  const changeDetected = changeStrength > 0.3;

  // Identify contributing factors
  const contributingFactors = [];
  if (Math.abs(bondingChange) > 0.5) {
    contributingFactors.push(bondingChange > 0 ? 'improved_bonding' : 'declining_bonding');
  }
  if (Math.abs(qualityChange) > 0.3) {
    contributingFactors.push(
      qualityChange > 0 ? 'improved_care_quality' : 'declining_care_quality',
    );
  }

  // Determine timeframe
  const totalDays = Math.floor(
    (interactions[interactions.length - 1].createdAt - interactions[0].createdAt) /
      (1000 * 60 * 60 * 24),
  );
  const timeframe = totalDays > 30 ? 'long_term' : totalDays > 14 ? 'medium_term' : 'short_term';

  return {
    changeDetected,
    changeDirection,
    changeStrength,
    timeframe,
    contributingFactors,
    periodComparison: {
      early: earlyMetrics,
      recent: recentMetrics,
      changes: {
        bonding: bondingChange,
        quality: qualityChange,
      },
    },
    dataPoints: interactions.length,
    analysisPeriod: totalDays,
  };
}

/**
 * Perform comprehensive temperament analysis
 */
function performTemperamentAnalysis(horse, interactions, dataSource) {
  let analysis = {
    primaryTemperament: 'developing',
    traits: [],
    confidenceLevel: 0.5,
    socialTendency: 0.5,
    adaptability: 0.5,
  };

  if (dataSource === 'interactions' && interactions.length >= 5) {
    // Interaction-based analysis
    analysis = analyzeFromInteractions(horse, interactions);
  } else {
    // Basic stats only
    analysis.confidenceLevel = Math.max(0.1, Math.min(0.9, horse.bondScore / 40));
    analysis.primaryTemperament = 'developing';
  }

  return analysis;
}

/**
 * Analyze temperament from interaction patterns
 */
function analyzeFromInteractions(horse, interactions) {
  const avgBonding =
    interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / interactions.length;
  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const avgQuality =
    interactions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / interactions.length;

  // Calculate temperament characteristics
  const confidenceLevel = Math.max(0.1, Math.min(0.9, (avgBonding + 2) / 4));
  const socialTendency = Math.max(0.1, Math.min(0.9, avgBonding > 0 ? 0.7 : 0.3));
  const adaptability = Math.max(0.1, Math.min(0.9, (avgQuality - 1) / 3));

  // Determine primary temperament
  let primaryTemperament = 'developing';

  if (confidenceLevel > 0.7) {
    primaryTemperament = 'confident';
  } else if (confidenceLevel < 0.4) {
    primaryTemperament = 'nervous';
  } else if (socialTendency > 0.7 && confidenceLevel > 0.6) {
    primaryTemperament = 'outgoing';
  }

  return {
    primaryTemperament,
    traits: TEMPERAMENT_CLASSIFICATIONS[primaryTemperament]?.traits || [],
    confidenceLevel,
    socialTendency,
    adaptability,
  };
}

/**
 * Calculate trend direction and strength
 */
function calculateTrend(values) {
  if (values.length < 3) {
    return { direction: 'insufficient_data', score: 0, strength: 0 };
  }

  // Simple linear regression
  const n = values.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((sum, val) => sum + val, 0);
  const sumY = values.reduce((sum, val) => sum + val, 0);
  const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
  const sumXX = x.reduce((sum, val) => sum + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  let direction;
  if (slope > 0.1) {
    direction = 'improving';
  } else if (slope < -0.1) {
    direction = 'declining';
  } else {
    direction = 'stable';
  }

  return {
    direction,
    score: slope,
    strength: Math.abs(slope),
  };
}

/**
 * Calculate quality trend
 */
function calculateQualityTrend(interactions) {
  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const scores = interactions.map(i => qualityScores[i.quality] || 2);
  return calculateTrend(scores);
}

/**
 * Calculate trust level
 */
function calculateTrustLevel(interactions) {
  if (interactions.length === 0) {
    return 0.5;
  }

  const positiveInteractions = interactions.filter(i => (i.bondingChange || 0) > 0).length;
  const excellentInteractions = interactions.filter(i => i.quality === 'excellent').length;

  const trustFromBonding = positiveInteractions / interactions.length;
  const trustFromQuality = excellentInteractions / interactions.length;

  return (trustFromBonding + trustFromQuality) / 2;
}

/**
 * Calculate metrics for a period of interactions
 */
function calculatePeriodMetrics(interactions) {
  if (interactions.length === 0) {
    return { avgBonding: 0, avgQuality: 2 };
  }

  const avgBonding =
    interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / interactions.length;

  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const avgQuality =
    interactions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / interactions.length;

  return { avgBonding, avgQuality };
}
