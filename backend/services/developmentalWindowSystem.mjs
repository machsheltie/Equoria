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
    endDay: 14,
    peakDay: 7,
    sensitivity: 0.9,
    description: 'Primary socialization and environmental adaptation',
    targetTraits: ['social', 'adaptable', 'confident'],
    riskTraits: ['antisocial', 'fearful', 'reactive'],
    interventions: ['varied_experiences', 'multiple_handlers', 'environmental_exposure'],
  },
  fear_period_1: {
    name: 'fear_period_1',
    startDay: 8,
    endDay: 11,
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
    let baseSensitivity = window.sensitivity;
    
    // Age modifier - peak sensitivity at peak day, declining towards edges
    let ageModifier = 0;
    if (currentAge >= window.startDay && currentAge <= window.endDay) {
      const distanceFromPeak = Math.abs(currentAge - window.peakDay);
      const maxDistance = Math.max(window.peakDay - window.startDay, window.endDay - window.peakDay);
      ageModifier = 1.0 - (distanceFromPeak / maxDistance) * 0.5; // 50% reduction at edges
    } else if (currentAge < window.startDay) {
      // Before window - minimal sensitivity
      ageModifier = 0.1;
    } else {
      // After window - very low sensitivity
      ageModifier = 0.05;
    }

    // Environmental modifier based on stress and bonding
    let environmentalModifier = 1.0;
    
    // Stress affects sensitivity differently for different window types
    if (windowName.includes('fear_period')) {
      // Higher stress increases sensitivity to fear periods
      environmentalModifier += horse.stressLevel * 0.05;
    } else {
      // Higher stress generally reduces positive development sensitivity
      environmentalModifier -= horse.stressLevel * 0.03;
    }
    
    // Bonding affects social and trust-related windows
    if (['imprinting', 'early_socialization', 'social_hierarchy'].includes(windowName)) {
      environmentalModifier += (horse.bondScore - 20) * 0.01;
    }

    environmentalModifier = Math.max(0.3, Math.min(1.5, environmentalModifier));

    const finalSensitivity = baseSensitivity * ageModifier * environmentalModifier;
    
    // Determine sensitivity level
    let sensitivityLevel;
    if (finalSensitivity >= 0.8) sensitivityLevel = 'critical';
    else if (finalSensitivity >= 0.6) sensitivityLevel = 'high';
    else if (finalSensitivity >= 0.4) sensitivityLevel = 'moderate';
    else if (finalSensitivity >= 0.2) sensitivityLevel = 'low';
    else sensitivityLevel = 'minimal';

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
      windowAlignment = 0.2; // Low alignment for risk traits (but still possible)
    } else {
      // Check for related traits
      const relatedTraits = getRelatedTraits(traitName);
      const hasRelatedTarget = relatedTraits.some(trait => window.targetTraits.includes(trait));
      const hasRelatedRisk = relatedTraits.some(trait => window.riskTraits.includes(trait));
      
      if (hasRelatedTarget) windowAlignment = 0.7;
      else if (hasRelatedRisk) windowAlignment = 0.3;
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
    if (horse.stressLevel > 6) riskFactors.push('High stress environment');
    if (horse.bondScore < 15) riskFactors.push('Poor bonding relationship');
    if (currentAge < 30 && horse.epigeneticFlags.includes('fearful')) riskFactors.push('Early fear trait development');

    // Identify protective factors
    const protectiveFactors = [];
    if (horse.stressLevel < 4) protectiveFactors.push('Low stress environment');
    if (horse.bondScore > 25) protectiveFactors.push('Strong bonding relationship');
    if (horse.epigeneticFlags.includes('confident')) protectiveFactors.push('Confidence trait present');

    // Generate intervention recommendations
    const interventionRecommendations = generateInterventionRecommendations(
      sensitivityProfile,
      riskFactors,
      protectiveFactors,
      currentAge
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
