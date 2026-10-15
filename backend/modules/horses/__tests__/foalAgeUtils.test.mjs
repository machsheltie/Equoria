/**
 * foalAgeUtils — unit tests
 *
 * Date-based pure functions, no DB required.
 *
 * Equoria-oey96.16: the foal age-stage cadence runs on the GAME-YEAR CLOCK
 * (7 real days = 1 game year), computed via backend/utils/horseAge.mjs
 * date-only UTC helpers — NOT real calendar weeks. `now` is INJECTED into
 * every date-based assertion (never Date.now()) per the issue trap.
 */

import { describe, it, expect } from '@jest/globals';
import * as foalAgeUtils from '../../../utils/foalAgeUtils.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';

const { computeAgeStage, computeAgeInWeeks } = foalAgeUtils;

// Fixed reference "now" — injected, never Date.now() (Equoria-oey96.16 trap).
// Chosen at 12:00Z so a whole-day dob subtraction lands on exact UTC-day diffs.
const NOW = new Date('2026-06-15T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
// dob for a horse that is exactly `days` real days old at NOW (date-only UTC).
const daysAgo = days => new Date(NOW.getTime() - days * DAY_MS);

// ---------------------------------------------------------------------------
// computeAgeStage — game-year cadence (Equoria-oey96.16)
//   newborn:      ageDays 0–2   (game-year 0, early — "game-months")
//   weanling:     ageDays 3–6   (game-year 0, late)
//   yearling:     ageDays 7–13  (game-year 1)
//   two_year_old: ageDays 14–20 (game-year 2)
//   graduated:    ageDays >= 21 (game-year 3+, training-eligible)
// ---------------------------------------------------------------------------
describe('computeAgeStage — game-year cadence (Equoria-oey96.16)', () => {
  it('returns null for null dateOfBirth', () => {
    expect(computeAgeStage(null, NOW)).toBeNull();
  });

  it('newborn: 0 real days (just born)', () => {
    expect(computeAgeStage(daysAgo(0), NOW)).toBe('newborn');
  });

  it('newborn upper edge: 2 real days', () => {
    expect(computeAgeStage(daysAgo(2), NOW)).toBe('newborn');
  });

  it('weanling lower edge: 3 real days', () => {
    expect(computeAgeStage(daysAgo(3), NOW)).toBe('weanling');
  });

  it('weanling upper edge: 6 real days', () => {
    expect(computeAgeStage(daysAgo(6), NOW)).toBe('weanling');
  });

  it('yearling lower edge: 7 real days (game-year 1)', () => {
    expect(computeAgeStage(daysAgo(7), NOW)).toBe('yearling');
  });

  it('yearling upper edge: 13 real days', () => {
    expect(computeAgeStage(daysAgo(13), NOW)).toBe('yearling');
  });

  it('two_year_old lower edge: 14 real days (game-year 2)', () => {
    expect(computeAgeStage(daysAgo(14), NOW)).toBe('two_year_old');
  });

  it('two_year_old upper edge: 20 real days', () => {
    expect(computeAgeStage(daysAgo(20), NOW)).toBe('two_year_old');
  });

  it('graduated (null) at exactly 21 real days (game-year 3)', () => {
    expect(computeAgeStage(daysAgo(21), NOW)).toBeNull();
  });

  it('graduated (null) well beyond 21 real days', () => {
    expect(computeAgeStage(daysAgo(60), NOW)).toBeNull();
  });

  it('accepts ISO date string', () => {
    expect(computeAgeStage(daysAgo(1).toISOString(), NOW)).toBe('newborn');
  });

  it('uses current date when now is omitted (default branch)', () => {
    // A dob far in the past is graduated regardless of the exact clock value.
    expect(computeAgeStage(new Date('2000-01-01T00:00:00.000Z'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// graduation === training-eligibility (AC2, Equoria-oey96.16)
//
// The whole point of the fix: a foal graduates from the development window at
// the SAME instant it becomes training-eligible (age >= 3 game-years = 21 real
// days). trainingController gates on getHorseAgeYears(...) >= 3. Under the old
// real-weeks cadence a horse was training-eligible at 21 real days while
// computeAgeStage still called it a NEWBORN — the exact bug this issue closes.
// ---------------------------------------------------------------------------
describe('graduation aligns exactly with the age-3 training gate (Equoria-oey96.16 AC2)', () => {
  it('one day BEFORE the gate: still two_year_old AND not yet age-3', () => {
    const dob = daysAgo(20);
    expect(computeAgeStage(dob, NOW)).toBe('two_year_old');
    expect(getHorseAgeYears(dob, NOW)).toBe(2); // training gate NOT met (needs >= 3)
  });

  it('AT the gate: graduated (stage null) AND exactly age-3 (training-eligible)', () => {
    const dob = daysAgo(21);
    expect(computeAgeStage(dob, NOW)).toBeNull(); // graduated from foal window
    expect(getHorseAgeYears(dob, NOW)).toBe(3); // training-eligible (>= 3)
    // They flip together — no window where a horse is training-eligible but the
    // foal system still calls it a foal.
  });
});

// ---------------------------------------------------------------------------
// computeAgeInWeeks — now via the canonical getHorseAgeDays helper
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

// ---------------------------------------------------------------------------
// BB.1 ageStage enum-spelling contract LOCK (Equoria-oey96.46)
//
// The canonical enum is snake_case `two_year_old` with graduated === `null`
// (already the shipped code + frontend shape). The docs/epics.md BB.1 spec
// previously listed the hyphenated `two-year-old` and a `'graduated'` string
// enum value; the spec was aligned TO the code. This asserts the enum NEVER
// emits either rejected spelling — FIRES if the code drifts toward the spec.
// ---------------------------------------------------------------------------
describe('ageStage enum spelling contract (Equoria-oey96.46)', () => {
  it('two-year-old stage is snake_case `two_year_old`, never the hyphenated form', () => {
    const stage = computeAgeStage(daysAgo(17), NOW); // mid two-year-old window
    expect(stage).toBe('two_year_old');
    expect(stage).not.toBe('two-year-old');
  });

  it('graduated is `null`, never the string `graduated`', () => {
    const stage = computeAgeStage(daysAgo(30), NOW); // well past graduation
    expect(stage).toBeNull();
    expect(stage).not.toBe('graduated');
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
// foal's activities, and there is no graduation. The stage computation above
// stays.
// ---------------------------------------------------------------------------
describe('retired player-run foal age helpers (Equoria-fr2kg)', () => {
  it.each(['getActivitiesForStage', 'getStageForActivity', 'validateActivityForFoalAge', 'hasGraduated'])(
    'foalAgeUtils no longer exports %s',
    name => {
      expect(foalAgeUtils).not.toHaveProperty(name);
    },
  );
});
