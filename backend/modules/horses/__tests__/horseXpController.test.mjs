/**
 * horseXpController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getHorseXpStatus, getHorseXpHistory, awardXpToHorse, allocateStatPoint.
 * Routes live under authRouter at /api/horses/:id/xp, /xp-history, /award-xp,
 * /allocate-stat.
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
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `hxp-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `hxp${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'HXP',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-XpHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/horses/:id/xp ───────────────────────────────────────────────────

describe('GET /api/horses/:id/xp', () => {
  it('returns 200 with XP status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentXP');
    expect(res.body.data).toHaveProperty('availableStatPoints');
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/xp')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/horses/${horse.id}/xp`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/horses/:id/xp-history ──────────────────────────────────────────

describe('GET /api/horses/:id/xp-history', () => {
  it('returns 200 with XP history for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse.id}/xp-history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/xp-history')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/horses/${horse.id}/xp-history`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/horses/:id/award-xp ───────────────────────────────────────────

describe('POST /api/horses/:id/award-xp', () => {
  it('returns 200 when awarding valid XP to owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50, reason: 'integration-test award' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentXP');
    expect(res.body.data).toHaveProperty('xpGained');
  });

  it('returns 400 when amount is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ reason: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when reason is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/999999999/award-xp')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50, reason: 'test' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50, reason: 'test' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/horses/:id/allocate-stat ──────────────────────────────────────

describe('POST /api/horses/:id/allocate-stat', () => {
  it('returns 400 when statName is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an invalid statName', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'notastat' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when horse has no available stat points', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'speed' });

    // New horse with 0 availableStatPoints → 400
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/999999999/allocate-stat')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'speed' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'speed' });

    expect(res.status).toBe(401);
  });
});
