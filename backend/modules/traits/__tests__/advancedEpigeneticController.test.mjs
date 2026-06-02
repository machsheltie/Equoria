/**
 * advancedEpigeneticRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers all 15 horse-specific epigenetic analysis endpoints.
 * Routes are mounted at '/' in authRouter so paths are /api/v1/horses/:id/<endpoint>.
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
      email: `advepi-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `advepi${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'AdvEpi',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-AdvEpiHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). Horse before user for FK
  // ordering (Horse.userId onDelete:Restrict).
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// Shared auth/ownership guards — test once, apply to representative endpoints

describe('Auth and ownership guards (representative)', () => {
  it('returns 401 without auth on GET /environmental-analysis', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse.id}/environmental-analysis`).set('Origin', ORIGIN);
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-owned horse on GET /environmental-analysis', async () => {
    const res = await request(app)
      .get('/api/v1/horses/999999999/environmental-analysis')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

// ─── GET endpoints ────────────────────────────────────────────────────────────

describe('GET /api/v1/horses/:id/environmental-analysis', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/environmental-analysis`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/v1/horses/:id/environmental-triggers', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/environmental-triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-owned horse', async () => {
    const res = await request(app)
      .get('/api/v1/horses/999999999/environmental-triggers')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/horses/:id/trigger-thresholds', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/trigger-thresholds`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/horses/:id/environmental-forecast', () => {
  it('returns 200 for owned horse with default days', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/environmental-forecast`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid days param', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/environmental-forecast?days=999`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/v1/horses/:id/trait-interactions', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/trait-interactions`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/horses/:id/trait-matrix', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/trait-matrix`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/horses/:id/trait-stability', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/trait-stability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/horses/:id/developmental-windows', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/developmental-windows`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/horses/:id/developmental-milestones', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/developmental-milestones`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/horses/:id/developmental-forecast', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/developmental-forecast`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/horses/:id/critical-period-analysis', () => {
  it('returns 200 for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/critical-period-analysis`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── POST endpoints ───────────────────────────────────────────────────────────

describe('POST /api/v1/horses/:id/trait-expression-probability', () => {
  it('returns 400 when traitName is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/trait-expression-probability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with valid traitName for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/trait-expression-probability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/999999999/trait-expression-probability')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm' });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // No-auth request: bare CSRF (anonymous session). authenticateToken 401s
    // before csrfProtection runs, so no accessToken-bound token is needed.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/trait-expression-probability`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/horses/:id/evaluate-trait-opportunity', () => {
  it('returns 400 when required fields missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/evaluate-trait-opportunity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with valid body for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/evaluate-trait-opportunity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ traitName: 'calm', windowName: 'imprinting' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/horses/:id/window-sensitivity', () => {
  it('returns 400 when windowName is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/window-sensitivity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with valid windowName for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/window-sensitivity`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ windowName: 'imprinting' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/horses/:id/coordinate-development', () => {
  it('returns 200 for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/coordinate-development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/999999999/coordinate-development')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // No-auth request: bare CSRF (anonymous session). authenticateToken 401s
    // before csrfProtection runs, so no accessToken-bound token is needed.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/coordinate-development`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(401);
  });
});
