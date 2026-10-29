/**
 * Integration test — there is NO route that skips gestation (Equoria-6nl3j,
 * real DB, real app, no mocks).
 *
 * OLD CONTRACT (Equoria-bhf6n): POST /horses/:id/foal-now was a gestation bypass
 * in the production router, refused with 403 unless NODE_ENV was one of the
 * test | beta | beta-readiness allowlist, and materialised a foal (201) inside
 * those three. The test harnesses (Playwright specs, the k6 race harness, other
 * jest suites) used it as their way to get a foal without waiting seven days.
 *
 * NEW CONTRACT (Equoria-6nl3j, the issue's own ruling; the Codex scan of
 * 2026-10-02 called a NODE_ENV check buried in a normal production handler not
 * preferred): the route is gone from the application. Foals arrive only from
 * the nightly foaling job; a test that needs a foal materialises it through
 * foalingService from its own process (tests/e2e/fixtures/foaling.ts for
 * Playwright, a direct createFoalFromPregnancy call in jest). An owner calling
 * the old path now meets an ordinary 404 in EVERY environment, the three
 * harness environments included, and her pregnancy is untouched.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const FIVE_YEARS_AGO = gameCalendarDate(new Date(), -5 * 365);

describe('POST /horses/:id/foal-now — the gestation bypass is gone (Equoria-6nl3j, real DB)', () => {
  let csrf;
  let token;
  let user;
  let breed;
  let damId;

  const post = id =>
    request(app)
      .post(`/api/v1/horses/${id}/foal-now`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

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
        emailVerified: true,
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
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: `TestFixture-Bhf6nSire_${ts}`,
        sex: 'Stallion',
        dateOfBirth: FIVE_YEARS_AGO,
        age: 5,
        breedId: breed.id,
        userId: user.id,
        healthStatus: 'Good',
      }),
    });
    const dam = await prisma.horse.create({
      data: await testHorseData(prisma, {
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
      }),
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

  // The old route answered differently per NODE_ENV (403 outside the harness
  // environments, 201 inside them). Now the answer is the same everywhere: 404.
  describe.each([
    ['test', 'test'],
    ['beta', 'beta'],
    ['beta-readiness', 'beta-readiness'],
    ['production', 'production'],
    ['staging', 'staging'],
    ['development', 'development'],
    ['unset (what the Railway deploy leaves it as)', undefined],
  ])('NODE_ENV=%s', (_label, envValue) => {
    beforeEach(() => {
      if (envValue === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = envValue;
      }
    });

    it('answers 404 for the owner of an in-foal mare and materialises NO foal', async () => {
      const res = await post(damId);

      expect(res.status).toBe(404);

      // The player-visible invariant: the pregnancy is untouched and no foal
      // row exists.
      const dam = await prisma.horse.findUnique({ where: { id: damId } });
      expect(dam.inFoalSinceDate).not.toBeNull();
      expect(dam.pregnancySireId).not.toBeNull();
      expect(await prisma.horse.count({ where: { damId } })).toBe(0);
    });

    it('gives an owned mare, a missing id and a malformed id the same answer', async () => {
      const owned = await post(damId);
      const missing = await post(2147483600);
      const malformed = await post('not-an-id');

      // The 404 body echoes the requested path, so compare everything else: an
      // owned mare is not told anything a stranger's id or garbage is not.
      const sameButPath = res => ({ ...res.body, path: undefined });
      expect(owned.body.message).toBe('Route not found');
      for (const res of [missing, malformed]) {
        expect(res.status).toBe(owned.status);
        expect(sameButPath(res)).toEqual(sameButPath(owned));
      }
    });
  });

  it('the horse breeding router declares no foal-now route and exports no environment allowlist', async () => {
    const module = await import('../routes/horseBreedingRoutes.mjs');
    const paths = module.default.stack.map(layer => layer.route?.path).filter(Boolean);

    expect(paths.some(path => path.includes('foal-now'))).toBe(false);
    expect(module.isFoalNowEnabled).toBeUndefined();
  });
});
