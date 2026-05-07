/**
 * taskInfluenceConfig — unit tests (Equoria-rr7)
 *
 * Pure functions, no imports. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import {
  TASK_TRAIT_INFLUENCE_MAP,
  getTaskInfluence,
  getTraitsInfluencedByTask,
  getDailyTraitValue,
  getTasksInfluencingTrait,
  getAllInfluencedTraits,
  calculateTraitPoints,
  validateTaskInfluenceMap,
} from '../../config/taskInfluenceConfig.mjs';

// ---------------------------------------------------------------------------
// TASK_TRAIT_INFLUENCE_MAP
// ---------------------------------------------------------------------------
describe('TASK_TRAIT_INFLUENCE_MAP', () => {
  it('is a non-empty object', () => {
    expect(typeof TASK_TRAIT_INFLUENCE_MAP).toBe('object');
    expect(Object.keys(TASK_TRAIT_INFLUENCE_MAP).length).toBeGreaterThan(0);
  });

  it('each task entry has traits array and dailyValue', () => {
    for (const [, task] of Object.entries(TASK_TRAIT_INFLUENCE_MAP)) {
      expect(Array.isArray(task.traits)).toBe(true);
      expect(typeof task.dailyValue).toBe('number');
      expect(task.dailyValue).toBeGreaterThan(0);
    }
  });

  it('each task influences at least one trait', () => {
    for (const [, task] of Object.entries(TASK_TRAIT_INFLUENCE_MAP)) {
      expect(task.traits.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// getTaskInfluence
// ---------------------------------------------------------------------------
describe('getTaskInfluence', () => {
  it('returns influence object for a known task', () => {
    const keys = Object.keys(TASK_TRAIT_INFLUENCE_MAP);
    const firstTask = keys[0];
    const influence = getTaskInfluence(firstTask);
    expect(influence).not.toBeNull();
    expect(Array.isArray(influence.traits)).toBe(true);
  });

  it('returns null for unknown task', () => {
    expect(getTaskInfluence('teleportation')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getTaskInfluence(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getTraitsInfluencedByTask
// ---------------------------------------------------------------------------
describe('getTraitsInfluencedByTask', () => {
  it('returns array of traits for known task', () => {
    const key = Object.keys(TASK_TRAIT_INFLUENCE_MAP)[0];
    const traits = getTraitsInfluencedByTask(key);
    expect(Array.isArray(traits)).toBe(true);
    expect(traits.length).toBeGreaterThan(0);
  });

  it('returns empty array for unknown task', () => {
    expect(getTraitsInfluencedByTask('unknown_task')).toEqual([]);
  });

  it('returns a copy (mutating result does not affect map)', () => {
    const key = Object.keys(TASK_TRAIT_INFLUENCE_MAP)[0];
    const traits = getTraitsInfluencedByTask(key);
    const originalLength = traits.length;
    traits.push('mutated');
    expect(getTraitsInfluencedByTask(key)).toHaveLength(originalLength);
  });
});

// ---------------------------------------------------------------------------
// getDailyTraitValue
// ---------------------------------------------------------------------------
describe('getDailyTraitValue', () => {
  it('returns positive number for known task', () => {
    const key = Object.keys(TASK_TRAIT_INFLUENCE_MAP)[0];
    const value = getDailyTraitValue(key);
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThan(0);
  });

  it('returns 0 for unknown task', () => {
    expect(getDailyTraitValue('unknown_task')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getTasksInfluencingTrait
// ---------------------------------------------------------------------------
describe('getTasksInfluencingTrait', () => {
  it('returns an array', () => {
    const allTraits = getAllInfluencedTraits();
    if (allTraits.length > 0) {
      const result = getTasksInfluencingTrait(allTraits[0]);
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('returns empty array for unknown trait', () => {
    expect(getTasksInfluencingTrait('telekinesis')).toEqual([]);
  });

  it('all returned tasks actually influence the trait', () => {
    const allTraits = getAllInfluencedTraits();
    for (const trait of allTraits.slice(0, 3)) {
      const tasks = getTasksInfluencingTrait(trait);
      for (const task of tasks) {
        const influence = TASK_TRAIT_INFLUENCE_MAP[task];
        expect(influence.traits).toContain(trait);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getAllInfluencedTraits
// ---------------------------------------------------------------------------
describe('getAllInfluencedTraits', () => {
  it('returns an array', () => {
    expect(Array.isArray(getAllInfluencedTraits())).toBe(true);
  });

  it('returns a non-empty array', () => {
    expect(getAllInfluencedTraits().length).toBeGreaterThan(0);
  });

  it('result is sorted alphabetically', () => {
    const traits = getAllInfluencedTraits();
    expect(traits).toEqual([...traits].sort());
  });

  it('contains no duplicates', () => {
    const traits = getAllInfluencedTraits();
    expect(new Set(traits).size).toBe(traits.length);
  });
});

// ---------------------------------------------------------------------------
// calculateTraitPoints
// ---------------------------------------------------------------------------
describe('calculateTraitPoints', () => {
  it('returns empty object for empty completions', () => {
    expect(calculateTraitPoints({})).toEqual({});
  });

  it('calculates points for a single known task', () => {
    const key = Object.keys(TASK_TRAIT_INFLUENCE_MAP)[0];
    const taskDef = TASK_TRAIT_INFLUENCE_MAP[key];
    const result = calculateTraitPoints({ [key]: 2 });
    const expectedPoints = taskDef.dailyValue * 2;
    for (const trait of taskDef.traits) {
      expect(result[trait]).toBe(expectedPoints);
    }
  });

  it('ignores zero-count completions', () => {
    const key = Object.keys(TASK_TRAIT_INFLUENCE_MAP)[0];
    const result = calculateTraitPoints({ [key]: 0 });
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('ignores unknown tasks', () => {
    const result = calculateTraitPoints({ unknown_task: 5 });
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('accumulates points from multiple tasks for the same trait', () => {
    // Find two tasks that share a common trait
    const entries = Object.entries(TASK_TRAIT_INFLUENCE_MAP);
    let sharedTrait = null;
    let task1 = null;
    let task2 = null;

    outer: for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [name1, def1] = entries[i];
        const [name2, def2] = entries[j];
        const common = def1.traits.find(t => def2.traits.includes(t));
        if (common) {
          sharedTrait = common;
          task1 = name1;
          task2 = name2;
          break outer;
        }
      }
    }

    if (sharedTrait && task1 && task2) {
      const result = calculateTraitPoints({ [task1]: 1, [task2]: 1 });
      const def1 = TASK_TRAIT_INFLUENCE_MAP[task1];
      const def2 = TASK_TRAIT_INFLUENCE_MAP[task2];
      expect(result[sharedTrait]).toBe(def1.dailyValue + def2.dailyValue);
    }
  });
});

// ---------------------------------------------------------------------------
// validateTaskInfluenceMap
// ---------------------------------------------------------------------------
describe('validateTaskInfluenceMap', () => {
  it('returns object with isValid and errors', () => {
    const result = validateTaskInfluenceMap();
    expect(result).toHaveProperty('isValid');
    expect(result).toHaveProperty('errors');
  });

  it('isValid is true for the real map', () => {
    const result = validateTaskInfluenceMap();
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
