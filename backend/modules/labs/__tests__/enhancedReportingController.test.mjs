/**
 * enhancedReportingRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: enhanced-trait-history, epigenetic-insights, trait-timeline,
 *         stable-epigenetic-report, compare-epigenetics, epigenetic-report-export.
 * Routes are mounted at '/' in authRouter (backend/app/routers.mjs:183), and
 * authRouter is mounted at /api/v1 (backend/app.mjs:290), so paths are
 * /api/v1/horses/:id/..., /api/v1/users/:id/... (Equoria-vivsi: the unversioned
 * /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the canonical surface).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-twmpa: fail-loud scoped cleanup. A swallowed cleanup .catch hides a
// leaked fixture in the canonical DB (CLAUDE.md §2); the tracker re-throws so
// the suite goes red at the source. traitHistoryLog -> horses -> user
// (Horse.userId onDelete: Restrict, schema:282).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse1;
let horse2;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `enhreport-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `enhreport${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EnhReport',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse1 = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ReportHorse1-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  horse2 = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ReportHorse2-${Date.now()}`,
      sex: 'Colt',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });
  cleanup.add(
    () => prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: [horse1.id, horse2.id] } } }),
    'traitHistoryLog',
  );
  cleanup.add(
    () => prisma.horse.deleteMany({ where: { id: { in: [horse1.id, horse2.id] } } }),
    'horses',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/horses/:id/enhanced-trait-history ────────────────────────────

describe('GET /api/horses/:id/enhanced-trait-history', () => {
  it('returns 200 with trait history data for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse1.id}/enhanced-trait-history`)
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
      .get('/api/v1/horses/999999999/enhanced-trait-history')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse1.id}/enhanced-trait-history`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/horses/:id/epigenetic-insights ───────────────────────────────

describe('GET /api/horses/:id/epigenetic-insights', () => {
  it('returns 200 with epigenetic insights for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse1.id}/epigenetic-insights`)
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
      .get('/api/v1/horses/999999999/epigenetic-insights')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse1.id}/epigenetic-insights`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/horses/:id/trait-timeline ────────────────────────────────────

describe('GET /api/horses/:id/trait-timeline', () => {
  it('returns 200 with trait timeline for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse1.id}/trait-timeline`)
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
      .get('/api/v1/horses/999999999/trait-timeline')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse1.id}/trait-timeline`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/users/:id/stable-epigenetic-report ──────────────────────────

describe('GET /api/users/:id/stable-epigenetic-report', () => {
  it('returns 200 with stable report for own user ID', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${user.id}/stable-epigenetic-report`)
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
      .get('/api/v1/users/other-user-uuid-that-is-not-mine/stable-epigenetic-report')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/users/${user.id}/stable-epigenetic-report`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/horses/compare-epigenetics ──────────────────────────────────

describe('POST /api/horses/compare-epigenetics', () => {
  it('returns 200 when comparing two owned horses', async () => {
    // Equoria-vivsi: per-user CSRF binding — token must be issued under the
    // same sessionIdentifier (req.user.id) the Bearer-authed mutation resolves
    // to. Forward the access cookie so getCsrfToken's
    // tryPopulateUserFromAccessCookie binds the token to user.id; otherwise
    // issuance falls back to the salt and validation 403s (csrf.mjs:95-108).
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/compare-epigenetics')
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
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/compare-epigenetics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse1.id] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when horseIds include non-owned horses', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/compare-epigenetics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [999999998, 999999999] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken: authenticateToken reads the
    // access cookie FIRST (auth.mjs:83) and runs before csrfProtection
    // (routers.mjs:93,95), so a no-auth request 401s before CSRF validation.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/horses/compare-epigenetics')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse1.id, horse2.id] });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/horses/:id/epigenetic-report-export ─────────────────────────

describe('GET /api/horses/:id/epigenetic-report-export', () => {
  it('returns 200 with default (detailed) format for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse1.id}/epigenetic-report-export`)
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
      .get(`/api/v1/horses/${horse1.id}/epigenetic-report-export?format=summary`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.format).toBe('summary');
  });

  it('returns 400 for invalid format value', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse1.id}/epigenetic-report-export?format=invalid`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/horses/999999999/epigenetic-report-export')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse1.id}/epigenetic-report-export`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
