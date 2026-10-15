/**
 * Developmental Windows — identification, sensitivity, closure, coordination
 *
 * Implements critical developmental period identification and the
 * sensitivity / closure / multi-window coordination analyses, plus the
 * per-window trait-development-opportunity evaluation.
 *
 * Extracted (Equoria-urqic.5) from developmentalWindowSystem.mjs. The
 * milestone-tracking and forecast concerns live in sibling modules
 * (developmentalMilestones.mjs, developmentalForecast.mjs). Shared window /
 * milestone definitions live in developmentalWindowDefinitions.mjs.
 *
 * Business Rules:
 * - Critical developmental window identification and timing
 * - Age-based trait expression sensitivity calculations
 * - Window-specific trait development opportunities
 * - Window closure effects on trait expression potential
 * - Multi-window coordination and conflict resolution
 * - Environmental sensitivity during critical periods
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { asFlagArray } from '../../../utils/jsonbArrayGuard.mjs';
import { DEVELOPMENTAL_WINDOWS } from './developmentalWindowDefinitions.mjs';
import {
  getRelatedTraits,
  generateDevelopmentRecommendations,
  generateCompensatoryMechanisms,
  analyzeWindowInteractions,
  createPriorityMatrix,
  generateCoordinatedPlan,
  resolveWindowConflicts,
  generateInterventionRecommendations,
} from './developmentalWindowCoordination.mjs';

/**
 * Identify active and upcoming developmental windows for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Developmental window analysis
 */
export async function identifyDevelopmentalWindows(horseId) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true, stressLevel: true, bondScore: true },
  });

  if (!horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }

  const currentAge = getHorseAgeDays(horse.dateOfBirth);

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
        preparationTime:
          daysUntilStart > 7 ? 'adequate' : daysUntilStart > 3 ? 'limited' : 'urgent',
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
    return score + window.sensitivity * urgencyMultiplier;
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
}

/**
 * Calculate sensitivity for a specific developmental window
 * @param {number} horseId - ID of the horse
 * @param {string} windowName - Name of the developmental window
 * @returns {Object} Window sensitivity analysis
 */
export async function calculateWindowSensitivity(horseId, windowName) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true, stressLevel: true, bondScore: true },
  });

  const window = DEVELOPMENTAL_WINDOWS[windowName];
  if (!window) {
    throw new Error(`Unknown developmental window: ${windowName}`);
  }

  const currentAge = getHorseAgeDays(horse.dateOfBirth);

  // Base sensitivity from window definition
  const baseSensitivity = window.sensitivity;

  // Age modifier - peak sensitivity at peak day, declining towards edges
  let ageModifier;
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
  if (finalSensitivity >= 0.8) {
    sensitivityLevel = 'critical';
  } else if (finalSensitivity >= 0.6) {
    sensitivityLevel = 'high';
  } else if (finalSensitivity >= 0.4) {
    sensitivityLevel = 'moderate';
  } else if (finalSensitivity >= 0.2) {
    sensitivityLevel = 'low';
  } else {
    sensitivityLevel = 'minimal';
  }

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
}

/**
 * Evaluate trait development opportunity during a specific window
 * @param {number} horseId - ID of the horse
 * @param {string} traitName - Name of the trait to evaluate
 * @param {string} windowName - Name of the developmental window
 * @returns {Object} Trait development opportunity analysis
 */
export async function evaluateTraitDevelopmentOpportunity(horseId, traitName, windowName) {
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

    if (hasRelatedTarget) {
      windowAlignment = 0.7;
    } else if (hasRelatedRisk) {
      windowAlignment = 0.3;
    }
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
  const developmentPotential =
    sensitivity.finalSensitivity * 0.4 + windowAlignment * 0.4 + environmentalSupport * 0.2;

  // Overall opportunity score
  const overallOpportunity = Math.max(0, Math.min(1, developmentPotential));

  // Generate recommended actions
  const recommendedActions = generateDevelopmentRecommendations(
    traitName,
    windowName,
    overallOpportunity,
  );

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
}

/**
 * Assess window closure effects
 * @param {number} horseId - ID of the horse
 * @param {string} windowName - Name of the developmental window
 * @returns {Object} Window closure assessment
 */
export async function assessWindowClosure(horseId, windowName) {
  const window = DEVELOPMENTAL_WINDOWS[windowName];
  if (!window) {
    throw new Error(`Unknown developmental window: ${windowName}`);
  }

  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true },
  });

  const currentAge = getHorseAgeDays(horse.dateOfBirth);

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
}

/**
 * Coordinate development across multiple active windows
 * @param {number} horseId - ID of the horse
 * @returns {Object} Multi-window coordination plan
 */
export async function coordinateMultiWindowDevelopment(horseId) {
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
  const coordinatedPlan = generateCoordinatedPlan(
    windows.activeWindows,
    windowInteractions,
    priorityMatrix,
  );

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
}

/**
 * Analyze critical period sensitivity comprehensively
 * @param {number} horseId - ID of the horse
 * @returns {Object} Critical period sensitivity analysis
 */
export async function analyzeCriticalPeriodSensitivity(horseId) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true, stressLevel: true, bondScore: true, epigeneticFlags: true },
  });

  const currentAge = getHorseAgeDays(horse.dateOfBirth);

  // Identify all critical periods
  const criticalPeriods = Object.values(DEVELOPMENTAL_WINDOWS).filter(
    window => window.sensitivity >= 0.7,
  );

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
      sensitivityProfile.currentSensitivity = Math.max(
        sensitivityProfile.currentSensitivity,
        sensitivity.finalSensitivity,
      );
    }
  }

  sensitivityProfile.overallSensitivity = totalSensitivity / criticalPeriods.length;

  // Identify risk factors
  const riskFactors = [];
  if (horse.stressLevel > 5) {
    riskFactors.push('High stress environment');
  }
  if (horse.bondScore < 20) {
    riskFactors.push('Poor bonding relationship');
  }
  if (currentAge < 30 && asFlagArray(horse.epigeneticFlags).includes('fearful')) {
    riskFactors.push('Early fear trait development');
  }
  if (currentAge < 14 && horse.stressLevel > 4) {
    riskFactors.push('Stress during critical early development');
  }

  // Identify protective factors
  const protectiveFactors = [];
  if (horse.stressLevel < 4) {
    protectiveFactors.push('Low stress environment');
  }
  if (horse.bondScore > 25) {
    protectiveFactors.push('Strong bonding relationship');
  }
  if (asFlagArray(horse.epigeneticFlags).includes('confident')) {
    protectiveFactors.push('Confidence trait present');
  }

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
}
