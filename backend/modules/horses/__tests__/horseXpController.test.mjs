/**
 * horseXpController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getHorseXpStatus, getHorseXpHistory, awardXpToHorse, allocateStatPoint.
 * Routes live under authRouter at /api/v1/horses/:id/xp, /xp-history, /award-xp,
 * /allocate-stat.
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
      email: `hxp-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `hxp${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'HXP',
      lastName: 'Tester',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-XpHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 5,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-n7qa3). FK order: the horse (XpEvent
  // rows cascade off Horse, schema:805) BEFORE the owning user — Horse.userId
  // is onDelete:Restrict (schema:282). .deleteMany so an already-gone row is a
  // no-op, not P2025; a real scope/FK failure still reds afterAll.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/horses/:id/xp ───────────────────────────────────────────────────

describe('GET /api/v1/horses/:id/xp', () => {
  it('returns 200 with XP status for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentXP');
    expect(res.body.data).toHaveProperty('availableStatPoints');
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/horses/999999999/xp')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse.id}/xp`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/v1/horses/:id/xp-history ──────────────────────────────────────────

describe('GET /api/v1/horses/:id/xp-history', () => {
  it('returns 200 with XP history for owned horse', async () => {
    const res = await request(app)
      .get(`/api/v1/horses/${horse.id}/xp-history`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it('returns 404 for a horse not owned by user', async () => {
    const res = await request(app)
      .get('/api/v1/horses/999999999/xp-history')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/v1/horses/${horse.id}/xp-history`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/horses/:id/award-xp ───────────────────────────────────────────

describe('POST /api/v1/horses/:id/award-xp', () => {
  it('returns 200 when awarding valid XP to owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50, reason: 'integration-test award' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('currentXP');
    expect(res.body.data).toHaveProperty('xpGained');
  });

  it('returns 400 when amount is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ reason: 'test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when reason is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/999999999/award-xp')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50, reason: 'test' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // No-auth test: use a BARE CSRF fetch (no accessToken cookie). A
    // per-user-bound fetchCsrf(app, { extraCookies: [`accessToken=...`] })
    // would carry the access cookie, which authenticateToken reads as the
    // primary token source (auth.mjs) — that would authenticate the request
    // and defeat the "without auth" condition (received 200). Bare fetch
    // sends only the CSRF cookie; authenticateToken finds no token → 401
    // (auth rejects before CSRF is ever evaluated).
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50, reason: 'test' });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/horses/:id/allocate-stat ──────────────────────────────────────

describe('POST /api/v1/horses/:id/allocate-stat', () => {
  it('returns 400 when statName is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for an invalid statName', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'notastat' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when horse has no available stat points', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'speed' });

    // New horse with 0 availableStatPoints → 400
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/999999999/allocate-stat')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'speed' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    // No-auth test: use a BARE CSRF fetch (no accessToken cookie). See the
    // award-xp "returns 401 without auth" test above for the full rationale —
    // a per-user-bound CSRF would carry the access cookie that
    // authenticateToken reads as the primary token, authenticating the
    // request and turning the expected 401 into a 200.
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'speed' });

    expect(res.status).toBe(401);
  });
});

// ─── merged from legacy backend/tests, Equoria-wvuin ──────────────────────────
// Successful stat-point allocation happy path (the tests above only cover the
// validation/no-points 400 cases). Ported to HTTP style with its own fixture horse.
describe('POST /api/v1/horses/:id/allocate-stat — successful allocation (merged from legacy backend/tests, Equoria-wvuin)', () => {
  let allocHorse;
  const allocCleanup = createCleanupTracker();

  beforeAll(async () => {
    allocHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-XpAllocHorse-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId: user.id,
        availableStatPoints: 2,
        speed: 75,
      },
    });

    // Scoped, fail-loud cleanup (Equoria-n7qa3). allocHorse is owned by the
    // outer-scope `user`; this nested afterAll runs BEFORE the outer afterAll's
    // user delete, so the horse is gone before the user (Horse.userId
    // onDelete:Restrict, schema:282). .deleteMany so an already-gone row is a
    // no-op, not P2025.
    allocCleanup.add(() => prisma.horse.deleteMany({ where: { id: allocHorse.id } }), 'allocHorse');
  }, 30000);

  afterAll(() => allocCleanup.run(), 30000);

  it('allocates a stat point: increments stat and decrements available points', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${allocHorse.id}/allocate-stat`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ statName: 'speed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.statName).toBe('speed');
    expect(res.body.data.newStatValue).toBe(76);
    expect(res.body.data.remainingStatPoints).toBe(1);
  });
});
