import { describe, it, expect } from '@jest/globals';
import {
  calculatePrizeDistribution,
  getRelevantStats,
  calculateStatGains,
  calculateEntryFees,
  hasValidRider,
} from '../../utils/competitionRewards.mjs';

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
