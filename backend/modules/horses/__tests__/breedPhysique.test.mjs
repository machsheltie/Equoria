// Owner request 2026-10-28 (Equoria-vqz4b, Equoria-17zgu): a store or starter horse's
// conformation and gaits are rolled from its breed's ranges, each region and each gait
// individually from its OWN range. With the uniform source fixed, every Box-Muller draw
// has the same z, so each score must equal round(ownMean + z * ownStdDev) (+ the
// existing conformation-to-gait adjustment for gaits); one generic value across the
// board, or one region's range reused for another, fails these exact checks.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateBreedPhysique, generateBreedPhysiqueOrNull } from '../services/breedPhysique.mjs';
import { calculateConformationBonus } from '../services/gaitService.mjs';
import { seededRng as seeded } from '../../../__tests__/helpers/seededRng.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(resolve(here, '../../../data/breedProfiles.json'), 'utf8'));

const standardGaits = ['walk', 'trot', 'canter', 'gallop'];
const regions = ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline'];
// u1 = u2 = 0.1 gives z = sqrt(-2 ln 0.1) * cos(0.2 pi), about 1.74: a clear offset from
// the mean, so a region that borrowed another region's range would land elsewhere.
const fixedU = 0.1;
const fixedZ = Math.sqrt(-2 * Math.log(fixedU)) * Math.cos(2 * Math.PI * fixedU);
const expectedScore = (mean, stdDev, bonus = 0) =>
  Math.round(Math.min(100, Math.max(0, mean + fixedZ * stdDev + bonus)));

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

  test('gaited breed: each standard gait and each named special gait is rolled separately', () => {
    const rating = profiles['American Saddlebred'].ratingProfiles;
    const { conformationScores, gaitScores } = generateBreedPhysique('American Saddlebred', {
      random: () => fixedU,
    });
    for (const gait of standardGaits) {
      expect(gaitScores[gait]).toBe(
        expectedScore(
          rating.gaits[gait].mean,
          rating.gaits[gait].stdDev,
          calculateConformationBonus(conformationScores, gait),
        ),
      );
    }
    expect(gaitScores.gaiting.map(g => g.name)).toEqual(rating.gaitedGaitRegistry);
    const gaitingBonus = calculateConformationBonus(conformationScores, 'gaiting');
    for (const entry of gaitScores.gaiting) {
      expect(entry.score).toBe(expectedScore(rating.gaits.gaiting.mean, rating.gaits.gaiting.stdDev, gaitingBonus));
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

  test('a breed without ranges: generateBreedPhysique throws, the OrNull form returns null', () => {
    expect(() => generateBreedPhysique('No Such Breed vqz4b')).toThrow();
    expect(generateBreedPhysiqueOrNull('No Such Breed vqz4b')).toBeNull();
  });
});
