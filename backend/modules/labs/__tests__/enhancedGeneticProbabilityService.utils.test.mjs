/**
 * enhancedGeneticProbabilityService — unit tests (Equoria-rr7)
 *
 * Imports only logger + constants/schema (no DB). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateEnhancedGeneticProbabilities,
  calculateGeneticCompatibilityScore,
  simulateBreedingOutcomes,
  calculateMultiGenerationalPredictions,
  calculateGeneticDiversityImpact,
  calculateTraitInteractions,
  generateGeneticBreedingRecommendations,
  predictOffspringPerformance,
} from '../../breeding/index.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseTraits = () => ({ positive: [], negative: [], hidden: [] });

const makeHorse = (overrides = {}) => ({
  id: 1,
  traits: baseTraits(),
  stats: {},
  disciplineScores: {},
  speed: 50,
  stamina: 50,
  agility: 50,
  endurance: 50,
  strength: 50,
  precision: 50,
  balance: 50,
  intelligence: 50,
  focus: 50,
  obedience: 50,
  boldness: 50,
  flexibility: 50,
  ...overrides,
});

const stallion = makeHorse({ id: 1 });
const mare = makeHorse({ id: 2 });

// ---------------------------------------------------------------------------
// calculateEnhancedGeneticProbabilities
// ---------------------------------------------------------------------------
describe('calculateEnhancedGeneticProbabilities', () => {
  it('returns object with expected top-level fields', () => {
    const r = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(typeof r.traitProbabilities).toBe('object');
    expect(typeof r.statProbabilities).toBe('object');
    expect(typeof r.disciplineProbabilities).toBe('object');
    expect(typeof r.overallGeneticScore).toBe('number');
    expect(typeof r.calculatedAt).toBe('string');
  });

  it('traitProbabilities has positive, negative, hidden arrays', () => {
    const r = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(Array.isArray(r.traitProbabilities.positive)).toBe(true);
    expect(Array.isArray(r.traitProbabilities.negative)).toBe(true);
    expect(Array.isArray(r.traitProbabilities.hidden)).toBe(true);
  });

  it('statProbabilities includes all stat keys', () => {
    const r = calculateEnhancedGeneticProbabilities(stallion, mare);
    for (const stat of ['speed', 'stamina', 'agility', 'endurance', 'strength', 'intelligence']) {
      expect(r.statProbabilities[stat]).toBeDefined();
    }
  });

  it('each stat entry has expectedValue, expectedRange, variance', () => {
    const r = calculateEnhancedGeneticProbabilities(stallion, mare);
    for (const entry of Object.values(r.statProbabilities)) {
      expect(typeof entry.expectedValue).toBe('number');
      expect(typeof entry.expectedRange.min).toBe('number');
      expect(typeof entry.expectedRange.max).toBe('number');
      expect(entry.expectedRange.min).toBeLessThanOrEqual(entry.expectedRange.max);
    }
  });

  it('overallGeneticScore is between 0 and 100', () => {
    const r = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(r.overallGeneticScore).toBeGreaterThanOrEqual(0);
    expect(r.overallGeneticScore).toBeLessThanOrEqual(100);
  });

  it('shared positive traits boost overallGeneticScore', () => {
    const s = makeHorse({
      id: 1,
      traits: { positive: ['calm', 'resilient'], negative: [], hidden: [] },
    });
    const m = makeHorse({
      id: 2,
      traits: { positive: ['calm', 'resilient'], negative: [], hidden: [] },
    });
    const rShared = calculateEnhancedGeneticProbabilities(s, m);
    const rBase = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(rShared.overallGeneticScore).toBeGreaterThan(rBase.overallGeneticScore);
  });

  it('shared negative traits lower overallGeneticScore', () => {
    const s = makeHorse({
      id: 1,
      traits: { positive: [], negative: ['nervous', 'fragile'], hidden: [] },
    });
    const m = makeHorse({
      id: 2,
      traits: { positive: [], negative: ['nervous', 'fragile'], hidden: [] },
    });
    const rNeg = calculateEnhancedGeneticProbabilities(s, m);
    const rBase = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(rNeg.overallGeneticScore).toBeLessThan(rBase.overallGeneticScore);
  });

  it('calculatedAt is a valid ISO string', () => {
    const r = calculateEnhancedGeneticProbabilities(stallion, mare);
    expect(() => new Date(r.calculatedAt)).not.toThrow();
    expect(isNaN(new Date(r.calculatedAt).getTime())).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateGeneticCompatibilityScore
// ---------------------------------------------------------------------------
describe('calculateGeneticCompatibilityScore', () => {
  it('returns object with expected fields', () => {
    const r = calculateGeneticCompatibilityScore(stallion, mare);
    expect(typeof r.overallScore).toBe('number');
    expect(typeof r.traitCompatibility).toBe('object');
    expect(typeof r.statCompatibility).toBe('object');
    expect(typeof r.disciplineCompatibility).toBe('number');
    expect(typeof r.diversityScore).toBe('number');
  });

  it('overallScore is between 0 and 100', () => {
    const r = calculateGeneticCompatibilityScore(stallion, mare);
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.overallScore).toBeLessThanOrEqual(100);
  });

  it('traitCompatibility has score, sharedPositiveTraits, conflicts, compatibilityLevel', () => {
    const r = calculateGeneticCompatibilityScore(stallion, mare);
    expect(typeof r.traitCompatibility.score).toBe('number');
    expect(Array.isArray(r.traitCompatibility.sharedPositiveTraits)).toBe(true);
    expect(Array.isArray(r.traitCompatibility.conflicts)).toBe(true);
    expect(typeof r.traitCompatibility.compatibilityLevel).toBe('string');
  });

  it('horses with shared positive traits have higher traitCompatibility score than horses with conflicts', () => {
    const synHorse1 = makeHorse({
      id: 3,
      traits: { positive: ['calm', 'resilient', 'intelligent'], negative: [], hidden: [] },
    });
    const synHorse2 = makeHorse({
      id: 4,
      traits: { positive: ['calm', 'resilient', 'intelligent'], negative: [], hidden: [] },
    });
    const conflictHorse1 = makeHorse({
      id: 5,
      traits: { positive: ['calm'], negative: [], hidden: [] },
    });
    const conflictHorse2 = makeHorse({
      id: 6,
      traits: { positive: [], negative: ['calm'], hidden: [] },
    });
    const synScore = calculateGeneticCompatibilityScore(synHorse1, synHorse2).traitCompatibility.score;
    const conflictScore = calculateGeneticCompatibilityScore(conflictHorse1, conflictHorse2).traitCompatibility.score;
    expect(synScore).toBeGreaterThan(conflictScore);
  });
});

// ---------------------------------------------------------------------------
// simulateBreedingOutcomes
// ---------------------------------------------------------------------------
describe('simulateBreedingOutcomes', () => {
  it('returns object with outcomes array, statistics, confidenceIntervals', () => {
    const r = simulateBreedingOutcomes(stallion, mare, { iterations: 5 });
    expect(Array.isArray(r.outcomes)).toBe(true);
    expect(typeof r.statistics).toBe('object');
    expect(typeof r.confidenceIntervals).toBe('object');
  });

  it('outcomes has correct length', () => {
    const r = simulateBreedingOutcomes(stallion, mare, { iterations: 10 });
    expect(r.outcomes).toHaveLength(10);
  });

  it('each outcome has traits, stats, predictedPerformance, geneticScore', () => {
    const r = simulateBreedingOutcomes(stallion, mare, { iterations: 3 });
    for (const outcome of r.outcomes) {
      expect(typeof outcome.traits).toBe('object');
      expect(typeof outcome.stats).toBe('object');
      expect(typeof outcome.predictedPerformance).toBe('object');
      expect(typeof outcome.geneticScore).toBe('number');
    }
  });

  it('defaults to 100 iterations when none specified', () => {
    const r = simulateBreedingOutcomes(stallion, mare);
    expect(r.outcomes).toHaveLength(100);
  });

  it('simulationParameters reflects options', () => {
    const r = simulateBreedingOutcomes(stallion, mare, { iterations: 5, seed: 42 });
    expect(r.simulationParameters.iterations).toBe(5);
    expect(r.simulationParameters.seed).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// calculateMultiGenerationalPredictions
// ---------------------------------------------------------------------------
describe('calculateMultiGenerationalPredictions', () => {
  const emptyLineage = [];

  it('returns object with generationalImpact and ancestralTraitInfluence', () => {
    const r = calculateMultiGenerationalPredictions(stallion, mare, emptyLineage);
    expect(typeof r.generationalImpact).toBe('object');
    expect(typeof r.ancestralTraitInfluence).toBe('object');
  });

  it('handles lineage as empty array', () => {
    const r = calculateMultiGenerationalPredictions(stallion, mare, []);
    expect(r).toBeDefined();
    expect(typeof r.generationalImpact).toBe('object');
  });

  it('handles lineage as object with generations property', () => {
    const lineage = { generations: [{ horses: [stallion, mare] }] };
    const r = calculateMultiGenerationalPredictions(stallion, mare, lineage);
    expect(r).toBeDefined();
    expect(r.generationalImpact.generation1).toBeDefined();
  });

  it('uses generation weight decay for successive generations', () => {
    const lineage = {
      generations: [{ horses: [stallion] }, { horses: [mare] }],
    };
    const r = calculateMultiGenerationalPredictions(stallion, mare, lineage);
    expect(r.generationalImpact.generation1.weight).toBeGreaterThan(r.generationalImpact.generation2.weight);
  });
});

// ---------------------------------------------------------------------------
// calculateGeneticDiversityImpact
// ---------------------------------------------------------------------------
describe('calculateGeneticDiversityImpact', () => {
  it('returns an object', () => {
    const r = calculateGeneticDiversityImpact(stallion, mare, []);
    expect(typeof r).toBe('object');
  });

  it('has diversityScore field', () => {
    const r = calculateGeneticDiversityImpact(stallion, mare, []);
    expect(r.diversityScore !== undefined).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateTraitInteractions
// ---------------------------------------------------------------------------
describe('calculateTraitInteractions', () => {
  it('returns object with synergisticPairs, antagonisticPairs, interactionScore', () => {
    const r = calculateTraitInteractions(stallion, mare);
    expect(Array.isArray(r.synergisticPairs)).toBe(true);
    expect(Array.isArray(r.antagonisticPairs)).toBe(true);
    expect(typeof r.interactionScore).toBe('number');
  });

  it('returns object with predictedCombinations', () => {
    const r = calculateTraitInteractions(stallion, mare);
    expect(r.predictedCombinations !== undefined).toBe(true);
  });

  it('synergistic pair detected when both parents have athletic+intelligent', () => {
    const s = makeHorse({ id: 1, traits: { positive: ['athletic'], negative: [], hidden: [] } });
    const m = makeHorse({ id: 2, traits: { positive: ['intelligent'], negative: [], hidden: [] } });
    const r = calculateTraitInteractions(s, m);
    const pair = r.synergisticPairs.find(p => p.trait1 === 'athletic' && p.trait2 === 'intelligent');
    expect(pair).toBeDefined();
    expect(pair.synergyBonus).toBe(15);
  });

  it('antagonistic pair detected when one has calm and the other has nervous', () => {
    const s = makeHorse({ id: 1, traits: { positive: ['calm'], negative: [], hidden: [] } });
    const m = makeHorse({ id: 2, traits: { positive: [], negative: ['nervous'], hidden: [] } });
    const r = calculateTraitInteractions(s, m);
    const pair = r.antagonisticPairs.find(p => p.trait1 === 'calm' && p.trait2 === 'nervous');
    expect(pair).toBeDefined();
    expect(pair.conflictPenalty).toBeGreaterThan(0);
  });

  it('no synergistic pairs for horses with unrelated traits', () => {
    const r = calculateTraitInteractions(stallion, mare);
    expect(r.synergisticPairs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// generateGeneticBreedingRecommendations
// ---------------------------------------------------------------------------
describe('generateGeneticBreedingRecommendations', () => {
  it('returns object with overallRecommendation, strengths, concerns, compatibilityScore', () => {
    const r = generateGeneticBreedingRecommendations(stallion, mare);
    expect(typeof r.overallRecommendation).toBe('string');
    expect(Array.isArray(r.strengths)).toBe(true);
    expect(Array.isArray(r.concerns)).toBe(true);
    expect(typeof r.compatibilityScore).toBe('number');
  });

  it('overallRecommendation is one of expected values', () => {
    const valid = new Set(['Highly Recommended', 'Recommended', 'Acceptable', 'Not Recommended']);
    const r = generateGeneticBreedingRecommendations(stallion, mare);
    expect(valid.has(r.overallRecommendation)).toBe(true);
  });

  it('compatibility score is a number between 0 and 100', () => {
    const r = generateGeneticBreedingRecommendations(stallion, mare);
    expect(r.compatibilityScore).toBeGreaterThanOrEqual(0);
    expect(r.compatibilityScore).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// predictOffspringPerformance
// ---------------------------------------------------------------------------
describe('predictOffspringPerformance', () => {
  it('returns an object', () => {
    const r = predictOffspringPerformance(stallion, mare);
    expect(typeof r).toBe('object');
    expect(r).not.toBeNull();
  });

  it('has disciplinePredictions, overallPotential, strengthAreas, developmentAreas', () => {
    const r = predictOffspringPerformance(stallion, mare);
    expect(typeof r.disciplinePredictions).toBe('object');
    expect(r.overallPotential !== undefined).toBe(true);
    expect(Array.isArray(r.strengthAreas)).toBe(true);
    expect(Array.isArray(r.developmentAreas)).toBe(true);
  });

  it('has confidenceLevel', () => {
    const r = predictOffspringPerformance(stallion, mare);
    expect(r.confidenceLevel !== undefined).toBe(true);
  });

  it('disciplinePredictions includes expected disciplines', () => {
    const r = predictOffspringPerformance(stallion, mare);
    for (const d of ['racing', 'dressage', 'showJumping']) {
      expect(r.disciplinePredictions[d]).toBeDefined();
    }
  });
});
