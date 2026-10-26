/**
 * tackShopController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getTackInventory, purchaseTackItem, unequipDecoration.
 * Routes live under authRouter at /api/v1/tack-shop (the unversioned /api/*
 * mount was removed in Equoria-4bs3s).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../../app.mjs';
import prisma from '../../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../../tests/helpers/fixtureColor.mjs';
// merged from legacy backend/tests, Equoria-wvuin — pure catalog + bonus + controller-direct
import { TACK_INVENTORY, purchaseTackItem, unequipDecoration } from '../controllers/tackShopController.mjs';
import { createCleanupTracker } from '../../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

const cleanup = createCleanupTracker();

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `tack-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `tack${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Tack',
      lastName: 'Tester',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TackHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2019-01-01'),
      age: 6,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-9jv9c).
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/tack-shop/inventory ─────────────────────────────────────────────

describe('GET /api/tack-shop/inventory', () => {
  it('returns 200 with items and categories', async () => {
    const res = await request(app)
      .get('/api/v1/tack-shop/inventory')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('categories');
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/tack-shop/inventory').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/tack-shop/purchase ─────────────────────────────────────────────

describe('POST /api/tack-shop/purchase', () => {
  // Owner ruling 2026-10-26 (q78, Equoria-dslww). Old contract: horseId was
  // required (400 without it) and the item went onto that horse. New: the Tack
  // Shop buys into the inventory and no horse is involved, so a purchase needs
  // only an itemId (an unknown one is a 404).
  it('accepts a purchase without a horseId (validation passes, unknown item is 404)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ itemId: 'some-item' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when itemId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for an unknown itemId', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ itemId: 'nonexistent-tack-xyz-99999' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('purchasing a known item answers 200 or 400 (funds)', async () => {
    // Get the first available item from inventory
    const inventoryRes = await request(app)
      .get('/api/v1/tack-shop/inventory')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    const firstItem = inventoryRes.body.data?.items?.[0];
    if (!firstItem) {
      return; // No items in the shop — skip
    }

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ itemId: firstItem.id });

    // 200 success or 400 (insufficient funds)
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, itemId: 'some-item' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/tack-shop/unequip-decoration ──────────────────────────────────

describe('POST /api/tack-shop/unequip-decoration', () => {
  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/tack-shop/unequip-decoration')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ itemId: 'some-item' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/tack-shop/unequip-decoration')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999999, itemId: 'some-item' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/tack-shop/unequip-decoration')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, itemId: 'some-item' });

    expect(res.status).toBe(401);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Pure TACK_INVENTORY decorative-item invariants and controller-direct decorative purchase/unequip
// behaviors (decorations-array append/dedup, ledger-sync, unequip) — none
// covered by the HTTP shells above.
describe('TACK_INVENTORY — decorative items (merged from legacy backend/tests, Equoria-wvuin)', () => {
  const decorativeItems = TACK_INVENTORY.filter(i => i.category === 'decorative');

  it('includes at least 5 decorative items with the required core IDs', () => {
    expect(decorativeItems.length).toBeGreaterThanOrEqual(5);
    const ids = decorativeItems.map(i => i.id);
    ['show-ribbon', 'braided-mane-wrap', 'parade-blanket', 'glitter-spray', 'floral-browband'].forEach(id => {
      expect(ids).toContain(id);
    });
  });

  it('every decorative item is cosmetic with a presenceBonus 1–10 (no numericBonus, Equoria-lsudd: numericBonus retired (owner decision A, 2026-10-23: the item in the slot decides the tack points).)', () => {
    for (const item of decorativeItems) {
      expect(item.isCosmetic).toBe(true);
      expect(item).not.toHaveProperty('numericBonus');
      expect(typeof item.presenceBonus).toBe('number');
      expect(item.presenceBonus).toBeGreaterThanOrEqual(1);
      expect(item.presenceBonus).toBeLessThanOrEqual(10);
    }
  });

  it('includes a winter seasonal item (snowflake-parade-tack)', () => {
    expect(decorativeItems.filter(i => !!i.seasonalTag).length).toBeGreaterThanOrEqual(1);
    const item = decorativeItems.find(i => i.id === 'snowflake-parade-tack');
    expect(item).toBeDefined();
    expect(item.seasonalTag).toBe('winter');
  });
});

describe('purchaseTackItem / unequipDecoration — controller-direct decorative behavior (merged from legacy backend/tests, Equoria-wvuin)', () => {
  const makeReq = (overrides = {}) => ({ user: { id: user.id }, body: {}, params: {}, ...overrides });
  const makeRes = () => {
    const res = { _status: null, _body: null };
    res.status = code => {
      res._status = code;
      return res;
    };
    res.json = body => {
      res._body = body;
      return res;
    };
    return res;
  };

  const inventoryRecords = async itemId => {
    const row = await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } });
    return (row.settings?.inventory ?? []).filter(r => r.itemId === itemId);
  };

  // Owner ruling 2026-10-26 (q78, Equoria-dslww). Old contract: a purchase
  // appended the decoration to a horse's tack.decorations[] (deduplicated). New:
  // it adds an unequipped record to the inventory; equipping is separate.
  it('adds a purchased decorative item to the inventory, unequipped, and touches no horse', async () => {
    await prisma.horse.update({ where: { id: horse.id }, data: { tack: {} } });
    await prisma.user.update({ where: { id: user.id }, data: { money: 50000, settings: {} } });
    const res = makeRes();
    await purchaseTackItem(makeReq({ body: { itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    const records = await inventoryRecords('show-ribbon');
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ category: 'decorative', equippedToHorseId: null, quantity: 1 });
    const h = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(h.tack).toEqual({});
  });

  it('keeps a second purchase of the same decoration as its own record', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 50000, settings: {} } });
    await purchaseTackItem(makeReq({ body: { itemId: 'floral-browband' } }), makeRes());
    await purchaseTackItem(makeReq({ body: { itemId: 'show-ribbon' } }), makeRes());
    await purchaseTackItem(makeReq({ body: { itemId: 'show-ribbon' } }), makeRes());
    const ribbons = await inventoryRecords('show-ribbon');
    expect(ribbons).toHaveLength(2);
    expect(new Set(ribbons.map(r => r.id)).size).toBe(2);
    expect(await inventoryRecords('floral-browband')).toHaveLength(1);
  });

  it('writes the tackPurchase ledger transaction synchronously before resolving', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 50000 } });
    const before = await prisma.userTransaction.count({ where: { userId: user.id, category: 'tackPurchase' } });
    const res = makeRes();
    await purchaseTackItem(makeReq({ body: { itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(200);
    const after = await prisma.userTransaction.count({ where: { userId: user.id, category: 'tackPurchase' } });
    expect(after).toBe(before + 1);
    const row = await prisma.userTransaction.findFirst({
      where: { userId: user.id, category: 'tackPurchase' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row.type).toBe('debit');
    // Owner ruling 2026-10-26: every tack item costs 500 (old contract: 120).
    expect(row.amount).toBe(500);
    await prisma.userTransaction.deleteMany({ where: { userId: user.id, category: 'tackPurchase' } });
  });

  it('returns 400 on insufficient funds', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: 50 } });
    const res = makeRes();
    await purchaseTackItem(makeReq({ body: { itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/Insufficient funds/);
    await prisma.user.update({ where: { id: user.id }, data: { money: 50000 } });
  });

  it('unequipDecoration removes an item ID from tack.decorations[]', async () => {
    await prisma.horse.update({
      where: { id: horse.id },
      data: { tack: { decorations: ['show-ribbon', 'floral-browband'] } },
    });
    const res = makeRes();
    await unequipDecoration(makeReq({ body: { horseId: horse.id, itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(200);
    expect(res._body.data.removedItemId).toBe('show-ribbon');
    const h = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(h.tack.decorations).toEqual(['floral-browband']);
  });

  it('unequipDecoration returns 400 when the decoration is not equipped', async () => {
    await prisma.horse.update({ where: { id: horse.id }, data: { tack: { decorations: ['parade-blanket'] } } });
    const res = makeRes();
    await unequipDecoration(makeReq({ body: { horseId: horse.id, itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(400);
    expect(res._body.message).toMatch(/not equipped/i);
  });

  it('unequipDecoration returns 404 for a horse not found / not owned', async () => {
    const res = makeRes();
    await unequipDecoration(makeReq({ body: { horseId: 999999999, itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(404);
    expect(res._body.message).toMatch(/Horse not found/i);
  });
});
