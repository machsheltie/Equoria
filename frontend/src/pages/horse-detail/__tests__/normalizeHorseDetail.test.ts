/**
 * normalizeHorseDetail (Equoria-q4uem.12) — the GET /horses/:id payload to the
 * detail page's Horse, with no casts: JSONB columns are read through guards.
 */
import { describe, expect, it } from 'vitest';
import type { HorseSummary } from '@/lib/api/types';
import { normalizeHorseDetail } from '../normalizeHorseDetail';

const stats = {
  precision: 1,
  strength: 2,
  speed: 3,
  agility: 4,
  endurance: 5,
  intelligence: 6,
  stamina: 7,
  balance: 8,
  boldness: 9,
  flexibility: 10,
  obedience: 11,
  focus: 12,
};

function detail(overrides: Partial<HorseSummary> = {}): HorseSummary {
  return {
    id: 7,
    name: 'Moonflower',
    breed: { id: 3, name: 'Arabian' },
    age: 5,
    gender: '',
    sex: 'Mare',
    dateOfBirth: '2021-01-01T00:00:00.000Z',
    healthStatus: 'Good',
    stats,
    disciplineScores: {},
    ...overrides,
  };
}

describe('normalizeHorseDetail', () => {
  it('reads the breed name off the relation object and keeps a plain string as is', () => {
    expect(normalizeHorseDetail(detail()).breed).toBe('Arabian');
    expect(normalizeHorseDetail(detail({ breed: 'Thoroughbred' })).breed).toBe('Thoroughbred');
  });

  // Equoria-u0jop: the detail page dropped displayedHealth, so its health badge
  // never showed. The server's displayed health is what every gate checks.
  it('keeps the server-derived feed, vet and displayed health', () => {
    const horse = normalizeHorseDetail(
      detail({ feedHealth: 'Fair', vetHealth: 'Excellent', displayedHealth: 'Fair' })
    );
    expect([horse.feedHealth, horse.vetHealth, horse.displayedHealth]).toEqual([
      'Fair',
      'Excellent',
      'Fair',
    ]);
  });

  it('falls back to sex when gender is empty', () => {
    expect(normalizeHorseDetail(detail()).gender).toBe('Mare');
    expect(normalizeHorseDetail(detail({ gender: 'Stallion', sex: 'Mare' })).gender).toBe(
      'Stallion'
    );
  });

  it('builds stats from the flat fields when no nested stats object came back', () => {
    // A Prisma raw query can send the twelve stats flat; the type says nested.
    const flat = { ...detail(), ...stats, speed: 40 };
    Reflect.deleteProperty(flat, 'stats');
    expect(normalizeHorseDetail(flat).stats.speed).toBe(40);
    expect(normalizeHorseDetail(flat).stats.focus).toBe(12);
  });

  it('keeps a legitimate zero count and defaults the missing ones', () => {
    const horse = normalizeHorseDetail(detail({ titlePoints: 0 }));
    expect(horse.titlePoints).toBe(0);
    expect(horse.breedingValueBoost).toBe(0);
    expect(horse.currentTitle).toBeNull();
    expect(horse.pregnancyFeedingsByTier).toEqual({});
    expect(horse.inFoalSinceDate).toBeNull();
    expect(horse.temperament).toBeNull();
  });

  it('plucks markings from the phenotype and keeps only well-typed fields', () => {
    const horse = normalizeHorseDetail(
      detail({
        phenotype: {
          colorName: 'Bay',
          faceMarking: 'star',
          legMarkings: { frontLeft: 'sock', hindRight: 7 },
          modifiers: { isSooty: true, isFlaxen: 'yes' },
        },
      })
    );
    expect(horse.phenotype?.colorName).toBe('Bay');
    expect(horse.markings).toEqual({
      faceMarking: 'star',
      legMarkings: {
        frontLeft: 'sock',
        frontRight: undefined,
        hindLeft: undefined,
        hindRight: undefined,
      },
      advancedMarkings: undefined,
      modifiers: {
        isSooty: true,
        isFlaxen: undefined,
        hasPangare: undefined,
        isRabicano: undefined,
      },
    });
  });

  it('returns no markings for a phenotype without marking fields', () => {
    expect(normalizeHorseDetail(detail({ phenotype: { colorName: 'Bay' } })).markings).toBeNull();
  });

  it.each([null, undefined])('treats a %s phenotype as none', (phenotype) => {
    const horse = normalizeHorseDetail(detail({ phenotype }));
    expect(horse.phenotype).toBeNull();
    expect(horse.markings).toBeNull();
  });

  it('treats a phenotype that is not an object as none', () => {
    // JSONB can hold a string or an array; the declared type cannot say so.
    const asString = Object.assign(detail(), { phenotype: 'bay' });
    const asArray = Object.assign(detail(), { phenotype: ['bay'] });
    expect(normalizeHorseDetail(asString).phenotype).toBeNull();
    expect(normalizeHorseDetail(asArray).phenotype).toBeNull();
    expect(normalizeHorseDetail(asArray).markings).toBeNull();
  });

  it('does not mutate the cached payload', () => {
    const raw = detail({ phenotype: { colorName: 'Bay', faceMarking: 'star' } });
    const before = JSON.stringify(raw);
    normalizeHorseDetail(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });
});
