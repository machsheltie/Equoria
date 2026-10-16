/**
 * Pure-function unit tests for getCurrentWeekStart
 *
 * Tests the exported helper that returns the most recent Sunday at 00:00:00.000
 * on the game clock. Owner ruling 2026-10-09: the game runs on Eastern time
 * (America/New_York, with daylight saving), so the weekly reward resets at
 * midnight Eastern every Sunday. (Old contract: midnight UTC.)
 *
 * No mocking — the real function is called directly; all assertions are
 * invariant with respect to the actual day of week the suite runs. The Eastern
 * reading below is an independent Intl oracle, not the code under test.
 */

import { describe, it, expect } from '@jest/globals';
import { getCurrentWeekStart } from '../controllers/bankController.mjs';

const easternFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/** Eastern wall-clock reading of an instant. */
function eastern(date) {
  const p = Object.fromEntries(easternFormatter.formatToParts(date).map(x => [x.type, x.value]));
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday,
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

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

  it('returns a Sunday on the Eastern calendar', () => {
    const result = getCurrentWeekStart();
    expect(eastern(result).weekday).toBe('Sun');
  });

  it('returns midnight Eastern — hours are 0', () => {
    const result = getCurrentWeekStart();
    expect(eastern(result).hour).toBe(0);
  });

  it('returns midnight Eastern — minutes are 0', () => {
    const result = getCurrentWeekStart();
    expect(eastern(result).minute).toBe(0);
  });

  it('returns midnight Eastern — seconds are 0', () => {
    const result = getCurrentWeekStart();
    expect(eastern(result).second).toBe(0);
  });

  it('returns midnight Eastern — milliseconds are 0', () => {
    const result = getCurrentWeekStart();
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it('result is always <= now (never in the future)', () => {
    const before = Date.now();
    const result = getCurrentWeekStart();
    expect(result.getTime()).toBeLessThanOrEqual(before);
  });

  it('result is always within the last 7 days', () => {
    const now = Date.now();
    const result = getCurrentWeekStart();
    const diffMs = now - result.getTime();
    // A week that contains the autumn daylight-saving change is 7 days + 1 hour.
    const sevenDaysPlusDstHourMs = (7 * 24 + 1) * 60 * 60 * 1000;
    expect(diffMs).toBeGreaterThanOrEqual(0);
    expect(diffMs).toBeLessThan(sevenDaysPlusDstHourMs);
  });

  it('calling twice in rapid succession returns equal timestamps', () => {
    const first = getCurrentWeekStart();
    const second = getCurrentWeekStart();
    // Both calls resolve to the same Sunday — deterministic within the same week
    expect(first.getTime()).toBe(second.getTime());
  });

  it('when called on an Eastern Sunday the returned date is today, Eastern', () => {
    const now = new Date();
    const result = getCurrentWeekStart();

    if (eastern(now).weekday === 'Sun') {
      // Today IS Sunday in Eastern time — the function must return today, not last Sunday
      expect(eastern(result).dateKey).toBe(eastern(now).dateKey);
    } else {
      // Not Sunday — result must be a different (earlier) Eastern date
      expect(eastern(result).dateKey).not.toBe(eastern(now).dateKey);
      expect(result.getTime()).toBeLessThan(now.getTime());
    }
  });
});
