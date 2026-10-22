/**
 * foalAgeUtils
 *
 * Foal age helpers on the game-year clock.
 *
 * Equoria-fr2kg (owner ruling 2026-10-14/15): grooms, not players, do the
 * foal's activities, and there is no graduation. The BB-2 player stage-activity
 * catalog (getActivitiesForStage, getStageForActivity,
 * validateActivityForFoalAge) and hasGraduated were removed.
 *
 * Equoria-fr2kg Q5 (owner ruling 2026-10-15): the named life stages (newborn,
 * weanling, yearling, two_year_old) are not part of the design and were
 * removed, with computeAgeStage and its STAGE_* day boundaries. A horse is a
 * foal while its game age is under 3 (owner ruling 2026-10-19 #18: "under 3"
 * uses the horse's game age).
 *
 * CADENCE — GAME-YEAR CLOCK (Equoria-oey96.16, decision 2026-07-02): foal age
 * runs on the same clock as everything else in the game: 7 real days = 1 game
 * year, computed via backend/utils/horseAge.mjs (the vdw5 date-only, Eastern
 * game clock convention). The foal window closes at exactly the age-3 training
 * gate (getHorseAgeYears >= 3 = 21 real days).
 */

import { getHorseAgeDays, getHorseAgeYears } from './horseAge.mjs';
import { isFoalAge } from '../constants/schema.mjs';

/**
 * Whether a horse born on `dateOfBirth` is still a foal (game age under 3).
 *
 * @param {Date|string|null|undefined} dateOfBirth
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 * @returns {boolean} false when dateOfBirth is missing.
 */
export function isFoalByBirthDate(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) {
    return false;
  }
  return isFoalAge(getHorseAgeYears(dateOfBirth, now));
}

/**
 * Compute age in whole real weeks from dateOfBirth.
 *
 * Equoria-oey96.16: reimplemented on top of the canonical getHorseAgeDays
 * helper (date-only, Eastern game clock) instead of an inline millisecond-per-week literal.
 * The numeric contract (whole real weeks) is unchanged; because 7 real days =
 * 1 game year, this value equals the horse's game-year age. Retained only for
 * the GET /foals/:id ageInDays display path in foalController; reconciling that
 * response shape onto game-days is tracked under Equoria-oey96.17.
 *
 * @param {Date|string} dateOfBirth
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 */
export function computeAgeInWeeks(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) {
    return 0;
  }
  return Math.floor(getHorseAgeDays(dateOfBirth, now) / 7);
}
