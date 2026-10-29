/**
 * foalAgeUtils — unit tests
 *
 * Date-based pure functions, no DB required.
 *
 * Equoria-oey96.16: foal age runs on the GAME-YEAR CLOCK (7 real days = 1 game
 * year), computed via backend/utils/horseAge.mjs date-only helpers — NOT real
 * calendar weeks. `now` is INJECTED into every date-based assertion (never
 * Date.now()) per the issue trap.
 */

import { describe, it, expect } from '@jest/globals';
import * as foalAgeUtils from '../../../utils/foalAgeUtils.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';

const { isFoalByBirthDate, computeAgeInWeeks } = foalAgeUtils;

// Fixed reference "now" — injected, never Date.now() (Equoria-oey96.16 trap).
// Chosen at 12:00Z so a whole-day dob subtraction lands on exact UTC-day diffs.
const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
// dob for a horse that is exactly `days` real days old at NOW (date-only UTC).
const daysAgo = days => new Date(NOW.getTime() - days * DAY_MS);

// ---------------------------------------------------------------------------
// Named life stages (removed)
//
// Equoria-fr2kg Q5. OLD CONTRACT: computeAgeStage mapped a foal's age onto
// named life stages (newborn 0–2 days, weanling 3–6, yearling 7–13,
// twoYearOld 14–20, null = "graduated" at 21), with the STAGE_* day
// constants. NEW RULING (owner, 2026-10-15): remove the named life stages —
// they are not part of the design — and there is no graduation. A horse is a
// foal while its game age is under 3.
// ---------------------------------------------------------------------------
describe('named life stages are gone (Equoria-fr2kg Q5)', () => {
  it.each([
    'computeAgeStage',
    'STAGE_WEANLING_MIN_DAYS',
    'STAGE_YEARLING_MIN_DAYS',
    'STAGE_TWO_YEAR_OLD_MIN_DAYS',
    'STAGE_GRADUATION_DAYS',
  ])('foalAgeUtils no longer exports %s', name => {
    expect(foalAgeUtils).not.toHaveProperty(name);
  });
});

// ---------------------------------------------------------------------------
// isFoalByBirthDate — under 3 game-years (owner ruling 2026-10-19 #18: "under
// 3" uses the horse's game age).
// ---------------------------------------------------------------------------
describe('isFoalByBirthDate — game age under 3', () => {
  it('is false for a missing dateOfBirth', () => {
    expect(isFoalByBirthDate(null, NOW)).toBe(false);
    expect(isFoalByBirthDate(undefined, NOW)).toBe(false);
  });

  it.each([0, 2, 3, 7, 13, 14, 20])('is true at %i real days', days => {
    expect(isFoalByBirthDate(daysAgo(days), NOW)).toBe(true);
  });

  it.each([21, 60])('is false at %i real days', days => {
    expect(isFoalByBirthDate(daysAgo(days), NOW)).toBe(false);
  });

  it('accepts an ISO date string', () => {
    expect(isFoalByBirthDate(daysAgo(1).toISOString(), NOW)).toBe(true);
  });

  it('uses the current date when now is omitted (default branch)', () => {
    expect(isFoalByBirthDate(new Date('2000-01-01T00:00:00.000Z'))).toBe(false);
  });

  // The foal window closes at the SAME instant the horse becomes
  // training-eligible (getHorseAgeYears >= 3, Equoria-oey96.16 AC2).
  it('flips exactly at the age-3 training gate', () => {
    expect(isFoalByBirthDate(daysAgo(20), NOW)).toBe(true);
    expect(getHorseAgeYears(daysAgo(20), NOW)).toBe(2);
    expect(isFoalByBirthDate(daysAgo(21), NOW)).toBe(false);
    expect(getHorseAgeYears(daysAgo(21), NOW)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// computeAgeInWeeks — via the canonical getHorseAgeDays helper
// (Equoria-oey96.16: no inline millisecond-per-week literal)
// ---------------------------------------------------------------------------
describe('computeAgeInWeeks (Equoria-oey96.16 — via canonical getHorseAgeDays)', () => {
  it('returns 0 for null dateOfBirth', () => {
    expect(computeAgeInWeeks(null, NOW)).toBe(0);
  });

  it('returns the whole real-week count from injected now', () => {
    expect(computeAgeInWeeks(daysAgo(70), NOW)).toBe(10);
    expect(computeAgeInWeeks(daysAgo(7), NOW)).toBe(1);
  });

  it('returns 0 for a brand-new horse (0 days old)', () => {
    expect(computeAgeInWeeks(daysAgo(0), NOW)).toBe(0);
  });
});

// The dead bond-milestone detector was removed (Equoria-oey96.18), superseded
// by foalMilestoneService.detectAndRecordFoalMilestones. Its milestone-detection
// coverage now lives in
// backend/modules/horses/__tests__/foalMilestoneDetection.integration.test.mjs
// (real-DB, exercises the persisted store through real gameplay paths).

// ---------------------------------------------------------------------------
// Retired player-run helpers (Equoria-fr2kg)
//
// OLD CONTRACT: foalAgeUtils exported the player stage-activity catalog
// (getActivitiesForStage, getStageForActivity, validateActivityForFoalAge) and
// hasGraduated. NEW RULING (owner, 2026-10-14/15): grooms, not players, do the
// foal's activities, and there is no graduation.
// ---------------------------------------------------------------------------
describe('retired player-run foal age helpers (Equoria-fr2kg)', () => {
  it.each(['getActivitiesForStage', 'getStageForActivity', 'validateActivityForFoalAge', 'hasGraduated'])(
    'foalAgeUtils no longer exports %s',
    name => {
      expect(foalAgeUtils).not.toHaveProperty(name);
    },
  );
});
