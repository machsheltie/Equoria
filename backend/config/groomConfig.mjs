// DO NOT MODIFY: Configuration locked for consistency
/**
 * Groom System Configuration
 * Centralized configuration for groom bonding and care-streak mechanics
 *
 * 🎯 FEATURES IMPLEMENTED:
 * - Foal task categories (enrichment, foal grooming) for the one-task-per-day rule
 * - Care-streak grace period
 * - Bonding mechanics configuration (bond score limits, daily gains)
 *
 * 📋 BUSINESS RULES:
 * - Mutual exclusivity: One enrichment OR one grooming task per day
 * - Streak tracking: 2-day grace period
 * - Bond scores: 0-100, start at 0, +5 per daily "groom horse" (owner ruling 2026-10-26, q87)
 *
 * Equoria-czpa5: the age-eligibility thresholds, general grooming task list and
 * streak bonus threshold were read only by the deleted utils/groomBondingSystem.mjs
 * and went with it.
 *
 * 🧪 TESTING APPROACH:
 * - Real: Configuration values and task categories
 */

/**
 * Maximum grooms a single user may hold on their roster. SINGLE source of truth
 * (Equoria-hduc5): enforced on the groom-creating hire path — marketplace hire
 * (groomMarketplaceController.hireFromMarketplace) — via a pre-tx fast-path
 * count PLUS an authoritative post-lock in-tx re-count (Equoria-n4m5j / hduc5).
 * The direct hire it once shared with was retired by Equoria-bvddn.7.
 */
export const maxGroomsPerUser = 10;
export const MAX_GROOMS_PER_USER = maxGroomsPerUser;

// camelCase spellings for new consumers (Equoria-pjvp8 ratchet); GROOM_CONFIG
// below carries the same values.
export const bondScoreMax = 100;
// Owner ruling 2026-10-26 (q87): each daily groom adds +5, about 100 by day 21.
export const dailyBondGain = 5;
// Days a care streak (Horse.daysGroomedInARow) survives without grooming.
export const careStreakGraceDays = 2;

export const GROOM_CONFIG = {
  // Bonding mechanics
  BOND_SCORE_START: 0,
  BOND_SCORE_MAX: bondScoreMax,
  DAILY_BOND_GAIN: dailyBondGain,

  // Tasks used for foal bonding, epigenetics, and enrichment (ages 0-2)
  ELIGIBLE_FOAL_ENRICHMENT_TASKS: [
    'desensitization',
    'trustBuilding',
    'showgroundExposure',
    'earlyTouch',
    'gentleTouch',
    'feedingAssistance',
    'environmentExploration',
  ],

  // Tasks used for grooming behavior and presentation prep (ages 1-3)
  ELIGIBLE_FOAL_GROOMING_TASKS: [
    'hoofHandling',
    'tyingPractice',
    'spongeBath',
    'coatCheck',
    'maneTailGrooming',
  ],

  // Streak tracking
  // Days a care streak (Horse.daysGroomedInARow) survives without grooming
  // before it resets (Equoria-0gl9o: formerly also BURNOUT_RESET_GRACE_DAYS).
  FOAL_STREAK_GRACE_DAYS: careStreakGraceDays,
};

// Named exports for foal task categories
export const { ELIGIBLE_FOAL_ENRICHMENT_TASKS } = GROOM_CONFIG;
export const FOAL_GROOMING_TASKS = GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS;

export default GROOM_CONFIG;
