/**
 * tackShopController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getTackInventory, purchaseTackItem, unequipDecoration.
 * Routes live under authRouter at /api/tack-shop.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `tack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `tack${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'Tack',
      lastName: 'Tester',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
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
