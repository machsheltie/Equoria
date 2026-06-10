/**
 * farrierController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getFarrierServices, bookFarrierService.
 * Routes live under authRouter at /api/v1/farrier (the unversioned /api/*
 * mount was removed in Equoria-4bs3s).
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
// Extra per-test fixtures (insufficient-funds case) collected here so the
// fail-loud afterAll deletes them with scoped IN-lists instead of swallowed
// per-test finally deletes (Equoria-n7qa3).
const extraHorseIds = [];
const extraUserIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `farrier-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `farrier${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Farrier',
      lastName: 'Tester',
      money: 10000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-FarrierHorse-${Date.now()}`,
      sex: 'Rig',
      dateOfBirth: new Date('2017-01-01'),
      age: 8,
      userId: user.id,
      healthStatus: 'Good',
    },
  });

  // Scoped, fail-loud cleanup (Equoria-n7qa3). FK order: all owned horses
  // (the main fixture + any extra per-test "broke" horses) BEFORE their owning
  // users — Horse.userId is onDelete:Restrict (schema:282). Callbacks read the
  // extra-id arrays at run() time so they capture ids pushed during tests.
  // .deleteMany so an already-gone row is a no-op (not P2025); a real scope/FK
  // failure reds afterAll instead of being swallowed.
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: [horse.id, ...extraHorseIds] } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: [user.id, ...extraUserIds] } } }), 'users');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/farrier/services ────────────────────────────────────────────────

describe('GET /api/farrier/services', () => {
  it('returns 200 with list of farrier services', async () => {
    const res = await request(app)
      .get('/api/v1/farrier/services')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('cost');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/farrier/services').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/farrier/book-service ──────────────────────────────────────────

describe('POST /api/farrier/book-service', () => {
  it('returns 200 when booking a valid service for owned horse', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'hoof-trim' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.horse).toBeDefined();
    expect(res.body.data.service).toBeDefined();
  });

  it('returns 404 for an invalid serviceId', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'nonexistent-service' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a horse not owned by user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: 999999999, serviceId: 'hoof-trim' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'hoof-trim' });

    expect(res.status).toBe(401);
  });

  it('returns 200 and sets lastShod when booking a shoeing service (includesShoing=true branch)', async () => {
    // 'shoeing' has includesShoing: true — covers the updateData.lastShod = now branch (line 107)
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, serviceId: 'shoeing' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.horse.lastShod).not.toBeNull();
  });

  it('returns 400 when user has insufficient funds (money < service.cost branch)', async () => {
    // Create a user with only $10 — hoof-trim costs $80, so insufficient
    const brokeUser = await prisma.user.create({
      data: {
        email: `farrier-broke-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `farbroke${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-hash',
        firstName: 'Broke',
        lastName: 'Tester',
        money: 10,
      },
    });
    // Register for fail-loud teardown immediately after creation (Equoria-n7qa3)
    // so the swallowed per-test finally delete is no longer needed; the suite
    // afterAll deletes these horses before their users (FK-ordered, scoped).
    extraUserIds.push(brokeUser.id);
    const brokeHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BrokeFarrierHorse-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2017-01-01'),
        age: 8,
        userId: brokeUser.id,
        healthStatus: 'Good',
      },
    });
    extraHorseIds.push(brokeHorse.id);
    const brokeToken = generateTestToken({ id: brokeUser.id, email: brokeUser.email, role: 'user' });

    // Bind CSRF to brokeUser (not the default token) so issuance + mutation
    // resolve the same sessionIdentifier (Equoria-vgqam/plw0h).
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${brokeToken}`] });
    const res = await request(app)
      .post('/api/v1/farrier/book-service')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${brokeToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: brokeHorse.id, serviceId: 'hoof-trim' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Insufficient funds');
  });
});
