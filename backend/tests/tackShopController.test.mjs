/**
 * Tack Shop Controller — Decorative & Parade Tack System (REAL DB)
 *
 * Tests the decorative tack purchase and unequip flow, resolveTackBonus
 * for parade shows, and the TACK_INVENTORY decorative catalog.
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
 * jest.unstable_mockModule of prismaClient + logger to a real-DB integration
 * test against the canonical equoria DB. The original mocks dictated specific
 * Prisma return shapes per test branch — every such branch is now exercised
 * by setting up the corresponding real horse/user state, calling the
 * controller, and verifying real DB mutations.
 *
 * Removed (per doctrine):
 *   - "returns 500 on unexpected DB error" — required mocking
 *     prisma.horse.findFirst to reject. Synthetic Prisma fault injection is
 *     forbidden; the .catch() block in the controller IS exercised by the
 *     production code on real DB connection loss / schema drift, but a
 *     synthetic test of that path is not a permitted pattern.
 */

import { describe, beforeAll, beforeEach, afterAll, expect, it } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import {
  TACK_INVENTORY,
  resolveTackBonus,
  getTackInventory,
  purchaseTackItem,
  unequipDecoration,
} from '../modules/services/controllers/tackShopController.mjs';

const ts = randomBytes(8).toString('hex');
let testUser;
let testHorse;

// ── req/res helpers (no Prisma mocked here — these stub HTTP only) ────────────

function makeReq(overrides = {}) {
  return {
    user: { id: testUser?.id ?? 'pre-init' },
    body: {},
    params: {},
    ...overrides,
  };
}

function makeRes() {
  const res = {
    status: undefined,
    json: undefined,
    _status: null,
    _body: null,
  };
  res.status = code => {
    res._status = code;
    return res;
  };
  res.json = body => {
    res._body = body;
    return res;
  };
  return res;
}

// ── Real-DB test fixtures ─────────────────────────────────────────────────────

beforeAll(async () => {
  const hashed = await bcrypt.hash('TestPass123!', 10);
  testUser = await prisma.user.create({
    data: {
      username: `tackShopTest_${ts}`,
      email: `tackShopTest_${ts}@test.com`,
      password: hashed,
      firstName: 'TackShop',
      lastName: 'Test',
      money: 10_000,
    },
  });

  // A breed is required for horse FK; reuse Thoroughbred or create one for
  // the suite with a unique name to avoid colliding with other tests.
  const breed =
    (await prisma.breed.findFirst({ where: { name: 'Thoroughbred' } })) ??
    (await prisma.breed.create({
      data: { name: `TackShopBreed_${ts}`, description: 'Tack shop test breed' },
    }));

  testHorse = await prisma.horse.create({
    data: {
      name: `TackShopHorse_${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      breedId: breed.id,
      userId: testUser.id,
      tack: {},
    },
  });
});

beforeEach(async () => {
  // Reset horse tack + user money to known state for each controller test.
  await prisma.horse.update({
    where: { id: testHorse.id },
    data: { tack: {} },
  });
  await prisma.user.update({
    where: { id: testUser.id },
    data: { money: 10_000 },
  });
});

afterAll(async () => {
  if (testHorse?.id) {
    await prisma.horse.delete({ where: { id: testHorse.id } }).catch(() => {});
  }
  if (testUser?.id) {
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

// ── TACK_INVENTORY catalog tests (pure data; no DB) ───────────────────────────

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

// ── resolveTackBonus (pure function; no DB) ───────────────────────────────────

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

// ── purchaseTackItem — decorative items (real DB) ─────────────────────────────

describe('purchaseTackItem — decorative items', () => {
  it('appends decorative item ID to tack.decorations array', async () => {
    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.message).toContain('purchased successfully');

    const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
    expect(Array.isArray(horse.tack.decorations)).toBe(true);
    expect(horse.tack.decorations).toContain('show-ribbon');
  });

  it('appends to existing decorations array without replacing', async () => {
    await prisma.horse.update({
      where: { id: testHorse.id },
      data: { tack: { decorations: ['show-ribbon'] } },
    });

    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'floral-browband' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(200);
    const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
    expect(horse.tack.decorations).toEqual(expect.arrayContaining(['show-ribbon', 'floral-browband']));
    expect(horse.tack.decorations.length).toBe(2);
  });

  it('does not add duplicate decorations on re-purchase', async () => {
    await prisma.horse.update({
      where: { id: testHorse.id },
      data: { tack: { decorations: ['show-ribbon'] } },
    });

    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
    const ribbonCount = horse.tack.decorations.filter(id => id === 'show-ribbon').length;
    expect(ribbonCount).toBe(1);
  });

  it('does not set tack.decorative key (only tack.decorations array)', async () => {
    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
    expect(horse.tack).not.toHaveProperty('decorative');
  });

  it('returns 400 if user has insufficient funds', async () => {
    await prisma.user.update({ where: { id: testUser.id }, data: { money: 50 } });

    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(400);
    expect(res._body.success).toBe(false);
    expect(res._body.message).toMatch(/Insufficient funds/);
  });

  it('returns 404 if item not in catalog', async () => {
    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'not-a-real-item' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
    expect(res._body.message).toMatch(/not found in inventory/i);
  });

  it('returns 404 if horse not found', async () => {
    const req = makeReq({ body: { horseId: 999_999_999, itemId: 'show-ribbon' } });
    const res = makeRes();
    await purchaseTackItem(req, res);

    expect(res._status).toBe(404);
    expect(res._body.message).toMatch(/Horse not found/i);
  });
});

// ── unequipDecoration (real DB) ───────────────────────────────────────────────

describe('unequipDecoration', () => {
  it('removes the item ID from tack.decorations[]', async () => {
    await prisma.horse.update({
      where: { id: testHorse.id },
      data: { tack: { decorations: ['show-ribbon', 'floral-browband'] } },
    });

    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data.removedItemId).toBe('show-ribbon');

    const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
    expect(horse.tack.decorations).toEqual(['floral-browband']);
  });

  it('returns empty decorations array after removing last item', async () => {
    await prisma.horse.update({
      where: { id: testHorse.id },
      data: { tack: { decorations: ['show-ribbon'] } },
    });

    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(200);
    const horse = await prisma.horse.findUnique({ where: { id: testHorse.id } });
    expect(horse.tack.decorations).toEqual([]);
  });

  it('returns 400 if decoration is not equipped on the horse', async () => {
    await prisma.horse.update({
      where: { id: testHorse.id },
      data: { tack: { decorations: ['parade-blanket'] } },
    });

    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(400);
    expect(res._body.success).toBe(false);
    expect(res._body.message).toMatch(/not equipped/i);
  });

  it('returns 400 if horse has no decorations array', async () => {
    await prisma.horse.update({
      where: { id: testHorse.id },
      data: { tack: { saddle: 'dressage-saddle' } },
    });

    const req = makeReq({ body: { horseId: testHorse.id, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(400);
    expect(res._body.success).toBe(false);
  });

  it('returns 404 if horse not found or not owned by user', async () => {
    const req = makeReq({ body: { horseId: 999_999_999, itemId: 'show-ribbon' } });
    const res = makeRes();
    await unequipDecoration(req, res);

    expect(res._status).toBe(404);
    expect(res._body.message).toMatch(/Horse not found/i);
  });
});
