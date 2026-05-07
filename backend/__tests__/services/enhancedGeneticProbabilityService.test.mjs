/**
 * enhancedGeneticProbabilityService — unit tests (Equoria-rr7)
 *
 * Pure functions: only logger + HORSE_STAT_VALUES (constants). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateEnhancedGeneticProbabilities,
  calculateGeneticCompatibilityScore,
  simulateBreedingOutcomes,
  calculateMultiGenerationalPredictions,
  calculateGeneticDiversityImpact,
  calculateTraitInteractions,
  generateBreedingRecommendations,
  predictOffspringPerformance,
} from '../../services/enhancedGeneticProbabilityService.mjs';

const stallion = {
  id: 1,
  traits: {
    positive: ['athletic', 'intelligent'],
    negative: [],
    hidden: ['trainabilityBoost'],
  },
  stats: { speed: 80, stamina: 70, agility: 75, endurance: 65, strength: 60 },
  disciplines: ['Dressage', 'Show Jumping'],
};

const mare = {
  id: 2,
  traits: {
    positive: ['calm', 'athletic'],
    negative: ['nervous'],
    hidden: [],
  },
  stats: { speed: 65, stamina: 80, agility: 70, endurance: 75, strength: 55 },
  disciplines: ['Dressage', 'Endurance'],
};

const minimalHorse = { id: 3, traits: { positive: [], negative: [], hidden: [] }, stats: {} };

// ---------------------------------------------------------------------------
// calculateEnhancedGeneticProbabilities
// ---------------------------------------------------------------------------
describe('calculateEnhancedGeneticProbabilities', () => {
  it('returns expected shape', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(result).toHaveProperty('traitProbabilities');
    expect(result).toHaveProperty('statProbabilities');
    expect(result).toHaveProperty('disciplineProbabilities');
    expect(result).toHaveProperty('overallGeneticScore');
    expect(result).toHaveProperty('calculatedAt');
  });

  it('calculatedAt is an ISO date string', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(typeof result.calculatedAt).toBe('string');
    expect(() => new Date(result.calculatedAt)).not.toThrow();
  });

  it('traitProbabilities has positive, negative, hidden arrays', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(Array.isArray(result.traitProbabilities.positive)).toBe(true);
    expect(Array.isArray(result.traitProbabilities.negative)).toBe(true);
    expect(Array.isArray(result.traitProbabilities.hidden)).toBe(true);
  });

  it('works with minimal horse objects', () => {
    const result = calculateEnhancedGeneticProbabilities(minimalHorse, minimalHorse);
    expect(typeof result.overallGeneticScore).toBe('number');
  });

  it('overallGeneticScore is a number', () => {
    const result = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(typeof result.overallGeneticScore).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// calculateGeneticCompatibilityScore
// ---------------------------------------------------------------------------
describe('calculateGeneticCompatibilityScore', () => {
  it('returns expected shape', () => {
    const result = calculateGeneticCompatibilityScore(stallion, mare);
    expect(result).toHaveProperty('overallScore');
    expect(result).toHaveProperty('traitCompatibility');
    expect(result).toHaveProperty('statCompatibility');
    expect(result).toHaveProperty('disciplineCompatibility');
    expect(result).toHaveProperty('diversityScore');
  });

  it('overallScore is a number between 0 and 100', () => {
    const result = calculateGeneticCompatibilityScore(stallion, mare);
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('traitCompatibility includes score and compatibilityLevel', () => {
    const result = calculateGeneticCompatibilityScore(stallion, mare);
    expect(typeof result.traitCompatibility.score).toBe('number');
    expect(typeof result.traitCompatibility.compatibilityLevel).toBe('string');
  });

  it('shared positive traits increase compatibility', () => {
    const matchStallion = { ...stallion, traits: { positive: ['athletic', 'calm'], negative: [], hidden: [] } };
    const matchMare = { ...mare, traits: { positive: ['athletic', 'calm'], negative: [], hidden: [] } };
    const single = calculateGeneticCompatibilityScore(stallion, minimalHorse);
    const match = calculateGeneticCompatibilityScore(matchStallion, matchMare);
    expect(match.traitCompatibility.score).toBeGreaterThanOrEqual(single.traitCompatibility.score);
  });

  it('works with minimal horses', () => {
    const result = calculateGeneticCompatibilityScore(minimalHorse, minimalHorse);
    expect(typeof result.overallScore).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// simulateBreedingOutcomes
// ---------------------------------------------------------------------------
describe('simulateBreedingOutcomes', () => {
  it('returns expected shape', () => {
    const result = simulateBreedingOutcomes(stallion, mare, { iterations: 5, seed: 42 });
    expect(result).toHaveProperty('outcomes');
    expect(result).toHaveProperty('statistics');
    expect(result).toHaveProperty('confidenceIntervals');
    expect(result).toHaveProperty('simulationParameters');
  });

  it('outcomes array has length = iterations', () => {
    const result = simulateBreedingOutcomes(stallion, mare, { iterations: 10, seed: 1 });
    expect(result.outcomes).toHaveLength(10);
  });

  it('each outcome has traits and stats', () => {
    const result = simulateBreedingOutcomes(stallion, mare, { iterations: 3, seed: 1 });
    for (const outcome of result.outcomes) {
      expect(outcome).toHaveProperty('traits');
      expect(outcome).toHaveProperty('stats');
    }
  });

  it('is deterministic with same seed', () => {
    const r1 = simulateBreedingOutcomes(stallion, mare, { iterations: 5, seed: 77 });
    const r2 = simulateBreedingOutcomes(stallion, mare, { iterations: 5, seed: 77 });
    expect(r1.outcomes).toEqual(r2.outcomes);
  });

  it('defaults to 100 iterations when not specified', () => {
    const result = simulateBreedingOutcomes(stallion, mare);
    expect(result.outcomes.length).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateMultiGenerationalPredictions
// ---------------------------------------------------------------------------
describe('calculateMultiGenerationalPredictions', () => {
  const lineage = [{ horses: [minimalHorse] }, { horses: [minimalHorse, minimalHorse] }];

  it('returns an object for valid lineage', () => {
    const result = calculateMultiGenerationalPredictions(stallion, mare, lineage);
    expect(typeof result).toBe('object');
  });

  it('accepts empty lineage array', () => {
    const result = calculateMultiGenerationalPredictions(stallion, mare, []);
    expect(typeof result).toBe('object');
  });

  it('accepts lineage as object with generations property', () => {
    const result = calculateMultiGenerationalPredictions(stallion, mare, { generations: lineage });
    expect(typeof result).toBe('object');
  });
});

// ---------------------------------------------------------------------------
// calculateGeneticDiversityImpact
// ---------------------------------------------------------------------------
describe('calculateGeneticDiversityImpact', () => {
  it('returns an object', () => {
    const result = calculateGeneticDiversityImpact(stallion, mare, []);
    expect(typeof result).toBe('object');
  });

  it('does not throw for empty lineage', () => {
    expect(() => calculateGeneticDiversityImpact(stallion, mare, [])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// calculateTraitInteractions
// ---------------------------------------------------------------------------
describe('calculateTraitInteractions', () => {
  it('returns expected shape with synergisticPairs and antagonisticPairs', () => {
    const result = calculateTraitInteractions(stallion, mare);
    expect(result).toHaveProperty('synergisticPairs');
    expect(result).toHaveProperty('antagonisticPairs');
    expect(result).toHaveProperty('interactionScore');
  });

  it('synergisticPairs and antagonisticPairs are arrays', () => {
    const result = calculateTraitInteractions(stallion, mare);
    expect(Array.isArray(result.synergisticPairs)).toBe(true);
    expect(Array.isArray(result.antagonisticPairs)).toBe(true);
  });

  it('interactionScore is a number', () => {
    const result = calculateTraitInteractions(stallion, mare);
    expect(typeof result.interactionScore).toBe('number');
  });

  it('works with minimal horses', () => {
    const result = calculateTraitInteractions(minimalHorse, minimalHorse);
    expect(result.synergisticPairs).toHaveLength(0);
    expect(result.antagonisticPairs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generateBreedingRecommendations
// ---------------------------------------------------------------------------
describe('generateBreedingRecommendations', () => {
  it('returns an object with recommendations', () => {
    const result = generateBreedingRecommendations(stallion, mare);
    expect(result).toHaveProperty('overallRecommendation');
    expect(result).toHaveProperty('strengths');
    expect(result).toHaveProperty('concerns');
    expect(result).toHaveProperty('compatibilityScore');
  });

  it('strengths and concerns are arrays', () => {
    const result = generateBreedingRecommendations(stallion, mare);
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.concerns)).toBe(true);
  });

  it('overallRecommendation is a string', () => {
    const result = generateBreedingRecommendations(stallion, mare);
    expect(typeof result.overallRecommendation).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// predictOffspringPerformance
// ---------------------------------------------------------------------------
describe('predictOffspringPerformance', () => {
  it('returns expected shape', () => {
    const result = predictOffspringPerformance(stallion, mare);
    expect(result).toHaveProperty('disciplinePredictions');
    expect(result).toHaveProperty('overallPotential');
    expect(result).toHaveProperty('strengthAreas');
    expect(result).toHaveProperty('developmentAreas');
  });

  it('overallPotential is a number between 0 and 100', () => {
    const result = predictOffspringPerformance(stallion, mare);
    expect(typeof result.overallPotential).toBe('number');
    expect(result.overallPotential).toBeGreaterThanOrEqual(0);
    expect(result.overallPotential).toBeLessThanOrEqual(100);
  });

  it('strengthAreas is an array', () => {
    const result = predictOffspringPerformance(stallion, mare);
    expect(Array.isArray(result.strengthAreas)).toBe(true);
  });

  it('works with minimal horses', () => {
    const result = predictOffspringPerformance(minimalHorse, minimalHorse);
    expect(typeof result).toBe('object');
  });
});
