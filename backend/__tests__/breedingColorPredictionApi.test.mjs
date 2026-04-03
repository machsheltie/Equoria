// Tests for breeding color prediction API endpoint (Story 31E-5, T4.7).
// Mock req/res pattern — validates controller logic for ownership, legacy handling, and response format.

import { jest } from '@jest/globals';

// Mock prisma
const mockPrisma = {
  horse: {
    findUnique: jest.fn(),
  },
  breed: {
    findUnique: jest.fn(),
  },
};
jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

// Import controller after mocking
const { getBreedingColorPrediction } = await import('../modules/horses/controllers/horseController.mjs');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_GENOTYPE = {
  E_Extension: 'E/e',
  A_Agouti: 'A/a',
  Cr_Cream: 'n/n',
  D_Dun: 'nd2/nd2',
  Z_Silver: 'n/n',
  Ch_Champagne: 'n/n',
  G_Gray: 'g/g',
  Rn_Roan: 'rn/rn',
  W_DominantWhite: 'w/w',
  TO_Tobiano: 'to/to',
  O_FrameOvero: 'n/n',
  SB1_Sabino1: 'n/n',
  SW_SplashWhite: 'n/n',
  LP_LeopardComplex: 'lp/lp',
  PATN1_Pattern1: 'patn1/patn1',
  EDXW: 'n/n',
  MFSD12_Mushroom: 'N/N',
};

function createMockReqRes(bodyOverrides = {}) {
  const req = {
    body: { sireId: 1, damId: 2, ...bodyOverrides },
    user: { id: 'user-123' },
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Controller tests
// ---------------------------------------------------------------------------

describe('getBreedingColorPrediction controller', () => {
  test('returns 200 with prediction data for valid owned horses with genotypes', async () => {
    mockPrisma.horse.findUnique.mockImplementation(({ where }) => {
      if (where.id === 1) {
        return { id: 1, name: 'Sire', colorGenotype: MOCK_GENOTYPE, userId: 'user-123', breedId: 1 };
      }
      if (where.id === 2) {
        return { id: 2, name: 'Dam', colorGenotype: MOCK_GENOTYPE, userId: 'user-123', breedId: 1 };
      }
      return null;
    });
    mockPrisma.breed.findUnique.mockResolvedValue({ breedGeneticProfile: null });

    const { req, res } = createMockReqRes();
    await getBreedingColorPrediction(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('sireId', 1);
    expect(response.data).toHaveProperty('damId', 2);
    expect(response.data).toHaveProperty('possibleColors');
    expect(response.data).toHaveProperty('totalCombinations');
    expect(response.data).toHaveProperty('lethalCombinationsFiltered');
    expect(Array.isArray(response.data.possibleColors)).toBe(true);
    expect(response.data.possibleColors.length).toBeGreaterThan(0);
  });

  test('AC5: returns 404 when sire not found', async () => {
    mockPrisma.horse.findUnique.mockImplementation(({ where }) => {
      if (where.id === 1) return null; // sire not found
      return { id: 2, name: 'Dam', colorGenotype: MOCK_GENOTYPE, userId: 'user-123', breedId: 1 };
    });

    const { req, res } = createMockReqRes();
    await getBreedingColorPrediction(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  test('AC5: returns 404 when sire belongs to another user', async () => {
    mockPrisma.horse.findUnique.mockImplementation(({ where }) => {
      if (where.id === 1) {
        return { id: 1, name: 'Sire', colorGenotype: MOCK_GENOTYPE, userId: 'other-user', breedId: 1 };
      }
      return { id: 2, name: 'Dam', colorGenotype: MOCK_GENOTYPE, userId: 'user-123', breedId: 1 };
    });

    const { req, res } = createMockReqRes();
    await getBreedingColorPrediction(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('AC5: returns 404 when dam not owned by user', async () => {
    mockPrisma.horse.findUnique.mockImplementation(({ where }) => {
      if (where.id === 1) {
        return { id: 1, name: 'Sire', colorGenotype: MOCK_GENOTYPE, userId: 'user-123', breedId: 1 };
      }
      return { id: 2, name: 'Dam', colorGenotype: MOCK_GENOTYPE, userId: 'other-user', breedId: 1 };
    });

    const { req, res } = createMockReqRes();
    await getBreedingColorPrediction(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('AC6: returns 200 null when sire has no genotype (legacy horse)', async () => {
    mockPrisma.horse.findUnique.mockImplementation(({ where }) => {
      if (where.id === 1) {
        return { id: 1, name: 'Sire', colorGenotype: null, userId: 'user-123', breedId: 1 };
      }
      return { id: 2, name: 'Dam', colorGenotype: MOCK_GENOTYPE, userId: 'user-123', breedId: 1 };
    });

    const { req, res } = createMockReqRes();
    await getBreedingColorPrediction(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const response = res.json.mock.calls[0][0];
    expect(response.success).toBe(true);
    expect(response.data).toBeNull();
    expect(response.message).toBe('Color prediction requires both parents to have genetics data');
  });

  test('AC6: returns 200 null when dam genotype is an array (JSONB guard)', async () => {
    mockPrisma.horse.findUnique.mockImplementation(({ where }) => {
      if (where.id === 1) {
        return { id: 1, name: 'Sire', colorGenotype: MOCK_GENOTYPE, userId: 'user-123', breedId: 1 };
      }
      return { id: 2, name: 'Dam', colorGenotype: ['E', 'e'], userId: 'user-123', breedId: 1 };
    });

    const { req, res } = createMockReqRes();
    await getBreedingColorPrediction(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data).toBeNull();
  });
});
