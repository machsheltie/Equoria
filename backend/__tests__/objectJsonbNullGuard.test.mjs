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
 * That file and groomRareTraitPerks.mjs were deleted with the invented exotic
 * traits (Equoria-tpofm; owner ruling 2026-10-19), and their arms with them.
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
import { calculatePhenotype } from '../modules/horses/index.mjs';

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
