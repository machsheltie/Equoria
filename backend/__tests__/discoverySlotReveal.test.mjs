/**
 * discoverySlotReveal.test.mjs — pure-function cadence sentinel (Equoria-oey96.25)
 *
 * Locks the rider/trainer discovery reveal cadence so the level-10 cap always
 * reveals all 6 slots (the prior floor(level/2) formula stalled at 5). No DB,
 * no mocks — this is deterministic arithmetic over the shared helper both
 * discovery controllers import.
 */

import { describe, it, expect } from '@jest/globals';
import {
  DISCOVERY_REVEAL_LEVEL_THRESHOLDS,
  TOTAL_DISCOVERY_SLOTS,
  getRevealedDiscoveryCount,
  getNextDiscoveryRevealLevel,
} from '../utils/discoverySlotReveal.mjs';

describe('discoverySlotReveal — reveal cadence (Equoria-oey96.25)', () => {
  it('exposes 6 total slots via a 6-entry stepped threshold table', () => {
    expect(TOTAL_DISCOVERY_SLOTS).toBe(6);
    expect(DISCOVERY_REVEAL_LEVEL_THRESHOLDS).toEqual([2, 4, 6, 8, 9, 10]);
  });

  it('reveals all 6 slots at the level-10 cap (the whole point of the fix)', () => {
    // Regression guard: floor(10/2)=5 left the 6th slot permanently hidden.
    expect(getRevealedDiscoveryCount(10)).toBe(6);
  });

  it('reveals 0 slots for a rookie/novice at level 1', () => {
    expect(getRevealedDiscoveryCount(1)).toBe(0);
  });

  it('follows the exact stepped cadence L1..L10', () => {
    const expected = {
      1: 0,
      2: 1,
      3: 1,
      4: 2,
      5: 2,
      6: 3,
      7: 3,
      8: 4,
      9: 5,
      10: 6,
    };
    for (const [level, count] of Object.entries(expected)) {
      expect(getRevealedDiscoveryCount(Number(level))).toBe(count);
    }
  });

  it('is monotonic and never exceeds 6 even beyond the level cap', () => {
    let prev = -1;
    for (let level = 0; level <= 15; level += 1) {
      const count = getRevealedDiscoveryCount(level);
      expect(count).toBeGreaterThanOrEqual(prev); // never decreases
      expect(count).toBeLessThanOrEqual(TOTAL_DISCOVERY_SLOTS); // capped at 6
      prev = count;
    }
  });

  it('defensively returns 0 for non-numeric / non-finite / sub-1 levels', () => {
    expect(getRevealedDiscoveryCount(0)).toBe(0);
    expect(getRevealedDiscoveryCount(-3)).toBe(0);
    expect(getRevealedDiscoveryCount(NaN)).toBe(0);
    expect(getRevealedDiscoveryCount(Infinity)).toBe(0); // non-finite → guarded to 0
    expect(getRevealedDiscoveryCount('10')).toBe(0); // non-numeric → guarded to 0
    expect(getRevealedDiscoveryCount(undefined)).toBe(0);
    expect(getRevealedDiscoveryCount(null)).toBe(0);
  });

  describe('getNextDiscoveryRevealLevel', () => {
    it('returns the threshold of the next unrevealed slot', () => {
      expect(getNextDiscoveryRevealLevel(0)).toBe(2); // next slot at level 2
      expect(getNextDiscoveryRevealLevel(1)).toBe(4);
      expect(getNextDiscoveryRevealLevel(4)).toBe(9);
      expect(getNextDiscoveryRevealLevel(5)).toBe(10); // the previously-unreachable 6th slot
    });

    it('returns null once all slots are revealed', () => {
      expect(getNextDiscoveryRevealLevel(6)).toBeNull();
      expect(getNextDiscoveryRevealLevel(7)).toBeNull();
    });
  });
});
