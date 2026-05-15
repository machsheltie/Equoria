/**
 * foalRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: development, activity, advance-day, enrichment, graduate.
 * Routes are mounted at /api/foals in authRouter.
 * A "foal" is a Horse with age <= 1.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let foal;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `foal-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `foal${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Foal',
      lastName: 'Tester',
      money: 10000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  foal = await prisma.horse.create({
    data: {
      name: `TestFixture-Foal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.foalActivity.deleteMany({ where: { foalId: foal.id } }).catch(() => {});
  await prisma.foalDevelopment.deleteMany({ where: { foalId: foal.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: foal.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/foals/:foalId/development ──────────────────────────────────────

describe('GET /api/foals/:foalId/development', () => {
  it('returns 200 with development data for owned foal', async () => {
    const res = await request(app)
      .get(`/api/foals/${foal.id}/development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for foal not owned by user', async () => {
    const res = await request(app)
      .get('/api/foals/999999999/development')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/foals/${foal.id}/development`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/foals/:foalId/activity ────────────────────────────────────────

describe('POST /api/foals/:foalId/activity', () => {
  it('returns 400 when activityType is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/activity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for foal not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/foals/999999999/activity')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ activityType: 'grooming' });

    expect(res.status).toBe(404);
  });

  it('returns 200, 400, or 404 when submitting activity for owned foal', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/activity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ activityType: 'grooming' });

    expect([200, 400, 404]).toContain(res.status);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/activity`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ activityType: 'grooming' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/foals/:foalId/advance-day ─────────────────────────────────────

describe('POST /api/foals/:foalId/advance-day', () => {
  it('returns 200 or 400 when advancing day for owned foal', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/advance-day`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect([200, 400]).toContain(res.status);
  });

  it('returns 404 for foal not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/foals/999999999/advance-day')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/advance-day`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/foals/:foalId/enrichment ──────────────────────────────────────

describe('POST /api/foals/:foalId/enrichment', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/enrichment`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when day is out of range', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/enrichment`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ day: 99, activity: 'play' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for foal not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/foals/999999999/enrichment')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ day: 0, activity: 'play' });

    expect(res.status).toBe(404);
  });

  it('returns 200 or 400 for valid enrichment request on owned foal', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/enrichment`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ day: 0, activity: 'play' });

    expect([200, 400]).toContain(res.status);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/enrichment`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ day: 0, activity: 'play' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/foals/:foalId/graduate ────────────────────────────────────────

describe('POST /api/foals/:foalId/graduate', () => {
  it('returns 400 when foal has not reached graduation age', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/graduate`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for foal not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/foals/999999999/graduate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/foals/${foal.id}/graduate`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
  });
});
