/**
 * personalityEvolutionController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: evolveGroomPersonality, evolveHorseTemperament, getEvolutionTriggers,
 * getPersonalityStability, predictPersonalityEvolution, getEvolutionHistory,
 * getPersonalityConfig.
 * Routes live under authRouter at /api/v1/personality-evolution (Equoria-vivsi:
 * the unversioned /api/* mounts were removed in Equoria-4bs3s; /api/v1 is the
 * canonical surface — verified in backend/app.mjs:290 + backend/app/routers.mjs:191).
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
// the suite goes red at the source. horse -> groom -> user
// (Horse.userId onDelete: Restrict, schema:282).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let groom;
let horse;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `pevol-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `pevol${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'PEvol',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-EvolGroom-${Date.now()}`,
      speciality: 'general',
      personality: 'calm',
      userId: user.id,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-EvolHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2021-01-01'),
      age: 4,
      userId: user.id,
    },
  });
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/personality-evolution/config ─────────────────────────────────

describe('GET /api/personality-evolution/config', () => {
  it('returns 200 with personality evolution configuration', async () => {
    const res = await request(app)
      .get('/api/v1/personality-evolution/config')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/personality-evolution/config').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/triggers ─────────

describe('GET /api/personality-evolution/:entityType/:entityId/triggers', () => {
  it('returns 200 with triggers for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 200 with triggers for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/horse/${horse.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 400 for invalid entityType', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/trainer/${groom.id}/triggers`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/personality-evolution/groom/${groom.id}/triggers`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/stability ────────

describe('GET /api/personality-evolution/:entityType/:entityId/stability', () => {
  it('returns 200 with stability data for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/stability`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/personality-evolution/groom/${groom.id}/stability`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/predict ──────────

describe('GET /api/personality-evolution/:entityType/:entityId/predict', () => {
  it('returns 200 with prediction for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/predict`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/personality-evolution/groom/${groom.id}/predict`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/personality-evolution/:entityType/:entityId/history ──────────

describe('GET /api/personality-evolution/:entityType/:entityId/history', () => {
  it('returns 200 with evolution history for owned groom', async () => {
    const res = await request(app)
      .get(`/api/v1/personality-evolution/groom/${groom.id}/history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/personality-evolution/groom/${groom.id}/history`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/personality-evolution/groom/:groomId/evolve ────────────────

describe('POST /api/personality-evolution/groom/:groomId/evolve', () => {
  it('returns 200 when evolving personality for owned groom', async () => {
    // Equoria-vivsi: per-user CSRF binding — token must be issued under the
    // same sessionIdentifier (req.user.id) the Bearer-authed mutation resolves
    // to. Forward the access cookie so getCsrfToken's
    // tryPopulateUserFromAccessCookie binds the token to user.id; otherwise
    // issuance falls back to the salt and validation 403s (csrf.mjs:95-108).
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/personality-evolution/groom/${groom.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    // 200 success or 400 (no evolution triggered) are both acceptable
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 404 for a groom not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/personality-evolution/groom/999999999/evolve')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken: authenticateToken reads the
    // access cookie FIRST (auth.mjs:83) and runs before csrfProtection
    // (routers.mjs:93,95), so a no-auth request 401s before CSRF validation.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/personality-evolution/groom/${groom.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/personality-evolution/horse/:horseId/evolve ────────────────

describe('POST /api/personality-evolution/horse/:horseId/evolve', () => {
  it('returns 200 when evolving temperament for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/personality-evolution/horse/${horse.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    // 200 success or 400 (no evolution triggered) are both acceptable
    expect([200, 400]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/personality-evolution/horse/999999999/evolve')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // Intentionally NOT forwarding accessToken (see groom evolve 401 case).
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/personality-evolution/horse/${horse.id}/evolve`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});
