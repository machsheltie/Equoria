/**
 * Unit + sentinel-positive tests for the canonical epigenetic-trait key map
 * (Equoria-9o3n7.6, §C). Pure-function tests — no DB, no mocks needed.
 *
 * Proves: (a) every legacy snake key normalizes to the documented camelCase;
 * (b) the affinity-key derivation is canonical and matches between the two
 * derivations (display-name and snake-prefix paths); (c) normalization is
 * idempotent; (d) the §E-dropped ghosts are NOT remapped; (e) the full
 * modifiers-shape normalizer rewrites all three arrays.
 */

import { describe, it, expect } from '@jest/globals';
import {
  LEGACY_TRAIT_KEY_MAP,
  disciplineAffinityKey,
  normalizeTraitKey,
  normalizeEpigeneticModifiers,
  normalizeStoredEpigeneticModifiers,
} from '../../../utils/epigeneticTraitKeyMap.mjs';
import { DISCIPLINES } from '../../../constants/schema.mjs';
import { getAllTraitEffects } from '../../../utils/traitEffects.mjs';

describe('LEGACY_TRAIT_KEY_MAP — every documented snake key maps to canonical camelCase', () => {
  const expected = {
    trainability_boost: 'trainabilityBoost',
    eager_learner: 'eagerLearner',
    low_immunity: 'lowImmunity',
    legendary_bloodline: 'legendaryBloodline',
    specialized_lineage: 'specializedLineage',
    legacy_talent: 'legacyTalent',
  };
  it('contains exactly the documented mappings', () => {
    expect({ ...LEGACY_TRAIT_KEY_MAP }).toEqual(expected);
  });
  it.each(Object.entries(expected))('normalizeTraitKey(%s) === %s', (legacy, canonical) => {
    expect(normalizeTraitKey(legacy)).toBe(canonical);
  });
});

describe('disciplineAffinityKey — canonical PascalCase derivation for all 24 disciplines', () => {
  it('derives disciplineAffinityShowJumping from "Show Jumping"', () => {
    expect(disciplineAffinityKey('Show Jumping')).toBe('disciplineAffinityShowJumping');
  });
  it('derives disciplineAffinityRacing from "Racing"', () => {
    expect(disciplineAffinityKey('Racing')).toBe('disciplineAffinityRacing');
  });
  it('derives disciplineAffinityCrossCountry from "Cross Country"', () => {
    expect(disciplineAffinityKey('Cross Country')).toBe('disciplineAffinityCrossCountry');
  });
  it('returns "" for invalid input (fail-safe, no throw)', () => {
    expect(disciplineAffinityKey('')).toBe('');
    expect(disciplineAffinityKey(null)).toBe('');
    expect(disciplineAffinityKey(undefined)).toBe('');
  });
  it('every canonical discipline produces a non-empty unique camelCase key', () => {
    const keys = Object.values(DISCIPLINES).map(disciplineAffinityKey);
    expect(keys.every(k => k.startsWith('disciplineAffinity') && k.length > 'disciplineAffinity'.length)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length); // no collisions
  });
});

describe('normalizeTraitKey — legacy snake-case affinity → canonical camelCase', () => {
  it('discipline_affinity_show_jumping → disciplineAffinityShowJumping (resolves the historic drift)', () => {
    expect(normalizeTraitKey('discipline_affinity_show_jumping')).toBe('disciplineAffinityShowJumping');
  });
  it('discipline_affinity_racing → disciplineAffinityRacing', () => {
    expect(normalizeTraitKey('discipline_affinity_racing')).toBe('disciplineAffinityRacing');
  });
  it('snake affinity normalize matches the display-name derivation for every discipline', () => {
    for (const discipline of Object.values(DISCIPLINES)) {
      const snake = `discipline_affinity_${discipline.toLowerCase().replace(/\s+/g, '_')}`;
      expect(normalizeTraitKey(snake)).toBe(disciplineAffinityKey(discipline));
    }
  });
});

describe('normalizeTraitKey — idempotency + pass-through', () => {
  it('canonical keys are returned unchanged (idempotent)', () => {
    for (const canonical of [
      'trainabilityBoost',
      'eagerLearner',
      'lowImmunity',
      'legendaryBloodline',
      'specializedLineage',
      'legacyTalent',
      'disciplineAffinityShowJumping',
      'resilient',
    ]) {
      expect(normalizeTraitKey(canonical)).toBe(canonical);
    }
  });
  it('§E-dropped ghosts are NOT remapped (left verbatim — they are removed, not renamed)', () => {
    for (const ghost of ['weatherImmunity', 'weather_immunity', 'nightVision', 'night_vision']) {
      expect(normalizeTraitKey(ghost)).toBe(ghost);
    }
  });
  it('non-string input returns input verbatim', () => {
    expect(normalizeTraitKey(null)).toBe(null);
    expect(normalizeTraitKey(undefined)).toBe(undefined);
  });
});

describe('normalizeEpigeneticModifiers — rewrites all three arrays', () => {
  it('normalizes positive/negative/hidden and defaults missing arrays', () => {
    const input = {
      positive: ['legacy_talent', 'resilient', 'discipline_affinity_show_jumping'],
      negative: ['low_immunity'],
      // hidden missing
    };
    expect(normalizeEpigeneticModifiers(input)).toEqual({
      positive: ['legacyTalent', 'resilient', 'disciplineAffinityShowJumping'],
      negative: ['lowImmunity'],
      hidden: [],
    });
  });
  it('handles null/garbage shapes without throwing', () => {
    expect(normalizeEpigeneticModifiers(null)).toEqual({ positive: [], negative: [], hidden: [] });
    expect(normalizeEpigeneticModifiers([])).toEqual({ positive: [], negative: [], hidden: [] });
  });
});

describe('normalizeStoredEpigeneticModifiers — the backfill keeps every stored key (Equoria-5ybnr)', () => {
  // The legacy (underscore) spelling of a canonical id, built here so this test
  // adds no snake_case literal of its own: eagerLearner -> eager + _ + learner.
  const legacyOf = canonical => canonical.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
  it('normalizes the four trait lists and keeps dormant, revealEvaluatedThroughDay and any other key', () => {
    const stored = {
      positive: [legacyOf('eagerLearner')],
      negative: [],
      hidden: [legacyOf('legendaryBloodline')],
      dormant: [legacyOf('legacyTalent'), 'fragile'],
      revealEvaluatedThroughDay: 5,
      futureKey: { kept: true },
    };
    expect(normalizeStoredEpigeneticModifiers(stored)).toEqual({
      positive: ['eagerLearner'],
      negative: [],
      hidden: ['legendaryBloodline'],
      dormant: ['legacyTalent', 'fragile'],
      revealEvaluatedThroughDay: 5,
      futureKey: { kept: true },
    });
  });
  it('adds no list the row did not have and leaves the input untouched', () => {
    const stored = { positive: [legacyOf('lowImmunity')], revealEvaluatedThroughDay: 2 };
    expect(normalizeStoredEpigeneticModifiers(stored)).toEqual({
      positive: ['lowImmunity'],
      revealEvaluatedThroughDay: 2,
    });
    expect(stored).toEqual({ positive: [legacyOf('lowImmunity')], revealEvaluatedThroughDay: 2 });
  });
  it('returns non-object shapes as they are', () => {
    expect(normalizeStoredEpigeneticModifiers(null)).toBeNull();
    expect(normalizeStoredEpigeneticModifiers([legacyOf('eagerLearner')])).toEqual([legacyOf('eagerLearner')]);
  });
});

describe('SENTINEL-POSITIVE: canonical keys resolve in traitEffects (proves the casing fix is real)', () => {
  const effects = getAllTraitEffects();
  // Old contract: all six remapped canonical keys had traitEffects entries.
  // Owner ruling 2026-10-27 (q117) replaced the roster; of the six only
  // eagerLearner is still a trait, so it alone keeps an entry and the other
  // five (no longer traits) resolve to nothing.
  it('the remapped canonical key still on the roster (eagerLearner) is a traitEffects entry; the rest are gone', () => {
    const canonical = Object.values(LEGACY_TRAIT_KEY_MAP);
    expect(canonical).toContain('eagerLearner');
    for (const key of canonical) {
      expect(Object.prototype.hasOwnProperty.call(effects, key)).toBe(key === 'eagerLearner');
    }
  });
  it('NO legacy snake key survives as a traitEffects entry (the rename is complete)', () => {
    for (const legacy of Object.keys(LEGACY_TRAIT_KEY_MAP)) {
      expect(Object.prototype.hasOwnProperty.call(effects, legacy)).toBe(false);
    }
  });
});
