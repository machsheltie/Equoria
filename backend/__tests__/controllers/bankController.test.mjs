/**
 * Pure-function unit tests for getCurrentWeekStart
 *
 * Tests the exported helper that returns the most recent Sunday at 00:00:00.000 UTC.
 * No mocking — the real function is called directly; all assertions are
 * invariant with respect to the actual day of week the suite runs.
 */

import { describe, it, expect } from '@jest/globals';
import { getCurrentWeekStart } from '../../modules/services/controllers/bankController.mjs';

// ─── getCurrentWeekStart ──────────────────────────────────────────────────────

describe('getCurrentWeekStart', () => {
  it('returns a Date object', () => {
    const result = getCurrentWeekStart();
    expect(result).toBeInstanceOf(Date);
  });

  it('returns a valid Date (not NaN)', () => {
    const result = getCurrentWeekStart();
    expect(Number.isNaN(result.getTime())).toBe(false);
  });

  it('returns a Sunday (getUTCDay() === 0)', () => {
    const result = getCurrentWeekStart();
    expect(result.getUTCDay()).toBe(0);
  });

  it('returns midnight UTC — hours are 0', () => {
    const result = getCurrentWeekStart();
    expect(result.getUTCHours()).toBe(0);
  });

  it('returns midnight UTC — minutes are 0', () => {
    const result = getCurrentWeekStart();
    expect(result.getUTCMinutes()).toBe(0);
  });

  it('returns midnight UTC — seconds are 0', () => {
    const result = getCurrentWeekStart();
    expect(result.getUTCSeconds()).toBe(0);
  });

  it('returns midnight UTC — milliseconds are 0', () => {
    const result = getCurrentWeekStart();
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it('result is always <= now (never in the future)', () => {
    const before = Date.now();
    const result = getCurrentWeekStart();
    // Allow a 1 ms tolerance for the instant between the two Date.now() calls
    expect(result.getTime()).toBeLessThanOrEqual(before);
  });

  it('result is always within the last 7 days', () => {
    const now = Date.now();
    const result = getCurrentWeekStart();
    const diffMs = now - result.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(diffMs).toBeGreaterThanOrEqual(0);
    expect(diffMs).toBeLessThan(sevenDaysMs);
  });

  it('calling twice in rapid succession returns equal timestamps', () => {
    const first = getCurrentWeekStart();
    const second = getCurrentWeekStart();
    // Both calls resolve to the same Sunday — deterministic within the same week
    expect(first.getTime()).toBe(second.getTime());
  });

  it('when called on a Sunday the returned date equals today at UTC midnight', () => {
    const now = new Date();
    const result = getCurrentWeekStart();

    if (now.getUTCDay() === 0) {
      // Today IS Sunday — the function must return today, not last Sunday
      expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
      expect(result.getUTCMonth()).toBe(now.getUTCMonth());
      expect(result.getUTCDate()).toBe(now.getUTCDate());
    } else {
      // Not Sunday — result must be strictly in the past
      const todayMidnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
      expect(result.getTime()).toBeLessThan(todayMidnightUTC);
    }
  });

  it('UTC day of result is always 0 regardless of local timezone', () => {
    // Redundant by design — isolates the UTC-day invariant from the
    // "is a Sunday" test so regressions are easier to pinpoint
    const result = getCurrentWeekStart();
    expect(result.getUTCDay()).toBe(0);
  });
});
