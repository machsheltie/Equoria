/**
 * Unit tests for the canonical discipline-affinity trait key (Equoria-9o3n7.6,
 * §C/§F). Pure-function tests — no DB, no mocks needed.
 *
 * The legacy snake_case normalizer and its cases were removed in camelCase
 * phase 6 (Equoria-pjvp8.7): production holds no snake_case trait id.
 */

import { describe, it, expect } from '@jest/globals';
import { disciplineAffinityKey } from '../../../utils/epigeneticTraitKeyMap.mjs';
import { DISCIPLINES } from '../../../constants/schema.mjs';

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
