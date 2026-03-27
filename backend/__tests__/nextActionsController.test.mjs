/**
 * nextActionsController.test.mjs
 *
 * Unit tests for the NextActionsController.
 * Tests the GET /api/v1/next-actions endpoint logic.
 *
 * Mocks: prisma (horse.findMany, foalDevelopment.findMany), logger
 * Tests: auth check, empty horses, injured horse, foal actions, trainable horse,
 *        competitive horse, breedable mare, priority ordering, max 6 limit, errors
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';

// ── Mock setup ───────────────────────────────────────────────────────────────

const mockPrisma = {
  horse: { findMany: jest.fn() },
  foalDevelopment: { findMany: jest.fn() },
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../db/index.mjs', () => ({ default: mockPrisma }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ default: mockLogger }));

const { getNextActions } = await import('../controllers/nextActionsController.mjs');

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

function makeHorse(overrides = {}) {
  return {
    id: 1,
    name: 'Thunder',
    age: 5,
    healthStatus: 'healthy',
    trainingCooldown: null,
    lastBredDate: null,
    sex: 'Stallion',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getNextActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no horses, no foals
    mockPrisma.horse.findMany.mockResolvedValue([]);
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([]);
  });

  it('returns 401 when user is not authenticated', async () => {
    const { req, res } = createMockReqRes({ user: null });
    await getNextActions(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Authentication required' }),
    );
  });

  it('returns empty actions when user has no horses', async () => {
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.actions).toEqual([]);
  });

  it('returns visit-vet action for an injured horse', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ healthStatus: 'injured' })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    const vetAction = body.data.actions.find(a => a.type === 'visit-vet');
    expect(vetAction).toBeDefined();
    expect(vetAction.horseId).toBe(1);
  });

  it('detects injured horse with uppercase INJURED', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ healthStatus: 'INJURED' })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'visit-vet')).toBe(true);
  });

  it('returns groom-foal action when active foal development exists', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([]);
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([{ horseId: 10, horse: { name: 'Little Star' } }]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    const foalAction = body.data.actions.find(a => a.type === 'groom-foal');
    expect(foalAction).toBeDefined();
    expect(foalAction.horseId).toBe(10);
    expect(foalAction.horseName).toBe('Little Star');
    expect(foalAction.metadata.totalFoals).toBe(1);
  });

  it('includes totalFoals count in groom-foal metadata', async () => {
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([
      { horseId: 10, horse: { name: 'Foal A' } },
      { horseId: 11, horse: { name: 'Foal B' } },
      { horseId: 12, horse: { name: 'Foal C' } },
    ]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    const foalAction = body.data.actions.find(a => a.type === 'groom-foal');
    expect(foalAction.metadata.totalFoals).toBe(3);
  });

  it('returns train action for eligible horse (age>=3, healthy, no cooldown)', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ age: 5, healthStatus: 'healthy' })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'train')).toBe(true);
  });

  it('does not return train action for horse under age 3', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ age: 2 })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'train')).toBe(false);
  });

  it('does not return train action for horse with active cooldown', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ trainingCooldown: futureDate })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'train')).toBe(false);
  });

  it('returns train action when cooldown has expired', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ trainingCooldown: pastDate })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'train')).toBe(true);
  });

  it('returns compete action for eligible horse (age>=3, healthy)', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ age: 4 })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'compete')).toBe(true);
  });

  it('does not return compete action for injured horse', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ age: 5, healthStatus: 'injured' })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'compete')).toBe(false);
  });

  it('returns breed action for an eligible mare', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([
      makeHorse({ sex: 'Mare', age: 4, healthStatus: 'healthy', lastBredDate: null }),
    ]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'breed')).toBe(true);
  });

  it('handles mare sex check case-insensitively', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ sex: 'mare', age: 4 })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'breed')).toBe(true);
  });

  it('does not return breed action for a stallion', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ sex: 'Stallion', age: 5 })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'breed')).toBe(false);
  });

  it('does not return breed action for mare with active breeding cooldown', async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ sex: 'Mare', age: 5, lastBredDate: futureDate })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.some(a => a.type === 'breed')).toBe(false);
  });

  it('assigns ascending priority numbers starting from 1', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([
      makeHorse({ id: 1, healthStatus: 'injured' }),
      makeHorse({ id: 2, sex: 'Mare', age: 5, healthStatus: 'healthy' }),
    ]);
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([{ horseId: 3, horse: { name: 'Foal' } }]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    const priorities = body.data.actions.map(a => a.priority);
    // Should be renumbered 1,2,3,...
    expect(priorities).toEqual(priorities.map((_p, i) => i + 1));
    expect(priorities[0]).toBe(1);
  });

  it('limits output to 6 actions maximum', async () => {
    // Create enough data to produce more than 6 actions
    const horses = [
      makeHorse({ id: 1, healthStatus: 'injured', name: 'Injured1' }),
      makeHorse({ id: 2, healthStatus: 'injured', name: 'Injured2' }),
      makeHorse({ id: 3, sex: 'Mare', age: 5, healthStatus: 'healthy', name: 'Mare1' }),
      makeHorse({ id: 4, age: 5, healthStatus: 'healthy', name: 'Stallion1' }),
    ];
    mockPrisma.horse.findMany.mockResolvedValue(horses);
    mockPrisma.foalDevelopment.findMany.mockResolvedValue([{ horseId: 10, horse: { name: 'Foal' } }]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.actions.length).toBeLessThanOrEqual(6);
  });

  it('gracefully handles foalDevelopment query failure', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse()]);
    mockPrisma.foalDevelopment.findMany.mockRejectedValue(new Error('Table not found'));
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    // Should still have train/compete actions despite foal query failure
    expect(body.data.actions.length).toBeGreaterThan(0);
  });

  it('returns 500 on unexpected error', async () => {
    mockPrisma.horse.findMany.mockRejectedValue(new Error('DB connection lost'));
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: 'Failed to fetch next actions' }),
    );
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('includes horseName in each action', async () => {
    mockPrisma.horse.findMany.mockResolvedValue([makeHorse({ id: 1, name: 'Starfire', age: 5 })]);
    const { req, res } = createMockReqRes();
    await getNextActions(req, res);
    const body = res.json.mock.calls[0][0];
    for (const action of body.data.actions) {
      expect(action.horseName).toBe('Starfire');
    }
  });
});
