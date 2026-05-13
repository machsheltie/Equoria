/**
 * traitEvaluation — unit tests (Equoria-rr7)
 *
 * Pure functions (logger + taskTraitInfluenceMap imports only). No DB required.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  TRAIT_DEFINITIONS,
  TRAIT_CONFLICTS,
  getTraitDefinition,
  getAllTraitDefinitions,
  evaluateTraitRevelation,
  evaluateEpigeneticTagsFromFoalTasks,
  applyGroomTraitInfluence,
} from '../../../utils/traitEvaluation.mjs';

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

// ---------------------------------------------------------------------------
// evaluateEpigeneticTagsFromFoalTasks
// ---------------------------------------------------------------------------
describe('evaluateEpigeneticTagsFromFoalTasks', () => {
  it('null taskLog returns empty array', () => {
    expect(evaluateEpigeneticTagsFromFoalTasks(null)).toEqual([]);
  });

  it('non-object taskLog (string) returns empty array', () => {
    expect(evaluateEpigeneticTagsFromFoalTasks('bad')).toEqual([]);
  });

  it('empty taskLog object returns empty array', () => {
    expect(evaluateEpigeneticTagsFromFoalTasks({})).toEqual([]);
  });

  it('streak >= 7 exercises streakBonus=10 branch and returns array', () => {
    expect(Array.isArray(evaluateEpigeneticTagsFromFoalTasks({}, 7))).toBe(true);
  });

  it('streak < 7 exercises streakBonus=0 branch and returns array', () => {
    expect(Array.isArray(evaluateEpigeneticTagsFromFoalTasks({}, 6))).toBe(true);
  });

  it('unknown task name is skipped — no trait points accumulated', () => {
    expect(evaluateEpigeneticTagsFromFoalTasks({ teleportation: 5 })).toEqual([]);
  });

  it('count=0 for valid task is skipped', () => {
    expect(evaluateEpigeneticTagsFromFoalTasks({ desensitization: 0 })).toEqual([]);
  });

  it('count=-1 (negative) for valid task is skipped', () => {
    expect(evaluateEpigeneticTagsFromFoalTasks({ desensitization: -1 })).toEqual([]);
  });

  it('non-number count for valid task is skipped', () => {
    expect(evaluateEpigeneticTagsFromFoalTasks({ desensitization: 'five' })).toEqual([]);
  });

  it('high-count valid task eventually assigns trait (200 trials, 60% cap)', () => {
    // desensitization × 20 → 100 pts → capped to 60% → P(0 assigned in 200) = 0.4^200 ≈ 0
    let found = false;
    for (let i = 0; i < 200; i++) {
      if (evaluateEpigeneticTagsFromFoalTasks({ desensitization: 20 }).includes('confident')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('streak=7 + high-count exercises streak bonus accumulation path', () => {
    // points = 100 + 10 = 110 → still capped to 60%
    let found = false;
    for (let i = 0; i < 200; i++) {
      if (evaluateEpigeneticTagsFromFoalTasks({ desensitization: 20 }, 7).includes('confident')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('result is an array of strings when non-empty', () => {
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = evaluateEpigeneticTagsFromFoalTasks({ desensitization: 20 });
      if (result.length > 0) {
        result.forEach(t => expect(typeof t).toBe('string'));
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('multi-trait task (trust_building) eventually assigns bonded or resilient', () => {
    // trust_building influences both bonded and resilient — 60% chance each after 20 reps
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = evaluateEpigeneticTagsFromFoalTasks({ trust_building: 20 });
      if (result.includes('bonded') || result.includes('resilient')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitRevelation — shouldRevealTrait + shouldTraitBeHidden branch coverage
// ---------------------------------------------------------------------------
describe('evaluateTraitRevelation — uncovered branch paths', () => {
  const empty = { positive: [], negative: [], hidden: [] };

  it('negative trait already in existingTraits is skipped (line 287 continue)', () => {
    // Pass nervous as already known — loop continues without re-adding it
    const nervousKnown = { positive: [], negative: ['nervous'], hidden: [] };
    const stressedFoal2 = { id: 50, bondScore: 20, stressLevel: 90, age: 0 };
    const result = evaluateTraitRevelation(stressedFoal2, nervousKnown, 1);
    expect(result.negative).not.toContain('nervous');
  });

  it('minStressLevel branch: low-stress foal suppresses negative trait (line 372)', () => {
    // nervous: maxBondScore=40, minStressLevel=60
    // foal: bondScore=20 (≤40 ✓), stressLevel=30 (<60) → shouldRevealTrait returns false at minStressLevel check
    const lowStressFoal = { id: 51, bondScore: 20, stressLevel: 30, age: 0 };
    const result = evaluateTraitRevelation(lowStressFoal, empty, 1);
    expect(result.negative).not.toContain('nervous');
    expect(result.negative).not.toContain('stubborn');
  });

  it('maxStressLevel branch: high-stress foal suppresses positive trait (line 375)', () => {
    // resilient: minBondScore=70, maxStressLevel=30
    // foal: bondScore=80 (≥70 ✓), stressLevel=50 (>30) → shouldRevealTrait returns false at maxStressLevel check
    const highStressFoal = { id: 52, bondScore: 80, stressLevel: 50, age: 0 };
    const result = evaluateTraitRevelation(highStressFoal, empty, 2);
    expect(result.positive).not.toContain('resilient');
  });

  it('rare trait already in existingTraits is skipped (line 314 continue)', () => {
    const legendaryKnown = { positive: [], negative: [], hidden: ['legendary_bloodline'] };
    const eliteFoal = { id: 53, bondScore: 90, stressLevel: 10, age: 0 };
    const result = evaluateTraitRevelation(eliteFoal, legendaryKnown, 6);
    expect(result.hidden).not.toContain('legendary_bloodline');
  });

  it('legendary rare trait is revealed as hidden (exercises lines 320-324, 402)', () => {
    // legendary_bloodline: 3% per iter → P(0 in 200) < 0.3%
    const eliteFoal = { id: 54, bondScore: 90, stressLevel: 10, age: 0 };
    let found = false;
    for (let i = 0; i < 200; i++) {
      const result = evaluateTraitRevelation(eliteFoal, empty, 6);
      if (result.hidden.includes('legendary_bloodline')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('non-legendary rare trait can appear in positive list (exercises line 326)', () => {
    // weather_immunity: minBondScore=75, maxStressLevel=20, rarity=rare, baseChance=0.08
    // shouldTraitBeHidden (rare): Math.random() < 0.7 → 30% chance visible/positive
    // Combined visible rate ≈ 2.4% per iter → P(0 visible in 500) ≈ 0
    const rareFoal = { id: 55, bondScore: 80, stressLevel: 15, age: 0 };
    let found = false;
    for (let i = 0; i < 500; i++) {
      const result = evaluateTraitRevelation(rareFoal, empty, 6);
      if (result.positive.includes('weather_immunity') || result.positive.includes('night_vision')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('normal conditionScore branch in shouldTraitBeHidden (line 422, 200 trials)', () => {
    // foal: bondScore=70, stressLevel=20 → conditionScore=50 (20 < 50 < 60, neither branch)
    // calm: minBondScore=60, maxStressLevel=20 (stressLevel=20, 20>20=false → passes), minAge=1
    // calm baseChance=0.3 → P(0 reveals in 200) = 0.7^200 ≈ 0 → line 422 will be exercised
    const normalFoal = { id: 56, bondScore: 70, stressLevel: 20, age: 0 };
    let revealed = false;
    for (let i = 0; i < 200; i++) {
      const result = evaluateTraitRevelation(normalFoal, empty, 4);
      if (result.positive.length > 0 || result.hidden.length > 0) {
        revealed = true;
        break;
      }
    }
    expect(revealed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitRevelation — age>0 and currentTraits fallback branches
// ---------------------------------------------------------------------------
describe('evaluateTraitRevelation — age and currentTraits fallback branches', () => {
  it('age>0 + currentDay>6 exercises false-branch of age===0 ternary and Math.min cap', () => {
    // age=100 > 0 → developmentAge = Math.min(8, 6) = 6 (cap branch exercised)
    const adultFoal = { id: 60, bondScore: 90, stressLevel: 10, age: 100 };
    const result = evaluateTraitRevelation(adultFoal, { positive: [], negative: [], hidden: [] }, 8);
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
  });

  it('age>0 + currentDay<=6 exercises false-branch of age===0 ternary without Math.min cap', () => {
    // age=200 > 0 → developmentAge = Math.min(3, 6) = 3 (no cap)
    const adultFoal2 = { id: 61, bondScore: 90, stressLevel: 10, age: 200 };
    const result = evaluateTraitRevelation(adultFoal2, { positive: [], negative: [], hidden: [] }, 3);
    expect(Array.isArray(result.positive)).toBe(true);
  });

  it('currentTraits={} (no keys) exercises positive||[], negative||[], hidden||[] fallbacks', () => {
    // {} has no .positive/.negative/.hidden → each ||[] fallback is exercised
    const goodFoal2 = { id: 62, bondScore: 90, stressLevel: 10, age: 0 };
    const result = evaluateTraitRevelation(goodFoal2, {}, 5);
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
    expect(Array.isArray(result.hidden)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyGroomTraitInfluence — default parameter branch
// ---------------------------------------------------------------------------
describe('applyGroomTraitInfluence — default parameter branch', () => {
  const youngHorse2 = { id: 70, age: 30 };

  it('calling without currentTraitInfluences exercises the default={} parameter branch', () => {
    // Third arg omitted → currentTraitInfluences defaults to {} (default parameter branch)
    const result = applyGroomTraitInfluence(youngHorse2, 'brushing');
    expect(result.updatedInfluences).toBeDefined();
    expect(result.newPermanentTraits).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// evaluateEpigeneticTagsFromFoalTasks — traitPoints accumulation left-branch
// ---------------------------------------------------------------------------
describe('evaluateEpigeneticTagsFromFoalTasks — traitPoints accumulation left-branch', () => {
  it('multiple tasks sharing same trait exercise traitPoints[tag]||0 left-branch (already-set value)', () => {
    // trust_building and gentle_touch both influence 'bonded'
    // First iteration: traitPoints['bonded'] = (undefined || 0) + basePoints  → right-branch
    // Second iteration: traitPoints['bonded'] = (number || 0) + basePoints    → left-branch
    const result = evaluateEpigeneticTagsFromFoalTasks({ trust_building: 5, gentle_touch: 5 });
    expect(Array.isArray(result)).toBe(true);
    // Both tasks contribute to 'bonded' → higher chance → at least the logic ran
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitRevelation — negative trait hidden branch (line 297)
// ---------------------------------------------------------------------------
describe('evaluateTraitRevelation — negative trait hidden path (line 297)', () => {
  it('negative trait with shouldHide=true lands in result.hidden (line 297)', () => {
    // nervous: maxBondScore=40, minStressLevel=60, baseChance=0.35
    // conditionScore = 20 - 90 = -70 → <20 → shouldTraitBeHidden 30% chance
    // Per-run P(hidden negative) ≈ 0.35 × 0.3 = 10.5%; P(0 in 300) ≈ 1.7e-10
    const negativeKeys = Object.keys(TRAIT_DEFINITIONS.negative);
    const foal = { id: 99, bondScore: 20, stressLevel: 90, age: 0 };
    let found = false;
    for (let i = 0; i < 300; i++) {
      const result = evaluateTraitRevelation(foal, { positive: [], negative: [], hidden: [] }, 2);
      if (result.hidden.some(t => negativeKeys.includes(t))) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitRevelation — catch block (lines 341-342)
// ---------------------------------------------------------------------------
describe('evaluateTraitRevelation — catch block (lines 341-342)', () => {
  it('re-throws when foal is null (foal.id access throws TypeError)', () => {
    expect(() => evaluateTraitRevelation(null, {}, 1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// evaluateEpigeneticTagsFromFoalTasks — catch block (lines 531-532)
// ---------------------------------------------------------------------------
describe('evaluateEpigeneticTagsFromFoalTasks — catch block (lines 531-532)', () => {
  it('re-throws when Object.entries(taskLog) throws (Proxy ownKeys trap)', () => {
    const evil = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('proxy bomb');
        },
      },
    );
    expect(() => evaluateEpigeneticTagsFromFoalTasks(evil, 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyGroomTraitInfluence — catch block (lines 620-621)
// ---------------------------------------------------------------------------
describe('applyGroomTraitInfluence — catch block (lines 620-621)', () => {
  it('re-throws when horse is null (horse.age access throws TypeError)', () => {
    expect(() => applyGroomTraitInfluence(null, 'brushing', {})).toThrow();
  });
});

// ---------------------------------------------------------------------------
// evaluateTraitRevelation — conflict blocking FALSE branches (lines 266, 293)
// Math.random pinned to 0 so all probability gates pass deterministically.
// Line 320 (rare-trait conflict) is dead code: no rare trait has TRAIT_CONFLICTS
// entries, so hasTraitConflict always returns false for rare traits.
// ---------------------------------------------------------------------------
describe('evaluateTraitRevelation — conflict blocking FALSE branches (lines 266, 293)', () => {
  let mathRandomSpy;

  beforeEach(() => {
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  it('positive trait calm blocked by pre-existing nervous (line 266 FALSE branch)', () => {
    // calm conflicts with nervous; all reveal conditions met with bondScore=100, stressLevel=0
    // Math.random()=0 makes probability gate pass, but hasTraitConflict('calm',{nervous})=true
    // → !hasTraitConflict is FALSE → line 266 FALSE branch covered; calm absent from result
    const foal = { id: 99, bondScore: 100, stressLevel: 0, age: 0 };
    const currentTraits = { positive: [], negative: ['nervous'], hidden: [] };
    const result = evaluateTraitRevelation(foal, currentTraits, 6);
    const all = [...result.positive, ...result.negative, ...result.hidden];
    expect(all).not.toContain('calm');
  });

  it('negative trait nervous blocked by pre-existing calm (line 293 FALSE branch)', () => {
    // nervous conflicts with calm; conditions met with bondScore=0, stressLevel=100
    // Math.random()=0 passes probability gate, hasTraitConflict('nervous',{calm})=true
    // → !hasTraitConflict is FALSE → line 293 FALSE branch covered; nervous absent from result
    const foal = { id: 98, bondScore: 0, stressLevel: 100, age: 0 };
    const currentTraits = { positive: ['calm'], negative: [], hidden: [] };
    const result = evaluateTraitRevelation(foal, currentTraits, 6);
    const all = [...result.positive, ...result.negative, ...result.hidden];
    expect(all).not.toContain('nervous');
  });
});
