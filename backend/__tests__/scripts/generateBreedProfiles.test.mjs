/**
 * Equoria-z5zu — Verify generateBreedProfiles.mjs preserves hand-tuned
 * manual edits across re-runs.
 *
 * Sentinel-positive coverage (per OPTIMAL_FIX_DISCIPLINE §2):
 *   - Demonstrates the generator OVERWRITES entries without manualOverride
 *     (so we know the preservation is selective, not "leave everything").
 *   - Demonstrates the generator PRESERVES entries with manualOverride=true.
 *   - Demonstrates new breeds (in stats list but missing from existing
 *     profiles) are still generated from category templates.
 */

import { jest } from '@jest/globals';
import { generateProfiles, buildProfile } from '../../scripts/generateBreedProfiles.mjs';

describe('generateBreedProfiles — manualOverride preservation (Equoria-z5zu)', () => {
  test('overwrites entries WITHOUT manualOverride flag', () => {
    const breedNames = ['Thoroughbred'];
    const existing = {
      Thoroughbred: {
        category: 'general',
        rating_profiles: {
          conformation: {
            head: { mean: 1, std_dev: 1 },
            neck: { mean: 1, std_dev: 1 },
            shoulders: { mean: 1, std_dev: 1 },
            back: { mean: 1, std_dev: 1 },
            hindquarters: { mean: 1, std_dev: 1 },
            legs: { mean: 1, std_dev: 1 },
            hooves: { mean: 1, std_dev: 1 },
            topline: { mean: 1, std_dev: 1 },
          },
          gaits: {
            walk: { mean: 1, std_dev: 1 },
            trot: { mean: 1, std_dev: 1 },
            canter: { mean: 1, std_dev: 1 },
            gallop: { mean: 1, std_dev: 1 },
            gaiting: null,
          },
          is_gaited_breed: false,
          gaited_gait_registry: null,
        },
        temperament_weights: {
          Spirited: 100,
          Nervous: 0,
          Calm: 0,
          Bold: 0,
          Steady: 0,
          Independent: 0,
          Reactive: 0,
          Stubborn: 0,
          Playful: 0,
          Lazy: 0,
          Aggressive: 0,
        },
      },
    };

    const { profiles, preserved } = generateProfiles(breedNames, existing);

    // Should be overwritten — the existing entry above has bogus mean=1 values.
    // The regenerated profile categorises Thoroughbred as 'racing' and uses
    // the racing template (head mean=76, not 1).
    expect(profiles.Thoroughbred.category).toBe('racing');
    expect(profiles.Thoroughbred.rating_profiles.conformation.head.mean).toBe(76);
    expect(preserved).toHaveLength(0);
  });

  test('PRESERVES entries with manualOverride=true (sentinel positive)', () => {
    const breedNames = ['Lusitano'];
    const handTuned = {
      Lusitano: {
        manualOverride: true,
        category: 'sport',
        rating_profiles: {
          conformation: {
            head: { mean: 88, std_dev: 6 }, // hand-tuned: higher head mean than sport template
            neck: { mean: 90, std_dev: 6 },
            shoulders: { mean: 82, std_dev: 7 },
            back: { mean: 80, std_dev: 7 },
            hindquarters: { mean: 84, std_dev: 7 },
            legs: { mean: 80, std_dev: 7 },
            hooves: { mean: 78, std_dev: 7 },
            topline: { mean: 86, std_dev: 6 },
          },
          gaits: {
            walk: { mean: 80, std_dev: 8 },
            trot: { mean: 86, std_dev: 8 },
            canter: { mean: 86, std_dev: 8 },
            gallop: { mean: 78, std_dev: 8 },
            gaiting: null,
          },
          is_gaited_breed: false,
          gaited_gait_registry: null,
        },
        temperament_weights: {
          Spirited: 16,
          Nervous: 6,
          Calm: 16,
          Bold: 20,
          Steady: 18,
          Independent: 6,
          Reactive: 4,
          Stubborn: 4,
          Playful: 8,
          Lazy: 1,
          Aggressive: 1,
        },
      },
    };

    const { profiles, preserved } = generateProfiles(breedNames, handTuned);

    // The hand-tuned head mean is 88. The sport template head mean is 78.
    // If preservation worked, we should see 88, not 78.
    expect(profiles.Lusitano.rating_profiles.conformation.head.mean).toBe(88);
    expect(profiles.Lusitano.rating_profiles.conformation.neck.mean).toBe(90);
    expect(profiles.Lusitano.manualOverride).toBe(true);
    expect(preserved).toContain('Lusitano');
    // Deep-equality check: the entire entry is byte-for-byte preserved.
    expect(profiles.Lusitano).toEqual(handTuned.Lusitano);
  });

  test('GENERATES new breeds even when other entries are preserved', () => {
    const breedNames = ['Lusitano', 'Akhal-Teke'];
    const existing = {
      Lusitano: {
        manualOverride: true,
        category: 'sport',
        rating_profiles: {
          conformation: {
            head: { mean: 88, std_dev: 6 },
            neck: { mean: 90, std_dev: 6 },
            shoulders: { mean: 82, std_dev: 7 },
            back: { mean: 80, std_dev: 7 },
            hindquarters: { mean: 84, std_dev: 7 },
            legs: { mean: 80, std_dev: 7 },
            hooves: { mean: 78, std_dev: 7 },
            topline: { mean: 86, std_dev: 6 },
          },
          gaits: {
            walk: { mean: 80, std_dev: 8 },
            trot: { mean: 86, std_dev: 8 },
            canter: { mean: 86, std_dev: 8 },
            gallop: { mean: 78, std_dev: 8 },
            gaiting: null,
          },
          is_gaited_breed: false,
          gaited_gait_registry: null,
        },
        temperament_weights: {
          Spirited: 16,
          Nervous: 6,
          Calm: 16,
          Bold: 20,
          Steady: 18,
          Independent: 6,
          Reactive: 4,
          Stubborn: 4,
          Playful: 8,
          Lazy: 1,
          Aggressive: 1,
        },
      },
      // Akhal-Teke deliberately omitted — new breed.
    };

    const { profiles, preserved } = generateProfiles(breedNames, existing);

    expect(preserved).toEqual(['Lusitano']);
    expect(profiles['Akhal-Teke']).toBeDefined();
    expect(profiles['Akhal-Teke'].category).toBe('racing');
    expect(profiles['Akhal-Teke'].rating_profiles.conformation.head.mean).toBe(76);
    // Lusitano hand-tuned head still 88.
    expect(profiles.Lusitano.rating_profiles.conformation.head.mean).toBe(88);
  });

  test('manualOverride=false treats entry as ordinary (NOT preserved)', () => {
    // Edge case: someone literally writes `"manualOverride": false`. Only the
    // truthy `true` value preserves — anything else regenerates.
    const breedNames = ['Thoroughbred'];
    const existing = {
      Thoroughbred: {
        manualOverride: false,
        category: 'general',
        rating_profiles: {
          conformation: {
            head: { mean: 1, std_dev: 1 },
            neck: { mean: 1, std_dev: 1 },
            shoulders: { mean: 1, std_dev: 1 },
            back: { mean: 1, std_dev: 1 },
            hindquarters: { mean: 1, std_dev: 1 },
            legs: { mean: 1, std_dev: 1 },
            hooves: { mean: 1, std_dev: 1 },
            topline: { mean: 1, std_dev: 1 },
          },
          gaits: {
            walk: { mean: 1, std_dev: 1 },
            trot: { mean: 1, std_dev: 1 },
            canter: { mean: 1, std_dev: 1 },
            gallop: { mean: 1, std_dev: 1 },
            gaiting: null,
          },
          is_gaited_breed: false,
          gaited_gait_registry: null,
        },
        temperament_weights: {
          Spirited: 100,
          Nervous: 0,
          Calm: 0,
          Bold: 0,
          Steady: 0,
          Independent: 0,
          Reactive: 0,
          Stubborn: 0,
          Playful: 0,
          Lazy: 0,
          Aggressive: 0,
        },
      },
    };

    const { profiles, preserved } = generateProfiles(breedNames, existing);

    expect(preserved).toHaveLength(0);
    expect(profiles.Thoroughbred.rating_profiles.conformation.head.mean).toBe(76);
  });

  test('buildProfile is still exported and usable directly', () => {
    // Smoke test: existing callers of buildProfile (if any) still work.
    const p = buildProfile('Hanoverian');
    expect(p.category).toBe('sport');
    expect(p.rating_profiles.conformation.head.mean).toBe(78);
  });
});
