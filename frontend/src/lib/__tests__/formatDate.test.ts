/**
 * Sentinel coverage for the shared date-formatting util (Equoria-2dnd2).
 *
 * Proves the invalid-date fallback fires for every absent/unparseable input
 * (the "Invalid Date" leak class, Equoria-2bpd9/krjw5/f19cz) AND that valid
 * dates still format — a fallback-only test could pass against a helper that
 * returns the fallback for EVERYTHING, so the positive cases are required.
 */

import { describe, it, expect } from 'vitest';
import {
  DATE_UNAVAILABLE,
  toValidDate,
  formatDate,
  formatDateTime,
  formatTime,
  dateSortKey,
} from '../formatDate';

describe('toValidDate', () => {
  it('returns null for absent inputs (null / undefined / empty string)', () => {
    expect(toValidDate(null)).toBeNull();
    expect(toValidDate(undefined)).toBeNull();
    expect(toValidDate('')).toBeNull();
  });

  it('returns null for unparseable strings (the Invalid Date source)', () => {
    expect(toValidDate('not-a-date')).toBeNull();
    expect(toValidDate('2026-13-99')).toBeNull();
  });

  it('returns a Date for valid ISO strings, epoch numbers, and Date instances', () => {
    expect(toValidDate('2026-01-05T00:00:00.000Z')).toBeInstanceOf(Date);
    expect(toValidDate(0)).toBeInstanceOf(Date);
    expect(toValidDate(new Date('2026-01-05T00:00:00.000Z'))).toBeInstanceOf(Date);
  });
});

describe('formatDate', () => {
  it('SENTINEL: returns the fallback (never "Invalid Date") for absent/invalid input', () => {
    for (const bad of [null, undefined, '', 'garbage', '2026-99-99']) {
      const out = formatDate(bad);
      expect(out).toBe(DATE_UNAVAILABLE);
      expect(out).not.toContain('Invalid Date');
    }
  });

  it('formats a valid date in the default "Jan 5, 2026" shape', () => {
    // Use a midday UTC instant so the local-tz date does not slip to the 4th.
    expect(formatDate('2026-01-05T12:00:00.000Z')).toBe('Jan 5, 2026');
  });

  it('honours an explicit options override and a custom fallback', () => {
    expect(formatDate('2026-01-05T12:00:00.000Z', { year: 'numeric' })).toBe('2026');
    expect(formatDate(null, undefined, 'N/A')).toBe('N/A');
  });
});

describe('formatDateTime', () => {
  it('SENTINEL: returns the fallback (never "Invalid Date") for absent/invalid input', () => {
    for (const bad of [null, undefined, '', 'nope']) {
      const out = formatDateTime(bad);
      expect(out).toBe(DATE_UNAVAILABLE);
      expect(out).not.toContain('Invalid Date');
    }
  });

  it('includes a time component for a valid date', () => {
    const out = formatDateTime('2026-01-05T12:00:00.000Z');
    expect(out).not.toBe(DATE_UNAVAILABLE);
    // hour12 default → an AM/PM marker is present.
    expect(out).toMatch(/AM|PM/);
  });
});

describe('formatTime', () => {
  it('SENTINEL: returns the fallback (never "Invalid Date") for absent/invalid input', () => {
    for (const bad of [null, undefined, '', 'nope']) {
      const out = formatTime(bad);
      expect(out).toBe(DATE_UNAVAILABLE);
      expect(out).not.toContain('Invalid Date');
    }
  });

  it('formats a valid date as a time-only string with an AM/PM marker', () => {
    const out = formatTime('2026-01-05T15:04:00.000Z');
    expect(out).not.toBe(DATE_UNAVAILABLE);
    expect(out).toMatch(/AM|PM/);
    // time-only: no month/day/year tokens leak in
    expect(out).not.toMatch(/Jan|2026/);
  });
});

describe('dateSortKey', () => {
  it('returns the epoch-ms for a valid date', () => {
    expect(dateSortKey('1970-01-01T00:00:00.000Z')).toBe(0);
    expect(dateSortKey('2026-01-05T00:00:00.000Z')).toBe(Date.parse('2026-01-05T00:00:00.000Z'));
  });

  it('SENTINEL: returns the fallback (never NaN) for invalid input so comparators stay stable', () => {
    expect(dateSortKey('garbage')).toBe(0);
    expect(dateSortKey(null)).toBe(0);
    expect(dateSortKey(undefined, -1)).toBe(-1);
    // Critical property: the key is a real number, so a.localeKey - b.key is
    // never NaN (NaN comparisons are all-false and corrupt Array.sort order).
    expect(Number.isNaN(dateSortKey('garbage'))).toBe(false);
  });

  it('sorts a list with mixed valid/invalid dates deterministically (invalid → epoch)', () => {
    const rows = [
      { d: '2026-03-01T00:00:00.000Z' },
      { d: 'garbage' },
      { d: '2026-01-01T00:00:00.000Z' },
    ];
    const sorted = [...rows].sort((a, b) => dateSortKey(b.d) - dateSortKey(a.d));
    // Descending: March, January, then the invalid (epoch 0) last.
    expect(sorted.map((r) => r.d)).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      'garbage',
    ]);
  });
});
