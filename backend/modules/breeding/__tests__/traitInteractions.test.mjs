/**
 * genetics/traitInteractions.mjs — focused unit tests (Equoria-urqic.4.3)
 *
 * Pure trait-interaction calculations extracted from
 * enhancedGeneticProbabilityService. No DB, no mocks — these functions take plain
 * stallion/mare objects (and their `.traits` bags) and return numbers/arrays.
 * Asserts numeric output is identical to the pre-split facade behavior so the
 * prod importers and the labs/tests-unit importer suites stay green.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateInteractionInheritanceProbability,
  calculateConflictResolutionProbability,
  predictTraitCombinations,
  computeTraitInteractions,
} from '../services/genetics/traitInteractions.mjs';
import { TRAIT_INTERACTIONS, hasTraitInCategory } from '../services/genetics/traitConstants.mjs';

const traits = (overrides = {}) => ({
  positive: [],
  negative: [],
  hidden: [],
  ...overrides,
});

const horse = (overrides = {}) => ({ traits: traits(), ...overrides });

describe('traitConstants (shared source)', () => {
  it('preserves the facade synergistic/antagonistic table values', () => {
    // These values must stay identical to the pre-split facade const so
    // interaction scoring does not drift.
    expect(TRAIT_INTERACTIONS.synergistic).toEqual([
      { traits: ['athletic', 'intelligent'], bonus: 15 },
      { traits: ['calm', 'focused'], bonus: 12 },
      { traits: ['resilient', 'bold'], bonus: 10 },
      { traits: ['agile', 'athletic'], bonus: 8 },
    ]);
    expect(TRAIT_INTERACTIONS.antagonistic).toEqual([
      { traits: ['calm', 'nervous'], penalty: -20 },
      { traits: ['bold', 'timid'], penalty: -15 },
      { traits: ['focused', 'distracted'], penalty: -12 },
    ]);
  });

  it('is frozen so consumers cannot mutate the shared table', () => {
    expect(Object.isFrozen(TRAIT_INTERACTIONS)).toBe(true);
  });

  it('hasTraitInCategory finds a trait in any category and misses absent traits', () => {
    const t = traits({ positive: ['athletic'], negative: ['lazy'], hidden: ['bold'] });
    expect(hasTraitInCategory(t, 'athletic')).toBe(true);
    expect(hasTraitInCategory(t, 'lazy')).toBe(true);
    expect(hasTraitInCategory(t, 'bold')).toBe(true);
    expect(hasTraitInCategory(t, 'nervous')).toBe(false);
  });
});

describe('calculateInteractionInheritanceProbability', () => {
  it('returns 60 when one parent carries BOTH traits', () => {
    // stallion has both
    expect(calculateInteractionInheritanceProbability(true, true, false, false)).toBe(60);
    // mare has both
    expect(calculateInteractionInheritanceProbability(false, false, true, true)).toBe(60);
  });

  it('returns 35 for cross-parent inheritance (each parent supplies one)', () => {
    expect(calculateInteractionInheritanceProbability(true, false, false, true)).toBe(35);
    expect(calculateInteractionInheritanceProbability(false, true, true, false)).toBe(35);
  });

  it('returns 0 when neither pattern is satisfied', () => {
    expect(calculateInteractionInheritanceProbability(false, false, false, false)).toBe(0);
    // only trait1 present anywhere → no full pair
    expect(calculateInteractionInheritanceProbability(true, false, false, false)).toBe(0);
  });
});

describe('calculateConflictResolutionProbability', () => {
  it('returns 70 for cross-parent conflicts', () => {
    expect(calculateConflictResolutionProbability(true, false, false, true)).toBe(70);
    expect(calculateConflictResolutionProbability(false, true, true, false)).toBe(70);
  });

  it('returns 40 for same-parent / non-cross conflicts', () => {
    expect(calculateConflictResolutionProbability(true, true, false, false)).toBe(40);
    expect(calculateConflictResolutionProbability(false, false, false, false)).toBe(40);
  });
});

describe('predictTraitCombinations', () => {
  it('emits one synergistic combination per pair, mapping fields through', () => {
    const synergisticPairs = [
      { trait1: 'athletic', trait2: 'intelligent', inheritanceProbability: 60, synergyBonus: 15 },
    ];
    const result = predictTraitCombinations(traits(), traits(), synergisticPairs);
    // First entry is the synergistic pair (no high-value individual traits present).
    expect(result[0]).toEqual({
      traits: ['athletic', 'intelligent'],
      probability: 60,
      expectedBonus: 15,
      type: 'synergistic',
    });
  });

  it('adds an individual prediction at 75 when both parents carry a high-value trait', () => {
    const stallionTraits = traits({ positive: ['athletic'] });
    const mareTraits = traits({ positive: ['athletic'] });
    const result = predictTraitCombinations(stallionTraits, mareTraits, []);
    const athletic = result.find(c => c.type === 'individual' && c.traits[0] === 'athletic');
    expect(athletic).toEqual({
      traits: ['athletic'],
      probability: 75,
      expectedBonus: 5,
      type: 'individual',
    });
  });

  it('adds an individual prediction at 45 when only one parent carries the trait', () => {
    const stallionTraits = traits({ positive: ['resilient'] });
    const result = predictTraitCombinations(stallionTraits, traits(), []);
    const resilient = result.find(c => c.traits[0] === 'resilient');
    expect(resilient.probability).toBe(45);
  });

  it('omits high-value traits neither parent carries', () => {
    const result = predictTraitCombinations(traits(), traits(), []);
    // No synergistic pairs and no high-value traits present → empty.
    expect(result).toEqual([]);
  });
});

describe('computeTraitInteractions (composed entry point)', () => {
  it('detects a synergistic pair and scores it', () => {
    const stallion = horse({ traits: traits({ positive: ['athletic'] }) });
    const mare = horse({ traits: traits({ positive: ['intelligent'] }) });
    const result = computeTraitInteractions(stallion, mare);

    expect(result.synergisticPairs).toEqual([
      {
        trait1: 'athletic',
        trait2: 'intelligent',
        synergyBonus: 15,
        // athletic from stallion, intelligent from mare → cross-parent → 35.
        inheritanceProbability: 35,
      },
    ]);
    expect(result.antagonisticPairs).toEqual([]);
    // synergy 15, conflict 0.
    expect(result.interactionScore).toBe(15);
  });

  it('detects an antagonistic pair and subtracts its penalty from the score', () => {
    const stallion = horse({ traits: traits({ positive: ['calm'] }) });
    const mare = horse({ traits: traits({ negative: ['nervous'] }) });
    const result = computeTraitInteractions(stallion, mare);

    expect(result.antagonisticPairs).toEqual([
      {
        trait1: 'calm',
        trait2: 'nervous',
        conflictPenalty: 20, // Math.abs(-20)
        // calm from stallion, nervous from mare → cross-parent → 70.
        resolutionProbability: 70,
      },
    ]);
    // No synergistic pair (calm alone does not complete a synergy here).
    expect(result.synergisticPairs).toEqual([]);
    expect(result.interactionScore).toBe(-20);
  });

  it('returns empty pairs and a zero score for traitless horses', () => {
    const result = computeTraitInteractions(horse(), horse());
    expect(result.synergisticPairs).toEqual([]);
    expect(result.antagonisticPairs).toEqual([]);
    expect(result.interactionScore).toBe(0);
    expect(result.predictedCombinations).toEqual([]);
  });

  it('tolerates horses with no traits key (defaults applied)', () => {
    expect(() => computeTraitInteractions({}, {})).not.toThrow();
    const result = computeTraitInteractions({}, {});
    expect(result.interactionScore).toBe(0);
  });

  it('feeds detected synergistic pairs into predictedCombinations', () => {
    const stallion = horse({ traits: traits({ positive: ['athletic', 'intelligent'] }) });
    const mare = horse({ traits: traits({ positive: ['athletic', 'intelligent'] }) });
    const result = computeTraitInteractions(stallion, mare);

    // The composed predictedCombinations must equal a direct call with the
    // same synergistic pairs and trait bags.
    const direct = predictTraitCombinations(stallion.traits, mare.traits, result.synergisticPairs);
    expect(result.predictedCombinations).toEqual(direct);
  });
});
