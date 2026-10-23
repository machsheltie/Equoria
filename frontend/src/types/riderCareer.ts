/**
 * Rider Career Lifecycle Types (Epic 9C — Story 9C-4)
 *
 * Defines career data and retirement status calculations for the Rider
 * System. Mirrors groomCareer.ts pattern.
 *
 * Owner ruling 2026-10-21 (Equoria-dea06): riders are fixed NPCs. They earn no
 * XP and keep the level they were generated with, so the XP-to-level progress
 * helpers that used to live here were removed.
 *
 * Rider careers end at a hidden, random retirement age (owner ruling
 * 2026-10-23, Equoria-or2ua). The client never knows or computes it: no screen
 * counts down, warns or states when a rider retires. The one notice players get
 * is a notification from the game a week before it happens.
 * Legacy riders (high wins/prestige) may earn special contract extensions.
 */

export interface RiderCareerData {
  id: number;
  name: string;
  experience: number; // generated at hire; never earned (Equoria-dea06)
  level: number; // 1–10, generated at hire and fixed (Equoria-dea06)
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

export interface RiderCareerMilestone {
  id: string;
  label: string;
  description: string;
  reached: boolean;
}

/** Career constants for riders */
export const RIDER_CAREER_CONSTANTS = {
  LEVEL_CAP: 10,
  LEGACY_CONTRACT_PRESTIGE_THRESHOLD: 80,
  LEGACY_CONTRACT_WINS_THRESHOLD: 50,
  // Display mirror of the CANONICAL backend roster cap
  // (backend/modules/riders/config/riderConfig.mjs →
  // RIDER_ROSTER_CAP_BY_STABLE_LEVEL, Equoria-oey96.8). The backend enforces
  // this cap at hire time (fast-path + in-tx re-count of non-retired riders);
  // this constant is for UI display only. Keep the two in lockstep — the
  // backend config is the source of truth if they ever diverge.
  SLOT_CAP_BY_STABLE_LEVEL: {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6,
  } as Record<number, number>,
} as const;

/**
 * Legacy contract eligibility: prestige >= 80 or wins >= 50. This says nothing
 * about when a rider retires (that is hidden, Equoria-or2ua).
 */
export function isRiderLegacyContractEligible(totalWins: number, prestige: number): boolean {
  const { LEGACY_CONTRACT_PRESTIGE_THRESHOLD, LEGACY_CONTRACT_WINS_THRESHOLD } =
    RIDER_CAREER_CONSTANTS;
  return (
    prestige >= LEGACY_CONTRACT_PRESTIGE_THRESHOLD || totalWins >= LEGACY_CONTRACT_WINS_THRESHOLD
  );
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
      description: 'A rider of level 5 or above',
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
