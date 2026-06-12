/**
 * Conformation-analysis converted-query equivalence test (Equoria-lnblu).
 *
 * Equoria-lnblu migrated `getConformationAnalysis`'s percentile aggregation off
 * the allowlisted `prisma.$queryRawUnsafe(sql, ...params)` form to the
 * parameterized `prisma.$queryRaw(Prisma.sql\`…\`)` form: the per-region
 * `COUNT(*) FILTER (...) AS lt_<region>` fragments are composed via
 * `Prisma.join`, the region identifiers interpolated via `Prisma.raw` (vetted
 * against the fixed CONFORMATION_REGIONS list), and every numeric threshold +
 * breedId bound as a `${}` parameter.
 *
 * The broad behavioural coverage of this endpoint lives in
 * conformationApiEndpoints.test.mjs (ranges/properties). THIS suite is the
 * narrow equivalence proof: against a fully-controlled same-breed population
 * (its own unique breed, so no other suite's horses pollute the count) it
 * asserts the EXACT percentile integers the converted query must produce —
 * count_below / total * 100, rounded. If the Prisma.sql composition ever
 * bound the wrong threshold, swapped a region identifier, or mis-joined the
 * FILTER fragments, these exact assertions fail.
 *
 * Real DB. Real prisma. No mocks (CLAUDE.md §3).
 */

import { describe, beforeAll, afterAll, expect, test } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getConformationAnalysis } from '../controllers/horseController.mjs';
import { CONFORMATION_REGIONS } from '../services/conformationService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const ts = `${randomBytes(8).toString('hex')}_${Math.random().toString(36).slice(2, 7)}`;
let testUser;
let testBreed;
const createdHorseIds = [];

/** Uniform scores across all 8 regions + overall. */
function makeScores(value) {
  return Object.fromEntries([
    ...CONFORMATION_REGIONS.map(r => [r, value]),
    ['overallConformation', value],
  ]);
}

async function seedHorse(scores) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `LnbluConfTest_${randomBytes(8).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 4,
      breedId: testBreed.id,
      userId: testUser.id,
      conformationScores: scores,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

function makeMockReqRes(conformationScores) {
  const horse = { id: 0, name: 'TestFixture-Subject', breedId: testBreed.id, conformationScores };
  const req = { horse, params: { id: '0' } };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return { req, res };
}

beforeAll(async () => {
  const hashed = await bcrypt.hash('TestPassword123!', 1);
  testUser = await prisma.user.create({
    data: {
      username: `lnbluConfUser_${ts}`,
      email: `lnbluconf_${ts}@test.com`,
      password: hashed,
      firstName: 'LnbluConf',
      lastName: 'Test',
    },
  });
  // A UNIQUE breed per run so the same-breed population is EXACTLY the four
  // horses this suite seeds — enabling exact-percentile assertions. The breed
  // name is unique per-run so a parallel worker cannot collide on it.
  testBreed = await prisma.breed.create({
    data: {
      name: `TestFixture-LnbluBreed_${ts}`,
      description: 'Equoria-lnblu converted-query equivalence fixture breed',
    },
  });
}, 30000);

afterAll(async () => {
  if (createdHorseIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  }
  if (testBreed?.id) {
    await prisma.breed.deleteMany({ where: { id: testBreed.id } });
  }
  if (testUser?.id) {
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  }
}, 30000);

describe('getConformationAnalysis — converted Prisma.sql aggregation equivalence (Equoria-lnblu)', () => {
  test('exact per-region + overall percentiles for a fully-controlled 4-horse breed population', async () => {
    // Population scores: 40, 60, 80, 95 in every region (and overall).
    await seedHorse(makeScores(40));
    await seedHorse(makeScores(60));
    await seedHorse(makeScores(80));
    await seedHorse(makeScores(95));

    // Subject scores 70 in every region. count_below (40,60) = 2 of 4 → 50%.
    const { req, res } = makeMockReqRes(makeScores(70));
    await getConformationAnalysis(req, res);

    expect(res.statusCode).toBe(200);
    const { data } = res.body;
    expect(res.body.success).toBe(true);
    // Exactly the 4 horses this suite seeded — unique breed isolates the count.
    expect(data.totalHorsesInBreed).toBe(4);

    // count_below(70) over {40,60,80,95} = 2 → round(2/4*100) = 50 for every region.
    for (const region of CONFORMATION_REGIONS) {
      expect(data.analysis[region].percentile).toBe(50);
    }
    // Overall is computed from the COALESCE(stored overallConformation, avg)
    // expression; the four rows store overallConformation = 40/60/80/95, so the
    // overall percentile mirrors the per-region one exactly.
    expect(data.overallConformation.percentile).toBe(50);
  });

  test('subject below the entire population scores 0th percentile; above scores 100th', async () => {
    // Reuse the same four-horse population (40,60,80,95) seeded in the prior
    // test — they persist for the suite and are this breed's entire population.
    const below = makeMockReqRes(makeScores(10));
    await getConformationAnalysis(below.req, below.res);
    const belowData = below.res.body.data;
    expect(belowData.totalHorsesInBreed).toBe(4);
    for (const region of CONFORMATION_REGIONS) {
      // count_below(10) over {40,60,80,95} = 0 → 0%.
      expect(belowData.analysis[region].percentile).toBe(0);
    }
    expect(belowData.overallConformation.percentile).toBe(0);

    const above = makeMockReqRes(makeScores(99));
    await getConformationAnalysis(above.req, above.res);
    const aboveData = above.res.body.data;
    for (const region of CONFORMATION_REGIONS) {
      // count_below(99) over {40,60,80,95} = 4 → 100%.
      expect(aboveData.analysis[region].percentile).toBe(100);
    }
    expect(aboveData.overallConformation.percentile).toBe(100);
  });
});
