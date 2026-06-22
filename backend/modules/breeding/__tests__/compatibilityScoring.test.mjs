/**
 * genetics/compatibilityScoring.mjs — focused unit tests (Equoria-urqic.4.4)
 *
 * Pure in-memory calculations extracted from enhancedGeneticProbabilityService.
 * No DB, no mocks — these functions take plain objects and return numbers/objects.
 * Asserts numeric output is identical to the pre-split facade behavior so the
 * 2 prod importers (breeding/index barrel + advancedBreedingGeneticsRoutes) and
 * the labs/tests-unit suites stay green.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateTraitCompatibility,
  calculateStatCompatibility,
  calculateDisciplineCompatibility,
  calculateBasicDiversityScore,
  computeGeneticCompatibilityScore,
} from '../services/genetics/compatibilityScoring.mjs';

const traits = (overrides = {}) => ({
  positive: [],
  negative: [],
  hidden: [],
  ...overrides,
});

const makeHorse = (overrides = {}) => ({
  id: 1,
  traits: traits(),
  stats: {},
  disciplineScores: {},
  ...overrides,
});

describe('calculateTraitCompatibility', () => {
  it('returns the neutral baseline of 50 when parents share no traits and have no conflicts', () => {
    const result = calculateTraitCompatibility(
      makeHorse({ traits: traits({ positive: ['athletic'] }) }),
      makeHorse({ traits: traits({ positive: ['calm'] }) }),
    );
    expect(result.score).toBe(50);
    expect(result.sharedPositiveTraits).toEqual([]);
    expect(result.conflicts).toEqual([]);
    // score === 50 is NOT > 50, so the level is 'poor' (matches the original
    // facade behavior — the threshold is strict `score > 50`).
    expect(result.compatibilityLevel).toBe('poor');
  });

  it('adds 8 per shared positive trait', () => {
    const result = calculateTraitCompatibility(
      makeHorse({ traits: traits({ positive: ['athletic', 'bold'] }) }),
      makeHorse({ traits: traits({ positive: ['athletic', 'bold'] }) }),
    );
    // 50 + 2*8 = 66.
    expect(result.score).toBe(66);
    expect(result.sharedPositiveTraits).toEqual(['athletic', 'bold']);
    expect(result.compatibilityLevel).toBe('good');
  });

  it('subtracts 15 per positive/negative conflict (both directions counted)', () => {
    const result = calculateTraitCompatibility(
      makeHorse({ traits: traits({ positive: ['nervous'], negative: ['lazy'] }) }),
      makeHorse({ traits: traits({ positive: ['lazy'], negative: ['nervous'] }) }),
    );
    // stallion.positive 'nervous' in mare.negative → 1 conflict.
    // mare.positive 'lazy' in stallion.negative → 1 conflict. Total 2 → 50 - 30 = 20.
    expect(result.conflicts).toHaveLength(2);
    expect(result.score).toBe(20);
    expect(result.compatibilityLevel).toBe('poor');
  });

  it('flags excellent for high shared-positive count', () => {
    const shared = traits({ positive: ['a', 'b', 'c', 'd'] });
    const result = calculateTraitCompatibility(
      makeHorse({ traits: { ...shared } }),
      makeHorse({ traits: { ...shared } }),
    );
    // 50 + 4*8 = 82 > 75.
    expect(result.score).toBe(82);
    expect(result.compatibilityLevel).toBe('excellent');
  });

  it('clamps the score into 0..100', () => {
    // Many conflicts would drive below 0.
    const result = calculateTraitCompatibility(
      makeHorse({ traits: traits({ positive: ['a', 'b', 'c', 'd', 'e'], negative: ['a', 'b', 'c', 'd', 'e'] }) }),
      makeHorse({ traits: traits({ positive: ['a', 'b', 'c', 'd', 'e'], negative: ['a', 'b', 'c', 'd', 'e'] }) }),
    );
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('tolerates missing traits objects by defaulting to empty arrays', () => {
    const result = calculateTraitCompatibility({ traits: null }, { traits: null });
    expect(result.score).toBe(50);
  });
});

describe('calculateStatCompatibility', () => {
  it('returns the default balanceScore of 50 with no stats', () => {
    expect(calculateStatCompatibility({}, {})).toEqual({ balanceScore: 50, complementaryStats: [] });
  });

  it('scores similar stats (difference < 10) at 70', () => {
    expect(calculateStatCompatibility({ speed: 50 }, { speed: 55 })).toEqual({
      balanceScore: 70,
      complementaryStats: [],
    });
  });

  it('scores complementary stats (10 <= difference < 25) at 85 and records them', () => {
    const result = calculateStatCompatibility({ speed: 50 }, { speed: 70 });
    expect(result.balanceScore).toBe(85);
    expect(result.complementaryStats).toEqual([{ stat: 'speed', stallionValue: 50, mareValue: 70 }]);
  });

  it('scores extreme differences (>= 25) at 40', () => {
    expect(calculateStatCompatibility({ speed: 10 }, { speed: 90 }).balanceScore).toBe(40);
  });

  it('preserves a legitimate 0 stat (uses ?? not ||) rather than boosting to 50 (Equoria-cdgwd)', () => {
    // mare.speed = 0 (undeveloped). difference = |50 - 0| = 50 >= 25 → 40.
    // If `|| 50` were used, mareValue would become 50, difference 0 → 70.
    expect(calculateStatCompatibility({ speed: 50 }, { speed: 0 }).balanceScore).toBe(40);
  });

  it('coerces genuinely non-numeric stat values to 50', () => {
    // stallion.speed non-numeric → 50; mare.speed 50 → difference 0 → 70.
    expect(calculateStatCompatibility({ speed: 'fast' }, { speed: 50 }).balanceScore).toBe(70);
  });
});

describe('calculateDisciplineCompatibility', () => {
  it('returns 50 when neither parent has discipline scores', () => {
    expect(calculateDisciplineCompatibility(makeHorse(), makeHorse())).toBe(50);
  });

  it('averages discipline scores across disciplines with any score', () => {
    const stallion = makeHorse({ disciplineScores: { Dressage: 80, Racing: 0 } });
    const mare = makeHorse({ disciplineScores: { Dressage: 60 } });
    // Dressage: avg(80,60)=70 counted. Racing 0/absent → not counted. → round(70/1)=70.
    expect(calculateDisciplineCompatibility(stallion, mare)).toBe(70);
  });

  it('returns 50 when all present discipline scores are zero', () => {
    const stallion = makeHorse({ disciplineScores: { Dressage: 0 } });
    const mare = makeHorse({ disciplineScores: { Dressage: 0 } });
    expect(calculateDisciplineCompatibility(stallion, mare)).toBe(50);
  });
});

describe('calculateBasicDiversityScore', () => {
  it('returns 100 when parents share no traits', () => {
    const stallion = makeHorse({ traits: traits({ positive: ['athletic', 'bold'] }) });
    const mare = makeHorse({ traits: traits({ positive: ['calm', 'focused'] }) });
    // 4 unique, 0 shared → ratio 1 → 100.
    expect(calculateBasicDiversityScore(stallion, mare)).toBe(100);
  });

  it('returns 0 when all parental traits are shared', () => {
    const shared = traits({ positive: ['athletic', 'bold'] });
    expect(
      calculateBasicDiversityScore(makeHorse({ traits: { ...shared } }), makeHorse({ traits: { ...shared } })),
    ).toBe(0);
  });

  it('returns a partial ratio for partial overlap', () => {
    const stallion = makeHorse({ traits: traits({ positive: ['a', 'b'] }) });
    const mare = makeHorse({ traits: traits({ positive: ['b', 'c'] }) });
    // unique = {a,b,c} = 3; shared (from stallionAllTraits filtered) = ['b'] = 1.
    // ratio = (3-1)/3 = 0.6667 → round(66.67) = 67.
    expect(calculateBasicDiversityScore(stallion, mare)).toBe(67);
  });
});

describe('computeGeneticCompatibilityScore (composed entry point)', () => {
  it('returns the full report shape with a weighted overallScore', () => {
    const stallion = makeHorse({
      traits: traits({ positive: ['athletic'] }),
      stats: { speed: 50 },
      disciplineScores: { Dressage: 80 },
    });
    const mare = makeHorse({
      traits: traits({ positive: ['calm'] }),
      stats: { speed: 55 },
      disciplineScores: { Dressage: 60 },
    });
    const result = computeGeneticCompatibilityScore(stallion, mare);

    expect(result).toEqual(
      expect.objectContaining({
        overallScore: expect.any(Number),
        traitCompatibility: expect.objectContaining({ score: expect.any(Number) }),
        statCompatibility: expect.objectContaining({
          balanceScore: expect.any(Number),
          complementaryStats: expect.any(Array),
        }),
        disciplineCompatibility: expect.any(Number),
        diversityScore: expect.any(Number),
      }),
    );
  });

  it('computes the exact weighted aggregate (trait .3 / stat .25 / discipline .25 / diversity .2)', () => {
    const stallion = makeHorse({
      traits: traits({ positive: ['athletic'] }),
      stats: { speed: 50 },
      disciplineScores: { Dressage: 80 },
    });
    const mare = makeHorse({
      traits: traits({ positive: ['calm'] }),
      stats: { speed: 55 },
      disciplineScores: { Dressage: 60 },
    });
    // trait: no shared, no conflict → 50.
    // stat: speed diff 5 < 10 → 70.
    // discipline: avg(80,60) = 70.
    // diversity: athletic vs calm, no overlap → 100.
    // overall = round(50*.3 + 70*.25 + 70*.25 + 100*.2) = round(15 + 17.5 + 17.5 + 20) = 70.
    const result = computeGeneticCompatibilityScore(stallion, mare);
    expect(result.traitCompatibility.score).toBe(50);
    expect(result.statCompatibility.balanceScore).toBe(70);
    expect(result.disciplineCompatibility).toBe(70);
    expect(result.diversityScore).toBe(100);
    expect(result.overallScore).toBe(70);
  });

  it('falls back to the all-defaults aggregate for two empty horses', () => {
    // trait 50, stat 50 (no stats), discipline 50 (no scores), diversity 0 (no traits → ratio 0).
    // overall = round(50*.3 + 50*.25 + 50*.25 + 0*.2) = round(15 + 12.5 + 12.5 + 0) = 40.
    const result = computeGeneticCompatibilityScore(makeHorse(), makeHorse());
    expect(result.overallScore).toBe(40);
  });
});
