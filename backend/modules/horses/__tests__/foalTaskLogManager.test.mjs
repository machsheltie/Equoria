/**
 * foalTaskLogManager — unit tests (Equoria-rr7)
 *
 * Pure utility functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  initializeTaskLog,
  incrementTaskCount,
  getTaskCount,
  getTotalTaskCount,
  getCompletedTasks,
  calculateStreakFromLastCareDate,
  hasBurnoutImmunity,
  updateFoalCareData,
  validateTaskLog,
  getFoalCareSummary,
  resetFoalCareStreak,
} from '../../../utils/foalTaskLogManager.mjs';

const daysAgo = days => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// initializeTaskLog
// ---------------------------------------------------------------------------
describe('initializeTaskLog', () => {
  it('returns an empty object', () => {
    expect(initializeTaskLog()).toEqual({});
  });

  it('returns a new object each call', () => {
    const a = initializeTaskLog();
    const b = initializeTaskLog();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// incrementTaskCount
// ---------------------------------------------------------------------------
describe('incrementTaskCount', () => {
  it('adds a new task with count 1', () => {
    const result = incrementTaskCount({}, 'desensitization');
    expect(result.desensitization).toBe(1);
  });

  it('increments an existing task', () => {
    const log = { desensitization: 3 };
    const result = incrementTaskCount(log, 'desensitization');
    expect(result.desensitization).toBe(4);
  });

  it('uses custom increment value', () => {
    const result = incrementTaskCount({}, 'early_touch', 5);
    expect(result.early_touch).toBe(5);
  });

  it('preserves other tasks in the log', () => {
    const log = { desensitization: 2, early_touch: 3 };
    const result = incrementTaskCount(log, 'desensitization');
    expect(result.early_touch).toBe(3);
  });

  it('does not mutate the original log', () => {
    const log = { desensitization: 2 };
    incrementTaskCount(log, 'desensitization');
    expect(log.desensitization).toBe(2);
  });

  it('accepts null currentTaskLog (treats as empty)', () => {
    const result = incrementTaskCount(null, 'task');
    expect(result.task).toBe(1);
  });

  it('throws for null taskName', () => {
    expect(() => incrementTaskCount({}, null)).toThrow('Task name cannot be null or undefined');
  });

  it('throws for undefined taskName', () => {
    expect(() => incrementTaskCount({}, undefined)).toThrow();
  });

  it('throws for non-string taskName', () => {
    expect(() => incrementTaskCount({}, 42)).toThrow('Task name must be a string');
  });
});

// ---------------------------------------------------------------------------
// getTaskCount
// ---------------------------------------------------------------------------
describe('getTaskCount', () => {
  it('returns count for existing task', () => {
    expect(getTaskCount({ early_touch: 7 }, 'early_touch')).toBe(7);
  });

  it('returns 0 for missing task', () => {
    expect(getTaskCount({}, 'missing')).toBe(0);
  });

  it('returns 0 for null taskLog', () => {
    expect(getTaskCount(null, 'task')).toBe(0);
  });

  it('returns 0 for non-object taskLog', () => {
    expect(getTaskCount('invalid', 'task')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTotalTaskCount
// ---------------------------------------------------------------------------
describe('getTotalTaskCount', () => {
  it('sums all task counts', () => {
    expect(getTotalTaskCount({ a: 3, b: 5, c: 2 })).toBe(10);
  });

  it('returns 0 for empty log', () => {
    expect(getTotalTaskCount({})).toBe(0);
  });

  it('returns 0 for null input', () => {
    expect(getTotalTaskCount(null)).toBe(0);
  });

  it('skips non-numeric values', () => {
    expect(getTotalTaskCount({ a: 3, b: 'bad' })).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getCompletedTasks
// ---------------------------------------------------------------------------
describe('getCompletedTasks', () => {
  it('returns task names with count > 0', () => {
    const log = { desensitization: 3, early_touch: 0, brushing: 5 };
    const result = getCompletedTasks(log);
    expect(result).toContain('desensitization');
    expect(result).toContain('brushing');
    expect(result).not.toContain('early_touch');
  });

  it('returns empty array for empty log', () => {
    expect(getCompletedTasks({})).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(getCompletedTasks(null)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calculateStreakFromLastCareDate
// ---------------------------------------------------------------------------
describe('calculateStreakFromLastCareDate', () => {
  it('returns inactive streak when lastCareDate is null', () => {
    const result = calculateStreakFromLastCareDate(null);
    expect(result.isStreakActive).toBe(false);
    expect(result.daysSinceLastCare).toBeNull();
    expect(result.streakBroken).toBe(false);
  });

  it('streak is active when care was today', () => {
    const today = new Date();
    const result = calculateStreakFromLastCareDate(today, today);
    expect(result.isStreakActive).toBe(true);
    expect(result.daysSinceLastCare).toBe(0);
  });

  it('streak is active within grace period (1 day ago, default grace 2)', () => {
    const result = calculateStreakFromLastCareDate(daysAgo(1), new Date());
    expect(result.isStreakActive).toBe(true);
    expect(result.isWithinGracePeriod).toBe(true);
  });

  it('streak is broken when care was more than gracePeriodDays ago', () => {
    const result = calculateStreakFromLastCareDate(daysAgo(5), new Date(), 2);
    expect(result.isStreakActive).toBe(false);
    expect(result.streakBroken).toBe(true);
  });

  it('respects custom gracePeriodDays', () => {
    const result = calculateStreakFromLastCareDate(daysAgo(3), new Date(), 5);
    expect(result.isStreakActive).toBe(true);
  });

  it('throws on invalid lastCareDate string', () => {
    expect(() => calculateStreakFromLastCareDate('not-a-date', new Date())).toThrow();
  });

  it('accepts ISO date string for lastCareDate', () => {
    const result = calculateStreakFromLastCareDate(daysAgo(1).toISOString(), new Date());
    expect(typeof result.daysSinceLastCare).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// hasBurnoutImmunity
// ---------------------------------------------------------------------------
describe('hasBurnoutImmunity', () => {
  it('returns true when consecutiveDays meets threshold', () => {
    expect(hasBurnoutImmunity(7)).toBe(true);
  });

  it('returns true when consecutiveDays exceeds threshold', () => {
    expect(hasBurnoutImmunity(10)).toBe(true);
  });

  it('returns false when below threshold', () => {
    expect(hasBurnoutImmunity(6)).toBe(false);
  });

  it('returns false for non-number input', () => {
    expect(hasBurnoutImmunity('seven')).toBe(false);
  });

  it('respects custom immunityThreshold', () => {
    expect(hasBurnoutImmunity(3, 3)).toBe(true);
    expect(hasBurnoutImmunity(2, 3)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateFoalCareData
// ---------------------------------------------------------------------------
describe('updateFoalCareData', () => {
  it('increments task count in the returned data', () => {
    const data = { taskLog: { brushing: 2 }, lastGroomed: null, daysGroomedInARow: 0 };
    const result = updateFoalCareData(data, 'brushing');
    expect(result.taskLog.brushing).toBe(3);
  });

  it('sets lastGroomed to careDate', () => {
    const careDate = new Date('2024-06-15');
    const data = { taskLog: {}, lastGroomed: null, daysGroomedInARow: 0 };
    const result = updateFoalCareData(data, 'task', careDate);
    expect(result.lastGroomed).toBe(careDate);
  });

  it('starts streak at 1 when first care', () => {
    const data = { taskLog: {}, lastGroomed: null, daysGroomedInARow: 0 };
    const result = updateFoalCareData(data, 'task', new Date());
    expect(result.daysGroomedInARow).toBe(1);
  });

  it('increments streak when care is within grace period', () => {
    const yesterday = daysAgo(1);
    const data = { taskLog: {}, lastGroomed: yesterday, daysGroomedInARow: 3 };
    const result = updateFoalCareData(data, 'task', new Date());
    expect(result.daysGroomedInARow).toBe(4);
  });

  it('resets streak to 1 when streak was broken', () => {
    const longAgo = daysAgo(10);
    const data = { taskLog: {}, lastGroomed: longAgo, daysGroomedInARow: 5 };
    const result = updateFoalCareData(data, 'task', new Date());
    expect(result.daysGroomedInARow).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// validateTaskLog
// ---------------------------------------------------------------------------
describe('validateTaskLog', () => {
  it('returns valid for null input', () => {
    expect(validateTaskLog(null).isValid).toBe(true);
  });

  it('returns valid for empty object', () => {
    expect(validateTaskLog({}).isValid).toBe(true);
  });

  it('returns valid for proper log', () => {
    const result = validateTaskLog({ brushing: 3, desensitization: 5 });
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid for non-object', () => {
    const result = validateTaskLog('not an object');
    expect(result.isValid).toBe(false);
  });

  it('returns invalid for negative count', () => {
    const result = validateTaskLog({ brushing: -1 });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns invalid for non-integer count', () => {
    const result = validateTaskLog({ brushing: 3.5 });
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getFoalCareSummary
// ---------------------------------------------------------------------------
describe('getFoalCareSummary', () => {
  it('returns expected shape', () => {
    const foalData = { taskLog: { brushing: 3 }, daysGroomedInARow: 8, lastGroomed: null };
    const summary = getFoalCareSummary(foalData);
    expect(summary).toHaveProperty('totalTaskCompletions');
    expect(summary).toHaveProperty('uniqueTasksCompleted');
    expect(summary).toHaveProperty('completedTaskTypes');
    expect(summary).toHaveProperty('consecutiveDaysOfCare');
    expect(summary).toHaveProperty('hasBurnoutImmunity');
    expect(summary).toHaveProperty('streakStatus');
  });

  it('reflects burnout immunity when consecutive days >= 7', () => {
    const foalData = { taskLog: {}, daysGroomedInARow: 7, lastGroomed: null };
    expect(getFoalCareSummary(foalData).hasBurnoutImmunity).toBe(true);
  });

  it('counts total task completions correctly', () => {
    const foalData = { taskLog: { a: 3, b: 5 }, daysGroomedInARow: 0, lastGroomed: null };
    expect(getFoalCareSummary(foalData).totalTaskCompletions).toBe(8);
  });

  it('handles missing taskLog gracefully', () => {
    const foalData = { daysGroomedInARow: 0, lastGroomed: null };
    const summary = getFoalCareSummary(foalData);
    expect(summary.totalTaskCompletions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getCompletedTasks — non-numeric count branch (line 106)
// ---------------------------------------------------------------------------
describe('getCompletedTasks — non-numeric values', () => {
  it('excludes tasks with non-numeric counts (line 106 typeof guard)', () => {
    const log = { brushing: 3, badEntry: 'not-a-number', empty: 0 };
    const result = getCompletedTasks(log);
    expect(result).toContain('brushing');
    expect(result).not.toContain('badEntry');
    expect(result).not.toContain('empty');
  });
});

// ---------------------------------------------------------------------------
// calculateStreakFromLastCareDate — invalid currentDate branch (line 140)
// ---------------------------------------------------------------------------
describe('calculateStreakFromLastCareDate — invalid currentDate', () => {
  it('throws when currentDate is invalid (line 140 isNaN check)', () => {
    expect(() => calculateStreakFromLastCareDate(new Date(), 'not-a-date')).toThrow('Invalid currentDate provided');
  });
});

// ---------------------------------------------------------------------------
// updateFoalCareData — same-day care branch (line 192)
// ---------------------------------------------------------------------------
describe('updateFoalCareData — same-day care', () => {
  it('does not increment streak when care is on the same day (line 192 daysSinceLastCare===0)', () => {
    const now = new Date();
    const data = { taskLog: {}, lastGroomed: now, daysGroomedInARow: 4 };
    const result = updateFoalCareData(data, 'brushing', now);
    // Same day: streak unchanged (stays at 4, not incremented to 5)
    expect(result.daysGroomedInARow).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// validateTaskLog — empty-string key branch (line 238-239)
// ---------------------------------------------------------------------------
describe('validateTaskLog — empty-string task name', () => {
  it('returns invalid when a task key is an empty string (line 238 taskName.length===0)', () => {
    const result = validateTaskLog({ '': 3 });
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// resetFoalCareStreak
// ---------------------------------------------------------------------------
describe('resetFoalCareStreak', () => {
  it('sets daysGroomedInARow to 0', () => {
    const data = { taskLog: { brushing: 3 }, daysGroomedInARow: 5, lastGroomed: new Date() };
    const result = resetFoalCareStreak(data);
    expect(result.daysGroomedInARow).toBe(0);
  });

  it('preserves other fields', () => {
    const data = { taskLog: { brushing: 3 }, daysGroomedInARow: 5 };
    const result = resetFoalCareStreak(data);
    expect(result.taskLog.brushing).toBe(3);
  });

  it('does not mutate input', () => {
    const data = { daysGroomedInARow: 5 };
    resetFoalCareStreak(data);
    expect(data.daysGroomedInARow).toBe(5);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// getFoalCareSummary exact-value assertions (uniqueTasksCompleted, ordered
// completedTaskTypes, lastCareDate round-trip) not covered by the shape/total
// tests above.
describe('getFoalCareSummary — exact field values (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('reports exact totals, unique count, ordered task types, immunity, and lastCareDate', () => {
    const lastGroomed = new Date('2026-05-01T00:00:00.000Z');
    const foalData = {
      taskLog: { trust_building: 5, desensitization: 3, early_touch: 2 },
      lastGroomed,
      daysGroomedInARow: 8,
    };
    const summary = getFoalCareSummary(foalData);
    expect(summary.totalTaskCompletions).toBe(10);
    expect(summary.uniqueTasksCompleted).toBe(3);
    expect(summary.completedTaskTypes).toEqual(['trust_building', 'desensitization', 'early_touch']);
    expect(summary.consecutiveDaysOfCare).toBe(8);
    expect(summary.hasBurnoutImmunity).toBe(true);
    expect(summary.lastCareDate).toEqual(lastGroomed);
  });

  it('handles fully empty foal data (null taskLog, no immunity)', () => {
    const summary = getFoalCareSummary({ taskLog: null, lastGroomed: null, daysGroomedInARow: 0 });
    expect(summary.totalTaskCompletions).toBe(0);
    expect(summary.uniqueTasksCompleted).toBe(0);
    expect(summary.hasBurnoutImmunity).toBe(false);
  });
});
