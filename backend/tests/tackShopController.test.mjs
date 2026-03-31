/**
 * 🧪 UNIT TEST: Tack Shop Controller — Decorative & Parade Tack System
 *
 * Tests the decorative tack purchase and unequip flow, resolveTackBonus
 * for parade shows, and the TACK_INVENTORY decorative catalog.
 *
 * 📋 BUSINESS RULES TESTED:
 * - TACK_INVENTORY includes 5 core decorative items + 1 seasonal item
 * - resolveTackBonus returns presenceBonus for parade shows only
 * - resolveTackBonus returns presenceBonus=0 for non-parade shows
 * - purchaseTackItem appends decorative items to tack.decorations[] (not replacing)
 * - purchaseTackItem does not add duplicates to decorations[]
 * - unequipDecoration removes item by ID from tack.decorations[]
 * - unequipDecoration returns 400 if item not equipped
 * - unequipDecoration returns 404 if horse not found
 * - GET /inventory returns decorative category items in categories.decorative
 * - Seasonal items have seasonalTag field
 * - isCosmetic flag is true on all decorative items
 *
 * 🔄 BALANCED MOCKING APPROACH:
 * ✅ REAL: All controller business logic, catalog lookups, tack JSON mutations
 * ✅ REAL: resolveTackBonus presenceBonus calculation
 * 🔧 MOCK: Prisma (external DB dependency)
 * 🔧 MOCK: Logger (external I/O dependency)
 */

import { jest, describe, beforeEach, expect, it } from '@jest/globals';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockPrisma = {
  horse: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.unstable_mockModule(join(__dirname, '../../packages/database/prismaClient.mjs'), () => ({ default: mockPrisma }));

jest.unstable_mockModule(join(__dirname, '../utils/logger.mjs'), () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ── Load modules after mocks ──────────────────────────────────────────────────

const { TACK_INVENTORY, resolveTackBonus, getTackInventory, purchaseTackItem, unequipDecoration } = await import(
  '../modules/services/controllers/tackShopController.mjs'
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides = {}) {
  return {
    user: { id: 'user-1' },
    body: {},
    params: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    _status: null,
    _body: null,
  };
  res.status.mockImplementation(code => {
    res._status = code;
    return res;
  });
  res.json.mockImplementation(body => {
    res._body = body;
    return res;
  });
  return res;
}

// ── TACK_INVENTORY catalog tests ──────────────────────────────────────────────

describe('TACK_INVENTORY — decorative items', () => {
  const decorativeItems = TACK_INVENTORY.filter(i => i.category === 'decorative');

  it('includes at least 5 decorative items', () => {
    expect(decorativeItems.length).toBeGreaterThanOrEqual(5);
  });

  it('includes all required core items by ID', () => {
    const ids = decorativeItems.map(i => i.id);
    expect(ids).toContain('show-ribbon');
    expect(ids).toContain('braided-mane-wrap');
    expect(ids).toContain('parade-blanket');
    expect(ids).toContain('glitter-spray');
    expect(ids).toContain('floral-browband');
  });

  it('includes at least one seasonal item', () => {
    const seasonal = decorativeItems.filter(i => !!i.seasonalTag);
    expect(seasonal.length).toBeGreaterThanOrEqual(1);
  });

  it('all decorative items have isCosmetic: true', () => {
    for (const item of decorativeItems) {
      expect(item.isCosmetic).toBe(true);
    }
  });

  it('all decorative items have presenceBonus between 1 and 10', () => {
    for (const item of decorativeItems) {
      expect(typeof item.presenceBonus).toBe('number');
      expect(item.presenceBonus).toBeGreaterThanOrEqual(1);
      expect(item.presenceBonus).toBeLessThanOrEqual(10);
    }
  });

  it('all decorative items have numericBonus of 0', () => {
    for (const item of decorativeItems) {
      expect(item.numericBonus).toBe(0);
    }
  });

  it('snowflake-parade-tack has seasonalTag "winter"', () => {
    const item = decorativeItems.find(i => i.id === 'snowflake-parade-tack');
    expect(item).toBeDefined();
    expect(item.seasonalTag).toBe('winter');
  });
});

// ── resolveTackBonus ──────────────────────────────────────────────────────────

describe('resolveTackBonus', () => {
  it('returns presenceBonus=0 for ridden show even with decorations equipped', () => {
    const tack = { decorations: ['show-ribbon', 'floral-browband'] };
    const result = resolveTackBonus(tack, 'ridden');
    expect(result.presenceBonus).toBe(0);
    expect(result.saddleBonus).toBe(0);
    expect(result.bridleBonus).toBe(0);
  });

  it('returns presenceBonus=0 for conformation show even with decorations', () => {
    const tack = { decorations: ['show-ribbon'] };
    const result = resolveTackBonus(tack, 'conformation');
    expect(result.presenceBonus).toBe(0);
  });

  it('returns summed presenceBonus for parade show', () => {
    // show-ribbon=3, floral-browband=3 → total 6
    const tack = { decorations: ['show-ribbon', 'floral-browband'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(6);
  });

  it('returns presenceBonus=0 for parade with no decorations', () => {
    const tack = { saddle: 'dressage-saddle', saddle_condition: 100 };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(0);
  });

  it('ignores unknown decoration IDs gracefully', () => {
    const tack = { decorations: ['nonexistent-item'] };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(0);
  });

  it('returns full presenceBonus for all 5 core items combined', () => {
    // show-ribbon=3, braided-mane-wrap=4, parade-blanket=5, glitter-spray=2, floral-browband=3 = 17
    const tack = {
      decorations: ['show-ribbon', 'braided-mane-wrap', 'parade-blanket', 'glitter-spray', 'floral-browband'],
    };
    const result = resolveTackBonus(tack, 'parade');
    expect(result.presenceBonus).toBe(17);
  });

  it('returns both saddleBonus and presenceBonus when both are equipped for parade', () => {
    const tack = {
      saddle: 'dressage-saddle',
      saddle_condition: 100,
      decorations: ['parade-blanket'],
    };
    const result = resolveTackBonus(tack, 'parade');
    // For parade shows, saddleBonus is still resolved but tackBonus in simulateCompetition
    // uses presenceBonus instead — resolveTackBonus returns both for caller choice
    expect(result.saddleBonus).toBe(5);
    expect(result.presenceBonus).toBe(5);
  });
});

// ── getTackInventory ──────────────────────────────────────────────────────────

describe('getTackInventory', () => {
  it('returns decorative category in categories object', async () => {
    const req = makeReq();
    const res = makeRes();
    await getTackInventory(req, res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data.categories).toHaveProperty('decorative');
    expect(res._body.data.categories.decorative.length).toBeGreaterThanOrEqual(5);
  });

  it('includes categoryDisplayNames with Decorative & Parade entry', async () => {
    const req = makeReq();
    const res = makeRes();
    await getTackInventory(req, res);
    expect(res._body.data.categoryDisplayNames.decorative).toBe('Decorative & Parade');
  });
});

// ── purchaseTackItem — decorative ─────────────────────────────────────────────

describe('purchaseTackItem — decorative items', () => {
  const userId = 'user-1';
  const horseId = 42;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('appends decorative item ID to tack.decorations array', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: {},
    });
    mockPrisma.user.findUnique.mockResolvedValue({ money: 500 });
    mockPrisma.$transaction.mockImplementation(async ops => {
      return ops.map(() => ({
        id: horseId,
        name: 'Stardust',
        tack: { decorations: ['show-ribbon'] },
      }));
    });

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.message).toContain('purchased successfully');

    // Verify horse.update was called with decorations array
    const updateCall = mockPrisma.horse.update.mock.calls[0][0];
    const tackData = updateCall.data.tack;
    expect(Array.isArray(tackData.decorations)).toBe(true);
    expect(tackData.decorations).toContain('show-ribbon');
  });

  it('appends to existing decorations array without replacing', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: { decorations: ['show-ribbon'] },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ money: 500 });
    mockPrisma.$transaction.mockImplementation(async ops => {
      return ops.map(() => ({
        id: horseId,
        name: 'Stardust',
        tack: { decorations: ['show-ribbon', 'floral-browband'] },
      }));
    });

    const req = makeReq({ body: { horseId, itemId: 'floral-browband' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(200);
    const updateCall = mockPrisma.horse.update.mock.calls[0][0];
    const tackData = updateCall.data.tack;
    expect(tackData.decorations).toEqual(expect.arrayContaining(['show-ribbon', 'floral-browband']));
    expect(tackData.decorations.length).toBe(2);
  });

  it('does not add duplicate decorations on re-purchase', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: { decorations: ['show-ribbon'] },
    });
    mockPrisma.user.findUnique.mockResolvedValue({ money: 500 });
    mockPrisma.$transaction.mockImplementation(async ops => {
      return ops.map(() => ({
        id: horseId,
        name: 'Stardust',
        tack: { decorations: ['show-ribbon'] },
      }));
    });

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    // Even if the horse already has show-ribbon, the array should not have duplicates
    const updateCall = mockPrisma.horse.update.mock.calls[0][0];
    const tackData = updateCall.data.tack;
    const ribbonCount = tackData.decorations.filter(id => id === 'show-ribbon').length;
    expect(ribbonCount).toBe(1);
  });

  it('does not set tack.decorative key (only tack.decorations array)', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: {},
    });
    mockPrisma.user.findUnique.mockResolvedValue({ money: 500 });
    mockPrisma.$transaction.mockImplementation(async ops => {
      return ops.map(() => ({
        id: horseId,
        name: 'Stardust',
        tack: { decorations: ['show-ribbon'] },
      }));
    });

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    const updateCall = mockPrisma.horse.update.mock.calls[0][0];
    expect(updateCall.data.tack).not.toHaveProperty('decorative');
  });

  it('returns 400 if user has insufficient funds', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({ id: horseId, userId, tack: {} });
    mockPrisma.user.findUnique.mockResolvedValue({ money: 50 }); // show-ribbon costs 120

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(400);
    expect(res._body.success).toBe(false);
    expect(res._body.message).toMatch(/Insufficient funds/);
  });

  it('returns 404 if item not in catalog', async () => {
    const req = makeReq({ body: { horseId, itemId: 'not-a-real-item' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
    expect(res._body.message).toMatch(/not found in inventory/i);
  });

  it('returns 404 if horse not found', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue(null);

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(404);
    expect(res._body.message).toMatch(/Horse not found/i);
  });
});

// ── unequipDecoration ─────────────────────────────────────────────────────────

describe('unequipDecoration', () => {
  const userId = 'user-1';
  const horseId = 42;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes the item ID from tack.decorations[]', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: { decorations: ['show-ribbon', 'floral-browband'] },
    });
    mockPrisma.horse.update.mockResolvedValue({
      id: horseId,
      name: 'Stardust',
      tack: { decorations: ['floral-browband'] },
    });

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data.removedItemId).toBe('show-ribbon');

    const updateCall = mockPrisma.horse.update.mock.calls[0][0];
    expect(updateCall.data.tack.decorations).toEqual(['floral-browband']);
  });

  it('returns empty decorations array after removing last item', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: { decorations: ['show-ribbon'] },
    });
    mockPrisma.horse.update.mockResolvedValue({
      id: horseId,
      name: 'Stardust',
      tack: { decorations: [] },
    });

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(200);
    const updateCall = mockPrisma.horse.update.mock.calls[0][0];
    expect(updateCall.data.tack.decorations).toEqual([]);
  });

  it('returns 400 if decoration is not equipped on the horse', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: { decorations: ['parade-blanket'] },
    });

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(400);
    expect(res._body.success).toBe(false);
    expect(res._body.message).toMatch(/not equipped/i);
  });

  it('returns 400 if horse has no decorations array', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue({
      id: horseId,
      userId,
      tack: { saddle: 'dressage-saddle' },
    });

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(400);
    expect(res._body.success).toBe(false);
  });

  it('returns 404 if horse not found or not owned by user', async () => {
    mockPrisma.horse.findFirst.mockResolvedValue(null);

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(404);
    expect(res._body.message).toMatch(/Horse not found/i);
  });

  it('returns 500 on unexpected DB error', async () => {
    mockPrisma.horse.findFirst.mockRejectedValue(new Error('DB connection lost'));

    const req = makeReq({ body: { horseId, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(500);
    expect(res._body.success).toBe(false);
  });
});
