/**
 * Sentinel-positive regression test for Equoria-wiudw.
 *
 * ~9+ sites read .includes()/.forEach()/.length directly off the JSONB column
 * horse.epigeneticFlags with no null/Array guard. A legacy or bare-created
 * horse row with epigeneticFlags=null (or a non-array value) throws
 * "Cannot read properties of null (reading 'includes')" at runtime.
 *
 * These tests pass horse-shaped objects whose epigeneticFlags is null / a
 * non-array object through each unguarded code path. They MUST NOT throw.
 *
 * Sentinel-positive proof: reverting any guarded site back to a bare
 * `horse.epigeneticFlags.X` makes the corresponding test throw (verified by
 * temporarily un-guarding during development).
 *
 * No mocks, no DB — these reporting/classification functions accept plain
 * objects, so the guard is exercised directly.
 */

import { describe, it, expect } from '@jest/globals';
import { asFlagArray } from '../utils/jsonbArrayGuard.mjs';
// enhancedReportingService and its null-guard cases went with the trait
// reports (owner ruling 2026-10-28, q152; Equoria-a7f1p). The temperament
// classifier's cases went with the epigeneticFlags store (owner ruling
// 2026-10-29, q300, Equoria-efs4j): no code reads that column any more.

describe('asFlagArray — JSONB four-part guard', () => {
  it('returns [] for null, undefined, primitives, and non-array objects', () => {
    expect(asFlagArray(null)).toEqual([]);
    expect(asFlagArray(undefined)).toEqual([]);
    expect(asFlagArray('fearful')).toEqual([]);
    expect(asFlagArray(42)).toEqual([]);
    expect(asFlagArray({ E: 'Ee' })).toEqual([]);
  });

  it('returns the array unchanged when it is a real array', () => {
    const arr = ['fearful', 'confident'];
    expect(asFlagArray(arr)).toBe(arr);
  });
});
