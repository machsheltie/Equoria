/**
 * groomSalaryController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getSalarySummary, getUserSalaryCost, getCronStatus. The manual payday
 * (POST /process) left this API for the Steward's Office (q262, Equoria-opdt7).
 * Equoria-a7f1p (owner ruling 2026-10-28, q151): the history case went with that duplicate lookup.
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

// ─── POST /api/groom-salaries/process (removed) ──────────────────────────────
// Old contract: an admin-gated manual payday here (403 for a player, 401 signed out).
// Owner ruling 2026-10-28 (q262, Equoria-opdt7): the manual payday is the Owner's
// alone, behind the emailed staff check-in, at POST /api/v1/staff/payroll/grooms/run
// (modules/staff/__tests__/staffPayrollRunAuthz.integration.test.mjs). The old path is gone.

describe('POST /api/groom-salaries/process', () => {
  it('no longer exists for a signed-in player', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: `accessToken=${token}` });
    const res = await request(app)
      .post('/api/v1/groom-salaries/process')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
  });
});
