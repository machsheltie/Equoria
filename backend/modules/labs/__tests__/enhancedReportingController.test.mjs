/**
 * enhancedReportingRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: enhanced-trait-history, epigenetic-insights, trait-timeline,
 *         stable-epigenetic-report, compare-epigenetics, epigenetic-report-export.
 * Routes are mounted at '/' in authRouter so paths are /api/horses/:id/..., /api/users/:id/...
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
let horse1;
let horse2;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `enhreport-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `enhreport${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'EnhReport',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse1 = await prisma.horse.create({
    data: {
      name: `TestFixture-ReportHorse1-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  horse2 = await prisma.horse.create({
    data: {
      name: `TestFixture-ReportHorse2-${Date.now()}`,
      sex: 'Colt',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.traitHistoryLog.deleteMany({ where: { horseId: horse1.id } }).catch(() => {});
  await prisma.traitHistoryLog.deleteMany({ where: { horseId: horse2.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse1.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse2.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/horses/:id/enhanced-trait-history ───────────────────────────────

describe('GET /api/horses/:id/enhanced-trait-history', () => {
  it('returns 200 with trait history data for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse1.id}/enhanced-trait-history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseId).toBe(horse1.id);
    expect(Array.isArray(res.body.data.traitHistory)).toBe(true);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/enhanced-trait-history')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/horses/${horse1.id}/enhanced-trait-history`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/horses/:id/epigenetic-insights ──────────────────────────────────

describe('GET /api/horses/:id/epigenetic-insights', () => {
  it('returns 200 with epigenetic insights for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse1.id}/epigenetic-insights`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseId).toBe(horse1.id);
    expect(res.body.data.recommendations).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/epigenetic-insights')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/horses/${horse1.id}/epigenetic-insights`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/horses/:id/trait-timeline ───────────────────────────────────────

describe('GET /api/horses/:id/trait-timeline', () => {
  it('returns 200 with trait timeline for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse1.id}/trait-timeline`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseId).toBe(horse1.id);
    expect(res.body.data.timeline).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/trait-timeline')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/horses/${horse1.id}/trait-timeline`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/users/:id/stable-epigenetic-report ─────────────────────────────

describe('GET /api/users/:id/stable-epigenetic-report', () => {
  it('returns 200 with stable report for own user ID', async () => {
    const res = await request(app)
      .get(`/api/users/${user.id}/stable-epigenetic-report`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.userId).toBeDefined();
    expect(res.body.data.stableOverview).toBeDefined();
  });

  it('returns 400 when accessing another users stable report', async () => {
    const res = await request(app)
      .get('/api/users/other-user-uuid-that-is-not-mine/stable-epigenetic-report')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/users/${user.id}/stable-epigenetic-report`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/horses/compare-epigenetics ─────────────────────────────────────

describe('POST /api/horses/compare-epigenetics', () => {
  it('returns 200 when comparing two owned horses', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/compare-epigenetics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse1.id, horse2.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.comparison).toBeDefined();
    expect(res.body.data.similarities).toBeDefined();
    expect(res.body.data.differences).toBeDefined();
  });

  it('returns 400 when fewer than 2 horse IDs provided', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/compare-epigenetics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse1.id] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when horseIds include non-owned horses', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/compare-epigenetics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [999999998, 999999999] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/horses/compare-epigenetics')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse1.id, horse2.id] });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/horses/:id/epigenetic-report-export ────────────────────────────

describe('GET /api/horses/:id/epigenetic-report-export', () => {
  it('returns 200 with default (detailed) format for owned horse', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse1.id}/epigenetic-report-export`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.metadata).toBeDefined();
    expect(res.body.data.metadata.horseId).toBe(horse1.id);
    expect(res.body.data.format).toBe('detailed');
  });

  it('returns 200 with summary format', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse1.id}/epigenetic-report-export?format=summary`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.format).toBe('summary');
  });

  it('returns 400 for invalid format value', async () => {
    const res = await request(app)
      .get(`/api/horses/${horse1.id}/epigenetic-report-export?format=invalid`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/horses/999999999/epigenetic-report-export')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/horses/${horse1.id}/epigenetic-report-export`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
