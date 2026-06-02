/**
 * environmentalRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: current conditions, forecast, calculate-impact, history, comfort-zone.
 * Routes live under authRouter at /api/v1/environment (Equoria-hsc6e: the
 * unversioned /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the
 * canonical surface — verified in backend/app.mjs:290 + backend/app/routers.mjs:189).
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
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `environ-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `environ${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Environ',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EnvironHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
      healthStatus: 'Good',
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/v1/environment/current ──────────────────────────────────────────

describe('GET /api/environment/current', () => {
  it('returns 200 with current environmental conditions (default location)', async () => {
    const res = await request(app)
      .get('/api/v1/environment/current')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.weather).toBeDefined();
    expect(res.body.data.seasonal).toBeDefined();
    expect(res.body.data.location).toBeDefined();
    expect(res.body.data.timestamp).toBeDefined();
  });

  it('returns 200 with valid region query param', async () => {
    const res = await request(app)
      .get('/api/v1/environment/current?region=tropical')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location.region).toBe('tropical');
  });

  it('returns 400 for invalid region value', async () => {
    const res = await request(app)
      .get('/api/v1/environment/current?region=invalid-region')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/environment/current').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/environment/forecast ─────────────────────────────────────────

describe('GET /api/environment/forecast', () => {
  it('returns 200 with weather forecast (default params)', async () => {
    const res = await request(app)
      .get('/api/v1/environment/forecast')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.forecast).toBeDefined();
    expect(res.body.data.location).toBeDefined();
    expect(res.body.data.days).toBeDefined();
    expect(res.body.data.generatedAt).toBeDefined();
  });

  it('returns 200 with custom days and region params', async () => {
    const res = await request(app)
      .get('/api/v1/environment/forecast?days=3&region=coastal')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.days).toBe(3);
    expect(res.body.data.location.region).toBe('coastal');
  });

  it('returns 400 for invalid region value', async () => {
    const res = await request(app)
      .get('/api/v1/environment/forecast?region=mars')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for days out of range', async () => {
    const res = await request(app)
      .get('/api/v1/environment/forecast?days=99')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/environment/forecast').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/environment/history ──────────────────────────────────────────

describe('GET /api/environment/history', () => {
  it('returns 200 with environmental history for valid date range', async () => {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/v1/environment/history?startDate=${startDate}&endDate=${endDate}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.history).toBeDefined();
    expect(res.body.data.period).toBeDefined();
  });

  it('returns 400 when date range exceeds 90 days', async () => {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/v1/environment/history?startDate=${startDate}&endDate=${endDate}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when required date params are missing', async () => {
    const res = await request(app)
      .get('/api/v1/environment/history')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/v1/environment/history?startDate=${startDate}&endDate=${endDate}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/environment/calculate-impact ────────────────────────────────

describe('POST /api/v1/environment/calculate-impact', () => {
  it('returns 200 when calculating impact for owned horses', async () => {
    // Equoria-hsc6e: per-user CSRF binding — token must be issued under the
    // same sessionIdentifier (req.user.id) the Bearer-authed mutation resolves
    // to. Forward the access cookie so getCsrfToken's tryPopulateUserFromAccessCookie
    // binds the token to user.id; otherwise issuance falls back to the salt and
    // validation 403s (csrf.mjs:95-108).
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.results)).toBe(true);
    expect(res.body.data.results.length).toBe(1);
    expect(res.body.data.results[0].horseId).toBe(horse.id);
  });

  it('returns 400 when horseIds is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when horseIds includes a non-owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [999999999] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken: authenticateToken reads the
    // access cookie FIRST (auth.mjs:83), so an accessToken cookie here would
    // authenticate the request and defeat the 401 assertion. authenticateToken
    // runs before csrfProtection on authRouter (routers.mjs:93,95), so a
    // no-auth request 401s before CSRF validation is reached — the salt-bound
    // token is sufficient.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/environment/comfort-zone/:horseId ────────────────────────────

describe('GET /api/environment/comfort-zone/:horseId', () => {
  it('returns 200 with comfort zone analysis for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/environment/comfort-zone/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.horseId).toBe(horse.id);
    expect(res.body.data.horseName).toBeDefined();
    expect(res.body.data.comfortZone).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/environment/comfort-zone/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/environment/comfort-zone/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
