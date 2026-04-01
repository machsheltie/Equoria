// Tests for conformation API endpoints (Story 31B-3).
// Validates GET /conformation and GET /conformation/analysis responses,
// legacy horse handling, percentile calculations, and error cases.

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
const { getConformation, getConformationAnalysis } = await import('../modules/horses/controllers/horseController.mjs');
const { CONFORMATION_REGIONS } = await import('../modules/horses/services/conformationService.mjs');

// Helper: create mock request/response
function createMockReqRes(horseOverrides = {}) {
  const horse = {
    id: 123,
    name: 'Midnight Star',
    breedId: 1,
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
    expect(response.data.breedId).toBe(1);

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

describe('getConformationAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns percentile analysis per region for a horse with scores', async () => {
    const { req, res } = createMockReqRes();

    // Mock: 5 same-breed horses with varying scores
    mockPrisma.horse.findMany.mockResolvedValue([
      {
        conformationScores: {
          head: 60,
          neck: 60,
          shoulders: 60,
          back: 60,
          hindquarters: 60,
          legs: 60,
          hooves: 60,
          topline: 60,
          overallConformation: 60,
        },
      },
      {
        conformationScores: {
          head: 70,
          neck: 70,
          shoulders: 70,
          back: 70,
          hindquarters: 70,
          legs: 70,
          hooves: 70,
          topline: 70,
          overallConformation: 70,
        },
      },
      {
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
      }, // Our horse
      {
        conformationScores: {
          head: 90,
          neck: 85,
          shoulders: 80,
          back: 80,
          hindquarters: 85,
          legs: 80,
          hooves: 80,
          topline: 80,
          overallConformation: 83,
        },
      },
      {
        conformationScores: {
          head: 95,
          neck: 90,
          shoulders: 90,
          back: 90,
          hindquarters: 90,
          legs: 90,
          hooves: 90,
          topline: 90,
          overallConformation: 91,
        },
      },
    ]);

    await getConformationAnalysis(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('Conformation analysis retrieved successfully');
    expect(response.data.horseId).toBe(123);
    expect(response.data.horseName).toBe('Midnight Star');
    expect(response.data.breedId).toBe(1);
    expect(response.data.breedName).toBe('Thoroughbred');
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
    const { req, res } = createMockReqRes({
      conformationScores: {
        head: 99,
        neck: 99,
        shoulders: 99,
        back: 99,
        hindquarters: 99,
        legs: 99,
        hooves: 99,
        topline: 99,
        overallConformation: 99,
      },
    });

    // 5 horses with lower scores
    mockPrisma.horse.findMany.mockResolvedValue([
      {
        conformationScores: {
          head: 50,
          neck: 50,
          shoulders: 50,
          back: 50,
          hindquarters: 50,
          legs: 50,
          hooves: 50,
          topline: 50,
          overallConformation: 50,
        },
      },
      {
        conformationScores: {
          head: 60,
          neck: 60,
          shoulders: 60,
          back: 60,
          hindquarters: 60,
          legs: 60,
          hooves: 60,
          topline: 60,
          overallConformation: 60,
        },
      },
      {
        conformationScores: {
          head: 70,
          neck: 70,
          shoulders: 70,
          back: 70,
          hindquarters: 70,
          legs: 70,
          hooves: 70,
          topline: 70,
          overallConformation: 70,
        },
      },
      {
        conformationScores: {
          head: 80,
          neck: 80,
          shoulders: 80,
          back: 80,
          hindquarters: 80,
          legs: 80,
          hooves: 80,
          topline: 80,
          overallConformation: 80,
        },
      },
      {
        conformationScores: {
          head: 99,
          neck: 99,
          shoulders: 99,
          back: 99,
          hindquarters: 99,
          legs: 99,
          hooves: 99,
          topline: 99,
          overallConformation: 99,
        },
      }, // Our horse
    ]);

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
    const { req, res } = createMockReqRes();

    // Only 1 horse of this breed (the horse itself)
    mockPrisma.horse.findMany.mockResolvedValue([
      {
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
      },
    ]);

    await getConformationAnalysis(req, res);

    const response = res.json.mock.calls[0][0];
    const { analysis, overallConformation } = response.data;

    for (const region of CONFORMATION_REGIONS) {
      expect(analysis[region].percentile).toBe(50);
    }
    expect(overallConformation.percentile).toBe(50);
  });

  test('filters out horses without conformation scores from percentile calculation', async () => {
    const { req, res } = createMockReqRes();

    mockPrisma.horse.findMany.mockResolvedValue([
      { conformationScores: null }, // Legacy horse — should be excluded
      {
        conformationScores: {
          head: 60,
          neck: 60,
          shoulders: 60,
          back: 60,
          hindquarters: 60,
          legs: 60,
          hooves: 60,
          topline: 60,
          overallConformation: 60,
        },
      },
      {
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
      }, // Our horse
      {
        conformationScores: {
          head: 90,
          neck: 90,
          shoulders: 90,
          back: 90,
          hindquarters: 90,
          legs: 90,
          hooves: 90,
          topline: 90,
          overallConformation: 90,
        },
      },
    ]);

    await getConformationAnalysis(req, res);

    const response = res.json.mock.calls[0][0];
    // totalHorsesInBreed should exclude the null horse
    expect(response.data.totalHorsesInBreed).toBe(3);
  });

  test('uses breed mean from BREED_GENETIC_PROFILES, not database average', async () => {
    const { req, res } = createMockReqRes();

    mockPrisma.horse.findMany.mockResolvedValue([
      {
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
      },
    ]);

    await getConformationAnalysis(req, res);

    const response = res.json.mock.calls[0][0];
    // Breed 1 = Thoroughbred — breedMean should come from BREED_GENETIC_PROFILES[1]
    // Not from the database average of same-breed horses
    const { BREED_GENETIC_PROFILES } = await import('../modules/horses/data/breedGeneticProfiles.mjs');
    const tbProfile = BREED_GENETIC_PROFILES[1].rating_profiles.conformation;

    for (const region of CONFORMATION_REGIONS) {
      expect(response.data.analysis[region].breedMean).toBe(tbProfile[region].mean);
    }
  });
});
