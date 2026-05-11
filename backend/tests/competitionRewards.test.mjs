/**
 * Competition Rewards System Tests
 *
 * Tests calculatePrizeDistribution / getRelevantStats / calculateStatGains /
 * calculateEntryFees / hasValidRider against real function logic. No mocks of any kind.
 *
 * Controlled-randomness tests use the built-in `_rngFn` parameter of
 * calculateStatGains (3rd argument) instead of mocking Math.random.
 * This is the function's own injection point for deterministic testing.
 *
 * seqRng(vals) helper: returns a function that yields each value in sequence —
 * matches the two-call pattern inside calculateStatGains:
 *   call 1: _rngFn() > chance  (placement check)
 *   call 2: Math.floor(_rngFn() * relevantStats.length)  (stat selection)
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculatePrizeDistribution,
  getRelevantStats,
  calculateStatGains,
  calculateEntryFees,
  hasValidRider,
} from '../utils/competitionRewards.mjs';

// ─── helpers ─────────────────────────────────────────────────────────────────

const ALWAYS_GAIN = () => 0.0; // 0.0 <= any chance → stat gained; index 0 selected
const NEVER_GAIN = () => 1.0; // 1.0 > any chance → null

function seqRng(vals) {
  let i = 0;
  return () => vals[i++];
}

// ─── calculatePrizeDistribution ───────────────────────────────────────────────

describe('calculatePrizeDistribution', () => {
  it('calculates 50/30/20 split for a 1000 prize pool', () => {
    const d = calculatePrizeDistribution(1000);
    expect(d.first).toBe(500);
    expect(d.second).toBe(300);
    expect(d.third).toBe(200);
  });

  it('handles odd prize amounts with rounding', () => {
    const d = calculatePrizeDistribution(1001);
    expect(d.first).toBe(501);
    expect(d.second).toBe(300);
    expect(d.third).toBe(200);
  });

  it('handles small prize amounts', () => {
    const d = calculatePrizeDistribution(10);
    expect(d.first).toBe(5);
    expect(d.second).toBe(3);
    expect(d.third).toBe(2);
  });

  it('handles zero prize pool', () => {
    const d = calculatePrizeDistribution(0);
    expect(d.first).toBe(0);
    expect(d.second).toBe(0);
    expect(d.third).toBe(0);
  });
});

// ─── getRelevantStats ─────────────────────────────────────────────────────────

describe('getRelevantStats', () => {
  it('returns correct stats for Racing', () => {
    expect(getRelevantStats('Racing')).toEqual(['speed', 'stamina', 'focus']);
  });

  it('returns correct stats for Show Jumping', () => {
    expect(getRelevantStats('Show Jumping')).toEqual(['balance', 'agility', 'boldness']);
  });

  it('returns correct stats for Dressage', () => {
    expect(getRelevantStats('Dressage')).toEqual(['precision', 'focus', 'obedience']);
  });

  it('returns default Racing stats for unknown discipline', () => {
    expect(getRelevantStats('UnknownDiscipline')).toEqual(['speed', 'stamina', 'focus']);
  });

  it('returns an array of 3 strings for every supported discipline', () => {
    const disciplines = [
      'Racing',
      'Show Jumping',
      'Dressage',
      'Cross Country',
      'Hunter',
      'Barrel Racing',
      'Reining',
      'Cutting',
      'Trail',
      'Western Pleasure',
      'English Pleasure',
      'Driving',
    ];

    for (const discipline of disciplines) {
      const stats = getRelevantStats(discipline);
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBe(3);
      expect(stats.every(s => typeof s === 'string')).toBe(true);
    }
  });
});

// ─── calculateStatGains — deterministic via _rngFn ───────────────────────────

describe('calculateStatGains — deterministic via _rngFn injection', () => {
  it('returns null for null placement (no RNG call made)', () => {
    expect(calculateStatGains(null, 'Racing')).toBeNull();
  });

  it('returns null for invalid placement "4th" (no RNG call made)', () => {
    expect(calculateStatGains('4th', 'Racing')).toBeNull();
  });

  it('returns null for undefined placement (no RNG call made)', () => {
    expect(calculateStatGains(undefined, 'Racing')).toBeNull();
  });

  it('returns null when _rngFn produces a value above the 1st-place chance (NEVER_GAIN)', () => {
    expect(calculateStatGains('1st', 'Racing', NEVER_GAIN)).toBeNull();
  });

  it('returns null when _rngFn produces a value above the 2nd-place chance (NEVER_GAIN)', () => {
    expect(calculateStatGains('2nd', 'Show Jumping', NEVER_GAIN)).toBeNull();
  });

  it('returns null when _rngFn produces a value above the 3rd-place chance (NEVER_GAIN)', () => {
    expect(calculateStatGains('3rd', 'Dressage', NEVER_GAIN)).toBeNull();
  });

  it('grants a stat gain for 1st place when _rngFn passes the chance check', () => {
    const result = calculateStatGains('1st', 'Racing', ALWAYS_GAIN);

    expect(result).not.toBeNull();
    expect(result.gain).toBe(1);
    expect(['speed', 'stamina', 'focus']).toContain(result.stat);
  });

  it('grants a stat gain for 2nd place when _rngFn passes the chance check', () => {
    const result = calculateStatGains('2nd', 'Show Jumping', ALWAYS_GAIN);

    expect(result).not.toBeNull();
    expect(result.gain).toBe(1);
    expect(['balance', 'agility', 'boldness']).toContain(result.stat);
  });

  it('grants a stat gain for 3rd place when _rngFn passes the chance check', () => {
    const result = calculateStatGains('3rd', 'Dressage', ALWAYS_GAIN);

    expect(result).not.toBeNull();
    expect(result.gain).toBe(1);
    expect(['precision', 'focus', 'obedience']).toContain(result.stat);
  });

  it('selects first stat when second _rngFn call returns 0.0', () => {
    // call 1: 0.05 <= 0.10 (1st-place check passes), call 2: 0.0 → index 0 (speed)
    const result = calculateStatGains('1st', 'Racing', seqRng([0.05, 0.0]));

    expect(result.stat).toBe('speed');
    expect(result.gain).toBe(1);
  });

  it('selects middle stat when second _rngFn call returns 0.5', () => {
    // call 1: 0.05 passes, call 2: 0.5 → Math.floor(0.5 * 3) = 1 → stamina
    const result = calculateStatGains('1st', 'Racing', seqRng([0.05, 0.5]));

    expect(result.stat).toBe('stamina');
    expect(result.gain).toBe(1);
  });

  it('selects last stat when second _rngFn call returns 0.9', () => {
    // call 1: 0.05 passes, call 2: 0.9 → Math.floor(0.9 * 3) = 2 → focus
    const result = calculateStatGains('1st', 'Racing', seqRng([0.05, 0.9]));

    expect(result.stat).toBe('focus');
    expect(result.gain).toBe(1);
  });

  it('real Math.random produces correct structure over 50 runs when a gain occurs', () => {
    const validRacingStats = new Set(['speed', 'stamina', 'focus']);
    const gains = [];

    for (let i = 0; i < 50; i++) {
      const result = calculateStatGains('1st', 'Racing');
      if (result !== null) {
        gains.push(result);
      }
    }

    for (const g of gains) {
      expect(g.gain).toBe(1);
      expect(validRacingStats.has(g.stat)).toBe(true);
    }
  });
});

// ─── calculateEntryFees ───────────────────────────────────────────────────────

describe('calculateEntryFees', () => {
  it('calculates total entry fees correctly', () => {
    expect(calculateEntryFees(100, 5)).toBe(500);
  });

  it('handles zero entry fee', () => {
    expect(calculateEntryFees(0, 10)).toBe(0);
  });

  it('handles zero entries', () => {
    expect(calculateEntryFees(100, 0)).toBe(0);
  });

  it('handles large numbers', () => {
    expect(calculateEntryFees(250, 20)).toBe(5000);
  });
});

// ─── hasValidRider ────────────────────────────────────────────────────────────

describe('hasValidRider', () => {
  it('returns true for a horse with a valid rider object', () => {
    expect(hasValidRider({ rider: { name: 'John', skill: 85 } })).toBe(true);
  });

  it('returns true for a horse with an empty rider object', () => {
    expect(hasValidRider({ rider: {} })).toBe(true);
  });

  it('returns false for null rider', () => {
    expect(hasValidRider({ rider: null })).toBe(false);
  });

  it('returns false for undefined rider', () => {
    expect(hasValidRider({})).toBe(false);
  });

  it('returns false for string rider', () => {
    expect(hasValidRider({ rider: 'string-rider' })).toBe(false);
  });

  it('returns false for numeric rider', () => {
    expect(hasValidRider({ rider: 42 })).toBe(false);
  });
});
