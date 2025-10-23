/**
 * Developmental Window System Service
 *
 * Implements critical developmental periods for trait expression.
 * Manages age-sensitive windows where specific traits can be developed
 * or modified through targeted interventions and environmental factors.
 *
 * Business Rules:
 * - Critical developmental window identification and timing
 * - Age-based trait expression sensitivity calculations
 * - Window-specific trait development opportunities
 * - Developmental milestone tracking and evaluation
 * - Window closure effects on trait expression potential
 * - Multi-window coordination and conflict resolution
 * - Environmental sensitivity during critical periods
 * - Long-term developmental outcome prediction
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

// Critical developmental windows (in days from birth)
const DEVELOPMENTAL_WINDOWS = {
  imprinting: {
    name: 'imprinting',
    startDay: 0,
    endDay: 3,
    peakDay: 1,
    sensitivity: 1.0,
    description: 'Critical bonding and trust formation period',
    targetTraits: ['trusting', 'bonded', 'secure'],
    riskTraits: ['fearful', 'insecure', 'withdrawn'],
    interventions: ['gentle_handling', 'consistent_presence', 'positive_associations'],
  },
  early_socialization: {
    name: 'early_socialization',
    startDay: 1,
    endDay: 21,
    peakDay: 10,
    sensitivity: 0.9,
    description: 'Primary socialization and environmental adaptation',
    targetTraits: ['social', 'adaptable', 'confident'],
    riskTraits: ['antisocial', 'fearful', 'reactive'],
    interventions: ['varied_experiences', 'multiple_handlers', 'environmental_exposure'],
  },
  fear_period_1: {
    name: 'fear_period_1',
    startDay: 6,
    endDay: 12,
    peakDay: 9,
    sensitivity: 0.8,
    description: 'First fear imprint period - high sensitivity to trauma',
    targetTraits: ['brave', 'resilient', 'calm'],
    riskTraits: ['fearful', 'phobic', 'traumatized'],
    interventions: ['gentle_exposure', 'stress_reduction', 'positive_conditioning'],
  },
  curiosity_development: {
    name: 'curiosity_development',
    startDay: 14,
    endDay: 28,
    peakDay: 21,
    sensitivity: 0.7,
    description: 'Exploration behavior and learning motivation development',
    targetTraits: ['curious', 'intelligent', 'exploratory'],
    riskTraits: ['apathetic', 'withdrawn', 'fearful'],
    interventions: ['enrichment_activities', 'safe_exploration', 'learning_opportunities'],
  },
  fear_period_2: {
    name: 'fear_period_2',
    startDay: 21,
    endDay: 28,
    peakDay: 24,
    sensitivity: 0.8,
    description: 'Second fear imprint period - continued sensitivity',
    targetTraits: ['brave', 'confident', 'stable'],
    riskTraits: ['fearful', 'reactive', 'insecure'],
    interventions: ['gradual_desensitization', 'confidence_building', 'stress_management'],
  },
  social_hierarchy: {
    name: 'social_hierarchy',
    startDay: 30,
    endDay: 60,
    peakDay: 45,
    sensitivity: 0.6,
    description: 'Social structure learning and relationship formation',
    targetTraits: ['social', 'cooperative', 'balanced'],
    riskTraits: ['dominant', 'submissive', 'antisocial'],
    interventions: ['group_interactions', 'boundary_setting', 'social_modeling'],
  },
  independence_development: {
    name: 'independence_development',
    startDay: 60,
    endDay: 120,
    peakDay: 90,
    sensitivity: 0.5,
    description: 'Independence and self-confidence building',
    targetTraits: ['independent', 'confident', 'self_reliant'],
    riskTraits: ['dependent', 'insecure', 'clingy'],
    interventions: ['gradual_independence', 'confidence_challenges', 'self_directed_activities'],
  },
};

// Developmental milestones
const DEVELOPMENTAL_MILESTONES = {
  basic_trust: { window: 'imprinting', requirement: 'positive_bonding_interactions', score: 10 },
  environmental_comfort: { window: 'early_socialization', requirement: 'varied_exposure', score: 15 },
  fear_resilience: { window: 'fear_period_1', requirement: 'stress_management', score: 20 },
  learning_motivation: { window: 'curiosity_development', requirement: 'exploration_activities', score: 25 },
  emotional_stability: { window: 'fear_period_2', requirement: 'consistent_care', score: 30 },
  social_competence: { window: 'social_hierarchy', requirement: 'social_interactions', score: 35 },
  self_confidence: { window: 'independence_development', requirement: 'independence_training', score: 40 },
};

/**
 * Identify active and upcoming developmental windows for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Developmental window analysis
 */
export async function identifyDevelopmentalWindows(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true, stressLevel: true, bondScore: true },
    });

    if (!horse) {
      throw new Error(`Horse not found: ${horseId}`);
    }

    const currentAge = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    const activeWindows = [];
    const upcomingWindows = [];
    const closedWindows = [];

    Object.values(DEVELOPMENTAL_WINDOWS).forEach(window => {
      if (currentAge >= window.startDay && currentAge <= window.endDay) {
        // Currently active window
        const daysInWindow = currentAge - window.startDay;
        const windowProgress = daysInWindow / (window.endDay - window.startDay);
        const daysRemaining = window.endDay - currentAge;

        activeWindows.push({
          ...window,
          daysInWindow,
          windowProgress,
          daysRemaining,
          urgency: daysRemaining <= 2 ? 'critical' : daysRemaining <= 5 ? 'high' : 'moderate',
        });
      } else if (currentAge < window.startDay) {
        // Upcoming window
        const daysUntilStart = window.startDay - currentAge;
        upcomingWindows.push({
          ...window,
          daysUntilStart,
          preparationTime: daysUntilStart > 7 ? 'adequate' : daysUntilStart > 3 ? 'limited' : 'urgent',
        });
      } else {
        // Closed window
        const daysSinceClosure = currentAge - window.endDay;
        closedWindows.push({
          ...window,
          daysSinceClosure,
          compensationPossible: daysSinceClosure <= 30,
        });
      }
    });

    // Calculate overall criticality score
    const criticalityScore = activeWindows.reduce((score, window) => {
      const urgencyMultiplier = window.urgency === 'critical' ? 3 : window.urgency === 'high' ? 2 : 1;
      return score + (window.sensitivity * urgencyMultiplier);
    }, 0);

    return {
      horseId,
      currentAge,
      activeWindows,
      upcomingWindows,
      closedWindows,
      criticalityScore,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error identifying developmental windows for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Calculate sensitivity for a specific developmental window
 * @param {number} horseId - ID of the horse
 * @param {string} windowName - Name of the developmental window
 * @returns {Object} Window sensitivity analysis
 */
export async function calculateWindowSensitivity(horseId, windowName) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true, stressLevel: true, bondScore: true },
    });

    const window = DEVELOPMENTAL_WINDOWS[windowName];
    if (!window) {
      throw new Error(`Unknown developmental window: ${windowName}`);
    }

    const currentAge = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Base sensitivity from window definition
    const baseSensitivity = window.sensitivity;

    // Age modifier - peak sensitivity at peak day, declining towards edges
    let ageModifier = 0;
    if (currentAge >= window.startDay && currentAge <= window.endDay) {
      const distanceFromPeak = Math.abs(currentAge - window.peakDay);
      const maxDistance = Math.max(window.peakDay - window.startDay, window.endDay - window.peakDay);
      ageModifier = 1.0 - (distanceFromPeak / maxDistance) * 0.3; // 30% reduction at edges for higher sensitivity
    } else if (currentAge < window.startDay) {
      // Before window - minimal sensitivity
      ageModifier = 0.1;
    } else {
      // After window - very low sensitivity
      ageModifier = 0.05;
    }

    // Environmental modifier based on stress and bonding
    let environmentalModifier = 1.1; // Start slightly higher for critical periods

    // Stress affects sensitivity differently for different window types
    if (windowName.includes('fear_period')) {
      // Higher stress increases sensitivity to fear periods
      environmentalModifier += horse.stressLevel * 0.05;
    } else {
      // Higher stress generally reduces positive development sensitivity
      environmentalModifier -= horse.stressLevel * 0.02; // Reduced impact
    }

    // Bonding affects social and trust-related windows
    if (['imprinting', 'early_socialization', 'social_hierarchy'].includes(windowName)) {
      environmentalModifier += (horse.bondScore - 15) * 0.01; // Adjusted baseline
    }

    environmentalModifier = Math.max(0.5, Math.min(1.6, environmentalModifier));

    const finalSensitivity = baseSensitivity * ageModifier * environmentalModifier;

    // Determine sensitivity level
    let sensitivityLevel;
    if (finalSensitivity >= 0.8) { sensitivityLevel = 'critical'; } else if (finalSensitivity >= 0.6) { sensitivityLevel = 'high'; } else if (finalSensitivity >= 0.4) { sensitivityLevel = 'moderate'; } else if (finalSensitivity >= 0.2) { sensitivityLevel = 'low'; } else { sensitivityLevel = 'minimal'; }

    return {
      horseId,
      windowName,
      baseSensitivity,
      ageModifier,
      environmentalModifier,
      finalSensitivity: Math.max(0, Math.min(1, finalSensitivity)),
      sensitivityLevel,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error calculating window sensitivity for horse ${horseId}, window ${windowName}:`, error);
    throw error;
  }
}

/**
 * Evaluate trait development opportunity during a specific window
 * @param {number} horseId - ID of the horse
 * @param {string} traitName - Name of the trait to evaluate
 * @param {string} windowName - Name of the developmental window
 * @returns {Object} Trait development opportunity analysis
 */
export async function evaluateTraitDevelopmentOpportunity(horseId, traitName, windowName) {
  try {
    const window = DEVELOPMENTAL_WINDOWS[windowName];
    if (!window) {
      throw new Error(`Unknown developmental window: ${windowName}`);
    }

    const sensitivity = await calculateWindowSensitivity(horseId, windowName);

    // Calculate window alignment - how well the trait fits the window
    let windowAlignment = 0.5; // Default neutral alignment

    if (window.targetTraits.includes(traitName)) {
      windowAlignment = 0.9; // High alignment for target traits
    } else if (window.riskTraits.includes(traitName)) {
      // For fear periods, fearful traits have high development potential (negative alignment)
      if (windowName.includes('fear_period') && traitName === 'fearful') {
        windowAlignment = 0.95; // Very high potential for fearful trait during fear periods
      } else {
        windowAlignment = 0.2; // Low alignment for other risk traits
      }
    } else if (windowName.includes('fear_period') && traitName === 'brave') {
      // Brave traits have lower alignment during fear periods (harder to develop)
      windowAlignment = 0.25;
    } else {
      // Check for related traits
      const relatedTraits = getRelatedTraits(traitName);
      const hasRelatedTarget = relatedTraits.some(trait => window.targetTraits.includes(trait));
      const hasRelatedRisk = relatedTraits.some(trait => window.riskTraits.includes(trait));

      if (hasRelatedTarget) { windowAlignment = 0.7; } else if (hasRelatedRisk) { windowAlignment = 0.3; }
    }

    // Environmental support assessment
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { stressLevel: true, bondScore: true },
    });

    let environmentalSupport = 0.5;

    // Positive traits benefit from low stress and high bonding
    const positiveTraits = ['confident', 'brave', 'social', 'curious', 'trusting'];
    if (positiveTraits.includes(traitName)) {
      environmentalSupport += (20 - horse.stressLevel) * 0.02; // Lower stress helps
      environmentalSupport += (horse.bondScore - 20) * 0.01; // Higher bond helps
    }

    environmentalSupport = Math.max(0, Math.min(1, environmentalSupport));

    // Calculate development potential
    const developmentPotential = sensitivity.finalSensitivity * 0.4 + windowAlignment * 0.4 + environmentalSupport * 0.2;

    // Overall opportunity score
    const overallOpportunity = Math.max(0, Math.min(1, developmentPotential));

    // Generate recommended actions
    const recommendedActions = generateDevelopmentRecommendations(traitName, windowName, overallOpportunity);

    return {
      horseId,
      traitName,
      windowName,
      developmentPotential,
      windowAlignment,
      environmentalSupport,
      overallOpportunity,
      recommendedActions,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error evaluating trait development opportunity for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Track developmental milestones for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Developmental milestone tracking
 */
export async function trackDevelopmentalMilestones(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true, bondScore: true, stressLevel: true },
    });

    const currentAge = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Get interaction history for milestone assessment
    const interactions = await prisma.groomInteraction.findMany({
      where: { foalId: horseId },
      orderBy: { createdAt: 'asc' },
    });

    const achievedMilestones = [];
    const pendingMilestones = [];
    const milestoneProgress = {};

    Object.entries(DEVELOPMENTAL_MILESTONES).forEach(([milestoneName, milestone]) => {
      const window = DEVELOPMENTAL_WINDOWS[milestone.window];
      const progress = assessMilestoneProgress(milestoneName, milestone, interactions, currentAge, horse);

      milestoneProgress[milestoneName] = progress;

      if (progress.achieved) {
        achievedMilestones.push({
          name: milestoneName,
          window: milestone.window,
          achievedAt: progress.achievedAt,
          score: progress.score,
        });
      } else if (currentAge >= window.startDay && currentAge <= window.endDay) {
        pendingMilestones.push({
          name: milestoneName,
          window: milestone.window,
          progress: progress.completionPercentage,
          daysRemaining: window.endDay - currentAge,
        });
      }
    });

    // Calculate overall developmental score
    const totalPossibleScore = Object.values(DEVELOPMENTAL_MILESTONES).reduce((sum, m) => sum + m.score, 0);
    const achievedScore = achievedMilestones.reduce((sum, m) => sum + m.score, 0);
    const developmentalScore = achievedScore / totalPossibleScore;

    // Identify next milestones
    const nextMilestones = identifyNextMilestones(currentAge, achievedMilestones);

    return {
      horseId,
      achievedMilestones,
      pendingMilestones,
      milestoneProgress,
      developmentalScore,
      nextMilestones,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error tracking developmental milestones for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Assess window closure effects
 * @param {number} horseId - ID of the horse
 * @param {string} windowName - Name of the developmental window
 * @returns {Object} Window closure assessment
 */
export async function assessWindowClosure(horseId, windowName) {
  try {
    const window = DEVELOPMENTAL_WINDOWS[windowName];
    if (!window) {
      throw new Error(`Unknown developmental window: ${windowName}`);
    }

    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true },
    });

    const currentAge = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    let closureStatus;
    let closureDate = null;

    if (currentAge < window.startDay) {
      closureStatus = 'upcoming';
    } else if (currentAge >= window.startDay && currentAge <= window.endDay) {
      closureStatus = 'open';
    } else {
      closureStatus = 'closed';
      closureDate = new Date(horse.dateOfBirth.getTime() + window.endDay * 24 * 60 * 60 * 1000);
    }

    // Assess missed opportunities if window is closed
    const missedOpportunities = [];
    const compensatoryMechanisms = [];
    let futureImpact = 'minimal';

    if (closureStatus === 'closed') {
      // Check if target traits were developed
      const interactions = await prisma.groomInteraction.findMany({
        where: {
          foalId: horseId,
          createdAt: {
            gte: new Date(horse.dateOfBirth.getTime() + window.startDay * 24 * 60 * 60 * 1000),
            lte: closureDate,
          },
        },
      });

      if (interactions.length === 0) {
        missedOpportunities.push(`No developmental activities during ${window.description}`);
        futureImpact = 'significant';
      }

      // Generate compensatory mechanisms
      compensatoryMechanisms.push(...generateCompensatoryMechanisms(windowName, window));

      // Assess future impact
      const daysSinceClosure = currentAge - window.endDay;
      if (daysSinceClosure > 60) {
        futureImpact = 'permanent';
      } else if (daysSinceClosure > 30) {
        futureImpact = 'significant';
      } else {
        futureImpact = 'moderate';
      }
    }

    return {
      horseId,
      windowName,
      closureStatus,
      closureDate,
      missedOpportunities,
      compensatoryMechanisms,
      futureImpact,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error assessing window closure for horse ${horseId}, window ${windowName}:`, error);
    throw error;
  }
}

/**
 * Coordinate development across multiple active windows
 * @param {number} horseId - ID of the horse
 * @returns {Object} Multi-window coordination plan
 */
export async function coordinateMultiWindowDevelopment(horseId) {
  try {
    const windows = await identifyDevelopmentalWindows(horseId);

    if (windows.activeWindows.length <= 1) {
      return {
        horseId,
        activeWindows: windows.activeWindows,
        windowInteractions: [],
        priorityMatrix: {},
        coordinatedPlan: { phases: [] },
        conflictResolution: { identifiedConflicts: [], resolutionStrategies: [] },
        analysisTimestamp: new Date(),
      };
    }

    // Analyze window interactions
    const windowInteractions = analyzeWindowInteractions(windows.activeWindows);

    // Create priority matrix
    const priorityMatrix = createPriorityMatrix(windows.activeWindows);

    // Generate coordinated plan
    const coordinatedPlan = generateCoordinatedPlan(windows.activeWindows, windowInteractions, priorityMatrix);

    // Identify and resolve conflicts
    const conflictResolution = resolveWindowConflicts(windows.activeWindows, windowInteractions);

    return {
      horseId,
      activeWindows: windows.activeWindows,
      windowInteractions,
      priorityMatrix,
      coordinatedPlan,
      conflictResolution,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error coordinating multi-window development for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Analyze critical period sensitivity comprehensively
 * @param {number} horseId - ID of the horse
 * @returns {Object} Critical period sensitivity analysis
 */
export async function analyzeCriticalPeriodSensitivity(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true, stressLevel: true, bondScore: true, epigeneticFlags: true },
    });

    const currentAge = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Identify all critical periods
    const criticalPeriods = Object.values(DEVELOPMENTAL_WINDOWS).filter(window => window.sensitivity >= 0.7);

    // Calculate sensitivity profile
    const sensitivityProfile = {
      overallSensitivity: 0,
      peakSensitivityPeriods: [],
      currentSensitivity: 0,
    };

    let totalSensitivity = 0;
    for (const window of criticalPeriods) {
      const sensitivity = await calculateWindowSensitivity(horseId, window.name);
      totalSensitivity += sensitivity.finalSensitivity;

      if (sensitivity.finalSensitivity > 0.7) {
        sensitivityProfile.peakSensitivityPeriods.push({
          window: window.name,
          sensitivity: sensitivity.finalSensitivity,
        });
      }

      if (currentAge >= window.startDay && currentAge <= window.endDay) {
        sensitivityProfile.currentSensitivity = Math.max(sensitivityProfile.currentSensitivity, sensitivity.finalSensitivity);
      }
    }

    sensitivityProfile.overallSensitivity = totalSensitivity / criticalPeriods.length;

    // Identify risk factors
    const riskFactors = [];
    if (horse.stressLevel > 5) { riskFactors.push('High stress environment'); }
    if (horse.bondScore < 20) { riskFactors.push('Poor bonding relationship'); }
    if (currentAge < 30 && horse.epigeneticFlags.includes('fearful')) { riskFactors.push('Early fear trait development'); }
    if (currentAge < 14 && horse.stressLevel > 4) { riskFactors.push('Stress during critical early development'); }

    // Identify protective factors
    const protectiveFactors = [];
    if (horse.stressLevel < 4) { protectiveFactors.push('Low stress environment'); }
    if (horse.bondScore > 25) { protectiveFactors.push('Strong bonding relationship'); }
    if (horse.epigeneticFlags.includes('confident')) { protectiveFactors.push('Confidence trait present'); }

    // Generate intervention recommendations
    const interventionRecommendations = generateInterventionRecommendations(
      sensitivityProfile,
      riskFactors,
      protectiveFactors,
      currentAge,
    );

    return {
      horseId,
      criticalPeriods,
      sensitivityProfile,
      riskFactors,
      protectiveFactors,
      interventionRecommendations,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error analyzing critical period sensitivity for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Generate comprehensive developmental forecast
 * @param {number} horseId - ID of the horse
 * @param {number} forecastDays - Number of days to forecast
 * @returns {Object} Developmental forecast
 */
export async function generateDevelopmentalForecast(horseId, forecastDays) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true, epigeneticFlags: true, stressLevel: true, bondScore: true },
    });

    const currentAge = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
    const forecastEndAge = currentAge + forecastDays;

    // Identify upcoming windows
    const upcomingWindows = Object.values(DEVELOPMENTAL_WINDOWS).filter(window =>
      window.startDay <= forecastEndAge && window.endDay >= currentAge,
    ).map(window => ({
      ...window,
      daysUntilStart: Math.max(0, window.startDay - currentAge),
      daysUntilEnd: Math.max(0, window.endDay - currentAge),
      isActive: currentAge >= window.startDay && currentAge <= window.endDay,
    }));

    // Generate developmental trajectory
    const developmentalTrajectory = generateTrajectory(currentAge, forecastDays, upcomingWindows);

    // Predict trait development
    const traitDevelopmentPredictions = await generateTraitPredictions(horseId, upcomingWindows, horse);

    // Project milestones
    const milestoneProjections = projectMilestones(currentAge, forecastDays, upcomingWindows);

    // Assess risks
    const riskAssessment = assessDevelopmentalRisks(horse, upcomingWindows, forecastDays);

    // Generate recommendations
    const recommendations = generateForecastRecommendations(upcomingWindows, riskAssessment, traitDevelopmentPredictions);

    return {
      horseId,
      forecastPeriod: forecastDays,
      upcomingWindows,
      developmentalTrajectory,
      traitDevelopmentPredictions,
      milestoneProjections,
      riskAssessment,
      recommendations,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error generating developmental forecast for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Get related traits for a given trait
 */
function getRelatedTraits(traitName) {
  const traitRelations = {
    confident: ['brave', 'secure', 'assertive'],
    brave: ['confident', 'bold', 'fearless'],
    social: ['outgoing', 'friendly', 'cooperative'],
    curious: ['exploratory', 'inquisitive', 'intelligent'],
    fearful: ['anxious', 'timid', 'insecure'],
    calm: ['peaceful', 'stable', 'patient'],
    intelligent: ['smart', 'clever', 'adaptable'],
  };

  return traitRelations[traitName] || [];
}

/**
 * Generate development recommendations
 */
function generateDevelopmentRecommendations(traitName, windowName, opportunity) {
  const recommendations = [];
  const window = DEVELOPMENTAL_WINDOWS[windowName];

  if (opportunity > 0.7) {
    recommendations.push(`Excellent opportunity to develop ${traitName} - implement intensive ${window.interventions[0]}`);
    recommendations.push(`Focus on ${window.interventions.join(', ')} during this critical period`);
  } else if (opportunity > 0.5) {
    recommendations.push(`Good opportunity for ${traitName} development - use ${window.interventions[0]}`);
    recommendations.push('Monitor progress and adjust approach based on response');
  } else if (opportunity > 0.3) {
    recommendations.push(`Limited opportunity for ${traitName} - gentle approach recommended`);
    recommendations.push('Consider alternative developmental strategies');
  } else {
    recommendations.push(`Low opportunity for ${traitName} development in this window`);
    recommendations.push('Focus on other traits or wait for more suitable developmental period');
  }

  // Add trait-specific recommendations
  if (traitName === 'confident') {
    recommendations.push('Provide success experiences and positive reinforcement');
  } else if (traitName === 'curious') {
    recommendations.push('Offer safe exploration opportunities and novel experiences');
  } else if (traitName === 'social') {
    recommendations.push('Facilitate positive interactions with multiple handlers');
  }

  return recommendations;
}

/**
 * Assess milestone progress
 */
function assessMilestoneProgress(milestoneName, milestone, interactions, currentAge, horse) {
  const window = DEVELOPMENTAL_WINDOWS[milestone.window];

  // Check if window has passed
  if (currentAge > window.endDay) {
    // Assess based on interactions during the window
    const windowInteractions = interactions.filter(interaction => {
      const interactionAge = Math.floor((interaction.createdAt.getTime() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
      return interactionAge >= window.startDay && interactionAge <= window.endDay;
    });

    const achieved = assessMilestoneAchievement(milestoneName, milestone, windowInteractions, horse);

    return {
      achieved,
      achievedAt: achieved ? new Date(horse.dateOfBirth.getTime() + window.endDay * 24 * 60 * 60 * 1000) : null,
      score: achieved ? milestone.score : 0,
      completionPercentage: achieved ? 100 : calculatePartialCompletion(windowInteractions),
    };
  } else if (currentAge >= window.startDay) {
    // Currently in window - assess progress
    const windowInteractions = interactions.filter(interaction => {
      const interactionAge = Math.floor((interaction.createdAt.getTime() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 1000));
      return interactionAge >= window.startDay;
    });

    const completionPercentage = calculatePartialCompletion(windowInteractions);

    return {
      achieved: false,
      achievedAt: null,
      score: 0,
      completionPercentage,
    };
  } else {
    // Window not yet reached
    return {
      achieved: false,
      achievedAt: null,
      score: 0,
      completionPercentage: 0,
    };
  }
}

/**
 * Assess milestone achievement
 */
function assessMilestoneAchievement(milestoneName, milestone, interactions, horse) {
  switch (milestoneName) {
    case 'basic_trust':
      return interactions.some(i => i.bondingChange > 1) || horse.bondScore > 10;
    case 'environmental_comfort':
      return interactions.length >= 2 || interactions.some(i => i.taskType === 'showground_exposure');
    case 'fear_resilience':
      return interactions.some(i => i.stressChange <= 0) || horse.stressLevel < 7;
    case 'learning_motivation':
      return interactions.some(i => i.taskType === 'desensitization') || interactions.length >= 1;
    case 'emotional_stability':
      return horse.stressLevel < 6 || interactions.length >= 2;
    case 'social_competence': {
      const uniqueGrooms = new Set(interactions.map(i => i.groomId));
      return uniqueGrooms.size >= 1 || horse.bondScore > 15;
    }
    case 'self_confidence':
      return horse.bondScore > 25 || horse.stressLevel < 5;
    default:
      return false;
  }
}

/**
 * Calculate partial completion percentage
 */
function calculatePartialCompletion(interactions) {
  if (interactions.length === 0) { return 0; }

  const qualityScore = interactions.reduce((sum, i) => {
    const scores = { poor: 1, fair: 2, good: 3, excellent: 4 };
    return sum + (scores[i.quality] || 2);
  }, 0) / interactions.length;

  const frequencyScore = Math.min(1, interactions.length / 5) * 100;
  const qualityPercentage = (qualityScore / 4) * 100;

  return Math.min(100, (frequencyScore + qualityPercentage) / 2);
}

/**
 * Identify next milestones
 */
function identifyNextMilestones(currentAge, achievedMilestones) {
  const achievedNames = achievedMilestones.map(m => m.name);

  return Object.entries(DEVELOPMENTAL_MILESTONES)
    .filter(([name, milestone]) => {
      const window = DEVELOPMENTAL_WINDOWS[milestone.window];
      return !achievedNames.includes(name) && currentAge <= window.endDay + 30; // Include recently closed windows
    })
    .map(([name, milestone]) => ({
      name,
      window: milestone.window,
      requirement: milestone.requirement,
      score: milestone.score,
    }))
    .slice(0, 3); // Next 3 milestones
}

/**
 * Generate compensatory mechanisms for closed windows
 */
function generateCompensatoryMechanisms(windowName, _window) {
  const mechanisms = [];

  switch (windowName) {
    case 'imprinting':
      mechanisms.push('Extended bonding sessions with consistent handler');
      mechanisms.push('Trust-building exercises with positive reinforcement');
      mechanisms.push('Gradual relationship development over extended period');
      break;
    case 'early_socialization':
      mechanisms.push('Structured socialization program with multiple handlers');
      mechanisms.push('Gradual environmental exposure with support');
      mechanisms.push('Confidence-building activities in controlled settings');
      break;
    case 'fear_period_1':
    case 'fear_period_2':
      mechanisms.push('Systematic desensitization program');
      mechanisms.push('Counter-conditioning with positive associations');
      mechanisms.push('Stress reduction and calming protocols');
      break;
    case 'curiosity_development':
      mechanisms.push('Enrichment activities to stimulate exploration');
      mechanisms.push('Learning games and problem-solving exercises');
      mechanisms.push('Novel experiences in safe environments');
      break;
    case 'social_hierarchy':
      mechanisms.push('Structured social interactions with clear boundaries');
      mechanisms.push('Leadership training and confidence building');
      mechanisms.push('Group dynamics education through controlled exposure');
      break;
    case 'independence_development':
      mechanisms.push('Gradual independence training with support');
      mechanisms.push('Self-confidence building through achievable challenges');
      mechanisms.push('Autonomy development in safe environments');
      break;
    default:
      mechanisms.push('General developmental support and enrichment');
  }

  return mechanisms;
}

/**
 * Analyze window interactions
 */
function analyzeWindowInteractions(activeWindows) {
  const interactions = [];

  for (let i = 0; i < activeWindows.length; i++) {
    for (let j = i + 1; j < activeWindows.length; j++) {
      const window1 = activeWindows[i];
      const window2 = activeWindows[j];

      // Check for trait conflicts
      const conflictingTraits = window1.targetTraits.filter(trait =>
        window2.riskTraits.includes(trait) || window1.riskTraits.includes(trait),
      );

      // Check for synergistic traits
      const synergisticTraits = window1.targetTraits.filter(trait =>
        window2.targetTraits.includes(trait),
      );

      interactions.push({
        window1: window1.name,
        window2: window2.name,
        conflictingTraits,
        synergisticTraits,
        interactionType: conflictingTraits.length > 0 ? 'conflicting' :
          synergisticTraits.length > 0 ? 'synergistic' : 'neutral',
      });
    }
  }

  return interactions;
}

/**
 * Create priority matrix for active windows
 */
function createPriorityMatrix(activeWindows) {
  const matrix = {};

  activeWindows.forEach(window => {
    let priority = window.sensitivity; // Base priority on sensitivity

    // Adjust for urgency
    if (window.urgency === 'critical') { priority += 0.3; } else if (window.urgency === 'high') { priority += 0.2; } else if (window.urgency === 'moderate') { priority += 0.1; }

    // Adjust for days remaining
    if (window.daysRemaining <= 1) { priority += 0.2; } else if (window.daysRemaining <= 3) { priority += 0.1; }

    matrix[window.name] = Math.min(1.0, priority);
  });

  return matrix;
}

/**
 * Generate coordinated development plan
 */
function generateCoordinatedPlan(activeWindows, interactions, priorityMatrix) {
  const phases = [];

  // Sort windows by priority
  const sortedWindows = activeWindows.sort((a, b) =>
    priorityMatrix[b.name] - priorityMatrix[a.name],
  );

  // Create phases based on compatibility and priority
  let currentPhase = {
    name: 'Phase 1',
    windows: [],
    duration: 0,
    focus: 'primary_development',
  };

  sortedWindows.forEach(window => {
    const hasConflicts = interactions.some(interaction =>
      (interaction.window1 === window.name || interaction.window2 === window.name) &&
      interaction.interactionType === 'conflicting' &&
      currentPhase.windows.some(w => w.name === interaction.window1 || w.name === interaction.window2),
    );

    if (!hasConflicts && currentPhase.windows.length < 2) {
      currentPhase.windows.push(window);
      currentPhase.duration = Math.max(currentPhase.duration, window.daysRemaining);
    } else {
      if (currentPhase.windows.length > 0) {
        phases.push(currentPhase);
      }
      currentPhase = {
        name: `Phase ${phases.length + 2}`,
        windows: [window],
        duration: window.daysRemaining,
        focus: 'secondary_development',
      };
    }
  });

  if (currentPhase.windows.length > 0) {
    phases.push(currentPhase);
  }

  return { phases };
}

/**
 * Resolve window conflicts
 */
function resolveWindowConflicts(activeWindows, interactions) {
  const identifiedConflicts = interactions.filter(i => i.interactionType === 'conflicting');
  const resolutionStrategies = [];

  identifiedConflicts.forEach(conflict => {
    resolutionStrategies.push({
      conflict: `${conflict.window1} vs ${conflict.window2}`,
      strategy: 'Sequential development - prioritize based on urgency and sensitivity',
      implementation: 'Focus on higher priority window first, then address secondary window',
      conflictingTraits: conflict.conflictingTraits,
    });
  });

  return {
    identifiedConflicts,
    resolutionStrategies,
  };
}

/**
 * Generate intervention recommendations
 */
function generateInterventionRecommendations(sensitivityProfile, riskFactors, protectiveFactors, currentAge) {
  const recommendations = [];

  if (sensitivityProfile.currentSensitivity > 0.8) {
    recommendations.push('Immediate intervention required - horse is in critical developmental period');
    recommendations.push('Implement gentle, consistent care protocols');
    recommendations.push('Monitor stress levels closely and adjust approach as needed');
  }

  riskFactors.forEach(risk => {
    if (risk.includes('stress')) {
      recommendations.push('Implement stress reduction protocols immediately');
      recommendations.push('Create calm, predictable environment');
    } else if (risk.includes('bonding')) {
      recommendations.push('Focus on relationship building with primary caregiver');
      recommendations.push('Increase positive interaction frequency');
    } else if (risk.includes('fear')) {
      recommendations.push('Avoid potentially traumatic experiences');
      recommendations.push('Use counter-conditioning techniques');
    }
  });

  if (protectiveFactors.length > 0) {
    recommendations.push('Continue current positive practices that support development');
  }

  if (currentAge < 14) {
    recommendations.push('Critical early development period - maximize positive experiences');
  } else if (currentAge < 60) {
    recommendations.push('Important socialization period - provide varied but controlled experiences');
  }

  return recommendations;
}

/**
 * Generate developmental trajectory
 */
function generateTrajectory(currentAge, forecastDays, upcomingWindows) {
  const trajectory = [];

  for (let day = 0; day <= forecastDays; day += 7) { // Weekly points
    const projectedAge = currentAge + day;
    const activeWindows = upcomingWindows.filter(window =>
      projectedAge >= window.startDay && projectedAge <= window.endDay,
    );

    trajectory.push({
      day,
      projectedAge,
      activeWindows: activeWindows.map(w => w.name),
      developmentalIntensity: activeWindows.reduce((sum, w) => sum + w.sensitivity, 0),
      criticalityLevel: activeWindows.length > 0 ?
        Math.max(...activeWindows.map(w => w.sensitivity)) : 0,
    });
  }

  return trajectory;
}

/**
 * Generate trait predictions
 */
async function generateTraitPredictions(horseId, upcomingWindows, horse) {
  const predictions = [];
  const commonTraits = ['confident', 'brave', 'curious', 'social', 'calm', 'fearful'];

  for (const trait of commonTraits) {
    const currentProbability = horse.epigeneticFlags.includes(trait) ? 0.8 : 0.2;
    let projectedProbability = currentProbability;
    let developmentWindow = null;

    // Find best development window for this trait
    for (const window of upcomingWindows) {
      if (window.targetTraits.includes(trait)) {
        projectedProbability = Math.min(0.9, currentProbability + (window.sensitivity * 0.3));
        developmentWindow = window.name;
        break;
      } else if (window.riskTraits.includes(trait)) {
        projectedProbability = Math.max(0.1, currentProbability - (window.sensitivity * 0.2));
        developmentWindow = window.name;
        break;
      }
    }

    predictions.push({
      trait,
      currentProbability,
      projectedProbability,
      developmentWindow,
      confidence: developmentWindow ? 0.7 : 0.4,
    });
  }

  return predictions;
}

/**
 * Project milestones
 */
function projectMilestones(currentAge, forecastDays, _upcomingWindows) {
  const projections = [];

  Object.entries(DEVELOPMENTAL_MILESTONES).forEach(([name, milestone]) => {
    const window = DEVELOPMENTAL_WINDOWS[milestone.window];
    const projectedAge = currentAge + forecastDays;

    if (projectedAge >= window.startDay && currentAge <= window.endDay) {
      projections.push({
        milestone: name,
        window: milestone.window,
        projectedAchievement: projectedAge >= window.peakDay ? 'likely' : 'possible',
        timeframe: Math.max(0, window.endDay - currentAge),
      });
    }
  });

  return projections;
}

/**
 * Assess developmental risks
 */
function assessDevelopmentalRisks(horse, upcomingWindows, _forecastDays) {
  const risks = [];

  if (horse.stressLevel > 6) {
    risks.push({
      risk: 'High stress during critical periods',
      severity: 'high',
      impact: 'May impair positive trait development',
    });
  }

  if (horse.bondScore < 15) {
    risks.push({
      risk: 'Poor bonding relationship',
      severity: 'moderate',
      impact: 'May affect trust and social development',
    });
  }

  const criticalWindows = upcomingWindows.filter(w => w.sensitivity > 0.8);
  if (criticalWindows.length > 1) {
    risks.push({
      risk: 'Multiple critical periods overlap',
      severity: 'moderate',
      impact: 'May require careful coordination of interventions',
    });
  }

  return {
    risks,
    overallRiskLevel: risks.length > 2 ? 'high' : risks.length > 0 ? 'moderate' : 'low',
  };
}

/**
 * Generate forecast recommendations
 */
function generateForecastRecommendations(upcomingWindows, riskAssessment, traitPredictions) {
  const recommendations = [];

  // Window-based recommendations
  upcomingWindows.forEach(window => {
    if (window.sensitivity > 0.8) {
      recommendations.push({
        category: 'critical_window',
        action: `Prepare for ${window.name} - implement ${window.interventions[0]}`,
        timeframe: window.daysUntilStart > 0 ? `${window.daysUntilStart} days` : 'immediate',
        priority: 'high',
      });
    }
  });

  // Risk-based recommendations
  riskAssessment.risks.forEach(risk => {
    recommendations.push({
      category: 'risk_mitigation',
      action: `Address ${risk.risk.toLowerCase()}`,
      timeframe: 'immediate',
      priority: risk.severity,
    });
  });

  // Trait-based recommendations
  const highPotentialTraits = traitPredictions.filter(p =>
    p.projectedProbability > p.currentProbability + 0.2,
  );

  highPotentialTraits.forEach(trait => {
    recommendations.push({
      category: 'trait_development',
      action: `Focus on developing ${trait.trait} during ${trait.developmentWindow}`,
      timeframe: '1-2 weeks',
      priority: 'moderate',
    });
  });

  return recommendations;
}
