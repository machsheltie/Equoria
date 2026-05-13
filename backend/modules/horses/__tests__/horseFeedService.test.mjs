import { describe, it, expect } from '@jest/globals';
import { rollStatBoost } from '../services/horseFeedService.mjs';

// Valid stat fields (must match what horseFeedService exports internally)
const VALID_STATS = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
];

// ─── rollStatBoost ────────────────────────────────────────────────────────────

describe('rollStatBoost — null cases', () => {
  it('returns null for unknown feed tier', () => {
    expect(rollStatBoost('nonexistent', Math.random)).toBeNull();
  });

  it('returns null for basic tier (statRollPct = 0)', () => {
    // basic tier always returns null regardless of rng
    expect(rollStatBoost('basic', () => 0.99)).toBeNull();
    expect(rollStatBoost('basic', () => 0)).toBeNull();
  });

  it('returns null when rng threshold check fails for performance tier', () => {
    // statRollPct = 10 → rng() * 100 must be < 10
    // rng() = 0.5 → 0.5 * 100 = 50 ≥ 10 → no boost
    expect(rollStatBoost('performance', () => 0.5)).toBeNull();
  });

  it('returns null when rng threshold check fails for elite tier', () => {
    // statRollPct = 25 → rng() * 100 must be < 25
    // rng() = 0.5 → 50 ≥ 25 → no boost
    expect(rollStatBoost('elite', () => 0.5)).toBeNull();
  });

  it('returns null for undefined feed tier', () => {
    expect(rollStatBoost(undefined, Math.random)).toBeNull();
  });

  it('returns null for null feed tier', () => {
    expect(rollStatBoost(null, Math.random)).toBeNull();
  });
});

describe('rollStatBoost — successful boost', () => {
  // rng sequence: first call (threshold check) returns 0.05 (< 0.10 for performance)
  // second call (stat selection) returns 0 → picks first stat
  function makeRng(values) {
    let idx = 0;
    return () => values[idx++ % values.length];
  }

  it('returns { stat, amount } when rng passes threshold for performance', () => {
    // performance statRollPct = 10, so rng() * 100 < 10 → rng() < 0.1
    const rng = makeRng([0.05, 0]); // 0.05*100=5 < 10 → boost; 0 → first stat
    const result = rollStatBoost('performance', rng);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('stat');
    expect(result).toHaveProperty('amount', 1);
    expect(VALID_STATS).toContain(result.stat);
  });

  it('returns { stat, amount } when rng passes threshold for performancePlus', () => {
    // performancePlus statRollPct = 15 → rng() < 0.15
    const rng = makeRng([0.1, 0]);
    const result = rollStatBoost('performancePlus', rng);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(1);
    expect(VALID_STATS).toContain(result.stat);
  });

  it('returns { stat, amount } when rng passes threshold for highPerformance', () => {
    // highPerformance statRollPct = 20 → rng() < 0.20
    const rng = makeRng([0.15, 0]);
    const result = rollStatBoost('highPerformance', rng);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(1);
    expect(VALID_STATS).toContain(result.stat);
  });

  it('returns { stat, amount } when rng passes threshold for elite', () => {
    // elite statRollPct = 25 → rng() < 0.25
    const rng = makeRng([0.2, 0]);
    const result = rollStatBoost('elite', rng);
    expect(result).not.toBeNull();
    expect(result.amount).toBe(1);
    expect(VALID_STATS).toContain(result.stat);
  });

  it('stat selection maps second rng value to a valid stat', () => {
    // Test each stat index with a fixed rng sequence
    for (let statIdx = 0; statIdx < VALID_STATS.length; statIdx++) {
      const rng = makeRng([0.0, statIdx / VALID_STATS.length]);
      const result = rollStatBoost('elite', rng);
      expect(result).not.toBeNull();
      expect(VALID_STATS).toContain(result.stat);
    }
  });

  it('amount is always 1 on successful boost', () => {
    const rng = makeRng([0.0, 0.5]);
    const result = rollStatBoost('elite', rng);
    expect(result.amount).toBe(1);
  });
});

describe('rollStatBoost — boundary conditions', () => {
  it('rng() exactly at threshold boundary for performance (= 0.1) → no boost', () => {
    // rng() * 100 = 0.1 * 100 = 10 ≥ 10 (statRollPct) → no boost
    expect(rollStatBoost('performance', () => 0.1)).toBeNull();
  });

  it('rng() just below threshold for performance (0.09999) → boost', () => {
    const rng = (() => {
      let calls = 0;
      return () => (calls++ === 0 ? 0.09999 : 0);
    })();
    const result = rollStatBoost('performance', rng);
    expect(result).not.toBeNull();
  });
});
