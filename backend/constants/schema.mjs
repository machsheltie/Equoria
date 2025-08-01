/**
 * Schema Constants
 *
 * Centralized constants for database schema validation and business logic.
 * These constants ensure consistency across models, controllers, routes, and tests.
 *
 * 🎯 PURPOSE:
 * - Centralize all schema-related constants
 * - Ensure consistency across the application
 * - Provide single source of truth for validation
 * - Reduce magic strings and hardcoded values
 *
 * 📋 CATEGORIES:
 * - Horse attributes (sex, temperament, health status)
 * - Competition disciplines and placements
 * - Groom specialties and skill levels
 * - Training and breeding constants
 * - User progression and game mechanics
 */

/**
 * Horse sex/gender constants
 */
export const HORSE_SEX = {
  STALLION: 'Stallion',
  MARE: 'Mare',
  GELDING: 'Gelding',
  COLT: 'Colt',
  FILLY: 'Filly',
  RIG: 'Rig',
  SPAYED_MARE: 'Spayed Mare',
};

export const HORSE_SEX_VALUES = Object.values(HORSE_SEX);

/**
 * Horse temperament constants
 */
export const HORSE_TEMPERAMENT = {
  CALM: 'Calm',
  SPIRITED: 'Spirited',
  NERVOUS: 'Nervous',
  AGGRESSIVE: 'Aggressive',
  DOCILE: 'Docile',
  UNPREDICTABLE: 'Unpredictable',
};

export const HORSE_TEMPERAMENT_VALUES = Object.values(HORSE_TEMPERAMENT);

/**
 * Horse health status constants
 */
export const HORSE_HEALTH_STATUS = {
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
  INJURED: 'Injured',
};

export const HORSE_HEALTH_STATUS_VALUES = Object.values(HORSE_HEALTH_STATUS);

/**
 * Competition disciplines
 */
export const DISCIPLINES = {
  RACING: 'Racing',
  SHOW_JUMPING: 'Show Jumping',
  DRESSAGE: 'Dressage',
  CROSS_COUNTRY: 'Cross Country',
  WESTERN_PLEASURE: 'Western Pleasure',
  REINING: 'Reining',
  CUTTING: 'Cutting',
  BARREL_RACING: 'Barrel Racing',
  ROPING: 'Roping',
  TEAM_PENNING: 'Team Penning',
  RODEO: 'Rodeo',
  HUNTER: 'Hunter',
  SADDLESEAT: 'Saddleseat',
  ENDURANCE: 'Endurance',
  EVENTING: 'Eventing',
  VAULTING: 'Vaulting',
  POLO: 'Polo',
  COMBINED_DRIVING: 'Combined Driving',
  FINE_HARNESS: 'Fine Harness',
  GAITED: 'Gaited',
  GYMKHANA: 'Gymkhana',
  STEEPLECHASE: 'Steeplechase',
  HARNESS_RACING: 'Harness Racing',
};

/**
 * Conformation show classes (separate from performance disciplines)
 * These are not added to DISCIPLINES as they're a separate competition system
 */
export const CONFORMATION_CLASSES = {
  FOALS_YOUNGSTOCK: 'Foals/Youngstock',
  MARES: 'Mares',
  STALLIONS: 'Stallions',
  GELDINGS: 'Geldings',
  VETERANS: 'Veterans',
  OPEN_ALL_BREED: 'Open All-Breed',
  BREED_SPECIFIC: 'Breed-Specific',
};

export const DISCIPLINE_VALUES = Object.values(DISCIPLINES);
export const CONFORMATION_CLASS_VALUES = Object.values(CONFORMATION_CLASSES);

/**
 * Competition placements
 */
export const COMPETITION_PLACEMENTS = {
  FIRST: '1st',
  SECOND: '2nd',
  THIRD: '3rd',
};

export const COMPETITION_PLACEMENT_VALUES = Object.values(COMPETITION_PLACEMENTS);

/**
 * Groom specialties
 */
export const GROOM_SPECIALTIES = {
  FOAL_CARE: 'foal_care',
  GENERAL: 'general',
  TRAINING: 'training',
  MEDICAL: 'medical',
};

export const GROOM_SPECIALTY_VALUES = Object.values(GROOM_SPECIALTIES);

/**
 * Groom skill levels
 */
export const GROOM_SKILL_LEVELS = {
  NOVICE: 'novice',
  INTERMEDIATE: 'intermediate',
  EXPERT: 'expert',
  MASTER: 'master',
};

export const GROOM_SKILL_LEVEL_VALUES = Object.values(GROOM_SKILL_LEVELS);

/**
 * Groom personalities
 */
export const GROOM_PERSONALITIES = {
  GENTLE: 'gentle',
  ENERGETIC: 'energetic',
  PATIENT: 'patient',
  STRICT: 'strict',
};

export const GROOM_PERSONALITY_VALUES = Object.values(GROOM_PERSONALITIES);

/**
 * Groom interaction types
 */
export const GROOM_INTERACTION_TYPES = {
  DAILY_CARE: 'daily_care',
  FEEDING: 'feeding',
  GROOMING: 'grooming',
  EXERCISE: 'exercise',
  MEDICAL_CHECK: 'medical_check',
};

export const GROOM_INTERACTION_TYPE_VALUES = Object.values(GROOM_INTERACTION_TYPES);

/**
 * Horse stats/attributes
 */
export const HORSE_STATS = {
  SPEED: 'speed',
  AGILITY: 'agility',
  ENDURANCE: 'endurance',
  STRENGTH: 'strength',
  PRECISION: 'precision',
  BALANCE: 'balance',
  COORDINATION: 'coordination',
  INTELLIGENCE: 'intelligence',
  FOCUS: 'focus',
  OBEDIENCE: 'obedience',
  BOLDNESS: 'boldness',
  FLEXIBILITY: 'flexibility',
};

export const HORSE_STAT_VALUES = Object.values(HORSE_STATS);

/**
 * Training age limits
 */
export const TRAINING_LIMITS = {
  MIN_AGE: 3,
  MAX_AGE: 20,
  COOLDOWN_DAYS: 7,
};

/**
 * Competition age limits
 */
export const COMPETITION_LIMITS = {
  MIN_AGE: 3,
  MAX_AGE: 20,
};

/**
 * Breeding age limits
 */
export const BREEDING_LIMITS = {
  MIN_STALLION_AGE: 3,
  MIN_MARE_AGE: 3,
  MAX_STALLION_AGE: 25,
  MAX_MARE_AGE: 20,
};

/**
 * Foal trait discovery age limits
 */
export const FOAL_LIMITS = {
  MAX_TRAIT_DISCOVERY_AGE: 3, // Foals can discover traits until age 3
  ADULT_AGE: 3, // Horses are considered adults at age 3
};

/**
 * User progression constants
 */
export const USER_PROGRESSION = {
  MIN_LEVEL: 1,
  MIN_XP: 0,
  MIN_MONEY: 0,
  LEVEL_XP_BASE: 100, // Base XP required for level 2
  LEVEL_XP_MULTIPLIER: 1.5, // Multiplier for each subsequent level
};

/**
 * Score ranges
 */
export const SCORE_RANGES = {
  MIN_SCORE: 0,
  MAX_SCORE: 1000,
  MIN_DISCIPLINE_SCORE: 0,
  MAX_DISCIPLINE_SCORE: 100,
};

/**
 * Validation helper functions
 */
export const isValidHorseSex = (sex) => HORSE_SEX_VALUES.includes(sex);
export const isValidTemperament = (temperament) => HORSE_TEMPERAMENT_VALUES.includes(temperament);
export const isValidHealthStatus = (status) => HORSE_HEALTH_STATUS_VALUES.includes(status);
export const isValidDiscipline = (discipline) => DISCIPLINE_VALUES.includes(discipline);
export const isValidPlacement = (placement) => COMPETITION_PLACEMENT_VALUES.includes(placement);
export const isValidGroomSpecialty = (specialty) => GROOM_SPECIALTY_VALUES.includes(specialty);
export const isValidGroomSkillLevel = (level) => GROOM_SKILL_LEVEL_VALUES.includes(level);
export const isValidGroomPersonality = (personality) => GROOM_PERSONALITY_VALUES.includes(personality);
export const isValidInteractionType = (type) => GROOM_INTERACTION_TYPE_VALUES.includes(type);
export const isValidHorseStat = (stat) => HORSE_STAT_VALUES.includes(stat);

/**
 * Age validation helpers
 */
export const isTrainingAge = (age) => age >= TRAINING_LIMITS.MIN_AGE && age <= TRAINING_LIMITS.MAX_AGE;
export const isCompetitionAge = (age) => age >= COMPETITION_LIMITS.MIN_AGE && age <= COMPETITION_LIMITS.MAX_AGE;
export const isBreedingAge = (age, sex) => {
  if (sex === HORSE_SEX.STALLION) {
    return age >= BREEDING_LIMITS.MIN_STALLION_AGE && age <= BREEDING_LIMITS.MAX_STALLION_AGE;
  }
  if (sex === HORSE_SEX.MARE) {
    return age >= BREEDING_LIMITS.MIN_MARE_AGE && age <= BREEDING_LIMITS.MAX_MARE_AGE;
  }
  return false;
};
export const isFoalAge = (age) => age < FOAL_LIMITS.MAX_TRAIT_DISCOVERY_AGE;
export const isAdultAge = (age) => age >= FOAL_LIMITS.ADULT_AGE;

/**
 * Score validation helpers
 */
export const isValidScore = (score) => score >= SCORE_RANGES.MIN_SCORE && score <= SCORE_RANGES.MAX_SCORE;
export const isValidDisciplineScore = (score) => score >= SCORE_RANGES.MIN_DISCIPLINE_SCORE && score <= SCORE_RANGES.MAX_DISCIPLINE_SCORE;

/**
 * User progression helpers
 */
export const calculateXpForLevel = (level) => {
  if (level <= 1) { return 0; }
  return Math.floor(USER_PROGRESSION.LEVEL_XP_BASE * Math.pow(USER_PROGRESSION.LEVEL_XP_MULTIPLIER, level - 2));
};

export const calculateLevelFromXp = (xp) => {
  if (xp < 0) { return 1; }

  let level = 1;
  let totalXpSpent = 0;

  // Keep advancing levels while we have enough XP
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const xpNeededForNextLevel = calculateXpForLevel(level + 1);
    if (totalXpSpent + xpNeededForNextLevel > xp) {
      break;
    }
    totalXpSpent += xpNeededForNextLevel;
    level++;
  }

  return level;
};

export default {
  HORSE_SEX,
  HORSE_SEX_VALUES,
  HORSE_TEMPERAMENT,
  HORSE_TEMPERAMENT_VALUES,
  HORSE_HEALTH_STATUS,
  HORSE_HEALTH_STATUS_VALUES,
  DISCIPLINES,
  DISCIPLINE_VALUES,
  COMPETITION_PLACEMENTS,
  COMPETITION_PLACEMENT_VALUES,
  GROOM_SPECIALTIES,
  GROOM_SPECIALTY_VALUES,
  GROOM_SKILL_LEVELS,
  GROOM_SKILL_LEVEL_VALUES,
  GROOM_PERSONALITIES,
  GROOM_PERSONALITY_VALUES,
  GROOM_INTERACTION_TYPES,
  GROOM_INTERACTION_TYPE_VALUES,
  HORSE_STATS,
  HORSE_STAT_VALUES,
  TRAINING_LIMITS,
  COMPETITION_LIMITS,
  BREEDING_LIMITS,
  FOAL_LIMITS,
  USER_PROGRESSION,
  SCORE_RANGES,
  isValidHorseSex,
  isValidTemperament,
  isValidHealthStatus,
  isValidDiscipline,
  isValidPlacement,
  isValidGroomSpecialty,
  isValidGroomSkillLevel,
  isValidGroomPersonality,
  isValidInteractionType,
  isValidHorseStat,
  isTrainingAge,
  isCompetitionAge,
  isBreedingAge,
  isFoalAge,
  isAdultAge,
  isValidScore,
  isValidDisciplineScore,
  calculateXpForLevel,
  calculateLevelFromXp,
};
