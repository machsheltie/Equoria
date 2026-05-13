import { describe, it, expect } from '@jest/globals';
import {
  statMap,
  getStatsForDiscipline,
  getAllDisciplines,
  getAllStatCategories,
  isDisciplineValid,
} from '../../../utils/statMap.mjs';

describe('statMap', () => {
  it('contains at least 20 disciplines', () => {
    expect(Object.keys(statMap).length).toBeGreaterThanOrEqual(20);
  });

  it('each discipline has exactly 3 stats', () => {
    for (const [_discipline, stats] of Object.entries(statMap)) {
      expect(stats).toHaveLength(3);
      expect(stats.every(s => typeof s === 'string')).toBe(true);
    }
  });
});

describe('getStatsForDiscipline', () => {
  it('returns [primary, secondary, tertiary] array for known discipline', () => {
    const stats = getStatsForDiscipline('Racing');
    expect(stats).toEqual(['speed', 'stamina', 'focus']);
  });

  it('returns null for unknown discipline', () => {
    expect(getStatsForDiscipline('Underwater Polo')).toBeNull();
  });

  it('returns correct stats for Dressage', () => {
    expect(getStatsForDiscipline('Dressage')).toEqual(['precision', 'focus', 'obedience']);
  });

  it('returns correct stats for Show Jumping', () => {
    expect(getStatsForDiscipline('Show Jumping')).toEqual(['balance', 'agility', 'boldness']);
  });
});

describe('getAllDisciplines', () => {
  it('returns an array of strings', () => {
    const disciplines = getAllDisciplines();
    expect(Array.isArray(disciplines)).toBe(true);
    expect(disciplines.every(d => typeof d === 'string')).toBe(true);
  });

  it('contains Racing and Dressage', () => {
    const disciplines = getAllDisciplines();
    expect(disciplines).toContain('Racing');
    expect(disciplines).toContain('Dressage');
  });

  it('matches statMap keys count', () => {
    expect(getAllDisciplines().length).toBe(Object.keys(statMap).length);
  });
});

describe('getAllStatCategories', () => {
  it('returns unique sorted stat names', () => {
    const cats = getAllStatCategories();
    expect(Array.isArray(cats)).toBe(true);
    const sorted = [...cats].sort();
    expect(cats).toEqual(sorted);
    // uniqueness check
    expect(new Set(cats).size).toBe(cats.length);
  });

  it('contains the 10 core stat categories', () => {
    const cats = getAllStatCategories();
    const expected = [
      'agility',
      'balance',
      'boldness',
      'flexibility',
      'focus',
      'intelligence',
      'obedience',
      'precision',
      'speed',
      'stamina',
    ];
    for (const stat of expected) {
      expect(cats).toContain(stat);
    }
  });
});

describe('isDisciplineValid', () => {
  it('returns true for known disciplines', () => {
    expect(isDisciplineValid('Endurance')).toBe(true);
    expect(isDisciplineValid('Barrel Racing')).toBe(true);
  });

  it('returns false for unknown disciplines', () => {
    expect(isDisciplineValid('Swimming')).toBe(false);
    expect(isDisciplineValid('')).toBe(false);
  });
});
