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
 * State isolation: each test uses a unique userId and controls mockPrisma.staffMarketplaceState
 * directly, simulating the DB-backed state per test.
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { generateRiderMarketplace } from '../../../services/riderMarketplace.mjs';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  rider: {
    create: jest.fn(),
  },
  staffMarketplaceState: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
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
    user: { id: `user-${Date.now()}-${Math.random()}` },
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

/** Build a realistic DB state row with fresh offers. */
function makeDbState(overrides = {}) {
  const offers = generateRiderMarketplace();
  return {
    userId: 'some-user',
    staffType: 'rider',
    offers,
    lastRefresh: new Date(),
    refreshCount: 1,
    ...overrides,
  };
}

// ── getRiderMarketplace ───────────────────────────────────────────────────────

describe('getRiderMarketplace', () => {
  beforeEach(() => jest.clearAllMocks());

  it('generates and returns marketplace for a new user', async () => {
    // No existing DB record — controller generates and upserts
    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(null);
    const state = makeDbState();
    mockPrisma.staffMarketplaceState.upsert.mockResolvedValue(state);

    const { req, res } = mockReqRes();
    await getRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { success, data } = res.json.mock.calls[0][0];
    expect(success).toBe(true);
    expect(Array.isArray(data.riders)).toBe(true);
    expect(data.riders.length).toBeGreaterThan(0);
    expect(typeof data.refreshCost).toBe('number');
    expect(typeof data.canRefreshFree).toBe('boolean');
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

  it('returns existing marketplace when refresh is not needed', async () => {
    const state = makeDbState({ lastRefresh: new Date() }); // recent — no refresh needed
    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(state);

    const { req, res } = mockReqRes();
    await getRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.staffMarketplaceState.upsert).not.toHaveBeenCalled();
    const { data } = res.json.mock.calls[0][0];
    expect(Array.isArray(data.riders)).toBe(true);
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
    // null record → getRiderRefreshCost(null) returns 0
    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(null);
    const state = makeDbState({ refreshCount: 1 });
    mockPrisma.staffMarketplaceState.upsert.mockResolvedValue(state);

    const { req, res } = mockReqRes({ body: {} });
    await refreshRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(Array.isArray(data.riders)).toBe(true);
    expect(data.riders.length).toBeGreaterThan(0);
    expect(data.refreshCost).toBe(0);
  });

  it('returns 400 when paid refresh attempted without force=true', async () => {
    // Recent lastRefresh → cost = PREMIUM_REFRESH_COST (50)
    const state = makeDbState({ lastRefresh: new Date() });
    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(state);

    const { req, res } = mockReqRes({ body: { force: false } });
    await refreshRiderMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('force=true') }),
    );
  });

  it('deducts cost and refreshes when force=true and user has enough money', async () => {
    const state = makeDbState({ lastRefresh: new Date() }); // cost > 0
    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(state);
    mockPrisma.user.findUnique.mockResolvedValue({ money: 500 });
    mockPrisma.user.update.mockResolvedValue({});
    const newState = makeDbState({ refreshCount: 2 });
    mockPrisma.staffMarketplaceState.upsert.mockResolvedValue(newState);

    const { req, res } = mockReqRes({ body: { force: true } });
    await refreshRiderMarketplace(req, res);

    // PREMIUM_REFRESH_COST = 50
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { money: { decrement: 50 } } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 when user has insufficient funds for paid refresh', async () => {
    const state = makeDbState({ lastRefresh: new Date() }); // cost > 0
    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(state);
    mockPrisma.user.findUnique.mockResolvedValue({ money: 10 }); // less than 50

    const { req, res } = mockReqRes({ body: { force: true } });
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
    // DB has no record for this user
    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(null);

    const { req, res } = mockReqRes({
      body: { marketplaceId: 'mkt_rider_nonexistent' },
    });
    await hireRiderFromMarketplace(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('marketplace') }),
    );
  });

  it('hires rider, deducts weeklyRate, returns 201 with rider data', async () => {
    const userId = `hire-ok-${Date.now()}`;
    const state = makeDbState();
    const rider = state.offers[0];

    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(state);
    mockPrisma.user.findUnique.mockResolvedValue({ money: 9999 });

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
    mockPrisma.rider.create.mockResolvedValue(createdRider);
    mockPrisma.user.update.mockResolvedValue({ money: 9999 - rider.weeklyRate });
    mockPrisma.staffMarketplaceState.update.mockResolvedValue({});

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
    // Hired rider is removed from persisted offers
    expect(mockPrisma.staffMarketplaceState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ offers: expect.any(Array) }),
      }),
    );
  });

  it('returns 400 when user has insufficient funds to hire', async () => {
    const state = makeDbState();
    const rider = state.offers[0];

    mockPrisma.staffMarketplaceState.findUnique.mockResolvedValue(state);
    mockPrisma.user.findUnique.mockResolvedValue({ money: 0 });

    const { req, res } = mockReqRes({
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
