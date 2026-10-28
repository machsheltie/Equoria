// Owner request 2026-10-28 (Equoria-vqz4b, Equoria-17zgu): a store or starter horse's
// conformation and gaits are rolled from its breed's ranges, each region and each gait
// individually from its OWN range. With the uniform source fixed, every Box-Muller draw
// has the same z, so each score must equal round(ownMean + z * ownStdDev); one generic
// value across the board, or one region's range reused for another, fails these exact
// checks.
//
// Owner ruling 2026-10-28 (q210) changed the gait contract: the old one added a
// conformation-to-gait adjustment, (average of the mapped regions - 70) * 0.15, to every
// gait. Gaits now come only from the breed's gait ranges, so a gait score is exactly
// round(gaitMean + z * gaitStdDev) whatever the conformation. Owner ruling q211 changed
// the missing-breed contract: the old OrNull form returned null and the horse kept its
// placeholder scores; now the horse is refused.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  generateBreedPhysique,
  generateBreedPhysiqueOrRefuse,
  breedScoresMissingCode,
} from '../services/breedPhysique.mjs';
import { seededRng as seeded } from '../../../__tests__/helpers/seededRng.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(resolve(here, '../../../data/breedProfiles.json'), 'utf8'));

const standardGaits = ['walk', 'trot', 'canter', 'gallop'];
const regions = ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline'];
// u1 = u2 = 0.1 gives z = sqrt(-2 ln 0.1) * cos(0.2 pi), about 1.74: a clear offset from
// the mean, so a region that borrowed another region's range would land elsewhere.
const fixedU = 0.1;
const fixedZ = Math.sqrt(-2 * Math.log(fixedU)) * Math.cos(2 * Math.PI * fixedU);
const expectedScore = (mean, stdDev) => Math.round(Math.min(100, Math.max(0, mean + fixedZ * stdDev)));

describe('generateBreedPhysique (Equoria-vqz4b, Equoria-17zgu)', () => {
  test.each(['American Saddlebred', 'Morgan USA'])(
    '%s: every conformation region is rolled from its own breed range',
    breedName => {
      const ranges = profiles[breedName].ratingProfiles.conformation;
      const { conformationScores } = generateBreedPhysique(breedName, { random: () => fixedU });
      for (const region of regions) {
        expect(conformationScores[region]).toBe(expectedScore(ranges[region].mean, ranges[region].stdDev));
      }
      const regionValues = regions.map(r => conformationScores[r]);
      expect(new Set(regionValues).size).toBeGreaterThan(1);
      expect(conformationScores.overallConformation).toBe(
        Math.round(regionValues.reduce((a, b) => a + b, 0) / regions.length),
      );
    },
  );

  test('gaited breed: each standard gait and each named special gait comes from its gait range only (q210)', () => {
    const rating = profiles['American Saddlebred'].ratingProfiles;
    const { conformationScores, gaitScores } = generateBreedPhysique('American Saddlebred', {
      random: () => fixedU,
    });
    // The rolled conformation is far from the old neutral 70, so the removed
    // adjustment would have moved every gait off its own range.
    const gallopRegions = (conformationScores.legs + conformationScores.hindquarters) / 2;
    expect(Math.abs(gallopRegions - 70) * 0.15).toBeGreaterThanOrEqual(0.5);
    for (const gait of standardGaits) {
      expect(gaitScores[gait]).toBe(expectedScore(rating.gaits[gait].mean, rating.gaits[gait].stdDev));
    }
    expect(gaitScores.gaiting.map(g => g.name)).toEqual(rating.gaitedGaitRegistry);
    for (const entry of gaitScores.gaiting) {
      expect(entry.score).toBe(expectedScore(rating.gaits.gaiting.mean, rating.gaits.gaiting.stdDev));
    }
  });

  test('non-gaited breed: four standard gaits, no special gaits', () => {
    const { gaitScores } = generateBreedPhysique('Morgan USA');
    for (const gait of standardGaits) {
      expect(Number.isInteger(gaitScores[gait])).toBe(true);
    }
    expect(gaitScores.gaiting).toBeNull();
  });

  test('the random source is injectable: one seed repeats, another seed differs', () => {
    const a = generateBreedPhysique('American Saddlebred', { random: seeded(7) });
    const b = generateBreedPhysique('American Saddlebred', { random: seeded(7) });
    const c = generateBreedPhysique('American Saddlebred', { random: seeded(8) });
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
    // Named special gaits draw separately: with a varying source the two differ in
    // general; over a few seeds at least one horse shows different Rack and Slow Gait.
    const differs = [1, 2, 3, 4, 5].some(seed => {
      const [rack, slow] = generateBreedPhysique('American Saddlebred', { random: seeded(seed) }).gaitScores.gaiting;
      return rack.score !== slow.score;
    });
    expect(differs).toBe(true);
  });

  test('a breed without ranges is refused, never given fallback scores (q211)', () => {
    expect(() => generateBreedPhysique('No Such Breed vqz4b')).toThrow();
    let refusal;
    try {
      generateBreedPhysiqueOrRefuse('No Such Breed vqz4b');
    } catch (err) {
      refusal = err;
    }
    expect(refusal).toBeDefined();
    expect(refusal.code).toBe(breedScoresMissingCode);
    expect(refusal.statusCode).toBe(422);
  });
});
