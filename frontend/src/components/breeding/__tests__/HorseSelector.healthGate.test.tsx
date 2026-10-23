/**
 * canHorseBreed — the Fair-or-better health gate (Equoria-u0jop).
 *
 * Owner ruling 2026-10-23: a horse must be Fair or better to breed. The
 * selector mirrors the server's gate by reading the horse's displayed health
 * (the worse of feed and vet health) from the horse list.
 */
import { describe, it, expect } from 'vitest';
import { canHorseBreed } from '../HorseSelector';
import type { Horse } from '@/types/breeding';

const horse = (overrides: Partial<Horse> = {}): Horse => ({
  id: 1,
  name: 'Test Horse',
  breedName: 'Thoroughbred',
  sex: 'Stallion',
  age: 5,
  healthStatus: 'Excellent',
  dateOfBirth: '2020-01-01',
  ...overrides,
});

describe('canHorseBreed — health gate (Equoria-u0jop)', () => {
  it('refuses a horse whose displayed health is Bad', () => {
    expect(canHorseBreed(horse({ displayedHealth: 'Bad' }))).toEqual({
      canBreed: false,
      reason: 'Bad health',
    });
  });

  it('allows a horse in Fair health', () => {
    expect(canHorseBreed(horse({ displayedHealth: 'Fair' })).canBreed).toBe(true);
  });
});
