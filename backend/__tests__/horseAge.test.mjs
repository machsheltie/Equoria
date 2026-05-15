/**
 * Unit tests for backend/utils/horseAge.mjs (Equoria-m2mg).
 *
 * Covers the canonical age-math helpers used across the codebase to compute
 * a horse's age in days or game-years (1 week = 1 game-year) from
 * dateOfBirth, plus all the safety paths (null, future, NaN).
 */

import { getHorseAgeDays, getHorseAgeYears, withAgeYears } from '../utils/horseAge.mjs';

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
