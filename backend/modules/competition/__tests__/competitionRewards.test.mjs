import { describe, it, expect } from '@jest/globals';
import {
  calculatePrizeDistribution,
  getRelevantStats,
  calculateStatGains,
  calculateEntryFees,
  hasValidRider,
} from '../../../utils/competitionRewards.mjs';

describe('calculatePrizeDistribution', () => {
  it('distributes 50/30/20 correctly for a round prize', () => {
    const dist = calculatePrizeDistribution(1000);
    expect(dist.first).toBe(500);
    expect(dist.second).toBe(300);
    expect(dist.third).toBe(200);
  });

  it('rounds results for fractional pools', () => {
    const dist = calculatePrizeDistribution(100);
    expect(dist.first).toBe(50);
    expect(dist.second).toBe(30);
    expect(dist.third).toBe(20);
  });

  it('returns 0 for each slot on zero prize pool', () => {
    const dist = calculatePrizeDistribution(0);
    expect(dist.first).toBe(0);
    expect(dist.second).toBe(0);
    expect(dist.third).toBe(0);
  });

  it('returns integer values (Math.round applied)', () => {
    const dist = calculatePrizeDistribution(333);
    expect(Number.isInteger(dist.first)).toBe(true);
    expect(Number.isInteger(dist.second)).toBe(true);
    expect(Number.isInteger(dist.third)).toBe(true);
  });
});

describe('getRelevantStats', () => {
  it('returns correct stats for Racing', () => {
    expect(getRelevantStats('Racing')).toEqual(['speed', 'stamina', 'focus']);
  });

  it('returns correct stats for Dressage', () => {
    expect(getRelevantStats('Dressage')).toEqual(['precision', 'focus', 'obedience']);
  });

  it('returns default Racing stats for unknown discipline', () => {
    expect(getRelevantStats('Unknown Discipline')).toEqual(['speed', 'stamina', 'focus']);
  });

  it('returns 3 stats for every known discipline', () => {
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
    for (const d of disciplines) {
      expect(getRelevantStats(d)).toHaveLength(3);
    }
  });
});

describe('calculateStatGains', () => {
  it('returns null or an object with stat and gain:1', () => {
    // Run many iterations — result is probabilistic (max 10% chance for 1st)
    let gotObject = false;
    for (let i = 0; i < 1000; i++) {
      const result = calculateStatGains('1st', 'Racing');
      if (result !== null) {
        expect(result).toHaveProperty('stat');
        expect(result).toHaveProperty('gain', 1);
        expect(['speed', 'stamina', 'focus']).toContain(result.stat);
        gotObject = true;
        break;
      }
    }
    // With 1000 tries at 10% probability: P(never null) = (0.9)^1000 ≈ 0. Should always fire.
    expect(gotObject).toBe(true);
  });

  it('always returns null for unknown placement', () => {
    for (let i = 0; i < 20; i++) {
      expect(calculateStatGains('4th', 'Racing')).toBeNull();
    }
  });

  it('stat is always from the relevant discipline stats when gain fires', () => {
    // Force a gain by looping; any non-null result must have a Dressage stat
    for (let i = 0; i < 1000; i++) {
      const result = calculateStatGains('1st', 'Dressage');
      if (result !== null) {
        expect(['precision', 'focus', 'obedience']).toContain(result.stat);
        break;
      }
    }
  });
});

describe('calculateEntryFees', () => {
  it('multiplies entryFee by numEntries', () => {
    expect(calculateEntryFees(50, 10)).toBe(500);
  });

  it('returns 0 when numEntries is 0', () => {
    expect(calculateEntryFees(100, 0)).toBe(0);
  });

  it('returns 0 when entryFee is 0', () => {
    expect(calculateEntryFees(0, 20)).toBe(0);
  });
});

describe('hasValidRider', () => {
  it('returns true when rider is an object', () => {
    expect(hasValidRider({ rider: { id: 1, name: 'Alice' } })).toBe(true);
  });

  it('returns false when rider is null', () => {
    expect(hasValidRider({ rider: null })).toBe(false);
  });

  it('returns false when rider is undefined', () => {
    expect(hasValidRider({ rider: undefined })).toBe(false);
  });

  it('returns false when rider is a string (not an object)', () => {
    expect(hasValidRider({ rider: 'Alice' })).toBe(false);
  });

  it('returns false when rider is a number', () => {
    expect(hasValidRider({ rider: 42 })).toBe(false);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Deterministic _rngFn-injected coverage of calculateStatGains (the module tests
// above only probe the probabilistic structure). Plus exhaustive discipline
// coverage and the empty-rider-object edge case not present above.
describe('competitionRewards — deterministic _rngFn & exhaustive coverage (merged from legacy backend/tests, Equoria-wvuin)', () => {
  const ALWAYS_GAIN = () => 0.0; // 0.0 <= any chance → stat gained; index 0 selected
  const NEVER_GAIN = () => 1.0; // 1.0 > any chance → null

  function seqRng(vals) {
    let i = 0;
    return () => vals[i++];
  }

  describe('getRelevantStats — every supported discipline', () => {
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
      const result = calculateStatGains('1st', 'Racing', seqRng([0.05, 0.0]));
      expect(result.stat).toBe('speed');
      expect(result.gain).toBe(1);
    });
    it('selects middle stat when second _rngFn call returns 0.5', () => {
      const result = calculateStatGains('1st', 'Racing', seqRng([0.05, 0.5]));
      expect(result.stat).toBe('stamina');
      expect(result.gain).toBe(1);
    });
    it('selects last stat when second _rngFn call returns 0.9', () => {
      const result = calculateStatGains('1st', 'Racing', seqRng([0.05, 0.9]));
      expect(result.stat).toBe('focus');
      expect(result.gain).toBe(1);
    });
    it('real Math.random produces correct structure over 50 runs when a gain occurs', () => {
      const validRacingStats = new Set(['speed', 'stamina', 'focus']);
      for (let i = 0; i < 50; i++) {
        const result = calculateStatGains('1st', 'Racing');
        if (result !== null) {
          expect(result.gain).toBe(1);
          expect(validRacingStats.has(result.stat)).toBe(true);
        }
      }
    });
  });

  describe('hasValidRider — empty object edge case', () => {
    it('returns true for a horse with an empty rider object', () => {
      expect(hasValidRider({ rider: {} })).toBe(true);
    });
  });
});
