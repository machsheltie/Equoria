/**
 * Unit tests for riderFlagCompatibility (Equoria-yzqhj.6).
 *
 * Pure, deterministic. Verifies that behavioral-flag valence (sourced from the
 * canonical epigeneticFlagDefinitions, NOT a hardcoded list) maps to a
 * conservative, clamped rider-compatibility factor that can never invert the
 * rider effect, and is neutral (1.0) for no-flag / net-zero cases.
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateRiderFlagCompatibility,
  getNetFlagValence,
  FLAG_RIDER_COMPAT_PER_FLAG,
  FLAG_RIDER_COMPAT_CAP,
} from '../../../utils/riderFlagCompatibility.mjs';

describe('getNetFlagValence — valence from canonical flag definitions', () => {
  it('returns 0 for null/undefined/non-array (JSONB guard)', () => {
    expect(getNetFlagValence(null)).toBe(0);
    expect(getNetFlagValence(undefined)).toBe(0);
    expect(getNetFlagValence('brave')).toBe(0); // primitive, not an array
    expect(getNetFlagValence({ brave: true })).toBe(0); // object, not an array
  });

  it('returns 0 for empty array', () => {
    expect(getNetFlagValence([])).toBe(0);
  });

  it('counts positive flags as +1 each (from EPIGENETIC_FLAG_DEFINITIONS)', () => {
    expect(getNetFlagValence(['brave'])).toBe(1);
    expect(getNetFlagValence(['brave', 'confident', 'resilient'])).toBe(3);
  });

  it('counts negative flags as -1 each', () => {
    expect(getNetFlagValence(['fearful'])).toBe(-1);
    expect(getNetFlagValence(['fearful', 'insecure', 'skittish'])).toBe(-3);
  });

  it('nets positives against negatives', () => {
    expect(getNetFlagValence(['brave', 'fearful'])).toBe(0);
    expect(getNetFlagValence(['brave', 'confident', 'fearful'])).toBe(1);
  });

  it('ignores unknown flags (neutral)', () => {
    expect(getNetFlagValence(['brave', 'notARealFlag'])).toBe(1);
    expect(getNetFlagValence(['notARealFlag', 'alsoFake'])).toBe(0);
  });

  it('ignores non-string entries', () => {
    expect(getNetFlagValence(['brave', 42, null, { x: 1 }])).toBe(1);
  });
});

describe('calculateRiderFlagCompatibility — conservative clamped factor', () => {
  it('returns 1.0 (neutral) for no flags', () => {
    expect(calculateRiderFlagCompatibility([])).toBe(1.0);
    expect(calculateRiderFlagCompatibility(null)).toBe(1.0);
  });

  it('returns 1.0 (neutral) for net-zero valence', () => {
    expect(calculateRiderFlagCompatibility(['brave', 'fearful'])).toBe(1.0);
  });

  it('returns > 1.0 for net-positive valence', () => {
    expect(calculateRiderFlagCompatibility(['brave'])).toBeCloseTo(1 + FLAG_RIDER_COMPAT_PER_FLAG, 10);
    expect(calculateRiderFlagCompatibility(['brave', 'confident'])).toBeCloseTo(1 + 2 * FLAG_RIDER_COMPAT_PER_FLAG, 10);
  });

  it('returns < 1.0 for net-negative valence', () => {
    expect(calculateRiderFlagCompatibility(['fearful'])).toBeCloseTo(1 - FLAG_RIDER_COMPAT_PER_FLAG, 10);
  });

  it('clamps the total bias to ±CAP and NEVER goes non-positive (no sign inversion)', () => {
    // 9 net positive flags * 2% = 18% raw, clamped to +10%.
    const manyPositive = [
      'brave',
      'confident',
      'affectionate',
      'resilient',
      'brave',
      'confident',
      'resilient',
      'brave',
      'confident',
    ];
    expect(calculateRiderFlagCompatibility(manyPositive)).toBeCloseTo(1 + FLAG_RIDER_COMPAT_CAP, 10);

    const manyNegative = ['fearful', 'insecure', 'aloof', 'skittish', 'fragile', 'fearful', 'insecure'];
    const negFactor = calculateRiderFlagCompatibility(manyNegative);
    expect(negFactor).toBeCloseTo(1 - FLAG_RIDER_COMPAT_CAP, 10);
    expect(negFactor).toBeGreaterThan(0); // factor stays positive — cannot invert rider effect
  });
});
