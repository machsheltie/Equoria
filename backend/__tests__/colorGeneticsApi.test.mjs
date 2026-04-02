// Tests for color genetics API endpoints (Story 31E-4).
// Validates GET /horses/:id/genetics and GET /horses/:id/color responses,
// legacy horse handling, partial phenotype, JSONB type guards, and null guard behavior.

import { jest } from '@jest/globals';

// Mock prisma before importing controller
const mockPrisma = {
  horse: {
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
const { getGenetics, getColor } = await import('../modules/horses/controllers/horseController.mjs');

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_GENOTYPE = {
  E: ['E', 'e'],
  A: ['A', 'a'],
  G: ['G', 'G'],
  W: ['N', 'N'],
  Cr: ['N', 'N'],
  Ch: ['N', 'N'],
  D: ['N', 'N'],
  F: ['N', 'N'],
  Z: ['N', 'N'],
  Rn: ['N', 'N'],
  Rb: ['N', 'N'],
  Spl: ['N', 'N'],
  To: ['N', 'N'],
  Sb: ['N', 'N'],
  Lp: ['N', 'N'],
  PATN1: ['N', 'N'],
};

const MOCK_PHENOTYPE = {
  colorName: 'Bay',
  shade: 'standard',
  faceMarking: 'star',
  legMarkings: {
    frontLeft: 'sock',
    frontRight: 'none',
    hindLeft: 'none',
    hindRight: 'pastern',
  },
  advancedMarkings: {
    bloodyShoulderPresent: false,
    snowflakePresent: false,
    frostPresent: false,
  },
  modifiers: {
    isSooty: false,
    isFlaxen: false,
    hasPangare: true,
    isRabicano: false,
  },
};

// Helper: build mock req/res
function createMockReqRes(horseOverrides = {}) {
  const horse = {
    id: 42,
    name: 'Shadowfax',
    breedId: 3,
    colorGenotype: MOCK_GENOTYPE,
    phenotype: MOCK_PHENOTYPE,
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

// ---------------------------------------------------------------------------
// getGenetics
// ---------------------------------------------------------------------------

describe('getGenetics', () => {
  test('T3.1: returns full colorGenotype and phenotype for a horse with genetics data', async () => {
    const { req, res } = createMockReqRes();

    await getGenetics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('Genetics data retrieved successfully');
    expect(response.data.horseId).toBe(42);
    expect(response.data.horseName).toBe('Shadowfax');
    expect(response.data.colorGenotype).toEqual(MOCK_GENOTYPE);
    expect(response.data.phenotype).toEqual(MOCK_PHENOTYPE);
  });

  test('T3.1: response shape has exactly horseId, horseName, colorGenotype, phenotype keys', async () => {
    const { req, res } = createMockReqRes();

    await getGenetics(req, res);

    const data = res.json.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(['horseId', 'horseName', 'colorGenotype', 'phenotype']);
  });

  test('T3.2: returns 200 with null data for legacy horse without colorGenotype', async () => {
    const { req, res } = createMockReqRes({ colorGenotype: null });

    await getGenetics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('No genetics data available for this horse');
    expect(response.data).toBeNull();
  });

  test('T3.2: returns 200 with null data for undefined colorGenotype', async () => {
    const { req, res } = createMockReqRes({ colorGenotype: undefined });

    await getGenetics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });

  test('T3.2: phenotype is null when horse has genotype but no phenotype', async () => {
    const { req, res } = createMockReqRes({ phenotype: null });

    await getGenetics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data).not.toBeNull();
    expect(data.phenotype).toBeNull();
    expect(data.colorGenotype).toEqual(MOCK_GENOTYPE);
  });
});

// ---------------------------------------------------------------------------
// getColor
// ---------------------------------------------------------------------------

describe('getColor', () => {
  test('T3.3: returns all display fields for a horse with full phenotype', async () => {
    const { req, res } = createMockReqRes();

    await getColor(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('Color data retrieved successfully');

    const data = response.data;
    expect(data.horseId).toBe(42);
    expect(data.horseName).toBe('Shadowfax');
    expect(data.colorName).toBe('Bay');
    expect(data.shade).toBe('standard');
    expect(data.faceMarking).toBe('star');
    expect(data.legMarkings).toEqual(MOCK_PHENOTYPE.legMarkings);
    expect(data.advancedMarkings).toEqual(MOCK_PHENOTYPE.advancedMarkings);
    expect(data.modifiers).toEqual(MOCK_PHENOTYPE.modifiers);
  });

  test('T3.5: response does NOT include colorGenotype', async () => {
    const { req, res } = createMockReqRes();

    await getColor(req, res);

    const data = res.json.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('colorGenotype');
  });

  test('T3.5: response shape has exactly the expected display keys', async () => {
    const { req, res } = createMockReqRes();

    await getColor(req, res);

    const data = res.json.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual([
      'horseId',
      'horseName',
      'colorName',
      'shade',
      'faceMarking',
      'legMarkings',
      'advancedMarkings',
      'modifiers',
    ]);
  });

  test('T3.4: returns null for marking fields when phenotype has color but no markings', async () => {
    const { req, res } = createMockReqRes({
      phenotype: { colorName: 'Chestnut', shade: 'dark' },
    });

    await getColor(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const data = res.json.mock.calls[0][0].data;
    expect(data.colorName).toBe('Chestnut');
    expect(data.shade).toBe('dark');
    expect(data.faceMarking).toBeNull();
    expect(data.legMarkings).toBeNull();
    expect(data.advancedMarkings).toBeNull();
    expect(data.modifiers).toBeNull();
  });

  test('returns 200 with null data for legacy horse without phenotype', async () => {
    const { req, res } = createMockReqRes({ phenotype: null });

    await getColor(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.message).toBe('No color data available for this horse');
    expect(response.data).toBeNull();
  });

  test('returns 200 with null data for undefined phenotype', async () => {
    const { req, res } = createMockReqRes({ phenotype: undefined });

    await getColor(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// D-3: explicit req.horse null guard
// ---------------------------------------------------------------------------

describe('D-3: req.horse null guard', () => {
  test('T3.6: getGenetics returns 500 when req.horse is not set (middleware contract violation)', async () => {
    const req = { horse: undefined, params: { id: '99' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await getGenetics(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  test('T3.8: getColor returns 500 when req.horse is not set (middleware contract violation)', async () => {
    const req = { horse: undefined, params: { id: '99' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await getColor(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D-2: JSONB non-object value guard (array / scalar stored in DB column)
// ---------------------------------------------------------------------------

describe('D-2: JSONB non-object value guard', () => {
  test('getGenetics: colorGenotype stored as JSON array → data: null', async () => {
    const { req, res } = createMockReqRes({ colorGenotype: ['E', 'e'] });
    await getGenetics(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });

  test('getGenetics: colorGenotype stored as string → data: null', async () => {
    const { req, res } = createMockReqRes({ colorGenotype: 'Bay' });
    await getGenetics(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });

  test('getColor: phenotype stored as JSON array → data: null', async () => {
    const { req, res } = createMockReqRes({ phenotype: ['colorName', 'Bay'] });
    await getColor(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });

  test('getColor: phenotype stored as string → data: null', async () => {
    const { req, res } = createMockReqRes({ phenotype: 'Bay' });
    await getColor(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Legacy null paths
// ---------------------------------------------------------------------------

describe('Legacy null paths', () => {
  test('T3.7: getGenetics returns 200 null for horse with no colorGenotype', async () => {
    const { req, res } = createMockReqRes({ colorGenotype: null });
    await getGenetics(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });

  test('T3.9: getColor returns 200 null for horse with no phenotype', async () => {
    const { req, res } = createMockReqRes({ phenotype: null });
    await getColor(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });
});
