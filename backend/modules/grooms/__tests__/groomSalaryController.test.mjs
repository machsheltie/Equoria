/**
 * groomSalaryController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getSalarySummary, getUserSalaryCost, getSalaryHistory, getCronStatus,
 * triggerSalaryProcessingEndpoint (admin-gated → 403 for regular users).
 * Routes live under authRouter at /api/groom-salaries.
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
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `gsal-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `gsal${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GSAL',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // Scoped, fail-loud cleanup (Equoria-1ohys): swallowed catch arms replaced by
  // the tracker so a failed delete fails the suite. FK order — grooms (scoped
  // by userId) before the user (Groom.userId is Restrict).
  cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'groom');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/groom-salaries/summary ─────────────────────────────────────────

describe('GET /api/groom-salaries/summary', () => {
  it('returns 200 with salary summary for a new user', async () => {
    const res = await request(app)
      .get('/api/v1/groom-salaries/summary')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentCost');
    expect(res.body.data).toHaveProperty('currentMoney');
    expect(res.body.data).toHaveProperty('weeksAffordable');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-salaries/summary').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-salaries/cost ────────────────────────────────────────────

describe('GET /api/groom-salaries/cost', () => {
  it('returns 200 with zero cost for user with no grooms', async () => {
    const res = await request(app)
      .get('/api/v1/groom-salaries/cost')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-salaries/cost').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-salaries/history ─────────────────────────────────────────

describe('GET /api/groom-salaries/history', () => {
  it('returns 200 with empty payment history for new user', async () => {
    const res = await request(app)
      .get('/api/v1/groom-salaries/history')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('payments');
    expect(Array.isArray(res.body.data.payments)).toBe(true);
    expect(res.body.data).toHaveProperty('count');
  });

  it('returns 400 for invalid limit query param (> 100)', async () => {
    const res = await request(app)
      .get('/api/v1/groom-salaries/history?limit=999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-salaries/history').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-salaries/status ──────────────────────────────────────────

describe('GET /api/groom-salaries/status', () => {
  it('returns 200 with cron job status', async () => {
    const res = await request(app)
      .get('/api/v1/groom-salaries/status')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-salaries/status').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/groom-salaries/process (admin-only) ───────────────────────────

describe('POST /api/groom-salaries/process', () => {
  it('returns 403 for a regular (non-admin) user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-salaries/process')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-salaries/process')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});
