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
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let groom;
let csrf;
const cleanup = createCleanupTracker();

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

  // Per-user CSRF binding (Equoria-plw0h): the CSRF token MUST be issued under
  // the same sessionIdentifier the authenticated mutation will resolve, or the
  // Bearer POSTs below 403 against an anonymous-salt token. Forwarding the
  // access token as a cookie on issuance lets getCsrfToken bind to user.id.
  csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-PerfGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys): swallowed catch arms replaced by
  // the tracker so a failed delete fails the suite. FK order — groom before
  // user (Groom.userId is Restrict). Deleting the groom by id cascades its
  // GroomPerformanceRecord children (groomId is onDelete: Cascade).
  cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

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
    // Anonymous CSRF token here on purpose: this request carries NO access
    // token, so authenticateToken must reject with 401 before csrfProtection
    // runs. Reusing the user-bound `csrf` would smuggle an accessToken cookie
    // and authenticate the request, defeating the assertion.
    const anonCsrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-performance/record')
      .set('Origin', ORIGIN)
      .set('Cookie', anonCsrf.cookieHeader)
      .set('X-CSRF-Token', anonCsrf.csrfToken)
      .send({ groomId: groom.id, interactionType: 'grooming' });

    expect(res.status).toBe(401);
  });
});
