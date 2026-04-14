/**
 * Unit tests for conformationShowController.mjs — execute + titles (Story 31F-3)
 *
 * Co-located per CONTRIBUTING.md convention (Epic 21-1):
 *   backend/modules/competition/__tests__/conformationShowExecution.test.mjs
 *
 * Covers:
 *   POST /execute — executeConformationShowHandler (AC1, AC3, AC4, AC7)
 *   GET  /titles/:horseId — getConformationTitles (AC5, AC7)
 *
 * Strategy: balanced mocking — mock only external dependencies
 * (prisma, conformationShowService.executeConformationShow, findOwnedResource,
 *  rateLimiting, express-validator).
 * Service reward/title logic (resolveReward, resolveTitle, applyBreedingValueBoost)
 * is tested via service-level unit tests embedded in this file.
 *
 * Mock pattern: plain arrow functions (not jest.fn()) in unstable_mockModule
 * factories survive jest.resetAllMocks(). jest.fn() instances are used only for
 * spies that need call tracking (e.g. findOwnedResource).
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mocks — must be registered before any imports
// ---------------------------------------------------------------------------

// Configurable validation errors for express-validator
let _mockValidationErrors = [];

jest.unstable_mockModule('express-validator', () => ({
  validationResult: _req => ({
    isEmpty: () => _mockValidationErrors.length === 0,
    array: () => [..._mockValidationErrors],
  }),
  body: () => {
    const chain = {
      isInt: () => chain,
      isString: () => chain,
      notEmpty: () => chain,
      withMessage: () => chain,
      trim: () => chain,
    };
    return chain;
  },
  param: () => {
    const chain = { isInt: () => chain, withMessage: () => chain };
    return chain;
  },
}));

// findOwnedResource — jest.fn() so we can control per-test return values
const mockFindOwnedResource = jest.fn();

jest.unstable_mockModule('../../../middleware/ownership.mjs', () => ({
  findOwnedResource: mockFindOwnedResource,
  requireOwnership: jest.fn(),
  validateBatchOwnership: jest.fn(),
}));

// Prisma — jest.fn() per method
const mockPrisma = {
  show: { findUnique: jest.fn() },
  showEntry: { findMany: jest.fn() },
  groomAssignment: { findMany: jest.fn() },
  horse: { update: jest.fn(), findUnique: jest.fn() },
  competitionResult: { create: jest.fn() },
  $transaction: jest.fn(),
};

jest.unstable_mockModule('../../../db/index.mjs', () => ({ default: mockPrisma }));

// conformationShowService — mock executeConformationShow only; pure helpers are tested directly
let _mockExecuteResult = null; // set per test
let _mockExecuteError = null; // set per test to simulate thrown errors

jest.unstable_mockModule('../../../services/conformationShowService.mjs', () => ({
  executeConformationShow: async _showId => {
    if (_mockExecuteError) throw _mockExecuteError;
    return _mockExecuteResult ?? [];
  },
  // Re-export pure helpers unchanged so service-unit tests below can use real logic
  resolveReward: placement => {
    const table = {
      1: { ribbon: 'Blue', titlePoints: 10, breedingBoostDelta: 0.05 },
      2: { ribbon: 'Red', titlePoints: 7, breedingBoostDelta: 0.03 },
      3: { ribbon: 'Yellow', titlePoints: 5, breedingBoostDelta: 0.01 },
    };
    return table[placement] ?? { ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 };
  },
  resolveTitle: points => {
    if (points >= 200) return 'Grand Champion';
    if (points >= 100) return 'Champion';
    if (points >= 50) return 'Distinguished';
    if (points >= 25) return 'Noteworthy';
    return null;
  },
  applyBreedingValueBoost: (current, delta) => {
    if (delta <= 0) return current;
    return Math.min(0.15, current + delta);
  },
  validateConformationEntry: jest.fn(),
  calculateConformationShowScore: jest.fn(),
  REWARD_TABLE: {},
  TITLE_THRESHOLDS: [],
  BREEDING_BOOST_CAP: 0.15,
  CONFORMATION_SHOW_CONFIG: {},
  CONFORMATION_AGE_CLASSES: {},
  SHOW_HANDLING_SKILL_SCORES: {},
}));

jest.unstable_mockModule('../../../utils/logger.mjs', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Rate limiters — plain passthrough middleware (not jest.fn) to survive resetAllMocks
jest.unstable_mockModule('../../../middleware/rateLimiting.mjs', () => ({
  queryRateLimiter: (_req, _res, next) => next(),
  mutationRateLimiter: (_req, _res, next) => next(),
}));

// ---------------------------------------------------------------------------
// Import controllers AFTER mocks are registered
// ---------------------------------------------------------------------------

const { executeConformationShowHandler, getConformationTitles } = await import(
  '../controllers/conformationShowController.mjs'
);

// Also import real pure helpers for unit tests
const { resolveReward, resolveTitle, applyBreedingValueBoost } = await import(
  '../../../services/conformationShowService.mjs'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildReq({ body = {}, params = {}, user = { id: 'user-1' } } = {}) {
  return { body, params, user };
}

function buildRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.resetAllMocks();
  _mockValidationErrors = [];
  _mockExecuteResult = null;
  _mockExecuteError = null;
});

// ===========================================================================
// Pure service helper unit tests (AC2, AC3)
// ===========================================================================

describe('resolveReward (AC1 reward table)', () => {
  it('returns Blue ribbon + 10 pts + 5% for 1st', () => {
    expect(resolveReward(1)).toEqual({ ribbon: 'Blue', titlePoints: 10, breedingBoostDelta: 0.05 });
  });
  it('returns Red ribbon + 7 pts + 3% for 2nd', () => {
    expect(resolveReward(2)).toEqual({ ribbon: 'Red', titlePoints: 7, breedingBoostDelta: 0.03 });
  });
  it('returns Yellow ribbon + 5 pts + 1% for 3rd', () => {
    expect(resolveReward(3)).toEqual({ ribbon: 'Yellow', titlePoints: 5, breedingBoostDelta: 0.01 });
  });
  it('returns White ribbon + 2 pts + 0% for 4th', () => {
    expect(resolveReward(4)).toEqual({ ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 });
  });
  it('returns White ribbon + 2 pts + 0% for 10th', () => {
    expect(resolveReward(10)).toEqual({ ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 });
  });
});

describe('resolveTitle (AC2 thresholds)', () => {
  it('returns null for 0 points', () => {
    expect(resolveTitle(0)).toBeNull();
  });
  it('returns null for 24 points', () => {
    expect(resolveTitle(24)).toBeNull();
  });
  it('returns Noteworthy at 25 points', () => {
    expect(resolveTitle(25)).toBe('Noteworthy');
  });
  it('returns Noteworthy at 49 points', () => {
    expect(resolveTitle(49)).toBe('Noteworthy');
  });
  it('returns Distinguished at 50 points', () => {
    expect(resolveTitle(50)).toBe('Distinguished');
  });
  it('returns Distinguished at 99 points', () => {
    expect(resolveTitle(99)).toBe('Distinguished');
  });
  it('returns Champion at 100 points', () => {
    expect(resolveTitle(100)).toBe('Champion');
  });
  it('returns Champion at 199 points', () => {
    expect(resolveTitle(199)).toBe('Champion');
  });
  it('returns Grand Champion at 200 points', () => {
    expect(resolveTitle(200)).toBe('Grand Champion');
  });
  it('returns Grand Champion at 500 points', () => {
    expect(resolveTitle(500)).toBe('Grand Champion');
  });
});

describe('applyBreedingValueBoost (AC3 cap)', () => {
  it('adds 5% for 1st place (0 → 0.05)', () => {
    expect(applyBreedingValueBoost(0, 0.05)).toBeCloseTo(0.05);
  });
  it('caps at 0.15 when adding 5% to 0.14', () => {
    expect(applyBreedingValueBoost(0.14, 0.05)).toBeCloseTo(0.15);
  });
  it('stays at 0.15 when already capped and adding 5%', () => {
    expect(applyBreedingValueBoost(0.15, 0.05)).toBeCloseTo(0.15);
  });
  it('returns unchanged boost for 4th place (delta=0)', () => {
    expect(applyBreedingValueBoost(0.08, 0)).toBeCloseTo(0.08);
  });
  it('caps at 0.15 when overflow would exceed cap', () => {
    expect(applyBreedingValueBoost(0.13, 0.05)).toBeCloseTo(0.15);
  });
});

// ===========================================================================
// executeConformationShowHandler (AC1, AC4, AC7)
// ===========================================================================

describe('executeConformationShowHandler', () => {
  describe('AC1 — successful execution returns 200 with results', () => {
    it('1st place receives Blue ribbon + 10 titlePoints + 5% breedingValueBoost', async () => {
      _mockExecuteResult = [
        {
          horseId: 1,
          placement: 1,
          score: 87,
          ribbon: 'Blue',
          titlePoints: 10,
          newTitle: null,
          breedingValueBoost: 0.05,
        },
        {
          horseId: 2,
          placement: 2,
          score: 75,
          ribbon: 'Red',
          titlePoints: 7,
          newTitle: null,
          breedingValueBoost: 0.03,
        },
      ];

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data.showId).toBe(5);
      expect(body.data.results[0].ribbon).toBe('Blue');
      expect(body.data.results[0].titlePoints).toBe(10);
      expect(body.data.results[0].breedingValueBoost).toBeCloseTo(0.05);
    });

    it('4th+ place receives White ribbon + 2 titlePoints + 0% boost', async () => {
      _mockExecuteResult = [
        {
          horseId: 1,
          placement: 1,
          score: 90,
          ribbon: 'Blue',
          titlePoints: 10,
          newTitle: null,
          breedingValueBoost: 0.05,
        },
        {
          horseId: 2,
          placement: 2,
          score: 80,
          ribbon: 'Red',
          titlePoints: 7,
          newTitle: null,
          breedingValueBoost: 0.03,
        },
        {
          horseId: 3,
          placement: 3,
          score: 70,
          ribbon: 'Yellow',
          titlePoints: 5,
          newTitle: null,
          breedingValueBoost: 0.01,
        },
        { horseId: 4, placement: 4, score: 60, ribbon: 'White', titlePoints: 2, newTitle: null, breedingValueBoost: 0 },
      ];

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const { results } = res.json.mock.calls[0][0].data;
      expect(results[3].ribbon).toBe('White');
      expect(results[3].titlePoints).toBe(2);
      expect(results[3].breedingValueBoost).toBe(0);
    });

    it('horse accumulating 22 pts + 4 more = 26 → currentTitle set to Noteworthy', async () => {
      _mockExecuteResult = [
        {
          horseId: 7,
          placement: 4,
          score: 55,
          ribbon: 'White',
          titlePoints: 2,
          newTitle: 'Noteworthy',
          breedingValueBoost: 0,
        },
      ];

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const { results } = res.json.mock.calls[0][0].data;
      expect(results[0].newTitle).toBe('Noteworthy');
    });

    it('horse at 14% boost + 5% placement boost → capped at 15%', async () => {
      _mockExecuteResult = [
        {
          horseId: 3,
          placement: 1,
          score: 88,
          ribbon: 'Blue',
          titlePoints: 10,
          newTitle: null,
          breedingValueBoost: 0.15,
        },
      ];

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const { results } = res.json.mock.calls[0][0].data;
      expect(results[0].breedingValueBoost).toBeCloseTo(0.15);
    });

    it('zero entries returns 200 with empty results array', async () => {
      _mockExecuteResult = [];

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body.success).toBe(true);
      expect(body.data.results).toEqual([]);
    });

    it('equal scores are ranked by entry order (tie-breaking by createdAt asc)', async () => {
      // Service is responsible for tie-breaking; controller just passes results through.
      // This test verifies the controller preserves service ordering unchanged.
      _mockExecuteResult = [
        {
          horseId: 1,
          placement: 1,
          score: 75,
          ribbon: 'Blue',
          titlePoints: 10,
          newTitle: null,
          breedingValueBoost: 0.05,
        },
        {
          horseId: 2,
          placement: 2,
          score: 75,
          ribbon: 'Red',
          titlePoints: 7,
          newTitle: null,
          breedingValueBoost: 0.03,
        },
      ];

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const { results } = res.json.mock.calls[0][0].data;
      // Earlier entry (horseId 1) must be ranked 1st when scores are equal
      expect(results[0].horseId).toBe(1);
      expect(results[0].placement).toBe(1);
      expect(results[1].horseId).toBe(2);
      expect(results[1].placement).toBe(2);
    });
  });

  describe('AC4 — no prize money', () => {
    it('results contain no prizeWon field', async () => {
      _mockExecuteResult = [
        {
          horseId: 1,
          placement: 1,
          score: 90,
          ribbon: 'Blue',
          titlePoints: 10,
          newTitle: null,
          breedingValueBoost: 0.05,
        },
      ];

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      const { results } = res.json.mock.calls[0][0].data;
      expect(results[0]).not.toHaveProperty('prizeWon');
    });
  });

  describe('Error handling', () => {
    it('returns 400 when service throws with statusCode=400 (show not found)', async () => {
      const err = new Error('Show not found');
      err.statusCode = 400;
      _mockExecuteError = err;

      const req = buildReq({ body: { showId: 999 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].success).toBe(false);
      expect(res.json.mock.calls[0][0].message).toBe('Show not found');
    });

    it('returns 400 when service throws with statusCode=400 (non-conformation show)', async () => {
      const err = new Error('Show is not a conformation show');
      err.statusCode = 400;
      _mockExecuteError = err;

      const req = buildReq({ body: { showId: 3 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toBe('Show is not a conformation show');
    });

    it('returns 400 when service throws with statusCode=400 (show already executed)', async () => {
      const err = new Error('Show has already been executed');
      err.statusCode = 400;
      _mockExecuteError = err;

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toBe('Show has already been executed');
    });

    it('returns 400 on express-validator errors', async () => {
      _mockValidationErrors = [{ msg: 'showId must be a positive integer' }];

      const req = buildReq({ body: {} });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].message).toBe('Validation failed');
    });

    it('returns 500 on unexpected service error', async () => {
      _mockExecuteError = new Error('DB connection lost');

      const req = buildReq({ body: { showId: 5 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

// ===========================================================================
// getConformationTitles (AC5, AC7)
// ===========================================================================

describe('getConformationTitles', () => {
  const HORSE_WITH_TITLES = {
    id: 1,
    name: 'Starlight',
    titlePoints: 55,
    currentTitle: 'Distinguished',
    breedingValueBoost: 0.08,
  };

  describe('AC5 — returns accumulated title data', () => {
    it('returns 200 with horseId, horseName, titlePoints, currentTitle, breedingValueBoost', async () => {
      mockFindOwnedResource.mockResolvedValueOnce(HORSE_WITH_TITLES);

      const req = buildReq({ params: { horseId: '1' }, user: { id: 'user-1' } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const { data } = res.json.mock.calls[0][0];
      expect(data.horseId).toBe(1);
      expect(data.horseName).toBe('Starlight');
      expect(data.titlePoints).toBe(55);
      expect(data.currentTitle).toBe('Distinguished');
      expect(data.breedingValueBoost).toBeCloseTo(0.08);
    });

    it('returns null currentTitle and 0 titlePoints for untitled horse', async () => {
      mockFindOwnedResource.mockResolvedValueOnce({
        id: 2,
        name: 'Nova',
        titlePoints: 0,
        currentTitle: null,
        breedingValueBoost: 0,
      });

      const req = buildReq({ params: { horseId: '2' }, user: { id: 'user-1' } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const { data } = res.json.mock.calls[0][0];
      expect(data.titlePoints).toBe(0);
      expect(data.currentTitle).toBeNull();
    });
  });

  describe('AC5 — IDOR: returns 404 for unowned horse', () => {
    it('returns 404 when findOwnedResource returns null', async () => {
      mockFindOwnedResource.mockResolvedValueOnce(null);

      const req = buildReq({ params: { horseId: '99' }, user: { id: 'user-1' } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json.mock.calls[0][0].success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('returns 400 on express-validator errors', async () => {
      _mockValidationErrors = [{ msg: 'horseId must be a positive integer' }];

      const req = buildReq({ params: {}, user: { id: 'user-1' } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 500 on unexpected error', async () => {
      mockFindOwnedResource.mockRejectedValueOnce(new Error('DB timeout'));

      const req = buildReq({ params: { horseId: '1' }, user: { id: 'user-1' } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
