/**
 * isHorseEligibleForShow — unit tests (Equoria-rr7)
 *
 * Pure eligibility logic, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { isHorseEligibleForShow } from '../../utils/isHorseEligible.mjs';

const makeHorse = (age = 5, level = 3) => ({ age, level });
const makeShow = (overrides = {}) => ({ id: 42, levelMin: 1, levelMax: 10, ...overrides });

describe('isHorseEligibleForShow', () => {
  it('throws when horse is null', () => {
    expect(() => isHorseEligibleForShow(null, makeShow())).toThrow('Horse object is required');
  });

  it('throws when show is null', () => {
    expect(() => isHorseEligibleForShow(makeHorse(), null)).toThrow('Show object is required');
  });

  it('throws when previousEntries is not an array', () => {
    expect(() => isHorseEligibleForShow(makeHorse(), makeShow(), 'bad')).toThrow('previousEntries must be an array');
  });

  it('returns true for a valid eligible horse', () => {
    expect(isHorseEligibleForShow(makeHorse(5, 3), makeShow())).toBe(true);
  });

  it('returns false when horse age is below 3', () => {
    expect(isHorseEligibleForShow(makeHorse(2, 3), makeShow())).toBe(false);
  });

  it('returns false when horse age is above 20', () => {
    expect(isHorseEligibleForShow(makeHorse(21, 3), makeShow())).toBe(false);
  });

  it('accepts horse at age exactly 3', () => {
    expect(isHorseEligibleForShow(makeHorse(3, 3), makeShow())).toBe(true);
  });

  it('accepts horse at age exactly 20', () => {
    expect(isHorseEligibleForShow(makeHorse(20, 3), makeShow())).toBe(true);
  });

  it('returns false when horse level is below levelMin', () => {
    const show = makeShow({ levelMin: 5 });
    expect(isHorseEligibleForShow(makeHorse(5, 3), show)).toBe(false);
  });

  it('returns false when horse level is above levelMax', () => {
    const show = makeShow({ levelMax: 2 });
    expect(isHorseEligibleForShow(makeHorse(5, 3), show)).toBe(false);
  });

  it('accepts horse at exactly levelMin', () => {
    const show = makeShow({ levelMin: 3 });
    expect(isHorseEligibleForShow(makeHorse(5, 3), show)).toBe(true);
  });

  it('accepts show without levelMin/levelMax bounds', () => {
    const show = { id: 99 };
    expect(isHorseEligibleForShow(makeHorse(5, 3), show)).toBe(true);
  });

  it('returns false when horse already entered this show', () => {
    const show = makeShow({ id: 42 });
    expect(isHorseEligibleForShow(makeHorse(5, 3), show, [42])).toBe(false);
  });

  it('returns true when previousEntries does not include this show', () => {
    const show = makeShow({ id: 42 });
    expect(isHorseEligibleForShow(makeHorse(5, 3), show, [7, 99])).toBe(true);
  });

  it('defaults previousEntries to empty array', () => {
    expect(isHorseEligibleForShow(makeHorse(5, 3), makeShow())).toBe(true);
  });

  it('returns false when horse has no age field', () => {
    const horse = { level: 3 };
    expect(isHorseEligibleForShow(horse, makeShow())).toBe(false);
  });

  it('returns false when horse has no level field', () => {
    const horse = { age: 5 };
    const show = makeShow({ levelMin: 1 });
    expect(isHorseEligibleForShow(horse, show)).toBe(false);
  });
});
