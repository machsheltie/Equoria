/**
 * foalAgeUtils.test.mjs
 *
 * Unit tests for the foal age utility functions (BB-1, BB-2, BB-3).
 * Pure algorithmic tests — no mocking required.
 *
 * Tests cover:
 * - computeAgeStage boundary conditions
 * - computeAgeInWeeks calculation accuracy
 * - getActivitiesForStage lookup per stage
 * - checkBondMilestones milestone detection
 * - hasGraduated boolean check
 */

import { describe, it, expect } from '@jest/globals';
import {
  computeAgeStage,
  computeAgeInWeeks,
  getActivitiesForStage,
  checkBondMilestones,
  hasGraduated,
} from '../utils/foalAgeUtils.mjs';

// ── Helper: create a date N weeks ago ────────────────────────────────────────

function weeksAgo(n) {
  return new Date(Date.now() - n * 7 * 24 * 60 * 60 * 1000);
}

// ── computeAgeStage ──────────────────────────────────────────────────────────

describe('computeAgeStage', () => {
  it('returns null for null or undefined dateOfBirth', () => {
    expect(computeAgeStage(null)).toBeNull();
    expect(computeAgeStage(undefined)).toBeNull();
  });

  it('returns newborn for a horse born 0 weeks ago', () => {
    expect(computeAgeStage(new Date())).toBe('newborn');
  });

  it('returns newborn for a horse born 3 weeks ago', () => {
    expect(computeAgeStage(weeksAgo(3))).toBe('newborn');
  });

  it('returns weanling at exactly 4 weeks', () => {
    expect(computeAgeStage(weeksAgo(4))).toBe('weanling');
  });

  it('returns weanling for a horse born 15 weeks ago', () => {
    expect(computeAgeStage(weeksAgo(15))).toBe('weanling');
  });

  it('returns weanling at 25 weeks (just before yearling boundary)', () => {
    expect(computeAgeStage(weeksAgo(25))).toBe('weanling');
  });

  it('returns yearling at exactly 26 weeks', () => {
    expect(computeAgeStage(weeksAgo(26))).toBe('yearling');
  });

  it('returns yearling for a horse born 40 weeks ago', () => {
    expect(computeAgeStage(weeksAgo(40))).toBe('yearling');
  });

  it('returns yearling at 51 weeks (just before two_year_old boundary)', () => {
    expect(computeAgeStage(weeksAgo(51))).toBe('yearling');
  });

  it('returns two_year_old at exactly 52 weeks', () => {
    expect(computeAgeStage(weeksAgo(52))).toBe('two_year_old');
  });

  it('returns two_year_old for a horse born 80 weeks ago', () => {
    expect(computeAgeStage(weeksAgo(80))).toBe('two_year_old');
  });

  it('returns two_year_old at 103 weeks (just before graduation)', () => {
    expect(computeAgeStage(weeksAgo(103))).toBe('two_year_old');
  });

  it('returns null (graduated) at exactly 104 weeks', () => {
    expect(computeAgeStage(weeksAgo(104))).toBeNull();
  });

  it('returns null for a horse born 200 weeks ago', () => {
    expect(computeAgeStage(weeksAgo(200))).toBeNull();
  });

  it('accepts an ISO string date', () => {
    const dob = weeksAgo(10).toISOString();
    expect(computeAgeStage(dob)).toBe('weanling');
  });
});

// ── computeAgeInWeeks ────────────────────────────────────────────────────────

describe('computeAgeInWeeks', () => {
  it('returns 0 for null dateOfBirth', () => {
    expect(computeAgeInWeeks(null)).toBe(0);
  });

  it('returns 0 for undefined dateOfBirth', () => {
    expect(computeAgeInWeeks(undefined)).toBe(0);
  });

  it('returns 0 for a horse born just now', () => {
    expect(computeAgeInWeeks(new Date())).toBe(0);
  });

  it('returns correct weeks for 10 weeks ago', () => {
    expect(computeAgeInWeeks(weeksAgo(10))).toBe(10);
  });

  it('returns correct weeks for 52 weeks ago', () => {
    expect(computeAgeInWeeks(weeksAgo(52))).toBe(52);
  });

  it('returns integer (floors fractional weeks)', () => {
    // 10 weeks + 3 days should still floor to 10
    const dob = new Date(Date.now() - (10 * 7 + 3) * 24 * 60 * 60 * 1000);
    expect(computeAgeInWeeks(dob)).toBe(10);
  });

  it('accepts an ISO string date', () => {
    const dob = weeksAgo(26).toISOString();
    expect(computeAgeInWeeks(dob)).toBe(26);
  });
});

// ── getActivitiesForStage ────────────────────────────────────────────────────

describe('getActivitiesForStage', () => {
  it('returns 2 activities for newborn stage', () => {
    const activities = getActivitiesForStage('newborn');
    expect(activities).toHaveLength(2);
    expect(activities[0].id).toBe('imprinting');
    expect(activities[1].id).toBe('gentle_handling');
  });

  it('returns 3 activities for weanling stage', () => {
    const activities = getActivitiesForStage('weanling');
    expect(activities).toHaveLength(3);
    expect(activities[0].id).toBe('desensitization');
    expect(activities[1].id).toBe('social_exposure');
    expect(activities[2].id).toBe('halter_introduction');
  });

  it('returns 3 activities for yearling stage', () => {
    const activities = getActivitiesForStage('yearling');
    expect(activities).toHaveLength(3);
    expect(activities[0].id).toBe('ground_work');
  });

  it('returns 3 activities for two_year_old stage', () => {
    const activities = getActivitiesForStage('two_year_old');
    expect(activities).toHaveLength(3);
    expect(activities[0].id).toBe('intro_to_tack');
  });

  it('returns empty array for unknown stage', () => {
    expect(getActivitiesForStage('senior')).toEqual([]);
  });

  it('returns empty array for null stage', () => {
    expect(getActivitiesForStage(null)).toEqual([]);
  });

  it('returns empty array for undefined stage', () => {
    expect(getActivitiesForStage(undefined)).toEqual([]);
  });

  it('activities have required properties (bondChange, stressChange, cooldownHours)', () => {
    const activities = getActivitiesForStage('newborn');
    for (const act of activities) {
      expect(act).toHaveProperty('id');
      expect(act).toHaveProperty('label');
      expect(act).toHaveProperty('description');
      expect(act).toHaveProperty('bondChange');
      expect(act).toHaveProperty('stressChange');
      expect(act).toHaveProperty('cooldownHours');
    }
  });
});

// ── checkBondMilestones ──────────────────────────────────────────────────────

describe('checkBondMilestones', () => {
  const fixedDate = new Date('2026-03-01T12:00:00.000Z');

  it('detects bond25 milestone when bondScore reaches 25', () => {
    const result = checkBondMilestones({}, 25, fixedDate);
    expect(result.newMilestones).toContain('bond25');
    expect(result.milestones.bond25).toBe(fixedDate.toISOString());
  });

  it('detects multiple milestones at once when bondScore is 100', () => {
    const result = checkBondMilestones({}, 100, fixedDate);
    expect(result.newMilestones).toEqual(['bond25', 'bond50', 'bond75', 'bond100']);
    expect(result.milestones.bond25).toBe(fixedDate.toISOString());
    expect(result.milestones.bond100).toBe(fixedDate.toISOString());
  });

  it('does not re-trigger already completed milestones', () => {
    const existing = { bond25: '2026-01-01T00:00:00.000Z' };
    const result = checkBondMilestones(existing, 50, fixedDate);
    expect(result.newMilestones).toEqual(['bond50']);
    // bond25 retains original timestamp
    expect(result.milestones.bond25).toBe('2026-01-01T00:00:00.000Z');
    expect(result.milestones.bond50).toBe(fixedDate.toISOString());
  });

  it('returns empty newMilestones when no new milestones reached', () => {
    const existing = { bond25: '2026-01-01T00:00:00.000Z' };
    const result = checkBondMilestones(existing, 24, fixedDate);
    expect(result.newMilestones).toEqual([]);
  });

  it('returns empty newMilestones for bondScore of 0', () => {
    const result = checkBondMilestones({}, 0, fixedDate);
    expect(result.newMilestones).toEqual([]);
  });

  it('does not mutate the original completedMilestones object', () => {
    const original = {};
    checkBondMilestones(original, 100, fixedDate);
    expect(original).toEqual({});
  });

  it('uses current time as default when no date provided', () => {
    const result = checkBondMilestones({}, 50);
    expect(result.newMilestones).toContain('bond25');
    expect(result.newMilestones).toContain('bond50');
    // Timestamps should be ISO strings
    expect(typeof result.milestones.bond25).toBe('string');
  });
});

// ── hasGraduated ─────────────────────────────────────────────────────────────

describe('hasGraduated', () => {
  it('returns true for a horse born 104+ weeks ago', () => {
    expect(hasGraduated(weeksAgo(104))).toBe(true);
  });

  it('returns true for a horse born 200 weeks ago', () => {
    expect(hasGraduated(weeksAgo(200))).toBe(true);
  });

  it('returns false for a newborn', () => {
    expect(hasGraduated(new Date())).toBe(false);
  });

  it('returns false for a yearling', () => {
    expect(hasGraduated(weeksAgo(30))).toBe(false);
  });

  it('returns false for a two_year_old at 103 weeks', () => {
    expect(hasGraduated(weeksAgo(103))).toBe(false);
  });

  it('returns true for null dateOfBirth (computeAgeStage returns null)', () => {
    // null dateOfBirth → computeAgeStage returns null → hasGraduated returns true
    expect(hasGraduated(null)).toBe(true);
  });
});
