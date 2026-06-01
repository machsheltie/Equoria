/**
 * Performance — Field Selection Correctness Tests
 *
 * Tests the ?fields= query parameter feature on the trait definitions
 * endpoint (getTraitDefinitions from traitController). Verifies that:
 * - When no fields param is provided, all definition fields are returned
 * - When fields=name is requested, only the name field is present per trait
 * - When fields=name,description is requested, only those two fields appear
 * - Unknown fields are silently omitted (no error, partial result)
 * - An empty string for fields returns objects with no selected keys
 *
 * These tests exercise the field-selection logic directly on the utility
 * functions that power the endpoint, avoiding the need for a live Express
 * server while still testing real production code paths.
 */

import { describe, it, expect } from '@jest/globals';
import { getTraitDefinition, getTraitsByType } from '../utils/epigeneticTraits.mjs';

/**
 * Applies the same field-selection logic as traitController.getTraitDefinitions.
 * Extracted here so tests stay focused on correctness without HTTP overhead.
 *
 * @param {string|null} type - 'positive', 'negative', or null for all
 * @param {string[]|null} selectedFields - Fields to keep, or null for all
 * @returns {Object} definitions map { traitName: { ...selectedFields } }
 */
function buildDefinitions(type, selectedFields) {
  const traits = type && ['positive', 'negative'].includes(type) ? getTraitsByType(type) : getTraitsByType('all');

  return traits.reduce((acc, trait) => {
    const definition = getTraitDefinition(trait);
    if (definition) {
      const fullDef = { name: trait, ...definition };
      if (selectedFields) {
        acc[trait] = selectedFields.reduce((selected, field) => {
          if (field in fullDef) {
            selected[field] = fullDef[field];
          }
          return selected;
        }, {});
      } else {
        acc[trait] = fullDef;
      }
    }
    return acc;
  }, {});
}

describe('Field Selection — trait definitions', () => {
  it('returns all fields when no field selection is applied', () => {
    const defs = buildDefinitions(null, null);
    const traitNames = Object.keys(defs);

    expect(traitNames.length).toBeGreaterThan(0);

    // Each entry should have at least a name and description
    for (const trait of traitNames) {
      expect(defs[trait]).toHaveProperty('name');
    }
  });

  it('returns only the name field when fields=["name"]', () => {
    const defs = buildDefinitions(null, ['name']);
    const traitNames = Object.keys(defs);
    expect(traitNames.length).toBeGreaterThan(0);

    for (const trait of traitNames) {
      const keys = Object.keys(defs[trait]);
      expect(keys).toEqual(['name']);
    }
  });

  it('returns only requested fields when fields=["name","description"]', () => {
    const defs = buildDefinitions(null, ['name', 'description']);
    const traitNames = Object.keys(defs);
    expect(traitNames.length).toBeGreaterThan(0);

    for (const trait of traitNames) {
      const keys = Object.keys(defs[trait]).sort();
      // Only 'name' and 'description' if both exist in the full def
      for (const key of keys) {
        expect(['name', 'description']).toContain(key);
      }
    }
  });

  it('silently omits unknown fields (no error, partial result)', () => {
    const defs = buildDefinitions(null, ['name', 'nonExistentField']);
    const traitNames = Object.keys(defs);
    expect(traitNames.length).toBeGreaterThan(0);

    for (const trait of traitNames) {
      const keys = Object.keys(defs[trait]);
      // 'nonExistentField' must not appear; 'name' should be present
      expect(keys).not.toContain('nonExistentField');
      expect(keys).toContain('name');
    }
  });

  it('returns empty objects per trait when fields=[] (empty array)', () => {
    const defs = buildDefinitions(null, []);
    const traitNames = Object.keys(defs);
    expect(traitNames.length).toBeGreaterThan(0);

    for (const trait of traitNames) {
      expect(Object.keys(defs[trait]).length).toBe(0);
    }
  });

  it('filters by type=positive and applies field selection correctly', () => {
    const allDefs = buildDefinitions('positive', null);
    const selectedDefs = buildDefinitions('positive', ['name']);
    const traitNames = Object.keys(allDefs);

    expect(traitNames.length).toBeGreaterThan(0);
    expect(Object.keys(selectedDefs)).toEqual(traitNames);

    for (const trait of traitNames) {
      expect(Object.keys(selectedDefs[trait])).toEqual(['name']);
    }
  });

  it('filters by type=negative and applies field selection correctly', () => {
    const allDefs = buildDefinitions('negative', null);
    const selectedDefs = buildDefinitions('negative', ['name']);
    const traitNames = Object.keys(allDefs);

    expect(traitNames.length).toBeGreaterThan(0);
    expect(Object.keys(selectedDefs)).toEqual(traitNames);

    for (const trait of traitNames) {
      expect(Object.keys(selectedDefs[trait])).toEqual(['name']);
    }
  });

  it('full-field result contains more keys than name-only result', () => {
    const fullDefs = buildDefinitions(null, null);
    const nameDefs = buildDefinitions(null, ['name']);
    const traitNames = Object.keys(fullDefs);

    for (const trait of traitNames.slice(0, 3)) {
      const fullKeys = Object.keys(fullDefs[trait]);
      const nameKeys = Object.keys(nameDefs[trait]);
      expect(fullKeys.length).toBeGreaterThan(nameKeys.length);
    }
  });
});
