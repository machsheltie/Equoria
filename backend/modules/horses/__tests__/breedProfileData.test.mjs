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
const dataDir = resolve(__dirname, '../../../data');
const jsonProfiles = JSON.parse(readFileSync(join(dataDir, 'breedProfiles.json'), 'utf8'));

const seedProfiles = {};
for (const file of readdirSync(join(dataDir, 'breeds'))) {
  const body = readFileSync(join(dataDir, 'breeds', file), 'utf8');
  const name = body.match(/^\('((?:[^']|'')+)', /m)[1].replace(/''/g, "'");
  seedProfiles[name] = JSON.parse(body.match(/\$json\$([\s\S]*)\$json\$/)[1]);
}

const clone = value => JSON.parse(JSON.stringify(value));
const nonGaited = 'Thoroughbred';
const GAITED = 'American Saddlebred';

describe('breedProfiles.json agrees with the seed files (owner ruling 2026-10-21)', () => {
  it('covers exactly the same 312 breeds', () => {
    expect(Object.keys(jsonProfiles).sort()).toEqual(Object.keys(seedProfiles).sort());
    expect(Object.keys(jsonProfiles)).toHaveLength(312);
  });

  it.each(Object.keys(seedProfiles))('%s: same conformation, gaits, gaited status and temperament odds', name => {
    const json = jsonProfiles[name];
    const seed = seedProfiles[name];
    expect(json.ratingProfiles.conformation).toEqual(seed.ratingProfiles.conformation);
    expect(json.ratingProfiles.gaits).toEqual(seed.ratingProfiles.gaits);
    expect(json.ratingProfiles.isGaitedBreed).toBe(seed.ratingProfiles.isGaitedBreed);
    expect(json.ratingProfiles.gaitedGaitRegistry).toEqual(seed.ratingProfiles.gaitedGaitRegistry);
    expect(json.temperamentWeights).toEqual(seed.temperamentWeights);
  });

  it('carries no starterStats copy (backend/data/breedStarterStats.json is the one copy)', () => {
    expect(Object.values(jsonProfiles).filter(p => 'starterStats' in p)).toEqual([]);
  });
});

describe('validateProfile - Runtime Validation', () => {
  test('the sample breeds are one non-gaited and one gaited breed', () => {
    expect(jsonProfiles[nonGaited].ratingProfiles.isGaitedBreed).toBe(false);
    expect(jsonProfiles[GAITED].ratingProfiles.isGaitedBreed).toBe(true);
  });

  test('every breed in breedProfiles.json passes validation', () => {
    const failures = Object.entries(jsonProfiles)
      .map(([name, profile]) => [name, validateProfile(name, profile)])
      .filter(([, errors]) => errors.length > 0);
    expect(failures).toEqual([]);
  });

  test('rejects profile with missing ratingProfiles', () => {
    const errors = validateProfile(nonGaited, { temperamentWeights: {} });
    expect(errors).toContain('missing ratingProfiles');
  });

  test('rejects profile with missing conformation region', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    delete badProfile.ratingProfiles.conformation.head;
    expect(validateProfile(nonGaited, badProfile)).toContain('missing conformation region: head');
  });

  test('rejects profile with conformation mean out of range', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.ratingProfiles.conformation.head.mean = 150;
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('conformation.head.mean out of range'))).toBe(true);
  });

  test('rejects profile with missing gait entry', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    delete badProfile.ratingProfiles.gaits.walk;
    expect(validateProfile(nonGaited, badProfile)).toContain('missing gait: walk');
  });

  test('rejects temperament weights that do not sum to 100', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.temperamentWeights.Spirited = 99;
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('temperament weights sum to'))).toBe(true);
  });

  test('rejects gaited breed with null gaiting score', () => {
    const badProfile = clone(jsonProfiles[GAITED]);
    badProfile.ratingProfiles.gaits.gaiting = null;
    expect(validateProfile(GAITED, badProfile)).toContain('gaited breed must have non-null gaiting score');
  });

  test('rejects non-gaited breed with non-null gaiting score', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.ratingProfiles.gaits.gaiting = { mean: 50, stdDev: 9 };
    expect(validateProfile(nonGaited, badProfile)).toContain('non-gaited breed must have null gaiting score');
  });

  test('rejects gaited breed with empty registry', () => {
    const badProfile = clone(jsonProfiles[GAITED]);
    badProfile.ratingProfiles.gaitedGaitRegistry = [];
    expect(validateProfile(GAITED, badProfile)).toContain('gaited breed must have non-empty gaitedGaitRegistry');
  });

  test('rejects null profile without crashing', () => {
    expect(validateProfile(nonGaited, null)).toContain('profile is null, undefined, or not an object');
  });

  test('rejects undefined profile without crashing', () => {
    expect(validateProfile(nonGaited, undefined)).toContain('profile is null, undefined, or not an object');
  });

  test('rejects NaN conformation mean', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.ratingProfiles.conformation.head.mean = NaN;
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('conformation.head.mean is not a finite number'))).toBe(true);
  });

  test('rejects undefined conformation stdDev', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.ratingProfiles.conformation.neck.stdDev = undefined;
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('conformation.neck.stdDev is not a finite number'))).toBe(true);
  });

  test('rejects NaN gait mean', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.ratingProfiles.gaits.walk.mean = NaN;
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('gaits.walk.mean is not a finite number'))).toBe(true);
  });

  test('rejects extra temperament keys', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.temperamentWeights.ExtraType = 0;
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('temperamentWeights has 13 keys, expected 12'))).toBe(true);
  });

  test('rejects extra conformation regions', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.ratingProfiles.conformation.extraRegion = { mean: 50, stdDev: 8 };
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('conformation has 9 regions, expected 8'))).toBe(true);
  });

  test('rejects non-integer temperament weights', () => {
    const badProfile = clone(jsonProfiles[nonGaited]);
    badProfile.temperamentWeights.Spirited = 30.5;
    badProfile.temperamentWeights.Nervous = 14.5;
    const errors = validateProfile(nonGaited, badProfile);
    expect(errors.some(e => e.includes('is not an integer'))).toBe(true);
  });
});
