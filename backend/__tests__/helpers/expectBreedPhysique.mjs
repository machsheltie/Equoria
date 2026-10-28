/**
 * Assert that a stored horse's conformation and gaits were rolled from its breed's
 * ranges (Equoria-vqz4b, Equoria-17zgu; owner request 2026-10-28). Shared by the Horse
 * Trader and onboarding regression tests.
 *
 * Checks, against backend/data/breedProfiles.json (the profile the backend reads when
 * the DB cache is not preloaded, as in tests):
 *   - the 8 conformation regions are not all one value, each is an integer inside its
 *     OWN breed range (mean +/- 4 stdDev, clamped to 0..100), and the overall score is
 *     their rounded mean;
 *   - gaitScores is present with walk, trot, canter and gallop, each inside its own
 *     range widened by the existing conformation-to-gait adjustment, which is
 *     (avg of mapped regions - 70) * 0.15 and so lies in -10.5..+4.5;
 *   - a gaited breed has exactly its named special gaits, each scored in the shared
 *     special-gait range; a non-gaited breed has none.
 */

import { expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(resolve(here, '../../data/breedProfiles.json'), 'utf8'));

const regions = ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline'];
const standardGaits = ['walk', 'trot', 'canter', 'gallop'];
const gaitBonusMin = -10.5;
const gaitBonusMax = 4.5;

function inRange(value, { mean, stdDev }, low = 0, high = 0) {
  const min = Math.max(0, Math.floor(mean - 4 * stdDev + low));
  const max = Math.min(100, Math.ceil(mean + 4 * stdDev + high));
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * @param {{ conformationScores: object, gaitScores: object|null }} horse - the stored row
 * @param {string} breedName - the breed the scores must come from
 */
export function expectBreedPhysique(horse, breedName) {
  const rating = profiles[breedName]?.ratingProfiles;
  if (!rating) {
    throw new Error(`expectBreedPhysique: no breedProfiles.json entry for "${breedName}"`);
  }

  const conf = horse.conformationScores;
  const regionValues = regions.map(r => conf?.[r]);
  expect(new Set(regionValues).size).toBeGreaterThan(1);
  for (const region of regions) {
    expect({ region, inBreedRange: inRange(conf[region], rating.conformation[region]) }).toEqual({
      region,
      inBreedRange: true,
    });
  }
  expect(conf.overallConformation).toBe(
    Math.round(regionValues.reduce((a, b) => a + b, 0) / regions.length),
  );

  const gaits = horse.gaitScores;
  expect(gaits).not.toBeNull();
  for (const gait of standardGaits) {
    expect({
      gait,
      inBreedRange: inRange(gaits[gait], rating.gaits[gait], gaitBonusMin, gaitBonusMax),
    }).toEqual({ gait, inBreedRange: true });
  }
  if (rating.isGaitedBreed) {
    expect(gaits.gaiting.map(g => g.name)).toEqual(rating.gaitedGaitRegistry);
    for (const entry of gaits.gaiting) {
      expect({
        gait: entry.name,
        inBreedRange: inRange(entry.score, rating.gaits.gaiting, gaitBonusMin, gaitBonusMax),
      }).toEqual({ gait: entry.name, inBreedRange: true });
    }
  } else {
    expect(gaits.gaiting).toBeNull();
  }
}
