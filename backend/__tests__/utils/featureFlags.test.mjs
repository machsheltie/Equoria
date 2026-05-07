/**
 * featureFlags — unit tests (Equoria-rr7)
 *
 * Pure data + lookup functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  FLAG_DEFINITIONS,
  FLAG_DEFAULTS,
  getFlagDefinition,
  isFlagDefined,
  getFlagsByType,
  getFlagsByCategory,
} from '../../utils/featureFlags.mjs';

describe('FLAG_DEFINITIONS', () => {
  it('is a non-empty object', () => {
    expect(typeof FLAG_DEFINITIONS).toBe('object');
    expect(Object.keys(FLAG_DEFINITIONS).length).toBeGreaterThan(0);
  });

  it('every entry has type, description, and defaultValue', () => {
    for (const [, def] of Object.entries(FLAG_DEFINITIONS)) {
      expect(def).toHaveProperty('type');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('defaultValue');
    }
  });

  it('every key starts with FF_', () => {
    for (const key of Object.keys(FLAG_DEFINITIONS)) {
      expect(key.startsWith('FF_')).toBe(true);
    }
  });
});

describe('FLAG_DEFAULTS', () => {
  it('has the same keys as FLAG_DEFINITIONS', () => {
    const defKeys = Object.keys(FLAG_DEFINITIONS).sort();
    const defaultKeys = Object.keys(FLAG_DEFAULTS).sort();
    expect(defaultKeys).toEqual(defKeys);
  });

  it('values match the defaultValue of each definition', () => {
    for (const [key, value] of Object.entries(FLAG_DEFAULTS)) {
      expect(value).toBe(FLAG_DEFINITIONS[key].defaultValue);
    }
  });
});

describe('getFlagDefinition', () => {
  it('returns the definition for a known flag', () => {
    const firstKey = Object.keys(FLAG_DEFINITIONS)[0];
    const def = getFlagDefinition(firstKey);
    expect(def).toBeDefined();
    expect(def).toHaveProperty('type');
  });

  it('returns undefined for an unknown flag', () => {
    expect(getFlagDefinition('FF_DOES_NOT_EXIST')).toBeUndefined();
  });
});

describe('isFlagDefined', () => {
  it('returns true for a defined flag', () => {
    const firstKey = Object.keys(FLAG_DEFINITIONS)[0];
    expect(isFlagDefined(firstKey)).toBe(true);
  });

  it('returns false for an unknown flag', () => {
    expect(isFlagDefined('FF_IMAGINARY_FLAG')).toBe(false);
  });
});

describe('getFlagsByType', () => {
  it('returns an array of flag names for BOOLEAN type', () => {
    const boolFlags = getFlagsByType('BOOLEAN');
    expect(Array.isArray(boolFlags)).toBe(true);
    expect(boolFlags.length).toBeGreaterThan(0);
    for (const name of boolFlags) {
      expect(FLAG_DEFINITIONS[name].type).toBe('BOOLEAN');
    }
  });

  it('returns empty array for nonexistent type', () => {
    expect(getFlagsByType('MADE_UP_TYPE')).toEqual([]);
  });

  it('PERCENTAGE flags all have numeric defaultValues', () => {
    const pctFlags = getFlagsByType('PERCENTAGE');
    for (const name of pctFlags) {
      expect(typeof FLAG_DEFINITIONS[name].defaultValue).toBe('number');
    }
  });
});

describe('getFlagsByCategory', () => {
  it('returns AUTH flags', () => {
    const authFlags = getFlagsByCategory('AUTH');
    expect(authFlags.length).toBeGreaterThan(0);
    for (const name of authFlags) {
      expect(name.startsWith('FF_AUTH_')).toBe(true);
    }
  });

  it('returns empty array for nonexistent category', () => {
    expect(getFlagsByCategory('NONEXISTENT')).toEqual([]);
  });

  it('returns BREEDING flags', () => {
    const breedingFlags = getFlagsByCategory('BREEDING');
    expect(breedingFlags.length).toBeGreaterThan(0);
  });
});
