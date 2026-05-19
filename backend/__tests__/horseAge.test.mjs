/**
 * Unit tests for backend/utils/horseAge.mjs (Equoria-m2mg).
 *
 * Covers the canonical age-math helpers used across the codebase to compute
 * a horse's age in days or game-years (1 week = 1 game-year) from
 * dateOfBirth, plus all the safety paths (null, future, NaN).
 */

import { getHorseAgeDays, getHorseAgeYears, withAgeYears, gameYearsFromDays } from '../utils/horseAge.mjs';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

describe('getHorseAgeDays', () => {
  const fixedNow = new Date('2026-05-15T12:00:00.000Z');

  test('returns 0 for null dateOfBirth', () => {
    expect(getHorseAgeDays(null, fixedNow)).toBe(0);
  });

  test('returns 0 for undefined dateOfBirth', () => {
    expect(getHorseAgeDays(undefined, fixedNow)).toBe(0);
  });

  test('returns 0 for invalid date string', () => {
    expect(getHorseAgeDays('not-a-date', fixedNow)).toBe(0);
  });

  test('returns 0 when dateOfBirth is in the future', () => {
    const future = new Date(fixedNow.getTime() + 5 * MS_PER_DAY);
    expect(getHorseAgeDays(future, fixedNow)).toBe(0);
  });

  test('returns 0 when dateOfBirth equals now', () => {
    expect(getHorseAgeDays(fixedNow, fixedNow)).toBe(0);
  });

  test('returns 7 when dateOfBirth is exactly 7 days ago', () => {
    const dob = new Date(fixedNow.getTime() - 7 * MS_PER_DAY);
    expect(getHorseAgeDays(dob, fixedNow)).toBe(7);
  });

  test('returns 14 when dateOfBirth is exactly 14 days ago', () => {
    const dob = new Date(fixedNow.getTime() - 14 * MS_PER_DAY);
    expect(getHorseAgeDays(dob, fixedNow)).toBe(14);
  });

  test('floors fractional days', () => {
    // 7.5 days ago — should floor to 7
    const dob = new Date(fixedNow.getTime() - Math.floor(7.5 * MS_PER_DAY));
    expect(getHorseAgeDays(dob, fixedNow)).toBe(7);
  });

  test('accepts ISO string dateOfBirth', () => {
    const dob = new Date(fixedNow.getTime() - 14 * MS_PER_DAY).toISOString();
    expect(getHorseAgeDays(dob, fixedNow)).toBe(14);
  });
});

describe('getHorseAgeYears', () => {
  const fixedNow = new Date('2026-05-15T12:00:00.000Z');

  test('returns 0 for null dateOfBirth (AC: dob=null → 0)', () => {
    expect(getHorseAgeYears(null, fixedNow)).toBe(0);
  });

  test('returns 0 for undefined dateOfBirth', () => {
    expect(getHorseAgeYears(undefined, fixedNow)).toBe(0);
  });

  test('returns 0 when dateOfBirth is in the future (AC: future → 0)', () => {
    const future = new Date(fixedNow.getTime() + 3 * MS_PER_DAY);
    expect(getHorseAgeYears(future, fixedNow)).toBe(0);
  });

  test('returns 0 for a 6-day-old horse (not yet 1 game-year)', () => {
    const dob = new Date(fixedNow.getTime() - 6 * MS_PER_DAY);
    expect(getHorseAgeYears(dob, fixedNow)).toBe(0);
  });

  test('returns 1 when dateOfBirth is exactly 7 days ago (AC: 7d ago → 1)', () => {
    const dob = new Date(fixedNow.getTime() - 7 * MS_PER_DAY);
    expect(getHorseAgeYears(dob, fixedNow)).toBe(1);
  });

  test('returns 2 when dateOfBirth is exactly 14 days ago (AC: 14d ago → 2)', () => {
    const dob = new Date(fixedNow.getTime() - 14 * MS_PER_DAY);
    expect(getHorseAgeYears(dob, fixedNow)).toBe(2);
  });

  test('returns 3 when dateOfBirth is exactly 21 days ago (training-eligible boundary)', () => {
    const dob = new Date(fixedNow.getTime() - 21 * MS_PER_DAY);
    expect(getHorseAgeYears(dob, fixedNow)).toBe(3);
  });

  test('returns 21 at retirement age (147 days = 21 game-years)', () => {
    const dob = new Date(fixedNow.getTime() - 147 * MS_PER_DAY);
    expect(getHorseAgeYears(dob, fixedNow)).toBe(21);
  });

  test('floors at the game-week boundary (13 days → 1 year, not 2)', () => {
    const dob = new Date(fixedNow.getTime() - 13 * MS_PER_DAY);
    expect(getHorseAgeYears(dob, fixedNow)).toBe(1);
  });

  test('returns 0 for invalid date string', () => {
    expect(getHorseAgeYears('garbage', fixedNow)).toBe(0);
  });
});

// Equoria-vdw5: Date-only arithmetic — the cron schedule fires at 00:05 UTC,
// but legacy DB rows have dob timestamps like 2023-05-04T04:00Z (midnight EDT).
// Time-of-day arithmetic on dob would underflow at the weekly anniversary:
// dob=May 4 04:00 UTC, now=May 11 00:05 UTC → diffMs = 6d20h05m → floor(/day)=6,
// floor(/week)=0 game-years. The user expectation is that any horse born on
// the calendar date May 4 (regardless of stored time) ages up on the calendar
// date May 11. The canonical implementation must therefore use date-only
// arithmetic in UTC: floor((startOfDay(now) - startOfDay(dob)) / 7days).
describe('getHorseAgeYears — date-only arithmetic (Equoria-vdw5)', () => {
  test('May 1 dob ages to 1 game-year on May 8 (same time-of-day)', () => {
    const dob = new Date('2026-05-01T00:00:00.000Z');
    const now = new Date('2026-05-08T00:00:00.000Z');
    expect(getHorseAgeYears(dob, now)).toBe(1);
  });

  test('dob stored at 04:00 UTC still ages on the calendar anniversary at 00:05 UTC', () => {
    // The legacy-cron scenario from vdw5: dob has a 04:00 UTC offset (i.e.
    // EDT midnight), cron runs at 00:05 UTC. Date-only arithmetic must
    // produce ageDays=7 (and ageYears=1) because the calendar date diff
    // is May 11 - May 4 = 7 days.
    const dob = new Date('2023-05-04T04:00:00.000Z');
    const now = new Date('2023-05-11T00:05:00.000Z');
    expect(getHorseAgeDays(dob, now)).toBe(7);
    expect(getHorseAgeYears(dob, now)).toBe(1);
  });

  test('does not age up one day late: dob May 4 ages on May 11 in UTC, not May 12', () => {
    // Sentinel-positive for the off-by-one-day bug described in vdw5: the
    // cron run on May 11 must increment the horse's age, not the run on
    // May 12.
    const dob = new Date('2023-05-04T04:00:00.000Z');
    const may11 = new Date('2023-05-11T00:05:00.000Z');
    const may12 = new Date('2023-05-12T00:05:00.000Z');
    expect(getHorseAgeYears(dob, may11)).toBe(1);
    expect(getHorseAgeYears(dob, may12)).toBe(1);
    // And earlier than May 11 the horse must still be 0 game-years.
    const may10 = new Date('2023-05-10T23:55:00.000Z');
    expect(getHorseAgeYears(dob, may10)).toBe(0);
  });

  test('treats dob and now as date-only UTC: same-day dob → ageDays=0 regardless of time', () => {
    // Both timestamps are May 15 UTC. Date-only diff = 0 → ageDays=0.
    const dob = new Date('2026-05-15T23:59:00.000Z');
    const now = new Date('2026-05-15T00:00:01.000Z');
    expect(getHorseAgeDays(dob, now)).toBe(0);
  });

  test('next-calendar-day arithmetic: dob May 15 → ageDays=1 on May 16 regardless of time-of-day', () => {
    const dob = new Date('2026-05-15T23:00:00.000Z');
    const now = new Date('2026-05-16T00:30:00.000Z'); // 1.5 real hours later, but 1 calendar day later
    expect(getHorseAgeDays(dob, now)).toBe(1);
  });
});

describe('withAgeYears (serializer decorator)', () => {
  const fixedNow = new Date('2026-05-15T12:00:00.000Z');

  test('returns the input unchanged when horse is null', () => {
    expect(withAgeYears(null, fixedNow)).toBeNull();
  });

  test('returns the input unchanged when horse is a primitive', () => {
    expect(withAgeYears('not-a-horse', fixedNow)).toBe('not-a-horse');
  });

  test('adds ageYears=3 for a horse with dateOfBirth 21 days ago (lvjy AC)', () => {
    // AC: create horse with dob 21 days ago via API, fetch, assert ageYears===3
    const dob = new Date(fixedNow.getTime() - 21 * MS_PER_DAY);
    const horse = { id: 42, name: 'Test', dateOfBirth: dob };
    const decorated = withAgeYears(horse, fixedNow);
    expect(decorated.ageYears).toBe(3);
    expect(decorated.id).toBe(42);
    expect(decorated.name).toBe('Test');
  });

  test('adds ageYears=0 when dateOfBirth is missing', () => {
    const horse = { id: 1, name: 'X' };
    expect(withAgeYears(horse, fixedNow).ageYears).toBe(0);
  });

  test('does not mutate the input horse object', () => {
    const dob = new Date(fixedNow.getTime() - 14 * MS_PER_DAY);
    const horse = { id: 7, dateOfBirth: dob };
    const before = { ...horse };
    withAgeYears(horse, fixedNow);
    expect(horse).toEqual(before);
    expect('ageYears' in horse).toBe(false);
  });

  test('preserves the legacy age field if present (transitional)', () => {
    const dob = new Date(fixedNow.getTime() - 21 * MS_PER_DAY);
    const horse = { id: 1, age: 99, dateOfBirth: dob };
    const decorated = withAgeYears(horse, fixedNow);
    expect(decorated.age).toBe(99); // transitional: backend keeps age until lvjy fully rolls out
    expect(decorated.ageYears).toBe(3); // primary signal
  });
});

describe('gameYearsFromDays (Equoria-fe9k — canonical days→game-years)', () => {
  it('converts days to game-years via floor(days / 7)', () => {
    expect(gameYearsFromDays(0)).toBe(0);
    expect(gameYearsFromDays(6)).toBe(0);
    expect(gameYearsFromDays(7)).toBe(1);
    expect(gameYearsFromDays(14)).toBe(2);
    expect(gameYearsFromDays(21)).toBe(3);
    expect(gameYearsFromDays(500)).toBe(71);
    expect(gameYearsFromDays(1460)).toBe(208);
  });

  it('sentinel-positive: differs from the legacy /365 calendar result', () => {
    // 1460 days: game-years = 208, calendar-years = 4. Proves the helper is
    // NOT calendar math (the exact drift Equoria-fe9k fixes).
    expect(gameYearsFromDays(1460)).not.toBe(Math.floor(1460 / 365));
    expect(gameYearsFromDays(500)).not.toBe(Math.floor(500 / 365));
  });

  it('defensive: non-finite / negative / non-number input → 0', () => {
    expect(gameYearsFromDays(-5)).toBe(0);
    expect(gameYearsFromDays(NaN)).toBe(0);
    expect(gameYearsFromDays(Infinity)).toBe(0);
    expect(gameYearsFromDays('100')).toBe(0);
    expect(gameYearsFromDays(null)).toBe(0);
    expect(gameYearsFromDays(undefined)).toBe(0);
  });
});
