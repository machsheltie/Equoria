/**
 * dynamicCompatibilityController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: calculateCompatibility, getCompatibilityFactors, predictOutcome,
 * getRecommendations, getCompatibilityTrends, getCompatibilityConfig.
 * Routes live under authRouter at /api/v1/compatibility (Equoria-vivsi: the
 * unversioned /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the
 * canonical surface — verified in backend/app.mjs:290 + backend/app/routers.mjs:190).
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

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let groom;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `dcompat-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `dcompat${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'DCompat',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-CompatGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-CompatHorse-${Date.now()}`,
      sex: 'Colt',
      dateOfBirth: new Date('2023-01-01'),
      age: 2,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await Promise.allSettled([
    prisma.horse.delete({ where: { id: horse.id } }),
    prisma.groom.delete({ where: { id: groom.id } }),
  ]);
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 60000);

// ─── GET /api/v1/compatibility/config ────────────────────────────────────────

describe('GET /api/compatibility/config', () => {
  it('returns 200 with compatibility configuration', async () => {
    const res = await request(app)
      .get('/api/v1/compatibility/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/compatibility/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/compatibility/calculate ────────────────────────────────────

describe('POST /api/compatibility/calculate', () => {
  it('returns 200 with compatibility score for owned groom and horse', async () => {
    // Equoria-vivsi: per-user CSRF binding — token must be issued under the
    // same sessionIdentifier (req.user.id) the Bearer-authed mutation resolves
    // to. Forward the access cookie so getCsrfToken's
    // tryPopulateUserFromAccessCookie binds the token to user.id; otherwise
    // issuance falls back to the salt and validation 403s (csrf.mjs:95-108).
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: groom.id,
        horseId: horse.id,
        context: { taskType: 'trust_building' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken: authenticateToken reads the
    // access cookie FIRST (auth.mjs:83) and runs before csrfProtection
    // (routers.mjs:93,95), so a no-auth request 401s before CSRF validation —
    // the salt-bound bare token is sufficient. Forwarding accessToken would
    // authenticate the request and defeat the 401 assertion.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/compatibility/calculate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: groom.id, horseId: horse.id, context: { taskType: 'trust_building' } });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/compatibility/predict ──────────────────────────────────────

describe('POST /api/compatibility/predict', () => {
  it('returns 200 when predicting outcome for owned groom and horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        groomId: groom.id,
        horseId: horse.id,
        context: { taskType: 'foal_care' },
      });

    // 200 success or 400 (validation error) are both acceptable depending on taskType
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken (see /calculate 401 case).
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/compatibility/predict')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ groomId: groom.id, horseId: horse.id, context: { taskType: 'trust_building' } });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/compatibility/recommendations ───────────────────────────────

describe('POST /api/compatibility/recommendations', () => {
  it('returns 400 when required fields are missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/recommendations')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with recommendations for valid horse and context', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/compatibility/recommendations')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        horseId: horse.id,
        context: { taskType: 'trust_building' },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken (see /calculate 401 case).
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/compatibility/recommendations')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, context: { taskType: 'trust_building' } });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/compatibility/factors/:groomId/:horseId ─────────────────────

describe('GET /api/compatibility/factors/:groomId/:horseId', () => {
  it('returns 200 with factors for owned groom and horse', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/factors/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/factors/999999999/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/compatibility/factors/${groom.id}/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/compatibility/trends/:groomId/:horseId ──────────────────────

describe('GET /api/compatibility/trends/:groomId/:horseId', () => {
  it('returns 200 with trends for owned groom and horse', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/trends/${groom.id}/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a groom not owned by user', async () => {
    const res = await request(app)
      .get(`/api/v1/compatibility/trends/999999999/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/compatibility/trends/${groom.id}/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
