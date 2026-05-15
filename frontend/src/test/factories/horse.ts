/**
 * Horse test-data factory (Equoria-tjyc)
 *
 * Reconciles the 2025-12-02 architecture spec (docs/architecture.md §Testing
 * Patterns, line 527: `createMockHorse(overrides)`) with the codebase, which
 * previously only had static fixtures under test/fixtures/. Factories are
 * functions that produce fresh mock objects with per-call overrides — unlike
 * static fixtures they cannot leak mutation between tests.
 *
 * Shape mirrors the canonical `Horse` interface in src/types/horse.ts
 * (id/name/breed/age/level/health/xp/stats/disciplineScores) plus the optional
 * fields list/grid components read. Kept structurally typed (not importing the
 * canonical interface) because there are several divergent `Horse` interfaces
 * across the codebase; the factory targets the list/card surface that the
 * existing inline test mocks use.
 */

export interface MockHorseStats {
  speed: number;
  stamina: number;
  agility: number;
  strength: number;
  intelligence: number;
  temperament: number;
  balance: number;
  precision: number;
  boldness: number;
  flexibility: number;
  obedience: number;
  focus: number;
}

export interface MockHorse {
  id: number;
  name: string;
  breed: string;
  age: number;
  sex?: string;
  level: number;
  health: number;
  xp: number;
  imageUrl?: string;
  stats: MockHorseStats;
  disciplineScores: Record<string, number>;
}

const DEFAULT_STATS: MockHorseStats = {
  speed: 75,
  stamina: 80,
  agility: 70,
  strength: 70,
  intelligence: 72,
  temperament: 68,
  balance: 70,
  precision: 72,
  boldness: 74,
  flexibility: 66,
  obedience: 73,
  focus: 71,
};

/**
 * Create a mock horse. Pass `overrides` to customize any field; `stats` is
 * shallow-merged so a test can override one stat without re-declaring all.
 */
export function createMockHorse(overrides: Partial<MockHorse> = {}): MockHorse {
  const { stats: statOverrides, ...rest } = overrides;
  return {
    id: 1,
    name: 'Test Horse',
    breed: 'Thoroughbred',
    age: 5,
    sex: 'mare',
    level: 10,
    health: 95,
    xp: 1500,
    imageUrl: 'https://example.com/horses/test-horse.jpg',
    stats: { ...DEFAULT_STATS, ...(statOverrides ?? {}) },
    disciplineScores: { Dressage: 70 },
    ...rest,
  };
}
