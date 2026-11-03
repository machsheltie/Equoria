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

import { maxActiveAgeYears, minActiveAgeYears } from './horseAgePolicy.mjs';

/**
 * Horse sex/gender constants. The canonical Title Case form is enforced at
 * the Prisma client layer via the $extends interceptor in
 * packages/database/prismaClient.mjs (Equoria-duz2). Keep these values in
 * sync with CANONICAL_HORSE_SEX_VALUES in
 * packages/database/horseSexCanonical.mjs.
 */
export const horseSex = {
  STALLION: 'Stallion',
  MARE: 'Mare',
  COLT: 'Colt',
  FILLY: 'Filly',
};

export const horseSexValues = Object.values(horseSex);

// Re-export the canonicalizer so callers reaching for sex utilities have
// one obvious place to find them.
export {
  canonicalizeHorseSex,
  canonicalizeHorseSexOrNull,
} from '../../packages/database/horseSexCanonical.mjs';

/**
 * Horse temperament constants
 */
// The owner's 12 temperaments, in the column order of her competition matrix
// (EquoriaBible/RelevantFiles/Equoria_Temperament_Competition_Matrix.xlsx;
// Equoria-576c0 B6). The one list: modules/competition/rules/disciplineRules.mjs
// takes TEMPERAMENTS from here (the competition barrel already imports this
// file, so the reverse import would be a cycle). Was six values including
// 'Docile' and 'Unpredictable', which are not temperaments. Owner ruling
// 2026-10-21: Playful was renamed Driven and Willing was added (was 11).
export const horseTemperament = Object.freeze({
  SPIRITED: 'Spirited',
  NERVOUS: 'Nervous',
  CALM: 'Calm',
  BOLD: 'Bold',
  STEADY: 'Steady',
  WILLING: 'Willing',
  INDEPENDENT: 'Independent',
  REACTIVE: 'Reactive',
  STUBBORN: 'Stubborn',
  DRIVEN: 'Driven',
  LAZY: 'Lazy',
  AGGRESSIVE: 'Aggressive',
});

/** The 12 temperaments as a list. */
export const horseTemperamentValues = Object.freeze(Object.values(horseTemperament));

/**
 * Horse health words (owner ruling 2026-10-23, Equoria-u0jop): exactly
 * Excellent, Very Good, Good, Fair, Bad. Stored Poor / Critical read as Bad
 * through utils/horseHealth.mjs toHealthWord. Old contract: Excellent, Good,
 * Fair, Poor, Injured.
 */
export const horseHealthStatus = {
  excellent: 'Excellent',
  veryGood: 'Very Good',
  good: 'Good',
  fair: 'Fair',
  bad: 'Bad',
};

export const horseHealthStatusValues = Object.values(horseHealthStatus);

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
  PLEASURE_DRIVING: 'Pleasure Driving',
};

/**
 * Conformation show classes (separate from performance disciplines)
 * These are not added to DISCIPLINES as they're a separate competition system
 */
export const conformationClasses = {
  foalsYoungstock: 'Foals/Youngstock',
  MARES: 'Mares',
  STALLIONS: 'Stallions',
  VETERANS: 'Veterans',
  openAllBreed: 'Open All-Breed',
  breedSpecific: 'Breed-Specific',
};

/** Every competition discipline. */
export const disciplineValues = Object.values(DISCIPLINES);
export const conformationClassValues = Object.values(conformationClasses);

/**
 * Competition placements
 */
export const competitionPlacements = {
  FIRST: '1st',
  SECOND: '2nd',
  THIRD: '3rd',
};

export const competitionPlacementValues = Object.values(competitionPlacements);

/**
 * Groom specialties
 */
export const groomSpecialties = {
  foalCare: 'foalCare',
  GENERAL: 'general',
  TRAINING: 'training',
  MEDICAL: 'medical',
};

export const groomSpecialtyValues = Object.values(groomSpecialties);

/**
 * Groom skill levels
 */
export const groomSkillLevels = {
  NOVICE: 'novice',
  INTERMEDIATE: 'intermediate',
  EXPERT: 'expert',
  MASTER: 'master',
};

export const groomSkillLevelValues = Object.values(groomSkillLevels);

/**
 * Groom personalities
 */
export const groomPersonalities = {
  GENTLE: 'gentle',
  ENERGETIC: 'energetic',
  PATIENT: 'patient',
  STRICT: 'strict',
  CONFIDENT: 'confident',
  CALM: 'calm',
};

export const groomPersonalityValues = Object.values(groomPersonalities);

/**
 * Groom interaction types
 */
export const groomInteractionTypes = {
  dailyCare: 'dailyCare',
  FEEDING: 'feeding',
  GROOMING: 'grooming',
  EXERCISE: 'exercise',
  medicalCheck: 'medicalCheck',
};

export const groomInteractionTypeValues = Object.values(groomInteractionTypes);

/**
 * Horse stats/attributes
 */
export const horseStats = {
  SPEED: 'speed',
  STAMINA: 'stamina',
  AGILITY: 'agility',
  ENDURANCE: 'endurance',
  STRENGTH: 'strength',
  PRECISION: 'precision',
  BALANCE: 'balance',
  INTELLIGENCE: 'intelligence',
  FOCUS: 'focus',
  OBEDIENCE: 'obedience',
  BOLDNESS: 'boldness',
  FLEXIBILITY: 'flexibility',
};

export const horseStatValues = Object.values(horseStats);

/**
 * Training age limits
 */
export const trainingLimits = {
  minAge: minActiveAgeYears,
  maxAge: maxActiveAgeYears,
  cooldownDays: 7,
};

/**
 * Competition age limits
 */
export const competitionLimits = {
  minAge: minActiveAgeYears,
  maxAge: maxActiveAgeYears,
};

/**
 * Breeding age limits
 */
export const breedingLimits = {
  minStallionAge: minActiveAgeYears,
  minMareAge: minActiveAgeYears,
  maxStallionAge: maxActiveAgeYears,
  maxMareAge: maxActiveAgeYears,
};

/**
 * Stud listing states — the values of Horse.studStatus (Equoria-e7tgc.2).
 * Owner rulings (Stacey, 2026-10-02 / 2026-10-15): the stallion's owner
 * chooses whether he stands at stud and whether at Public Stud (bookings go
 * through automatically) or Private Stud (requests wait for approval).
 * 'Not at Stud' is the column default (schema.prisma Horse.studStatus).
 */
export const studStatuses = Object.freeze({
  none: 'Not at Stud',
  public: 'At Public Stud',
  private: 'At Private Stud',
});

/** The studStatus values that mean "standing at stud" (either mode). */
export const listedStudStatuses = Object.freeze([studStatuses.public, studStatuses.private]);

/**
 * Foal trait discovery age limits
 */
export const foalLimits = {
  maxTraitDiscoveryAge: 3, // Foals can discover traits until age 3
  adultAge: 3, // Horses are considered adults at age 3
};

/**
 * User progression constants
 */
export const userProgression = {
  minLevel: 1,
  minXp: 0,
  minMoney: 0,
  // NOTE (Equoria-dmrw3): the former LEVEL_XP_BASE (100) / LEVEL_XP_MULTIPLIER (1.5)
  // exponential-curve constants were removed alongside the dead calculateXpForLevel /
  // calculateLevelFromXp helpers below. They disagreed with the canonical LINEAR
  // cumulative curve (100*level) that the live progression path uses
  // (userModel.getUserProgress / addXpToUser, progressionController). Having a second
  // curve here invited drift; the dead implementation has been deleted, not repointed.
};

/**
 * Score ranges
 */
export const scoreRanges = {
  minScore: 0,
  maxScore: 1000,
  minDisciplineScore: 0,
  maxDisciplineScore: 100,
};

/**
 * Validation helper functions
 */
export const isValidHorseSex = sex => horseSexValues.includes(sex);
export const isValidTemperament = temperament => horseTemperamentValues.includes(temperament);
export const isValidHealthStatus = status => horseHealthStatusValues.includes(status);
export const isValidDiscipline = discipline => disciplineValues.includes(discipline);
export const isValidPlacement = placement => competitionPlacementValues.includes(placement);
export const isValidGroomSpecialty = specialty => groomSpecialtyValues.includes(specialty);
export const isValidGroomSkillLevel = level => groomSkillLevelValues.includes(level);
export const isValidGroomPersonality = personality => groomPersonalityValues.includes(personality);
export const isValidInteractionType = type => groomInteractionTypeValues.includes(type);
export const isValidHorseStat = stat => horseStatValues.includes(stat);

/**
 * Age validation helpers
 */
export const isTrainingAge = age => age >= trainingLimits.minAge && age <= trainingLimits.maxAge;
export const isCompetitionAge = age =>
  age >= competitionLimits.minAge && age <= competitionLimits.maxAge;
export const isBreedingAge = (age, sex) => {
  if (sex === horseSex.STALLION) {
    return age >= breedingLimits.minStallionAge && age <= breedingLimits.maxStallionAge;
  }
  if (sex === horseSex.MARE) {
    return age >= breedingLimits.minMareAge && age <= breedingLimits.maxMareAge;
  }
  return false;
};
export const isFoalAge = age => age < foalLimits.maxTraitDiscoveryAge;
export const isAdultAge = age => age >= foalLimits.adultAge;

/**
 * Score validation helpers
 */
export const isValidScore = score => score >= scoreRanges.minScore && score <= scoreRanges.maxScore;
export const isValidDisciplineScore = score =>
  score >= scoreRanges.minDisciplineScore && score <= scoreRanges.maxDisciplineScore;

/**
 * User progression helpers — REMOVED (Equoria-dmrw3)
 *
 * The exponential XP curve helpers (calculateXpForLevel / calculateLevelFromXp,
 * LEVEL_XP_BASE * 1.5^(level-2)) that previously lived here were dead code: they
 * were imported by no production module — only by tests/constants/schema.test.mjs.
 * They also DISAGREED with the canonical linear cumulative curve (100*level) that
 * the live leveling path uses (backend/models/userModel.mjs getUserProgress /
 * addXpToUser, and backend/modules/users/controllers/progressionController.mjs).
 *
 * They have been DELETED rather than repointed to the linear curve, because
 * repointing would have preserved a second, independently-maintained
 * implementation of the same curve and re-introduced exactly the drift risk this
 * issue was filed to eliminate. The canonical curve lives in one place.
 */

export default {
  horseSex,
  horseSexValues,
  horseTemperament,
  horseTemperamentValues,
  horseHealthStatus,
  horseHealthStatusValues,
  DISCIPLINES,
  disciplineValues,
  competitionPlacements,
  competitionPlacementValues,
  groomSpecialties,
  groomSpecialtyValues,
  groomSkillLevels,
  groomSkillLevelValues,
  groomPersonalities,
  groomPersonalityValues,
  groomInteractionTypes,
  groomInteractionTypeValues,
  horseStats,
  horseStatValues,
  trainingLimits,
  competitionLimits,
  breedingLimits,
  foalLimits,
  userProgression,
  scoreRanges,
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
};
