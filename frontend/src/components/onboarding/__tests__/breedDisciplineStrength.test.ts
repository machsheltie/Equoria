/**
 * breedDisciplineStrength tests (Equoria-55bo.4)
 *
 * Proves top-3 discipline badges are derived from the breed's REAL
 * statTendencies (not a static list / fabricated values), and that
 * disciplines with no overlapping breed stat are omitted.
 */

import { describe, it, expect } from 'vitest';
import { rankBreedDisciplineStrengths, topBreedDisciplines } from '../breedDisciplineStrength';
import type { BreedStatTendencies } from '@/hooks/api/useBreeds';

// A speed/agility breed (Thoroughbred-like): high speed/stamina/agility,
// modest precision/balance. Racing (speed/stamina/intelligence) must
// out-rank Dressage (precision/focus/obedience — only precision overlaps).
const sprinterBreed: BreedStatTendencies = {
  speed: { min: 80, max: 100, avg: 92 },
  stamina: { min: 70, max: 90, avg: 82 },
  agility: { min: 65, max: 85, avg: 78 },
  balance: { min: 40, max: 60, avg: 50 },
  precision: { min: 30, max: 50, avg: 40 },
  boldness: { min: 60, max: 85, avg: 74 },
};

describe('rankBreedDisciplineStrengths', () => {
  it('ranks disciplines by the breed real stat tendencies', () => {
    const ranked = rankBreedDisciplineStrengths(sprinterBreed);
    expect(ranked.length).toBeGreaterThan(0);

    const order = ranked.map((r) => r.discipline);
    const racingIdx = order.indexOf('Racing');
    const dressageIdx = order.indexOf('Dressage');
    expect(racingIdx).toBeGreaterThanOrEqual(0);
    // sprinter breed → Racing stronger than Dressage
    expect(dressageIdx).toBeGreaterThan(racingIdx);

    // Racing triple = speed/stamina/intelligence. intelligence is NOT a
    // breed stat → scored on speed(.5)+stamina(.3) re-normalised over .8:
    // (92*.5 + 82*.3) / .8 = (46+24.6)/.8 = 88.25 → 88
    const racing = ranked.find((r) => r.discipline === 'Racing')!;
    expect(racing.strength).toBe(88);
  });

  it('omits disciplines whose triple has no overlapping breed stat (no fabrication)', () => {
    // Combined Driving = obedience/strength/focus — NONE are breed stats.
    const ranked = rankBreedDisciplineStrengths(sprinterBreed);
    expect(ranked.find((r) => r.discipline === 'Combined Driving')).toBeUndefined();
  });

  it('returns empty when tendencies missing (no fabrication)', () => {
    expect(rankBreedDisciplineStrengths(null)).toEqual([]);
    expect(rankBreedDisciplineStrengths(undefined)).toEqual([]);
  });

  it('topBreedDisciplines returns the N strongest, sorted', () => {
    const top3 = topBreedDisciplines(sprinterBreed, 3);
    expect(top3).toHaveLength(3);
    expect(top3[0].strength).toBeGreaterThanOrEqual(top3[1].strength);
    expect(top3[1].strength).toBeGreaterThanOrEqual(top3[2].strength);
    // default N = 3
    expect(topBreedDisciplines(sprinterBreed)).toHaveLength(3);
  });
});
