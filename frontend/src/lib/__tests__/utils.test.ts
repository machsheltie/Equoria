/**
 * utils.ts tests — getBreedName fallback (Equoria-zf80)
 *
 * getBreedName feeds HorseDetailPage:562 directly adjacent to the
 * Equoria-iwy3 color readout. Per the iwy3 / 1k4n convention a
 * missing/unknown breed must render the honest 'not recorded' string,
 * never the bare literal 'Unknown'. These are sentinel-positive tests:
 * each asserts the correct value AND that 'Unknown' never appears.
 */

import { describe, it, expect } from 'vitest';
import { getBreedName } from '../utils';

describe('getBreedName (Equoria-zf80)', () => {
  it('returns the string as-is when breed is a plain string', () => {
    expect(getBreedName('Thoroughbred')).toBe('Thoroughbred');
  });

  it('extracts .name when breed is an object', () => {
    expect(getBreedName({ id: 1, name: 'Arabian', description: 'x' })).toBe('Arabian');
  });

  it("returns 'not recorded' (never 'Unknown') for null/undefined breed", () => {
    expect(getBreedName(null)).toBe('not recorded');
    expect(getBreedName(undefined)).toBe('not recorded');
    // Sentinel-positive: the exact defect (literal 'Unknown') must not appear.
    expect(getBreedName(null)).not.toBe('Unknown');
  });

  it("returns 'not recorded' for empty string (falsy) breed", () => {
    expect(getBreedName('')).toBe('not recorded');
  });

  it("returns 'not recorded' for an object without a name key", () => {
    expect(getBreedName({ id: 5 })).toBe('not recorded');
    expect(getBreedName({ id: 5 })).not.toBe('Unknown');
  });

  it("returns 'not recorded' for a non-string non-object (number)", () => {
    // Exercises the final fallthrough branch.
    expect(getBreedName(42)).toBe('not recorded');
  });
});
