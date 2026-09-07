/**
 * horseXpController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getHorseXpStatus, getHorseXpHistory, allocateStatPoint, and the
 * hard-deprecated /award-xp route (410 Gone, Equoria-6p398.3 — the controller
 * handler it used to call has been deleted).
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
// Equoria-6p398.3 (audit Finding 3): this endpoint was a manual XP grant gated
// only by horse OWNERSHIP, so a role=user account could POST
// {amount:1000, reason:'...'} against its own horse and mint 1000 XP + 10 stat
// points. It is now 410 Gone and the controller handler is deleted; horse XP is
// written only by the internal service from server-computed competition
// results. The previous expectations here (200 on a valid award, 400 on a
// missing amount/reason, 404 on a horse the caller does not own) described the
// vulnerable contract — they are replaced, not weakened: the new expectations
// are strictly stronger (no request of any shape can award XP) and the
// persisted-state proof lives in horseXpAwardServerAuthoritative.integration.test.mjs.

describe('POST /api/v1/horses/:id/award-xp (removed, 410 Gone — Equoria-6p398.3)', () => {
  it('returns 410 for the audited amount:1000 award against an owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 1000, reason: 'audit fixture' });

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);

    // The award must not have happened: the fixture horse is untouched.
    const fresh = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { horseXp: true, availableStatPoints: true },
    });
    expect(fresh.horseXp).toBe(0);
    expect(fresh.availableStatPoints).toBe(0);
  });

  it('returns 410 regardless of body shape (no validation path is reachable)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/horses/${horse.id}/award-xp`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(410);
    expect(res.body.success).toBe(false);
  });

  it('returns 410 for a horse the caller does not own', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/horses/999999999/award-xp')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ amount: 50, reason: 'test' });

    // The deprecation answer does not depend on ownership, so it does not
    // disclose whether that horse exists — 410 for everyone, no XP either way.
    expect(res.status).toBe(410);
  });

  it('returns 401 without auth', async () => {
    // No-auth test: use a BARE CSRF fetch (no accessToken cookie). A
    // per-user-bound fetchCsrf(app, { extraCookies: [`accessToken=...`] })
    // would carry the access cookie, which authenticateToken reads as the
    // primary token source (auth.mjs) — that would authenticate the request
    // and defeat the "without auth" condition. Bare fetch sends only the CSRF
    // cookie; authenticateToken finds no token → 401 (auth rejects before the
    // 410 handler and before CSRF is ever evaluated).
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
