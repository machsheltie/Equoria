/**
 * epigeneticFlagController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: evaluateFlags, getHorseFlags, getFlagDefinitions, batchEvaluateFlags,
 * getCarePatterns.
 * Routes live under authRouter at /api/flags.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `eflag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `eflag${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'EFlag',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-FlagHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2022-01-01'),
      age: 3,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ─── GET /api/flags/health ────────────────────────────────────────────────────

describe('GET /api/flags/health', () => {
  it('returns 200 with operational status', async () => {
    const res = await request(app)
      .get('/api/flags/health')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/flags/definitions ──────────────────────────────────────────────

describe('GET /api/flags/definitions', () => {
  it('returns 200 with flag definitions', async () => {
    const res = await request(app)
      .get('/api/flags/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/flags/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/flags/horses/:id/flags ─────────────────────────────────────────

describe('GET /api/flags/horses/:id/flags', () => {
  it('returns 200 with flags for owned horse', async () => {
    const res = await request(app)
      .get(`/api/flags/horses/${horse.id}/flags`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/flags/horses/999999999/flags')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/flags/horses/${horse.id}/flags`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/flags/horses/:id/care-patterns ─────────────────────────────────

describe('GET /api/flags/horses/:id/care-patterns', () => {
  it('returns 200 with care patterns for owned horse', async () => {
    const res = await request(app)
      .get(`/api/flags/horses/${horse.id}/care-patterns`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/flags/horses/999999999/care-patterns')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/flags/horses/${horse.id}/care-patterns`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/flags/evaluate ─────────────────────────────────────────────────

describe('POST /api/flags/evaluate', () => {
  it('returns 200 when evaluating flags for owned horse', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/flags/evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/flags/evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/flags/evaluate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/flags/batch-evaluate ──────────────────────────────────────────

describe('POST /api/flags/batch-evaluate', () => {
  it('returns 403 for a regular user (admin only)', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/flags/batch-evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/flags/batch-evaluate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(401);
  });
});
