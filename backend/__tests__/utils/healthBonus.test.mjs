/**
 * getHealthModifier — unit tests (Equoria-rr7)
 *
 * Pure lookup, no DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { getHealthModifier } from '../../utils/healthBonus.mjs';

describe('getHealthModifier', () => {
  it('returns 0.05 for Excellent', () => {
    expect(getHealthModifier('Excellent')).toBe(0.05);
  });

  it('returns 0.03 for Very Good', () => {
    expect(getHealthModifier('Very Good')).toBe(0.03);
  });

  it('returns 0 for Good (baseline)', () => {
    expect(getHealthModifier('Good')).toBe(0);
  });

  it('returns -0.03 for Fair', () => {
    expect(getHealthModifier('Fair')).toBe(-0.03);
  });

  it('returns -0.05 for Bad', () => {
    expect(getHealthModifier('Bad')).toBe(-0.05);
  });

  it('returns 0 for unknown rating', () => {
    expect(getHealthModifier('Unknown')).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(getHealthModifier(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(getHealthModifier('')).toBe(0);
  });
});
