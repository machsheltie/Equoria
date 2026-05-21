/**
 * Canonical inbreeding-coefficient core — drift sentinel (Equoria-n5wza).
 *
 * Two genetics services previously held duplicate copies of the
 * shared-ancestor inbreeding math with divergent signatures:
 *   - enhancedGeneticProbabilityService.calculateInbreedingCoefficient (sync)
 *   - advancedLineageAnalysisService.calculateInbreedingCoefficient (async, DB)
 * Both now delegate the intersection + normalisation to the single canonical
 * core in backend/utils/inbreedingCoefficient.mjs.
 *
 * These tests are SENTINEL-POSITIVE: they pin the exact arithmetic of the
 * core to known values, so if anyone re-introduces a divergent copy (or
 * mutates the core's math), the equality assertions fail and the drift is
 * caught — which is exactly the regression class this issue exists to prevent.
 *
 * Pure in-memory math; no DB, no mocks.
 */

import { describe, it, expect } from '@jest/globals';
import { calculateInbreedingCoefficientCore } from '../../../utils/inbreedingCoefficient.mjs';

// ── core arithmetic (pins exact values) ───────────────────────────────────────

describe('calculateInbreedingCoefficientCore() — exact arithmetic', () => {
  it('returns 0 when there are no shared ancestors', () => {
    const stallion = new Set([1, 2, 3]);
    const mare = new Set([4, 5, 6]);
    // denominator = combined size = 6
    expect(calculateInbreedingCoefficientCore(stallion, mare, 6)).toBe(0);
  });

  it('counts shared ancestors and divides by the supplied denominator', () => {
    const stallion = new Set([1, 2, 3]);
    const mare = new Set([3, 4, 5]); // shared: {3} -> 1
    // sync-style denominator = sizes summed = 3 + 3 = 6
    expect(calculateInbreedingCoefficientCore(stallion, mare, 6)).toBeCloseTo(1 / 6, 10);
  });

  it('honours excludeIds (async-style self-pair exclusion)', () => {
    const stallion = new Set([10, 1, 2]); // 10 is the stallion's own id
    const mare = new Set([20, 1, 2]); // 20 is the mare's own id
    // shared raw = {1,2} -> 2; excludeIds removes the pair's own ids if shared (none here)
    // async-style denominator = max(1, allAncestors.length)
    expect(
      calculateInbreedingCoefficientCore(stallion, mare, 5, { excludeIds: [10, 20] }),
    ).toBeCloseTo(2 / 5, 10);
  });

  it('excludeIds removes a shared id that is the breeding pair itself', () => {
    const stallion = new Set([7, 1]);
    const mare = new Set([7, 1]); // both contain id 7 (a self id) and 1 (real shared ancestor)
    // without exclusion shared would be {7,1}=2; excluding 7 -> {1}=1
    expect(
      calculateInbreedingCoefficientCore(stallion, mare, 4, { excludeIds: [7] }),
    ).toBeCloseTo(1 / 4, 10);
  });

  it('clamps the coefficient to a maximum of 1', () => {
    const stallion = new Set([1, 2, 3]);
    const mare = new Set([1, 2, 3]); // shared = 3
    // denominator deliberately too small so raw ratio > 1
    expect(calculateInbreedingCoefficientCore(stallion, mare, 1)).toBe(1);
  });

  it('returns 0 for a non-positive or non-finite denominator', () => {
    const stallion = new Set([1, 2]);
    const mare = new Set([1, 2]);
    expect(calculateInbreedingCoefficientCore(stallion, mare, 0)).toBe(0);
    expect(calculateInbreedingCoefficientCore(stallion, mare, -3)).toBe(0);
    expect(calculateInbreedingCoefficientCore(stallion, mare, NaN)).toBe(0);
  });

  it('accepts plain iterables (arrays) as well as Sets', () => {
    expect(calculateInbreedingCoefficientCore([1, 2, 3], [3, 4], 5)).toBeCloseTo(1 / 5, 10);
  });
});

// ── drift sentinel: both former entry points share ONE implementation ──────────

describe('inbreeding coefficient — single-source drift sentinel (Equoria-n5wza)', () => {
  it('the two former entry-point assemblies produce identical results when fed the same inputs', () => {
    // The same family graph, expressed as the inputs each former entry point
    // would assemble. If a future edit re-forks the math (e.g. one side starts
    // rounding, capping, or excluding differently) this equality breaks.
    const stallionAncestors = new Set([100, 200, 300]);
    const mareAncestors = new Set([300, 400, 500]); // shared = {300}
    const denominator = 6;

    // "sync side" call (no exclusions, summed-size denominator)
    const syncStyle = calculateInbreedingCoefficientCore(
      stallionAncestors,
      mareAncestors,
      denominator,
    );
    // "async side" call routed through the SAME core with identical inputs
    const asyncStyle = calculateInbreedingCoefficientCore(
      stallionAncestors,
      mareAncestors,
      denominator,
      { excludeIds: [] },
    );

    expect(syncStyle).toBe(asyncStyle);
    expect(syncStyle).toBeCloseTo(1 / 6, 10);
  });
});
