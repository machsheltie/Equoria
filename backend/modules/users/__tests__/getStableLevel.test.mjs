/**
 * getStableLevel boundary unit test (Equoria-oey96.8).
 *
 * Pins the ratified derivation getStableLevel(user) = clamp(ceil(level/4), 1, 5)
 * (docs/design/2026-07-07-game-balance-formulas.md §3). These ceil boundaries
 * are the pacing knob for the roster-cap curve — a regression here silently
 * shifts every stable-level breakpoint. Consumed via the users barrel by the
 * rider/trainer hire controllers.
 *
 * Pure function — imported through the users module barrel (cross-module
 * consumption contract), no DB needed.
 */

import { describe, it, expect } from '@jest/globals';
import { getStableLevel } from '../index.mjs';

describe('getStableLevel — ceil(level/4) clamped to [1,5] (Equoria-oey96.8)', () => {
  it.each([
    [1, 1],
    [4, 1], // ceil(4/4)=1 — top of SL1 band
    [5, 2], // ceil(5/4)=2 — first level of SL2 (the pinned boundary)
    [8, 2],
    [9, 3],
    [12, 3],
    [13, 4],
    [16, 4],
    [17, 5], // ceil(17/4)=5 — first level of SL5
    [100, 5], // clamp ceiling
    [999, 5],
  ])('User.level %i → stable level %i', (level, expected) => {
    expect(getStableLevel({ level })).toBe(expected);
  });

  it('defensively clamps missing / non-numeric / sub-1 levels to SL1 (most restrictive)', () => {
    expect(getStableLevel({})).toBe(1);
    expect(getStableLevel({ level: 0 })).toBe(1);
    expect(getStableLevel({ level: -5 })).toBe(1);
    expect(getStableLevel({ level: null })).toBe(1);
    expect(getStableLevel({ level: 'nonsense' })).toBe(1);
    expect(getStableLevel(undefined)).toBe(1);
    expect(getStableLevel(null)).toBe(1);
  });
});
