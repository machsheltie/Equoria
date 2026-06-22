/**
 * genetics/offspringPerformancePrediction.mjs — focused unit tests (Equoria-urqic.4)
 *
 * Pure per-discipline scoring extracted from enhancedGeneticProbabilityService.
 * No DB, no mocks — these functions consume already-computed probability +
 * trait-interaction objects and return plain scoring data.
 */

import { describe, it, expect } from '@jest/globals';
import {
  predictDisciplinePerformance,
  getDisciplineRelevantStats,
  getDisciplineRelevantTraits,
  calculateOverallPotential,
  identifyStrengthAreas,
  identifyDevelopmentAreas,
  calculatePredictionConfidence,
  computeOffspringPerformance,
} from '../services/genetics/offspringPerformancePrediction.mjs';

const traits = (overrides = {}) => ({ positive: [], negative: [], hidden: [], ...overrides });

// Minimal probabilities object matching the calculateEnhancedGeneticProbabilities shape.
const makeProbabilities = (overrides = {}) => ({
  statProbabilities: {},
  traitProbabilities: { positive: [], negative: [], hidden: [] },
  overallGeneticScore: 50,
  ...overrides,
});

const makeInteractions = (overrides = {}) => ({ synergisticPairs: [], ...overrides });

describe('getDisciplineRelevantStats', () => {
  it('maps known disciplines to their stat lists', () => {
    expect(getDisciplineRelevantStats('racing')).toEqual(['speed', 'stamina', 'agility']);
    expect(getDisciplineRelevantStats('dressage')).toEqual(['precision', 'focus', 'obedience']);
  });

  it('falls back to racing stats for unknown disciplines', () => {
    expect(getDisciplineRelevantStats('underwater-basket-weaving')).toEqual(['speed', 'stamina', 'agility']);
  });
});

describe('getDisciplineRelevantTraits', () => {
  it('maps known disciplines to their trait lists', () => {
    expect(getDisciplineRelevantTraits('dressage')).toContain('intelligent');
    expect(getDisciplineRelevantTraits('showJumping')).toContain('bold');
  });

  it('falls back to a default trait list for unknown disciplines', () => {
    expect(getDisciplineRelevantTraits('nope')).toEqual(['athletic', 'intelligent']);
  });
});

describe('predictDisciplinePerformance', () => {
  it('returns base score with no stat/trait data', () => {
    const result = predictDisciplinePerformance({}, {}, 'racing', makeProbabilities(), makeInteractions());
    expect(result.predictedScore).toBe(50);
    expect(result.confidence).toBe(70);
    expect(result.relevantFactors).toEqual(expect.arrayContaining(['speed', 'stamina', 'agility']));
  });

  it('boosts score for above-average relevant stats', () => {
    const probabilities = makeProbabilities({
      statProbabilities: {
        speed: { expectedValue: 90 },
        stamina: { expectedValue: 80 },
        agility: { expectedValue: 70 },
      },
    });
    const result = predictDisciplinePerformance({}, {}, 'racing', probabilities, makeInteractions());
    // 50 + (40+30+20)*0.3 = 50 + 27 = 77.
    expect(result.predictedScore).toBe(77);
  });

  it('adds trait probability bonuses and raises confidence', () => {
    const probabilities = makeProbabilities({
      traitProbabilities: {
        positive: [{ trait: 'athletic', probability: 100 }],
        negative: [],
        hidden: [],
      },
    });
    const result = predictDisciplinePerformance({}, {}, 'racing', probabilities, makeInteractions());
    // 50 + (100/100)*10 = 60; confidence 70 + 5 = 75.
    expect(result.predictedScore).toBe(60);
    expect(result.confidence).toBe(75);
  });

  it('adds synergy bonuses for relevant synergistic pairs', () => {
    const interactions = makeInteractions({
      synergisticPairs: [{ trait1: 'athletic', trait2: 'fast', synergyBonus: 20 }],
    });
    const result = predictDisciplinePerformance({}, {}, 'racing', makeProbabilities(), interactions);
    // 50 + 20*0.3 = 56.
    expect(result.predictedScore).toBe(56);
  });

  it('clamps the predicted score to 0..100', () => {
    const probabilities = makeProbabilities({
      statProbabilities: {
        speed: { expectedValue: 100 },
        stamina: { expectedValue: 100 },
        agility: { expectedValue: 100 },
      },
      traitProbabilities: {
        positive: [{ trait: 'athletic', probability: 100 }],
        negative: [],
        hidden: [],
      },
    });
    const interactions = makeInteractions({
      synergisticPairs: [{ trait1: 'athletic', trait2: 'fast', synergyBonus: 100 }],
    });
    const result = predictDisciplinePerformance({}, {}, 'racing', probabilities, interactions);
    expect(result.predictedScore).toBeLessThanOrEqual(100);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });
});

describe('calculateOverallPotential', () => {
  it('averages discipline scores and applies the genetic bonus', () => {
    const predictions = { racing: { predictedScore: 80 }, dressage: { predictedScore: 60 } };
    // avg 70, genetic bonus (70-50)*0.3 = 6 → 76.
    const result = calculateOverallPotential(predictions, makeProbabilities({ overallGeneticScore: 70 }));
    expect(result).toBe(76);
  });

  it('clamps to 0..100', () => {
    const predictions = { a: { predictedScore: 100 }, b: { predictedScore: 100 } };
    expect(calculateOverallPotential(predictions, makeProbabilities({ overallGeneticScore: 100 }))).toBe(100);
  });
});

describe('identifyStrengthAreas', () => {
  it('lists disciplines scoring above 75 and high-probability positive traits', () => {
    const predictions = {
      racing: { predictedScore: 90, confidence: 85 },
      dressage: { predictedScore: 60, confidence: 70 },
    };
    const probabilities = makeProbabilities({
      traitProbabilities: {
        positive: [{ trait: 'athletic', probability: 80 }],
        negative: [{ trait: 'nervous', probability: 90 }],
        hidden: [],
      },
    });
    const strengths = identifyStrengthAreas(predictions, probabilities);
    expect(strengths.some(s => s.area === 'racing')).toBe(true);
    expect(strengths.some(s => s.area === 'dressage')).toBe(false);
    expect(strengths.some(s => s.area === 'athletic trait expression')).toBe(true);
    // negative-category traits are never strengths even at high probability.
    expect(strengths.some(s => s.area.includes('nervous'))).toBe(false);
  });
});

describe('identifyDevelopmentAreas', () => {
  it('lists low-scoring disciplines and below-average stats', () => {
    const predictions = {
      racing: { predictedScore: 50 },
      dressage: { predictedScore: 80 },
    };
    const probabilities = makeProbabilities({
      statProbabilities: { speed: { expectedValue: 40 }, stamina: { expectedValue: 90 } },
    });
    const areas = identifyDevelopmentAreas(predictions, probabilities);
    expect(areas.some(a => a.area === 'racing')).toBe(true);
    expect(areas.some(a => a.area === 'dressage')).toBe(false);
    expect(areas.some(a => a.area === 'speed development')).toBe(true);
    expect(areas.some(a => a.area === 'stamina development')).toBe(false);
  });
});

describe('calculatePredictionConfidence', () => {
  it('returns the base confidence with no data', () => {
    expect(calculatePredictionConfidence({}, {})).toBe(70);
  });

  it('raises confidence with more trait + stat data, capped at 95', () => {
    const stallion = {
      traits: traits({ positive: ['a', 'b'], negative: ['c'], hidden: ['d'] }),
      stats: { speed: 50, stamina: 50 },
    };
    const mare = {
      traits: traits({ positive: ['e', 'f'], negative: ['g'], hidden: ['h'] }),
      stats: { agility: 50 },
    };
    // 8 traits → +16; 3 stat keys → +3 → 89.
    expect(calculatePredictionConfidence(stallion, mare)).toBe(89);
  });

  it('never exceeds 95', () => {
    const big = {
      traits: traits({ positive: Array(20).fill('t') }),
      stats: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`s${i}`, 50])),
    };
    expect(calculatePredictionConfidence(big, big)).toBe(95);
  });
});

describe('computeOffspringPerformance (composed entry point)', () => {
  it('returns predictions for all six disciplines plus aggregate fields', () => {
    const result = computeOffspringPerformance({}, {}, makeProbabilities(), makeInteractions());
    expect(Object.keys(result.disciplinePredictions)).toEqual([
      'racing',
      'dressage',
      'showJumping',
      'crossCountry',
      'western',
      'gaited',
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        overallPotential: expect.any(Number),
        strengthAreas: expect.any(Array),
        developmentAreas: expect.any(Array),
        confidenceLevel: expect.any(Number),
      }),
    );
  });
});
