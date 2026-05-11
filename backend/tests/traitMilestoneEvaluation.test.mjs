/**
 * Trait Milestone Evaluation Tests
 *
 * Tests the real evaluateEpigeneticTagsFromFoalTasks function against real
 * input data. No mocks of any kind.
 *
 * Because the function uses Math.random() internally, only deterministic
 * outcomes are covered here:
 *   - Null / empty / zero-count inputs → always []
 *   - Invalid task names (not in influence map) → ignored
 *   - Return value is always an array
 *   - Return value never contains duplicate traits
 *
 * Probability-based assertions ("trait X must appear when random < Y") are
 * intentionally omitted — they require controlling Math.random which is
 * forbidden by project rules.
 */

import { describe, it, expect } from '@jest/globals';
import { evaluateEpigeneticTagsFromFoalTasks } from '../utils/traitEvaluation.mjs';

describe('evaluateEpigeneticTagsFromFoalTasks', () => {
  it('returns [] for an empty task log', () => {
    const result = evaluateEpigeneticTagsFromFoalTasks({}, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('returns [] for a null task log', () => {
    const result = evaluateEpigeneticTagsFromFoalTasks(null, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('returns [] for an undefined task log', () => {
    const result = evaluateEpigeneticTagsFromFoalTasks(undefined, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('returns [] when every task count is zero', () => {
    const taskLog = {
      trust_building: 0,
      desensitization: 0,
      early_touch: 0,
    };

    const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('returns [] when every task count is negative', () => {
    const taskLog = {
      trust_building: -3,
      desensitization: -1,
    };

    const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('returns [] when all tasks are unknown (not in influence map)', () => {
    const taskLog = {
      invalid_task: 5,
      another_invalid: 10,
      totally_made_up: 3,
    };

    const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 0);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('always returns an array regardless of input', () => {
    const inputs = [
      [{}, 0],
      [null, 0],
      [{ trust_building: 5 }, 0],
      [{ trust_building: 5 }, 7],
      [{}, 15],
    ];

    for (const [taskLog, streak] of inputs) {
      const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, streak);
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('never returns duplicate traits', () => {
    const taskLog = {
      trust_building: 10,
      desensitization: 8,
      early_touch: 6,
      showground_exposure: 5,
      gentle_touch: 4,
    };

    const result = evaluateEpigeneticTagsFromFoalTasks(taskLog, 7);

    const unique = [...new Set(result)];
    expect(result.length).toBe(unique.length);
  });

  it('ignores unknown tasks but processes valid tasks normally', () => {
    const pureInvalid = { unknown_task: 5, fake_task: 10 };
    const pureValid = { trust_building: 5 };

    const invalidResult = evaluateEpigeneticTagsFromFoalTasks(pureInvalid, 0);
    const validResult = evaluateEpigeneticTagsFromFoalTasks(pureValid, 0);

    // Invalid tasks produce nothing
    expect(invalidResult).toEqual([]);
    // Valid tasks produce an array (may or may not contain traits due to random roll)
    expect(Array.isArray(validResult)).toBe(true);
  });
});
