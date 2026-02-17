/**
 * Groom Career Lifecycle Types for Story 7-4 (Career Lifecycle Dashboard)
 *
 * Defines career data, XP/level progression helpers, and retirement status
 * calculations mirroring backend groomProgressionService.mjs and groomRetirementService.mjs.
 *
 * XP per level: 100 * level (Level 1 needs 100 XP, Level 2 needs 200 XP, etc.)
 * Level N starts at: 100 * N*(N-1)/2
 */

export interface GroomCareerData {
  id: number;
  name: string;
  experience: number;
  level: number;
  careerWeeks: number;
  hiredDate: string; // ISO timestamp
  retired: boolean;
  retirementReason?: string;
  retirementTimestamp?: string; // ISO timestamp
}

export interface GroomPerformanceMetrics {
  totalInteractions: number;
  bondingEffectiveness: number; // 0-100
  taskCompletion: number; // 0-100
  horseWellbeing: number; // 0-100
  showPerformance: number; // 0-100
  reputationScore: number; // 0-100
}

export type RetirementWarningReason = 'approaching_mandatory' | 'level_cap' | 'assignment_limit';

export interface RetirementStatus {
  isRetired: boolean;
  weeksRemaining: number; // Weeks until mandatory retirement (clamped to 0)
  isApproachingRetirement: boolean; // Within RETIREMENT_NOTICE_WEEKS of mandatory
  earlyRetirementEligible: boolean; // Level cap or assignment limit reached
  earlyRetirementReason?: RetirementWarningReason;
  warningReasons: RetirementWarningReason[];
}

export interface XPProgress {
  level: number; // Current level (1-10)
  xpInLevel: number; // XP earned within the current level
  xpToNextLevel: number; // XP needed to complete this level (0 if max)
  totalXPForCurrentLevel: number; // Total XP at which this level started
  isMaxLevel: boolean;
  progressPercent: number; // 0-100
}

export interface CareerMilestone {
  id: string;
  label: string;
  description: string;
  reached: boolean;
}

/** Career constants mirroring backend groomRetirementService.mjs */
export const CAREER_CONSTANTS = {
  MANDATORY_RETIREMENT_WEEKS: 104,
  EARLY_RETIREMENT_LEVEL: 10,
  EARLY_RETIREMENT_ASSIGNMENTS: 12,
  RETIREMENT_NOTICE_WEEKS: 1,
  LEVEL_CAP: 10,
} as const;

/**
 * XP required to start a given level.
 * Level 1 starts at 0, Level 2 at 100, Level 3 at 300, etc.
 * Formula: 100 * N*(N-1)/2
 */
export function xpToStartLevel(level: number): number {
  return (100 * level * (level - 1)) / 2;
}

/**
 * Calculate XP progress within the current level.
 * Mirrors calculateGroomLevel from backend groomProgressionService.mjs.
 */
export function calculateXPProgress(experience: number): XPProgress {
  const { LEVEL_CAP } = CAREER_CONSTANTS;

  // Find current level
  let level = 1;
  for (let l = 1; l <= LEVEL_CAP; l++) {
    if (experience >= xpToStartLevel(l)) {
      level = l;
    } else {
      break;
    }
  }

  const isMaxLevel = level >= LEVEL_CAP;
  const totalXPForCurrentLevel = xpToStartLevel(level);
  const xpInLevel = experience - totalXPForCurrentLevel;

  if (isMaxLevel) {
    return {
      level: LEVEL_CAP,
      xpInLevel,
      xpToNextLevel: 0,
      totalXPForCurrentLevel,
      isMaxLevel: true,
      progressPercent: 100,
    };
  }

  const xpToNextLevel = 100 * level; // XP needed for this level
  const progressPercent = Math.min(100, Math.round((xpInLevel / xpToNextLevel) * 100));

  return {
    level,
    xpInLevel,
    xpToNextLevel,
    totalXPForCurrentLevel,
    isMaxLevel: false,
    progressPercent,
  };
}

/**
 * Calculate retirement status for a groom.
 * Mandatory at 104 weeks, early triggers at level 10 or 12+ assignments.
 */
export function calculateRetirementStatus(
  careerWeeks: number,
  level: number,
  assignmentCount: number
): RetirementStatus {
  const {
    MANDATORY_RETIREMENT_WEEKS,
    RETIREMENT_NOTICE_WEEKS,
    EARLY_RETIREMENT_LEVEL,
    EARLY_RETIREMENT_ASSIGNMENTS,
  } = CAREER_CONSTANTS;

  const weeksRemaining = Math.max(0, MANDATORY_RETIREMENT_WEEKS - careerWeeks);
  const isApproachingRetirement = weeksRemaining <= RETIREMENT_NOTICE_WEEKS && weeksRemaining > 0;
  const isRetiredByWeeks = careerWeeks >= MANDATORY_RETIREMENT_WEEKS;

  const levelCapReached = level >= EARLY_RETIREMENT_LEVEL;
  const assignmentLimitReached = assignmentCount >= EARLY_RETIREMENT_ASSIGNMENTS;
  const earlyRetirementEligible = levelCapReached || assignmentLimitReached;

  const warningReasons: RetirementWarningReason[] = [];
  if (isApproachingRetirement || isRetiredByWeeks) {
    warningReasons.push('approaching_mandatory');
  }
  if (levelCapReached) {
    warningReasons.push('level_cap');
  }
  if (assignmentLimitReached) {
    warningReasons.push('assignment_limit');
  }

  let earlyRetirementReason: RetirementWarningReason | undefined;
  if (levelCapReached) {
    earlyRetirementReason = 'level_cap';
  } else if (assignmentLimitReached) {
    earlyRetirementReason = 'assignment_limit';
  }

  return {
    isRetired: isRetiredByWeeks,
    weeksRemaining,
    isApproachingRetirement,
    earlyRetirementEligible,
    earlyRetirementReason,
    warningReasons,
  };
}

/**
 * Build career milestone list from groom data.
 * Milestones reflect significant career points.
 */
export function buildCareerMilestones(
  level: number,
  careerWeeks: number,
  assignmentCount: number
): CareerMilestone[] {
  return [
    {
      id: 'hired',
      label: 'Career Started',
      description: 'Groom joined the stable',
      reached: true, // Always reached (they exist)
    },
    {
      id: 'first_assignment',
      label: 'First Assignment',
      description: 'Assigned to a horse for the first time',
      reached: assignmentCount >= 1,
    },
    {
      id: 'level_5',
      label: 'Experienced (Level 5)',
      description: 'Reached level 5 through dedicated care',
      reached: level >= 5,
    },
    {
      id: 'level_10',
      label: 'Master Groom (Level 10)',
      description: 'Achieved maximum skill level',
      reached: level >= 10,
    },
    {
      id: 'six_month',
      label: 'Six Months',
      description: 'Served for 26+ career weeks',
      reached: careerWeeks >= 26,
    },
    {
      id: 'one_year',
      label: 'One Year',
      description: 'Served for 52+ career weeks',
      reached: careerWeeks >= 52,
    },
  ];
}

/** Retirement reason display labels */
export const RETIREMENT_REASON_LABELS: Record<string, string> = {
  mandatory_career_limit: 'Mandatory retirement (2-year career limit)',
  early_level_cap: 'Early retirement (Master level achieved)',
  early_assignment_limit: 'Early retirement (12 assignments completed)',
  voluntary: 'Voluntary retirement',
};
