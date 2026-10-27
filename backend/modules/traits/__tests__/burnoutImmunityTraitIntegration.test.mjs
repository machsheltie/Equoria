/**
 * Care Streak & Trait Integration Tests
 *
 * Tests the groomBondingSystem care-streak logic across complete foal workflows.
 *
 * Owner ruling 2026-10-23 (Equoria-0gl9o): there is no burnout. The "burnout
 * immunity" label (checkBurnoutImmunity, BURNOUT_STATUS, Horse.burnoutStatus)
 * is gone; the care streak and its 2-day grace period stay. (The file keeps
 * its historical name.)
 *
 * updateConsecutiveDays is a pure function — all assertions on it are fully
 * deterministic.
 *
 * No mocks of any kind.
 */

import { describe, it, expect } from '@jest/globals';
import { updateConsecutiveDays } from '../../../utils/groomBondingSystem.mjs';
// ─── helpers ─────────────────────────────────────────────────────────────────

function buildStreak(days) {
  let streak = 0;
  for (let i = 0; i < days; i++) {
    streak = updateConsecutiveDays(streak, true).newConsecutiveDays;
  }
  return streak;
}

// ─── Complete Foal Development Workflow ──────────────────────────────────────

describe('Complete Foal Development Workflow', () => {
  it('builds streak to 7', () => {
    expect(buildStreak(7)).toBe(7);
  });

  it('preserves streak within 2-day grace period and increments on resume', () => {
    const streak = buildStreak(7);

    const gracePeriodResult = updateConsecutiveDays(streak, false, 2);
    expect(gracePeriodResult.newConsecutiveDays).toBe(7);
    expect(gracePeriodResult.wasReset).toBe(false);

    const resumeResult = updateConsecutiveDays(gracePeriodResult.newConsecutiveDays, true);
    expect(resumeResult.newConsecutiveDays).toBe(8);
  });

  it('reaches streak 11 after 7-day build + 1 resume + 3 more days', () => {
    let streak = buildStreak(7);

    streak = updateConsecutiveDays(streak, false, 2).newConsecutiveDays; // grace → still 7
    streak = updateConsecutiveDays(streak, true).newConsecutiveDays; // resume → 8

    for (let i = 0; i < 3; i++) {
      streak = updateConsecutiveDays(streak, true).newConsecutiveDays;
    }

    expect(streak).toBe(11);
  });
});

// ─── Streak Loss and Recovery ─────────────────────────────────────────────────

describe('Streak Loss and Recovery', () => {
  it('builds streak to 6', () => {
    expect(buildStreak(6)).toBe(6);
  });

  it('3-day gap beyond grace period resets streak to 0', () => {
    const streak = buildStreak(6);

    const lossResult = updateConsecutiveDays(streak, false, 3);
    expect(lossResult.newConsecutiveDays).toBe(0);
    expect(lossResult.wasReset).toBe(true);
  });

  it('rebuilds to 8 after streak loss', () => {
    let streak = updateConsecutiveDays(buildStreak(6), false, 3).newConsecutiveDays;
    for (let i = 0; i < 8; i++) {
      streak = updateConsecutiveDays(streak, true).newConsecutiveDays;
    }
    expect(streak).toBe(8);
  });
});

// ─── Per-Horse Independent Tracking ──────────────────────────────────────────

describe('Per-Horse Independent Tracking', () => {
  it('tracks three horses with different care patterns independently', () => {
    const horseAStreak = buildStreak(10);

    let horseBStreak = 5;
    horseBStreak = updateConsecutiveDays(horseBStreak, false, 2).newConsecutiveDays;

    const horseCStreak = buildStreak(3);

    expect(horseAStreak).toBe(10);
    expect(horseBStreak).toBe(5);
    expect(horseCStreak).toBe(3);
  });
});

// ─── Grace Period Edge Cases ──────────────────────────────────────────────────

describe('Grace Period Edge Cases', () => {
  it('exactly 2-day gap preserves streak of 7 (boundary case)', () => {
    const gracePeriodResult = updateConsecutiveDays(7, false, 2);

    expect(gracePeriodResult.newConsecutiveDays).toBe(7);
    expect(gracePeriodResult.wasReset).toBe(false);
  });

  it('resume after 2-day gap increments streak to 8', () => {
    const streak = updateConsecutiveDays(7, true).newConsecutiveDays;

    expect(streak).toBe(8);
  });

  it('3-day gap resets streak of 8 to 0 (beyond grace period)', () => {
    const lossResult = updateConsecutiveDays(8, false, 3);

    expect(lossResult.newConsecutiveDays).toBe(0);
    expect(lossResult.wasReset).toBe(true);
  });

  it('first day of rebuild after reset sets streak to 1', () => {
    const rebuildResult = updateConsecutiveDays(0, true);

    expect(rebuildResult.newConsecutiveDays).toBe(1);
  });
});

// ─── Real-World Player Scenarios ─────────────────────────────────────────────

describe('Real-World Player Scenarios', () => {
  it('casual player: 2-day weekends lose streak after 5 weekdays (beyond grace period)', () => {
    const streak = buildStreak(2);
    expect(streak).toBe(2);

    const weekdayResult = updateConsecutiveDays(streak, false, 5);
    expect(weekdayResult.wasReset).toBe(true);
    expect(weekdayResult.newConsecutiveDays).toBe(0);
  });

  it('dedicated player: 14-day streak', () => {
    expect(buildStreak(14)).toBe(14);
  });
});
