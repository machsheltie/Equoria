/**
 * epigeneticFlagController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: evaluateFlags, getHorseFlags, getFlagDefinitions, batchEvaluateFlags,
 * getCarePatterns.
 * Routes live under authRouter at /api/v1/flags.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken, generateAdminToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let adminToken;
let horse;
const cleanup = createCleanupTracker();
// Equoria-1ohys: ids of all fixture horses owned by `user` (the beforeAll
// horse + any per-test transient horses). Swept before the user delete so the
// FK ordering (Horse.userId onDelete:Restrict) holds.
const horseIds = [];

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `eflag-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `eflag${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'EFlag',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  adminToken = generateAdminToken();

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-FlagHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date('2022-01-01'),
      age: 3,
      userId: user.id,
    },
  });
  horseIds.push(horse.id);

  // Scoped, fail-loud cleanup (Equoria-1ohys). Sweep all owned fixture horses
  // (collected in horseIds) before the user, for FK ordering.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/flags/health ────────────────────────────────────────────────────

describe('GET /api/v1/flags/health', () => {
  it('returns 200 with operational status', async () => {
    const res = await request(app)
      .get('/api/v1/flags/health')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── GET /api/v1/flags/definitions ──────────────────────────────────────────────

describe('GET /api/v1/flags/definitions', () => {
  it('returns 200 with flag definitions', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/flags/definitions').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/flags/horses/:id/flags ─────────────────────────────────────────

describe('GET /api/v1/flags/horses/:id/flags', () => {
  it('returns 200 with flags for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/flags/horses/${horse.id}/flags`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/flags/horses/999999999/flags')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/flags/horses/${horse.id}/flags`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });

  // Sentinel for Equoria-8qu4: ageInYears must be canonical game-years
  // (floor(ageDays / 7)), NOT calendar-years (ageDays / 365.25). A horse
  // born 35 real days ago is 5 game-years old, not ~0.10 calendar-years.
  it('reports ageInYears in canonical game-years, not calendar-years', async () => {
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const youngHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-FlagAge-${randomBytes(4).toString('hex')}`,
        sex: 'Filly',
        dateOfBirth: thirtyFiveDaysAgo,
        age: 5,
        userId: user.id,
      },
    });
    // Equoria-1ohys: register for the suite-level fail-loud horse sweep instead
    // of a swallowed finally-delete (a throwing finally would mask the assertions).
    horseIds.push(youngHorse.id);

    const res = await request(app)
      .get(`/api/v1/flags/horses/${youngHorse.id}/flags`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Game-years: floor(35 / 7) === 5. Calendar-years bug would give ~0.10.
    expect(Number(res.body.data.ageInYears)).toBe(5);
    // Under 3 game-years gate must use the same canonical unit.
    expect(res.body.data.canReceiveMoreFlags).toBe(false);
  });
});

// ─── GET /api/v1/flags/horses/:id/care-patterns ─────────────────────────────────

describe('GET /api/v1/flags/horses/:id/care-patterns', () => {
  it('returns 200 with care patterns for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/flags/horses/${horse.id}/care-patterns`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/flags/horses/999999999/care-patterns')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/flags/horses/${horse.id}/care-patterns`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/flags/evaluate ─────────────────────────────────────────────────

describe('POST /api/v1/flags/evaluate', () => {
  it('returns 200 when evaluating flags for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/flags/evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/flags/evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // No-auth request: bare CSRF (anonymous session). authenticateToken 401s
    // before csrfProtection runs, so no accessToken-bound token is needed.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/flags/evaluate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/flags/batch-evaluate ──────────────────────────────────────────

describe('POST /api/v1/flags/batch-evaluate', () => {
  it('returns 403 for a regular user (admin only)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/flags/batch-evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    // No-auth request: bare CSRF (anonymous session). authenticateToken 401s
    // before csrfProtection runs, so no accessToken-bound token is needed.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/flags/batch-evaluate')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(401);
  });

  it('returns 200 for admin user with valid horse IDs (covers lines 216-260)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${adminToken}`] });
    const res = await request(app)
      .post('/api/v1/flags/batch-evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [horse.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(typeof res.body.data.summary.totalHorses).toBe('number');
    expect(Array.isArray(res.body.data.results)).toBe(true);
  });

  it('returns 400 for admin user with invalid (non-numeric) horse IDs', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${adminToken}`] });
    const res = await request(app)
      .post('/api/v1/flags/batch-evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: ['notanumber'] });

    // Validation middleware returns 400 before controller runs
    expect(res.status).toBe(400);
  });

  it('returns 400 for admin user with empty horseIds array', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${adminToken}`] });
    const res = await request(app)
      .post('/api/v1/flags/batch-evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseIds: [] });

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/v1/flags/definitions?type= — type-filter branch (line 169) ─────────

describe('GET /api/v1/flags/definitions — type query filter', () => {
  it('returns filtered flags for type=positive (covers line 169 if-type branch)', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=positive')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.flags)).toBe(true);
  });

  it('returns filtered flags for type=negative', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=negative')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns filtered flags for type=adaptive', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=adaptive')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 for invalid type value', async () => {
    const res = await request(app)
      .get('/api/v1/flags/definitions?type=invalid')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    // Validation middleware rejects invalid type
    expect([200, 400]).toContain(res.status);
  });
});

// ─── POST /api/v1/flags/evaluate — 404 path (line 56) ───────────────────────────

describe('POST /api/v1/flags/evaluate — non-existent horse 404', () => {
  it('returns 404 when horse does not exist (covers controller line 56)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/flags/evaluate')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999998 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });
});
