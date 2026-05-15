/**
 * Dual data source sync check — Equoria-l2xu / Equoria-is28
 *
 * Verifies that breedGeneticProfiles.mjs (BREED_GENETIC_PROFILES, the authoritative
 * source of truth) and breedProfiles.json (runtime data consumed by conformationService /
 * gaitService / temperamentService via breedProfileLoader) stay BIT-EQUAL for the 12
 * canonical breeds.
 *
 * Reconciled 2026-05-15 (Equoria-is28): backend/scripts/sync-canonical-breeds-to-json.mjs
 * copies rating_profiles + temperament_weights + starter_stats from .mjs into JSON for
 * the 12 canonical breeds. Non-canonical breeds (~297 entries) retain their category-
 * template values from generate-breed-profiles.mjs and are NOT touched by the sync.
 *
 * What this test enforces:
 *   1. All 12 canonical breeds are present by name in breedProfiles.json.
 *   2. Both stores have the same 8 conformation region keys for each breed.
 *   3. Both stores have the same 5 gait keys for each breed.
 *   4. Both stores have the same 11 temperament weight keys for each breed.
 *   5. is_gaited_breed flag is consistent between both stores (game mechanic).
 *   6. NEW (Equoria-is28): exact mean / std_dev equality for conformation regions,
 *      gaits, and temperament weights across both stores. If a contributor edits one
 *      side without re-running the sync script, CI fails fast.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { CANONICAL_BREEDS, BREED_GENETIC_PROFILES } from '../data/breedGeneticProfiles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROFILES_PATH = resolve(__dirname, '../../../data/breedProfiles.json');

// Load breedProfiles.json once for all tests
const JSON_PROFILES = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));

const EXPECTED_CONFORMATION_REGIONS = [
  'head',
  'neck',
  'shoulders',
  'back',
  'hindquarters',
  'legs',
  'hooves',
  'topline',
];
const EXPECTED_GAITS = ['walk', 'trot', 'canter', 'gallop', 'gaiting'];
const EXPECTED_TEMPERAMENT_KEYS = [
  'Spirited',
  'Nervous',
  'Calm',
  'Bold',
  'Steady',
  'Independent',
  'Reactive',
  'Stubborn',
  'Playful',
  'Lazy',
  'Aggressive',
];

// ---------------------------------------------------------------------------
// Presence: every canonical breed must exist in breedProfiles.json by name
// ---------------------------------------------------------------------------
describe('breedProfiles.json — canonical breed presence', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breedProfiles.json has an entry for "${breed.name}" (ID ${breed.id})`, () => {
      expect(JSON_PROFILES[breed.name]).toBeDefined();
      expect(JSON_PROFILES[breed.name]).not.toBeNull();
    });
  }
});

// ---------------------------------------------------------------------------
// Structural consistency: conformation regions
// ---------------------------------------------------------------------------
describe('Conformation region keys — structural sync between both stores', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — same 8 conformation regions in both stores`, () => {
      const mjsConformation = BREED_GENETIC_PROFILES[breed.id].rating_profiles.conformation;
      const jsonProfile = JSON_PROFILES[breed.name];
      const jsonConformation = jsonProfile.rating_profiles.conformation;

      const mjsKeys = Object.keys(mjsConformation).sort();
      const jsonKeys = Object.keys(jsonConformation).sort();

      expect(mjsKeys).toEqual(EXPECTED_CONFORMATION_REGIONS.slice().sort());
      expect(jsonKeys).toEqual(EXPECTED_CONFORMATION_REGIONS.slice().sort());
      // Both stores must have the identical key set
      expect(mjsKeys).toEqual(jsonKeys);
    });
  }
});

// ---------------------------------------------------------------------------
// Structural consistency: gait keys
// ---------------------------------------------------------------------------
describe('Gait keys — structural sync between both stores', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — same 5 gait keys in both stores`, () => {
      const mjsGaits = BREED_GENETIC_PROFILES[breed.id].rating_profiles.gaits;
      const jsonGaits = JSON_PROFILES[breed.name].rating_profiles.gaits;

      const mjsKeys = Object.keys(mjsGaits).sort();
      const jsonKeys = Object.keys(jsonGaits).sort();

      expect(mjsKeys).toEqual(EXPECTED_GAITS.slice().sort());
      expect(jsonKeys).toEqual(EXPECTED_GAITS.slice().sort());
      expect(mjsKeys).toEqual(jsonKeys);
    });
  }
});

// ---------------------------------------------------------------------------
// Structural consistency: temperament weight keys
// ---------------------------------------------------------------------------
describe('Temperament weight keys — structural sync between both stores', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — same 11 temperament keys in both stores`, () => {
      const mjsTw = BREED_GENETIC_PROFILES[breed.id].temperament_weights;
      const jsonTw = JSON_PROFILES[breed.name].temperament_weights;

      const mjsKeys = Object.keys(mjsTw).sort();
      const jsonKeys = Object.keys(jsonTw).sort();

      expect(mjsKeys).toEqual(EXPECTED_TEMPERAMENT_KEYS.slice().sort());
      expect(jsonKeys).toEqual(EXPECTED_TEMPERAMENT_KEYS.slice().sort());
      expect(mjsKeys).toEqual(jsonKeys);
    });
  }
});

// ---------------------------------------------------------------------------
// is_gaited_breed flag must match (game mechanic — must be consistent)
// ---------------------------------------------------------------------------
describe('is_gaited_breed flag — must be consistent between both stores', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — is_gaited_breed matches in both stores`, () => {
      const mjsGaited = BREED_GENETIC_PROFILES[breed.id].rating_profiles.is_gaited_breed;
      const jsonGaited = JSON_PROFILES[breed.name].rating_profiles.is_gaited_breed;
      expect(typeof mjsGaited).toBe('boolean');
      expect(typeof jsonGaited).toBe('boolean');
      expect(mjsGaited).toBe(jsonGaited);
    });
  }
});

// ---------------------------------------------------------------------------
// Equoria-is28 (reconciled 2026-05-15): exact value equality for the 12
// canonical breeds. JSON values were synced from .mjs by
// backend/scripts/sync-canonical-breeds-to-json.mjs. If a contributor edits
// either source without re-running the sync, these assertions fail fast in CI.
// ---------------------------------------------------------------------------
describe('Equoria-is28 — exact conformation mean / std_dev equality (canonical breeds)', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — conformation values match exactly between .mjs and JSON`, () => {
      const mjsConf = BREED_GENETIC_PROFILES[breed.id].rating_profiles.conformation;
      const jsonConf = JSON_PROFILES[breed.name].rating_profiles.conformation;
      for (const region of EXPECTED_CONFORMATION_REGIONS) {
        expect(jsonConf[region].mean).toBe(mjsConf[region].mean);
        expect(jsonConf[region].std_dev).toBe(mjsConf[region].std_dev);
      }
    });
  }
});

describe('Equoria-is28 — exact gait mean / std_dev equality (canonical breeds)', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — gait values match exactly between .mjs and JSON`, () => {
      const mjsGaits = BREED_GENETIC_PROFILES[breed.id].rating_profiles.gaits;
      const jsonGaits = JSON_PROFILES[breed.name].rating_profiles.gaits;
      for (const gait of EXPECTED_GAITS) {
        // gaiting may be null for non-gaited breeds
        if (mjsGaits[gait] === null) {
          expect(jsonGaits[gait]).toBeNull();
        } else {
          expect(jsonGaits[gait].mean).toBe(mjsGaits[gait].mean);
          expect(jsonGaits[gait].std_dev).toBe(mjsGaits[gait].std_dev);
        }
      }
    });
  }
});

describe('Equoria-is28 — exact temperament weight equality (canonical breeds)', () => {
  for (const breed of CANONICAL_BREEDS) {
    it(`breed "${breed.name}" (ID ${breed.id}) — temperament weights match exactly`, () => {
      const mjsTw = BREED_GENETIC_PROFILES[breed.id].temperament_weights;
      const jsonTw = JSON_PROFILES[breed.name].temperament_weights;
      for (const key of EXPECTED_TEMPERAMENT_KEYS) {
        expect(jsonTw[key]).toBe(mjsTw[key]);
      }
    });
  }
});
