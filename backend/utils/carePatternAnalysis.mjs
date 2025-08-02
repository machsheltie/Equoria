/**
 * Care Pattern Analysis System
 * Analyzes care patterns and interaction history to determine epigenetic flag triggers
 *
 * 🎯 PURPOSE:
 * Evaluates cumulative care patterns between birth and age 3 to determine which
 * epigenetic flags should be assigned based on trigger conditions defined in
 * the flag definitions system.
 *
 * 📋 BUSINESS RULES:
 * - Analyzes GroomInteraction records for pattern matching
 * - Evaluates bond scores, stress events, and care consistency
 * - Tracks novelty exposure and environmental factors
 * - Supports weekly evaluation cycles
 * - Considers care quality and groom presence during events
 */

import prisma from '../db/index.mjs';
import logger from './logger.mjs';
import { EPIGENETIC_FLAG_DEFINITIONS } from '../config/epigeneticFlagDefinitions.mjs';

/**
 * Analyze care patterns for a specific horse
 * @param {number} horseId - ID of the horse to analyze
 * @param {Date} evaluationDate - Date of evaluation (default: now)
 * @returns {Object} Care pattern analysis results
 */
export async function analyzeCarePatterns(horseId, evaluationDate = new Date()) {
  try {
    logger.info(`[carePatternAnalysis] Starting analysis for horse ${horseId}`);

    // Get horse details
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      include: {
        groomInteractions: {
          where: {
            createdAt: {
              gte: new Date(evaluationDate.getTime() - (7 * 24 * 60 * 60 * 1000)), // Last 7 days
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!horse) {
      throw new Error(`Horse with ID ${horseId} not found`);
    }

    // Calculate horse age in days
    const ageInDays = Math.floor((evaluationDate - new Date(horse.dateOfBirth)) / (1000 * 60 * 60 * 24));
    const ageInYears = ageInDays / 365.25;

    // Only analyze horses under 3 years old
    if (ageInYears >= 3) {
      return {
        eligible: false,
        reason: 'Horse is too old for epigenetic flag evaluation',
        ageInYears,
        patterns: {},
      };
    }

    // Analyze different care patterns
    const patterns = {
      consistentCare: analyzeConsistentCare(horse.groomInteractions, horse.bondScore),
      noveltyExposure: analyzeNoveltyExposure(horse.groomInteractions, horse.bondScore),
      stressManagement: analyzeStressManagement(horse.groomInteractions, horse.stressLevel),
      bondingPatterns: analyzeBondingPatterns(horse.groomInteractions, horse.bondScore),
      neglectPatterns: analyzeNeglectPatterns(horse.groomInteractions, horse.bondScore),
      environmentalFactors: analyzeEnvironmentalFactors(horse.groomInteractions),
    };

    return {
      eligible: true,
      horseId,
      ageInDays,
      ageInYears,
      currentBondScore: horse.bondScore || 0,
      currentStressLevel: horse.stressLevel || 0,
      patterns,
      evaluationDate,
    };

  } catch (error) {
    logger.error(`[carePatternAnalysis] Error analyzing patterns for horse ${horseId}: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze consistent care patterns
 * @param {Array} interactions - Groom interactions
 * @param {number} bondScore - Current bond score
 * @returns {Object} Consistent care analysis
 */
function analyzeConsistentCare(interactions, bondScore) {
  const dailyInteractions = groupInteractionsByDay(interactions);
  const consecutiveDays = calculateConsecutiveDays(dailyInteractions);

  // Check for daily grooming pattern
  const groomingInteractions = interactions.filter(i =>
    i.interactionType.includes('grooming') || i.interactionType.includes('daily_care'),
  );

  const qualityInteractions = interactions.filter(i =>
    ['good', 'excellent'].includes(i.quality),
  );

  return {
    consecutiveDaysWithCare: consecutiveDays,
    totalInteractions: interactions.length,
    groomingInteractions: groomingInteractions.length,
    qualityInteractions: qualityInteractions.length,
    averageBondChange: calculateAverageBondChange(interactions),
    meetsConsistentCareThreshold: consecutiveDays >= 7 && bondScore >= 40,
  };
}

/**
 * Analyze novelty exposure patterns
 * @param {Array} interactions - Groom interactions
 * @param {number} bondScore - Current bond score
 * @returns {Object} Novelty exposure analysis
 */
function analyzeNoveltyExposure(interactions, bondScore) {
  const noveltyInteractions = interactions.filter(i =>
    i.interactionType.includes('desensitization') ||
    i.interactionType.includes('exploration') ||
    i.interactionType.includes('showground_exposure'),
  );

  const noveltyWithSupport = noveltyInteractions.filter(i =>
    i.bondingChange >= 0 && ['good', 'excellent'].includes(i.quality),
  );

  const fearEvents = interactions.filter(i =>
    i.stressChange > 5 || i.bondingChange < -3,
  );

  return {
    noveltyEvents: noveltyInteractions.length,
    noveltyWithSupport: noveltyWithSupport.length,
    fearEvents: fearEvents.length,
    calmGroomPresent: noveltyWithSupport.length > 0,
    meetsBraveThreshold: noveltyWithSupport.length >= 3 && bondScore >= 30,
  };
}

/**
 * Analyze stress management patterns
 * @param {Array} interactions - Groom interactions
 * @param {number} stressLevel - Current stress level
 * @returns {Object} Stress management analysis
 */
function analyzeStressManagement(interactions, stressLevel) {
  const stressEvents = interactions.filter(i => i.stressChange > 3);
  const recoveryEvents = interactions.filter(i => i.stressChange < -2);

  const stressWithSupport = stressEvents.filter(i => {
    // Find recovery within 24 hours
    const eventTime = new Date(i.createdAt);
    return interactions.some(recovery =>
      recovery.stressChange < -2 &&
      new Date(recovery.createdAt) > eventTime &&
      new Date(recovery.createdAt) <= new Date(eventTime.getTime() + 24 * 60 * 60 * 1000),
    );
  });

  return {
    stressEvents: stressEvents.length,
    recoveryEvents: recoveryEvents.length,
    stressWithSupport: stressWithSupport.length,
    currentStressLevel: stressLevel,
    meetsResilientThreshold: stressWithSupport.length >= 3,
    meetsFragileThreshold: stressEvents.length >= 3 && stressWithSupport.length === 0,
  };
}

/**
 * Analyze bonding patterns
 * @param {Array} interactions - Groom interactions
 * @param {number} bondScore - Current bond score
 * @returns {Object} Bonding pattern analysis
 */
function analyzeBondingPatterns(interactions, bondScore) {
  const positiveInteractions = interactions.filter(i => i.bondingChange > 0);
  const highQualityInteractions = interactions.filter(i =>
    ['good', 'excellent'].includes(i.quality),
  );

  const dailyInteractions = groupInteractionsByDay(interactions);
  const daysWithInteraction = Object.keys(dailyInteractions).length;

  return {
    positiveInteractions: positiveInteractions.length,
    highQualityInteractions: highQualityInteractions.length,
    daysWithInteraction,
    currentBondScore: bondScore,
    averageBondChange: calculateAverageBondChange(interactions),
    meetsAffectionateThreshold: daysWithInteraction >= 7 && bondScore >= 50,
    meetsConfidentThreshold: positiveInteractions.length >= 10 && bondScore >= 40,
  };
}

/**
 * Analyze neglect patterns
 * @param {Array} interactions - Groom interactions
 * @param {number} bondScore - Current bond score
 * @returns {Object} Neglect pattern analysis
 */
function analyzeNeglectPatterns(interactions, bondScore) {
  const dailyInteractions = groupInteractionsByDay(interactions);
  const daysWithoutCare = calculateDaysWithoutCare(dailyInteractions);

  const poorQualityInteractions = interactions.filter(i =>
    ['poor', 'fair'].includes(i.quality),
  );

  const negativeInteractions = interactions.filter(i => i.bondingChange < 0);

  return {
    maxConsecutiveDaysWithoutCare: daysWithoutCare,
    poorQualityInteractions: poorQualityInteractions.length,
    negativeInteractions: negativeInteractions.length,
    currentBondScore: bondScore,
    meetsInsecureThreshold: daysWithoutCare >= 4 && bondScore <= 25,
    meetsAloofThreshold: interactions.length < 3 && bondScore <= 30,
  };
}

/**
 * Analyze environmental factors
 * @param {Array} interactions - Groom interactions
 * @returns {Object} Environmental factor analysis
 */
function analyzeEnvironmentalFactors(interactions) {
  const startleEvents = interactions.filter(i =>
    i.notes && i.notes.toLowerCase().includes('startle') ||
    i.stressChange > 5,
  );

  const routineInteractions = interactions.filter(i =>
    i.interactionType.includes('daily_care') || i.interactionType.includes('feeding'),
  );

  return {
    startleEvents: startleEvents.length,
    routineInteractions: routineInteractions.length,
    environmentalChanges: 0, // TODO: Implement environmental change tracking
    meetsSkittishThreshold: startleEvents.length >= 2,
    hasRoutine: routineInteractions.length >= 5,
  };
}

/**
 * Helper function to group interactions by day
 * @param {Array} interactions - Groom interactions
 * @returns {Object} Interactions grouped by day
 */
function groupInteractionsByDay(interactions) {
  return interactions.reduce((groups, interaction) => {
    const day = new Date(interaction.createdAt).toDateString();
    if (!groups[day]) {
      groups[day] = [];
    }
    groups[day].push(interaction);
    return groups;
  }, {});
}

/**
 * Calculate consecutive days with care
 * @param {Object} dailyInteractions - Interactions grouped by day
 * @returns {number} Number of consecutive days
 */
function calculateConsecutiveDays(dailyInteractions) {
  const days = Object.keys(dailyInteractions).sort();
  let consecutiveDays = 0;
  let currentStreak = 0;

  for (let i = 0; i < days.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prevDay = new Date(days[i - 1]);
      const currentDay = new Date(days[i]);
      const dayDiff = (currentDay - prevDay) / (1000 * 60 * 60 * 24);

      if (dayDiff <= 2) { // Allow 1-day gap (grace period)
        currentStreak++;
      } else {
        currentStreak = 1;
      }
    }
    consecutiveDays = Math.max(consecutiveDays, currentStreak);
  }

  return consecutiveDays;
}

/**
 * Calculate days without care
 * @param {Object} dailyInteractions - Interactions grouped by day
 * @returns {number} Maximum consecutive days without care
 */
function calculateDaysWithoutCare(dailyInteractions) {
  const days = Object.keys(dailyInteractions).sort();
  let maxGap = 0;

  for (let i = 1; i < days.length; i++) {
    const prevDay = new Date(days[i - 1]);
    const currentDay = new Date(days[i]);
    const dayGap = Math.floor((currentDay - prevDay) / (1000 * 60 * 60 * 24)) - 1;
    maxGap = Math.max(maxGap, dayGap);
  }

  return maxGap;
}

/**
 * Calculate average bond change
 * @param {Array} interactions - Groom interactions
 * @returns {number} Average bond change
 */
function calculateAverageBondChange(interactions) {
  if (interactions.length === 0) { return 0; }
  const totalBondChange = interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0);
  return totalBondChange / interactions.length;
}

export default {
  analyzeCarePatterns,
  analyzeConsistentCare,
  analyzeNoveltyExposure,
  analyzeStressManagement,
  analyzeBondingPatterns,
  analyzeNeglectPatterns,
  analyzeEnvironmentalFactors,
};
