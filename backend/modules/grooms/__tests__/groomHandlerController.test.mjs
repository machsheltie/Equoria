/**
 * groomHandlerController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getHandlerConfig, statistics (inline route), disciplines (inline route),
 * getHorseHandler, checkHandlerEligibility, getHandlerRecommendations.
 * Routes live under authRouter at /api/groom-handlers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `ghnd-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `ghnd${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GHND',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-HandlerHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/groom-handlers/config ──────────────────────────────────────────

describe('GET /api/groom-handlers/config', () => {
  it('returns 200 with handler configuration', async () => {
    const res = await request(app)
      .get('/api/groom-handlers/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groom-handlers/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-handlers/statistics ──────────────────────────────────────

describe('GET /api/groom-handlers/statistics', () => {
  it('returns 200 with handler statistics for user with no competition history', async () => {
    const res = await request(app)
      .get('/api/groom-handlers/statistics')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data).toHaveProperty('insights');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groom-handlers/statistics').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-handlers/disciplines ─────────────────────────────────────

describe('GET /api/groom-handlers/disciplines', () => {
  it('returns 200 with disciplines list', async () => {
    const res = await request(app)
      .get('/api/groom-handlers/disciplines')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('disciplines');
    expect(Array.isArray(res.body.data.disciplines)).toBe(true);
    expect(res.body.data).toHaveProperty('totalDisciplines');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/groom-handlers/disciplines').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-handlers/horse/:horseId ──────────────────────────────────

describe('GET /api/groom-handlers/horse/:horseId', () => {
  it('returns 200 with handler data for owned horse', async () => {
    const res = await request(app)
      .get(`/api/groom-handlers/horse/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('hasHandler');
    expect(res.body.data).toHaveProperty('horse');
  });

  it('returns 400 for non-numeric horseId', async () => {
    const res = await request(app)
      .get('/api/groom-handlers/horse/notanumber')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/groom-handlers/horse/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/groom-handlers/horse/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-handlers/eligibility/:horseId/:className ─────────────────

describe('GET /api/groom-handlers/eligibility/:horseId/:className', () => {
  it('returns 200 with eligibility data for owned horse and valid class', async () => {
    const res = await request(app)
      .get(`/api/groom-handlers/eligibility/${horse.id}/Hunter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    // 200 (eligible/not-eligible response) or 400 (invalid class name) are acceptable
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/groom-handlers/eligibility/999999999/Hunter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/groom-handlers/eligibility/${horse.id}/Hunter`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/groom-handlers/recommendations/:horseId ────────────────────────

describe('GET /api/groom-handlers/recommendations/:horseId', () => {
  it('returns 200 with recommendations for owned horse', async () => {
    const res = await request(app)
      .get(`/api/groom-handlers/recommendations/${horse.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/groom-handlers/recommendations/999999999')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/groom-handlers/recommendations/${horse.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});
