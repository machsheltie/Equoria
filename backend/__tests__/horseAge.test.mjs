/**
 * Unit tests for backend/utils/horseAge.mjs (Equoria-m2mg).
 *
 * Covers the canonical age-math helpers used across the codebase to compute
 * a horse's age in days or game-years (1 week = 1 game-year) from
 * dateOfBirth, plus all the safety paths (null, future, NaN).
 */

import {
  birthDateForAge,
  getHorseAgeDays,
  getHorseAgeYears,
  withAgeYears,
  gameYearsFromDays,
} from '../utils/horseAge.mjs';

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

// Equoria-vdw5: date-only arithmetic — a horse born on the calendar date May 4
// ages up on the calendar date May 11 whatever the time of day, never by a
// millisecond delta (which underflowed at the weekly anniversary). Owner ruling 2026-10-09: the game runs on Eastern time (America/New_York,
// with daylight saving). dateOfBirth is a date-only column (`@db.Date`), so it
// arrives as UTC midnight of its calendar date and is read as that date;
// "today" is the Eastern calendar date. (Old contract: both sides UTC dates.)
describe('getHorseAgeYears — date-only arithmetic on the Eastern game clock (Equoria-vdw5)', () => {
  test('a May 1 birth date is 1 game-year from 00:00 Eastern on May 8, not before', () => {
    const dob = new Date('2026-05-01T00:00:00.000Z'); // the stored calendar date May 1
    expect(getHorseAgeYears(dob, new Date('2026-05-08T03:59:00.000Z'))).toBe(0); // May 7, 23:59 EDT
    expect(getHorseAgeYears(dob, new Date('2026-05-08T04:00:00.000Z'))).toBe(1); // May 8, 00:00 EDT
  });

  test('ages at Eastern midnight, not UTC midnight', () => {
    // 00:05 UTC on May 11 is still the evening of May 10 in Eastern time; the
    // daily aging cron (00:05 Eastern = 04:05 UTC in May) is when the day turns.
    const dob = new Date('2023-05-04T00:00:00.000Z');
    expect(getHorseAgeDays(dob, new Date('2023-05-11T00:05:00.000Z'))).toBe(6);
    expect(getHorseAgeDays(dob, new Date('2023-05-11T04:05:00.000Z'))).toBe(7);
    expect(getHorseAgeYears(dob, new Date('2023-05-11T04:05:00.000Z'))).toBe(1);
  });

  test('in winter the game day turns at 00:00 EST (05:00 UTC)', () => {
    const dob = new Date('2026-12-01T00:00:00.000Z');
    expect(getHorseAgeDays(dob, new Date('2026-12-08T04:30:00.000Z'))).toBe(6); // Dec 7, 23:30 EST
    expect(getHorseAgeDays(dob, new Date('2026-12-08T05:00:00.000Z'))).toBe(7); // Dec 8, 00:00 EST
  });

  test('a week spanning the daylight-saving change is still exactly 7 game days', () => {
    const dob = new Date('2026-10-31T00:00:00.000Z');
    expect(getHorseAgeDays(dob, new Date('2026-11-07T05:00:00.000Z'))).toBe(7); // Nov 7, 00:00 EST
    expect(getHorseAgeDays(dob, new Date('2026-11-07T04:59:00.000Z'))).toBe(6); // Nov 6, 23:59 EST
  });

  test('a legacy dob stored with a time of day is read by its calendar date', () => {
    // Rows written before the column became date-only carried 04:00 UTC.
    const dob = new Date('2023-05-04T04:00:00.000Z');
    expect(getHorseAgeDays(dob, new Date('2023-05-11T04:05:00.000Z'))).toBe(7);
  });

  test('born today: ageDays=0 for the whole Eastern day', () => {
    const dob = new Date('2026-05-15T00:00:00.000Z');
    expect(getHorseAgeDays(dob, new Date('2026-05-15T04:00:00.000Z'))).toBe(0); // 00:00 EDT
    expect(getHorseAgeDays(dob, new Date('2026-05-16T03:59:00.000Z'))).toBe(0); // 23:59 EDT
    expect(getHorseAgeDays(dob, new Date('2026-05-16T04:00:00.000Z'))).toBe(1); // next day
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

// Owner ruling 2026-10-09: a horse created at a given age is that age at once
// on the Eastern game clock, whatever the hour (dob is a date-only column).
describe('birthDateForAge', () => {
  test('stores the Eastern calendar date ageYears x 7 days back', () => {
    // 22:00 EDT on Oct 9 is already Oct 10 in UTC.
    expect(birthDateForAge(3, new Date('2026-10-10T02:00:00Z')).toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  test('a horse created as age 3 late on an Eastern evening reads age 3, not 2', () => {
    for (const now of ['2026-10-10T02:00:00Z', '2026-10-09T16:00:00Z', '2026-12-15T04:30:00Z']) {
      const at = new Date(now);
      expect(getHorseAgeYears(birthDateForAge(3, at), at)).toBe(3);
      expect(getHorseAgeDays(birthDateForAge(3, at), at)).toBe(21);
    }
  });
});
