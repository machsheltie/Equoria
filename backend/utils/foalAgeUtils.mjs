/**
 * foalAgeUtils (BB-1)
 *
 * Utilities for the age-based foal development system: compute AgeStage from
 * dateOfBirth.
 *
 * Equoria-fr2kg (owner ruling 2026-10-14/15): grooms, not players, do the
 * foal's activities, and there is no graduation. The BB-2 player stage-activity
 * catalog (getActivitiesForStage, getStageForActivity,
 * validateActivityForFoalAge) and hasGraduated were removed.
 *
 * CADENCE — GAME-YEAR CLOCK (Equoria-oey96.16, decision 2026-07-02):
 *   Foal age-stage boundaries run on the same clock as everything else in the
 *   game: 7 real days = 1 game year, computed via backend/utils/horseAge.mjs
 *   (the vdw5 date-only, Eastern game clock convention). They are NOT real calendar weeks.
 *   Previously computeAgeStage read real-time weeks (`Date.now()` millisecond
 *   delta / MS_PER_WEEK, graduating only at 104 real weeks = 728 real days),
 *   which contradicted the canonical horse clock: a horse became a
 *   training-eligible "3-year-old" at 21 real days while computeAgeStage still
 *   called it a NEWBORN. This module now maps each stage onto a game-year so
 *   graduation aligns EXACTLY with the age-3 training gate (getHorseAgeYears
 *   >= 3 = 21 real days; see backend/controllers/trainingController.mjs).
 */

import { getHorseAgeDays } from './horseAge.mjs';

// ── BB-1: Age stage computation ────────────────────────────────────────────────

// Game-year cadence boundaries (Equoria-oey96.16), expressed in real days.
// Each boundary maps onto a game-year (7 real days = 1 game year):
//   newborn:      ageDays 0–2   (game-year 0, early — "game-months")
//   weanling:     ageDays 3–6   (game-year 0, late)
//   yearling:     ageDays 7–13  (game-year 1 — a yearling IS 1 game-year old)
//   two_year_old: ageDays 14–20 (game-year 2)
//   graduated:    ageDays >= 21 (game-year 3+ === training-eligible)
// Exported (Equoria-oey96.18) so foalMilestoneService derives its stage/
// graduation milestone boundaries from the SAME real-day thresholds
// computeAgeStage uses — the detector can never drift from stage computation.
export const STAGE_WEANLING_MIN_DAYS = 3; // newborn -> weanling
export const STAGE_YEARLING_MIN_DAYS = 7; // weanling -> yearling (game-year 1)
export const STAGE_TWO_YEAR_OLD_MIN_DAYS = 14; // yearling -> two_year_old (game-year 2)
export const STAGE_GRADUATION_DAYS = 21; // two_year_old -> graduated (game-year 3 = training gate)

/**
 * Compute age stage from a horse's dateOfBirth.
 *
 * Uses the canonical game-year clock via getHorseAgeDays (date-only, Eastern game clock,
 * Equoria-vdw5) — NOT real calendar weeks (Equoria-oey96.16).
 *
 * @param {Date|string} dateOfBirth
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 * @returns {'newborn'|'weanling'|'yearling'|'two_year_old'|null}
 *   null = horse is age 3+ game-years (graduated, development window closed,
 *   training-eligible)
 */
export function computeAgeStage(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) {
    return null;
  }
  const ageDays = getHorseAgeDays(dateOfBirth, now);

  if (ageDays < STAGE_WEANLING_MIN_DAYS) {
    return 'newborn';
  }
  if (ageDays < STAGE_YEARLING_MIN_DAYS) {
    return 'weanling';
  }
  if (ageDays < STAGE_TWO_YEAR_OLD_MIN_DAYS) {
    return 'yearling';
  }
  if (ageDays < STAGE_GRADUATION_DAYS) {
    return 'two_year_old';
  }
  return null; // graduated (age 3+ game-years, training-eligible)
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
