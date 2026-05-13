/**
 * markingGenerationService — unit tests (Equoria-rr7)
 *
 * Zero imports (pure functions). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  FACE_MARKING_DEFAULTS,
  LEG_MARKING_DEFAULTS,
  ADVANCED_MARKING_BASE_RATES,
  MODIFIER_DEFAULTS,
  sampleWeightedFromMap,
  generateFaceMarking,
  generateLegMarkings,
  generateAdvancedMarkings,
  generateBooleanModifiers,
  generateMarkings,
  inheritMarkings,
} from '../../modules/horses/services/markingGenerationService.mjs';

// Deterministic RNG helpers
const alwaysZero = () => 0;
const alwaysOne = () => 0.9999999;
const seqRng = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('FACE_MARKING_DEFAULTS', () => {
  it('sums to 1.0', () => {
    const sum = Object.values(FACE_MARKING_DEFAULTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('includes none, star, strip, blaze, snip', () => {
    expect(FACE_MARKING_DEFAULTS.none).toBeDefined();
    expect(FACE_MARKING_DEFAULTS.star).toBeDefined();
    expect(FACE_MARKING_DEFAULTS.blaze).toBeDefined();
  });
});

describe('LEG_MARKING_DEFAULTS', () => {
  it('has legs_general_probability between 0 and 1', () => {
    expect(LEG_MARKING_DEFAULTS.legs_general_probability).toBeGreaterThan(0);
    expect(LEG_MARKING_DEFAULTS.legs_general_probability).toBeLessThanOrEqual(1);
  });

  it('has max_legs_marked of 4', () => {
    expect(LEG_MARKING_DEFAULTS.max_legs_marked).toBe(4);
  });

  it('leg_specific_probabilities sums to 1', () => {
    const sum = Object.values(LEG_MARKING_DEFAULTS.leg_specific_probabilities).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});

describe('ADVANCED_MARKING_BASE_RATES', () => {
  it('all rates are between 0 and 1', () => {
    for (const rate of Object.values(ADVANCED_MARKING_BASE_RATES)) {
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(1);
    }
  });
});

describe('MODIFIER_DEFAULTS', () => {
  it('sooty is > 0', () => {
    expect(MODIFIER_DEFAULTS.sooty).toBeGreaterThan(0);
  });

  it('all values are between 0 and 1', () => {
    for (const val of Object.values(MODIFIER_DEFAULTS)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// sampleWeightedFromMap
// ---------------------------------------------------------------------------
describe('sampleWeightedFromMap', () => {
  it('returns null for null input', () => {
    expect(sampleWeightedFromMap(null, alwaysZero)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(sampleWeightedFromMap({}, alwaysZero)).toBeNull();
  });

  it('always returns the only key for single-entry map', () => {
    expect(sampleWeightedFromMap({ only: 1.0 }, alwaysZero)).toBe('only');
    expect(sampleWeightedFromMap({ only: 1.0 }, alwaysOne)).toBe('only');
  });

  it('returns first key when roll is 0', () => {
    const map = { a: 0.5, b: 0.3, c: 0.2 };
    expect(sampleWeightedFromMap(map, alwaysZero)).toBe('a');
  });

  it('returns last key when roll is very high', () => {
    const map = { a: 0.5, b: 0.3, c: 0.2 };
    const result = sampleWeightedFromMap(map, alwaysOne);
    expect(result).toBe('c');
  });

  it('returns a valid key for face marking defaults', () => {
    const valid = new Set(Object.keys(FACE_MARKING_DEFAULTS));
    for (let i = 0; i < 20; i++) {
      expect(valid.has(sampleWeightedFromMap(FACE_MARKING_DEFAULTS, Math.random))).toBe(true);
    }
  });

  it('returns first entry if all weights are 0 or negative', () => {
    const map = { a: 0, b: 0, c: 0 };
    const result = sampleWeightedFromMap(map, alwaysZero);
    expect(result).toBe('a');
  });

  // line 97: floating-point fallback when rng()=1.0 → roll==total (Equoria-rr7)
  it('floating-point fallback (line 97): rng=1.0 returns last entry (Equoria-rr7)', () => {
    // roll = 1.0 * total(1.0) = 1.0; cumulative after last entry = 1.0; 1.0 < 1.0 is false → line 97
    const weights = { a: 0.5, b: 0.5 };
    expect(sampleWeightedFromMap(weights, () => 1.0)).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// generateFaceMarking
// ---------------------------------------------------------------------------
describe('generateFaceMarking', () => {
  it('returns a string', () => {
    expect(typeof generateFaceMarking(null, Math.random)).toBe('string');
  });

  it('returns a valid face marking type', () => {
    const valid = new Set(['none', 'star', 'strip', 'blaze', 'snip']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(generateFaceMarking(null, Math.random))).toBe(true);
    }
  });

  it('returns none when rng always 0 (none has highest weight)', () => {
    expect(generateFaceMarking(null, alwaysZero)).toBe('none');
  });

  it('uses custom markingBias when provided', () => {
    const bias = { face: { blaze: 1.0 } };
    expect(generateFaceMarking(bias, Math.random)).toBe('blaze');
  });

  it('falls back to none if result is null', () => {
    // An empty map returns null from sampleWeightedFromMap, falls back to 'none'
    const bias = { face: {} };
    expect(generateFaceMarking(bias, Math.random)).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// generateLegMarkings
// ---------------------------------------------------------------------------
describe('generateLegMarkings', () => {
  it('returns object with all 4 legs', () => {
    const r = generateLegMarkings(null, Math.random);
    expect(r.frontLeft).toBeDefined();
    expect(r.frontRight).toBeDefined();
    expect(r.hindLeft).toBeDefined();
    expect(r.hindRight).toBeDefined();
  });

  it('all legs are none when rng always returns >= general probability', () => {
    // legs_general_probability = 0.25, so roll >= 0.25 → no marking
    const r = generateLegMarkings(null, () => 0.9);
    expect(Object.values(r).every(v => v === 'none')).toBe(true);
  });

  it('all legs get markings when rng always returns 0 (below 0.25)', () => {
    // roll 0 < 0.25 → marked; then sampleWeightedFromMap returns first key
    const r = generateLegMarkings(null, alwaysZero);
    expect(Object.values(r).every(v => v !== 'none')).toBe(true);
  });

  it('respects max_legs_marked cap', () => {
    // limit to 2 legs
    const bias = {
      legs_general_probability: 1.0,
      leg_specific_probabilities: { sock: 1.0 },
      max_legs_marked: 2,
    };
    const r = generateLegMarkings(bias, alwaysZero);
    const markedCount = Object.values(r).filter(v => v !== 'none').length;
    expect(markedCount).toBeLessThanOrEqual(2);
  });

  it('returns valid marking types for each leg', () => {
    const valid = new Set(['none', 'coronet', 'pastern', 'sock', 'stocking']);
    for (let i = 0; i < 10; i++) {
      const r = generateLegMarkings(null, Math.random);
      for (const val of Object.values(r)) {
        expect(valid.has(val)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// generateAdvancedMarkings
// ---------------------------------------------------------------------------
describe('generateAdvancedMarkings', () => {
  it('returns object with 3 boolean fields', () => {
    const r = generateAdvancedMarkings(null, Math.random);
    expect(typeof r.bloodyShoulderPresent).toBe('boolean');
    expect(typeof r.snowflakePresent).toBe('boolean');
    expect(typeof r.frostPresent).toBe('boolean');
  });

  it('all false when rng returns value >= all base rates', () => {
    // max base rate is 0.03, so rng() = 0.5 → always false
    const r = generateAdvancedMarkings(null, () => 0.5);
    expect(r.bloodyShoulderPresent).toBe(false);
    expect(r.snowflakePresent).toBe(false);
    expect(r.frostPresent).toBe(false);
  });

  it('all true when rng returns 0 (< all base rates)', () => {
    const r = generateAdvancedMarkings(null, alwaysZero);
    expect(r.bloodyShoulderPresent).toBe(true);
    expect(r.snowflakePresent).toBe(true);
    expect(r.frostPresent).toBe(true);
  });

  it('multiplier of 0 prevents marking', () => {
    const bias = {
      bloody_shoulder_probability_multiplier: 0,
      snowflake_probability_multiplier: 0,
      frost_probability_multiplier: 0,
    };
    const r = generateAdvancedMarkings(bias, alwaysZero);
    expect(r.bloodyShoulderPresent).toBe(false);
    expect(r.snowflakePresent).toBe(false);
    expect(r.frostPresent).toBe(false);
  });

  it('high multiplier raises probability (all true at roll 0)', () => {
    const bias = {
      bloody_shoulder_probability_multiplier: 50,
    };
    const r = generateAdvancedMarkings(bias, alwaysZero);
    expect(r.bloodyShoulderPresent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateBooleanModifiers
// ---------------------------------------------------------------------------
describe('generateBooleanModifiers', () => {
  it('returns object with isSooty, isFlaxen, hasPangare, isRabicano', () => {
    const r = generateBooleanModifiers(null, null, Math.random);
    expect(typeof r.isSooty).toBe('boolean');
    expect(typeof r.isFlaxen).toBe('boolean');
    expect(typeof r.hasPangare).toBe('boolean');
    expect(typeof r.isRabicano).toBe('boolean');
  });

  it('flaxen is always false for non-chestnut color', () => {
    const r = generateBooleanModifiers(null, 'Bay', alwaysZero);
    expect(r.isFlaxen).toBe(false);
  });

  it('flaxen can be true for chestnut color', () => {
    // rng = 0 so all probabilities fire (sooty default 0.3, flaxen 0.1)
    const r = generateBooleanModifiers(null, 'Chestnut', alwaysZero);
    expect(r.isFlaxen).toBe(true);
  });

  it('flaxen is false for Champagne Chestnut (excluded)', () => {
    const r = generateBooleanModifiers(null, 'Gold Champagne', alwaysZero);
    expect(r.isFlaxen).toBe(false);
  });

  it('all false when rng always returns high value', () => {
    const r = generateBooleanModifiers(null, 'Chestnut', alwaysOne);
    expect(r.isSooty).toBe(false);
    expect(r.isFlaxen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateMarkings (composite)
// ---------------------------------------------------------------------------
describe('generateMarkings', () => {
  it('returns faceMarking, legMarkings, advancedMarkings, modifiers', () => {
    const r = generateMarkings();
    expect(typeof r.faceMarking).toBe('string');
    expect(typeof r.legMarkings).toBe('object');
    expect(typeof r.advancedMarkings).toBe('object');
    expect(typeof r.modifiers).toBe('object');
  });

  it('legMarkings has all 4 legs', () => {
    const r = generateMarkings();
    expect(r.legMarkings.frontLeft).toBeDefined();
    expect(r.legMarkings.frontRight).toBeDefined();
    expect(r.legMarkings.hindLeft).toBeDefined();
    expect(r.legMarkings.hindRight).toBeDefined();
  });

  it('null breedGeneticProfile uses defaults', () => {
    const r = generateMarkings(null, null, alwaysZero);
    expect(r.faceMarking).toBe('none');
  });

  it('respects breedGeneticProfile when provided', () => {
    const profile = {
      marking_bias: { face: { blaze: 1.0 } },
    };
    const r = generateMarkings(profile, null, Math.random);
    expect(r.faceMarking).toBe('blaze');
  });
});

// ---------------------------------------------------------------------------
// inheritMarkings
// ---------------------------------------------------------------------------
describe('inheritMarkings', () => {
  const sireMarkings = {
    faceMarking: 'blaze',
    legMarkings: { frontLeft: 'sock', frontRight: 'none', hindLeft: 'coronet', hindRight: 'none' },
  };
  const damMarkings = {
    faceMarking: 'star',
    legMarkings: { frontLeft: 'none', frontRight: 'stocking', hindLeft: 'none', hindRight: 'none' },
  };

  it('returns faceMarking, legMarkings, advancedMarkings, modifiers', () => {
    const r = inheritMarkings(sireMarkings, damMarkings);
    expect(r.faceMarking).toBeDefined();
    expect(r.legMarkings).toBeDefined();
    expect(r.advancedMarkings).toBeDefined();
    expect(r.modifiers).toBeDefined();
  });

  it('falls back to generateMarkings when both parents are null', () => {
    const r = inheritMarkings(null, null);
    expect(typeof r.faceMarking).toBe('string');
    expect(typeof r.legMarkings.frontLeft).toBe('string');
  });

  it('when roll < 0.4, inherits from sire (faceMarking)', () => {
    // seqRng: first call = 0.1 (< 0.4 → take sire)
    const rng = seqRng(0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    const r = inheritMarkings(sireMarkings, damMarkings, null, null, rng);
    expect(r.faceMarking).toBe('blaze');
  });

  it('when roll 0.4-0.8, inherits from dam (faceMarking)', () => {
    // seqRng: first call = 0.6 (0.4 <= x < 0.8 → take dam)
    const rng = seqRng(0.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    const r = inheritMarkings(sireMarkings, damMarkings, null, null, rng);
    expect(r.faceMarking).toBe('star');
  });

  it('only-sire markings: 80% chance inherits sire value', () => {
    // roll 0.1 < 0.8 → sire
    const rng = seqRng(0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    const r = inheritMarkings(sireMarkings, null, null, null, rng);
    expect(r.faceMarking).toBe('blaze');
  });

  // line 349: single-leg reroll when rng() < generalProb → returns marking (Equoria-rr7)
  it('leg reroll returns marking type when rng() < generalProb (line 349, Equoria-rr7)', () => {
    // seqRng(0.1, 0.9, 0.1, 0.0): face roll=0.1→sire; frontLeft roll=0.9≥0.8→reroll;
    // inside reroll: rng()=0.1<0.25→line349 fires→sampleWeightedFromMap→rng()=0.0→'coronet'
    const rng = seqRng(0.1, 0.9, 0.1, 0.0);
    const r = inheritMarkings(sireMarkings, damMarkings, null, null, rng);
    expect(r.legMarkings.frontLeft).not.toBe('none');
  });

  // line 397: isFlaxen reroll lambda fires only when colorName is chestnut (Equoria-rr7)
  it('isFlaxen reroll lambda (line 397) fires when colorName is Chestnut (Equoria-rr7)', () => {
    // sireMarkings.modifiers is undefined → sireMarkings?.modifiers?.isFlaxen = undefined → hasSire=false
    // damMarkings.modifiers is undefined → damMarkings?.modifiers?.isFlaxen = undefined → hasDam=false
    // isBaseChestnut('Chestnut')=true → pickInherited called; !hasSire&&!hasDam → randomFn() fires
    // alwaysZero → rng()=0 < MODIFIER_DEFAULTS.flaxen(0.1) → isFlaxen=true
    const r = inheritMarkings(sireMarkings, damMarkings, null, 'Chestnut', alwaysZero);
    expect(r.modifiers.isFlaxen).toBe(true);
  });

  // line 314 true arm: !hasSire; roll<0.8 → takes dam value (Equoria-rr7)
  it('only-dam markings: roll<0.8 inherits dam faceMarking (line 314 true arm, Equoria-rr7)', () => {
    // sireMarkings=null → !sireMarkings&&!damMarkings=false → proceed
    // face: pickInherited(undefined,'star',faceLambda) → !hasSire → roll=0.1<0.8 → damVal='star'
    const rng = seqRng(0.1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    const r = inheritMarkings(null, damMarkings, null, null, rng);
    expect(r.faceMarking).toBe('star');
  });

  // line 314 false arm + line 318 false arm: reroll when only one parent available (Equoria-rr7)
  it('only-dam markings: roll>=0.8 triggers reroll (line 314 false arm, Equoria-rr7)', () => {
    // roll=0.9 >= 0.8 → randomFn() = generateFaceMarking → returns a valid face marking
    const rng = seqRng(0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    const r = inheritMarkings(null, damMarkings, null, null, rng);
    expect(['none', 'star', 'strip', 'blaze', 'snip']).toContain(r.faceMarking);
  });

  it('only-sire markings: roll>=0.8 triggers reroll (line 318 false arm, Equoria-rr7)', () => {
    // pickInherited('blaze', undefined, faceLambda); !hasDam; roll=0.9>=0.8 → randomFn()
    const rng = seqRng(0.9, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    const r = inheritMarkings(sireMarkings, null, null, null, rng);
    expect(['none', 'star', 'strip', 'blaze', 'snip']).toContain(r.faceMarking);
  });
});
