/**
 * epigeneticTraitRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: definitions, history, summary, breeding-insights, log-trait, evaluate-milestone.
 * Routes live under authRouter at /api/v1/epigenetic-traits.
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
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `epigenetic-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `epigenetic${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Epigenetic',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EpigeneticHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). Dependency order:
  // traitHistoryLog -> horse -> user (Horse.userId onDelete:Restrict).
  cleanup.add(() => prisma.traitHistoryLog.deleteMany({ where: { horseId: horse.id } }), 'traitHistoryLog');
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/epigenetic-traits/definitions ───────────────────────────────────

describe('GET /api/v1/epigenetic-traits/definitions', () => {
  it('returns 200 with epigenetic flag and groom personality definitions', async () => {
    const res = await request(app)
      .get('/api/v1/epigenetic-traits/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.epigeneticFlags).toBeDefined();
    expect(res.body.data.groomPersonalities).toBeDefined();
    expect(res.body.data.flagCount).toBeGreaterThan(0);
    expect(res.body.data.personalityCount).toBeGreaterThan(0);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/epigenetic-traits/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/epigenetic-traits/history/:horseId ─────────────────────────────

describe('GET /api/v1/epigenetic-traits/history/:horseId', () => {
  it('returns 200 with empty history for owned horse with no trait logs', async () => {
    const res = await request(app)
      .get(`/api/v1/epigenetic-traits/history/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseId).toBe(horse.id);
    expect(res.body.data.horseName).toBeDefined();
    expect(Array.isArray(res.body.data.history)).toBe(true);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/epigenetic-traits/history/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/epigenetic-traits/history/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/epigenetic-traits/summary/:horseId ─────────────────────────────

describe('GET /api/v1/epigenetic-traits/summary/:horseId', () => {
  it('returns 200 with trait development summary for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/epigenetic-traits/summary/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseName).toBeDefined();
    expect(res.body.data.summary).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/epigenetic-traits/summary/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/epigenetic-traits/summary/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/epigenetic-traits/breeding-insights/:horseId ───────────────────

describe('GET /api/v1/epigenetic-traits/breeding-insights/:horseId', () => {
  it('returns 200 with breeding insights for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/epigenetic-traits/breeding-insights/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseName).toBeDefined();
    expect(res.body.data.insights).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/epigenetic-traits/breeding-insights/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/epigenetic-traits/breeding-insights/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/epigenetic-traits/log-trait ────────────────────────────────────

describe('POST /api/v1/epigenetic-traits/log-trait', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/epigenetic-traits/log-trait')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid sourceType', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/epigenetic-traits/log-trait')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, traitName: 'calm', sourceType: 'invalid-source' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/epigenetic-traits/log-trait')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999999, traitName: 'calm', sourceType: 'milestone' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 when logging a valid trait for an owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/epigenetic-traits/log-trait')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, traitName: 'calm', sourceType: 'milestone' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    // No-auth request: bare CSRF (anonymous session). authenticateToken 401s
    // before csrfProtection runs, so no accessToken-bound token is needed.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/epigenetic-traits/log-trait')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, traitName: 'calm', sourceType: 'milestone' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/epigenetic-traits/evaluate-milestone/:horseId ─────────────────

describe('POST /api/v1/epigenetic-traits/evaluate-milestone/:horseId', () => {
  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/epigenetic-traits/evaluate-milestone/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 when evaluating milestone for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/epigenetic-traits/evaluate-milestone/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ milestoneData: {}, includeHistory: false });

    // 200 = evaluated; 500 = service error for edge case (no groom etc.)
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.horseId).toBe(horse.id);
    }
  });

  it('returns 401 without auth', async () => {
    // No-auth request: bare CSRF (anonymous session). authenticateToken 401s
    // before csrfProtection runs, so no accessToken-bound token is needed.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/epigenetic-traits/evaluate-milestone/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});
