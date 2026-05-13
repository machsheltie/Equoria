/**
 * environmentalRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: current conditions, forecast, calculate-impact, history, comfort-zone.
 * Routes live under authRouter at /api/environment.
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
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `environ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `environ${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'Environ',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
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

// ─── GET /api/environment/current ─────────────────────────────────────────────

describe('GET /api/environment/current', () => {
  it('returns 200 with current environmental conditions (default location)', async () => {
    const res = await request(app)
      .get('/api/environment/current')
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
      .get('/api/environment/current?region=tropical')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.location.region).toBe('tropical');
  });

  it('returns 400 for invalid region value', async () => {
    const res = await request(app)
      .get('/api/environment/current?region=invalid-region')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/environment/current').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/environment/forecast ────────────────────────────────────────────

describe('GET /api/environment/forecast', () => {
  it('returns 200 with weather forecast (default params)', async () => {
    const res = await request(app)
      .get('/api/environment/forecast')
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
      .get('/api/environment/forecast?days=3&region=coastal')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.days).toBe(3);
    expect(res.body.data.location.region).toBe('coastal');
  });

  it('returns 400 for invalid region value', async () => {
    const res = await request(app)
      .get('/api/environment/forecast?region=mars')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for days out of range', async () => {
    const res = await request(app)
      .get('/api/environment/forecast?days=99')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/environment/forecast').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/environment/history ─────────────────────────────────────────────

describe('GET /api/environment/history', () => {
  it('returns 200 with environmental history for valid date range', async () => {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/environment/history?startDate=${startDate}&endDate=${endDate}`)
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
      .get(`/api/environment/history?startDate=${startDate}&endDate=${endDate}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when required date params are missing', async () => {
    const res = await request(app)
      .get('/api/environment/history')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .get(`/api/environment/history?startDate=${startDate}&endDate=${endDate}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/environment/calculate-impact ───────────────────────────────────

describe('POST /api/environment/calculate-impact', () => {
  it('returns 200 when calculating impact for owned horses', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/environment/calculate-impact')
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
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when horseIds includes a non-owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [999999999] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/environment/calculate-impact')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/environment/comfort-zone/:horseId ───────────────────────────────

describe('GET /api/environment/comfort-zone/:horseId', () => {
  it('returns 200 with comfort zone analysis for owned horse', async () => {
    const res = await request(app)
      .get(`/api/environment/comfort-zone/${horse.id}`)
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
      .get('/api/environment/comfort-zone/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/environment/comfort-zone/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
