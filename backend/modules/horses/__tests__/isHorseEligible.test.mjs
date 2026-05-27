/**
 * isHorseEligibleForShow — unit tests (Equoria-rr7)
 *
 * Pure eligibility logic, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { isHorseEligibleForShow } from '../../../utils/isHorseEligible.mjs';

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

  it('returns true when horse has no level field (undefined level is level-restriction-exempt)', () => {
    const horse = { age: 5 };
    const show = makeShow({ levelMin: 1 });
    // Implementation intentionally treats undefined level as exempt from level restrictions
    // so competition entry works for the Horse model that uses horseXp instead of a level column.
    expect(isHorseEligibleForShow(horse, show)).toBe(true);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Additional validation throws, non-numeric/null age & level branches, level-at-max,
// no-bound handling, previousEntries type variety, discipline independence, and edge
// cases not covered above.
describe('isHorseEligibleForShow — extended validation & edge cases (merged from legacy backend/tests, Equoria-wvuin)', () => {
  const mkHorse = (age = 5, level = 3) => ({ age, level });
  const mkShow = (overrides = {}) => ({ id: 42, levelMin: 1, levelMax: 10, ...overrides });

  describe('input validation', () => {
    it('throws for undefined horse', () => {
      expect(() => isHorseEligibleForShow(undefined, mkShow())).toThrow('Horse object is required');
    });
    it('throws for undefined show', () => {
      expect(() => isHorseEligibleForShow(mkHorse(), undefined)).toThrow('Show object is required');
    });
    it('throws for null previousEntries', () => {
      expect(() => isHorseEligibleForShow(mkHorse(), mkShow(), null)).toThrow('previousEntries must be an array');
    });
  });

  describe('age requirements', () => {
    it('returns false for age 1', () => {
      expect(isHorseEligibleForShow(mkHorse(1, 3), mkShow())).toBe(false);
    });
    it('returns false for age 25', () => {
      expect(isHorseEligibleForShow(mkHorse(25, 3), mkShow())).toBe(false);
    });
    it('returns false for non-numeric age', () => {
      expect(isHorseEligibleForShow(mkHorse('old', 3), mkShow())).toBe(false);
    });
    it('returns false for null age', () => {
      expect(isHorseEligibleForShow(mkHorse(null, 3), mkShow())).toBe(false);
    });
  });

  describe('level requirements', () => {
    it('accepts horse level exactly at levelMax', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 10), mkShow({ levelMax: 10 }))).toBe(true);
    });
    it('non-numeric level is level-restriction-exempt (true)', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 'high'), mkShow({ levelMin: 5 }))).toBe(true);
    });
    it('null level is level-restriction-exempt (true)', () => {
      expect(isHorseEligibleForShow(mkHorse(5, null), mkShow({ levelMin: 5 }))).toBe(true);
    });
    it('handles show with no levelMin specified', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 3), { id: 1, levelMax: 10 })).toBe(true);
    });
    it('handles show with no levelMax specified', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 3), { id: 1, levelMin: 1 })).toBe(true);
    });
  });

  describe('previousEntries variety', () => {
    it('handles numeric show IDs in previousEntries', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 3), mkShow({ id: 42 }), [42])).toBe(false);
    });
    it('handles mixed-type show IDs in previousEntries', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 3), mkShow({ id: 42 }), ['7', 42, '99'])).toBe(false);
    });
    it('handles a very large previousEntries array without matching', () => {
      const big = Array.from({ length: 5000 }, (_, i) => i + 100); // none equal show id 42
      expect(isHorseEligibleForShow(mkHorse(5, 3), mkShow({ id: 42 }), big)).toBe(true);
    });
  });

  describe('discipline & health independence', () => {
    it('eligibility is independent of discipline and health', () => {
      const horse = { ...mkHorse(5, 3), health: 'Bad' };
      expect(isHorseEligibleForShow(horse, mkShow({ discipline: 'Dressage' }))).toBe(true);
      expect(isHorseEligibleForShow(horse, mkShow({ discipline: 'Racing' }))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles show with zero as levelMin', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 0), mkShow({ levelMin: 0 }))).toBe(true);
    });
    it('handles show ID that is an empty string', () => {
      expect(isHorseEligibleForShow(mkHorse(5, 3), mkShow({ id: '' }), [''])).toBe(false);
    });
  });
});
