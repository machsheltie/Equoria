/**
 * Breed profile data — backend/data/breedProfiles.json against the seed files.
 *
 * Owner ruling 2026-10-21 (Stacey): there were never "12 canonical breeds".
 * Old contract: breedGeneticProfiles.test.mjs pinned the values of an invented
 * 12-breed table (breedGeneticProfiles.mjs), and breedProfileSync.test.mjs
 * forced breedProfiles.json to equal it for those 12. Both are deleted with the
 * table. breedProfiles.json and backend/data/breeds/*.txt (which load the DB
 * the game reads first) are the two copies that must agree; this suite holds
 * every one of the 312 breeds to that, and keeps the runtime validator's
 * bad-input checks using real breeds from the JSON.
 */

import { describe, it, test, expect } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { validateProfile } from '../../../seed/breedProfileValidator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../../data');
const JSON_PROFILES = JSON.parse(readFileSync(join(DATA_DIR, 'breedProfiles.json'), 'utf8'));

const SEED_PROFILES = {};
for (const file of readdirSync(join(DATA_DIR, 'breeds'))) {
  const body = readFileSync(join(DATA_DIR, 'breeds', file), 'utf8');
  const name = body.match(/^\('((?:[^']|'')+)', /m)[1].replace(/''/g, "'");
  SEED_PROFILES[name] = JSON.parse(body.match(/\$json\$([\s\S]*)\$json\$/)[1]);
}

const clone = value => JSON.parse(JSON.stringify(value));
const NON_GAITED = 'Thoroughbred';
const GAITED = 'American Saddlebred';

describe('breedProfiles.json agrees with the seed files (owner ruling 2026-10-21)', () => {
  it('covers exactly the same 312 breeds', () => {
    expect(Object.keys(JSON_PROFILES).sort()).toEqual(Object.keys(SEED_PROFILES).sort());
    expect(Object.keys(JSON_PROFILES)).toHaveLength(312);
  });

  it.each(Object.keys(SEED_PROFILES))('%s: same conformation, gaits, gaited status and temperament odds', name => {
    const json = JSON_PROFILES[name];
    const seed = SEED_PROFILES[name];
    expect(json.rating_profiles.conformation).toEqual(seed.rating_profiles.conformation);
    expect(json.rating_profiles.gaits).toEqual(seed.rating_profiles.gaits);
    expect(json.rating_profiles.is_gaited_breed).toBe(seed.rating_profiles.is_gaited_breed);
    expect(json.rating_profiles.gaited_gait_registry).toEqual(seed.rating_profiles.gaited_gait_registry);
    expect(json.temperament_weights).toEqual(seed.temperament_weights);
  });

  it('carries no starter_stats copy (backend/data/breedStarterStats.json is the one copy)', () => {
    expect(Object.values(JSON_PROFILES).filter(p => 'starter_stats' in p)).toEqual([]);
  });
});

describe('validateProfile - Runtime Validation', () => {
  test('the sample breeds are one non-gaited and one gaited breed', () => {
    expect(JSON_PROFILES[NON_GAITED].rating_profiles.is_gaited_breed).toBe(false);
    expect(JSON_PROFILES[GAITED].rating_profiles.is_gaited_breed).toBe(true);
  });

  test('every breed in breedProfiles.json passes validation', () => {
    const failures = Object.entries(JSON_PROFILES)
      .map(([name, profile]) => [name, validateProfile(name, profile)])
      .filter(([, errors]) => errors.length > 0);
    expect(failures).toEqual([]);
  });

  test('rejects profile with missing rating_profiles', () => {
    const errors = validateProfile(NON_GAITED, { temperament_weights: {} });
    expect(errors).toContain('missing rating_profiles');
  });

  test('rejects profile with missing conformation region', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    delete badProfile.rating_profiles.conformation.head;
    expect(validateProfile(NON_GAITED, badProfile)).toContain('missing conformation region: head');
  });

  test('rejects profile with conformation mean out of range', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.rating_profiles.conformation.head.mean = 150;
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('conformation.head.mean out of range'))).toBe(true);
  });

  test('rejects profile with missing gait entry', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    delete badProfile.rating_profiles.gaits.walk;
    expect(validateProfile(NON_GAITED, badProfile)).toContain('missing gait: walk');
  });

  test('rejects temperament weights that do not sum to 100', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.temperament_weights.Spirited = 99;
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('temperament weights sum to'))).toBe(true);
  });

  test('rejects gaited breed with null gaiting score', () => {
    const badProfile = clone(JSON_PROFILES[GAITED]);
    badProfile.rating_profiles.gaits.gaiting = null;
    expect(validateProfile(GAITED, badProfile)).toContain('gaited breed must have non-null gaiting score');
  });

  test('rejects non-gaited breed with non-null gaiting score', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.rating_profiles.gaits.gaiting = { mean: 50, std_dev: 9 };
    expect(validateProfile(NON_GAITED, badProfile)).toContain('non-gaited breed must have null gaiting score');
  });

  test('rejects gaited breed with empty registry', () => {
    const badProfile = clone(JSON_PROFILES[GAITED]);
    badProfile.rating_profiles.gaited_gait_registry = [];
    expect(validateProfile(GAITED, badProfile)).toContain('gaited breed must have non-empty gaited_gait_registry');
  });

  test('rejects null profile without crashing', () => {
    expect(validateProfile(NON_GAITED, null)).toContain('profile is null, undefined, or not an object');
  });

  test('rejects undefined profile without crashing', () => {
    expect(validateProfile(NON_GAITED, undefined)).toContain('profile is null, undefined, or not an object');
  });

  test('rejects NaN conformation mean', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.rating_profiles.conformation.head.mean = NaN;
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('conformation.head.mean is not a finite number'))).toBe(true);
  });

  test('rejects undefined conformation std_dev', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.rating_profiles.conformation.neck.std_dev = undefined;
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('conformation.neck.std_dev is not a finite number'))).toBe(true);
  });

  test('rejects NaN gait mean', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.rating_profiles.gaits.walk.mean = NaN;
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('gaits.walk.mean is not a finite number'))).toBe(true);
  });

  test('rejects extra temperament keys', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.temperament_weights.ExtraType = 0;
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('temperament_weights has 13 keys, expected 12'))).toBe(true);
  });

  test('rejects extra conformation regions', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.rating_profiles.conformation.extraRegion = { mean: 50, std_dev: 8 };
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('conformation has 9 regions, expected 8'))).toBe(true);
  });

  test('rejects non-integer temperament weights', () => {
    const badProfile = clone(JSON_PROFILES[NON_GAITED]);
    badProfile.temperament_weights.Spirited = 30.5;
    badProfile.temperament_weights.Nervous = 14.5;
    const errors = validateProfile(NON_GAITED, badProfile);
    expect(errors.some(e => e.includes('is not an integer'))).toBe(true);
  });
});
