/**
 * Dual data source sync check — Equoria-l2xu
 *
 * Verifies that breedGeneticProfiles.mjs (BREED_GENETIC_PROFILES, the DB source of truth)
 * and breedProfiles.json (read by conformationService/gaitService/temperamentService via
 * breedProfileLoader) stay structurally consistent for all 12 canonical breeds.
 *
 * KNOWN DIVERGENCE (as of 2026-05-14):
 *   breedGeneticProfiles.mjs was enriched with real BreedData values (per-region std_dev,
 *   updated means) during the 31D/31E sprints. breedProfiles.json was NOT updated at that time
 *   and retains older generic means for affected breeds. The two stores therefore have different
 *   conformation/gait mean values for breeds that have BreedData files.
 *
 *   Affected breeds (updated in .mjs but NOT in JSON):
 *     ID 2  — Arabian          (JSON head.mean=76 vs .mjs head.mean=95)
 *     ID 3  — American Saddlebred (JSON head.mean=70 vs .mjs head.mean=88)
 *     ID 6  — Appaloosa        (JSON head.mean=70 vs .mjs head.mean=82)
 *     ID 8  — Andalusian       (JSON head.mean=78 vs .mjs head.mean=85)
 *     ID 9  — American Quarter Horse (JSON uses generic vs .mjs uses BreedData)
 *     ID 11 — Lusitano         (JSON uses generic vs .mjs uses BreedData)
 *     ID 12 — Paint Horse      (JSON uses generic vs .mjs uses BreedData)
 *
 *   The conformationService/gaitService read from breedProfiles.json (via breedProfileLoader),
 *   so LIVE GAME SCORES use the JSON values — not the enriched .mjs values in the DB profile.
 *   This means the DB breedGeneticProfile is NOT currently driving conformation/gait scoring.
 *   A future task (tracked as Equoria-ec1c) should reconcile the two stores.
 *
 * What this test enforces:
 *   1. All 12 canonical breeds are present by name in breedProfiles.json — CI catches missing.
 *   2. Both stores have the same 8 conformation region keys for each breed.
 *   3. Both stores have the same 5 gait keys for each breed.
 *   4. Both stores have the same 11 temperament weight keys for each breed.
 *   5. The is_gaited_breed flag is consistent between both stores (gaited is a game mechanic).
 *
 * What this test does NOT enforce (by design — the divergence is known and documented above):
 *   - Exact mean/std_dev value equality for conformation regions.
 *   - Exact mean/std_dev value equality for gaits.
 *   - Exact temperament weight value equality.
 *
 * When the JSON is reconciled with the .mjs file, add exact-value assertions here.
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
const PROFILES_PATH = resolve(__dirname, '../../../data/breedProfiles.json');

// Load breedProfiles.json once for all tests
const JSON_PROFILES = JSON.parse(readFileSync(PROFILES_PATH, 'utf8'));

const EXPECTED_CONFORMATION_REGIONS = [
  'head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline',
];
const EXPECTED_GAITS = ['walk', 'trot', 'canter', 'gallop', 'gaiting'];
const EXPECTED_TEMPERAMENT_KEYS = [
  'Spirited', 'Nervous', 'Calm', 'Bold', 'Steady',
  'Independent', 'Reactive', 'Stubborn', 'Playful', 'Lazy', 'Aggressive',
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
// Sentinel: known divergence — document the value gap for CI visibility
// This test PASSES because the divergence is known and accepted for now.
// When the JSON is reconciled, update these expected values and remove
// the divergence comment above.
// ---------------------------------------------------------------------------
describe('Known divergence documentation — Arabian (ID 2) conformation means', () => {
  it('Arabian conformation head.mean differs between .mjs (95) and JSON (76) — known gap', () => {
    const mjsMean = BREED_GENETIC_PROFILES[2].rating_profiles.conformation.head.mean;
    const jsonMean = JSON_PROFILES['Arabian'].rating_profiles.conformation.head.mean;

    // Document the known state: .mjs has enriched BreedData value, JSON has old value
    expect(mjsMean).toBe(95);  // BreedData/Arabian.txt value
    expect(jsonMean).toBe(76); // Old generic value — not updated when .mjs was enriched

    // Assert the values differ so CI catches if someone accidentally "fixes" one side
    // without updating the other, turning the known divergence back into hidden drift
    expect(mjsMean).not.toBe(jsonMean);
  });

  it('Arabian conformation gallop.mean differs between .mjs (92) and JSON (90) — known gap', () => {
    const mjsMean = BREED_GENETIC_PROFILES[2].rating_profiles.gaits.gallop.mean;
    const jsonMean = JSON_PROFILES['Arabian'].rating_profiles.gaits.gallop.mean;

    expect(mjsMean).toBe(92);
    expect(jsonMean).toBe(90);
    expect(mjsMean).not.toBe(jsonMean);
  });
});
