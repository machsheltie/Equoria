// Integration tests for conformation API endpoints (Story 31B-3).
// Validates GET /conformation responses, legacy horse handling, and error
// cases. GET /conformation/analysis (percentiles) was retired by owner request
// 2026-10-29 (Equoria-oxbda); its HTTP retirement check lives in
// conformationRoutesHttp.integration.test.mjs.
//
// Real database — no mocked Prisma calls per project policy.

import { describe, beforeAll, expect, test } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';

// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): the
// previous jest.unstable_mockModule-of-logger was purely cosmetic
// noise suppression — no logger assertions besides .mockClear() in
// beforeEach. The real logger fires at LOG_LEVEL=error per setup.mjs.

import { getConformation } from '../controllers/horseController.mjs';
import { CONFORMATION_REGIONS } from '../services/conformationService.mjs';

// ── Test data setup ────────────────────────────────────────────────────────
let testBreed;

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
  testBreed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'Thoroughbred (conformation API test)' },
  });
});

// ── GET /conformation ──────────────────────────────────────────────────────
// getConformation reads req.horse directly — no DB calls in this path.

describe('getConformation', () => {
  test('returns all 8 regions and overallConformation for a horse with scores', async () => {
    const { req, res } = makeMockReqRes();

    await getConformation(req, res);

    expect(res.statusCode).toBe(200);
    const response = res.body;
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

    expect(res.statusCode).toBe(200);
    const response = res.body;
    expect(response.success).toBe(true);
    expect(response.message).toBe('No conformation scores available for this horse');
    expect(response.data).toBeNull();
  });

  test('returns 200 with null data for horse with undefined scores', async () => {
    const { req, res } = makeMockReqRes({ conformationScores: undefined });

    await getConformation(req, res);

    expect(res.statusCode).toBe(200);
    const response = res.body;
    expect(response.success).toBe(true);
    expect(response.message).toBe('No conformation scores available for this horse');
    expect(response.data).toBeNull();
  });

  test('calculates overallConformation when not stored', async () => {
    const { req, res } = makeMockReqRes({
      conformationScores: {
        head: 82,
        neck: 75,
        shoulders: 70,
        back: 68,
        hindquarters: 78,
        legs: 72,
        hooves: 71,
        topline: 74,
      },
    });

    await getConformation(req, res);

    expect(res.statusCode).toBe(200);
    const response = res.body;
    expect(response.success).toBe(true);
    expect(response.data.conformationScores).toHaveProperty('overallConformation');
    expect(typeof response.data.conformationScores.overallConformation).toBe('number');
  });
});
