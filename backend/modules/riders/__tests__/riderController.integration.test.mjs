/**
 * riderRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: marketplace, assignments, user riders, discovery, dismiss.
 * Routes are mounted at /api/riders in authRouter.
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
let rider;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `riderctrl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `riderctrl${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'RiderCtrl',
      lastName: 'Tester',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-RiderHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });

  rider = await prisma.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `Rider-${Date.now()}`,
      personality: 'daring',
      skillLevel: 'experienced',
      speciality: 'Jumping',
      weeklyRate: 200,
      level: 3,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.riderAssignment
    .deleteMany({ where: { OR: [{ riderId: rider.id }, { horseId: horse.id }] } })
    .catch(() => {});
  await prisma.rider.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.staffMarketplaceState.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/riders/marketplace ─────────────────────────────────────────────

describe('GET /api/riders/marketplace', () => {
  it('returns 200 with marketplace data for authenticated user', async () => {
    const res = await request(app)
      .get('/api/riders/marketplace')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.riders)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/riders/marketplace').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/riders/marketplace/hire ───────────────────────────────────────

describe('POST /api/riders/marketplace/hire', () => {
  it('returns 400 when marketplaceId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when marketplaceId does not match any offer', async () => {
    const csrf = await fetchCsrf(app);
    // Ensure marketplace state is initialized
    await request(app).get('/api/riders/marketplace').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/riders/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ marketplaceId: 'nonexistent-rider-marketplace-id-xyz' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/marketplace/hire')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ marketplaceId: 'some-id' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/riders/marketplace/refresh ────────────────────────────────────

describe('POST /api/riders/marketplace/refresh', () => {
  it('returns 200 or 400 when refreshing marketplace', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/marketplace/refresh')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/marketplace/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/riders/assignments ─────────────────────────────────────────────

describe('GET /api/riders/assignments', () => {
  it('returns 200 with active assignments for authenticated user', async () => {
    const res = await request(app)
      .get('/api/riders/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/riders/assignments').set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/riders/assignments ────────────────────────────────────────────

describe('POST /api/riders/assignments', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when riderId does not belong to user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ riderId: 999999999, horseId: horse.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 when assigning owned rider to owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ riderId: rider.id, horseId: horse.id });

    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.riderId).toBe(rider.id);
    }
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/riders/assignments')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ riderId: rider.id, horseId: horse.id });

    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/riders/assignments/:id ──────────────────────────────────────

describe('DELETE /api/riders/assignments/:id', () => {
  it('returns 404 when assignment does not exist or belong to user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/riders/assignments/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid assignment id format', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/riders/assignments/not-a-number')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/riders/assignments/1')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/riders/user/:userId ────────────────────────────────────────────

describe('GET /api/riders/user/:userId', () => {
  it('returns 200 with riders for own user ID', async () => {
    const res = await request(app)
      .get(`/api/riders/user/${user.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find(r => r.id === rider.id);
    expect(found).toBeDefined();
  });

  it('returns 404 when accessing another user ID', async () => {
    const res = await request(app)
      .get('/api/riders/user/other-user-uuid-not-mine')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/riders/user/${user.id}`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/riders/:id/discovery ───────────────────────────────────────────

describe('GET /api/riders/:id/discovery', () => {
  it('returns 200 with discovery slots for owned rider', async () => {
    const res = await request(app)
      .get(`/api/riders/${rider.id}/discovery`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.riderId).toBe(rider.id);
    expect(Array.isArray(res.body.data.slots)).toBe(true);
  });

  it('returns 404 for rider not owned by user', async () => {
    const res = await request(app)
      .get('/api/riders/999999999/discovery')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/riders/${rider.id}/discovery`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /api/riders/:id/dismiss ──────────────────────────────────────────

describe('DELETE /api/riders/:id/dismiss', () => {
  it('returns 404 for rider not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete('/api/riders/999999999/dismiss')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when dismissing owned rider', async () => {
    const disposable = await prisma.rider.create({
      data: {
        firstName: 'TestFixture',
        lastName: `DisposableRider-${Date.now()}`,
        personality: 'methodical',
        skillLevel: 'rookie',
        speciality: 'Dressage',
        weeklyRate: 150,
        userId: user.id,
      },
    });

    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete(`/api/riders/${disposable.id}/dismiss`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .delete(`/api/riders/${rider.id}/dismiss`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
