/**
 * groomAssignmentController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getMyAssignments, statistics endpoint, createGroomAssignment validation.
 * Equoria-a7f1p (owner ruling 2026-10-28, q151): the salary-costs, dashboard, config and validate
 * cases went with those duplicate lookup routes.
 * Routes live under authRouter at /api/groom-assignments.
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
      email: `ga-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `ga${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GA',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: assignments, then
  // grooms, then the user row (all userId-scoped). A failed delete fails the
  // suite instead of being swallowed and leaking a fixture into the canonical DB.
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: user.id } }), 'assignments');
  cleanup.add(() => prisma.groom.deleteMany({ where: { userId: user.id } }), 'grooms');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/groom-assignments ───────────────────────────────────────────────

describe('GET /api/groom-assignments', () => {
  it('returns 200 with empty assignments for new user', async () => {
    const res = await request(app)
      .get('/api/v1/groom-assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('assignments');
    expect(Array.isArray(res.body.data.assignments)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-assignments').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/groom-assignments (createGroomAssignment) ──────────────────────

describe('POST /api/groom-assignments', () => {
  it('returns 400 when groomId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/groom-assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/groom-assignments')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: 1 });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-assignments')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: 1, horseId: 1 });

    expect(res.status).toBe(401);
  });
});
