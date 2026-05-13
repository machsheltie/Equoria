/**
 * foalAgeUtils — unit tests (Equoria-rr7)
 *
 * Date-based pure functions, no DB required.
 * All date calculations are relative to Date.now().
 */

import { describe, it, expect } from '@jest/globals';
import {
  computeAgeStage,
  computeAgeInWeeks,
  getActivitiesForStage,
  checkBondMilestones,
  hasGraduated,
} from '../../../utils/foalAgeUtils.mjs';

// Helper: date N weeks before now
const weeksAgo = weeks => new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// computeAgeStage
// ---------------------------------------------------------------------------
describe('computeAgeStage', () => {
  it('returns null for null dateOfBirth', () => {
    expect(computeAgeStage(null)).toBeNull();
  });

  it('returns newborn for a horse born < 4 weeks ago', () => {
    expect(computeAgeStage(weeksAgo(1))).toBe('newborn');
  });

  it('returns weanling for 4–25 weeks old', () => {
    expect(computeAgeStage(weeksAgo(10))).toBe('weanling');
  });

  it('returns yearling for 26–51 weeks old', () => {
    expect(computeAgeStage(weeksAgo(35))).toBe('yearling');
  });

  it('returns two_year_old for 52–103 weeks old', () => {
    expect(computeAgeStage(weeksAgo(75))).toBe('two_year_old');
  });

  it('returns null (graduated) for 104+ weeks old', () => {
    expect(computeAgeStage(weeksAgo(110))).toBeNull();
  });

  it('accepts ISO date string', () => {
    expect(computeAgeStage(weeksAgo(1).toISOString())).toBe('newborn');
  });
});

// ---------------------------------------------------------------------------
// computeAgeInWeeks
// ---------------------------------------------------------------------------
describe('computeAgeInWeeks', () => {
  it('returns 0 for null dateOfBirth', () => {
    expect(computeAgeInWeeks(null)).toBe(0);
  });

  it('returns approximate week count for a 10-week-old horse', () => {
    const result = computeAgeInWeeks(weeksAgo(10));
    expect(result).toBeGreaterThanOrEqual(9);
    expect(result).toBeLessThanOrEqual(11);
  });

  it('returns 0 for a brand-new horse born seconds ago', () => {
    expect(computeAgeInWeeks(new Date())).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getActivitiesForStage
// ---------------------------------------------------------------------------
describe('getActivitiesForStage', () => {
  it('returns activities for newborn', () => {
    const acts = getActivitiesForStage('newborn');
    expect(Array.isArray(acts)).toBe(true);
    expect(acts.length).toBeGreaterThan(0);
  });

  it('returns activities for weanling', () => {
    expect(getActivitiesForStage('weanling').length).toBeGreaterThan(0);
  });

  it('returns activities for yearling', () => {
    expect(getActivitiesForStage('yearling').length).toBeGreaterThan(0);
  });

  it('returns activities for two_year_old', () => {
    expect(getActivitiesForStage('two_year_old').length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown stage', () => {
    expect(getActivitiesForStage('adult')).toEqual([]);
  });

  it('each activity has id, label, bondChange, stressChange, cooldownHours', () => {
    for (const stage of ['newborn', 'weanling', 'yearling', 'two_year_old']) {
      for (const act of getActivitiesForStage(stage)) {
        expect(act).toHaveProperty('id');
        expect(act).toHaveProperty('label');
        expect(act).toHaveProperty('bondChange');
        expect(act).toHaveProperty('stressChange');
        expect(act).toHaveProperty('cooldownHours');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// checkBondMilestones
// ---------------------------------------------------------------------------
describe('checkBondMilestones', () => {
  const NOW = new Date('2026-01-01T00:00:00Z');

  it('returns no new milestones when bond is 0', () => {
    const { newMilestones } = checkBondMilestones({}, 0, NOW);
    expect(newMilestones).toEqual([]);
  });

  it('triggers bond25 when score reaches 25', () => {
    const { milestones, newMilestones } = checkBondMilestones({}, 25, NOW);
    expect(newMilestones).toContain('bond25');
    expect(milestones.bond25).toBe(NOW.toISOString());
  });

  it('triggers bond25 and bond50 when score is 60', () => {
    const { newMilestones } = checkBondMilestones({}, 60, NOW);
    expect(newMilestones).toContain('bond25');
    expect(newMilestones).toContain('bond50');
  });

  it('does not re-trigger already-completed milestones', () => {
    const existing = { bond25: NOW.toISOString() };
    const { newMilestones } = checkBondMilestones(existing, 50, NOW);
    expect(newMilestones).not.toContain('bond25');
    expect(newMilestones).toContain('bond50');
  });

  it('triggers all 4 milestones when score is 100', () => {
    const { newMilestones } = checkBondMilestones({}, 100, NOW);
    expect(newMilestones).toEqual(expect.arrayContaining(['bond25', 'bond50', 'bond75', 'bond100']));
  });

  it('does not mutate the input completedMilestones object', () => {
    const original = {};
    checkBondMilestones(original, 100, NOW);
    expect(original).toEqual({});
  });

  it('uses current date when now parameter is omitted (default branch, line 176)', () => {
    const { newMilestones } = checkBondMilestones({}, 30);
    expect(newMilestones).toContain('bond25');
  });
});

// ---------------------------------------------------------------------------
// hasGraduated
// ---------------------------------------------------------------------------
describe('hasGraduated', () => {
  it('returns false for a young foal', () => {
    expect(hasGraduated(weeksAgo(10))).toBe(false);
  });

  it('returns true for a horse 3+ years old', () => {
    expect(hasGraduated(weeksAgo(160))).toBe(true);
  });

  it('returns true for null dateOfBirth (treated as null stage = graduated)', () => {
    expect(hasGraduated(null)).toBe(true);
  });
});
