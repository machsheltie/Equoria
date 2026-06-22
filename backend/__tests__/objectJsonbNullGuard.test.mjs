/**
 * Sentinel-positive regression tests for Equoria-liy7c.
 *
 * Object-shaped JSONB columns (ultraRareTraits {ultraRare,exotic},
 * epigeneticModifiers {positive,negative,hidden}, rareTraitPerks, bonusTraitMap,
 * colorGenotype/genotype locus maps) are read in production WITHOUT the full
 * four-part guard (.claude/rules/CONTRIBUTING.md Backend Conventions #1). On a
 * legacy / bare-created row the column can be null, a primitive, or an array.
 *
 * The worst case was `[...ultraRareTraits.ultraRare, ...ultraRareTraits.exotic]`
 * in ultraRareMechanicalEffects.mjs: a bare `|| { ultraRare:[], exotic:[] }`
 * fallback only caught null/undefined, so a primitive, an array, or an object
 * missing those sub-keys threw at runtime ("X is not iterable" / TypeError).
 *
 * These tests feed null / primitive / array / missing-sub-key shapes through
 * each guarded code path. They MUST NOT throw and MUST return the safe default.
 *
 * SENTINEL-POSITIVE PROOF: reverting the guarded site back to the bare
 * `horse.ultraRareTraits || {...}` + spread makes the array / primitive cases
 * throw "is not iterable" (verified by temporarily un-guarding during dev).
 *
 * Pure functions accept plain objects → no DB, no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { asFlagArray, asFlagObject } from '../utils/jsonbArrayGuard.mjs';
import {
  applyUltraRareStressEffects,
  applyUltraRareStressDecayEffects,
  applyUltraRareTrainingEffects,
  applyUltraRareCompetitionEffects,
  applyUltraRareBondingEffects,
  applyUltraRareBurnoutEffects,
  applyUltraRareStatEffects,
  hasUltraRareAbility,
} from '../utils/ultraRareMechanicalEffects.mjs';
import { applyRareTraitBoosterEffects } from '../utils/groomRareTraitPerks.mjs';
import { calculatePhenotype } from '../modules/horses/index.mjs';

// Shapes a Prisma JSONB column can legitimately arrive as on a legacy row.
const BAD_SHAPES = [
  ['null', null],
  ['undefined', undefined],
  ['primitive number', 42],
  ['primitive string', 'corrupted'],
  ['array', ['unexpected', 'array']],
  ['object missing sub-keys', { somethingElse: true }],
];

// ── asFlagObject helper ────────────────────────────────────────────────────

describe('asFlagObject (Equoria-liy7c)', () => {
  it('returns a plain object unchanged', () => {
    const o = { positive: ['a'] };
    expect(asFlagObject(o)).toBe(o);
  });

  // An object that is missing the expected sub-keys is STILL a valid plain
  // object — asFlagObject keeps it; the downstream per-key asFlagArray handles
  // the missing/wrong sub-key. Only the genuinely non-object shapes collapse.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['primitive number', 42],
    ['primitive string', 'corrupted'],
    ['array', ['unexpected', 'array']],
  ])('returns {} for %s', (_label, value) => {
    expect(asFlagObject(value)).toEqual({});
  });

  it('returns {} for an array (typeof [] === object must not slip through)', () => {
    expect(asFlagObject(['x'])).toEqual({});
  });

  it('keeps an object that is missing the expected sub-keys', () => {
    const o = { somethingElse: true };
    expect(asFlagObject(o)).toBe(o);
  });
});

// ── ultraRareMechanicalEffects — every exported reader ──────────────────────

describe('ultraRareMechanicalEffects tolerate malformed ultraRareTraits (Equoria-liy7c)', () => {
  it.each(BAD_SHAPES)('applyUltraRareStressEffects does not throw when ultraRareTraits is %s', (_label, value) => {
    const horse = { id: 1, ultraRareTraits: value };
    expect(() => applyUltraRareStressEffects(horse, 10, 'training')).not.toThrow();
    const result = applyUltraRareStressEffects(horse, 10, 'training');
    expect(result.modifiedStress).toBe(10); // no traits → unchanged
  });

  it.each(BAD_SHAPES)('applyUltraRareStressDecayEffects does not throw when ultraRareTraits is %s', (_label, value) => {
    expect(() => applyUltraRareStressDecayEffects({ ultraRareTraits: value }, 5)).not.toThrow();
  });

  it.each(BAD_SHAPES)('applyUltraRareTrainingEffects does not throw when ultraRareTraits is %s', (_label, value) => {
    expect(() => applyUltraRareTrainingEffects({ ultraRareTraits: value }, {})).not.toThrow();
  });

  it.each(BAD_SHAPES)('applyUltraRareCompetitionEffects does not throw when ultraRareTraits is %s', (_label, value) => {
    expect(() => applyUltraRareCompetitionEffects({ ultraRareTraits: value }, 100)).not.toThrow();
  });

  it.each(BAD_SHAPES)('applyUltraRareBondingEffects does not throw when ultraRareTraits is %s', (_label, value) => {
    expect(() => applyUltraRareBondingEffects({ ultraRareTraits: value }, 3)).not.toThrow();
  });

  it.each(BAD_SHAPES)('applyUltraRareBurnoutEffects does not throw when ultraRareTraits is %s', (_label, value) => {
    expect(() => applyUltraRareBurnoutEffects({ ultraRareTraits: value }, 7)).not.toThrow();
  });

  it.each(BAD_SHAPES)('applyUltraRareStatEffects does not throw when ultraRareTraits is %s', (_label, value) => {
    expect(() => applyUltraRareStatEffects({ ultraRareTraits: value }, { speed: 10 })).not.toThrow();
  });

  it.each(BAD_SHAPES)('hasUltraRareAbility returns false (no throw) when ultraRareTraits is %s', (_label, value) => {
    expect(hasUltraRareAbility({ ultraRareTraits: value }, 'stress_immunity')).toBe(false);
  });

  it('handles a whole horse with no ultraRareTraits property at all', () => {
    expect(() => applyUltraRareStressEffects({ id: 99 }, 10)).not.toThrow();
  });
});

// ── groomRareTraitPerks.applyRareTraitBoosterEffects ────────────────────────

describe('applyRareTraitBoosterEffects tolerates malformed rareTraitPerks (Equoria-liy7c)', () => {
  it.each(BAD_SHAPES)('does not throw when rareTraitPerks is %s', (_label, value) => {
    expect(() => applyRareTraitBoosterEffects('phoenix-born', 0.1, { rareTraitPerks: value })).not.toThrow();
    const result = applyRareTraitBoosterEffects('phoenix-born', 0.1, { rareTraitPerks: value });
    expect(result.modifiedChance).toBe(0.1); // no perks → base chance unchanged
  });
});

// ── phenotypeCalculationService.calculatePhenotype ──────────────────────────

describe('calculatePhenotype tolerates malformed colorGenotype (Equoria-liy7c)', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['primitive', 7],
    ['array', ['E/e']],
    ['empty object', {}],
  ])('returns Unknown (no throw) for %s genotype', (_label, value) => {
    expect(() => calculatePhenotype(value)).not.toThrow();
    expect(calculatePhenotype(value).colorName).toBe('Unknown');
  });

  it('still computes a real phenotype for a valid genotype object (guard does not over-trigger)', () => {
    const valid = { E_Extension: 'e/e', A_Agouti: 'a/a' };
    const result = calculatePhenotype(valid);
    expect(result.colorName).not.toBe('Unknown');
  });
});

// ── asFlagArray sub-key behaviour (combined guard) ──────────────────────────

describe('asFlagArray over asFlagObject sub-key (Equoria-liy7c)', () => {
  it('safely extracts a sub-array even when the parent is an array', () => {
    expect(asFlagArray(asFlagObject(['x']).positive)).toEqual([]);
  });

  it('safely extracts a sub-array when the sub-key is a non-array', () => {
    expect(asFlagArray(asFlagObject({ positive: 'not-an-array' }).positive)).toEqual([]);
  });

  it('returns the real sub-array when shapes are valid', () => {
    expect(asFlagArray(asFlagObject({ positive: ['a', 'b'] }).positive)).toEqual(['a', 'b']);
  });
});
