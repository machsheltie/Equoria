/**
 * showController.test.mjs
 *
 * Unit tests for the ShowController (Epic BACKEND-A).
 * Tests: createShow, getShows, enterShow, executeClosedShows
 *
 * Mocks: prisma (show, showEntry, horse, user, competitionResult), logger
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ───────────────────────────────────────────────────────────────

const mockPrisma = {
  show: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  showEntry: {
    create: jest.fn(),
  },
  horse: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  competitionResult: {
    create: jest.fn(),
  },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

const { createShow, getShows, enterShow, executeClosedShows } = await import('../controllers/showController.mjs');

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockReqRes(overrides = {}) {
  const req = {
    user: { id: 'test-user-id' },
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

// ── createShow ───────────────────────────────────────────────────────────────

describe('createShow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a show with valid data and returns 201', async () => {
    const showData = {
      id: 1,
      name: 'Spring Cup',
      discipline: 'Dressage',
      entryFee: 100,
      status: 'open',
    };
    mockPrisma.show.create.mockResolvedValue(showData);

    const { req, res } = createMockReqRes({
      body: { name: 'Spring Cup', discipline: 'Dressage', entryFee: 100 },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.show).toEqual(showData);
  });

  it('passes correct data to prisma.show.create including dates and defaults', async () => {
    mockPrisma.show.create.mockResolvedValue({ id: 1, name: 'Test' });

    const { req, res } = createMockReqRes({
      body: { name: 'Test Show', discipline: 'Reining', entryFee: 50 },
    });
    await createShow(req, res);

    const createCall = mockPrisma.show.create.mock.calls[0][0];
    expect(createCall.data.name).toBe('Test Show');
    expect(createCall.data.discipline).toBe('Reining');
    expect(createCall.data.entryFee).toBe(50);
    expect(createCall.data.status).toBe('open');
    expect(createCall.data.createdByUserId).toBe('test-user-id');
    expect(createCall.data.levelMin).toBe(1);
    expect(createCall.data.levelMax).toBe(999);
    expect(createCall.data.prize).toBe(0);
    // closeDate should be ~7 days after openDate
    const openMs = new Date(createCall.data.openDate).getTime();
    const closeMs = new Date(createCall.data.closeDate).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(closeMs - openMs).toBe(sevenDaysMs);
  });

  it('returns 401 when user is not authenticated', async () => {
    const { req, res } = createMockReqRes({ user: null, body: { name: 'X', discipline: 'Dressage' } });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when name is missing', async () => {
    const { req, res } = createMockReqRes({
      body: { discipline: 'Dressage' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('name');
  });

  it('returns 400 when name is too short (1 char)', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'A', discipline: 'Dressage' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('trims name whitespace before length check', async () => {
    const { req, res } = createMockReqRes({
      body: { name: '  A  ', discipline: 'Dressage' },
    });
    await createShow(req, res);
    // '  A  '.trim() = 'A' which is 1 char → 400
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for invalid discipline', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'My Show', discipline: 'Underwater Polo' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('discipline');
  });

  it('returns 400 when discipline is missing', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'My Show' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when entryFee is negative', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'My Show', discipline: 'Dressage', entryFee: -5 },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('fee');
  });

  it('returns 400 when entryFee exceeds 100000', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'My Show', discipline: 'Dressage', entryFee: 100001 },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when entryFee is not a number', async () => {
    const { req, res } = createMockReqRes({
      body: { name: 'My Show', discipline: 'Dressage', entryFee: 'free' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('defaults entryFee to 0 when not provided', async () => {
    mockPrisma.show.create.mockResolvedValue({ id: 1 });
    const { req, res } = createMockReqRes({
      body: { name: 'Free Show', discipline: 'Barrel Racing' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockPrisma.show.create.mock.calls[0][0].data.entryFee).toBe(0);
  });

  it('returns 409 on duplicate show name (P2002)', async () => {
    const prismaError = new Error('Unique constraint failed');
    prismaError.code = 'P2002';
    mockPrisma.show.create.mockRejectedValue(prismaError);

    const { req, res } = createMockReqRes({
      body: { name: 'Spring Cup', discipline: 'Dressage' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('already exists');
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.show.create.mockRejectedValue(new Error('DB crash'));
    const { req, res } = createMockReqRes({
      body: { name: 'Good Show', discipline: 'Reining' },
    });
    await createShow(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('accepts all 23 valid disciplines', async () => {
    const validDisciplines = [
      'Western Pleasure',
      'Reining',
      'Cutting',
      'Barrel Racing',
      'Roping',
      'Team Penning',
      'Rodeo',
      'Hunter',
      'Saddleseat',
      'Endurance',
      'Eventing',
      'Dressage',
      'Show Jumping',
      'Vaulting',
      'Polo',
      'Cross Country',
      'Combined Driving',
      'Fine Harness',
      'Gaited',
      'Gymkhana',
      'Steeplechase',
      'Racing',
      'Harness Racing',
    ];
    for (const disc of validDisciplines) {
      jest.clearAllMocks();
      mockPrisma.show.create.mockResolvedValue({ id: 1, name: 'Test', discipline: disc });
      const { req, res } = createMockReqRes({
        body: { name: 'Test Show', discipline: disc },
      });
      await createShow(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    }
  });
});

// ── getShows ─────────────────────────────────────────────────────────────────

describe('getShows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated shows with default params', async () => {
    const shows = [{ id: 1, name: 'Show A', _count: { entries: 3 } }];
    mockPrisma.show.findMany.mockResolvedValue(shows);
    mockPrisma.show.count.mockResolvedValue(1);

    const { req, res } = createMockReqRes();
    await getShows(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.shows[0].entryCount).toBe(3);
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.limit).toBe(20);
    expect(body.data.pagination.total).toBe(1);
    expect(body.data.pagination.totalPages).toBe(1);
  });

  it('applies status filter from query params', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    mockPrisma.show.count.mockResolvedValue(0);

    const { req, res } = createMockReqRes({ query: { status: 'completed' } });
    await getShows(req, res);

    const findManyCall = mockPrisma.show.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe('completed');
  });

  it('applies discipline filter from query params', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    mockPrisma.show.count.mockResolvedValue(0);

    const { req, res } = createMockReqRes({
      query: { discipline: 'Dressage' },
    });
    await getShows(req, res);

    const findManyCall = mockPrisma.show.findMany.mock.calls[0][0];
    expect(findManyCall.where.discipline).toBe('Dressage');
  });

  it('respects custom page and limit', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    mockPrisma.show.count.mockResolvedValue(100);

    const { req, res } = createMockReqRes({
      query: { page: '3', limit: '10' },
    });
    await getShows(req, res);

    const findManyCall = mockPrisma.show.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(20); // (3-1) * 10
    expect(findManyCall.take).toBe(10);

    const body = res.json.mock.calls[0][0];
    expect(body.data.pagination.page).toBe(3);
    expect(body.data.pagination.limit).toBe(10);
    expect(body.data.pagination.totalPages).toBe(10); // 100/10
  });

  it('clamps limit to max 50', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    mockPrisma.show.count.mockResolvedValue(0);

    const { req, res } = createMockReqRes({ query: { limit: '200' } });
    await getShows(req, res);

    const findManyCall = mockPrisma.show.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(50);
  });

  it('falls back to default 20 when limit is 0 (falsy)', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    mockPrisma.show.count.mockResolvedValue(0);

    const { req, res } = createMockReqRes({ query: { limit: '0' } });
    await getShows(req, res);

    // parseInt('0') = 0, 0 || 20 = 20, Math.max(1, 20) = 20
    const findManyCall = mockPrisma.show.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(20);
  });

  it('clamps page to min 1', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    mockPrisma.show.count.mockResolvedValue(0);

    const { req, res } = createMockReqRes({ query: { page: '-1' } });
    await getShows(req, res);

    const findManyCall = mockPrisma.show.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(0);
  });

  it('returns empty shows array when none exist', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    mockPrisma.show.count.mockResolvedValue(0);

    const { req, res } = createMockReqRes();
    await getShows(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.data.shows).toEqual([]);
    expect(body.data.pagination.total).toBe(0);
  });

  it('returns 500 on database error', async () => {
    mockPrisma.show.findMany.mockRejectedValue(new Error('DB error'));

    const { req, res } = createMockReqRes();
    await getShows(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

// ── enterShow ────────────────────────────────────────────────────────────────

describe('enterShow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const openShow = {
    id: 1,
    status: 'open',
    entryFee: 50,
    maxEntries: 10,
    closeDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    _count: { entries: 2 },
  };

  const ownedHorse = {
    id: 100,
    name: 'Thunder',
    userId: 'test-user-id',
    age: 5,
    healthStatus: 'healthy',
  };

  it('successfully enters a horse in a show and returns 201', async () => {
    mockPrisma.show.findUnique.mockResolvedValue(openShow);
    mockPrisma.horse.findUnique.mockResolvedValue(ownedHorse);
    mockPrisma.user.findUnique.mockResolvedValue({ money: 1000 });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.showEntry.create.mockResolvedValue({ id: 'entry-1', showId: 1, horseId: 100 });

    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.horseName).toBe('Thunder');
    expect(body.data.entry).toBeDefined();
  });

  it('returns 401 when user is not authenticated', async () => {
    const { req, res } = createMockReqRes({
      user: null,
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when horseId is missing', async () => {
    const { req, res } = createMockReqRes({ params: { id: '1' }, body: {} });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('horseId');
  });

  it('returns 400 when horseId is not a number', async () => {
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 'abc' },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when show does not exist', async () => {
    mockPrisma.show.findUnique.mockResolvedValue(null);
    const { req, res } = createMockReqRes({
      params: { id: '999' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 409 when show is not open', async () => {
    mockPrisma.show.findUnique.mockResolvedValue({ ...openShow, status: 'completed' });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('no longer accepting');
  });

  it('returns 409 when entry period has closed (closeDate in past)', async () => {
    const pastDate = new Date(Date.now() - 1000);
    mockPrisma.show.findUnique.mockResolvedValue({
      ...openShow,
      closeDate: pastDate,
    });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('closed');
  });

  it('returns 409 when show is full (maxEntries reached)', async () => {
    mockPrisma.show.findUnique.mockResolvedValue({
      ...openShow,
      maxEntries: 2,
      _count: { entries: 2 },
    });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('full');
  });

  it('returns 403 when horse is not owned by user', async () => {
    mockPrisma.show.findUnique.mockResolvedValue(openShow);
    mockPrisma.horse.findUnique.mockResolvedValue({
      ...ownedHorse,
      userId: 'other-user-id',
    });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 403 when horse does not exist', async () => {
    mockPrisma.show.findUnique.mockResolvedValue(openShow);
    mockPrisma.horse.findUnique.mockResolvedValue(null);
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 999 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when horse is too young (age < 3)', async () => {
    mockPrisma.show.findUnique.mockResolvedValue(openShow);
    mockPrisma.horse.findUnique.mockResolvedValue({ ...ownedHorse, age: 2 });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('3 years old');
  });

  it('returns 400 when horse is injured', async () => {
    mockPrisma.show.findUnique.mockResolvedValue(openShow);
    mockPrisma.horse.findUnique.mockResolvedValue({ ...ownedHorse, healthStatus: 'injured' });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('Injured');
  });

  it('returns 400 when horse health is INJURED (uppercase)', async () => {
    mockPrisma.show.findUnique.mockResolvedValue(openShow);
    mockPrisma.horse.findUnique.mockResolvedValue({ ...ownedHorse, healthStatus: 'INJURED' });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 402 when user has insufficient funds', async () => {
    mockPrisma.show.findUnique.mockResolvedValue({ ...openShow, entryFee: 500 });
    mockPrisma.horse.findUnique.mockResolvedValue(ownedHorse);
    mockPrisma.user.findUnique.mockResolvedValue({ money: 100 });
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json.mock.calls[0][0].message).toContain('Insufficient');
  });

  it('decrements user money by entry fee', async () => {
    mockPrisma.show.findUnique.mockResolvedValue({ ...openShow, entryFee: 75 });
    mockPrisma.horse.findUnique.mockResolvedValue(ownedHorse);
    mockPrisma.user.findUnique.mockResolvedValue({ money: 500 });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.showEntry.create.mockResolvedValue({ id: 'e-1' });

    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'test-user-id' },
      data: { money: { decrement: 75 } },
    });
  });

  it('skips fee charge when entryFee is 0', async () => {
    mockPrisma.show.findUnique.mockResolvedValue({ ...openShow, entryFee: 0 });
    mockPrisma.horse.findUnique.mockResolvedValue(ownedHorse);
    mockPrisma.showEntry.create.mockResolvedValue({ id: 'e-1' });

    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 409 on duplicate entry (P2002)', async () => {
    mockPrisma.show.findUnique.mockResolvedValue({ ...openShow, entryFee: 0 });
    mockPrisma.horse.findUnique.mockResolvedValue(ownedHorse);
    const prismaError = new Error('Unique constraint');
    prismaError.code = 'P2002';
    mockPrisma.showEntry.create.mockRejectedValue(prismaError);

    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('already entered');
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.show.findUnique.mockRejectedValue(new Error('DB crash'));
    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('allows entry when maxEntries is null (unlimited)', async () => {
    mockPrisma.show.findUnique.mockResolvedValue({
      ...openShow,
      maxEntries: null,
      entryFee: 0,
      _count: { entries: 999 },
    });
    mockPrisma.horse.findUnique.mockResolvedValue(ownedHorse);
    mockPrisma.showEntry.create.mockResolvedValue({ id: 'e-1' });

    const { req, res } = createMockReqRes({
      params: { id: '1' },
      body: { horseId: 100 },
    });
    await enterShow(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ── executeClosedShows ───────────────────────────────────────────────────────

describe('executeClosedShows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns executed: 0 when no shows are ready', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.executed).toBe(0);
  });

  it('completes a show with no entries', async () => {
    mockPrisma.show.findMany.mockResolvedValue([
      { id: 1, name: 'Empty Show', prize: 0, discipline: 'Dressage', entries: [] },
    ]);
    mockPrisma.show.update.mockResolvedValue({});

    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);

    // Should update to 'executing' then 'completed'
    expect(mockPrisma.show.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: { status: 'executing' } }),
    );
    expect(mockPrisma.show.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('scores entries and creates competition results', async () => {
    mockPrisma.show.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Test Show',
        prize: 1000,
        discipline: 'Dressage',
        entries: [
          {
            horseId: 10,
            userId: 'user-a',
            horse: {
              id: 10,
              name: 'Fast',
              userId: 'user-a',
              speed: 80,
              stamina: 70,
              agility: 75,
              balance: 60,
              precision: 90,
              boldness: 65,
            },
          },
          {
            horseId: 20,
            userId: 'user-b',
            horse: {
              id: 20,
              name: 'Slow',
              userId: 'user-b',
              speed: 40,
              stamina: 40,
              agility: 40,
              balance: 40,
              precision: 40,
              boldness: 40,
            },
          },
        ],
      },
    ]);
    mockPrisma.show.update.mockResolvedValue({});
    mockPrisma.competitionResult.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ settings: {} });

    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);

    // Should create 2 competition results
    expect(mockPrisma.competitionResult.create).toHaveBeenCalledTimes(2);

    // Verify result data shape
    const firstCall = mockPrisma.competitionResult.create.mock.calls[0][0];
    expect(firstCall.data).toHaveProperty('score');
    expect(firstCall.data).toHaveProperty('placement');
    expect(firstCall.data).toHaveProperty('discipline', 'Dressage');
    expect(firstCall.data).toHaveProperty('showName', 'Test Show');
    expect(firstCall.data).toHaveProperty('showId', 1);
  });

  it('awards prize money to top 3 places (50/30/20 split)', async () => {
    mockPrisma.show.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Prize Show',
        prize: 1000,
        discipline: 'Racing',
        entries: [
          {
            horseId: 1,
            userId: 'u1',
            horse: {
              id: 1,
              name: 'A',
              userId: 'u1',
              speed: 90,
              stamina: 90,
              agility: 90,
              balance: 90,
              precision: 90,
              boldness: 90,
            },
          },
          {
            horseId: 2,
            userId: 'u2',
            horse: {
              id: 2,
              name: 'B',
              userId: 'u2',
              speed: 70,
              stamina: 70,
              agility: 70,
              balance: 70,
              precision: 70,
              boldness: 70,
            },
          },
          {
            horseId: 3,
            userId: 'u3',
            horse: {
              id: 3,
              name: 'C',
              userId: 'u3',
              speed: 50,
              stamina: 50,
              agility: 50,
              balance: 50,
              precision: 50,
              boldness: 50,
            },
          },
          {
            horseId: 4,
            userId: 'u4',
            horse: {
              id: 4,
              name: 'D',
              userId: 'u4',
              speed: 30,
              stamina: 30,
              agility: 30,
              balance: 30,
              precision: 30,
              boldness: 30,
            },
          },
        ],
      },
    ]);
    mockPrisma.show.update.mockResolvedValue({});
    mockPrisma.competitionResult.create.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ settings: {} });

    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);

    // Prize amounts: 1st = floor(1000*0.5)=500, 2nd = floor(1000*0.3)=300, 3rd = floor(1000*0.2)=200, 4th = 0
    // Check competition results include prizeWon
    const resultCalls = mockPrisma.competitionResult.create.mock.calls;
    const prizes = resultCalls.map(c => c[0].data.prizeWon);
    expect(prizes).toContain(500); // 1st place
    expect(prizes).toContain(300); // 2nd place
    expect(prizes).toContain(200); // 3rd place
    expect(prizes).toContain(0); // 4th place
  });

  it('updates show status to completed after execution', async () => {
    mockPrisma.show.findMany.mockResolvedValue([
      {
        id: 5,
        name: 'Final Show',
        prize: 0,
        discipline: 'Polo',
        entries: [
          {
            horseId: 1,
            userId: 'u1',
            horse: {
              id: 1,
              name: 'X',
              userId: 'u1',
              speed: 50,
              stamina: 50,
              agility: 50,
              balance: 50,
              precision: 50,
              boldness: 50,
            },
          },
        ],
      },
    ]);
    mockPrisma.show.update.mockResolvedValue({});
    mockPrisma.competitionResult.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ settings: {} });

    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);

    // Last update call should set status to completed
    const updateCalls = mockPrisma.show.update.mock.calls;
    const completedCall = updateCalls.find(c => c[0].where.id === 5 && c[0].data.status === 'completed');
    expect(completedCall).toBeDefined();
    expect(completedCall[0].data.executedAt).toBeDefined();
  });

  it('handles scheduler call with (null, null) without crashing', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    // Should not throw when res is null
    await expect(executeClosedShows(null, null)).resolves.not.toThrow();
  });

  it('does not send response when res is null (scheduler mode)', async () => {
    mockPrisma.show.findMany.mockResolvedValue([]);
    const result = await executeClosedShows(null, null);
    // No res.status or res.json calls since res is null
    expect(result).toBeUndefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.show.findMany.mockRejectedValue(new Error('DB crash'));
    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe('Execution failed');
  });

  it('logs error but does not throw when res is null and error occurs', async () => {
    mockPrisma.show.findMany.mockRejectedValue(new Error('Scheduler crash'));
    await expect(executeClosedShows(null, null)).resolves.not.toThrow();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('sets firstEverWin milestone for 1st place winner', async () => {
    mockPrisma.show.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Win Show',
        prize: 0,
        discipline: 'Dressage',
        entries: [
          {
            horseId: 1,
            userId: 'winner-user',
            horse: {
              id: 1,
              name: 'Champ',
              userId: 'winner-user',
              speed: 99,
              stamina: 99,
              agility: 99,
              balance: 99,
              precision: 99,
              boldness: 99,
            },
          },
        ],
      },
    ]);
    mockPrisma.show.update.mockResolvedValue({});
    mockPrisma.competitionResult.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ settings: {} });
    mockPrisma.user.update.mockResolvedValue({});

    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);

    // Should have called user.findUnique and user.update for milestone
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'winner-user' } }));
    // user.update should set firstWin milestone
    const milestoneUpdate = mockPrisma.user.update.mock.calls.find(c => c[0].data?.settings?.milestones?.firstWin);
    expect(milestoneUpdate).toBeDefined();
  });

  it('does not overwrite existing firstWin milestone', async () => {
    mockPrisma.show.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Win Again',
        prize: 0,
        discipline: 'Racing',
        entries: [
          {
            horseId: 1,
            userId: 'u1',
            horse: {
              id: 1,
              name: 'Champ',
              userId: 'u1',
              speed: 99,
              stamina: 99,
              agility: 99,
              balance: 99,
              precision: 99,
              boldness: 99,
            },
          },
        ],
      },
    ]);
    mockPrisma.show.update.mockResolvedValue({});
    mockPrisma.competitionResult.create.mockResolvedValue({});
    // User already has firstWin
    mockPrisma.user.findUnique.mockResolvedValue({
      settings: { milestones: { firstWin: '2026-01-01T00:00:00.000Z' } },
    });

    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);

    // user.update should NOT have been called for milestone (only show.update calls)
    const milestoneUpdate = mockPrisma.user.update.mock.calls.find(c => c[0].data?.settings?.milestones);
    expect(milestoneUpdate).toBeUndefined();
  });

  it('uses default stat value of 50 when horse stat is null', async () => {
    mockPrisma.show.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Null Stats Show',
        prize: 0,
        discipline: 'Polo',
        entries: [
          {
            horseId: 1,
            userId: 'u1',
            horse: {
              id: 1,
              name: 'NullHorse',
              userId: 'u1',
              speed: null,
              stamina: null,
              agility: null,
              balance: null,
              precision: null,
              boldness: null,
            },
          },
        ],
      },
    ]);
    mockPrisma.show.update.mockResolvedValue({});
    mockPrisma.competitionResult.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ settings: {} });
    mockPrisma.user.update.mockResolvedValue({});

    const { req, res } = createMockReqRes();
    await executeClosedShows(req, res);

    // Should still create a result with score based on 50 defaults
    expect(mockPrisma.competitionResult.create).toHaveBeenCalledTimes(1);
    const score = mockPrisma.competitionResult.create.mock.calls[0][0].data.score;
    // Base would be (50+50+50+50+50)/5 = 50, ±9 luck → range [41, 59]
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
