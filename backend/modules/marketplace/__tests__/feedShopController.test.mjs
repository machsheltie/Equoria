/**
 * feedShopController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getFeedCatalog, purchaseFeed.
 * Routes live under authRouter → real auth + real CSRF for POST.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

function uniqueEmail(prefix = 'feed') {
  return `${prefix}-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`;
}
function uniqueUsername(prefix = 'feed') {
  return `${prefix}${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
}

describe('feedShopController integration', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Feed',
        lastName: 'Tester',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }, 30000);

  // ─── GET /api/feed-shop/catalog ───────────────────────────────────────────

  describe('GET /api/feed-shop/catalog', () => {
    it('returns 200 with catalog array', async () => {
      const res = await request(app)
        .get('/api/feed-shop/catalog')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('catalog items have required fields', async () => {
      const res = await request(app)
        .get('/api/feed-shop/catalog')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      const first = res.body.data[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('packPrice');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/feed-shop/catalog').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/feed-shop/purchase ─────────────────────────────────────────

  describe('POST /api/feed-shop/purchase', () => {
    it('returns 200 and reduces money on successful purchase', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/feed-shop/purchase')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ feedTier: 'basic', packs: 1 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('remainingMoney');
      // basic pack costs 100; started with 5000 → 4900
      expect(res.body.data.remainingMoney).toBe(4900);
      expect(res.body.data.inventoryItem.id).toBe('feed-basic');
      expect(res.body.data.inventoryItem.quantity).toBe(100);
    });

    it('returns 200 with stacked quantity when purchasing same tier twice', async () => {
      const csrf1 = await fetchCsrf(app);
      await request(app)
        .post('/api/feed-shop/purchase')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf1.cookieHeader)
        .set('X-CSRF-Token', csrf1.csrfToken)
        .send({ feedTier: 'basic', packs: 1 });

      const csrf2 = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/feed-shop/purchase')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf2.cookieHeader)
        .set('X-CSRF-Token', csrf2.csrfToken)
        .send({ feedTier: 'basic', packs: 2 });

      expect(res.status).toBe(200);
      // After 1st purchase: 100 units. After 2nd: 100 + 200 = 300 units
      expect(res.body.data.inventoryItem.quantity).toBe(300);
    });

    it('returns 404 for unknown feed tier', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/feed-shop/purchase')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ feedTier: 'legendary', packs: 1 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for invalid packs value', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/feed-shop/purchase')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ feedTier: 'basic', packs: 0 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when user has insufficient funds', async () => {
      await prisma.user.update({ where: { id: user.id }, data: { money: 0 } });

      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/feed-shop/purchase')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ feedTier: 'basic', packs: 1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/feed-shop/purchase')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ feedTier: 'basic', packs: 1 });

      expect(res.status).toBe(401);
    });
  });
});
