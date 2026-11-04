/**
 * featureFlags — unit tests (Equoria-rr7)
 *
 * Pure data + lookup functions, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  flagDefinitions,
  flagDefaults,
  getFlagDefinition,
  isFlagDefined,
  getFlagsByType,
  getFlagsByCategory,
} from '../utils/featureFlags.mjs';

describe('flagDefinitions', () => {
  it('is a non-empty object', () => {
    expect(typeof flagDefinitions).toBe('object');
    expect(Object.keys(flagDefinitions).length).toBeGreaterThan(0);
  });

  it('every entry has type, description, and defaultValue', () => {
    for (const [, def] of Object.entries(flagDefinitions)) {
      expect(def).toHaveProperty('type');
      expect(def).toHaveProperty('description');
      expect(def).toHaveProperty('defaultValue');
    }
  });

  it('every key starts with FF_', () => {
    for (const key of Object.keys(flagDefinitions)) {
      expect(key.startsWith('FF_')).toBe(true);
    }
  });
});

describe('flagDefaults', () => {
  it('has the same keys as flagDefinitions', () => {
    const defKeys = Object.keys(flagDefinitions).sort();
    const defaultKeys = Object.keys(flagDefaults).sort();
    expect(defaultKeys).toEqual(defKeys);
  });

  it('values match the defaultValue of each definition', () => {
    for (const [key, value] of Object.entries(flagDefaults)) {
      expect(value).toBe(flagDefinitions[key].defaultValue);
    }
  });
});

describe('getFlagDefinition', () => {
  it('returns the definition for a known flag', () => {
    const firstKey = Object.keys(flagDefinitions)[0];
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
    const firstKey = Object.keys(flagDefinitions)[0];
    expect(isFlagDefined(firstKey)).toBe(true);
  });

  it('returns false for an unknown flag', () => {
    expect(isFlagDefined('FF_IMAGINARY_FLAG')).toBe(false);
  });
});

describe('getFlagsByType', () => {
  it('returns an array of flag names for boolean type', () => {
    const boolFlags = getFlagsByType('boolean');
    expect(Array.isArray(boolFlags)).toBe(true);
    expect(boolFlags.length).toBeGreaterThan(0);
    for (const name of boolFlags) {
      expect(flagDefinitions[name].type).toBe('boolean');
    }
  });

  it('returns empty array for nonexistent type', () => {
    expect(getFlagsByType('madeUpType')).toEqual([]);
  });

  it('percentage flags all have numeric defaultValues', () => {
    const pctFlags = getFlagsByType('percentage');
    for (const name of pctFlags) {
      expect(typeof flagDefinitions[name].defaultValue).toBe('number');
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
