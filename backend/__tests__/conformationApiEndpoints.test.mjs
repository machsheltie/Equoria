// Integration tests for conformation API endpoints (Story 31B-3).
// Validates GET /conformation and GET /conformation/analysis responses,
// legacy horse handling, percentile calculations, and error cases.
//
// Uses the real Prisma client against the test database — no mocks of
// db/index.mjs. Follows the pattern in
// backend/__tests__/integration/crossSystemValidation.test.mjs:
// seed breed/user/horses in beforeAll, clean up in afterAll.
//
// Isolation strategy:
//   • Analysis tests run against a UNIQUE per-run breed (testBreed). No
//     other suite targets that breed, so parallel Jest workers cannot
//     contaminate findMany results.
//   • Within-suite isolation: getConformationAnalysis tests each assert on
//     exact horse counts and percentile values. A beforeEach inside that
//     describe deletes all testBreed horses before each test so accumulated
//     state from earlier tests does not corrupt later assertions.
//   • The single test that asserts breedMean comes from breedProfiles.json
//     uses the real Thoroughbred breed (upserted in beforeAll) because the
//     loader is keyed by display name. That test only checks breedMean
//     values derived from the JSON file — unaffected by Thoroughbred horses
//     other suites may have created.

import { jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import prisma from '../../packages/database/prismaClient.mjs';

const { getConformation, getConformationAnalysis } = await import(
  '../modules/horses/controllers/horseController.mjs'
);
const { CONFORMATION_REGIONS } = await import(
  '../modules/horses/services/conformationService.mjs'
);

describe('Conformation API Endpoints', () => {
  let thoroughbredBreed;
  let testBreed;
  let testUser;
  const suiteSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const createdHorseIds = [];

  beforeAll(async () => {
    // Upsert the real Thoroughbred breed. Used only by the single
    // breed-profile test below — other suites also seed this row, so we
    // upsert rather than create.
    thoroughbredBreed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: {
        name: 'Thoroughbred',
        description: 'Thoroughbred (seeded for conformation API tests)',
      },
    });

    // Create a UNIQUE per-run breed. Every analysis test that asserts on
    // same-breed horse counts/percentiles uses this breed so parallel
    // suites cannot contaminate findMany results.
    testBreed = await prisma.breed.create({
      data: {
        name: `ConfTestBreed_${suiteSuffix}`,
        description: 'Per-run breed used by conformationApiEndpoints.test.mjs',
      },
    });

    // Dedicated test user so afterAll can sweep horses by userId as a
    // safety net even if createdHorseIds tracking misses something.
    testUser = await prisma.user.create({
      data: {
        username: `confApiUser_${suiteSuffix}`,
        email: `confApi_${suiteSuffix}@test.com`,
        password: 'testPassword123',
        firstName: 'Conf',
        lastName: 'ApiTest',
      },
    });
  });

  afterAll(async () => {
    // Clean up only what this suite created. Track-by-ID first, then
    // sweep anything left owned by the test user. The Thoroughbred breed
    // row is shared with other suites — do NOT delete it. The unique
    // testBreed IS owned by this suite, so it's safe to delete.
    if (createdHorseIds.length > 0) {
      await prisma.horse
        .deleteMany({ where: { id: { in: createdHorseIds } } })
        .catch(() => {});
    }
    if (testUser) {
      await prisma.horse.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});
    }
    if (testBreed) {
      await prisma.breed.deleteMany({ where: { id: testBreed.id } }).catch(() => {});
    }
  }, 20000);

  // Create a horse row in the test DB with specified conformationScores
  // and track its id for cleanup. Defaults to the unique per-run breed.
  async function seedHorse(conformationScores, breedId = testBreed.id) {
    const fourYearsAgo = new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000);
    const horse = await prisma.horse.create({
      data: {
        name: `ConfTestHorse_${suiteSuffix}_${createdHorseIds.length}`,
        userId: testUser.id,
        breedId,
        sex: 'Mare',
        dateOfBirth: fourYearsAgo,
        age: 4,
        healthStatus: 'Good',
        // Prisma 6 requires Prisma.DbNull to store a DB NULL in a
        // nullable Json column; a plain `null` would be rejected.
        conformationScores: conformationScores === null ? Prisma.DbNull : conformationScores,
      },
    });
    createdHorseIds.push(horse.id);
    return horse;
  }

  // Build a mock req/res pair. req.horse is attached directly (the
  // controllers read it from middleware, so no DB fetch for the subject
  // horse is required). Caller can override breedId to point at the
  // Thoroughbred breed for the one test that needs it.
  function createMockReqRes(horseOverrides = {}) {
    const horse = {
      id: 123,
      name: 'Midnight Star',
      breedId: testBreed.id,
      conformationScores: {
        head: 82,
        neck: 75,
        shoulders: 70,
        back: 68,
        hindquarters: 78,
        legs: 72,
        hooves: 71,
        topline: 74,
        overallConformation: 74,
      },
      ...horseOverrides,
    };

    const req = {
      horse,
      params: { id: String(horse.id) },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    return { req, res, horse };
  }

  // === Task 3.1: GET /conformation returns all 8 regions + overallConformation ===
  // getConformation is purely a projection over req.horse; no DB queries.

  describe('getConformation', () => {
    test('returns all 8 regions and overallConformation for a horse with scores', async () => {
      const { req, res } = createMockReqRes();

      await getConformation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.message).toBe('Conformation scores retrieved successfully');
      expect(response.data.horseId).toBe(123);
      expect(response.data.horseName).toBe('Midnight Star');
      expect(response.data.breedId).toBe(testBreed.id);

      const scores = response.data.conformationScores;
      for (const region of CONFORMATION_REGIONS) {
        expect(scores).toHaveProperty(region);
        expect(typeof scores[region]).toBe('number');
      }
      expect(scores.overallConformation).toBe(74);
    });

    // === Task 3.2: GET /conformation returns 200 with null data for legacy horse ===

    test('returns 200 with null data for legacy horse without scores', async () => {
      const { req, res } = createMockReqRes({ conformationScores: null });

      await getConformation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.message).toBe('No conformation scores available for this horse');
      expect(response.data).toBeNull();
    });

    test('returns 200 with null data for horse with undefined scores', async () => {
      const { req, res } = createMockReqRes({ conformationScores: undefined });

      await getConformation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.data).toBeNull();
    });

    test('calculates overallConformation when not stored', async () => {
      const { req, res } = createMockReqRes({
        conformationScores: {
          head: 80,
          neck: 80,
          shoulders: 80,
          back: 80,
          hindquarters: 80,
          legs: 80,
          hooves: 80,
          topline: 80,
          // overallConformation intentionally omitted
        },
      });

      await getConformation(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const scores = res.json.mock.calls[0][0].data.conformationScores;
      expect(scores.overallConformation).toBe(80);
    });
  });

  // === Task 3.3: GET /conformation/analysis returns percentile per region ===
  // These tests hit the real DB via prisma.horse.findMany and
  // prisma.breed.findUnique. The per-run test breed is unique to this suite
  // (no cross-suite contamination), but tests within the suite accumulate
  // horses sequentially. A beforeEach wipe ensures each test starts clean.

  describe('getConformationAnalysis', () => {
    // Each test seeds horses into testBreed and checks exact counts / percentiles.
    // Without cleanup between tests, later tests see horses accumulated by earlier
    // ones, breaking count-dependent assertions (e.g. totalHorsesInBreed: 5,
    // percentile: 80). Delete all testBreed horses before each test.
    beforeEach(async () => {
      await prisma.horse.deleteMany({ where: { breedId: testBreed.id } }).catch(() => {});
    });

    test('returns percentile analysis per region for a horse with scores', async () => {
      // Seed 5 same-breed horses with varying scores
      await seedHorse({
        head: 60, neck: 60, shoulders: 60, back: 60, hindquarters: 60,
        legs: 60, hooves: 60, topline: 60, overallConformation: 60,
      });
      await seedHorse({
        head: 70, neck: 70, shoulders: 70, back: 70, hindquarters: 70,
        legs: 70, hooves: 70, topline: 70, overallConformation: 70,
      });
      await seedHorse({
        head: 82, neck: 75, shoulders: 70, back: 68, hindquarters: 78,
        legs: 72, hooves: 71, topline: 74, overallConformation: 74,
      }); // Same scores as subject horse
      await seedHorse({
        head: 90, neck: 85, shoulders: 80, back: 80, hindquarters: 85,
        legs: 80, hooves: 80, topline: 80, overallConformation: 83,
      });
      await seedHorse({
        head: 95, neck: 90, shoulders: 90, back: 90, hindquarters: 90,
        legs: 90, hooves: 90, topline: 90, overallConformation: 91,
      });

      const { req, res } = createMockReqRes();

      await getConformationAnalysis(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.message).toBe('Conformation analysis retrieved successfully');
      expect(response.data.horseId).toBe(123);
      expect(response.data.horseName).toBe('Midnight Star');
      expect(response.data.breedId).toBe(testBreed.id);
      expect(response.data.breedName).toBe(testBreed.name);
      expect(response.data.totalHorsesInBreed).toBe(5);

      // Check analysis has all 8 regions
      const { analysis } = response.data;
      for (const region of CONFORMATION_REGIONS) {
        expect(analysis).toHaveProperty(region);
        expect(analysis[region]).toHaveProperty('score');
        expect(analysis[region]).toHaveProperty('breedMean');
        expect(analysis[region]).toHaveProperty('percentile');
        expect(typeof analysis[region].percentile).toBe('number');
        expect(analysis[region].percentile).toBeGreaterThanOrEqual(0);
        expect(analysis[region].percentile).toBeLessThanOrEqual(100);
      }

      // Check overall conformation analysis
      const { overallConformation } = response.data;
      expect(overallConformation).toHaveProperty('score');
      expect(overallConformation).toHaveProperty('breedMean');
      expect(overallConformation).toHaveProperty('percentile');
    });

    // === Task 3.4: High-score horse should have high percentiles ===

    test('horse with max scores has high percentiles', async () => {
      // 5 horses with ascending scores; our subject horse is the top
      await seedHorse({
        head: 50, neck: 50, shoulders: 50, back: 50, hindquarters: 50,
        legs: 50, hooves: 50, topline: 50, overallConformation: 50,
      });
      await seedHorse({
        head: 60, neck: 60, shoulders: 60, back: 60, hindquarters: 60,
        legs: 60, hooves: 60, topline: 60, overallConformation: 60,
      });
      await seedHorse({
        head: 70, neck: 70, shoulders: 70, back: 70, hindquarters: 70,
        legs: 70, hooves: 70, topline: 70, overallConformation: 70,
      });
      await seedHorse({
        head: 80, neck: 80, shoulders: 80, back: 80, hindquarters: 80,
        legs: 80, hooves: 80, topline: 80, overallConformation: 80,
      });
      await seedHorse({
        head: 99, neck: 99, shoulders: 99, back: 99, hindquarters: 99,
        legs: 99, hooves: 99, topline: 99, overallConformation: 99,
      }); // Top horse — same scores as subject

      const { req, res } = createMockReqRes({
        conformationScores: {
          head: 99, neck: 99, shoulders: 99, back: 99, hindquarters: 99,
          legs: 99, hooves: 99, topline: 99, overallConformation: 99,
        },
      });

      await getConformationAnalysis(req, res);

      const response = res.json.mock.calls[0][0];
      const { analysis, overallConformation } = response.data;

      // Should be at 80th percentile (4 out of 5 score lower)
      for (const region of CONFORMATION_REGIONS) {
        expect(analysis[region].percentile).toBe(80);
      }
      expect(overallConformation.percentile).toBe(80);
    });

    // === Task 3.5: GET /conformation/analysis returns 200 with null data for legacy horse ===

    test('returns 200 with null data for legacy horse without scores', async () => {
      const { req, res } = createMockReqRes({ conformationScores: null });

      await getConformationAnalysis(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    test('handles single horse in breed — defaults to 50th percentile', async () => {
      // Only 1 horse in the unique breed (the subject horse's peer)
      await seedHorse({
        head: 82, neck: 75, shoulders: 70, back: 68, hindquarters: 78,
        legs: 72, hooves: 71, topline: 74, overallConformation: 74,
      });

      const { req, res } = createMockReqRes();

      await getConformationAnalysis(req, res);

      const response = res.json.mock.calls[0][0];
      const { analysis, overallConformation } = response.data;

      for (const region of CONFORMATION_REGIONS) {
        expect(analysis[region].percentile).toBe(50);
      }
      expect(overallConformation.percentile).toBe(50);
    });

    test('filters out horses without conformation scores from percentile calculation', async () => {
      // 4 horses: 1 with null scores (excluded), 3 with valid scores
      await seedHorse(null);
      await seedHorse({
        head: 60, neck: 60, shoulders: 60, back: 60, hindquarters: 60,
        legs: 60, hooves: 60, topline: 60, overallConformation: 60,
      });
      await seedHorse({
        head: 82, neck: 75, shoulders: 70, back: 68, hindquarters: 78,
        legs: 72, hooves: 71, topline: 74, overallConformation: 74,
      });
      await seedHorse({
        head: 90, neck: 90, shoulders: 90, back: 90, hindquarters: 90,
        legs: 90, hooves: 90, topline: 90, overallConformation: 90,
      });

      const { req, res } = createMockReqRes();

      await getConformationAnalysis(req, res);

      const response = res.json.mock.calls[0][0];
      // totalHorsesInBreed should exclude the null-score horse
      expect(response.data.totalHorsesInBreed).toBe(3);
    });

    test('uses breed mean from breedProfiles.json, not database average', async () => {
      // This test deliberately uses the real Thoroughbred breed because
      // breedProfileLoader is keyed by display name. The assertion only
      // checks breedMean values (derived from the JSON file), so any
      // extra Thoroughbred horses created by parallel suites do not
      // affect the result.
      await seedHorse(
        {
          head: 82, neck: 75, shoulders: 70, back: 68, hindquarters: 78,
          legs: 72, hooves: 71, topline: 74, overallConformation: 74,
        },
        thoroughbredBreed.id,
      );

      const { req, res } = createMockReqRes({ breedId: thoroughbredBreed.id });

      await getConformationAnalysis(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.data.breedName).toBe('Thoroughbred');

      // breedMean should come from breedProfiles.json (single source of truth),
      // not from the database average of same-breed horses.
      const { getBreedProfile } = await import('../modules/horses/data/breedProfileLoader.mjs');
      const tbProfile = getBreedProfile('Thoroughbred').rating_profiles.conformation;

      for (const region of CONFORMATION_REGIONS) {
        expect(response.data.analysis[region].breedMean).toBe(tbProfile[region].mean);
      }
    });
  });
});
