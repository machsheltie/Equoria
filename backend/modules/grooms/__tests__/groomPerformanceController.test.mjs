/**
 * groomPerformanceController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: recordPerformance, getGroomPerformance, getTopPerformers,
 * getPerformanceConfig, getGroomAnalytics.
 * Routes live under authRouter at /api/groom-performance.
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
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `gperf-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `gperf${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GPERF',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-PerfGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/groom-performance/config ───────────────────────────────────────

describe('GET /api/groom-performance/config', () => {
  it('returns 200 with performance configuration', async () => {
    const res = await request(app)
      .get('/api/v1/groom-performance/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('reputationRanges');
    expect(res.body.data).toHaveProperty('metricWeights');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-performance/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-performance/top ──────────────────────────────────────────

describe('GET /api/groom-performance/top', () => {
  it('returns 200 with top performers list', async () => {
    const res = await request(app)
      .get('/api/v1/groom-performance/top')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('grooms');
    expect(Array.isArray(res.body.data.grooms)).toBe(true);
  });

  it('returns 400 for invalid limit query param (> 20)', async () => {
    const res = await request(app)
      .get('/api/v1/groom-performance/top?limit=999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-performance/top').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-performance/groom/:groomId ───────────────────────────────

describe('GET /api/groom-performance/groom/:groomId', () => {
  it('returns 200 with performance summary for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/groom-performance/groom/${groom.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 for non-numeric groomId', async () => {
    const res = await request(app)
      .get('/api/v1/groom-performance/groom/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/groom-performance/groom/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/groom-performance/groom/${groom.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-performance/analytics/:groomId ───────────────────────────

describe('GET /api/groom-performance/analytics/:groomId', () => {
  it('returns 200 with analytics for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/groom-performance/analytics/${groom.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/groom-performance/analytics/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/groom-performance/analytics/${groom.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/groom-performance/record ──────────────────────────────────────

describe('POST /api/groom-performance/record', () => {
  it('returns 201 when recording valid performance for owned groom', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-performance/record')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: groom.id,
        interactionType: 'grooming',
        bondGain: 1.5,
        taskSuccess: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when groomId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-performance/record')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ interactionType: 'grooming' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-performance/record')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: groom.id, interactionType: 'grooming' });

    expect(res.status).toBe(401);
  });
});
