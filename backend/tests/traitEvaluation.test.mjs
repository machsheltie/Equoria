/**
 * Trait Evaluation System Tests
 *
 * Tests the real evaluateTraitRevelation / getTraitDefinition /
 * getAllTraitDefinitions / TRAIT_DEFINITIONS / TRAIT_CONFLICTS
 * against live function logic. No mocks of any kind.
 *
 * evaluateTraitRevelation uses Math.random() internally. Tests in that section
 * are limited to inputs where the outcome is deterministic regardless of the
 * random roll (age gate blocks all trait candidates at day 0, negative-only
 * assertions that hold for any Math.random value, null foal throws always).
 *
 * The pure-data sections (getTraitDefinition, getAllTraitDefinitions,
 * TRAIT_DEFINITIONS, TRAIT_CONFLICTS) are fully deterministic and exhaustively
 * tested.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluateTraitRevelation,
  getTraitDefinition,
  getAllTraitDefinitions,
  TRAIT_DEFINITIONS,
  TRAIT_CONFLICTS,
} from '../utils/traitEvaluation.mjs';

// ─── evaluateTraitRevelation ──────────────────────────────────────────────────

describe('evaluateTraitRevelation', () => {
  const emptyTraits = { positive: [], negative: [], hidden: [] };

  it('returns the correct result shape', () => {
    const foal = { id: 1, name: 'Test Foal', age: 0, bondScore: 75, stressLevel: 20 };

    const result = evaluateTraitRevelation(foal, emptyTraits, 0);

    expect(result).toHaveProperty('positive');
    expect(result).toHaveProperty('negative');
    expect(result).toHaveProperty('hidden');
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
    expect(Array.isArray(result.hidden)).toBe(true);
  });

  it('reveals no traits on development day 0 (all traits require minAge >= 1)', () => {
    // Every trait in TRAIT_DEFINITIONS has minAge >= 1, so at day 0
    // shouldRevealTrait() returns false for all — Math.random is never called.
    const foal = { id: 1, name: 'Test Foal', age: 0, bondScore: 100, stressLevel: 0 };

    const result = evaluateTraitRevelation(foal, emptyTraits, 0);

    expect(result.positive).toHaveLength(0);
    expect(result.negative).toHaveLength(0);
    expect(result.hidden).toHaveLength(0);
  });

  it('does not re-add traits that already exist in currentTraits', () => {
    // existingTraits check happens BEFORE Math.random(), so deduplication is
    // deterministic — existing traits can never appear in the result regardless
    // of what Math.random returns.
    const foal = { id: 1, name: 'Test Foal', age: 0, bondScore: 75, stressLevel: 20 };
    const existingTraits = {
      positive: ['resilient'],
      negative: ['nervous'],
      hidden: ['intelligent'],
    };

    const result = evaluateTraitRevelation(foal, existingTraits, 6);

    const allNew = [...result.positive, ...result.negative, ...result.hidden];
    expect(allNew).not.toContain('resilient');
    expect(allNew).not.toContain('nervous');
    expect(allNew).not.toContain('intelligent');
  });

  it('never adds a trait that conflicts with an existing trait', () => {
    // hasTraitConflict() check also happens AFTER Math.random() but before push,
    // so conflicting traits can never appear in the result.
    const foal = { id: 1, name: 'Test Foal', age: 0, bondScore: 75, stressLevel: 20 };
    const existingTraits = { positive: ['calm'], negative: [], hidden: [] };

    const result = evaluateTraitRevelation(foal, existingTraits, 6);

    const allNew = [...result.positive, ...result.negative, ...result.hidden];
    const conflictsWithCalm = TRAIT_CONFLICTS.calm ?? [];
    for (const conflictTrait of conflictsWithCalm) {
      expect(allNew).not.toContain(conflictTrait);
    }
  });

  it('handles a foal with null bond_score and stress_level (uses defaults)', () => {
    // Implementation reads foal.bondScore and foal.stressLevel (camelCase).
    // Null snake_case fields have no effect; camelCase fields default to 50/0.
    const foal = { id: 1, name: 'Test Foal', age: 0, bond_score: null, stress_level: null };

    const result = evaluateTraitRevelation(foal, emptyTraits, 3);

    expect(result).toHaveProperty('positive');
    expect(result).toHaveProperty('negative');
    expect(result).toHaveProperty('hidden');
  });

  it('handles a foal with missing optional properties', () => {
    const incompleteFoal = { id: 1 };

    const result = evaluateTraitRevelation(incompleteFoal, emptyTraits, 3);

    expect(result).toHaveProperty('positive');
    expect(result).toHaveProperty('negative');
    expect(result).toHaveProperty('hidden');
  });

  it('throws when foal is null', () => {
    expect(() => {
      evaluateTraitRevelation(null, emptyTraits, 3);
    }).toThrow();
  });
});

// ─── getTraitDefinition ───────────────────────────────────────────────────────

describe('getTraitDefinition', () => {
  it('returns the definition for a valid positive trait key', () => {
    const definition = getTraitDefinition('resilient');

    expect(definition).toBeDefined();
    expect(definition.name).toBe('Resilient');
    expect(definition.description).toBeDefined();
    expect(definition.revealConditions).toBeDefined();
  });

  it('returns null for an unrecognised trait key', () => {
    const definition = getTraitDefinition('invalid_trait');

    expect(definition).toBeNull();
  });

  it('finds traits across all three categories', () => {
    // positive
    expect(getTraitDefinition('resilient')).not.toBeNull();
    // negative
    expect(getTraitDefinition('nervous')).not.toBeNull();
    // rare
    expect(getTraitDefinition('legendary_bloodline')).not.toBeNull();
  });
});

// ─── getAllTraitDefinitions ───────────────────────────────────────────────────

describe('getAllTraitDefinitions', () => {
  it('returns an object with positive, negative, and rare categories', () => {
    const definitions = getAllTraitDefinitions();

    expect(definitions).toHaveProperty('positive');
    expect(definitions).toHaveProperty('negative');
    expect(definitions).toHaveProperty('rare');

    expect(Object.keys(definitions.positive).length).toBeGreaterThan(0);
    expect(Object.keys(definitions.negative).length).toBeGreaterThan(0);
    expect(Object.keys(definitions.rare).length).toBeGreaterThan(0);
  });

  it('every trait has the required fields with correct types', () => {
    const definitions = getAllTraitDefinitions();

    for (const category of Object.values(definitions)) {
      for (const trait of Object.values(category)) {
        expect(typeof trait.name).toBe('string');
        expect(typeof trait.description).toBe('string');
        expect(typeof trait.revealConditions).toBe('object');
        expect(typeof trait.rarity).toBe('string');
        expect(typeof trait.baseChance).toBe('number');
      }
    }
  });
});

// ─── TRAIT_DEFINITIONS ────────────────────────────────────────────────────────

describe('TRAIT_DEFINITIONS', () => {
  it('has valid reveal conditions for every trait', () => {
    for (const category of Object.values(TRAIT_DEFINITIONS)) {
      for (const trait of Object.values(category)) {
        const c = trait.revealConditions;

        // minAge within development day range
        expect(c.minAge).toBeGreaterThanOrEqual(0);
        expect(c.minAge).toBeLessThanOrEqual(6);

        if (c.minBondScore !== undefined) {
          expect(c.minBondScore).toBeGreaterThanOrEqual(0);
          expect(c.minBondScore).toBeLessThanOrEqual(100);
        }
        if (c.maxBondScore !== undefined) {
          expect(c.maxBondScore).toBeGreaterThanOrEqual(0);
          expect(c.maxBondScore).toBeLessThanOrEqual(100);
        }
        if (c.minStressLevel !== undefined) {
          expect(c.minStressLevel).toBeGreaterThanOrEqual(0);
          expect(c.minStressLevel).toBeLessThanOrEqual(100);
        }
        if (c.maxStressLevel !== undefined) {
          expect(c.maxStressLevel).toBeGreaterThanOrEqual(0);
          expect(c.maxStressLevel).toBeLessThanOrEqual(100);
        }

        // baseChance must be a valid probability
        expect(trait.baseChance).toBeGreaterThan(0);
        expect(trait.baseChance).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ─── TRAIT_CONFLICTS ─────────────────────────────────────────────────────────

describe('TRAIT_CONFLICTS', () => {
  it('is symmetric: if A conflicts with B then B conflicts with A', () => {
    for (const [trait, conflicts] of Object.entries(TRAIT_CONFLICTS)) {
      for (const conflictTrait of conflicts) {
        expect(TRAIT_CONFLICTS[conflictTrait]).toContain(trait);
      }
    }
  });

  it('only references traits that exist in TRAIT_DEFINITIONS', () => {
    const allTraitKeys = new Set();
    for (const category of Object.values(TRAIT_DEFINITIONS)) {
      for (const key of Object.keys(category)) {
        allTraitKeys.add(key);
      }
    }

    for (const [trait, conflicts] of Object.entries(TRAIT_CONFLICTS)) {
      expect(allTraitKeys.has(trait)).toBe(true);
      for (const conflictTrait of conflicts) {
        expect(allTraitKeys.has(conflictTrait)).toBe(true);
      }
    }
  });
});
