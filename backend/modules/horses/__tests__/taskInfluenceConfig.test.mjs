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
} from '../../../config/taskInfluenceConfig.mjs';
// merged from legacy backend/tests, Equoria-wvuin — foal-task coverage cross-check
import { ELIGIBLE_FOAL_ENRICHMENT_TASKS, FOAL_GROOMING_TASKS } from '../../../config/groomConfig.mjs';

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

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Structural / coverage / business-rule / data-quality invariants over
// TASK_TRAIT_INFLUENCE_MAP not covered by the utility-function tests above.
describe('TASK_TRAIT_INFLUENCE_MAP — config invariants (merged from legacy backend/tests, Equoria-wvuin)', () => {
  describe('structure & foal-task coverage', () => {
    it('has a {traits[], dailyValue} entry for every enrichment task', () => {
      ELIGIBLE_FOAL_ENRICHMENT_TASKS.forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).toHaveProperty(task);
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('traits');
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('dailyValue');
      });
    });

    it('has a {traits[], dailyValue} entry for every grooming task', () => {
      FOAL_GROOMING_TASKS.forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).toHaveProperty(task);
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('traits');
        expect(TASK_TRAIT_INFLUENCE_MAP[task]).toHaveProperty('dailyValue');
      });
    });

    it('each entry has non-empty string traits and a 1–10 dailyValue', () => {
      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        expect(Array.isArray(influence.traits)).toBe(true);
        expect(typeof influence.dailyValue).toBe('number');
        expect(influence.traits.length).toBeGreaterThan(0);
        expect(influence.dailyValue).toBeGreaterThan(0);
        expect(influence.dailyValue).toBeLessThanOrEqual(10);
        influence.traits.forEach(trait => {
          expect(typeof trait).toBe('string');
          expect(trait.length).toBeGreaterThan(0);
        });
      });
    });

    it('does not map non-foal tasks', () => {
      ['general_grooming', 'exercise', 'medical_check', 'feeding'].forEach(task => {
        expect(TASK_TRAIT_INFLUENCE_MAP).not.toHaveProperty(task);
      });
    });
  });

  describe('logical trait mappings', () => {
    it('enrichment tasks map to confidence/bonding/crowd traits', () => {
      expect(TASK_TRAIT_INFLUENCE_MAP.desensitization.traits).toContain('confident');
      expect(TASK_TRAIT_INFLUENCE_MAP.trust_building.traits).toContain('bonded');
      expect(TASK_TRAIT_INFLUENCE_MAP.trust_building.traits).toContain('resilient');
      expect(TASK_TRAIT_INFLUENCE_MAP.showground_exposure.traits).toContain('crowdReady');
      expect(TASK_TRAIT_INFLUENCE_MAP.showground_exposure.traits).toContain('confident');
    });

    it('grooming tasks map to calm/showCalm/presentation traits', () => {
      expect(TASK_TRAIT_INFLUENCE_MAP.early_touch.traits).toContain('calm');
      expect(TASK_TRAIT_INFLUENCE_MAP.hoof_handling.traits).toContain('showCalm');
      expect(TASK_TRAIT_INFLUENCE_MAP.tying_practice.traits).toContain('showCalm');
      expect(TASK_TRAIT_INFLUENCE_MAP.sponge_bath.traits).toContain('presentationBoosted');
      expect(TASK_TRAIT_INFLUENCE_MAP.coat_check.traits).toContain('presentationBoosted');
      expect(TASK_TRAIT_INFLUENCE_MAP.mane_tail_grooming.traits).toContain('presentationBoosted');
    });

    it('all dailyValues are the same consistent value of 5', () => {
      const unique = [...new Set(Object.values(TASK_TRAIT_INFLUENCE_MAP).map(i => i.dailyValue))];
      expect(unique).toHaveLength(1);
      expect(unique[0]).toBe(5);
    });

    it('no task lists a duplicate trait', () => {
      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        expect([...new Set(influence.traits)].length).toBe(influence.traits.length);
      });
    });
  });

  describe('business rules & integration', () => {
    it('no trait is overly dominant (≤5 tasks) and ≥6 distinct traits exist', () => {
      const counts = {};
      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        influence.traits.forEach(trait => {
          counts[trait] = (counts[trait] || 0) + 1;
        });
      });
      Object.values(counts).forEach(c => expect(c).toBeLessThanOrEqual(5));
      expect(Object.keys(counts).length).toBeGreaterThanOrEqual(6);
    });

    it('influence map exactly matches the foal task set (no extra, none missing)', () => {
      const allFoalTasks = [...ELIGIBLE_FOAL_ENRICHMENT_TASKS, ...FOAL_GROOMING_TASKS];
      const mapTasks = Object.keys(TASK_TRAIT_INFLUENCE_MAP);
      allFoalTasks.forEach(task => expect(mapTasks).toContain(task));
      mapTasks.forEach(task => expect(allFoalTasks).toContain(task));
      expect(mapTasks.length).toBe(allFoalTasks.length);
    });
  });

  describe('data quality', () => {
    it('trait names are descriptive camelCase letters (6–15 distinct)', () => {
      const allTraits = new Set();
      Object.values(TASK_TRAIT_INFLUENCE_MAP).forEach(influence => {
        influence.traits.forEach(trait => {
          allTraits.add(trait);
          expect(trait.length).toBeGreaterThan(3);
          expect(trait).toMatch(/^[a-zA-Z]+$/);
        });
      });
      expect(allTraits.size).toBeGreaterThanOrEqual(6);
      expect(allTraits.size).toBeLessThanOrEqual(15);
    });

    it('task names follow the lower_snake foal convention', () => {
      Object.keys(TASK_TRAIT_INFLUENCE_MAP).forEach(taskName => {
        expect(taskName).toMatch(/^[a-z_]+$/);
      });
    });
  });
});
