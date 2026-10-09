/**
 * toBreedingHorse — the one checked normalizer from the GET /api/v1/horses
 * list DTO (HorseSummary) to the breeding feature's BreedingHorse
 * (Equoria-q4uem.6).
 *
 * Observable behaviour it must preserve (BreedingPairSelection before this
 * change): a horse whose `sex` is missing or outside the canonical
 * Stallion/Mare/Colt/Filly/Rig vocabulary (case-insensitive) never appears
 * in either the sire or the dam selector, and `gender` was never read.
 */

import { describe, it, expect } from 'vitest';
import type { HorseSummary } from '../types';
import { parseHorseSex, toBreedingHorse, toBreedingHorses } from '../breedingHorse';

/** A list-endpoint horse as backend/modules/horses/routes/horseRoutes.mjs emits it. */
function listHorse(overrides: Partial<HorseSummary> = {}): HorseSummary {
  return {
    id: 7,
    name: 'TestFixture-Starlight',
    breed: { id: 3, name: 'Arabian' },
    age: 5,
    ageYears: 6,
    gender: '',
    sex: 'Mare',
    dateOfBirth: '2020-01-01T00:00:00.000Z',
    healthStatus: 'Excellent',
    stats: {
      precision: 1,
      strength: 1,
      speed: 1,
      agility: 1,
      endurance: 1,
      intelligence: 1,
      stamina: 1,
      balance: 1,
      boldness: 1,
      flexibility: 1,
      obedience: 1,
      focus: 1,
    },
    disciplineScores: {},
    ...overrides,
  };
}

describe('toBreedingHorse', () => {
  it('projects a valid list horse into the breeding view', () => {
    expect(toBreedingHorse(listHorse({ imageUrl: '/img/a.jpg', level: 4 }))).toEqual({
      id: 7,
      name: 'TestFixture-Starlight',
      age: 6,
      sex: 'Mare',
      breedName: 'Arabian',
      healthStatus: 'Excellent',
      dateOfBirth: '2020-01-01T00:00:00.000Z',
      imageUrl: '/img/a.jpg',
      level: 4,
    });
  });

  it('falls back to `age` when ageYears is absent or 0 (the prior `ageYears || age` read)', () => {
    expect(toBreedingHorse(listHorse({ ageYears: undefined, age: 5 }))?.age).toBe(5);
    expect(toBreedingHorse(listHorse({ ageYears: 0, age: 2 }))?.age).toBe(2);
  });

  it('canonicalizes the sex case-insensitively, as the selector group checks did', () => {
    expect(toBreedingHorse(listHorse({ sex: 'stallion' }))?.sex).toBe('Stallion');
    expect(toBreedingHorse(listHorse({ sex: 'FILLY' }))?.sex).toBe('Filly');
    expect(toBreedingHorse(listHorse({ sex: 'Rig' }))?.sex).toBe('Rig');
  });

  it('rejects a horse with no sex', () => {
    expect(toBreedingHorse(listHorse({ sex: undefined }))).toBeNull();
  });

  it('rejects a horse whose sex is outside the canonical vocabulary', () => {
    expect(toBreedingHorse(listHorse({ sex: 'Male' }))).toBeNull();
    expect(toBreedingHorse(listHorse({ sex: 'Gelding' }))).toBeNull();
  });

  it('does not fall back to `gender` — the list endpoint never emits it', () => {
    expect(toBreedingHorse(listHorse({ sex: undefined, gender: 'Stallion' }))).toBeNull();
  });

  it("renders a missing breed as the honest 'not recorded' label", () => {
    expect(toBreedingHorse(listHorse({ breed: '' }))?.breedName).toBe('not recorded');
  });

  it('toBreedingHorses drops rejected horses and keeps order', () => {
    const horses = toBreedingHorses([
      listHorse({ id: 1, sex: 'Stallion' }),
      listHorse({ id: 2, sex: undefined }),
      listHorse({ id: 3, sex: 'Mare' }),
    ]);
    expect(horses.map((h) => h.id)).toEqual([1, 3]);
  });
});

describe('parseHorseSex', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseHorseSex(undefined)).toBeNull();
    expect(parseHorseSex(null)).toBeNull();
    expect(parseHorseSex('')).toBeNull();
  });

  it('maps every canonical value in any casing', () => {
    expect(['stallion', 'MARE', 'Colt', 'filly', 'rig'].map(parseHorseSex)).toEqual([
      'Stallion',
      'Mare',
      'Colt',
      'Filly',
      'Rig',
    ]);
  });
});
