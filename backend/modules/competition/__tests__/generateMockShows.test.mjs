/**
 * generateMockShows — unit tests (Equoria-rr7)
 *
 * Pure functions (statMap import only). No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { generateMockShows, generateSingleMockShow } from '../../utils/generateMockShows.mjs';

// ---------------------------------------------------------------------------
// generateMockShows
// ---------------------------------------------------------------------------
describe('generateMockShows', () => {
  it('returns an array', () => {
    expect(Array.isArray(generateMockShows(5))).toBe(true);
  });

  it('returns exactly the requested count', () => {
    expect(generateMockShows(10)).toHaveLength(10);
    expect(generateMockShows(3)).toHaveLength(3);
  });

  it('returns empty array for count 0', () => {
    expect(generateMockShows(0)).toHaveLength(0);
  });

  it('defaults to 10 shows when no argument given', () => {
    expect(generateMockShows()).toHaveLength(10);
  });

  it('throws for negative count', () => {
    expect(() => generateMockShows(-1)).toThrow();
  });

  it('throws for non-number count', () => {
    expect(() => generateMockShows('five')).toThrow();
  });

  it('each show has expected shape fields', () => {
    const shows = generateMockShows(5);
    for (const show of shows) {
      expect(typeof show.id).toBe('number');
      expect(typeof show.name).toBe('string');
      expect(typeof show.discipline).toBe('string');
      expect(typeof show.levelMin).toBe('number');
      expect(typeof show.levelMax).toBe('number');
      expect(typeof show.entryFee).toBe('number');
      expect(typeof show.prize).toBe('number');
      expect(show.runDate instanceof Date).toBe(true);
    }
  });

  it('levelMin is between 1 and 7 (inclusive)', () => {
    const shows = generateMockShows(20);
    for (const show of shows) {
      expect(show.levelMin).toBeGreaterThanOrEqual(1);
      expect(show.levelMin).toBeLessThanOrEqual(7);
    }
  });

  it('levelMax is greater than levelMin', () => {
    const shows = generateMockShows(20);
    for (const show of shows) {
      expect(show.levelMax).toBeGreaterThan(show.levelMin);
    }
  });

  it('levelMax does not exceed 10', () => {
    const shows = generateMockShows(20);
    for (const show of shows) {
      expect(show.levelMax).toBeLessThanOrEqual(10);
    }
  });

  it('entryFee is between 100 and 500', () => {
    const shows = generateMockShows(20);
    for (const show of shows) {
      expect(show.entryFee).toBeGreaterThanOrEqual(100);
      expect(show.entryFee).toBeLessThanOrEqual(500);
    }
  });

  it('prize is between 500 and 2000', () => {
    const shows = generateMockShows(20);
    for (const show of shows) {
      expect(show.prize).toBeGreaterThanOrEqual(500);
      expect(show.prize).toBeLessThanOrEqual(2000);
    }
  });

  it('IDs are sequential starting from 1', () => {
    const shows = generateMockShows(5);
    for (let i = 0; i < 5; i++) {
      expect(shows[i].id).toBe(i + 1);
    }
  });

  it('names include discipline name', () => {
    const shows = generateMockShows(5);
    for (const show of shows) {
      expect(show.name).toContain(show.discipline);
    }
  });
});

// ---------------------------------------------------------------------------
// generateSingleMockShow
// ---------------------------------------------------------------------------
describe('generateSingleMockShow', () => {
  it('returns a single show object (not array)', () => {
    const show = generateSingleMockShow();
    expect(typeof show).toBe('object');
    expect(Array.isArray(show)).toBe(false);
  });

  it('has expected shape', () => {
    const show = generateSingleMockShow();
    expect(typeof show.id).toBe('number');
    expect(typeof show.name).toBe('string');
    expect(typeof show.discipline).toBe('string');
  });

  it('applies overrides correctly', () => {
    const show = generateSingleMockShow({ name: 'Custom Show', entryFee: 999 });
    expect(show.name).toBe('Custom Show');
    expect(show.entryFee).toBe(999);
  });

  it('preserves non-overridden fields', () => {
    const show = generateSingleMockShow({ name: 'Override Only' });
    expect(typeof show.discipline).toBe('string');
    expect(typeof show.levelMin).toBe('number');
  });

  it('empty overrides returns a valid show', () => {
    const show = generateSingleMockShow({});
    expect(show).not.toBeNull();
    expect(typeof show.id).toBe('number');
  });
});
