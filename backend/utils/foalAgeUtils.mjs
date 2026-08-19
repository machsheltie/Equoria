/**
 * foalAgeUtils (BB-1, BB-2, BB-3)
 *
 * Utilities for the age-based foal development system.
 *
 * BB-1: Compute AgeStage from dateOfBirth
 * BB-2: Return age-appropriate activities per stage
 * BB-3: Detect and return milestone completions
 *
 * CADENCE — GAME-YEAR CLOCK (Equoria-oey96.16, decision 2026-07-02):
 *   Foal age-stage boundaries run on the same clock as everything else in the
 *   game: 7 real days = 1 game year, computed via backend/utils/horseAge.mjs
 *   (the vdw5 date-only UTC convention). They are NOT real calendar weeks.
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
 * Uses the canonical game-year clock via getHorseAgeDays (date-only UTC,
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
 * helper (date-only UTC) instead of an inline millisecond-per-week literal.
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

// ── BB-2: Age-appropriate activity definitions ────────────────────────────────

const ACTIVITIES_BY_STAGE = {
  newborn: [
    {
      id: 'imprinting',
      label: 'Imprinting',
      description: 'Gentle first contact to build trust right after birth.',
      bondChange: +8,
      stressChange: -5,
      cooldownHours: 12,
    },
    {
      id: 'gentle_handling',
      label: 'Gentle Handling',
      description: 'Light touching and presence to accustom to humans.',
      bondChange: +5,
      stressChange: -3,
      cooldownHours: 8,
    },
  ],
  weanling: [
    {
      id: 'desensitization',
      label: 'Desensitization',
      description: 'Expose to sounds, objects, and movement to reduce fear.',
      bondChange: +6,
      stressChange: -6,
      cooldownHours: 24,
    },
    {
      id: 'social_exposure',
      label: 'Social Exposure',
      description: 'Time with other horses to develop social confidence.',
      bondChange: +4,
      stressChange: -4,
      cooldownHours: 16,
    },
    {
      id: 'halter_introduction',
      label: 'Halter Introduction',
      description: 'First experience wearing a halter.',
      bondChange: +3,
      stressChange: +2,
      cooldownHours: 48,
    },
  ],
  yearling: [
    {
      id: 'ground_work',
      label: 'Ground Work',
      description: 'Basic voice commands and leading exercises.',
      bondChange: +7,
      stressChange: -2,
      cooldownHours: 24,
    },
    {
      id: 'basic_obstacles',
      label: 'Basic Obstacles',
      description: 'Navigate simple poles and tarps to build confidence.',
      bondChange: +5,
      stressChange: 0,
      cooldownHours: 32,
    },
    {
      id: 'grooming_routine',
      label: 'Grooming Routine',
      description: 'Regular grooming to reinforce bonding.',
      bondChange: +4,
      stressChange: -5,
      cooldownHours: 12,
    },
  ],
  two_year_old: [
    {
      id: 'intro_to_tack',
      label: 'Intro to Tack',
      description: 'First exposure to saddle pad, girth, and bridle.',
      bondChange: +5,
      stressChange: +4,
      cooldownHours: 48,
    },
    {
      id: 'first_lead_walks',
      label: 'First Lead Walks',
      description: 'Short walks under saddle to introduce weight.',
      bondChange: +8,
      stressChange: +2,
      cooldownHours: 36,
    },
    {
      id: 'longe_work',
      label: 'Longe Work',
      description: 'Controlled movement in a circle to build balance.',
      bondChange: +6,
      stressChange: 0,
      cooldownHours: 24,
    },
  ],
};

/**
 * Get available activities for a given age stage.
 * @param {string} ageStage
 * @returns {Array}
 */
export function getActivitiesForStage(ageStage) {
  return ACTIVITIES_BY_STAGE[ageStage] ?? [];
}

/**
 * Return the age stage an activity id belongs to, or null if the id is not a
 * recognised age-stage activity.
 *
 * Equoria-4kzik: age-stage gating used to live ONLY in the frontend
 * DevelopmentTracker, so a client calling POST /foals/:id/activity directly
 * could log an age-inappropriate activity (e.g. 'longe_work' on a newborn).
 * This map is the single source of truth the server uses to enforce the rule.
 *
 * @param {string} activityId
 * @returns {'newborn'|'weanling'|'yearling'|'two_year_old'|null}
 */
export function getStageForActivity(activityId) {
  if (!activityId || typeof activityId !== 'string') {
    return null;
  }
  for (const [stage, activities] of Object.entries(ACTIVITIES_BY_STAGE)) {
    if (activities.some(a => a.id === activityId)) {
      return stage;
    }
  }
  return null;
}

/**
 * Decide whether an age-stage activity may be performed on a foal of the
 * given dateOfBirth right now.
 *
 * Returns a discriminated result so the caller can produce an honest,
 * specific rejection reason instead of a generic 400.
 *
 * - `{ allowed: true }` — activity belongs to the foal's current age stage.
 * - `{ allowed: false, reason: 'graduated' }` — horse is 3+ (no longer a foal).
 * - `{ allowed: false, reason: 'unknown_activity' }` — id is not an age-stage
 *   activity (could be a day-based enrichment activity handled elsewhere; the
 *   caller decides whether to defer rather than reject).
 * - `{ allowed: false, reason: 'wrong_stage', requiredStage, currentStage }` —
 *   real out-of-stage attempt; this is the integrity violation 4kzik fixes.
 *
 * @param {string} activityId
 * @param {Date|string} dateOfBirth
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 * @returns {{ allowed: boolean, reason?: string, requiredStage?: string, currentStage?: string }}
 */
export function validateActivityForFoalAge(activityId, dateOfBirth, now = new Date()) {
  const requiredStage = getStageForActivity(activityId);
  if (requiredStage === null) {
    return { allowed: false, reason: 'unknown_activity' };
  }

  const currentStage = computeAgeStage(dateOfBirth, now);
  if (currentStage === null) {
    return { allowed: false, reason: 'graduated', requiredStage };
  }

  if (currentStage !== requiredStage) {
    return { allowed: false, reason: 'wrong_stage', requiredStage, currentStage };
  }

  return { allowed: true, requiredStage, currentStage };
}

// ── BB-3: Milestone detection ─────────────────────────────────────────────────
//
// The dead bond-milestone detector that lived here was removed (Equoria-oey96.18):
// zero production callers, `bond25`-style ids that contradicted the persisted
// `bond-25` contract, and an in-place-mutation shape. It never shipped, so it
// was removed outright (no compat concern) and SUPERSEDED by
// backend/modules/horses/services/foalMilestoneService.mjs, which detects +
// persists the full milestone set (bond / stage / graduation / first-trait)
// idempotently from real gameplay state.

/**
 * Check if the foal has graduated (age ≥ 3 game-years / stage = null).
 *
 * Equoria-oey96.16: graduation is now on the game-year clock — a foal
 * graduates at age 3 game-years (21 real days), the same instant it becomes
 * training-eligible — NOT at 104 real weeks (728 real days) as before.
 *
 * @param {Date|string} dateOfBirth
 * @param {Date} [now=new Date()] - Reference "current" time (injectable for tests).
 */
export function hasGraduated(dateOfBirth, now = new Date()) {
  return computeAgeStage(dateOfBirth, now) === null;
}
