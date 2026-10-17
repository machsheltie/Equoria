/**
 * HorseSelector entry pre-check (Equoria-576c0 B9).
 *
 * calculateEligibility repeats the server's entry rules where the component has
 * the data (already entered, injured, age 3-20) with the server's exact
 * messages, and leaves the rider and Gaited rules to the server's refusal.
 */

import { describe, it, expect } from 'vitest';
import { calculateEligibility } from '../HorseSelector';
import type { Horse } from '../HorseSelectionCard';

const horse = (overrides: Partial<Horse> = {}): Horse => ({
  id: 1,
  name: 'Fixture',
  age: 7,
  sex: 'Mare',
  level: 1,
  health: 'healthy',
  disciplines: {},
  ...overrides,
});

describe('calculateEligibility (server entry rules, client side)', () => {
  it('accepts a healthy horse aged 3, 7 and 20', () => {
    for (const age of [3, 7, 20]) {
      expect(calculateEligibility(horse({ age }), new Set())).toEqual({ status: 'eligible' });
    }
  });

  it('refuses a horse under 3 with the server message', () => {
    expect(calculateEligibility(horse({ age: 2 }), new Set())).toEqual({
      status: 'too-young',
      reason: 'Horse must be at least 3 years old to compete',
    });
  });

  it('refuses a horse over 20 with the server message', () => {
    expect(calculateEligibility(horse({ age: 21 }), new Set())).toEqual({
      status: 'too-old',
      reason: 'Horses over 20 years old cannot compete',
    });
  });

  it('refuses an injured horse with the server message', () => {
    expect(calculateEligibility(horse({ health: 'injured' }), new Set())).toEqual({
      status: 'injured',
      reason: 'Injured horses cannot compete',
    });
  });

  it('refuses a horse already in the show with the server message', () => {
    expect(calculateEligibility(horse({ id: 9 }), new Set([9]))).toEqual({
      status: 'already-entered',
      reason: 'Horse is already entered in this show',
    });
  });

  it('does not guess the rider or Gaited rules it has no data for', () => {
    // A healthy 7-year-old passes the client pre-check; the server decides the rest.
    expect(calculateEligibility(horse(), new Set())).toEqual({ status: 'eligible' });
  });
});
