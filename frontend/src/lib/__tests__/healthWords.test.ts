/**
 * The one health vocabulary on screen (owner ruling 2026-10-23, Equoria-u0jop):
 * Excellent, Very Good, Good, Fair, Bad. Poor, Bad and Critical all show as Bad.
 * Mirrors backend/utils/horseHealth.mjs toHealthWord.
 */
import { describe, it, expect } from 'vitest';
import { formatHealth, healthLabel, healthWords, isBadHealth } from '../healthWords';

describe('formatHealth', () => {
  it('has exactly the five words, best first', () => {
    expect(healthWords).toEqual(['Excellent', 'Very Good', 'Good', 'Fair', 'Bad']);
  });

  it('shows Poor, Bad and Critical as Bad, in any case', () => {
    for (const raw of ['Poor', 'poor', 'Bad', 'bad', 'Critical', 'critical']) {
      expect(formatHealth(raw)).toBe('Bad');
    }
  });

  it('keeps the five words and normalises case and spacing', () => {
    expect(formatHealth('excellent')).toBe('Excellent');
    expect(formatHealth('very_good')).toBe('Very Good');
    expect(formatHealth('Very Good')).toBe('Very Good');
    expect(formatHealth('good')).toBe('Good');
    expect(formatHealth('FAIR')).toBe('Fair');
  });

  it('shows a free-form vet finding as Bad, like the server', () => {
    expect(formatHealth('Injured')).toBe('Bad');
    expect(formatHealth('Lameness')).toBe('Bad');
  });

  it('returns null for a missing value so the screen shows unknown, never a fake word', () => {
    expect(formatHealth(null)).toBeNull();
    expect(formatHealth(undefined)).toBeNull();
    expect(formatHealth('')).toBeNull();
  });

  it('returns null for retired: retirement is not a health word', () => {
    expect(formatHealth('retired')).toBeNull();
  });
});

describe('healthLabel', () => {
  it('is the health word, Retired for a retired horse, and an em dash when unknown', () => {
    expect(healthLabel('critical')).toBe('Bad');
    expect(healthLabel('Very Good')).toBe('Very Good');
    expect(healthLabel('retired')).toBe('Retired');
    expect(healthLabel(undefined)).toBe('—');
  });
});

describe('isBadHealth', () => {
  it('is true only for a value that shows as Bad', () => {
    expect(isBadHealth('critical')).toBe(true);
    expect(isBadHealth('Bad')).toBe(true);
    expect(isBadHealth('Fair')).toBe(false);
    expect(isBadHealth('retired')).toBe(false);
    expect(isBadHealth(null)).toBe(false);
  });
});
