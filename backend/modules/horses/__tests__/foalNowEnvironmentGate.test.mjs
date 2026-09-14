/**
 * Integration test — POST /horses/:id/foal-now is not player-reachable in a
 * deploy (Equoria-bhf6n, real DB, real app, no mocks).
 *
 * The defect:
 *   backend/modules/horses/routes/horseBreedingRoutes.mjs guarded the gestation
 *   bypass with only mutationRateLimiter + authenticateToken +
 *   requireOwnership('horse'). Ownership answers "is this my mare", never "may
 *   gestation be skipped". Any authenticated role=user account could POST
 *   /horses/<its own in-foal mare>/foal-now and receive 201 with a materialised
 *   foal — collapsing the seven-day pregnancy and its pregnancy-feeding
 *   requirement at whatever rate the mutation limiter allows.
 *
 * The fix: a fail-closed NODE_ENV allowlist (test | beta | beta-readiness — the
 * jest/k6/Playwright harness environments) mounted BEHIND authenticateToken and
 * BEFORE the id validator and the ownership lookup. Every other value —
 * 'production', 'staging', 'development', and crucially UNSET, which is what
 * the Railway deploy actually has — gets 403.
 *
 * What these tests CANNOT see:
 *   - They exercise the allowlist by setting process.env.NODE_ENV per request.
 *     A module-load-time behaviour that only a genuinely booted production
 *     process would have (Redis-required rate limiting, __Host-csrf cookie
 *     naming) is NOT reproduced here; only the route's own gate is.
 *   - They cannot prove the Railway deploy leaves NODE_ENV unset. That is read
 *     from railway.toml / Dockerfile by inspection; the 'unset' case below
 *     proves only that IF it is unset, the route is closed.
 *   - They say nothing about the Playwright specs, which run a real server
 *     under NODE_ENV=beta; the allowlist membership assertion is the closest
 *     proxy.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { isFoalNowEnabled } from '../routes/horseBreedingRoutes.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const FIVE_YEARS_AGO = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000);

describe('POST /horses/:id/foal-now — environment gate (Equoria-bhf6n, real DB)', () => {
  let csrf;
  let token;
  let user;
  let breed;
  let damId;

  const post = (id, { authenticated = true } = {}) => {
    // For the anonymous case the accessToken cookie must be dropped too —
    // fetchCsrf folds it into cookieHeader, and authenticateToken accepts the
    // cookie as well as the Authorization header, so omitting only the header
    // would still be an authenticated request.
    const cookies = authenticated
      ? csrf.cookieHeader
      : csrf.cookieHeader.filter(c => !String(c).startsWith('accessToken='));
    const req = request(app)
      .post(`/api/v1/horses/${id}/foal-now`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', cookies)
      .set('X-CSRF-Token', csrf.csrfToken);
    if (authenticated) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send({});
  };

  beforeAll(async () => {
    breed = await prisma.breed.upsert({
      where: { name: 'Thoroughbred' },
      update: {},
      create: { name: 'Thoroughbred', description: 'Shared test breed' },
    });
  });

  beforeEach(async () => {
    const ts = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;
    user = await prisma.user.create({
      data: {
        username: `bhf6n_${ts}`,
        email: `bhf6n_${ts}@test.com`,
        password: await bcrypt.hash('TestPassword123!', 1),
        firstName: 'Gate',
        lastName: 'Keeper',
        money: 10000,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

    const sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-Bhf6nSire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: FIVE_YEARS_AGO,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
      },
    });
    const dam = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-Bhf6nDam_${ts}`,
        sex: 'Mare',
        dateOfBirth: FIVE_YEARS_AGO,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
        inFoalSinceDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        pregnancySireId: sire.id,
        pendingFoalName: `TestFixture-Bhf6nFoal_${ts}`,
      },
    });
    damId = dam.id;
  });

  afterEach(async () => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (!user) {
      return;
    }
    const cleanup = createCleanupTracker();
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: user.id } }), 'bhf6nHorses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'bhf6nUser');
    await cleanup.run();
    user = null;
  });

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  // ── The exploit, reproduced through the real HTTP stack ──────────────────
  describe.each([
    ['production', 'production'],
    ['staging', 'staging'],
    ['development', 'development'],
    ['unset (what railway.toml / Dockerfile actually leave it as)', undefined],
  ])('NODE_ENV=%s', (_label, envValue) => {
    beforeEach(() => {
      if (envValue === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = envValue;
      }
    });

    it('refuses the gestation bypass with 403 and materialises NO foal', async () => {
      const res = await post(damId);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      // Assert the GATE's own copy, so a 403 that actually came from CSRF or
      // some other middleware fails this test instead of passing it.
      expect(res.body.message).toContain('A pregnancy runs its full term');

      // The player-visible invariant: the pregnancy is untouched and no foal
      // row exists. This is what the exploit destroyed.
      const dam = await prisma.horse.findUnique({ where: { id: damId } });
      expect(dam.inFoalSinceDate).not.toBeNull();
      expect(dam.pregnancySireId).not.toBeNull();
      expect(await prisma.horse.count({ where: { damId } })).toBe(0);
    });

    it('is still 401 (not 403) for an anonymous caller — the gate sits behind auth', async () => {
      const res = await post(damId, { authenticated: false });
      expect(res.status).toBe(401);
    });

    it('gives a missing / malformed id the SAME body as an owned mare — no oracle', async () => {
      const owned = await post(damId);
      const missing = await post(2147483600);
      const malformed = await post('not-an-id');

      for (const res of [missing, malformed]) {
        expect(res.status).toBe(owned.status);
        expect(res.body).toEqual(owned.body);
      }
    });
  });

  // ── The harness environments keep working (this is a gate, not a removal) ─
  it('NODE_ENV=test still materialises the foal — the jest/k6/Playwright path is intact', async () => {
    process.env.NODE_ENV = 'test';
    const res = await post(damId);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.foalId).toBeTruthy();
    expect(await prisma.horse.count({ where: { damId } })).toBe(1);
  });

  // ── The allowlist itself ─────────────────────────────────────────────────
  describe('isFoalNowEnabled — fail-closed allowlist', () => {
    it.each(['test', 'beta', 'beta-readiness'])('allows the %s harness', env => {
      expect(isFoalNowEnabled(env)).toBe(true);
    });

    it.each(['production', 'PRODUCTION', 'staging', 'development', 'prod', 'Test', ' test', '', null])(
      'fails closed for %p',
      env => {
        expect(isFoalNowEnabled(env)).toBe(false);
      },
    );

    it('fails closed when NODE_ENV is not set at all', () => {
      delete process.env.NODE_ENV;
      expect(isFoalNowEnabled()).toBe(false);
    });
  });
});
