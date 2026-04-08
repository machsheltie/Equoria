/**
 * riderMarketplaceController.test.mjs
 *
 * Unit tests for backend/modules/riders/controllers/riderMarketplaceController.mjs
 * Co-located per the backend/modules/<domain>/__tests__/ convention (Story 21-1).
 *
 * Coverage: getRiderMarketplace, refreshRiderMarketplace, hireRiderFromMarketplace
 * Mocks: prismaClient.mjs and logger.mjs ONLY (per spec balanced-mocking policy).
 * The riderMarketplace service is NOT mocked — it is a pure internal domain module.
 *
 * Map isolation: each test uses a unique userId (Date.now() + Math.random()) so the
 * module-level `userRiderMarketplaces` Map never leaks state across test cases.
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  rider: {
    create: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../../../../packages/database/prismaClient.mjs', () => ({
  default: mockPrisma,
}));
jest.unstable_mockModule('../../../utils/logger.mjs', () => ({
  default: mockLogger,
}));

const { getRiderMarketplace, refreshRiderMarketplace, hireRiderFromMarketplace } = await import(
  '../controllers/riderMarketplaceController.mjs'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: `user-${Date.now()}-${Math.random()}` }, // unique per test to avoid shared Map state
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return { req, res };
}

/**
 * Prime the module-level Map for userId by browsing the marketplace.
 * Returns the list of riders that were generated so callers can use real marketplaceIds.
 */
async function primeMarketplace(userId) {
  const { req, res } = mockReqRes({ user: { id: userId } });
  await getRiderMarketplace(req, res);
  return res.json.mock.calls[0][0].data.riders;
}

// ── getRiderMarketplace ───────────────────────────────────────────────────────

describe('getRiderMarketplace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates and returns marketplace for a new user', async () => {
    const { req, res } = mockReqRes();
    await getRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { success, data } = res.json.mock.calls[0][0];
    expect(success).toBe(true);
    expect(Array.isArray(data.riders)).toBe(true);
    expect(data.riders.length).toBeGreaterThan(0);
    // After generating, lastRefresh is now — response includes refresh metadata
    expect(typeof data.refreshCost).toBe('number');
    expect(typeof data.canRefreshFree).toBe('boolean');
    // Each rider has the expected shape
    const rider = data.riders[0];
    expect(rider).toMatchObject({
      marketplaceId: expect.stringMatching(/^mkt_rider_/),
      firstName: expect.any(String),
      lastName: expect.any(String),
      skillLevel: expect.stringMatching(/^(rookie|developing|experienced)$/),
      personality: expect.any(String),
      weeklyRate: expect.any(Number),
    });
  });

  it('returns 500 on unexpected error', async () => {
    // Trigger a TypeError by omitting req.user so req.user.id throws
    const { req, res } = mockReqRes({ user: undefined });
    await getRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── refreshRiderMarketplace ───────────────────────────────────────────────────

describe('refreshRiderMarketplace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('refreshes free when no prior marketplace exists (cost is 0)', async () => {
    // Fresh userId — no Map entry — getRiderRefreshCost(undefined) returns 0
    const { req, res } = mockReqRes({ body: {} });
    await refreshRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(Array.isArray(data.riders)).toBe(true);
    expect(data.riders.length).toBeGreaterThan(0);
    expect(data.refreshCost).toBe(0);
  });

  it('returns 400 when paid refresh attempted without force=true', async () => {
    // Prime the Map so lastRefresh = now → cost = PREMIUM_REFRESH_COST (50)
    const userId = `paid-noforce-${Date.now()}-${Math.random()}`;
    await primeMarketplace(userId);
    jest.clearAllMocks();

    const { req, res } = mockReqRes({ user: { id: userId }, body: { force: false } });
    await refreshRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('force=true') }),
    );
  });

  it('deducts cost and refreshes when force=true and user has enough money', async () => {
    const userId = `paid-force-${Date.now()}-${Math.random()}`;
    await primeMarketplace(userId);
    jest.clearAllMocks();

    mockPrisma.user.findUnique.mockResolvedValue({ money: 500 });
    mockPrisma.user.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ user: { id: userId }, body: { force: true } });
    await refreshRiderMarketplace(req, res);

    // PREMIUM_REFRESH_COST = 50
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { money: { decrement: 50 } } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 when user has insufficient funds for paid refresh', async () => {
    const userId = `broke-refresh-${Date.now()}-${Math.random()}`;
    await primeMarketplace(userId);
    jest.clearAllMocks();

    mockPrisma.user.findUnique.mockResolvedValue({ money: 10 }); // less than 50

    const { req, res } = mockReqRes({ user: { id: userId }, body: { force: true } });
    await refreshRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Insufficient') }),
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});

// ── hireRiderFromMarketplace ──────────────────────────────────────────────────

describe('hireRiderFromMarketplace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 400 when marketplaceId is missing from body', async () => {
    const { req, res } = mockReqRes({ body: {} });
    await hireRiderFromMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('marketplaceId') }),
    );
  });

  it('returns 404 when no marketplace has been generated for user', async () => {
    // Fresh userId — no Map entry
    const { req, res } = mockReqRes({
      user: { id: `fresh-hire-${Date.now()}-${Math.random()}` },
      body: { marketplaceId: 'mkt_rider_nonexistent' },
    });
    await hireRiderFromMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('marketplace') }),
    );
  });

  it('hires rider, deducts weeklyRate, returns 201 with rider data', async () => {
    const userId = `hire-ok-${Date.now()}-${Math.random()}`;
    const riders = await primeMarketplace(userId);
    jest.clearAllMocks();

    const rider = riders[0];
    const createdRider = {
      id: 42,
      userId,
      firstName: rider.firstName,
      lastName: rider.lastName,
      personality: rider.personality,
      skillLevel: rider.skillLevel,
      speciality: rider.speciality,
      weeklyRate: rider.weeklyRate,
      experience: rider.experience,
      bio: rider.bio,
    };

    mockPrisma.user.findUnique.mockResolvedValue({ money: 9999 });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.rider.create.mockResolvedValue(createdRider);

    const { req, res } = mockReqRes({
      user: { id: userId },
      body: { marketplaceId: rider.marketplaceId },
    });
    await hireRiderFromMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          rider: expect.objectContaining({ id: 42 }),
          cost: rider.weeklyRate,
        }),
      }),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { money: { decrement: rider.weeklyRate } } }),
    );
  });

  it('returns 400 when user has insufficient funds to hire', async () => {
    const userId = `hire-broke-${Date.now()}-${Math.random()}`;
    const riders = await primeMarketplace(userId);
    jest.clearAllMocks();

    const rider = riders[0];
    mockPrisma.user.findUnique.mockResolvedValue({ money: 0 }); // guaranteed insufficient

    const { req, res } = mockReqRes({
      user: { id: userId },
      body: { marketplaceId: rider.marketplaceId },
    });
    await hireRiderFromMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('Insufficient') }),
    );
    expect(mockPrisma.rider.create).not.toHaveBeenCalled();
  });
});
