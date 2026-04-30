/**
 * trainerController.test.mjs
 *
 * Unit tests for backend/modules/trainers/controllers/trainerController.mjs
 * Co-located per the backend/modules/<domain>/__tests__/ convention (Story 21-1).
 *
 * Coverage: getUserTrainers, getTrainerAssignments, assignTrainer, deleteTrainerAssignment, dismissTrainer
 * Mocks: prisma, logger (external deps only)
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ────────────────────────────────────────────────────────────────

const mockPrisma = {
  trainer: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  trainerAssignment: {
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

const { getUserTrainers, getTrainerAssignments, assignTrainer, deleteTrainerAssignment, dismissTrainer } = await import(
  '../controllers/trainerController.mjs'
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

// ── getUserTrainers ───────────────────────────────────────────────────────────

describe('getUserTrainers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns formatted trainers with name and assignedHorseId', async () => {
    const rawTrainer = {
      id: 1,
      firstName: 'Alice',
      lastName: 'Smith',
      userId: 'user-uuid-1',
      retired: false,
      assignments: [{ id: 10, horseId: 5, startDate: new Date() }],
    };
    mockPrisma.trainer.findMany.mockResolvedValue([rawTrainer]);

    const { req, res } = mockReqRes();
    await getUserTrainers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data[0]).toMatchObject({
      name: 'Alice Smith',
      assignedHorseId: 5,
    });
  });

  it('returns assignedHorseId as null when no active assignment', async () => {
    const rawTrainer = {
      id: 2,
      firstName: 'Bob',
      lastName: 'Jones',
      userId: 'user-uuid-1',
      retired: false,
      assignments: [],
    };
    mockPrisma.trainer.findMany.mockResolvedValue([rawTrainer]);

    const { req, res } = mockReqRes();
    await getUserTrainers(req, res);

    const { data } = res.json.mock.calls[0][0];
    expect(data[0].assignedHorseId).toBeNull();
  });

  it('only queries non-retired trainers for the authenticated user', async () => {
    mockPrisma.trainer.findMany.mockResolvedValue([]);
    const { req, res } = mockReqRes();
    await getUserTrainers(req, res);

    expect(mockPrisma.trainer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-uuid-1', retired: false }),
      }),
    );
  });

  it('returns 500 on database error', async () => {
    mockPrisma.trainer.findMany.mockRejectedValue(new Error('db down'));
    const { req, res } = mockReqRes();
    await getUserTrainers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

// ── getTrainerAssignments ─────────────────────────────────────────────────────

describe('getTrainerAssignments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns formatted active assignments with horse and trainer names', async () => {
    const rawAssignment = {
      id: 1,
      trainerId: 1,
      horseId: 5,
      startDate: new Date(),
      isActive: true,
      trainer: { id: 1, firstName: 'Alice', lastName: 'Smith' },
      horse: { id: 5, name: 'Thunder' },
    };
    mockPrisma.trainerAssignment.findMany.mockResolvedValue([rawAssignment]);

    const { req, res } = mockReqRes();
    await getTrainerAssignments(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { data } = res.json.mock.calls[0][0];
    expect(data[0]).toMatchObject({
      horseName: 'Thunder',
      trainerName: 'Alice Smith',
    });
  });

  it('returns 500 on database error', async () => {
    mockPrisma.trainerAssignment.findMany.mockRejectedValue(new Error('db down'));
    const { req, res } = mockReqRes();
    await getTrainerAssignments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ── assignTrainer ─────────────────────────────────────────────────────────────

describe('assignTrainer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates assignment and returns 201', async () => {
    mockPrisma.trainer.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.horse.findFirst.mockResolvedValue({ id: 5, userId: 'user-uuid-1' });
    mockPrisma.trainerAssignment.findFirst.mockResolvedValue(null); // not already assigned
    mockPrisma.trainerAssignment.updateMany.mockResolvedValue({});
    mockPrisma.trainerAssignment.create.mockResolvedValue({
      id: 10,
      trainerId: 1,
      horseId: 5,
      userId: 'user-uuid-1',
      isActive: true,
    });

    const { req, res } = mockReqRes({ body: { trainerId: 1, horseId: 5 } });
    await assignTrainer(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 404 when trainer does not belong to user', async () => {
    mockPrisma.trainer.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ body: { trainerId: 99, horseId: 5 } });
    await assignTrainer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Trainer not found' }));
  });

  it('returns 404 when horse does not belong to user', async () => {
    mockPrisma.trainer.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.horse.findFirst.mockResolvedValue(null);

    const { req, res } = mockReqRes({ body: { trainerId: 1, horseId: 999 } });
    await assignTrainer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Horse not found' }));
  });

  it('returns 400 when trainer is already assigned to another horse', async () => {
    mockPrisma.trainer.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.horse.findFirst.mockResolvedValue({ id: 5, userId: 'user-uuid-1' });
    mockPrisma.trainerAssignment.findFirst.mockResolvedValue({ id: 99, trainerId: 1, isActive: true });

    const { req, res } = mockReqRes({ body: { trainerId: 1, horseId: 5 } });
    await assignTrainer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('already assigned') }),
    );
  });
});

// ── deleteTrainerAssignment ───────────────────────────────────────────────────

describe('deleteTrainerAssignment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deactivates assignment and returns success', async () => {
    mockPrisma.trainerAssignment.findFirst.mockResolvedValue({
      id: 5,
      userId: 'user-uuid-1',
      isActive: true,
    });
    mockPrisma.trainerAssignment.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: '5' } });
    await deleteTrainerAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.trainerAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('returns 404 when assignment does not exist or belongs to another user', async () => {
    mockPrisma.trainerAssignment.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '999' } });
    await deleteTrainerAssignment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Assignment not found' }));
  });
});

// ── dismissTrainer ────────────────────────────────────────────────────────────

describe('dismissTrainer', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks trainer as retired and deactivates all assignments', async () => {
    mockPrisma.trainer.findFirst.mockResolvedValue({ id: 1, userId: 'user-uuid-1' });
    mockPrisma.trainerAssignment.updateMany.mockResolvedValue({});
    mockPrisma.trainer.update.mockResolvedValue({});

    const { req, res } = mockReqRes({ params: { id: '1' } });
    await dismissTrainer(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockPrisma.trainer.update).toHaveBeenCalledWith(expect.objectContaining({ data: { retired: true } }));
    expect(mockPrisma.trainerAssignment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('returns 404 when trainer does not belong to user', async () => {
    mockPrisma.trainer.findFirst.mockResolvedValue(null);
    const { req, res } = mockReqRes({ params: { id: '99' } });
    await dismissTrainer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockPrisma.trainer.update).not.toHaveBeenCalled();
  });
});
