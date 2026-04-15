/**
 * riderController.test.mjs
 *
 * Unit tests for backend/modules/riders/controllers/riderController.mjs
 * Co-located per the backend/modules/<domain>/__tests__/ convention (Story 21-1).
 *
 * Coverage: getUserRiders, getRiderAssignments, assignRider, deleteRiderAssignment, dismissRider
 * Mocks: prisma, logger (external deps only)
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  rider: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  riderAssignment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  horse: {
    findFirst: jest.fn(),
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

const { getUserRiders, getRiderAssignments, assignRider, deleteRiderAssignment, dismissRider } = await import(
  '../controllers/riderController.mjs'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockReqRes(overrides = {}) {
  const req = {
    user: { id: 'user-uuid-1' },
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

// ── getUserRiders ─────────────────────────────────────────────────────────────

describe('getUserRiders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns formatted riders with name and assignedHorseId', async () => {
    const rawRider = {
      id: 1,
      firstName: 'Maria',
      lastName: 'Garcia',
      userId: 'user-uuid-1',
      retired: false,
      assignments: [{ id: 10, horseId: 5, startDate: new Date() }],
    };
    mockPrisma.rider.findMany.mockResolvedValue([rawRider]);

    const { req, res } = mockReqRes();
    await getUserRiders(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data[0]).toMatchObject({
      name: 'Maria Garcia',
      assignedHorseId: 5,
    });
  });

  it('returns assignedHorseId as null when rider has no active assignment', async () => {
    mockPrisma.rider.findMany.mockResolvedValue([
      {
        id: 2,
        firstName: 'Sam',
        lastName: 'Lee',
        userId: 'user-uuid-1',
        retired: false,
        assignments: [],
      },
    ]);

    const { req, res } = mockReqRes();
    await getUserRiders(req, res);

    const { data } = res.json.mock.calls[0][0];
    expect(data[0].assignedHorseId).toBeNull();
  });

  it('only returns non-retired riders for the authenticated user', async () => {
    mockPrisma.rider.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes();
    await getUserRiders(req, res);

    expect(mockPrisma.rider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-uuid-1', retired: false }),
      }),
    );
  });

  it('returns 500 on database error', async () => {
    mockPrisma.rider.findMany.mockRejectedValue(new Error('connection failed'));
    const { req, res } = mockReqRes();
    await getUserRiders(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getRiderAssignments ───────────────────────────────────────────────────────

describe('getRiderAssignments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns formatted assignments with horse and rider names', async () => {
    const rawAssignment = {
      id: 1,
      riderId: 1,
      horseId: 5,
      startDate: new Date(),
      isActive: true,
      rider: { id: 1, firstName: 'Maria', lastName: 'Garcia' },
      horse: { id: 5, name: 'Starlight' },
    };
    mockPrisma.riderAssignment.findMany.mockResolvedValue([rawAssignment]);

    const { req, res } = mockReqRes();
    await getRiderAssignments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data[0]).toMatchObject({
      horseName: 'Starlight',
      riderName: 'Maria Garcia',
    });
  });

  it('returns 500 on database error', async () => {
    mockPrisma.riderAssignment.findMany.mockRejectedValue(new Error('db error'));
    const { req, res } = mockReqRes();
    await getRiderAssignments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── assignRider ───────────────────────────────────────────────────────────────

describe('assignRider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates assignment and returns 201', async () => {
    mockPrisma.rider.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.horse.findFirst.mockResolvedValue({ id: 5, userId: 'user-uuid-1' });
    mockPrisma.riderAssignment.findFirst.mockResolvedValue(null);
    mockPrisma.riderAssignment.updateMany.mockResolvedValue({});
    mockPrisma.riderAssignment.create.mockResolvedValue({
      id: 10,
      riderId: 1,
      horseId: 5,
      userId: 'user-uuid-1',
      isActive: true,
    });

    const { req, res } = mockReqRes({ body: { riderId: 1, horseId: 5 } });
    await assignRider(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: expect.stringContaining('assigned') }),
    );
  });

  it('returns 404 when rider does not belong to user', async () => {
    mockPrisma.rider.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { riderId: 99, horseId: 5 } });
    await assignRider(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Rider not found' }));
  });

  it('returns 404 when horse does not belong to user', async () => {
    mockPrisma.rider.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.horse.findFirst.mockResolvedValue(null);

    const { req, res } = mockReqRes({ body: { riderId: 1, horseId: 999 } });
    await assignRider(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Horse not found' }));
  });

  it('returns 400 when rider is already assigned to another horse', async () => {
    mockPrisma.rider.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.horse.findFirst.mockResolvedValue({ id: 5, userId: 'user-uuid-1' });
    mockPrisma.riderAssignment.findFirst.mockResolvedValue({ id: 99, riderId: 1, isActive: true });

    const { req, res } = mockReqRes({ body: { riderId: 1, horseId: 5 } });
    await assignRider(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('already assigned') }),
    );
  });

  it('deactivates any existing rider on the target horse before assigning', async () => {
    mockPrisma.rider.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.horse.findFirst.mockResolvedValue({ id: 5, userId: 'user-uuid-1' });
    mockPrisma.riderAssignment.findFirst.mockResolvedValue(null);
    mockPrisma.riderAssignment.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.riderAssignment.create.mockResolvedValue({ id: 10, isActive: true });

    const { req, res } = mockReqRes({ body: { riderId: 1, horseId: 5 } });
    await assignRider(req, res);

    expect(mockPrisma.riderAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ horseId: 5, isActive: true }),
        data: { isActive: false },
      }),
    );
  });
});

// ── deleteRiderAssignment ─────────────────────────────────────────────────────

describe('deleteRiderAssignment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deactivates assignment and returns success', async () => {
    mockPrisma.riderAssignment.findFirst.mockResolvedValue({
      id: 5,
      userId: 'user-uuid-1',
      isActive: true,
    });
    mockPrisma.riderAssignment.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: '5' } });
    await deleteRiderAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.riderAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('returns 404 when assignment does not exist or belongs to another user', async () => {
    mockPrisma.riderAssignment.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });
    await deleteRiderAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Assignment not found' }));
  });
});

// ── dismissRider ──────────────────────────────────────────────────────────────

describe('dismissRider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks rider retired and deactivates all active assignments', async () => {
    mockPrisma.rider.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.riderAssignment.updateMany.mockResolvedValue({});
    mockPrisma.rider.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await dismissRider(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.rider.update).toHaveBeenCalledWith(expect.objectContaining({ data: { retired: true } }));
    expect(mockPrisma.riderAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ riderId: 1, isActive: true }),
        data: { isActive: false },
      }),
    );
  });

  it('returns 404 when rider does not belong to user', async () => {
    mockPrisma.rider.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '99' } });
    await dismissRider(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.rider.update).not.toHaveBeenCalled();
    expect(mockPrisma.riderAssignment.updateMany).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.rider.findFirst.mockRejectedValue(new Error('db crash'));
    const { req, res } = mockReqRes({ params: { id: '1' } });
    await dismissRider(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
