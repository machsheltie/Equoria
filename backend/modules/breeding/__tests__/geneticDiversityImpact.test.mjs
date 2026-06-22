/**
 * genetics/geneticDiversityImpact.mjs — focused unit tests (Equoria-urqic.4)
 *
 * Pure in-memory calculations extracted from enhancedGeneticProbabilityService.
 * No DB, no mocks — these functions take plain objects and return numbers/arrays.
 * Asserts numeric output is identical to the pre-split facade behavior so the
 * 3 prod importers and the labs suites stay green.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateInbreedingCoefficient,
  calculateGeneticDiversityScore,
  calculateGeneticHealthScore,
  generateDiversityRecommendations,
  getRiskLevel,
  computeGeneticDiversityImpact,
  DIVERSITY_IMPACT_CONSTANTS,
} from '../services/genetics/geneticDiversityImpact.mjs';

const traits = (overrides = {}) => ({
  positive: [],
  negative: [],
  hidden: [],
  ...overrides,
});

const makeHorse = (overrides = {}) => ({
  id: 1,
  traits: traits(),
  sireId: null,
  damId: null,
  ...overrides,
});

describe('calculateInbreedingCoefficient', () => {
  it('returns 0 when lineage has fewer than 2 generations', () => {
    expect(calculateInbreedingCoefficient(makeHorse(), makeHorse(), [])).toBe(0);
    expect(calculateInbreedingCoefficient(makeHorse(), makeHorse(), { generations: [{ horses: [] }] })).toBe(0);
  });

  it('returns 0 when there are no shared ancestors across the lineage', () => {
    const stallion = makeHorse({ id: 1, sireId: 10, damId: 11 });
    const mare = makeHorse({ id: 2, sireId: 20, damId: 21 });
    // Two generations, but the per-generation horses are added to BOTH sets,
    // so the shared component comes only from generation horses. With distinct
    // parent IDs and empty generations the coefficient is 0.
    const lineage = { generations: [{ horses: [] }, { horses: [] }] };
    expect(calculateInbreedingCoefficient(stallion, mare, lineage)).toBe(0);
  });

  it('detects shared ancestors via lineage generation horses', () => {
    const stallion = makeHorse({ id: 1, sireId: 10, damId: 11 });
    const mare = makeHorse({ id: 2, sireId: 20, damId: 21 });
    // A horse appearing in a generation is added to both ancestor sets,
    // producing a non-zero coefficient.
    const lineage = {
      generations: [{ horses: [{ id: 100 }] }, { horses: [{ id: 101 }] }],
    };
    const coeff = calculateInbreedingCoefficient(stallion, mare, lineage);
    expect(coeff).toBeGreaterThan(0);
    expect(coeff).toBeLessThanOrEqual(1);
  });

  it('accepts a bare array lineage as well as the {generations} shape', () => {
    const stallion = makeHorse({ id: 1 });
    const mare = makeHorse({ id: 2 });
    const bareArray = [{ horses: [{ id: 100 }] }, { horses: [{ id: 101 }] }];
    expect(calculateInbreedingCoefficient(stallion, mare, bareArray)).toBeGreaterThan(0);
  });
});

describe('calculateGeneticDiversityScore', () => {
  it('returns a higher score when parents share no traits', () => {
    const stallion = makeHorse({ traits: traits({ positive: ['athletic', 'bold'] }) });
    const mare = makeHorse({ traits: traits({ positive: ['calm', 'focused'] }) });
    const score = calculateGeneticDiversityScore(stallion, mare, []);
    // All 4 traits unique, none shared → diversityRatio = 1 → round(1*80) = 80.
    expect(score).toBe(80);
  });

  it('returns a lower score when all parental traits are shared', () => {
    const shared = traits({ positive: ['athletic', 'bold'] });
    const score = calculateGeneticDiversityScore(
      makeHorse({ traits: { ...shared } }),
      makeHorse({ traits: { ...shared } }),
      [],
    );
    // uniqueTraits=2, shared=2 → ratio=0 → 0 + no lineage bonus = 0.
    expect(score).toBe(0);
  });

  it('adds a capped lineage diversity bonus', () => {
    const stallion = makeHorse({ traits: traits({ positive: ['a', 'b'] }) });
    const mare = makeHorse({ traits: traits({ positive: ['c', 'd'] }) });
    const lineage = {
      generations: [{ horses: [{ traits: traits({ positive: ['e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] }) }] }],
    };
    const score = calculateGeneticDiversityScore(stallion, mare, lineage);
    // ratio=1 → 80, lineageTraits=8 → bonus = min(20, 16) = 16 → 96.
    expect(score).toBe(96);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('tolerates malformed trait arrays without throwing', () => {
    const stallion = { traits: { positive: null, negative: undefined, hidden: 'oops' } };
    const mare = { traits: null };
    expect(() => calculateGeneticDiversityScore(stallion, mare, [])).not.toThrow();
  });
});

describe('calculateGeneticHealthScore', () => {
  it('boosts health for high diversity', () => {
    expect(calculateGeneticHealthScore(80, 0)).toBe(95); // 85 + 10
  });

  it('penalizes very low diversity', () => {
    expect(calculateGeneticHealthScore(20, 0)).toBe(70); // 85 - 15
  });

  it('penalizes inbreeding above the threshold', () => {
    // diversity 50 (neutral), inbreeding 0.5 (> 0.125) → 85 - 50 = 35.
    expect(calculateGeneticHealthScore(50, 0.5)).toBe(35);
  });

  it('does not penalize inbreeding at or below the threshold', () => {
    expect(calculateGeneticHealthScore(50, DIVERSITY_IMPACT_CONSTANTS.INBREEDING_THRESHOLD)).toBe(85);
  });

  it('clamps to the 0..100 range', () => {
    expect(calculateGeneticHealthScore(10, 1)).toBe(0);
  });
});

describe('generateDiversityRecommendations', () => {
  it('recommends outcrossing when inbreeding is high', () => {
    const recs = generateDiversityRecommendations(50, 0.3, 80);
    expect(recs).toContain('Consider outcrossing to improve genetic diversity');
  });

  it('recommends different partners when diversity is low', () => {
    const recs = generateDiversityRecommendations(30, 0, 80);
    expect(recs).toContain('Seek breeding partners with different trait profiles');
  });

  it('gives a confident green light for high diversity + low inbreeding', () => {
    const recs = generateDiversityRecommendations(85, 0.01, 95);
    expect(recs).toContain('Excellent genetic diversity - proceed with confidence');
  });

  it('returns an empty array when nothing is flagged', () => {
    expect(generateDiversityRecommendations(60, 0.05, 80)).toEqual([]);
  });
});

describe('getRiskLevel', () => {
  it('flags high risk', () => {
    expect(getRiskLevel(0.3, 90)).toBe('high');
    expect(getRiskLevel(0, 40)).toBe('high');
  });

  it('flags moderate risk', () => {
    expect(getRiskLevel(0.2, 90)).toBe('moderate');
    expect(getRiskLevel(0, 60)).toBe('moderate');
  });

  it('flags low risk', () => {
    expect(getRiskLevel(0.05, 90)).toBe('low');
  });
});

describe('computeGeneticDiversityImpact (composed entry point)', () => {
  it('returns the full report shape', () => {
    const stallion = makeHorse({ traits: traits({ positive: ['athletic'] }) });
    const mare = makeHorse({ traits: traits({ positive: ['calm'] }) });
    const result = computeGeneticDiversityImpact(stallion, mare, []);

    expect(result).toEqual(
      expect.objectContaining({
        diversityScore: expect.any(Number),
        inbreedingCoefficient: expect.any(Number),
        geneticHealthScore: expect.any(Number),
        diversityRecommendations: expect.any(Array),
        riskLevel: expect.stringMatching(/^(low|moderate|high)$/),
      }),
    );
  });

  it('is internally consistent: riskLevel matches the computed inputs', () => {
    const stallion = makeHorse({ id: 1, sireId: 10, damId: 11 });
    const mare = makeHorse({ id: 2, sireId: 10, damId: 11 }); // shared parents
    const lineage = {
      generations: [{ horses: [{ id: 10 }] }, { horses: [{ id: 11 }] }],
    };
    const result = computeGeneticDiversityImpact(stallion, mare, lineage);
    expect(result.riskLevel).toBe(getRiskLevel(result.inbreedingCoefficient, result.geneticHealthScore));
  });
});
