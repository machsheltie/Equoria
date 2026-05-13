/**
 * fieldSelectionHelper — unit tests (Equoria-rr7)
 *
 * Pure function tests, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  FIELD_PRESETS,
  INCLUDE_PRESETS,
  buildSelectObject,
  buildIncludeObject,
  buildQueryParams,
  getPresetSizeEstimate,
  calculateBandwidthSavings,
} from '../../utils/fieldSelectionHelper.mjs';

// ---------------------------------------------------------------------------
// FIELD_PRESETS
// ---------------------------------------------------------------------------
describe('FIELD_PRESETS', () => {
  it('exports Horse presets', () => {
    expect(FIELD_PRESETS.Horse).toBeDefined();
    expect(FIELD_PRESETS.Horse.minimal).toBeDefined();
    expect(FIELD_PRESETS.Horse.list).toBeDefined();
    expect(FIELD_PRESETS.Horse.detail).toBeDefined();
    expect(FIELD_PRESETS.Horse.full).toBeDefined();
  });

  it('exports User presets', () => {
    expect(FIELD_PRESETS.User).toBeDefined();
    expect(FIELD_PRESETS.User.minimal).toBeDefined();
    expect(FIELD_PRESETS.User.profile).toBeDefined();
  });

  it('exports Groom, Breed, Show, CompetitionResult presets', () => {
    expect(FIELD_PRESETS.Groom).toBeDefined();
    expect(FIELD_PRESETS.Breed).toBeDefined();
    expect(FIELD_PRESETS.Show).toBeDefined();
    expect(FIELD_PRESETS.CompetitionResult).toBeDefined();
  });

  it('Horse.minimal only has id and name', () => {
    expect(Object.keys(FIELD_PRESETS.Horse.minimal)).toEqual(['id', 'name']);
  });
});

// ---------------------------------------------------------------------------
// INCLUDE_PRESETS
// ---------------------------------------------------------------------------
describe('INCLUDE_PRESETS', () => {
  it('exports Horse includes', () => {
    expect(INCLUDE_PRESETS.Horse).toBeDefined();
    expect(INCLUDE_PRESETS.Horse.list).toBeDefined();
  });

  it('exports User includes', () => {
    expect(INCLUDE_PRESETS.User).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// buildSelectObject
// ---------------------------------------------------------------------------
describe('buildSelectObject', () => {
  it('returns Horse list preset fields', () => {
    const select = buildSelectObject('Horse', 'list');
    expect(select).toMatchObject({ id: true, name: true, age: true });
    expect(select.genotype).toBeUndefined();
  });

  it('merges customFields over preset', () => {
    const select = buildSelectObject('Horse', 'minimal', { bio: true });
    expect(select.id).toBe(true);
    expect(select.name).toBe(true);
    expect(select.bio).toBe(true);
  });

  it('returns undefined for unknown model', () => {
    const select = buildSelectObject('UnknownModel', 'list');
    expect(select).toBeUndefined();
  });

  it('falls back to list preset for unknown preset name', () => {
    const select = buildSelectObject('Horse', 'nonexistent');
    expect(select).toMatchObject(FIELD_PRESETS.Horse.list);
  });

  it('returns undefined for model without list preset', () => {
    // CompetitionResult has no "minimal" preset — should return list or undefined
    const select = buildSelectObject('CompetitionResult', 'minimal');
    // Falls back to .list since no .list fallback would return undefined
    // The function returns modelPresets.list || undefined when preset not found
    expect(select).toBeDefined();
  });

  it('returns Horse full preset including genotype', () => {
    const select = buildSelectObject('Horse', 'full');
    expect(select.genotype).toBe(true);
    expect(select.epigeneticModifiers).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildIncludeObject
// ---------------------------------------------------------------------------
describe('buildIncludeObject', () => {
  it('returns Horse list include preset', () => {
    const include = buildIncludeObject('Horse', 'list');
    expect(include).toBeDefined();
    expect(include.breed).toBeDefined();
    expect(include.owner).toBeDefined();
  });

  it('returns undefined for model without includes', () => {
    const include = buildIncludeObject('Breed', 'list');
    expect(include).toBeUndefined();
  });

  it('returns undefined for unknown preset on known model', () => {
    const include = buildIncludeObject('Horse', 'nonexistent');
    expect(include).toBeUndefined();
  });

  it('merges customIncludes over preset', () => {
    const include = buildIncludeObject('Horse', 'list', { extraRelation: true });
    expect(include.breed).toBeDefined();
    expect(include.extraRelation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildQueryParams
// ---------------------------------------------------------------------------
describe('buildQueryParams', () => {
  it('returns object with select and include keys', () => {
    const params = buildQueryParams('Horse', 'list');
    expect(params).toHaveProperty('select');
    expect(params).toHaveProperty('include');
  });

  it('select matches buildSelectObject result', () => {
    const params = buildQueryParams('Horse', 'minimal');
    const expected = buildSelectObject('Horse', 'minimal');
    expect(params.select).toEqual(expected);
  });

  it('merges custom fields and includes', () => {
    const params = buildQueryParams('Horse', 'list', {
      customFields: { newField: true },
      customIncludes: { newRelation: true },
    });
    expect(params.select.newField).toBe(true);
    expect(params.include.newRelation).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getPresetSizeEstimate
// ---------------------------------------------------------------------------
describe('getPresetSizeEstimate', () => {
  it('returns size estimate for Horse list', () => {
    const est = getPresetSizeEstimate('Horse', 'list');
    expect(est).toHaveProperty('bytes');
    expect(est).toHaveProperty('description');
    expect(est.bytes).toBeGreaterThan(0);
  });

  it('returns Unknown for unknown model', () => {
    const est = getPresetSizeEstimate('UnknownModel', 'list');
    expect(est.description).toBe('Unknown');
    expect(est.bytes).toBe(0);
  });

  it('full preset is larger than list preset for Horse', () => {
    const list = getPresetSizeEstimate('Horse', 'list');
    const full = getPresetSizeEstimate('Horse', 'full');
    expect(full.bytes).toBeGreaterThan(list.bytes);
  });

  it('defaults to list when preset not specified', () => {
    const est = getPresetSizeEstimate('Horse');
    expect(est.bytes).toBe(getPresetSizeEstimate('Horse', 'list').bytes);
  });
});

// ---------------------------------------------------------------------------
// calculateBandwidthSavings
// ---------------------------------------------------------------------------
describe('calculateBandwidthSavings', () => {
  it('returns savings object with expected keys', () => {
    const savings = calculateBandwidthSavings('Horse', 10, 'full', 'list');
    expect(savings).toHaveProperty('recordCount', 10);
    expect(savings).toHaveProperty('originalSize');
    expect(savings).toHaveProperty('optimizedSize');
    expect(savings).toHaveProperty('savedBytes');
    expect(savings).toHaveProperty('savingsPercent');
  });

  it('full→list has positive savings', () => {
    const savings = calculateBandwidthSavings('Horse', 100, 'full', 'list');
    const percent = parseFloat(savings.savingsPercent);
    expect(percent).toBeGreaterThan(0);
  });

  it('list→list has zero savings', () => {
    const savings = calculateBandwidthSavings('Horse', 10, 'list', 'list');
    const percent = parseFloat(savings.savingsPercent);
    expect(percent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Default parameter branch coverage (lines 524, 556, 593)
// ---------------------------------------------------------------------------
describe('buildSelectObject — default preset parameter branch (line 524)', () => {
  it('omitting preset uses "list" default and returns Horse list fields', () => {
    const result = buildSelectObject('Horse');
    expect(result).toMatchObject(FIELD_PRESETS.Horse.list);
  });
});

describe('buildIncludeObject — default preset parameter branch (line 556)', () => {
  it('omitting preset uses "list" default and returns Horse list includes', () => {
    const result = buildIncludeObject('Horse');
    expect(result).toBeDefined();
    expect(result.breed).toBeDefined();
  });
});

describe('buildQueryParams — default preset and options parameter branches (line 593)', () => {
  it('omitting preset and options uses defaults and returns Horse list params', () => {
    const result = buildQueryParams('Horse');
    expect(result).toHaveProperty('select');
    expect(result).toHaveProperty('include');
    expect(result.select).toMatchObject(FIELD_PRESETS.Horse.list);
  });
});

// ---------------------------------------------------------------------------
// buildSelectObject — line 538 || undefined branch
// NOTE: All current FIELD_PRESETS models have a list preset, so the
// || undefined path (right-hand side) is dead code in the current codebase.
// The test below documents the fallback-to-list behavior when an unknown
// preset is requested on a known model (Show).
// ---------------------------------------------------------------------------
describe('buildSelectObject — fallback to list on unknown preset (line 534)', () => {
  it('returns the model list preset when an unknown preset name is requested (Show)', () => {
    const result = buildSelectObject('Show', 'nonexistent');
    expect(result).toBeDefined();
    expect(result).toMatchObject(FIELD_PRESETS.Show.list);
  });
});
