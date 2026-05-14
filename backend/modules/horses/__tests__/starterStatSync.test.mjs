/**
 * Starter stat dual data source sync check — Equoria-ec1c
 *
 * Verifies that breedGeneticProfiles.mjs (BREED_GENETIC_PROFILES starter_stats,
 * the DB source of truth) and breedStarterStats.json (read by horseStarterStats.mjs
 * service, authController.mjs, marketplaceController.mjs) stay structurally
 * consistent for all 12 canonical breeds.
 *
 * KEY NAMES DIFFER BETWEEN STORES:
 *   BREED_GENETIC_PROFILES.starter_stats uses:  { mean, std_dev }
 *   breedStarterStats.json uses:                { mean, std }
 *   This is a structural inconsistency that callers must adapt to manually.
 *
 * KNOWN VALUE DIVERGENCE (as of 2026-05-14):
 *   breedGeneticProfiles.mjs was updated with different starter_stat means for
 *   some breeds compared to breedStarterStats.json. The horse creation runtime
 *   (authController, marketplaceController) reads from breedStarterStats.json,
 *   so LIVE horse creation uses the JSON values — not the JSONB values stored
 *   in the DB breed profile.
 *
 *   Confirmed divergent breeds (mean values differ):
 *     ID 1  — Thoroughbred: 9 of 12 stats differ (endurance, balance, etc.)
 *     Others have not been fully audited.
 *
 *   The source of truth question is unresolved: a future task should either:
 *     (a) regenerate breedStarterStats.json from breedGeneticProfiles.mjs, or
 *     (b) remove starter_stats from the JSONB and have fix scripts use the JSON.
 *
 * What this test enforces:
 *   1. All 12 canonical breeds are present by name in breedStarterStats.json.
 *   2. Both stores expose the same 12 stat names for each breed.
 *   3. The std/std_dev key name divergence is documented.
 *
 * What this test does NOT enforce (divergence is known and documented above):
 *   - Exact mean value equality (Thoroughbred and possibly others differ).
 *
 * When the stores are reconciled, add exact-value assertions and update this header.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  CANONICAL_BREEDS,
  BREED_GENETIC_PROFILES,
} from '../data/breedGeneticProfiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const STARTER_STATS_PATH = resolve(__dirname, '../../../data/breedStarterStats.json');

// Load breedStarterStats.json once for all tests
const JSON_STARTER_STATS = JSON.parse(readFileSync(STARTER_STATS_PATH, 'utf8'));

const EXPECTED_STAT_NAMES = [
  'agility', 'balance', 'boldness', 'endurance', 'flexibility',
  'focus', 'intelligence', 'obedience', 'precision', 'speed', 'stamina', 'strength',
];

// ---------------------------------------------------------------------------
// Presence: every canonical breed must exist in breedStarterStats.json by name
// ---------------------------------------------------------------------------
describe('breedStarterStats.json — canonical breed presence', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breedStarterStats.json has an entry for "${breed.name}" (ID ${breed.id})`, () => {
      expect(JSON_STARTER_STATS[breed.name]).toBeDefined();
      expect(JSON_STARTER_STATS[breed.name]).not.toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// Structural consistency: stat names present in both stores
// ---------------------------------------------------------------------------
describe('Stat name keys — structural sync between both stores', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — same 12 stat names in both stores`, () => {
      const mjsStats = BREED_GENETIC_PROFILES[breed.id].starter_stats;
      const jsonStats = JSON_STARTER_STATS[breed.name];

      const mjsKeys = Object.keys(mjsStats).sort();
      const jsonKeys = Object.keys(jsonStats).sort();

      // Both stores should have all 12 expected stat names
      expect(mjsKeys).toEqual(EXPECTED_STAT_NAMES.slice().sort());
      expect(jsonKeys).toEqual(EXPECTED_STAT_NAMES.slice().sort());
      // Both stores must have the identical stat name set
      expect(mjsKeys).toEqual(jsonKeys);
    });
  }
});

// ---------------------------------------------------------------------------
// Key name divergence documentation
// The .mjs uses std_dev; the JSON uses std. This is a structural inconsistency.
// ---------------------------------------------------------------------------
describe('Known structural divergence — stat key names', () => {
  it('BREED_GENETIC_PROFILES.starter_stats uses std_dev (not std)', () => {
    const arabianStats = BREED_GENETIC_PROFILES[2].starter_stats;
    // .mjs uses std_dev
    expect(arabianStats.agility.std_dev).toBeDefined();
    expect(arabianStats.agility.std).toBeUndefined();
  });

  it('breedStarterStats.json uses std (not std_dev)', () => {
    const arabianJson = JSON_STARTER_STATS['Arabian'];
    // JSON uses std
    expect(arabianJson.agility.std).toBeDefined();
    expect(arabianJson.agility.std_dev).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Value divergence sentinel: Thoroughbred (ID 1) — confirmed divergent
// ---------------------------------------------------------------------------
describe('Known value divergence — Thoroughbred (ID 1) starter_stats', () => {
  it('Thoroughbred endurance mean differs: .mjs=17, JSON=16 — known gap', () => {
    const mjsMean = BREED_GENETIC_PROFILES[1].starter_stats.endurance.mean;
    const jsonMean = JSON_STARTER_STATS['Thoroughbred'].endurance.mean;
    // Document current state — if either changes without the other, CI catches it
    expect(mjsMean).toBe(17);
    expect(jsonMean).toBe(16);
    expect(mjsMean).not.toBe(jsonMean);
  });

  it('Thoroughbred intelligence mean differs: .mjs=15, JSON=18 — known gap', () => {
    const mjsMean = BREED_GENETIC_PROFILES[1].starter_stats.intelligence.mean;
    const jsonMean = JSON_STARTER_STATS['Thoroughbred'].intelligence.mean;
    expect(mjsMean).toBe(15);
    expect(jsonMean).toBe(18);
    expect(mjsMean).not.toBe(jsonMean);
  });
});

// ---------------------------------------------------------------------------
// Value match: Arabian (ID 2) — confirmed matching
// ---------------------------------------------------------------------------
describe('Confirmed match — Arabian (ID 2) starter_stats', () => {
  for (const statName of EXPECTED_STAT_NAMES) {
    it(`Arabian ${statName}.mean matches between both stores`, () => {
      const mjsMean = BREED_GENETIC_PROFILES[2].starter_stats[statName].mean;
      const jsonMean = JSON_STARTER_STATS['Arabian'][statName].mean;
      expect(mjsMean).toBe(jsonMean);
    });
  }
});
