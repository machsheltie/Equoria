/**
 * epigeneticFlagDefinitions — unit tests (Equoria-rr7)
 *
 * Pure functions, no imports. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  FLAG_TYPES,
  MAX_FLAGS_PER_HORSE,
  FLAG_EVALUATION_AGE_RANGE,
  SOURCE_CATEGORIES,
  EPIGENETIC_FLAG_DEFINITIONS,
  getAllFlagDefinitions,
  getFlagDefinition,
  getFlagsByType,
  getFlagsBySourceCategory,
  flagsConflict,
} from '../../config/epigeneticFlagDefinitions.mjs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('FLAG_TYPES', () => {
  it('has POSITIVE, NEGATIVE, ADAPTIVE', () => {
    expect(FLAG_TYPES.POSITIVE).toBe('positive');
    expect(FLAG_TYPES.NEGATIVE).toBe('negative');
    expect(FLAG_TYPES.ADAPTIVE).toBeDefined();
  });
});

describe('MAX_FLAGS_PER_HORSE', () => {
  it('is a positive number', () => {
    expect(typeof MAX_FLAGS_PER_HORSE).toBe('number');
    expect(MAX_FLAGS_PER_HORSE).toBeGreaterThan(0);
  });

  it('is 5', () => {
    expect(MAX_FLAGS_PER_HORSE).toBe(5);
  });
});

describe('FLAG_EVALUATION_AGE_RANGE', () => {
  it('has MIN of 0 and MAX of 3', () => {
    expect(FLAG_EVALUATION_AGE_RANGE.MIN).toBe(0);
    expect(FLAG_EVALUATION_AGE_RANGE.MAX).toBe(3);
  });
});

describe('SOURCE_CATEGORIES', () => {
  it('includes GROOMING, BONDING, ENVIRONMENT, NOVELTY', () => {
    expect(SOURCE_CATEGORIES.GROOMING).toBeDefined();
    expect(SOURCE_CATEGORIES.BONDING).toBeDefined();
    expect(SOURCE_CATEGORIES.ENVIRONMENT).toBeDefined();
    expect(SOURCE_CATEGORIES.NOVELTY).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// EPIGENETIC_FLAG_DEFINITIONS
// ---------------------------------------------------------------------------
describe('EPIGENETIC_FLAG_DEFINITIONS', () => {
  it('is a non-empty object', () => {
    expect(typeof EPIGENETIC_FLAG_DEFINITIONS).toBe('object');
    expect(Object.keys(EPIGENETIC_FLAG_DEFINITIONS).length).toBeGreaterThan(0);
  });

  it('includes BRAVE (positive flag)', () => {
    expect(EPIGENETIC_FLAG_DEFINITIONS.BRAVE).toBeDefined();
    expect(EPIGENETIC_FLAG_DEFINITIONS.BRAVE.type).toBe(FLAG_TYPES.POSITIVE);
  });

  it('includes FRAGILE (negative flag)', () => {
    expect(EPIGENETIC_FLAG_DEFINITIONS.FRAGILE).toBeDefined();
    expect(EPIGENETIC_FLAG_DEFINITIONS.FRAGILE.type).toBe(FLAG_TYPES.NEGATIVE);
  });

  it('each flag has name, displayName, type, sourceCategory, description', () => {
    for (const [, flag] of Object.entries(EPIGENETIC_FLAG_DEFINITIONS)) {
      expect(typeof flag.name).toBe('string');
      expect(typeof flag.displayName).toBe('string');
      expect(typeof flag.type).toBe('string');
      expect(typeof flag.sourceCategory).toBe('string');
      expect(typeof flag.description).toBe('string');
    }
  });

  it('each flag has influences object', () => {
    for (const [, flag] of Object.entries(EPIGENETIC_FLAG_DEFINITIONS)) {
      expect(typeof flag.influences).toBe('object');
    }
  });
});

// ---------------------------------------------------------------------------
// getAllFlagDefinitions
// ---------------------------------------------------------------------------
describe('getAllFlagDefinitions', () => {
  it('returns the EPIGENETIC_FLAG_DEFINITIONS object', () => {
    expect(getAllFlagDefinitions()).toEqual(EPIGENETIC_FLAG_DEFINITIONS);
  });

  it('is non-empty', () => {
    expect(Object.keys(getAllFlagDefinitions()).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getFlagDefinition
// ---------------------------------------------------------------------------
describe('getFlagDefinition', () => {
  it('returns definition for BRAVE (case-insensitive — uppercase)', () => {
    const def = getFlagDefinition('BRAVE');
    expect(def).not.toBeNull();
    expect(def.name).toBe('brave');
  });

  it('accepts lowercase input (normalizes to uppercase internally)', () => {
    const def = getFlagDefinition('brave');
    expect(def).not.toBeNull();
  });

  it('returns null for unknown flag', () => {
    expect(getFlagDefinition('TELEKINESIS')).toBeNull();
  });

  it('FRAGILE has type negative', () => {
    expect(getFlagDefinition('FRAGILE').type).toBe('negative');
  });

  it('BRAVE has sourceCategory novelty', () => {
    expect(getFlagDefinition('BRAVE').sourceCategory).toBe(SOURCE_CATEGORIES.NOVELTY);
  });
});

// ---------------------------------------------------------------------------
// getFlagsByType
// ---------------------------------------------------------------------------
describe('getFlagsByType', () => {
  it('returns an array for positive type', () => {
    expect(Array.isArray(getFlagsByType('positive'))).toBe(true);
  });

  it('all returned flags have matching type', () => {
    const positives = getFlagsByType('positive');
    for (const flag of positives) {
      expect(flag.type).toBe('positive');
    }
  });

  it('returns non-empty array for negative type', () => {
    const negatives = getFlagsByType('negative');
    expect(negatives.length).toBeGreaterThan(0);
    for (const flag of negatives) {
      expect(flag.type).toBe('negative');
    }
  });

  it('returns empty array for unknown type', () => {
    expect(getFlagsByType('mythical')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getFlagsBySourceCategory
// ---------------------------------------------------------------------------
describe('getFlagsBySourceCategory', () => {
  it('returns an array for novelty category', () => {
    const flags = getFlagsBySourceCategory('novelty');
    expect(Array.isArray(flags)).toBe(true);
  });

  it('BRAVE appears in novelty category results', () => {
    const flags = getFlagsBySourceCategory('novelty');
    const names = flags.map(f => f.name);
    expect(names).toContain('brave');
  });

  it('returns empty array for unknown category', () => {
    expect(getFlagsBySourceCategory('mythical')).toHaveLength(0);
  });

  it('all returned flags have the requested sourceCategory', () => {
    const flags = getFlagsBySourceCategory('environment');
    for (const flag of flags) {
      expect(flag.sourceCategory).toBe('environment');
    }
  });
});

// ---------------------------------------------------------------------------
// flagsConflict
// ---------------------------------------------------------------------------
describe('flagsConflict', () => {
  it('returns false for unknown flags', () => {
    expect(flagsConflict('UNKNOWN_A', 'UNKNOWN_B')).toBe(false);
  });

  it('BRAVE and FRAGILE — check conflict (depends on definitions)', () => {
    // Just verify it returns a boolean without throwing
    const result = flagsConflict('BRAVE', 'FRAGILE');
    expect(typeof result).toBe('boolean');
  });

  it('returns false when one flag is unknown', () => {
    expect(flagsConflict('BRAVE', 'TELEKINESIS')).toBe(false);
  });

  it('is symmetric — FRAGILE vs BRAVE same as BRAVE vs FRAGILE', () => {
    const r1 = flagsConflict('BRAVE', 'FRAGILE');
    const r2 = flagsConflict('FRAGILE', 'BRAVE');
    expect(r1).toBe(r2);
  });

  it('BRAVE does not conflict with itself (no self-conflict)', () => {
    // A flag should not list itself in conflictsWith
    const braveDef = getFlagDefinition('BRAVE');
    if (braveDef && braveDef.conflictsWith) {
      expect(braveDef.conflictsWith).not.toContain('brave');
    }
  });
});
