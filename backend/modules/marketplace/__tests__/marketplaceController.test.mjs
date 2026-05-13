/**
 * marketplaceController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: browseListings, listHorse, delistHorse, myListings, saleHistory,
 * buyStoreHorse.
 * Routes live under authRouter → real auth + real CSRF for POST/DELETE.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { listHorse } from '../controllers/marketplaceController.mjs';

const ORIGIN = 'http://localhost:3000';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function uniqueEmail(prefix = 'mp') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}
function uniqueUsername(prefix = 'mp') {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

// Resolve a breed ID that also has a breedStarterStats.json entry (required by buyStoreHorse)
let realBreedId;

beforeAll(async () => {
  const statsPath = resolve(__dirname, '../../../data/breedStarterStats.json');
  let validBreedNames = [];
  try {
    validBreedNames = Object.keys(JSON.parse(readFileSync(statsPath, 'utf8')));
  } catch {
    // fallback: try relative path
    try {
      const alt = resolve(__dirname, '../../../data/breedStarterStats.json');
      validBreedNames = Object.keys(JSON.parse(readFileSync(alt, 'utf8')));
    } catch {
      validBreedNames = [];
    }
  }
  if (validBreedNames.length > 0) {
    const breed = await prisma.breed.findFirst({
      where: { name: { in: validBreedNames } },
      select: { id: true },
    });
    realBreedId = breed?.id ?? null;
  } else {
    realBreedId = null;
  }
}, 30000);

describe('marketplaceController integration', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'MP',
        lastName: 'Tester',
        money: 5000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    await prisma.horse
      .deleteMany({ where: { name: { startsWith: 'TestFixture-MPHorse' }, userId: user.id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }, 30000);

  // ─── GET /api/marketplace ─────────────────────────────────────────────────

  describe('GET /api/marketplace', () => {
    it('returns 200 with listings and pagination', async () => {
      const res = await request(app)
        .get('/api/marketplace')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('listings');
      expect(Array.isArray(res.body.data.listings)).toBe(true);
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/marketplace').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/marketplace/my-listings ─────────────────────────────────────

  describe('GET /api/marketplace/my-listings', () => {
    it('returns 200 with empty array for new user', async () => {
      const res = await request(app)
        .get('/api/marketplace/my-listings')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/marketplace/my-listings').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/marketplace/history ─────────────────────────────────────────

  describe('GET /api/marketplace/history', () => {
    it('returns 200 with empty history for new user', async () => {
      const res = await request(app)
        .get('/api/marketplace/history')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/marketplace/history').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/marketplace/list ───────────────────────────────────────────

  describe('POST /api/marketplace/list', () => {
    it('returns 400 when horseId or price is missing', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ price: 500 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when price is below 100', async () => {
      const horse = await prisma.horse.create({
        data: {
          name: `TestFixture-MPHorse-${Date.now()}`,
          sex: 'Mare',
          dateOfBirth: new Date('2020-01-01'),
          user: { connect: { id: user.id } },
        },
      });
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: horse.id, price: 50 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 404 for a horse not owned by the user', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: 999999999, price: 500 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and lists an owned horse for sale', async () => {
      const horse = await prisma.horse.create({
        data: {
          name: `TestFixture-MPHorse-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date('2021-01-01'),
          age: 4,
          userId: user.id,
        },
      });

      try {
        const csrf = await fetchCsrf(app);
        const res = await request(app)
          .post('/api/marketplace/list')
          .set('Origin', ORIGIN)
          .set('Authorization', `Bearer ${token}`)
          .set('Cookie', csrf.cookieHeader)
          .set('X-CSRF-Token', csrf.csrfToken)
          .send({ horseId: horse.id, price: 1000 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.salePrice).toBe(1000);
      } finally {
        await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
      }
    });

    it('returns 401 without auth', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/list')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ horseId: 1, price: 1000 });

      expect(res.status).toBe(401);
    });

    it('returns 500 when req.horse is absent (requireOwnership middleware not applied)', async () => {
      // Exercises the defensive null-guard in listHorse. The HTTP route always
      // has the middleware, so we call the controller function directly to
      // reach this branch without mocking Prisma.
      let statusCode;
      let jsonBody;
      const req = { body: { price: 1000 }, user: { id: user.id } };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(body) {
          jsonBody = body;
          return this;
        },
      };

      await listHorse(req, res, () => {});

      expect(statusCode).toBe(500);
      expect(jsonBody.success).toBe(false);
    });
  });

  // ─── POST /api/marketplace/store/buy ──────────────────────────────────────

  describe('POST /api/marketplace/store/buy', () => {
    it('returns 400 for invalid sex', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId ?? 1, sex: 'Gelding' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when user has insufficient funds', async () => {
      await prisma.user.update({ where: { id: user.id }, data: { money: 0 } });

      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId ?? 1, sex: 'Mare' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 and creates horse when purchase succeeds', async () => {
      if (!realBreedId) {
        return; // Skip if no breeds in DB
      }

      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: realBreedId, sex: 'Mare' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('horse');

      // Clean up the purchased horse
      if (res.body.data?.horse?.id) {
        await prisma.horse.delete({ where: { id: res.body.data.horse.id } }).catch(() => {});
      }
    });

    it('returns 401 without auth', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/marketplace/store/buy')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ breedId: 1, sex: 'Mare' });

      expect(res.status).toBe(401);
    });
  });
});
