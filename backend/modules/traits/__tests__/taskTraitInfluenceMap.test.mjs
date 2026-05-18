/**
 * taskTraitInfluenceMap — unit tests (Equoria-rr7)
 *
 * Pure functions, no DB or imports required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  TASK_TRAIT_INFLUENCE_MAP,
  TRAIT_INFLUENCE_CONFIG,
  getTaskTraitInfluence,
  getAllInfluenceableTraits,
  getTasksInfluencingTrait,
  validateTraitInfluenceMap,
} from '../../../utils/taskTraitInfluenceMap.mjs';

// ---------------------------------------------------------------------------
// TASK_TRAIT_INFLUENCE_MAP
// ---------------------------------------------------------------------------
describe('TASK_TRAIT_INFLUENCE_MAP', () => {
  it('is a non-empty object', () => {
    expect(typeof TASK_TRAIT_INFLUENCE_MAP).toBe('object');
    expect(Object.keys(TASK_TRAIT_INFLUENCE_MAP).length).toBeGreaterThan(0);
  });

  it('includes brushing task', () => {
    expect(TASK_TRAIT_INFLUENCE_MAP.brushing).toBeDefined();
  });

  it('each task has encourages and discourages arrays', () => {
    for (const [, influence] of Object.entries(TASK_TRAIT_INFLUENCE_MAP)) {
      expect(Array.isArray(influence.encourages)).toBe(true);
      expect(Array.isArray(influence.discourages)).toBe(true);
    }
  });

  it('brushing encourages bonded and patient', () => {
    expect(TASK_TRAIT_INFLUENCE_MAP.brushing.encourages).toContain('bonded');
    expect(TASK_TRAIT_INFLUENCE_MAP.brushing.encourages).toContain('patient');
  });

  it('brushing discourages aloof', () => {
    expect(TASK_TRAIT_INFLUENCE_MAP.brushing.discourages).toContain('aloof');
  });
});

// ---------------------------------------------------------------------------
// TRAIT_INFLUENCE_CONFIG
// ---------------------------------------------------------------------------
describe('TRAIT_INFLUENCE_CONFIG', () => {
  it('has PERMANENCE_THRESHOLD of 3', () => {
    expect(TRAIT_INFLUENCE_CONFIG.PERMANENCE_THRESHOLD).toBe(3);
  });

  it('has NEGATIVE_PERMANENCE_THRESHOLD of -3', () => {
    expect(TRAIT_INFLUENCE_CONFIG.NEGATIVE_PERMANENCE_THRESHOLD).toBe(-3);
  });

  it('has EPIGENETIC_AGE_THRESHOLD of 3 game-years (Equoria-if4q)', () => {
    // Equoria-if4q: corrected from the buggy 3*365=1095 (calendar days). The
    // threshold is canonical GAME-YEARS — getHorseAgeYears (1 game-week =
    // 1 game-year). The old value made every horse epigenetic-eligible forever
    // because game-year ages never approach 1095. Sentinel: must be exactly 3.
    expect(TRAIT_INFLUENCE_CONFIG.EPIGENETIC_AGE_THRESHOLD).toBe(3);
    // Guard against silent reversion back to the days-based bug.
    expect(TRAIT_INFLUENCE_CONFIG.EPIGENETIC_AGE_THRESHOLD).not.toBe(3 * 365);
  });

  it('has ENCOURAGE_VALUE of 1 and DISCOURAGE_VALUE of -1', () => {
    expect(TRAIT_INFLUENCE_CONFIG.ENCOURAGE_VALUE).toBe(1);
    expect(TRAIT_INFLUENCE_CONFIG.DISCOURAGE_VALUE).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// getTaskTraitInfluence
// ---------------------------------------------------------------------------
describe('getTaskTraitInfluence', () => {
  it('returns influence object for known task', () => {
    const influence = getTaskTraitInfluence('brushing');
    expect(influence).not.toBeNull();
    expect(influence).toHaveProperty('encourages');
    expect(influence).toHaveProperty('discourages');
  });

  it('returns null for unknown task', () => {
    expect(getTaskTraitInfluence('teleportation')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getTaskTraitInfluence(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getTaskTraitInfluence('')).toBeNull();
  });

  it('hand_walking encourages trusting and brave', () => {
    const influence = getTaskTraitInfluence('hand_walking');
    expect(influence.encourages).toContain('trusting');
    expect(influence.encourages).toContain('brave');
  });
});

// ---------------------------------------------------------------------------
// getAllInfluenceableTraits
// ---------------------------------------------------------------------------
describe('getAllInfluenceableTraits', () => {
  it('returns an array', () => {
    expect(Array.isArray(getAllInfluenceableTraits())).toBe(true);
  });

  it('returns a non-empty array', () => {
    expect(getAllInfluenceableTraits().length).toBeGreaterThan(0);
  });

  it('result is sorted alphabetically', () => {
    const traits = getAllInfluenceableTraits();
    const sorted = [...traits].sort();
    expect(traits).toEqual(sorted);
  });

  it('contains no duplicates', () => {
    const traits = getAllInfluenceableTraits();
    const unique = new Set(traits);
    expect(unique.size).toBe(traits.length);
  });

  it('includes bonded (from brushing)', () => {
    expect(getAllInfluenceableTraits()).toContain('bonded');
  });

  it('includes nervous (from hand_walking discourages)', () => {
    expect(getAllInfluenceableTraits()).toContain('nervous');
  });
});

// ---------------------------------------------------------------------------
// getTasksInfluencingTrait
// ---------------------------------------------------------------------------
describe('getTasksInfluencingTrait', () => {
  it('returns object with encouraging and discouraging arrays', () => {
    const result = getTasksInfluencingTrait('brave');
    expect(result).toHaveProperty('encouraging');
    expect(result).toHaveProperty('discouraging');
    expect(Array.isArray(result.encouraging)).toBe(true);
    expect(Array.isArray(result.discouraging)).toBe(true);
  });

  it('hand_walking appears in encouraging for brave', () => {
    const result = getTasksInfluencingTrait('brave');
    expect(result.encouraging).toContain('hand_walking');
  });

  it('nervous appears as discouraged by hand_walking', () => {
    const result = getTasksInfluencingTrait('nervous');
    expect(result.discouraging).toContain('hand_walking');
  });

  it('unknown trait returns empty arrays', () => {
    const result = getTasksInfluencingTrait('telekinesis');
    expect(result.encouraging).toEqual([]);
    expect(result.discouraging).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateTraitInfluenceMap
// ---------------------------------------------------------------------------
describe('validateTraitInfluenceMap', () => {
  it('returns object with isValid, errors, totalTraits, totalTasks', () => {
    const result = validateTraitInfluenceMap();
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('totalTraits');
    expect(result).toHaveProperty('totalTasks');
  });

  it('isValid is true (map is correctly defined)', () => {
    const result = validateTraitInfluenceMap();
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('totalTasks matches TASK_TRAIT_INFLUENCE_MAP key count', () => {
    const result = validateTraitInfluenceMap();
    expect(result.totalTasks).toBe(Object.keys(TASK_TRAIT_INFLUENCE_MAP).length);
  });

  it('totalTraits matches getAllInfluenceableTraits length', () => {
    const result = validateTraitInfluenceMap();
    expect(result.totalTraits).toBe(getAllInfluenceableTraits().length);
  });
});
