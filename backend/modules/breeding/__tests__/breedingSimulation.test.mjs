/**
 * genetics/breedingSimulation.mjs — focused unit tests (Equoria-urqic.4.1)
 *
 * Monte-Carlo breeding-simulation cluster extracted from
 * enhancedGeneticProbabilityService. All functions are pure: with a seeded RNG
 * the outcomes are deterministic, so these assert exact values. No DB, no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import {
  createSeededRandom,
  calculateOutcomeStatistics,
  calculateConfidenceIntervals,
  calculatePerformanceFromTraitsAndStats,
  calculateGeneticScoreFromOutcome,
  simulateSingleBreedingOutcome,
  computeBreedingSimulation,
} from '../services/genetics/breedingSimulation.mjs';

const traits = (overrides = {}) => ({ positive: [], negative: [], hidden: [], ...overrides });

// Minimal probabilities object matching the calculateEnhancedGeneticProbabilities shape.
const makeProbabilities = (overrides = {}) => ({
  statProbabilities: {
    speed: { expectedRange: { min: 40, max: 60 } },
    stamina: { expectedRange: { min: 30, max: 70 } },
  },
  traitProbabilities: {
    positive: [{ trait: 'athletic', probability: 80 }],
    negative: [],
    hidden: [],
  },
  ...overrides,
});

describe('createSeededRandom', () => {
  it('is deterministic: same seed yields the same sequence', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('different seeds yield different sequences', () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    expect(a()).not.toBe(b());
  });

  it('matches the exact LCG output for a known seed', () => {
    const rng = createSeededRandom(1);
    // (1 * 9301 + 49297) % 233280 = 58598 ; 58598 / 233280
    expect(rng()).toBeCloseTo(58598 / 233280, 12);
  });

  it('always returns a value in [0, 1)', () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('calculatePerformanceFromTraitsAndStats', () => {
  it('uses ?? not || so stat 0 is preserved (Equoria-yvxkx)', () => {
    // racing = 50 + speed*0.4 + stamina*0.3 + agility*0.3
    // all-zero stats => 50 + 0 = 50, NOT boosted to 50+50
    const perfZero = calculatePerformanceFromTraitsAndStats(traits(), {
      speed: 0,
      stamina: 0,
      agility: 0,
    });
    expect(perfZero.racing).toBe(50);

    // If 0 were treated as missing and defaulted to 50, racing would be
    // 50 + 50*0.4 + 50*0.3 + 50*0.3 = 100. Prove that is NOT happening.
    expect(perfZero.racing).not.toBe(100);
  });

  it('defaults genuinely-missing stats to 50', () => {
    // racing with no speed/stamina/agility keys at all => each ?? 50
    const perf = calculatePerformanceFromTraitsAndStats(traits(), {});
    // 50 + 50*0.4 + 50*0.3 + 50*0.3 = 100
    expect(perf.racing).toBe(100);
  });

  it('applies the athletic bonus to racing and showJumping only', () => {
    const withTrait = calculatePerformanceFromTraitsAndStats(traits({ positive: ['athletic'] }), {
      speed: 50,
      stamina: 50,
      agility: 50,
      boldness: 50,
      precision: 50,
    });
    const without = calculatePerformanceFromTraitsAndStats(traits(), {
      speed: 50,
      stamina: 50,
      agility: 50,
      boldness: 50,
      precision: 50,
    });
    // racing/showJumping get +5 (clamped at 100); dressage unaffected
    expect(withTrait.racing).toBeGreaterThanOrEqual(without.racing);
    expect(withTrait.dressage).toBe(without.dressage);
  });

  it('clamps every discipline score to [0, 100]', () => {
    const perf = calculatePerformanceFromTraitsAndStats(traits({ positive: ['athletic'] }), {
      speed: 100,
      stamina: 100,
      agility: 100,
      boldness: 100,
      precision: 100,
      intelligence: 100,
      balance: 100,
    });
    Object.values(perf).forEach(score => {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

describe('calculateGeneticScoreFromOutcome', () => {
  it('rewards positive + hidden traits and penalises negative traits', () => {
    const stats = { a: 50, b: 50 }; // avg 50 => no stat delta
    // base 50 + pos*3 + hidden*4 - neg*2
    expect(calculateGeneticScoreFromOutcome(traits({ positive: ['x', 'y'] }), stats)).toBe(56);
    expect(calculateGeneticScoreFromOutcome(traits({ negative: ['x'] }), stats)).toBe(48);
    expect(calculateGeneticScoreFromOutcome(traits({ hidden: ['x'] }), stats)).toBe(54);
  });

  it('adds the stat bonus for above-average stats and clamps to [0, 100]', () => {
    // avg 100 => +(100-50)*0.5 = +25 => 75
    expect(calculateGeneticScoreFromOutcome(traits(), { a: 100, b: 100 })).toBe(75);
    // huge positive count clamps at 100
    expect(calculateGeneticScoreFromOutcome(traits({ positive: Array(50).fill('p') }), { a: 100 })).toBe(100);
  });
});

describe('calculateOutcomeStatistics', () => {
  it('aggregates trait frequency, average stats, and performance distribution', () => {
    const outcomes = [
      {
        traits: traits({ positive: ['athletic'] }),
        stats: { speed: 40 },
        predictedPerformance: { racing: 60 },
      },
      {
        traits: traits({ positive: ['athletic'] }),
        stats: { speed: 60 },
        predictedPerformance: { racing: 80 },
      },
    ];
    const stats = calculateOutcomeStatistics(outcomes);
    expect(stats.traitFrequency.athletic).toBe(2);
    expect(stats.averageStats.speed).toBe(50); // (40+60)/2
    expect(stats.performanceDistribution.racing).toBe(70); // (60+80)/2
  });
});

describe('calculateConfidenceIntervals', () => {
  it('computes 95% intervals from the percentile indices', () => {
    const outcomes = Array.from({ length: 100 }, (_, i) => ({
      stats: { speed: i },
      predictedPerformance: { racing: i },
    }));
    const ci = calculateConfidenceIntervals(outcomes);
    // lowerIndex = floor(100*0.025)=2 ; upperIndex = floor(100*0.975)=97
    expect(ci.stats.speed).toEqual({ min: 2, max: 97, confidence: 95 });
    expect(ci.performance.racing).toEqual({ min: 2, max: 97, confidence: 95 });
  });
});

describe('simulateSingleBreedingOutcome', () => {
  it('is deterministic given a seeded RNG', () => {
    const probs = makeProbabilities();
    const a = simulateSingleBreedingOutcome(probs, createSeededRandom(7));
    const b = simulateSingleBreedingOutcome(probs, createSeededRandom(7));
    expect(a).toEqual(b);
  });

  it('returns the expected outcome shape', () => {
    const outcome = simulateSingleBreedingOutcome(makeProbabilities(), createSeededRandom(7));
    expect(outcome).toHaveProperty('traits');
    expect(outcome).toHaveProperty('stats');
    expect(outcome).toHaveProperty('predictedPerformance');
    expect(outcome).toHaveProperty('geneticScore');
    // inherited stats stay within their expectedRange
    expect(outcome.stats.speed).toBeGreaterThanOrEqual(40);
    expect(outcome.stats.speed).toBeLessThanOrEqual(60);
  });

  it('only inherits a trait when the RNG roll is under its probability', () => {
    // probability 0 => trait can never be inherited regardless of RNG
    const probs = makeProbabilities({
      traitProbabilities: { positive: [{ trait: 'never', probability: 0 }], negative: [], hidden: [] },
    });
    const outcome = simulateSingleBreedingOutcome(probs, createSeededRandom(99));
    expect(outcome.traits.positive).not.toContain('never');
  });
});

describe('computeBreedingSimulation', () => {
  // The facade injects calculateEnhancedGeneticProbabilities; here we inject a
  // pure stub of the same shape so the test stays DB-free and deterministic.
  const computeProbabilities = () => makeProbabilities();

  it('produces deterministic results for the same seed', () => {
    const opts = { iterations: 25, seed: 123 };
    const r1 = computeBreedingSimulation({ id: 1 }, { id: 2 }, computeProbabilities, opts);
    const r2 = computeBreedingSimulation({ id: 1 }, { id: 2 }, computeProbabilities, opts);
    expect(r1).toEqual(r2);
  });

  it('runs the requested number of iterations', () => {
    const result = computeBreedingSimulation({ id: 1 }, { id: 2 }, computeProbabilities, { iterations: 12, seed: 5 });
    expect(result.outcomes).toHaveLength(12);
    expect(result.simulationParameters).toEqual({ iterations: 12, seed: 5 });
  });

  it('defaults to 100 iterations when none specified', () => {
    const result = computeBreedingSimulation({ id: 1 }, { id: 2 }, computeProbabilities, { seed: 1 });
    expect(result.outcomes).toHaveLength(100);
  });

  it('computes the probabilities exactly once (pure fn of the pair)', () => {
    let calls = 0;
    const counting = (...args) => {
      calls += 1;
      return computeProbabilities(...args);
    };
    computeBreedingSimulation({ id: 1 }, { id: 2 }, counting, { iterations: 50, seed: 9 });
    expect(calls).toBe(1);
  });

  it('returns the full simulation shape', () => {
    const result = computeBreedingSimulation({ id: 1 }, { id: 2 }, computeProbabilities, { iterations: 5, seed: 1 });
    expect(result).toHaveProperty('outcomes');
    expect(result).toHaveProperty('statistics');
    expect(result).toHaveProperty('confidenceIntervals');
    expect(result).toHaveProperty('simulationParameters');
  });
});
