/**
 * Developmental Milestones — tracking and progress assessment
 *
 * Tracks developmental milestones keyed to developmental windows and
 * assesses per-milestone progress / achievement from a horse's groom
 * interaction history.
 *
 * Extracted (Equoria-urqic.5) from developmentalWindowSystem.mjs. Window
 * identification / sensitivity lives in developmentalWindows.mjs; the
 * shared window + milestone definitions live in
 * developmentalWindowDefinitions.mjs.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import {
  DEVELOPMENTAL_WINDOWS,
  DEVELOPMENTAL_MILESTONES,
} from './developmentalWindowDefinitions.mjs';

/**
 * Track developmental milestones for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Developmental milestone tracking
 */
export async function trackDevelopmentalMilestones(horseId) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true, bondScore: true, stressLevel: true },
  });

  const currentAge = getHorseAgeDays(horse.dateOfBirth);

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
    const progress = assessMilestoneProgress(
      milestoneName,
      milestone,
      interactions,
      currentAge,
      horse,
    );

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
  const totalPossibleScore = Object.values(DEVELOPMENTAL_MILESTONES).reduce(
    (sum, m) => sum + m.score,
    0,
  );
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
}

/**
 * Assess milestone progress
 */
export function assessMilestoneProgress(milestoneName, milestone, interactions, currentAge, horse) {
  const window = DEVELOPMENTAL_WINDOWS[milestone.window];

  // Check if window has passed
  if (currentAge > window.endDay) {
    // Assess based on interactions during the window
    const windowInteractions = interactions.filter(interaction => {
      const interactionAge = Math.floor(
        (interaction.createdAt.getTime() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24),
      );
      return interactionAge >= window.startDay && interactionAge <= window.endDay;
    });

    const achieved = assessMilestoneAchievement(
      milestoneName,
      milestone,
      windowInteractions,
      horse,
    );

    return {
      achieved,
      achievedAt: achieved
        ? new Date(horse.dateOfBirth.getTime() + window.endDay * 24 * 60 * 60 * 1000)
        : null,
      score: achieved ? milestone.score : 0,
      completionPercentage: achieved ? 100 : calculatePartialCompletion(windowInteractions),
    };
  } else if (currentAge >= window.startDay) {
    // Currently in window - assess progress
    const windowInteractions = interactions.filter(interaction => {
      const interactionAge = Math.floor(
        (interaction.createdAt.getTime() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24),
      );
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
      return (
        interactions.length >= 2 || interactions.some(i => i.taskType === 'showground_exposure')
      );
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
  if (interactions.length === 0) {
    return 0;
  }

  const qualityScore =
    interactions.reduce((sum, i) => {
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
