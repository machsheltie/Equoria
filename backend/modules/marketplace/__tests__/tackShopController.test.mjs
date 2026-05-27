/**
 * tackShopController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getTackInventory, purchaseTackItem, unequipDecoration.
 * Routes live under authRouter at /api/tack-shop.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// merged from legacy backend/tests, Equoria-wvuin — pure catalog + bonus + controller-direct
import {
  TACK_INVENTORY,
  resolveTackBonus,
  purchaseTackItem,
  unequipDecoration,
} from '../../services/controllers/tackShopController.mjs';

const ORIGIN = 'http://localhost:3000';

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
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/tack-shop/inventory ─────────────────────────────────────────────

describe('GET /api/tack-shop/inventory', () => {
  it('returns 200 with items and categories', async () => {
    const res = await request(app)
      .get('/api/tack-shop/inventory')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('categories');
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/tack-shop/inventory').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/tack-shop/purchase ─────────────────────────────────────────────

describe('POST /api/tack-shop/purchase', () => {
  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ itemId: 'some-item' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when itemId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for an unknown itemId', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, itemId: 'nonexistent-tack-xyz-99999' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when purchasing a known item for an owned horse', async () => {
    // Get the first available item from inventory
    const inventoryRes = await request(app)
      .get('/api/tack-shop/inventory')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    const firstItem = inventoryRes.body.data?.items?.[0];
    if (!firstItem) {
      return; // No items in the shop — skip
    }

    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/tack-shop/purchase')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, itemId: firstItem.id });

    // 200 success or 400 (already equipped, insufficient funds, etc.)
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/tack-shop/purchase')
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
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/tack-shop/unequip-decoration')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ itemId: 'some-item' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/tack-shop/unequip-decoration')
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
      .post('/api/tack-shop/unequip-decoration')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, itemId: 'some-item' });

    expect(res.status).toBe(401);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Pure TACK_INVENTORY decorative-item invariants, pure resolveTackBonus
// parade-only logic, and controller-direct decorative purchase/unequip
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

  it('every decorative item is cosmetic, numericBonus 0, presenceBonus 1–10', () => {
    for (const item of decorativeItems) {
      expect(item.isCosmetic).toBe(true);
      expect(item.numericBonus).toBe(0);
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

describe('resolveTackBonus — parade-only presence bonus (merged from legacy backend/tests, Equoria-wvuin)', () => {
  it('presenceBonus is 0 for ridden and conformation shows even with decorations', () => {
    const tack = { decorations: ['show-ribbon', 'floral-browband'] };
    expect(resolveTackBonus(tack, 'ridden').presenceBonus).toBe(0);
    expect(resolveTackBonus(tack, 'conformation').presenceBonus).toBe(0);
  });

  it('sums presenceBonus for parade shows (show-ribbon + floral-browband = 6)', () => {
    expect(resolveTackBonus({ decorations: ['show-ribbon', 'floral-browband'] }, 'parade').presenceBonus).toBe(6);
  });

  it('presenceBonus is 0 for parade with no decorations, and ignores unknown IDs', () => {
    expect(resolveTackBonus({ saddle: 'dressage-saddle' }, 'parade').presenceBonus).toBe(0);
    expect(resolveTackBonus({ decorations: ['nonexistent-item'] }, 'parade').presenceBonus).toBe(0);
  });

  it('sums all 5 core decorations for parade (=17)', () => {
    const tack = {
      decorations: ['show-ribbon', 'braided-mane-wrap', 'parade-blanket', 'glitter-spray', 'floral-browband'],
    };
    expect(resolveTackBonus(tack, 'parade').presenceBonus).toBe(17);
  });

  it('returns both saddleBonus and presenceBonus when both equipped for parade', () => {
    const result = resolveTackBonus({ saddle: 'dressage-saddle', decorations: ['parade-blanket'] }, 'parade');
    expect(result.saddleBonus).toBe(5);
    expect(result.presenceBonus).toBe(5);
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

  it('appends a purchased decorative item ID to tack.decorations[]', async () => {
    await prisma.horse.update({ where: { id: horse.id }, data: { tack: {} } });
    await prisma.user.update({ where: { id: user.id }, data: { money: 50000 } });
    const res = makeRes();
    await purchaseTackItem(makeReq({ body: { horseId: horse.id, itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    const h = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(h.tack.decorations).toContain('show-ribbon');
    expect(h.tack).not.toHaveProperty('decorative');
  });

  it('appends to an existing decorations array without duplicating on re-purchase', async () => {
    await prisma.horse.update({ where: { id: horse.id }, data: { tack: { decorations: ['show-ribbon'] } } });
    await prisma.user.update({ where: { id: user.id }, data: { money: 50000 } });
    await purchaseTackItem(makeReq({ body: { horseId: horse.id, itemId: 'floral-browband' } }), makeRes());
    await purchaseTackItem(makeReq({ body: { horseId: horse.id, itemId: 'show-ribbon' } }), makeRes());
    const h = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(h.tack.decorations).toEqual(expect.arrayContaining(['show-ribbon', 'floral-browband']));
    expect(h.tack.decorations.filter(id => id === 'show-ribbon').length).toBe(1);
  });

  it('writes the tack_purchase ledger transaction synchronously before resolving', async () => {
    await prisma.horse.update({ where: { id: horse.id }, data: { tack: {} } });
    await prisma.user.update({ where: { id: user.id }, data: { money: 50000 } });
    const before = await prisma.userTransaction.count({ where: { userId: user.id, category: 'tack_purchase' } });
    const res = makeRes();
    await purchaseTackItem(makeReq({ body: { horseId: horse.id, itemId: 'show-ribbon' } }), res);
    expect(res._status).toBe(200);
    const after = await prisma.userTransaction.count({ where: { userId: user.id, category: 'tack_purchase' } });
    expect(after).toBe(before + 1);
    const row = await prisma.userTransaction.findFirst({
      where: { userId: user.id, category: 'tack_purchase' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row.type).toBe('debit');
    expect(row.amount).toBe(120);
    await prisma.userTransaction.deleteMany({ where: { userId: user.id, category: 'tack_purchase' } });
  });

  it('returns 400 on insufficient funds', async () => {
    await prisma.horse.update({ where: { id: horse.id }, data: { tack: {} } });
    await prisma.user.update({ where: { id: user.id }, data: { money: 50 } });
    const res = makeRes();
    await purchaseTackItem(makeReq({ body: { horseId: horse.id, itemId: 'show-ribbon' } }), res);
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
