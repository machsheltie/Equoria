/**
 * genetics/multiGenerationalPredictions.mjs — focused unit tests (Equoria-urqic.4.2)
 *
 * Pure in-memory calculations extracted from enhancedGeneticProbabilityService.
 * No DB, no mocks — these functions take plain lineage.generations[].horses[]
 * objects and return numbers/arrays. Asserts numeric output is identical to the
 * pre-split facade behavior so the 3 prod importers and the labs/tests-unit
 * importer suites stay green.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateGenerationTraitInfluence,
  analyzeLineagePatterns,
  computeMultiGenerationalPredictions,
  MULTI_GEN_CONSTANTS,
} from '../services/genetics/multiGenerationalPredictions.mjs';

const traits = (overrides = {}) => ({
  positive: [],
  negative: [],
  hidden: [],
  ...overrides,
});

const horse = (overrides = {}) => ({ traits: traits(), ...overrides });

describe('MULTI_GEN_CONSTANTS', () => {
  it('preserves the facade GENERATION_WEIGHT_DECAY value (0.5)', () => {
    // The geometric decay factor must stay identical to the pre-split facade
    // constant so generation weights do not drift.
    expect(MULTI_GEN_CONSTANTS.GENERATION_WEIGHT_DECAY).toBe(0.5);
  });
});

describe('calculateGenerationTraitInfluence', () => {
  it('counts every trait at the given weight across all categories', () => {
    const horses = [
      horse({ traits: traits({ positive: ['athletic'], negative: ['lazy'], hidden: ['bold'] }) }),
      horse({ traits: traits({ positive: ['athletic'] }) }),
    ];
    const result = calculateGenerationTraitInfluence(horses, 1);
    // athletic appears twice (2*1), lazy once (1), bold once (1).
    expect(result.traitInfluence).toEqual({ athletic: 2, lazy: 1, bold: 1 });
    expect(result.totalInfluence).toBe(4);
    expect(result.averageInfluence).toBe(2); // 4 total / 2 horses
  });

  it('scales influence by the weight', () => {
    const horses = [horse({ traits: traits({ positive: ['athletic', 'calm'] }) })];
    const result = calculateGenerationTraitInfluence(horses, 0.5);
    expect(result.traitInfluence).toEqual({ athletic: 0.5, calm: 0.5 });
    expect(result.totalInfluence).toBe(1);
    expect(result.averageInfluence).toBe(1); // 1 / 1 horse
  });

  it('returns zero influence and zero average for an empty generation', () => {
    const result = calculateGenerationTraitInfluence([], 1);
    expect(result.traitInfluence).toEqual({});
    expect(result.totalInfluence).toBe(0);
    expect(result.averageInfluence).toBe(0); // guards divide-by-zero
  });

  it('tolerates malformed/missing trait arrays without throwing', () => {
    const horses = [
      { traits: { positive: null, negative: undefined, hidden: 'oops' } },
      {}, // no traits key at all
    ];
    expect(() => calculateGenerationTraitInfluence(horses, 1)).not.toThrow();
    const result = calculateGenerationTraitInfluence(horses, 1);
    expect(result.totalInfluence).toBe(0); // nothing countable
  });
});

describe('analyzeLineagePatterns', () => {
  it('surfaces a strength for a trait present in >30% of the lineage', () => {
    const lineage = {
      generations: [
        { horses: [horse({ traits: traits({ positive: ['athletic'] }) })] },
        { horses: [horse({ traits: traits({ positive: ['athletic'] }) })] },
      ],
    };
    const result = analyzeLineagePatterns(lineage);
    // athletic in 2/2 horses = 100% > 30% → strength.
    expect(result.strengths).toEqual([{ trait: 'athletic', frequency: 1, strength: 'lineage_consistency' }]);
    expect(result.weaknesses).toEqual([]);
    // 75 baseline + 5 per strength (1) - 10 per weakness (0) = 80.
    expect(result.score).toBe(80);
  });

  it('flags known-bad traits as weaknesses and drops the score', () => {
    const lineage = {
      generations: [{ horses: [horse({ traits: traits({ negative: ['nervous', 'lazy'] }) })] }],
    };
    const result = analyzeLineagePatterns(lineage);
    expect(result.weaknesses.map(w => w.trait).sort()).toEqual(['lazy', 'nervous']);
    // nervous + lazy are also each in 1/1 = 100% so they are ALSO strengths.
    // strengths = 2, weaknesses = 2 → 75 + 5*2 - 10*2 = 65.
    expect(result.score).toBe(65);
  });

  it('accepts a bare array lineage as well as the {generations} shape', () => {
    const bare = [{ horses: [horse({ traits: traits({ positive: ['bold'] }) })] }];
    const wrapped = { generations: bare };
    expect(analyzeLineagePatterns(bare)).toEqual(analyzeLineagePatterns(wrapped));
  });

  it('handles an empty lineage without throwing', () => {
    expect(() => analyzeLineagePatterns([])).not.toThrow();
    const result = analyzeLineagePatterns([]);
    expect(result.strengths).toEqual([]);
    expect(result.weaknesses).toEqual([]);
    expect(result.score).toBe(75); // baseline, no adjustments
  });

  it('skips generations with no horses array', () => {
    const lineage = { generations: [{}, { horses: [] }] };
    const result = analyzeLineagePatterns(lineage);
    expect(result.score).toBe(75);
  });
});

describe('computeMultiGenerationalPredictions (composed entry point)', () => {
  const stallion = { id: 1 };
  const mare = { id: 2 };

  it('applies geometric weight decay across generations', () => {
    const lineage = {
      generations: [
        { horses: [horse(), horse()] }, // gen1: weight 1, 2 horses
        { horses: [horse()] }, // gen2: weight 0.5, 1 horse
        { horses: [horse(), horse()] }, // gen3: weight 0.25, 2 horses
      ],
    };
    const result = computeMultiGenerationalPredictions(stallion, mare, lineage);

    expect(result.generationalImpact.generation1).toEqual({
      weight: 1,
      horseCount: 2,
      influence: 2,
    });
    expect(result.generationalImpact.generation2).toEqual({
      weight: 0.5,
      horseCount: 1,
      influence: 0.5,
    });
    expect(result.generationalImpact.generation3).toEqual({
      weight: 0.25,
      horseCount: 2,
      influence: 0.5,
    });
  });

  it('returns the full report shape and is internally consistent with its helpers', () => {
    const lineage = {
      generations: [
        { horses: [horse({ traits: traits({ positive: ['athletic'] }) })] },
        { horses: [horse({ traits: traits({ negative: ['nervous'] }) })] },
      ],
    };
    const result = computeMultiGenerationalPredictions(stallion, mare, lineage);

    expect(result).toEqual(
      expect.objectContaining({
        generationalImpact: expect.any(Object),
        ancestralTraitInfluence: expect.any(Object),
        lineageStrengths: expect.any(Array),
        lineageWeaknesses: expect.any(Array),
        overallLineageScore: expect.any(Number),
      }),
    );

    // The composed report's strengths/weaknesses/score must equal what
    // analyzeLineagePatterns produces directly for the same lineage.
    const direct = analyzeLineagePatterns(lineage);
    expect(result.lineageStrengths).toEqual(direct.strengths);
    expect(result.lineageWeaknesses).toEqual(direct.weaknesses);
    expect(result.overallLineageScore).toBe(direct.score);

    // The composed per-generation trait influence must equal what
    // calculateGenerationTraitInfluence produces directly.
    expect(result.ancestralTraitInfluence.generation1).toEqual(
      calculateGenerationTraitInfluence(lineage.generations[0].horses, 1),
    );
    expect(result.ancestralTraitInfluence.generation2).toEqual(
      calculateGenerationTraitInfluence(lineage.generations[1].horses, 0.5),
    );
  });

  it('accepts a bare array lineage equivalently to the {generations} shape', () => {
    const bare = [{ horses: [horse({ traits: traits({ positive: ['bold'] }) })] }];
    const fromBare = computeMultiGenerationalPredictions(stallion, mare, bare);
    const fromWrapped = computeMultiGenerationalPredictions(stallion, mare, { generations: bare });
    expect(fromBare).toEqual(fromWrapped);
  });

  it('returns empty impact maps for an empty/undefined lineage', () => {
    const result = computeMultiGenerationalPredictions(stallion, mare, []);
    expect(result.generationalImpact).toEqual({});
    expect(result.ancestralTraitInfluence).toEqual({});
    expect(result.overallLineageScore).toBe(75); // baseline from analyzeLineagePatterns
  });
});
