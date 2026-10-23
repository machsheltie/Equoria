/**
 * The population inbreeding analysis and the optimal-pair search read ONE
 * pedigree graph, not one pedigree per horse or per pair (Equoria-cmw85.4,
 * Equoria-cmw85.5).
 *
 * The defects: analyzePopulationInbreeding re-walked two pedigrees (~62 queries)
 * for every horse in the collection, and generateOptimalBreedingRecommendations
 * re-fetched both horses and re-walked both pedigrees for every stallion x mare
 * pair, so a 4 x 5 herd cost over a thousand sequential round-trips.
 *
 * Both assertions are against the real database and the real services:
 *   1. query count: no per-horse findUnique, and a findMany total that is a
 *      small constant (a few per generation), independent of population size
 *      and of the number of pairs (a counting wrapper delegates to the client);
 *   2. identical results: the coefficients and bins derived by hand from
 *      Wright's (1/2)^(n1+n2+1) rule, and every pair's score equal to the one
 *      the single-pair API (assessBreedingPairCompatibility) returns.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { analyzePopulationInbreeding } from '../services/genetics/populationHealth.mjs';
import {
  assessBreedingPairCompatibility,
  generateOptimalBreedingRecommendations,
} from '../services/genetics/breedingCompatibility.mjs';

const SCOPE = 'TestFixture-PedigreeBatch';
const RUN = randomBytes(6).toString('hex');

let user;
const createdHorseIds = [];
const cleanup = createCleanupTracker();
const h = {};

async function makeHorse(key, sex, sireId = null, damId = null) {
  const n = createdHorseIds.length;
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-${key}-${RUN}`,
      sex,
      dateOfBirth: new Date('2018-01-01'),
      age: 5,
      userId: user.id,
      sireId,
      damId,
      speed: 40 + n * 3,
      stamina: 50 + n * 2,
      agility: 45 + n,
      intelligence: 55 - n,
    },
  });
  createdHorseIds.push(horse.id);
  h[key] = horse;
  return horse;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `pedbatch-${RUN}@test.com`,
      username: `pedbatch${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Pedigree',
      lastName: 'Batch',
      money: 0,
    },
  });

  // Founders: stallions F1, F3; mares F2, F4.
  const f1 = await makeHorse('F1', 'Stallion');
  const f2 = await makeHorse('F2', 'Mare');
  const f3 = await makeHorse('F3', 'Stallion');
  const f4 = await makeHorse('F4', 'Mare');
  // Generation 1.
  const s1 = await makeHorse('S1', 'Stallion', f1.id, f2.id);
  const s2 = await makeHorse('S2', 'Stallion', f3.id, f2.id);
  const m1 = await makeHorse('M1', 'Mare', f1.id, f4.id);
  const m2 = await makeHorse('M2', 'Mare', f3.id, f4.id);
  const m3 = await makeHorse('M3', 'Mare', f1.id, f2.id); // full sister of S1
  // Generation 2.
  await makeHorse('C1', 'Mare', s1.id, m1.id); // S1 x M1 share F1
  await makeHorse('C2', 'Stallion', s2.id, m2.id); // S2 x M2 share F3
  await makeHorse('C3', 'Mare', s1.id, m3.id); // full siblings: share F1 and F2
  await makeHorse('C4', 'Stallion', s2.id, m1.id); // unrelated parents

  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'pedigreeHorses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'pedigreeBatchUser');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

/** Run `fn` while counting every horse findUnique / findMany it issues. */
async function countingHorseQueries(fn) {
  const ops = { findUnique: 0, findMany: 0 };
  const realFindUnique = prisma.horse.findUnique.bind(prisma.horse);
  const realFindMany = prisma.horse.findMany.bind(prisma.horse);
  prisma.horse.findUnique = (...args) => {
    ops.findUnique += 1;
    return realFindUnique(...args);
  };
  prisma.horse.findMany = (...args) => {
    ops.findMany += 1;
    return realFindMany(...args);
  };
  try {
    return { result: await fn(), ops };
  } finally {
    prisma.horse.findUnique = realFindUnique;
    prisma.horse.findMany = realFindMany;
  }
}

const idsOf = keys => keys.map(k => h[k].id);

describe('analyzePopulationInbreeding reads one pedigree graph (Equoria-cmw85.4)', () => {
  const population = ['F1', 'F2', 'F3', 'F4', 'S1', 'S2', 'M1', 'M2', 'M3', 'C1', 'C2', 'C3', 'C4'];

  it('returns the hand-derived distribution with a constant number of queries', async () => {
    const { result, ops } = await countingHorseQueries(() => analyzePopulationInbreeding(idsOf(population)));

    // C1 (S1 x M1) and C2 (S2 x M2) share one parent-level ancestor: (1/2)^3 = 0.125,
    // low coefficient but a recent common ancestor -> 'medium'. C3 (full siblings)
    // shares F1 and F2: 0.125 + 0.125 = 0.25 -> 'high'. Every other horse is a
    // founder or has unrelated parents: coefficient 0.
    expect(result.distribution).toEqual({ low: 10, medium: 2, high: 1, critical: 0 });
    expect(result.averageCoefficient).toBe(0.038); // 0.5 / 13
    expect(result.inbredPercentage).toBe(23); // 3 / 13
    expect(result.riskLevel).toBe('low');

    // One read of the population plus one pedigree read per generation (5), not
    // ~62 per horse.
    expect(ops.findUnique).toBe(0);
    expect(ops.findMany).toBeLessThanOrEqual(6);
  }, 60_000);

  it('issues the same number of queries for a smaller population', async () => {
    const small = await countingHorseQueries(() => analyzePopulationInbreeding(idsOf(['S1', 'M3', 'C3'])));
    expect(small.ops.findUnique).toBe(0);
    expect(small.ops.findMany).toBeLessThanOrEqual(6);
    expect(small.result.distribution).toEqual({ low: 2, medium: 0, high: 1, critical: 0 });
  }, 60_000);
});

describe('generateOptimalBreedingRecommendations reads one pedigree graph (Equoria-cmw85.5)', () => {
  const stallions = ['S1', 'S2', 'F1', 'F3'];
  const mares = ['M1', 'M2', 'M3', 'F2', 'F4'];
  const diversityOf = async () => ({ diversityScore: 50 });

  it('queries independently of the number of pairs, and scores each pair as the pair API does', async () => {
    const herd = idsOf([...stallions, ...mares]);
    const { result, ops } = await countingHorseQueries(() =>
      generateOptimalBreedingRecommendations(herd, { diversityOf }),
    );

    // 20 pairs. One read of the herd + one pedigree read per generation (5).
    expect(ops.findUnique).toBe(0);
    expect(ops.findMany).toBeLessThanOrEqual(6);

    // Every pair the search reports carries the score the single-pair API gives it.
    const reported = [...result.optimalPairs, ...result.avoidPairs];
    expect(reported.length).toBeGreaterThan(0);
    for (const pair of reported) {
      const expected = await assessBreedingPairCompatibility(pair.stallionId, pair.mareId);
      expect(pair.compatibilityScore).toBe(expected.overallScore);
    }

    // The full siblings S1 x M3 have coefficient 0.25 by the pair API too.
    const siblings = await assessBreedingPairCompatibility(h.S1.id, h.M3.id);
    expect(siblings.inbreedingRisk).toBe(0.25);
  }, 120_000);

  it('uses the same number of queries for a herd with more pairs', async () => {
    const small = await countingHorseQueries(() =>
      generateOptimalBreedingRecommendations(idsOf(['S1', 'M1']), { diversityOf }),
    );
    const large = await countingHorseQueries(() =>
      generateOptimalBreedingRecommendations(idsOf([...stallions, ...mares]), { diversityOf }),
    );
    expect(small.ops.findUnique).toBe(0);
    expect(large.ops.findUnique).toBe(0);
    expect(large.ops.findMany).toBeLessThanOrEqual(small.ops.findMany);
  }, 120_000);
});
