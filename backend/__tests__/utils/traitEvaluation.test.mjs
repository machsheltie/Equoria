/**
 * traitEvaluation — unit tests (Equoria-rr7)
 *
 * Pure functions (logger + taskTraitInfluenceMap imports only). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  TRAIT_DEFINITIONS,
  TRAIT_CONFLICTS,
  getTraitDefinition,
  getAllTraitDefinitions,
  evaluateTraitRevelation,
  applyGroomTraitInfluence,
} from '../../utils/traitEvaluation.mjs';

// ---------------------------------------------------------------------------
// TRAIT_DEFINITIONS constant
// ---------------------------------------------------------------------------
describe('TRAIT_DEFINITIONS', () => {
  it('is an object with positive, negative, and rare sections', () => {
    expect(typeof TRAIT_DEFINITIONS).toBe('object');
    expect(TRAIT_DEFINITIONS.positive).toBeDefined();
    expect(TRAIT_DEFINITIONS.negative).toBeDefined();
    expect(TRAIT_DEFINITIONS.rare).toBeDefined();
  });

  it('positive section includes resilient', () => {
    expect(TRAIT_DEFINITIONS.positive.resilient).toBeDefined();
  });

  it('negative section includes nervous', () => {
    expect(TRAIT_DEFINITIONS.negative.nervous).toBeDefined();
  });

  it('each positive trait has baseChance, revealConditions, name', () => {
    for (const [, trait] of Object.entries(TRAIT_DEFINITIONS.positive)) {
      expect(typeof trait.name).toBe('string');
      expect(typeof trait.baseChance).toBe('number');
      expect(trait.revealConditions).toBeDefined();
    }
  });

  it('each negative trait has baseChance', () => {
    for (const [, trait] of Object.entries(TRAIT_DEFINITIONS.negative)) {
      expect(typeof trait.baseChance).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// TRAIT_CONFLICTS constant
// ---------------------------------------------------------------------------
describe('TRAIT_CONFLICTS', () => {
  it('is a non-empty object', () => {
    expect(typeof TRAIT_CONFLICTS).toBe('object');
    expect(Object.keys(TRAIT_CONFLICTS).length).toBeGreaterThan(0);
  });

  it('calm conflicts with nervous', () => {
    expect(TRAIT_CONFLICTS.calm).toContain('nervous');
  });

  it('calm conflicts with aggressive', () => {
    expect(TRAIT_CONFLICTS.calm).toContain('aggressive');
  });

  it('resilient conflicts with fragile', () => {
    expect(TRAIT_CONFLICTS.resilient).toContain('fragile');
  });

  it('each conflict entry is an array', () => {
    for (const [, conflicts] of Object.entries(TRAIT_CONFLICTS)) {
      expect(Array.isArray(conflicts)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getTraitDefinition
// ---------------------------------------------------------------------------
describe('getTraitDefinition', () => {
  it('returns definition for resilient (positive trait)', () => {
    const def = getTraitDefinition('resilient');
    expect(def).not.toBeNull();
    expect(def.name).toBeDefined();
    expect(typeof def.baseChance).toBe('number');
  });

  it('returns definition for nervous (negative trait)', () => {
    const def = getTraitDefinition('nervous');
    expect(def).not.toBeNull();
  });

  it('returns null for unknown trait', () => {
    expect(getTraitDefinition('telekinesis')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getTraitDefinition(undefined)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getTraitDefinition(null)).toBeNull();
  });

  it('returns definition for bold (positive trait)', () => {
    expect(getTraitDefinition('bold')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAllTraitDefinitions
// ---------------------------------------------------------------------------
describe('getAllTraitDefinitions', () => {
  it('returns an object', () => {
    expect(typeof getAllTraitDefinitions()).toBe('object');
  });

  it('contains trait entries for positive traits', () => {
    const all = getAllTraitDefinitions();
    expect(all.resilient || all.positive?.resilient).toBeDefined();
  });

  it('returns non-empty result', () => {
    const all = getAllTraitDefinitions();
    expect(Object.keys(all).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitRevelation
// ---------------------------------------------------------------------------
describe('evaluateTraitRevelation', () => {
  const goodFoal = { id: 1, bondScore: 90, stressLevel: 10, age: 0 };
  const stressedFoal = { id: 2, bondScore: 20, stressLevel: 90, age: 0 };
  const emptyTraits = { positive: [], negative: [], hidden: [] };

  it('returns object with positive, negative, hidden arrays', () => {
    const result = evaluateTraitRevelation(goodFoal, emptyTraits, 5);
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
    expect(Array.isArray(result.hidden)).toBe(true);
  });

  it('does not include conflicting traits in result', () => {
    const result = evaluateTraitRevelation(goodFoal, emptyTraits, 6);
    const all = [...result.positive, ...result.negative, ...result.hidden];
    for (const t1 of all) {
      for (const t2 of all) {
        if (t1 !== t2 && TRAIT_CONFLICTS[t1]) {
          expect(TRAIT_CONFLICTS[t1]).not.toContain(t2);
        }
      }
    }
  });

  it('does not reveal traits already in currentTraits', () => {
    const currentTraits = { positive: ['resilient'], negative: [], hidden: [] };
    const result = evaluateTraitRevelation(goodFoal, currentTraits, 6);
    expect(result.positive).not.toContain('resilient');
    expect(result.negative).not.toContain('resilient');
    expect(result.hidden).not.toContain('resilient');
  });

  it('handles foal with default bondScore and stressLevel', () => {
    const minimalFoal = { id: 3, age: 0 };
    const result = evaluateTraitRevelation(minimalFoal, emptyTraits, 0);
    expect(Array.isArray(result.positive)).toBe(true);
  });

  it('can produce positive traits under good conditions over many runs', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = evaluateTraitRevelation(goodFoal, emptyTraits, 6);
      if (result.positive.length > 0 || result.hidden.length > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('negative traits more likely with bad conditions', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = evaluateTraitRevelation(stressedFoal, emptyTraits, 6);
      if (result.negative.length > 0) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyGroomTraitInfluence
// ---------------------------------------------------------------------------
describe('applyGroomTraitInfluence', () => {
  // age < 1095 days (3 years) → isEpigenetic = true
  const youngHorse = { id: 1, age: 30 };
  // age >= 1095 days → isEpigenetic = false
  const oldHorse = { id: 2, age: 1200 };

  it('returns updatedInfluences, newPermanentTraits, isEpigenetic', () => {
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', {});
    expect(result).toHaveProperty('updatedInfluences');
    expect(result).toHaveProperty('newPermanentTraits');
    expect(result).toHaveProperty('isEpigenetic');
  });

  it('isEpigenetic is true for young horse (age < 1095)', () => {
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', {});
    expect(result.isEpigenetic).toBe(true);
  });

  it('isEpigenetic is false for old horse (age >= 1095)', () => {
    const result = applyGroomTraitInfluence(oldHorse, 'brushing', {});
    expect(result.isEpigenetic).toBe(false);
  });

  it('brushing encourages bonded trait (+1)', () => {
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', {});
    expect(result.updatedInfluences.bonded).toBeGreaterThan(0);
  });

  it('brushing discourages aloof trait (-1)', () => {
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', {});
    expect(result.updatedInfluences.aloof).toBeLessThan(0);
  });

  it('accumulated influence >=3 creates permanent positive trait', () => {
    // Start with influence score of 2, apply brushing (+1) → 3 = threshold
    const existing = { bonded: 2 };
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', existing);
    const bondedPermanent = result.newPermanentTraits.find(t => t.name === 'bonded');
    expect(bondedPermanent).toBeDefined();
    expect(bondedPermanent.type).toBe('positive');
  });

  it('accumulated influence <=-3 creates permanent negative_resistance trait', () => {
    // Start with influence score of -2, apply brushing (-1 for aloof) → -3 = threshold
    const existing = { aloof: -2 };
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', existing);
    const aloofPermanent = result.newPermanentTraits.find(t => t.name === 'aloof');
    expect(aloofPermanent).toBeDefined();
    expect(aloofPermanent.type).toBe('negative_resistance');
  });

  it('unknown task returns empty influences and no permanent traits', () => {
    const result = applyGroomTraitInfluence(youngHorse, 'teleportation', {});
    expect(result.newPermanentTraits).toHaveLength(0);
    expect(result.updatedInfluences).toEqual({});
  });

  it('permanent trait has epigenetic field set correctly', () => {
    const existing = { bonded: 2 };
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', existing);
    const pt = result.newPermanentTraits[0];
    if (pt) {
      expect(typeof pt.epigenetic).toBe('boolean');
    }
  });

  it('permanent trait has source: groom_interaction', () => {
    const existing = { bonded: 2 };
    const result = applyGroomTraitInfluence(youngHorse, 'brushing', existing);
    const pt = result.newPermanentTraits.find(t => t.name === 'bonded');
    if (pt) {
      expect(pt.source).toBe('groom_interaction');
    }
  });

  it('does not mutate the input currentTraitInfluences object', () => {
    const existing = { bonded: 1 };
    const original = { bonded: 1 };
    applyGroomTraitInfluence(youngHorse, 'brushing', existing);
    expect(existing).toEqual(original);
  });
});
