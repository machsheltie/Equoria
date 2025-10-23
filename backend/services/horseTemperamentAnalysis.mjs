/**
 * Horse Temperament Analysis Service
 *
 * Analyzes horse temperaments based on interaction history and flag patterns.
 * Provides comprehensive temperament classification and behavioral analysis.
 *
 * Business Rules:
 * - Temperament analysis from interaction patterns and epigenetic flags
 * - Behavioral trend analysis over time
 * - Stress response pattern identification
 * - Bonding preference analysis based on groom interactions
 * - Temperament stability and change detection
 * - Confidence scoring based on data quality and consistency
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

// Temperament classification definitions
const TEMPERAMENT_CLASSIFICATIONS = {
  confident: {
    name: 'Confident',
    description: 'Self-assured, bold, and adaptable',
    traits: ['brave', 'confident', 'social', 'curious'],
    characteristics: {
      confidenceLevel: [0.7, 1.0],
      stressResilience: [0.6, 1.0],
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
      stressResilience: [0.0, 0.4],
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
      stressResilience: [0.2, 0.6],
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
      stressResilience: [0.7, 1.0],
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
      stressResilience: [0.5, 0.8],
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
      stressResilience: [0.3, 0.7],
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
      stressResilience: [0.4, 0.6],
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
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: {
        id: true,
        name: true,
        epigeneticFlags: true,
        bondScore: true,
        stressLevel: true,
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
          select: { groomPersonality: true, skillLevel: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let dataSource = 'comprehensive';
    let reliabilityScore = 1.0;

    // Determine primary analysis method based on available data
    if (interactions.length >= 5) {
      // Use interaction-based analysis
      dataSource = 'interactions';
      reliabilityScore = Math.min(1.0, interactions.length / 20); // Max reliability at 20+ interactions
    } else if (horse.epigeneticFlags.length > 0) {
      // Use flag-based analysis
      dataSource = 'flags_and_stats';
      reliabilityScore = Math.min(0.8, horse.epigeneticFlags.length / 5); // Max 0.8 reliability from flags
    } else {
      // Use basic stats only
      dataSource = 'basic_stats';
      reliabilityScore = 0.3;
    }

    // Analyze temperament using available data
    const temperamentAnalysis = await performTemperamentAnalysis(horse, interactions, dataSource);

    return {
      horseId: horse.id,
      horseName: horse.name,
      primaryTemperament: temperamentAnalysis.primaryTemperament,
      temperamentTraits: temperamentAnalysis.traits,
      confidenceLevel: temperamentAnalysis.confidenceLevel,
      stressResilience: temperamentAnalysis.stressResilience,
      socialTendency: temperamentAnalysis.socialTendency,
      adaptability: temperamentAnalysis.adaptability,
      dataSource,
      reliabilityScore,
      analysisDate: new Date(),
      interactionCount: interactions.length,
      flagCount: horse.epigeneticFlags.length,
    };

  } catch (error) {
    logger.error(`Error analyzing horse temperament for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Classify temperament from epigenetic flags
 * @param {Array} flags - Array of epigenetic flag names
 * @returns {Object} Temperament classification
 */
export async function classifyTemperamentFromFlags(flags) {
  try {
    if (!flags || flags.length === 0) {
      return {
        primaryTemperament: 'undetermined',
        temperamentTraits: [],
        confidence: 0.2,
        reasoning: 'No flags available for analysis',
      };
    }

    // Score each temperament type based on flag matches
    const temperamentScores = {};

    Object.entries(TEMPERAMENT_CLASSIFICATIONS).forEach(([tempType, tempDef]) => {
      let score = 0;
      let matches = 0;

      tempDef.traits.forEach(trait => {
        if (flags.includes(trait)) {
          score += 1;
          matches += 1;
        }
      });

      // Normalize score by number of possible traits
      temperamentScores[tempType] = {
        score: tempDef.traits.length > 0 ? score / tempDef.traits.length : 0,
        matches,
        totalTraits: tempDef.traits.length,
      };
    });

    // Find best match
    let bestMatch = 'developing';
    let bestScore = 0;
    let confidence = 0;

    Object.entries(temperamentScores).forEach(([tempType, scoreData]) => {
      if (scoreData.score > bestScore) {
        bestScore = scoreData.score;
        bestMatch = tempType;
      }
    });

    // Calculate confidence based on match quality
    if (bestScore >= 0.6) {
      confidence = 0.8; // High confidence for strong matches
    } else if (bestScore >= 0.3) {
      confidence = 0.6; // Moderate confidence
    } else {
      confidence = 0.4; // Low confidence
      bestMatch = 'complex'; // Mixed signals
    }

    // Check for conflicting flags
    const positiveFlags = flags.filter(flag => ['brave', 'confident', 'social', 'calm'].includes(flag));
    const negativeFlags = flags.filter(flag => ['fearful', 'insecure', 'reactive', 'fragile'].includes(flag));

    if (positiveFlags.length > 0 && negativeFlags.length > 0) {
      bestMatch = 'complex';
      confidence = Math.min(confidence, 0.7);
    }

    const classification = TEMPERAMENT_CLASSIFICATIONS[bestMatch];

    return {
      primaryTemperament: bestMatch,
      temperamentTraits: classification.traits,
      confidence,
      flagMatches: temperamentScores[bestMatch]?.matches || 0,
      totalFlags: flags.length,
      reasoning: `Based on ${flags.length} flags with ${temperamentScores[bestMatch]?.matches || 0} matches`,
    };

  } catch (error) {
    logger.error('Error classifying temperament from flags:', error);
    throw error;
  }
}

/**
 * Analyze behavioral trends over time
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Behavioral trend analysis
 */
export async function analyzeBehavioralTrends(horseId) {
  try {
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
        stressTrend: 'insufficient_data',
        qualityTrend: 'insufficient_data',
        overallDirection: 'unknown',
        trendStrength: 0,
        dataPoints: interactions.length,
      };
    }

    // Analyze trends using linear regression approach
    const bondingTrend = calculateTrend(interactions.map(i => i.bondingChange || 0));
    const stressTrend = calculateTrend(interactions.map(i => -(i.stressChange || 0))); // Negative stress change is positive
    const qualityTrend = calculateQualityTrend(interactions);

    // Determine overall direction
    const trendScores = [bondingTrend.score, stressTrend.score, qualityTrend.score];
    const avgTrendScore = trendScores.reduce((sum, score) => sum + score, 0) / trendScores.length;

    let overallDirection;
    if (avgTrendScore > 0.3) { overallDirection = 'positive'; } else if (avgTrendScore < -0.3) { overallDirection = 'negative'; } else { overallDirection = 'stable'; }

    const trendStrength = Math.abs(avgTrendScore);

    return {
      bondingTrend: bondingTrend.direction,
      stressTrend: stressTrend.direction,
      qualityTrend: qualityTrend.direction,
      overallDirection,
      trendStrength,
      trendDetails: {
        bonding: bondingTrend,
        stress: stressTrend,
        quality: qualityTrend,
      },
      dataPoints: interactions.length,
      analysisWindow: 30, // days
    };

  } catch (error) {
    logger.error(`Error analyzing behavioral trends for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Identify stress response patterns
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Stress response pattern analysis
 */
export async function identifyStressResponsePatterns(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { stressLevel: true, epigeneticFlags: true },
    });

    const interactions = await prisma.groomInteraction.findMany({
      where: { foalId: horseId },
      include: {
        groom: { select: { groomPersonality: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Last 50 interactions
    });

    // Analyze stress responses
    const stressChanges = interactions.map(i => i.stressChange || 0);
    const avgStressChange = stressChanges.reduce((sum, change) => sum + change, 0) / stressChanges.length;
    const stressSpikes = stressChanges.filter(change => change >= 3).length;
    const stressReductions = stressChanges.filter(change => change <= -2).length;

    // Identify trigger factors
    const triggerFactors = [];
    const groomPersonalityStress = {};

    interactions.forEach(interaction => {
      const personality = interaction.groom?.groomPersonality;
      if (personality && interaction.stressChange > 1) {
        groomPersonalityStress[personality] = (groomPersonalityStress[personality] || 0) + 1;
      }
    });

    // Identify problematic groom personalities
    Object.entries(groomPersonalityStress).forEach(([personality, count]) => {
      if (count >= 2) {
        triggerFactors.push(`${personality}_groom_personality`);
      }
    });

    // Determine stress threshold and response type
    const stressThreshold = calculateStressThreshold(horse, interactions);
    const recoveryRate = calculateRecoveryRate(interactions);
    const responseType = determineStressResponseType(horse, avgStressChange, stressSpikes, stressReductions);

    return {
      stressThreshold,
      recoveryRate,
      triggerFactors,
      responseType,
      avgStressChange,
      stressSpikes,
      stressReductions,
      copingMechanisms: identifyCopingMechanisms(interactions),
      analysisDepth: interactions.length,
    };

  } catch (error) {
    logger.error(`Error identifying stress response patterns for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Analyze bonding preferences
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Bonding preference analysis
 */
export async function analyzeBondingPreferences(horseId) {
  try {
    const interactions = await prisma.groomInteraction.findMany({
      where: { foalId: horseId },
      include: {
        groom: {
          select: { groomPersonality: true, skillLevel: true },
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
      const personality = interaction.groom?.groomPersonality;
      const { interactionType } = interaction;
      const bondingChange = interaction.bondingChange || 0;

      if (personality) {
        if (!groomTypePerformance[personality]) {
          groomTypePerformance[personality] = { total: 0, count: 0, avg: 0 };
        }
        groomTypePerformance[personality].total += bondingChange;
        groomTypePerformance[personality].count += 1;
        groomTypePerformance[personality].avg = groomTypePerformance[personality].total / groomTypePerformance[personality].count;
      }

      if (interactionType) {
        if (!interactionTypePerformance[interactionType]) {
          interactionTypePerformance[interactionType] = { total: 0, count: 0, avg: 0 };
        }
        interactionTypePerformance[interactionType].total += bondingChange;
        interactionTypePerformance[interactionType].count += 1;
        interactionTypePerformance[interactionType].avg = interactionTypePerformance[interactionType].total / interactionTypePerformance[interactionType].count;
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
    const avgBondingChange = interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / interactions.length;
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

  } catch (error) {
    logger.error(`Error analyzing bonding preferences for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Detect temperament changes over time
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Temperament change analysis
 */
export async function detectTemperamentChanges(horseId) {
  try {
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
    const stressChange = earlyMetrics.avgStress - recentMetrics.avgStress; // Positive = improvement
    const qualityChange = recentMetrics.avgQuality - earlyMetrics.avgQuality;

    const overallChange = (bondingChange + stressChange + qualityChange) / 3;
    const changeStrength = Math.abs(overallChange);

    let changeDirection;
    if (overallChange > 0.5) { changeDirection = 'positive'; } else if (overallChange < -0.5) { changeDirection = 'negative'; } else { changeDirection = 'neutral'; }

    const changeDetected = changeStrength > 0.3;

    // Identify contributing factors
    const contributingFactors = [];
    if (Math.abs(bondingChange) > 0.5) {
      contributingFactors.push(bondingChange > 0 ? 'improved_bonding' : 'declining_bonding');
    }
    if (Math.abs(stressChange) > 0.5) {
      contributingFactors.push(stressChange > 0 ? 'better_stress_management' : 'increased_stress_sensitivity');
    }
    if (Math.abs(qualityChange) > 0.3) {
      contributingFactors.push(qualityChange > 0 ? 'improved_care_quality' : 'declining_care_quality');
    }

    // Determine timeframe
    const totalDays = Math.floor((interactions[interactions.length - 1].createdAt - interactions[0].createdAt) / (1000 * 60 * 60 * 24));
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
          stress: stressChange,
          quality: qualityChange,
        },
      },
      dataPoints: interactions.length,
      analysisPeriod: totalDays,
    };

  } catch (error) {
    logger.error(`Error detecting temperament changes for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Perform comprehensive temperament analysis
 */
async function performTemperamentAnalysis(horse, interactions, dataSource) {
  let analysis = {
    primaryTemperament: 'developing',
    traits: [],
    confidenceLevel: 0.5,
    stressResilience: 0.5,
    socialTendency: 0.5,
    adaptability: 0.5,
  };

  if (dataSource === 'interactions' && interactions.length >= 5) {
    // Interaction-based analysis
    analysis = analyzeFromInteractions(horse, interactions);
  } else if (dataSource === 'flags_and_stats' && horse.epigeneticFlags.length > 0) {
    // Flag-based analysis
    const flagClassification = await classifyTemperamentFromFlags(horse.epigeneticFlags);
    analysis.primaryTemperament = flagClassification.primaryTemperament;
    analysis.traits = flagClassification.temperamentTraits;

    // Supplement with basic stats
    analysis.confidenceLevel = Math.max(0.1, Math.min(0.9, horse.bondScore / 40));
    analysis.stressResilience = Math.max(0.1, Math.min(0.9, (10 - horse.stressLevel) / 10));
    analysis.socialTendency = horse.epigeneticFlags.includes('social') ? 0.8 :
      horse.epigeneticFlags.includes('antisocial') ? 0.2 : 0.5;
    analysis.adaptability = horse.epigeneticFlags.includes('curious') ? 0.7 :
      horse.epigeneticFlags.includes('fearful') ? 0.3 : 0.5;
  } else {
    // Basic stats only
    analysis.confidenceLevel = Math.max(0.1, Math.min(0.9, horse.bondScore / 40));
    analysis.stressResilience = Math.max(0.1, Math.min(0.9, (10 - horse.stressLevel) / 10));
    analysis.primaryTemperament = 'developing';
  }

  return analysis;
}

/**
 * Analyze temperament from interaction patterns
 */
function analyzeFromInteractions(horse, interactions) {
  const avgBonding = interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / interactions.length;
  const avgStressChange = interactions.reduce((sum, i) => sum + (i.stressChange || 0), 0) / interactions.length;
  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const avgQuality = interactions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / interactions.length;

  // Calculate temperament characteristics
  const confidenceLevel = Math.max(0.1, Math.min(0.9, (avgBonding + 2) / 4));
  const stressResilience = Math.max(0.1, Math.min(0.9, (-avgStressChange + 3) / 6));
  const socialTendency = Math.max(0.1, Math.min(0.9, avgBonding > 0 ? 0.7 : 0.3));
  const adaptability = Math.max(0.1, Math.min(0.9, (avgQuality - 1) / 3));

  // Determine primary temperament
  let primaryTemperament = 'developing';

  if (confidenceLevel > 0.7 && stressResilience > 0.6) {
    primaryTemperament = 'confident';
  } else if (confidenceLevel < 0.4 && stressResilience < 0.4) {
    primaryTemperament = 'nervous';
  } else if (avgStressChange > 1 && stressResilience < 0.5) {
    primaryTemperament = 'reactive';
  } else if (stressResilience > 0.7 && avgBonding > 0) {
    primaryTemperament = 'calm';
  } else if (socialTendency > 0.7 && confidenceLevel > 0.6) {
    primaryTemperament = 'outgoing';
  }

  return {
    primaryTemperament,
    traits: TEMPERAMENT_CLASSIFICATIONS[primaryTemperament]?.traits || [],
    confidenceLevel,
    stressResilience,
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
  if (slope > 0.1) { direction = 'improving'; } else if (slope < -0.1) { direction = 'declining'; } else { direction = 'stable'; }

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
 * Calculate stress threshold
 */
function calculateStressThreshold(horse, interactions) {
  const baseThreshold = (10 - horse.stressLevel) / 10; // Higher stress = lower threshold

  if (interactions.length === 0) { return baseThreshold; }

  const stressSpikes = interactions.filter(i => (i.stressChange || 0) >= 3).length;
  const spikeRatio = stressSpikes / interactions.length;

  return Math.max(0.1, baseThreshold - (spikeRatio * 0.3));
}

/**
 * Calculate recovery rate
 */
function calculateRecoveryRate(interactions) {
  if (interactions.length === 0) { return 0.5; }

  const stressReductions = interactions.filter(i => (i.stressChange || 0) <= -2).length;
  return Math.min(1.0, stressReductions / (interactions.length * 0.3)); // Expect 30% to be stress-reducing
}

/**
 * Determine stress response type
 */
function determineStressResponseType(horse, avgStressChange, stressSpikes, stressReductions) {
  if (horse.epigeneticFlags.includes('reactive') || avgStressChange > 1) {
    return 'reactive';
  } else if (horse.epigeneticFlags.includes('fearful') || stressSpikes > stressReductions) {
    return 'high_sensitivity';
  } else if (stressReductions > stressSpikes) {
    return 'resilient';
  } else {
    return 'moderate';
  }
}

/**
 * Identify coping mechanisms
 */
function identifyCopingMechanisms(interactions) {
  const mechanisms = [];

  const bondingInteractions = interactions.filter(i => (i.bondingChange || 0) > 2);
  if (bondingInteractions.length > 0) {
    mechanisms.push('bonding_seeking');
  }

  const qualityInteractions = interactions.filter(i => i.quality === 'excellent');
  if (qualityInteractions.length > interactions.length * 0.3) {
    mechanisms.push('responds_to_quality_care');
  }

  return mechanisms;
}

/**
 * Calculate trust level
 */
function calculateTrustLevel(interactions) {
  if (interactions.length === 0) { return 0.5; }

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
    return { avgBonding: 0, avgStress: 0, avgQuality: 2 };
  }

  const avgBonding = interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0) / interactions.length;
  const avgStress = interactions.reduce((sum, i) => sum + (i.stressChange || 0), 0) / interactions.length;

  const qualityScores = { poor: 1, fair: 2, good: 3, excellent: 4 };
  const avgQuality = interactions.reduce((sum, i) => sum + (qualityScores[i.quality] || 2), 0) / interactions.length;

  return { avgBonding, avgStress, avgQuality };
}
