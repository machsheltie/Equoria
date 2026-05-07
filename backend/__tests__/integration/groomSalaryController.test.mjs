/**
 * groomSalaryController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getSalarySummary, getUserSalaryCost, getSalaryHistory, getCronStatus,
 * triggerSalaryProcessingEndpoint (admin-gated → 403 for regular users).
 * Routes live under authRouter at /api/groom-salaries.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `gsal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `gsal${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'GSAL',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
}, 30000);

afterAll(async () => {
  await prisma.groom.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/groom-salaries/summary ─────────────────────────────────────────

describe('GET /api/groom-salaries/summary', () => {
  it('returns 200 with salary summary for a new user', async () => {
    const res = await request(app)
      .get('/api/groom-salaries/summary')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentCost');
    expect(res.body.data).toHaveProperty('currentMoney');
    expect(res.body.data).toHaveProperty('weeksAffordable');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groom-salaries/summary').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-salaries/cost ────────────────────────────────────────────

describe('GET /api/groom-salaries/cost', () => {
  it('returns 200 with zero cost for user with no grooms', async () => {
    const res = await request(app)
      .get('/api/groom-salaries/cost')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groom-salaries/cost').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-salaries/history ─────────────────────────────────────────

describe('GET /api/groom-salaries/history', () => {
  it('returns 200 with empty payment history for new user', async () => {
    const res = await request(app)
      .get('/api/groom-salaries/history')
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
      .get('/api/groom-salaries/history?limit=999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groom-salaries/history').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-salaries/status ──────────────────────────────────────────

describe('GET /api/groom-salaries/status', () => {
  it('returns 200 with cron job status', async () => {
    const res = await request(app)
      .get('/api/groom-salaries/status')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groom-salaries/status').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/groom-salaries/process (admin-only) ───────────────────────────

describe('POST /api/groom-salaries/process', () => {
  it('returns 403 for a regular (non-admin) user', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/groom-salaries/process')
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
      .post('/api/groom-salaries/process')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});
