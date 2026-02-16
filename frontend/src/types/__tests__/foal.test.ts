/**
 * Unit Tests for Foal Helper Functions
 *
 * Testing Sprint Day 1 - Helper Functions & Critical Logic
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover 21 helper functions:
 * - Milestone progress and status (5 functions)
 * - Enrichment activity display (6 functions)
 * - Milestone evaluation (6 functions)
 * - Cooldown calculations (2 functions)
 * - Formatting and display (2 functions)
 */

import { describe, it, expect } from 'vitest';
import type {
  Milestone,
  MilestoneType,
  Foal,
  EnrichmentActivityDefinition,
  EnrichmentActivityStatus,
  DevelopmentStage,
} from '../foal';
import {
  calculateMilestoneProgress,
  getMilestoneStatus,
  getDaysUntilMilestone,
  getCurrentMilestone,
  calculateDevelopmentProgress,
  getActivityStatusColor,
  getActivityStatusLabel,
  getCategoryColor,
  getCategoryIcon,
  calculateCooldownRemaining,
  formatCooldownTime,
  canPerformActivity,
  getEvaluationCategory,
  getEvaluationColor,
  getTraitConfirmationReason,
  getScoreProgressPercentage,
  getComponentScoreColor,
  formatMilestoneName,
  getMilestoneDescription,
  getEvaluationExplanation,
  getFutureCareGuidance,
} from '../foal';

// Helper to create test milestone
const createMilestone = (
  type: MilestoneType,
  minAge: number,
  maxAge: number,
  status: 'pending' | 'in_progress' | 'completed' = 'pending'
): Milestone => ({
  type,
  name: `${type} milestone`,
  description: `Test ${type}`,
  ageWindow: { min: minAge, max: maxAge },
  status,
});

// Helper to create test foal
const createFoal = (ageInDays: number, completedMilestones: MilestoneType[] = []): Foal => ({
  id: 1,
  name: 'Test Foal',
  breedId: 1,
  sex: 'male',
  birthDate: new Date(Date.now() - ageInDays * 24 * 60 * 60 * 1000).toISOString(),
  ageInDays,
  currentMilestone: null,
  completedMilestones,
  developmentStage: 'week1' as DevelopmentStage,
  sireId: 1,
  damId: 2,
  bondingLevel: 50,
  stressLevel: 30,
});

describe('calculateMilestoneProgress', () => {
  it('should return 100 for completed milestone', () => {
    const milestone = createMilestone('imprinting', 1, 7, 'completed');
    expect(calculateMilestoneProgress(milestone, 5)).toBe(100);
  });

  it('should return 0 for foal age before milestone window', () => {
    const milestone = createMilestone('socialization', 8, 14);
    expect(calculateMilestoneProgress(milestone, 5)).toBe(0);
  });

  it('should calculate progress within window', () => {
    const milestone = createMilestone('curiosity_play', 8, 14);
    expect(calculateMilestoneProgress(milestone, 11)).toBe(50); // 3/6 days = 50%
  });

  it('should cap progress at 100%', () => {
    const milestone = createMilestone('trust_handling', 15, 21);
    expect(calculateMilestoneProgress(milestone, 25)).toBe(100);
  });

  it('should handle age exactly at min', () => {
    const milestone = createMilestone('imprinting', 1, 7);
    expect(calculateMilestoneProgress(milestone, 1)).toBe(0);
  });

  it('should handle age exactly at max', () => {
    const milestone = createMilestone('imprinting', 1, 7);
    expect(calculateMilestoneProgress(milestone, 7)).toBe(100);
  });
});

describe('getMilestoneStatus', () => {
  it('should return completed if milestone status is completed', () => {
    const milestone = createMilestone('imprinting', 1, 7, 'completed');
    expect(getMilestoneStatus(milestone, 5)).toBe('completed');
  });

  it('should return in_progress when foal age within window', () => {
    const milestone = createMilestone('socialization', 8, 14);
    expect(getMilestoneStatus(milestone, 10)).toBe('in_progress');
  });

  it('should return pending when foal age before window', () => {
    const milestone = createMilestone('curiosity_play', 15, 21);
    expect(getMilestoneStatus(milestone, 10)).toBe('pending');
  });

  it('should return completed when foal age past window', () => {
    const milestone = createMilestone('trust_handling', 15, 21);
    expect(getMilestoneStatus(milestone, 25)).toBe('completed');
  });

  it('should handle age exactly at min (in_progress)', () => {
    const milestone = createMilestone('imprinting', 1, 7);
    expect(getMilestoneStatus(milestone, 1)).toBe('in_progress');
  });

  it('should handle age exactly at max (in_progress)', () => {
    const milestone = createMilestone('imprinting', 1, 7);
    expect(getMilestoneStatus(milestone, 7)).toBe('in_progress');
  });
});

describe('getDaysUntilMilestone', () => {
  it('should return 0 when foal age within or past window', () => {
    const milestone = createMilestone('socialization', 8, 14);
    expect(getDaysUntilMilestone(milestone, 10)).toBe(0);
  });

  it('should return days until milestone starts', () => {
    const milestone = createMilestone('curiosity_play', 15, 21);
    expect(getDaysUntilMilestone(milestone, 10)).toBe(5);
  });

  it('should return 0 when at exact min age', () => {
    const milestone = createMilestone('imprinting', 1, 7);
    expect(getDaysUntilMilestone(milestone, 1)).toBe(0);
  });

  it('should handle foal age 0', () => {
    const milestone = createMilestone('imprinting', 1, 7);
    expect(getDaysUntilMilestone(milestone, 0)).toBe(1);
  });
});

describe('getCurrentMilestone', () => {
  const milestones = [
    createMilestone('imprinting', 1, 7),
    createMilestone('socialization', 8, 14),
    createMilestone('curiosity_play', 15, 21),
    createMilestone('trust_handling', 22, 28),
  ];

  it('should return current milestone when foal age within window', () => {
    const current = getCurrentMilestone(milestones, 10);
    expect(current?.type).toBe('socialization');
  });

  it('should return null when foal age before all milestones', () => {
    const current = getCurrentMilestone(milestones, 0);
    expect(current).toBeNull();
  });

  it('should return null when foal age after all milestones', () => {
    const current = getCurrentMilestone(milestones, 30);
    expect(current).toBeNull();
  });

  it('should handle empty milestones array', () => {
    const current = getCurrentMilestone([], 10);
    expect(current).toBeNull();
  });

  it('should return milestone when age at exact min', () => {
    const current = getCurrentMilestone(milestones, 15);
    expect(current?.type).toBe('curiosity_play');
  });

  it('should return milestone when age at exact max', () => {
    const current = getCurrentMilestone(milestones, 14);
    expect(current?.type).toBe('socialization');
  });
});

describe('calculateDevelopmentProgress', () => {
  it('should return 0 for empty milestones array', () => {
    expect(calculateDevelopmentProgress([], 10)).toBe(0);
  });

  it('should calculate progress with only completed milestones', () => {
    const milestones = [
      createMilestone('imprinting', 1, 7, 'completed'),
      createMilestone('socialization', 8, 14, 'completed'),
      createMilestone('curiosity_play', 15, 21),
      createMilestone('trust_handling', 22, 28),
    ];
    // 2/4 completed = 50%, foal age 30 is past all windows (no current milestone)
    expect(calculateDevelopmentProgress(milestones, 30)).toBe(50);
  });

  it('should add partial progress for current milestone', () => {
    const milestones = [
      createMilestone('imprinting', 1, 7, 'completed'),
      createMilestone('socialization', 8, 14), // In progress
      createMilestone('curiosity_play', 15, 21),
      createMilestone('trust_handling', 22, 28),
    ];
    // 1/4 completed (25%) + partial progress of current milestone (8-14, age 11 = 50% of 25% = 12.5%)
    // Total: 37% (rounded)
    const progress = calculateDevelopmentProgress(milestones, 11);
    expect(progress).toBeGreaterThan(25);
    expect(progress).toBeLessThan(50);
  });

  it('should cap progress at 100%', () => {
    const milestones = [
      createMilestone('imprinting', 1, 7, 'completed'),
      createMilestone('socialization', 8, 14, 'completed'),
    ];
    expect(calculateDevelopmentProgress(milestones, 30)).toBe(100);
  });

  it('should handle all milestones completed', () => {
    const milestones = [
      createMilestone('imprinting', 1, 7, 'completed'),
      createMilestone('socialization', 8, 14, 'completed'),
      createMilestone('curiosity_play', 15, 21, 'completed'),
      createMilestone('trust_handling', 22, 28, 'completed'),
    ];
    expect(calculateDevelopmentProgress(milestones, 30)).toBe(100);
  });
});

describe('getActivityStatusColor', () => {
  it('should return green for available', () => {
    expect(getActivityStatusColor('available')).toBe('text-green-600 bg-green-50 border-green-200');
  });

  it('should return amber for on_cooldown', () => {
    expect(getActivityStatusColor('on_cooldown')).toBe(
      'text-amber-600 bg-amber-50 border-amber-200'
    );
  });

  it('should return blue for completed_today', () => {
    expect(getActivityStatusColor('completed_today')).toBe(
      'text-blue-600 bg-blue-50 border-blue-200'
    );
  });

  it('should return gray for locked', () => {
    expect(getActivityStatusColor('locked')).toBe('text-gray-600 bg-gray-50 border-gray-200');
  });
});

describe('getActivityStatusLabel', () => {
  it('should return Available for available', () => {
    expect(getActivityStatusLabel('available')).toBe('Available');
  });

  it('should return On Cooldown for on_cooldown', () => {
    expect(getActivityStatusLabel('on_cooldown')).toBe('On Cooldown');
  });

  it('should return Completed Today for completed_today', () => {
    expect(getActivityStatusLabel('completed_today')).toBe('Completed Today');
  });

  it('should return Locked for locked', () => {
    expect(getActivityStatusLabel('locked')).toBe('Locked');
  });
});

describe('getCategoryColor', () => {
  it('should return blue for trust', () => {
    expect(getCategoryColor('trust')).toBe('text-blue-600 bg-blue-50 border-blue-200');
  });

  it('should return purple for desensitization', () => {
    expect(getCategoryColor('desensitization')).toBe(
      'text-purple-600 bg-purple-50 border-purple-200'
    );
  });

  it('should return emerald for exposure', () => {
    expect(getCategoryColor('exposure')).toBe('text-emerald-600 bg-emerald-50 border-emerald-200');
  });

  it('should return amber for habituation', () => {
    expect(getCategoryColor('habituation')).toBe('text-amber-600 bg-amber-50 border-amber-200');
  });
});

describe('getCategoryIcon', () => {
  it('should return Heart for trust', () => {
    expect(getCategoryIcon('trust')).toBe('Heart');
  });

  it('should return Shield for desensitization', () => {
    expect(getCategoryIcon('desensitization')).toBe('Shield');
  });

  it('should return Compass for exposure', () => {
    expect(getCategoryIcon('exposure')).toBe('Compass');
  });

  it('should return Clock for habituation', () => {
    expect(getCategoryIcon('habituation')).toBe('Clock');
  });
});

describe('calculateCooldownRemaining', () => {
  it('should return 0 when cooldown has passed', () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    expect(calculateCooldownRemaining(pastDate)).toBe(0);
  });

  it('should calculate remaining minutes correctly', () => {
    const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes from now
    const remaining = calculateCooldownRemaining(futureDate);
    expect(remaining).toBeGreaterThanOrEqual(29);
    expect(remaining).toBeLessThanOrEqual(31);
  });

  it('should round up fractional minutes', () => {
    const futureDate = new Date(Date.now() + 90 * 1000).toISOString(); // 1.5 minutes from now
    expect(calculateCooldownRemaining(futureDate)).toBe(2);
  });

  it('should handle large cooldowns', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours from now
    expect(calculateCooldownRemaining(futureDate)).toBe(24 * 60);
  });
});

describe('formatCooldownTime', () => {
  it('should format minutes only for < 60 minutes', () => {
    expect(formatCooldownTime(30)).toBe('30m');
    expect(formatCooldownTime(59)).toBe('59m');
  });

  it('should format hours only when no remainder', () => {
    expect(formatCooldownTime(60)).toBe('1h');
    expect(formatCooldownTime(120)).toBe('2h');
  });

  it('should format hours and minutes when remainder', () => {
    expect(formatCooldownTime(90)).toBe('1h 30m');
    expect(formatCooldownTime(125)).toBe('2h 5m');
  });

  it('should handle 0 minutes', () => {
    expect(formatCooldownTime(0)).toBe('0m');
  });

  it('should handle large durations', () => {
    expect(formatCooldownTime(24 * 60)).toBe('24h');
    expect(formatCooldownTime(24 * 60 + 15)).toBe('24h 15m');
  });
});

describe('canPerformActivity', () => {
  const baseActivity: EnrichmentActivityDefinition = {
    id: 'test-activity',
    name: 'Test Activity',
    description: 'Test',
    category: 'trust',
    durationMinutes: 30,
    cooldownHours: 12,
    benefits: {
      traitDiscoveryBoost: 5,
      milestoneBonus: 10,
      bondingIncrease: 5,
      stressReduction: 10,
    },
  };

  const availableStatus: EnrichmentActivityStatus = {
    activityId: 'test-activity',
    status: 'available',
    canPerform: true,
  };

  it('should return false when activity status is not available', () => {
    const result = canPerformActivity(baseActivity, createFoal(10), {
      ...availableStatus,
      status: 'on_cooldown',
    });
    expect(result.canPerform).toBe(false);
    expect(result.reason).toBe('On Cooldown');
  });

  it('should return true when no requirements and status available', () => {
    const result = canPerformActivity(baseActivity, createFoal(10), availableStatus);
    expect(result.canPerform).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should return false when foal under minimum age', () => {
    const activity = {
      ...baseActivity,
      requirements: { minAge: 7 },
    };
    const result = canPerformActivity(activity, createFoal(5), availableStatus);
    expect(result.canPerform).toBe(false);
    expect(result.reason).toContain('at least 7 days old');
  });

  it('should return false when foal over maximum age', () => {
    const activity = {
      ...baseActivity,
      requirements: { maxAge: 14 },
    };
    const result = canPerformActivity(activity, createFoal(20), availableStatus);
    expect(result.canPerform).toBe(false);
    expect(result.reason).toContain('under 14 days old');
  });

  it('should return false when required milestone not completed', () => {
    const activity = {
      ...baseActivity,
      requirements: { milestoneRequired: 'imprinting' as MilestoneType },
    };
    const result = canPerformActivity(activity, createFoal(10), availableStatus);
    expect(result.canPerform).toBe(false);
    expect(result.reason).toContain('imprinting milestone');
  });

  it('should return true when required milestone completed', () => {
    const activity = {
      ...baseActivity,
      requirements: { milestoneRequired: 'imprinting' as MilestoneType },
    };
    const foal = createFoal(10, ['imprinting']);
    const result = canPerformActivity(activity, foal, availableStatus);
    expect(result.canPerform).toBe(true);
  });

  it('should return false when stress level too high', () => {
    const activity = {
      ...baseActivity,
      requirements: { maxStressLevel: 50 },
    };
    const foal = createFoal(10);
    foal.stressLevel = 60;
    const result = canPerformActivity(activity, foal, availableStatus);
    expect(result.canPerform).toBe(false);
    expect(result.reason).toContain('stress level too high');
  });

  it('should handle multiple requirements', () => {
    const activity = {
      ...baseActivity,
      requirements: {
        minAge: 7,
        maxAge: 21,
        milestoneRequired: 'imprinting' as MilestoneType,
        maxStressLevel: 50,
      },
    };
    const foal = createFoal(10, ['imprinting']);
    foal.stressLevel = 30;
    const result = canPerformActivity(activity, foal, availableStatus);
    expect(result.canPerform).toBe(true);
  });
});

describe('getEvaluationCategory', () => {
  it('should return Excellent for score >= 5', () => {
    expect(getEvaluationCategory(5)).toBe('Excellent');
    expect(getEvaluationCategory(10)).toBe('Excellent');
  });

  it('should return Good for score 3-4', () => {
    expect(getEvaluationCategory(3)).toBe('Good');
    expect(getEvaluationCategory(4)).toBe('Good');
  });

  it('should return Neutral for score 0-2', () => {
    expect(getEvaluationCategory(0)).toBe('Neutral');
    expect(getEvaluationCategory(2)).toBe('Neutral');
  });

  it('should return Poor for score -3 to -1', () => {
    expect(getEvaluationCategory(-1)).toBe('Poor');
    expect(getEvaluationCategory(-3)).toBe('Poor');
  });

  it('should return Bad for score < -3', () => {
    expect(getEvaluationCategory(-4)).toBe('Bad');
    expect(getEvaluationCategory(-10)).toBe('Bad');
  });
});

describe('getEvaluationColor', () => {
  it('should return green for score >= 3', () => {
    expect(getEvaluationColor(3)).toBe('text-green-600 bg-green-50 border-green-200');
    expect(getEvaluationColor(10)).toBe('text-green-600 bg-green-50 border-green-200');
  });

  it('should return yellow for score 0-2', () => {
    expect(getEvaluationColor(0)).toBe('text-yellow-600 bg-yellow-50 border-yellow-200');
    expect(getEvaluationColor(2)).toBe('text-yellow-600 bg-yellow-50 border-yellow-200');
  });

  it('should return red for score < 0', () => {
    expect(getEvaluationColor(-1)).toBe('text-red-600 bg-red-50 border-red-200');
    expect(getEvaluationColor(-10)).toBe('text-red-600 bg-red-50 border-red-200');
  });
});

describe('getTraitConfirmationReason', () => {
  it('should return positive confirmation for score >= 3', () => {
    expect(getTraitConfirmationReason(3)).toBe('Score ≥3 confirms positive trait');
    expect(getTraitConfirmationReason(10)).toBe('Score ≥3 confirms positive trait');
  });

  it('should return negative confirmation for score <= -3', () => {
    expect(getTraitConfirmationReason(-3)).toBe('Score ≤-3 confirms negative trait');
    expect(getTraitConfirmationReason(-10)).toBe('Score ≤-3 confirms negative trait');
  });

  it('should return randomization for neutral scores', () => {
    expect(getTraitConfirmationReason(0)).toBe('Neutral score: trait randomized');
    expect(getTraitConfirmationReason(2)).toBe('Neutral score: trait randomized');
    expect(getTraitConfirmationReason(-2)).toBe('Neutral score: trait randomized');
  });
});

describe('getScoreProgressPercentage', () => {
  it('should convert -10 to 0%', () => {
    expect(getScoreProgressPercentage(-10)).toBe(0);
  });

  it('should convert 0 to 50%', () => {
    expect(getScoreProgressPercentage(0)).toBe(50);
  });

  it('should convert 10 to 100%', () => {
    expect(getScoreProgressPercentage(10)).toBe(100);
  });

  it('should handle intermediate values', () => {
    expect(getScoreProgressPercentage(5)).toBe(75);
    expect(getScoreProgressPercentage(-5)).toBe(25);
  });
});

describe('getComponentScoreColor', () => {
  it('should return green for >= 80% of max', () => {
    expect(getComponentScoreColor(8, 10)).toBe('bg-green-500');
    expect(getComponentScoreColor(4, 5)).toBe('bg-green-500');
  });

  it('should return yellow for 50-79% of max', () => {
    expect(getComponentScoreColor(5, 10)).toBe('bg-yellow-500');
    expect(getComponentScoreColor(7, 10)).toBe('bg-yellow-500');
  });

  it('should return red for < 50% of max', () => {
    expect(getComponentScoreColor(4, 10)).toBe('bg-red-500');
    expect(getComponentScoreColor(1, 10)).toBe('bg-red-500');
  });

  it('should handle edge cases', () => {
    expect(getComponentScoreColor(0, 10)).toBe('bg-red-500');
    expect(getComponentScoreColor(10, 10)).toBe('bg-green-500');
  });
});

describe('formatMilestoneName', () => {
  it('should format imprinting', () => {
    expect(formatMilestoneName('imprinting')).toBe('Imprinting');
  });

  it('should format socialization', () => {
    expect(formatMilestoneName('socialization')).toBe('Socialization');
  });

  it('should format curiosity_play', () => {
    expect(formatMilestoneName('curiosity_play')).toBe('Curiosity & Play');
  });

  it('should format trust_handling', () => {
    expect(formatMilestoneName('trust_handling')).toBe('Trust & Handling');
  });

  it('should format confidence_reactivity', () => {
    expect(formatMilestoneName('confidence_reactivity')).toBe('Confidence & Reactivity');
  });
});

describe('getMilestoneDescription', () => {
  it('should return description for imprinting', () => {
    const desc = getMilestoneDescription('imprinting');
    expect(desc).toContain('first day');
    expect(desc).toContain('bonding');
  });

  it('should return description for socialization', () => {
    const desc = getMilestoneDescription('socialization');
    expect(desc).toContain('Social');
    expect(desc).toContain('interaction');
  });

  it('should return description for curiosity_play', () => {
    const desc = getMilestoneDescription('curiosity_play');
    expect(desc).toContain('Exploration');
    expect(desc).toContain('playful');
  });

  it('should return description for trust_handling', () => {
    const desc = getMilestoneDescription('trust_handling');
    expect(desc).toContain('Human');
    expect(desc).toContain('trust');
  });

  it('should return description for confidence_reactivity', () => {
    const desc = getMilestoneDescription('confidence_reactivity');
    expect(desc).toContain('temperament');
    expect(desc).toContain('confidence');
  });
});

describe('getEvaluationExplanation', () => {
  it('should return Excellent explanation for high scores', () => {
    const explanation = getEvaluationExplanation(8, 'imprinting', []);
    expect(explanation).toContain('excellent');
    expect(explanation).toContain('Imprinting');
  });

  it('should return Good explanation for positive scores', () => {
    const explanation = getEvaluationExplanation(3, 'socialization', []);
    expect(explanation).toContain('consistent');
    expect(explanation).toContain('Socialization');
  });

  it('should return Neutral explanation for neutral scores', () => {
    const explanation = getEvaluationExplanation(1, 'curiosity_play', []);
    expect(explanation).toContain('average');
    expect(explanation).toContain('Curiosity & Play');
  });

  it('should return Poor explanation for slightly negative scores', () => {
    const explanation = getEvaluationExplanation(-2, 'trust_handling', []);
    expect(explanation).toContain('inconsistent');
    expect(explanation).toContain('Trust & Handling');
  });

  it('should return Bad explanation for very negative scores', () => {
    const explanation = getEvaluationExplanation(-5, 'confidence_reactivity', []);
    expect(explanation).toContain('insufficient');
    expect(explanation).toContain('Confidence & Reactivity');
  });
});

describe('getFutureCareGuidance', () => {
  it('should return continue guidance for score >= 3', () => {
    const guidance = getFutureCareGuidance(5);
    expect(guidance).toContain('Continue');
    expect(guidance).toContain('consistent');
  });

  it('should return focus guidance for score 0-2', () => {
    const guidance = getFutureCareGuidance(1);
    expect(guidance).toContain('Focus');
    expect(guidance).toContain('enrichment');
  });

  it('should return increase guidance for score < 0', () => {
    const guidance = getFutureCareGuidance(-3);
    expect(guidance).toContain('Increase');
    expect(guidance).toContain('extra attention');
  });
});
