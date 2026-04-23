// Tests for conformation API endpoints (Story 31B-3).
// Validates GET /conformation and GET /conformation/analysis responses,
// legacy horse handling, percentile calculations, and error cases.
//
// Real database — no mocked Prisma calls per project policy.

import { describe, beforeAll, afterAll, beforeEach, expect, test } from '@jest/globals';
import { jest } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';
import bcrypt from 'bcryptjs';

// Mock logger to suppress noise (logger is external infrastructure, not business logic)
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

// Import after logger mock
const { getConformation, getConformationAnalysis } = await import(
  '../modules/horses/controllers/horseController.mjs'
);
const { CONFORMATION_REGIONS } = await import(
  '../modules/horses/services/conformationService.mjs'
);
const { getBreedProfile } = await import('../modules/horses/data/breedProfileLoader.mjs');

// ── Test data setup ────────────────────────────────────────────────────────
const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
let testUser;
let testBreed;
const createdHorseIds = [];

/** Uniform scores across all 8 regions + overall */
function makeScores(value) {
  return Object.fromEntries([
    ...CONFORMATION_REGIONS.map(r => [r, value]),
    ['overallConformation', value],
  ]);
}

const BASE_SCORES = {
  head: 82,
  neck: 75,
  shoulders: 70,
  back: 68,
  hindquarters: 78,
  legs: 72,
  hooves: 71,
  topline: 74,
  overallConformation: 74,
};

/** Create a real DB horse for this suite; track its ID for cleanup. */
async function seedHorse(scores) {
  const horse = await prisma.horse.create({
    data: {
      name: `ConfApiTest_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
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

/** Create a mock req/res with req.horse pre-populated (mirrors middleware behaviour). */
function makeMockReqRes(horseOverrides = {}) {
  const horse = {
    id: 0,
    name: 'Midnight Star',
    breedId: testBreed?.id ?? 1,
    conformationScores: { ...BASE_SCORES },
    ...horseOverrides,
  };
  const req = { horse, params: { id: String(horse.id) } };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeAll(async () => {
  const hashed = await bcrypt.hash('TestPassword123!', 10);
  testUser = await prisma.user.create({
    data: {
      username: `confApiUser_${ts}`,
      email: `confapi_${ts}@test.com`,
      password: hashed,
      firstName: 'ConfApi',
      lastName: 'Test',
    },
  });
  testBreed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'Thoroughbred (conformation API test)' },
  });
});

afterAll(async () => {
  if (createdHorseIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
  }
  if (testUser?.id) {
    await prisma.user.delete({ where: { id: testUser.id } });
  }
});

// ── GET /conformation ──────────────────────────────────────────────────────
// getConformation reads req.horse directly — no DB calls in this path.

describe('getConformation', () => {
  test('returns all 8 regions and overallConformation for a horse with scores', async () => {
    const { req, res } = makeMockReqRes();

    await getConformation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('Conformation scores retrieved successfully');
    expect(response.data.horseId).toBe(0);
    expect(response.data.horseName).toBe('Midnight Star');
    expect(response.data.breedId).toBe(testBreed.id);

    const scores = response.data.conformationScores;
    for (const region of CONFORMATION_REGIONS) {
      expect(scores).toHaveProperty(region);
      expect(typeof scores[region]).toBe('number');
    }
    expect(scores.overallConformation).toBe(74);
  });

  test('returns 200 with null data for legacy horse without scores', async () => {
    const { req, res } = makeMockReqRes({ conformationScores: null });

    await getConformation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('No conformation scores available for this horse');
    expect(response.data).toBeNull();
  });

  test('returns 200 with null data for horse with undefined scores', async () => {
    const { req, res } = makeMockReqRes({ conformationScores: undefined });

    await getConformation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.data).toBeNull();
  });

  test('calculates overallConformation when not stored', async () => {
    const { req, res } = makeMockReqRes({
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

// ── GET /conformation/analysis ─────────────────────────────────────────────

describe('getConformationAnalysis', () => {
  beforeEach(async () => {
    // Delete only horses THIS suite created so each test starts with a
    // known subset of the breed population. Other suites' Thoroughbred horses
    // may still be present — assertions use ranges rather than exact counts.
    if (createdHorseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
      createdHorseIds.length = 0;
    }
    mockLogger.warn.mockClear();
  });

  test('returns percentile analysis per region for a horse with scores', async () => {
    // Seed a small population so the analysis path exercises breedMean lookup
    await seedHorse(makeScores(60));
    await seedHorse(makeScores(70));
    await seedHorse(makeScores(83));
    await seedHorse(makeScores(91));

    const { req, res } = makeMockReqRes({ conformationScores: BASE_SCORES });

    await getConformationAnalysis(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('Conformation analysis retrieved successfully');
    expect(response.data.horseId).toBe(0);
    expect(response.data.horseName).toBe('Midnight Star');
    expect(response.data.breedId).toBe(testBreed.id);
    expect(response.data.breedName).toBe('Thoroughbred');
    expect(response.data.breedMeanAvailable).toBe(true);
    expect(response.data.totalHorsesInBreed).toBeGreaterThanOrEqual(4);

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

    const { overallConformation } = response.data;
    expect(overallConformation).toHaveProperty('score');
    expect(overallConformation).toHaveProperty('breedMean');
    expect(overallConformation).toHaveProperty('percentile');
  });

  test('horse with max scores ranks higher than horses with lower scores', async () => {
    await seedHorse(makeScores(50));
    await seedHorse(makeScores(60));
    await seedHorse(makeScores(70));
    await seedHorse(makeScores(80));

    const { req, res } = makeMockReqRes({ conformationScores: makeScores(99) });

    await getConformationAnalysis(req, res);

    const data = res.json.mock.calls[0][0].data;
    for (const region of CONFORMATION_REGIONS) {
      expect(data.analysis[region].percentile).toBeGreaterThanOrEqual(60);
    }
    expect(data.overallConformation.percentile).toBeGreaterThanOrEqual(60);
  });

  test('horse with low scores ranks lower than horses with higher scores', async () => {
    await seedHorse(makeScores(60));
    await seedHorse(makeScores(70));
    await seedHorse(makeScores(80));
    await seedHorse(makeScores(90));

    const { req, res } = makeMockReqRes({ conformationScores: makeScores(20) });

    await getConformationAnalysis(req, res);

    const data = res.json.mock.calls[0][0].data;
    for (const region of CONFORMATION_REGIONS) {
      expect(data.analysis[region].percentile).toBeLessThanOrEqual(40);
    }
    expect(data.overallConformation.percentile).toBeLessThanOrEqual(40);
  });

  test('returns 200 with null data for legacy horse without scores', async () => {
    const { req, res } = makeMockReqRes({ conformationScores: null });

    await getConformationAnalysis(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data).toBeNull();
  });

  test('filters out horses without conformation scores from percentile count', async () => {
    // Seed 1 horse with null scores and 2 with valid scores
    await seedHorse(null);
    await seedHorse(makeScores(60));
    await seedHorse(makeScores(90));

    const { req, res } = makeMockReqRes({ conformationScores: BASE_SCORES });

    await getConformationAnalysis(req, res);

    const response = res.json.mock.calls[0][0];
    // Valid horses only (null excluded) — at least the 2 we just seeded
    expect(response.data.totalHorsesInBreed).toBeGreaterThanOrEqual(2);
    expect(response.success).toBe(true);
  });

  test('returns 200 when no breedId on horse', async () => {
    const { req, res } = makeMockReqRes({ breedId: null });

    await getConformationAnalysis(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });

  test('uses breed mean from breedProfiles.json, not the database average', async () => {
    const { req, res } = makeMockReqRes({ conformationScores: BASE_SCORES });

    await getConformationAnalysis(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.data.breedMeanAvailable).toBe(true);

    const tbProfile = getBreedProfile('Thoroughbred').rating_profiles.conformation;
    for (const region of CONFORMATION_REGIONS) {
      expect(response.data.analysis[region].breedMean).toBe(tbProfile[region].mean);
    }

    const expectedOverallMean = Math.round(
      CONFORMATION_REGIONS.reduce((sum, r) => sum + tbProfile[r].mean, 0) /
        CONFORMATION_REGIONS.length,
    );
    expect(response.data.overallConformation.breedMean).toBe(expectedOverallMean);
  });
});
