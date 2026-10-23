/**
 * advancedEpigeneticRoutes integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers the horse-specific epigenetic analysis endpoints that remain.
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

// Owner ruling 2026-10-07 (Equoria-huuaf): no potential, no developmental windows, no
// forecasts, no advice. Old contract: these nine routes answered 200 with windows,
// milestone countdowns, forecasts and trait-expression probabilities.
describe('the developmental-window, forecast and trait-probability routes are gone (huuaf)', () => {
  const getRoutes = [
    'environmental-forecast',
    'developmental-windows',
    'developmental-milestones',
    'developmental-forecast',
    'critical-period-analysis',
  ];
  const postRoutes = [
    'trait-expression-probability',
    'evaluate-trait-opportunity',
    'window-sensitivity',
    'coordinate-development',
  ];

  it.each(getRoutes)('GET /horses/:id/%s is 404', async route => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/${route}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it.each(postRoutes)('POST /horses/:id/%s is 404', async route => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/${route}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});
    expect(res.status).toBe(404);
  });
});
