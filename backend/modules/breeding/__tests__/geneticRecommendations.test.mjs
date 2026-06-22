/**
 * genetics/geneticRecommendations.mjs — focused unit tests (Equoria-urqic.4.3)
 *
 * Pure recommendation-shaping extracted from enhancedGeneticProbabilityService.
 * No DB, no mocks. The three upstream computations
 * (calculateGeneticCompatibilityScore / calculateTraitInteractions /
 * calculateEnhancedGeneticProbabilities) are INJECTED — here we inject small
 * deterministic stub fns so the report-shaping logic can be asserted in
 * isolation, exactly as the facade injects the real implementations. Asserts the
 * output shape/branches are identical to the pre-split facade behavior.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateOptimizationSuggestions,
  computeGeneticRecommendations,
} from '../services/genetics/geneticRecommendations.mjs';

// Build a compatibility report with sensible defaults; override per test.
const compatibility = (overrides = {}) => ({
  overallScore: 70,
  traitCompatibility: {
    score: 80,
    sharedPositiveTraits: [],
    conflicts: [],
    ...(overrides.traitCompatibility || {}),
  },
  statCompatibility: {
    balanceScore: 70,
    complementaryStats: [],
    ...(overrides.statCompatibility || {}),
  },
  diversityScore: 60,
  ...overrides,
});

const traitInteractions = (overrides = {}) => ({
  synergisticPairs: [],
  antagonisticPairs: [],
  interactionScore: 0,
  predictedCombinations: [],
  ...overrides,
});

const probabilities = (overrides = {}) => ({
  traitProbabilities: { positive: [], negative: [], hidden: [] },
  statProbabilities: { speed: { expectedValue: 50 } },
  overallGeneticScore: 65,
  ...overrides,
});

describe('generateOptimizationSuggestions', () => {
  it('returns no suggestions when every axis is healthy', () => {
    const result = generateOptimizationSuggestions(
      compatibility({
        diversityScore: 80,
        statCompatibility: { balanceScore: 70, complementaryStats: [{ stat: 'speed' }] },
      }),
      traitInteractions(),
    );
    expect(result).toEqual([]);
  });

  it('suggests alternative partners when trait compatibility score < 60', () => {
    const result = generateOptimizationSuggestions(
      compatibility({
        traitCompatibility: { score: 50, sharedPositiveTraits: [], conflicts: [] },
        statCompatibility: { complementaryStats: [{ stat: 'x' }] },
        diversityScore: 80,
      }),
      traitInteractions(),
    );
    expect(result).toContainEqual({
      category: 'trait_compatibility',
      suggestion: 'Consider alternative breeding partners with more compatible trait profiles',
      impact: 'high',
    });
  });

  it('flags trait conflicts when antagonistic pairs exist', () => {
    const result = generateOptimizationSuggestions(
      compatibility({ statCompatibility: { complementaryStats: [{ stat: 'x' }] }, diversityScore: 80 }),
      traitInteractions({ antagonisticPairs: [{ trait1: 'calm', trait2: 'nervous' }] }),
    );
    expect(result).toContainEqual({
      category: 'trait_conflicts',
      suggestion: 'Monitor offspring for trait conflicts and plan training accordingly',
      impact: 'medium',
    });
  });

  it('suggests complementary stats when none exist', () => {
    const result = generateOptimizationSuggestions(
      compatibility({ statCompatibility: { complementaryStats: [] }, diversityScore: 80 }),
      traitInteractions(),
    );
    expect(result).toContainEqual({
      category: 'stat_balance',
      suggestion: 'Seek breeding partners with complementary stat strengths',
      impact: 'medium',
    });
  });

  it('suggests new bloodlines when diversity score < 40', () => {
    const result = generateOptimizationSuggestions(
      compatibility({ statCompatibility: { complementaryStats: [{ stat: 'x' }] }, diversityScore: 30 }),
      traitInteractions(),
    );
    expect(result).toContainEqual({
      category: 'genetic_diversity',
      suggestion: 'Introduce new bloodlines to improve genetic diversity',
      impact: 'high',
    });
  });
});

describe('computeGeneticRecommendations (composed entry point)', () => {
  const stallion = { id: 1 };
  const mare = { id: 2 };

  const deps = (comp, ti, probs) => ({
    compatibilityFn: () => comp,
    traitInteractionsFn: () => ti,
    probabilitiesFn: () => probs,
  });

  it.each([
    [80, 'Highly Recommended'],
    [65, 'Recommended'],
    [45, 'Acceptable'],
    [44, 'Not Recommended'],
  ])('maps overallScore %i to "%s"', (score, label) => {
    const result = computeGeneticRecommendations(
      stallion,
      mare,
      deps(compatibility({ overallScore: score }), traitInteractions(), probabilities()),
    );
    expect(result.overallRecommendation).toBe(label);
    expect(result.compatibilityScore).toBe(score);
  });

  it('builds strengths from shared traits, synergies, and complementary stats', () => {
    const comp = compatibility({
      overallScore: 70,
      traitCompatibility: { score: 80, sharedPositiveTraits: ['athletic', 'calm'], conflicts: [] },
      statCompatibility: { balanceScore: 70, complementaryStats: [{ stat: 'speed' }] },
    });
    const ti = traitInteractions({ synergisticPairs: [{ trait1: 'a', trait2: 'b' }] });
    const result = computeGeneticRecommendations(stallion, mare, deps(comp, ti, probabilities()));

    expect(result.strengths).toEqual([
      'Shared positive traits: athletic, calm',
      '1 synergistic trait combinations',
      'Complementary stat profiles for balanced offspring',
    ]);
  });

  it('builds concerns from conflicts, antagonistic pairs, and low diversity', () => {
    const comp = compatibility({
      overallScore: 40,
      traitCompatibility: { score: 30, sharedPositiveTraits: [], conflicts: [{ trait: 'x' }, { trait: 'y' }] },
      diversityScore: 20,
    });
    const ti = traitInteractions({ antagonisticPairs: [{ trait1: 'calm', trait2: 'nervous' }] });
    const result = computeGeneticRecommendations(stallion, mare, deps(comp, ti, probabilities()));

    expect(result.concerns).toEqual([
      '2 trait conflicts detected',
      '1 antagonistic trait pairs',
      'Low genetic diversity may limit offspring potential',
    ]);
  });

  it('passes probability fields through to expectedOutcomes', () => {
    const probs = probabilities({
      traitProbabilities: { positive: [{ trait: 't' }], negative: [], hidden: [] },
      statProbabilities: { speed: { expectedValue: 88 } },
      overallGeneticScore: 91,
    });
    const result = computeGeneticRecommendations(stallion, mare, deps(compatibility(), traitInteractions(), probs));
    expect(result.expectedOutcomes).toEqual({
      traitInheritance: probs.traitProbabilities,
      statRanges: probs.statProbabilities,
      geneticScore: 91,
    });
  });

  it('calls each injected dependency exactly once with (stallion, mare)', () => {
    const calls = { comp: 0, ti: 0, probs: 0 };
    const injected = {
      compatibilityFn: (s, m) => {
        calls.comp++;
        expect(s).toBe(stallion);
        expect(m).toBe(mare);
        return compatibility();
      },
      traitInteractionsFn: () => {
        calls.ti++;
        return traitInteractions();
      },
      probabilitiesFn: () => {
        calls.probs++;
        return probabilities();
      },
    };
    computeGeneticRecommendations(stallion, mare, injected);
    expect(calls).toEqual({ comp: 1, ti: 1, probs: 1 });
  });

  it('embeds optimizationSuggestions consistent with generateOptimizationSuggestions', () => {
    const comp = compatibility({
      traitCompatibility: { score: 40, sharedPositiveTraits: [], conflicts: [] },
      statCompatibility: { complementaryStats: [] },
      diversityScore: 30,
    });
    const ti = traitInteractions({ antagonisticPairs: [{ trait1: 'calm', trait2: 'nervous' }] });
    const result = computeGeneticRecommendations(stallion, mare, deps(comp, ti, probabilities()));
    expect(result.optimizationSuggestions).toEqual(generateOptimizationSuggestions(comp, ti));
    // All four rules fire for this maximally-bad pair.
    expect(result.optimizationSuggestions).toHaveLength(4);
  });
});
