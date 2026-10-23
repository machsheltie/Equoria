/**
 * canHorseBreed — the server's breeding rules as the breeding picker shows
 * them. Split from HorseSelector.test.tsx (which sits at its file-size cap).
 *
 * - Ages 3-20 only: at 21 a horse is retired and cannot breed (owner ruling,
 *   Stacey 2026-10-23, Equoria-e7tgc.4).
 * - A mare the server reports in foal cannot be bred again (Equoria-q4uem.9).
 */

import { describe, it, expect } from 'vitest';
import { canHorseBreed } from '../HorseSelector';
import type { Horse } from '@/types/breeding';

const createHorse = (overrides: Partial<Horse> = {}): Horse => ({
  id: 1,
  name: 'Test Horse',
  breedName: 'Thoroughbred',
  sex: 'Stallion',
  age: 5,
  healthStatus: 'healthy',
  dateOfBirth: '2026-01-01',
  ...overrides,
});

describe('canHorseBreed — breeding age window 3-20 (Equoria-e7tgc.4)', () => {
  it('allows a 20-year-old', () => {
    expect(canHorseBreed(createHorse({ age: 20 }))).toEqual({ canBreed: true });
  });

  it('refuses a 21-year-old as retired', () => {
    expect(canHorseBreed(createHorse({ age: 21 }))).toEqual({
      canBreed: false,
      reason: 'Retired (21y; breeds until 20)',
    });
  });
});

describe('canHorseBreed — in foal (Equoria-q4uem.9)', () => {
  it('refuses a mare the server reports in foal', () => {
    const horse = createHorse({ sex: 'Mare', age: 6, inFoal: true });
    expect(canHorseBreed(horse)).toEqual({ canBreed: false, reason: 'In foal' });
  });

  it('allows a mare that is not in foal', () => {
    const horse = createHorse({ sex: 'Mare', age: 6, inFoal: false });
    expect(canHorseBreed(horse)).toEqual({ canBreed: true });
  });
});
