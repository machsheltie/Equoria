/**
 * Integration test (Equoria-yzqhj.6): behavioral epigenetic FLAGS modulate the
 * rider's effective bonus/penalty in the LIVE simulateCompetition engine.
 *
 * simulateCompetition is a pure function over horse objects, so these tests run
 * directly against it (no DB needed — no mocks of DB/services). Luck (±9%) is
 * pinned via Math.random so the rider-compat delta is the only varying term.
 *
 * Sentinel-isolation from yzqhj.1: simulateCompetition does NOT call
 * applyFlagInfluencesToCompetition (that is competitionScore.mjs's engine).
 * Within simulateCompetition, `epigeneticFlags` ONLY influences score via the
 * .6 rider-compat path. `epigeneticModifiers` (used by trait-impact / stress)
 * is held EMPTY and `stress_level` is 0 in every fixture below, so any score
 * difference between an identical-but-for-flags pair is attributable solely to
 * the rider-compat modifier — not to the base-score flag path.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { simulateCompetition } from '../../../logic/simulateCompetition.mjs';

function makeHorse(overrides = {}) {
  return {
    id: 1,
    name: 'TestHorse',
    speed: 70,
    stamina: 70,
    agility: 70,
    precision: 60,
    strength: 60,
    endurance: 60,
    intelligence: 60,
    boldness: 60,
    flexibility: 60,
    obedience: 60,
    focus: 60,
    balance: 60,
    health: 'Good',
    trait: null,
    trainingScore: 0,
    tack: {},
    // Rider present with a flat bonus BELOW the 10% cap so the compat factor
    // has headroom in both directions (a maxed 0.10 bonus would clamp the
    // positive boost away — see riderBonus.mjs BONUS_CAP).
    rider: { bonusPercent: 0.05, penaltyPercent: 0 },
    // Held EMPTY so the only flag-derived score change is via the rider path.
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
    epigeneticFlags: [],
    stress_level: 0,
    ...overrides,
  };
}

const SHOW = { id: 1, name: 'Test Show', discipline: 'Racing', showType: 'ridden' };

describe('simulateCompetition — rider flag-compatibility (Equoria-yzqhj.6)', () => {
  beforeEach(() => {
    // Pin luck to its midpoint (random=0.5 → luckModifier 0) so scores are
    // deterministic and the only difference between fixtures is rider-compat.
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('positive-flag horse scores HIGHER than identical no-flag horse (increased rider bonus)', () => {
    const [noFlag] = simulateCompetition([makeHorse({ epigeneticFlags: [] })], SHOW);
    const [positive] = simulateCompetition([makeHorse({ epigeneticFlags: ['brave', 'confident'] })], SHOW);

    expect(positive.score).toBeGreaterThan(noFlag.score);
  });

  it('negative-flag horse scores LOWER than identical no-flag horse (reduced rider bonus)', () => {
    const [noFlag] = simulateCompetition([makeHorse({ epigeneticFlags: [] })], SHOW);
    const [negative] = simulateCompetition([makeHorse({ epigeneticFlags: ['fearful', 'insecure'] })], SHOW);

    expect(negative.score).toBeLessThan(noFlag.score);
  });

  it('no-rider horse is UNAFFECTED by flags (modifier does not apply)', () => {
    const base = { rider: null };
    const [noFlag] = simulateCompetition([makeHorse({ ...base, epigeneticFlags: [] })], SHOW);
    const [positive] = simulateCompetition(
      [makeHorse({ ...base, epigeneticFlags: ['brave', 'confident', 'resilient'] })],
      SHOW,
    );

    // Identical score: with no rider, riderBonusPercent stays 0 and the compat
    // factor multiplies 0 → no change. Regression-safe.
    expect(positive.score).toBe(noFlag.score);
  });

  it('SENTINEL: the delta is the rider-portion delta, not the .1 base path', () => {
    // Manually reconstruct the expected scores WITHOUT any base-score flag
    // modifier. If a base-score flag path were sneaking in, these exact-equality
    // assertions would fail.
    //
    // Racing stats = [speed, stamina, focus]; subtotal = 70*0.5 + 70*0.3 +
    // 60*0.2 = 68. + 0(legacy/affinity) + 0(training) + 0(tack) = 68.
    // health 'Good' modifier = 0; luck pinned to 0; base rider bonus = 0.05.
    const SUBTOTAL = 68;

    // simulateCompetition rounds the final score to 1 decimal place
    // (Math.round(finalScore * 10) / 10), so compare against the rounded value.
    const round1 = n => Math.round(n * 10) / 10;

    const [noFlag] = simulateCompetition([makeHorse({ epigeneticFlags: [] })], SHOW);
    // no-flag: rider bonus stays 0.05 → 68 * 1.05 = 71.4
    expect(noFlag.score).toBe(round1(SUBTOTAL * (1 + 0.05)));

    const [positive] = simulateCompetition([makeHorse({ epigeneticFlags: ['brave', 'confident'] })], SHOW);
    // +2 net valence → factor 1.04 → bonus 0.05*1.04 = 0.052 → 68 * 1.052 = 71.536 → 71.5
    expect(positive.score).toBe(round1(SUBTOTAL * (1 + 0.05 * 1.04)));

    const [negative] = simulateCompetition([makeHorse({ epigeneticFlags: ['fearful'] })], SHOW);
    // -1 net valence → factor 0.98 → bonus 0.05*0.98 = 0.049 → 68 * 1.049 = 71.332 → 71.3
    expect(negative.score).toBe(round1(SUBTOTAL * (1 + 0.05 * 0.98)));
  });

  it('penalty-only rider: positive flags REDUCE the penalty (better outcome)', () => {
    const penaltyRider = { rider: { bonusPercent: 0, penaltyPercent: 0.08 } };
    const [noFlag] = simulateCompetition([makeHorse({ ...penaltyRider, epigeneticFlags: [] })], SHOW);
    const [positive] = simulateCompetition(
      [makeHorse({ ...penaltyRider, epigeneticFlags: ['brave', 'confident'] })],
      SHOW,
    );

    // factor 1.04 → penalty scales by (2 - 1.04) = 0.96 → 0.08*0.96 = 0.0768 → less penalty → higher score
    expect(positive.score).toBeGreaterThan(noFlag.score);
  });
});
