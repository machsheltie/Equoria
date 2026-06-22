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
import {
  generateStableOverview,
  analyzeTraitDistribution,
  generateHorseComparison,
  identifyTraitSimilarities,
  identifyTraitDifferences,
  generateHorseRankings,
  generateSummaryReport,
} from '../modules/labs/index.mjs';
import { classifyTemperamentFromFlags } from '../modules/horses/index.mjs';

// A horse row as Prisma may return it for a legacy/bare-created record:
// epigeneticFlags is null rather than an array.
const nullFlagsHorse = (id = 1) => ({
  id,
  name: `TestFixture-wiudw-${id}`,
  dateOfBirth: new Date('2025-01-01T00:00:00.000Z'),
  bondScore: 25,
  stressLevel: 3,
  epigeneticFlags: null,
});

// A pathological row where the JSONB value is a non-array object.
const objectFlagsHorse = (id = 2) => ({
  ...nullFlagsHorse(id),
  epigeneticFlags: { not: 'an array' },
});

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

describe('enhancedReportingService — does not crash on null/non-array epigeneticFlags (Equoria-wiudw)', () => {
  it('generateStableOverview tolerates null flags', () => {
    expect(() => generateStableOverview([nullFlagsHorse(), objectFlagsHorse()])).not.toThrow();
  });

  it('analyzeTraitDistribution tolerates null flags', () => {
    expect(() => analyzeTraitDistribution([nullFlagsHorse(), objectFlagsHorse()])).not.toThrow();
  });

  it('generateHorseComparison tolerates null flags', async () => {
    await expect(generateHorseComparison([nullFlagsHorse(1), nullFlagsHorse(2)])).resolves.toBeDefined();
  });

  it('identifyTraitSimilarities tolerates null flags', () => {
    expect(() => identifyTraitSimilarities([nullFlagsHorse(1), nullFlagsHorse(2)])).not.toThrow();
  });

  it('identifyTraitDifferences tolerates null flags', () => {
    expect(() => identifyTraitDifferences([nullFlagsHorse(1), objectFlagsHorse(2)])).not.toThrow();
  });

  it('generateHorseRankings tolerates null flags', () => {
    expect(() => generateHorseRankings([nullFlagsHorse(1), nullFlagsHorse(2)])).not.toThrow();
  });

  it('generateSummaryReport tolerates null flags', async () => {
    const report = await generateSummaryReport(nullFlagsHorse());
    expect(report.basicInfo.traitCount).toBe(0);
    expect(report.basicInfo.traits).toEqual([]);
  });
});

describe('horseTemperamentAnalysis — does not crash on null/non-array flags (Equoria-wiudw)', () => {
  it('classifyTemperamentFromFlags tolerates null', async () => {
    const result = await classifyTemperamentFromFlags(null);
    expect(result.primaryTemperament).toBe('undetermined');
  });

  it('classifyTemperamentFromFlags tolerates a non-array object', async () => {
    const result = await classifyTemperamentFromFlags({ not: 'array' });
    expect(result.primaryTemperament).toBe('undetermined');
  });
});
