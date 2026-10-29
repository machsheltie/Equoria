// DO NOT MODIFY: Configuration locked for consistency
/**
 * Groom System Configuration
 * Centralized configuration for groom bonding and care-streak mechanics
 *
 * 🎯 FEATURES IMPLEMENTED:
 * - Age-based task eligibility with progressive complexity (0-2, 1-3, 3+ years)
 * - Foal enrichment tasks (0-2 years) for epigenetic trait development
 * - Foal grooming tasks (1-3 years) for visual prep and bonding
 * - Adult grooming tasks (3+ years)
 * - Task logging system for frequency tracking and trait evaluation
 * - Streak tracking with grace period logic for consecutive care bonuses
 * - Bonding mechanics configuration (bond score limits, daily gains)
 * - Environment variable overrides for key settings
 *
 * 🔧 DEPENDENCIES:
 * - process.env for configuration overrides
 *
 * 📋 BUSINESS RULES:
 * - Age 0-2 years: Enrichment tasks only (epigenetic trait development)
 * - Age 1-3 years: Both enrichment AND grooming tasks (overlap phase)
 * - Age 3+ years: All tasks (enrichment + foal grooming + standard grooming)
 * - Mutual exclusivity: One enrichment OR one grooming task per day
 * - Task logging: JSON format tracking frequency for trait evaluation
 * - Streak tracking: 2-day grace period, +10% bonus for 7 consecutive days
 * - Bond scores: 0-100, start at 0, +5 per daily "groom horse" (owner ruling 2026-10-26, q87)
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Environment variables
 * - Real: Configuration values, age calculations, task eligibility logic
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

  // Age restrictions and thresholds
  MIN_AGE_FOR_GROOMING_TASKS: 0, // Allow grooms to work with foals from birth
  FOAL_ENRICHMENT_MAX_AGE: 2, // 0-2 years for enrichment tasks
  FOAL_GROOMING_MIN_AGE: 1, // 1-3 years for foal grooming tasks
  FOAL_GROOMING_MAX_AGE: 3, // 1-3 years for foal grooming tasks
  GENERAL_GROOMING_MIN_AGE: 3, // 3+ years for general grooming tasks

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

  // General grooming tasks (used for horses 3+)
  ELIGIBLE_GENERAL_GROOMING_TASKS: [
    'brushing',
    'handWalking',
    'stallCare',
    'bathing',
    'maneTailTrim',
  ],

  // Task logging and streak tracking
  FOAL_STREAK_BONUS_THRESHOLD: 7, // 7 consecutive days for +10% bonus
  // Days a care streak (Horse.daysGroomedInARow) survives without grooming
  // before it resets (Equoria-0gl9o: formerly also BURNOUT_RESET_GRACE_DAYS).
  FOAL_STREAK_GRACE_DAYS: careStreakGraceDays,

  // Task type categories for mutual exclusivity checking
  TASK_CATEGORIES: {
    ENRICHMENT: 'enrichment',
    GROOMING: 'grooming',
  },
};

// Named exports for foal task categories
export const { ELIGIBLE_FOAL_ENRICHMENT_TASKS } = GROOM_CONFIG;
export const FOAL_GROOMING_TASKS = GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS;

export default GROOM_CONFIG;
