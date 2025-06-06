// DO NOT MODIFY: Configuration locked for consistency
/**
 * Groom System Configuration
 * Centralized configuration for groom bonding and burnout prevention mechanics
 *
 * 🎯 FEATURES IMPLEMENTED:
 * - Age-based task eligibility with progressive complexity (0-2, 1-3, 3+ years)
 * - Foal enrichment tasks (0-2 years) for epigenetic trait development
 * - Foal grooming tasks (1-3 years) for visual prep and bonding
 * - Adult grooming tasks (3+ years) for burnout prevention
 * - Task logging system for frequency tracking and trait evaluation
 * - Streak tracking with grace period logic for consecutive care bonuses
 * - Bonding mechanics configuration (bond score limits, daily gains)
 * - Burnout immunity system (consecutive day tracking, immunity thresholds)
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
 * - Bond scores: 0-100 range with +2 daily gain cap
 * - Burnout immunity: 7 consecutive days, 2-day grace period
 *
 * 🧪 TESTING APPROACH:
 * - Mock: Environment variables
 * - Real: Configuration values, age calculations, task eligibility logic
 */

export const GROOM_CONFIG = {
  // Bonding mechanics
  BOND_SCORE_START: 0,
  BOND_SCORE_MAX: 100,
  DAILY_BOND_GAIN: 2,

  // Burnout immunity system
  BURNOUT_IMMUNITY_THRESHOLD_DAYS: 7,
  BURNOUT_RESET_GRACE_DAYS: 2,

  // Age restrictions and thresholds
  MIN_AGE_FOR_GROOMING_TASKS: 0, // Allow grooms to work with foals from birth
  FOAL_ENRICHMENT_MAX_AGE: 2, // 0-2 years for enrichment tasks
  FOAL_GROOMING_MIN_AGE: 1, // 1-3 years for foal grooming tasks
  FOAL_GROOMING_MAX_AGE: 3, // 1-3 years for foal grooming tasks
  GENERAL_GROOMING_MIN_AGE: 3, // 3+ years for general grooming tasks

  // Tasks used for foal bonding, epigenetics, and enrichment (ages 0-2)
  ELIGIBLE_FOAL_ENRICHMENT_TASKS: [
    'desensitization',
    'trust_building',
    'showground_exposure',
    'early_touch',
    'gentle_touch',
    'feeding_assistance',
    'environment_exploration',
  ],

  // Tasks used for grooming behavior and presentation prep (ages 1-3)
  ELIGIBLE_FOAL_GROOMING_TASKS: [
    'hoof_handling',
    'tying_practice',
    'sponge_bath',
    'coat_check',
    'mane_tail_grooming',
  ],

  // General grooming tasks (used for horses 3+)
  ELIGIBLE_GENERAL_GROOMING_TASKS: [
    'brushing',
    'hand-walking',
    'stall_care',
    'bathing',
    'mane_tail_trim',
  ],

  // Task logging and streak tracking
  FOAL_STREAK_BONUS_THRESHOLD: 7, // 7 consecutive days for +10% bonus
  FOAL_STREAK_GRACE_DAYS: 2, // Same as burnout system for consistency

  // Task type categories for mutual exclusivity checking
  TASK_CATEGORIES: {
    ENRICHMENT: 'enrichment',
    GROOMING: 'grooming',
  },

  // Burnout status values
  BURNOUT_STATUS: {
    NONE: 'none',
    AT_RISK: 'atRisk',
    IMMUNE: 'immune',
  },
};

// Environment variable overrides
if (process.env.BURNOUT_IMMUNITY_THRESHOLD_DAYS) {
  GROOM_CONFIG.BURNOUT_IMMUNITY_THRESHOLD_DAYS = parseInt(
    process.env.BURNOUT_IMMUNITY_THRESHOLD_DAYS,
    10,
  );
}

if (process.env.DAILY_BOND_GAIN) {
  GROOM_CONFIG.DAILY_BOND_GAIN = parseInt(process.env.DAILY_BOND_GAIN, 10);
}

// Named exports for foal task categories
export const ELIGIBLE_FOAL_ENRICHMENT_TASKS = GROOM_CONFIG.ELIGIBLE_FOAL_ENRICHMENT_TASKS;
export const FOAL_GROOMING_TASKS = GROOM_CONFIG.ELIGIBLE_FOAL_GROOMING_TASKS;

export default GROOM_CONFIG;
