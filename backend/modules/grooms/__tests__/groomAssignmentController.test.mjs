/**
 * groomAssignmentController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getMyAssignments, getSalaryCosts, getAssignmentDashboard,
 * config endpoint, statistics endpoint, createGroomAssignment validation,
 * validateAssignment.
 * Routes live under authRouter at /api/groom-assignments.
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
}, 30000);

afterAll(async () => {
  await prisma.groomAssignment.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.groom.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

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

// ─── GET /api/groom-assignments/salary-costs ──────────────────────────────────

describe('GET /api/groom-assignments/salary-costs', () => {
  it('returns 200 with zero costs for user with no assignments', async () => {
    const res = await request(app)
      .get('/api/v1/groom-assignments/salary-costs')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalWeeklyCost');
    expect(res.body.data.totalWeeklyCost).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-assignments/salary-costs').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-assignments/dashboard ─────────────────────────────────────

describe('GET /api/groom-assignments/dashboard', () => {
  it('returns 200 with dashboard data', async () => {
    const res = await request(app)
      .get('/api/v1/groom-assignments/dashboard')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-assignments/dashboard').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-assignments/config ────────────────────────────────────────

describe('GET /api/groom-assignments/config', () => {
  it('returns 200 with assignment configuration', async () => {
    const res = await request(app)
      .get('/api/v1/groom-assignments/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('maxAssignmentsBySkill');
    expect(res.body.data).toHaveProperty('weeklySalaryBySkill');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-assignments/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-assignments/statistics ────────────────────────────────────

describe('GET /api/groom-assignments/statistics', () => {
  it('returns 200 with statistics data', async () => {
    const res = await request(app)
      .get('/api/v1/groom-assignments/statistics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/groom-assignments/statistics').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/groom-assignments (createGroomAssignment) ──────────────────────

describe('POST /api/groom-assignments', () => {
  it('returns 400 when groomId is missing', async () => {
    const csrf = await fetchCsrf(app);
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
    const csrf = await fetchCsrf(app);
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

// ─── POST /api/groom-assignments/validate ─────────────────────────────────────

describe('POST /api/groom-assignments/validate', () => {
  it('returns 400 when groomId and horseId are missing from body', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-assignments/validate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/groom-assignments/validate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: 1, horseId: 1 });

    expect(res.status).toBe(401);
  });
});
