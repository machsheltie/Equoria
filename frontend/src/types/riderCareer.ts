/**
 * Rider Career Lifecycle Types (Epic 9C — Story 9C-4)
 *
 * Defines career data, XP/level progression helpers, and retirement status
 * calculations for the Rider System. Mirrors groomCareer.ts pattern.
 *
 * XP per level: 100 * level (Level 1 needs 100 XP, Level 2 needs 200 XP, etc.)
 * Level N starts at: 100 * N*(N-1)/2
 *
 * Rider careers are finite (weeks-based) with retirement warnings.
 * Legacy riders (high wins/prestige) may earn special contract extensions.
 */

export interface RiderCareerData {
  id: number;
  name: string;
  experience: number; // total XP earned
  level: number; // 1–10
  careerWeeks: number;
  hiredDate: string; // ISO timestamp
  retired: boolean;
  retirementReason?: string;
  retirementTimestamp?: string; // ISO timestamp
  totalWins: number;
  totalCompetitions: number;
  prestige: number; // 0–100, used for legacy contracts
}

export interface RiderPerformanceMetrics {
  totalRides: number;
  winRate: number; // 0–100
  averagePlacement: number; // lower is better
  disciplineWins: Record<string, number>; // discipline → win count
  horseCompatibilityScore: number; // 0–100
  prestigeScore: number; // 0–100
}

export type RiderRetirementWarningReason =
  | 'approaching_mandatory'
  | 'level_cap'
  | 'competition_limit';

export interface RiderRetirementStatus {
  isRetired: boolean;
  weeksRemaining: number;
  isApproachingRetirement: boolean;
  legacyContractEligible: boolean; // High prestige / wins threshold
  retirementReason?: RiderRetirementWarningReason;
  warningReasons: RiderRetirementWarningReason[];
}

export interface RiderXPProgress {
  level: number; // 1–10
  xpInLevel: number;
  xpToNextLevel: number;
  totalXPForCurrentLevel: number;
  isMaxLevel: boolean;
  progressPercent: number; // 0–100
}

export interface RiderCareerMilestone {
  id: string;
  label: string;
  description: string;
  reached: boolean;
}

/** Career constants for riders */
export const RIDER_CAREER_CONSTANTS = {
  MANDATORY_RETIREMENT_WEEKS: 104,
  RETIREMENT_NOTICE_WEEKS: 3, // Riders get 3-week warning (vs 1 week for grooms)
  LEVEL_CAP: 10,
  LEGACY_CONTRACT_PRESTIGE_THRESHOLD: 80,
  LEGACY_CONTRACT_WINS_THRESHOLD: 50,
  SLOT_CAP_BY_STABLE_LEVEL: {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
  } as Record<number, number>,
} as const;

/**
 * XP required to start a given level.
 * Formula: 100 * N*(N-1)/2 — mirrors groom XP formula.
 */
export function riderXpToStartLevel(level: number): number {
  return (100 * level * (level - 1)) / 2;
}

/**
 * Calculate XP progress within the current level.
 */
export function calculateRiderXPProgress(experience: number): RiderXPProgress {
  const { LEVEL_CAP } = RIDER_CAREER_CONSTANTS;

  let level = 1;
  for (let l = 1; l <= LEVEL_CAP; l++) {
    if (experience >= riderXpToStartLevel(l)) {
      level = l;
    } else {
      break;
    }
  }

  const isMaxLevel = level >= LEVEL_CAP;
  const totalXPForCurrentLevel = riderXpToStartLevel(level);
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

  const xpToNextLevel = 100 * level;
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
 * Calculate retirement status for a rider.
 * Mandatory at 104 weeks. Legacy contract eligible if prestige ≥ 80 or wins ≥ 50.
 */
export function calculateRiderRetirementStatus(
  careerWeeks: number,
  level: number,
  totalWins: number,
  prestige: number
): RiderRetirementStatus {
  const {
    MANDATORY_RETIREMENT_WEEKS,
    RETIREMENT_NOTICE_WEEKS,
    LEGACY_CONTRACT_PRESTIGE_THRESHOLD,
    LEGACY_CONTRACT_WINS_THRESHOLD,
  } = RIDER_CAREER_CONSTANTS;

  const weeksRemaining = Math.max(0, MANDATORY_RETIREMENT_WEEKS - careerWeeks);
  const isApproachingRetirement = weeksRemaining <= RETIREMENT_NOTICE_WEEKS && weeksRemaining > 0;
  const isRetiredByWeeks = careerWeeks >= MANDATORY_RETIREMENT_WEEKS;

  const legacyContractEligible =
    prestige >= LEGACY_CONTRACT_PRESTIGE_THRESHOLD || totalWins >= LEGACY_CONTRACT_WINS_THRESHOLD;

  const warningReasons: RiderRetirementWarningReason[] = [];
  if (isApproachingRetirement || isRetiredByWeeks) {
    warningReasons.push('approaching_mandatory');
  }
  if (level >= 10) {
    warningReasons.push('level_cap');
  }

  let retirementReason: RiderRetirementWarningReason | undefined;
  if (isApproachingRetirement || isRetiredByWeeks) {
    retirementReason = 'approaching_mandatory';
  } else if (level >= 10) {
    retirementReason = 'level_cap';
  }

  return {
    isRetired: isRetiredByWeeks,
    weeksRemaining,
    isApproachingRetirement,
    legacyContractEligible,
    retirementReason,
    warningReasons,
  };
}

/**
 * Build career milestone list from rider data.
 */
export function buildRiderCareerMilestones(
  level: number,
  careerWeeks: number,
  totalWins: number
): RiderCareerMilestone[] {
  return [
    {
      id: 'hired',
      label: 'Career Started',
      description: 'Rider joined the stable',
      reached: true,
    },
    {
      id: 'first_win',
      label: 'First Win',
      description: 'Won their first competition',
      reached: totalWins >= 1,
    },
    {
      id: 'level_5',
      label: 'Seasoned Rider (Level 5)',
      description: 'Reached level 5 through competition experience',
      reached: level >= 5,
    },
    {
      id: 'ten_wins',
      label: '10 Wins',
      description: 'Accumulated 10 competition victories',
      reached: totalWins >= 10,
    },
    {
      id: 'level_10',
      label: 'Elite Rider (Level 10)',
      description: 'Achieved maximum skill level',
      reached: level >= 10,
    },
    {
      id: 'one_year',
      label: 'One Year',
      description: 'Served for 52+ career weeks',
      reached: careerWeeks >= 52,
    },
    {
      id: 'fifty_wins',
      label: 'Legendary (50 Wins)',
      description: 'Achieved legendary status with 50+ victories',
      reached: totalWins >= 50,
    },
  ];
}

/** Retirement reason display labels */
export const RIDER_RETIREMENT_REASON_LABELS: Record<string, string> = {
  mandatory_career_limit: 'Mandatory retirement (2-year career limit)',
  early_level_cap: 'Early retirement (Elite level achieved)',
  voluntary: 'Voluntary retirement',
  legacy_contract: 'Received Legacy Contract extension',
};
