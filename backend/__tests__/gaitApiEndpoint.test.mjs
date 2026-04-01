// Tests for gait API endpoint (Story 31C-3).
// Validates GET /gaits response structure, legacy horse handling,
// gaited vs non-gaited breed responses, and error cases.

import { jest } from '@jest/globals';

// Mock prisma before importing controller
const mockPrisma = {
  horse: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};
jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));

// Mock logger to suppress output in tests
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

// Import after mocking
const { getGaits } = await import('../modules/horses/controllers/horseController.mjs');

// Helper: create mock request/response
function createMockReqRes(horseOverrides = {}) {
  const horse = {
    id: 123,
    name: 'Midnight Star',
    breedId: 1,
    gaitScores: {
      walk: 72,
      trot: 78,
      canter: 75,
      gallop: 85,
      gaiting: null,
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

describe('getGaits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // === Task 3.1: Returns all 4 standard gait scores + gaiting field ===

  test('returns all 4 standard gait scores and gaiting for a horse with gait scores', async () => {
    const { req, res } = createMockReqRes();

    await getGaits(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('Gait scores retrieved successfully');

    const { gaitScores } = response.data;
    expect(gaitScores).toHaveProperty('walk');
    expect(gaitScores).toHaveProperty('trot');
    expect(gaitScores).toHaveProperty('canter');
    expect(gaitScores).toHaveProperty('gallop');
    expect(gaitScores).toHaveProperty('gaiting');
    expect(gaitScores.walk).toBe(72);
    expect(gaitScores.trot).toBe(78);
    expect(gaitScores.canter).toBe(75);
    expect(gaitScores.gallop).toBe(85);
  });

  // === Task 3.2: Returns gaiting array with { name, score } entries for gaited breed ===

  test('returns gaiting array with named entries for gaited breed', async () => {
    const { req, res } = createMockReqRes({
      breedId: 3, // American Saddlebred
      gaitScores: {
        walk: 70,
        trot: 75,
        canter: 72,
        gallop: 68,
        gaiting: [
          { name: 'Slow Gait', score: 85 },
          { name: 'Rack', score: 85 },
        ],
      },
    });

    await getGaits(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    const { gaitScores } = response.data;

    expect(Array.isArray(gaitScores.gaiting)).toBe(true);
    expect(gaitScores.gaiting).toHaveLength(2);
    expect(gaitScores.gaiting[0]).toEqual({ name: 'Slow Gait', score: 85 });
    expect(gaitScores.gaiting[1]).toEqual({ name: 'Rack', score: 85 });
  });

  // === Task 3.3: Returns gaiting: null for non-gaited breed ===

  test('returns gaiting as null for non-gaited breed', async () => {
    const { req, res } = createMockReqRes();

    await getGaits(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.data.gaitScores.gaiting).toBeNull();
  });

  // === Task 3.4: Returns 200 with null data for legacy horse without gait scores ===

  test('returns 200 with null data for legacy horse without gait scores', async () => {
    const { req, res } = createMockReqRes({ gaitScores: null });

    await getGaits(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('No gait scores available for this horse');
    expect(response.data).toBeNull();
  });

  // === Task 3.5: Returns 200 with null data for horse with undefined gait scores ===

  test('returns 200 with null data for horse with undefined gait scores', async () => {
    const { req, res } = createMockReqRes({ gaitScores: undefined });

    await getGaits(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.data).toBeNull();
  });

  // === Task 3.6: Response includes horseId, horseName, breedId metadata ===

  test('response includes horseId, horseName, breedId metadata', async () => {
    const { req, res } = createMockReqRes();

    await getGaits(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.data.horseId).toBe(123);
    expect(response.data.horseName).toBe('Midnight Star');
    expect(response.data.breedId).toBe(1);
  });

  // === Task 3.7: Error handling (500 on internal error) ===

  test('returns 500 on internal error', async () => {
    const req = {
      horse: null, // This will cause an error when accessing .gaitScores
      params: { id: '123' },
    };
    // Override to force a throw: accessing null.gaitScores
    Object.defineProperty(req, 'horse', {
      get() {
        throw new Error('Database connection failed');
      },
    });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await getGaits(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.message).toBe('Internal server error while retrieving gait scores');
  });
});
