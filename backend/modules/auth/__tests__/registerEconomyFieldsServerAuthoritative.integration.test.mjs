/**
 * registerEconomyFieldsServerAuthoritative.integration.test.mjs
 *
 * Equoria-448du — SECURITY: client-controlled economy fields must not affect
 * a new account's money / level / xp.
 *
 * Bug class: authController.register USED to destructure `money`, `level`, and
 * `xp` from `req.body` and seed them with `money === undefined ? 1000 : money`
 * (etc). The only thing preventing a client from self-seeding its own balance /
 * level / xp was `sanitizeRequestData` stripping those non-validated fields
 * upstream — fragile defense-by-middleware. If the register validator ever
 * whitelisted those fields, or the sanitize step were removed / reordered, a
 * submitted `money: 999999` would have been honored.
 *
 * Fix (Equoria-448du): the controller no longer reads money/level/xp from the
 * body. They are pinned to server-authoritative constants (STARTER_MONEY +
 * STARTER_BONUS_COINS / STARTER_LEVEL / STARTER_XP) and used unconditionally.
 *
 * AC:
 *   - controller no longer reads money/level/xp from request body;
 *   - submitted economy fields cannot affect new-account money/level/xp;
 *   - registration for normal clients is unchanged.
 *
 * Sentinel-positive design (OPTIMAL_FIX_DISCIPLINE §2): this test asserts the
 * DB-persisted row, NOT the response envelope. The response already echoed
 * `user.money/level/xp`, but the load-bearing question is "what was written".
 * On pre-fix code, IF sanitize were not the sole guard the controller would
 * have written 999999/99/99999; on post-fix code the controller structurally
 * cannot, because it never touches the body fields. The test reads the real
 * persisted row to make the server-authoritative guarantee concrete.
 *
 * NO MOCKS — real app, real Prisma, real auth + CSRF flow.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { register } from '../controllers/authController.mjs';
import {
  STARTER_MONEY,
  STARTER_LEVEL,
  STARTER_XP,
  STARTER_BONUS_COINS,
} from '../constants/authConstants.mjs';

const ORIGIN = 'http://localhost:3000';
const CANONICAL_STARTING_MONEY = STARTER_MONEY + STARTER_BONUS_COINS; // 1500

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

describe('INTEGRATION: register economy fields are server-authoritative (Equoria-448du)', () => {
  const createdUserIds = [];
  const cleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup (Equoria-jgnqr) — only the users this suite
  // created, in FK order (children before users).
  cleanup.add(
    () => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'refreshToken',
  );
  cleanup.add(
    () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'emailVerificationToken',
  );
  cleanup.add(
    () => prisma.horse.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'horse',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');

  afterAll(() => cleanup.run(), 60000);

  /**
   * Register, optionally injecting extra economy fields into the body.
   * Returns the created user id (asserts 201).
   */
  async function register(extraBody = {}) {
    const { csrfToken, cookieHeader } = await fetchCsrf(app, { origin: ORIGIN });
    const username = uniq('econ448du');
    const email = `${username}@test.com`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeader)
      .set('X-CSRF-Token', csrfToken)
      .send({
        username,
        email,
        password: 'StrongP@ssw0rd!23',
        firstName: 'Econ',
        lastName: 'Tester',
        dateOfBirth: '1990-01-01', // COPPA age gate (adult DOB)
        ...extraBody,
      });
    expect(res.status).toBe(201);
    const userId = res.body?.data?.user?.id;
    expect(userId).toBeTruthy();
    createdUserIds.push(userId);
    return { userId, body: res.body };
  }

  it('submitted money/level/xp are IGNORED — persisted account uses canonical defaults', async () => {
    // The attack: a client tries to self-grant a huge balance, a high level,
    // and a pile of xp at signup.
    const { userId, body } = await register({
      money: 999999,
      level: 99,
      xp: 99999,
    });

    // Persisted row is the source of truth.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true, level: true, xp: true },
    });

    expect(user.money).toBe(CANONICAL_STARTING_MONEY); // 1000 + 500, NOT 999999
    expect(user.level).toBe(STARTER_LEVEL); // 1, NOT 99
    expect(user.xp).toBe(STARTER_XP); // 0, NOT 99999

    // The response envelope must also reflect the canonical values, not the
    // submitted ones (no leak of the attacker's intent back to the client).
    expect(body.data.user.money).toBe(CANONICAL_STARTING_MONEY);
    expect(body.data.user.level).toBe(STARTER_LEVEL);
    expect(body.data.user.xp).toBe(STARTER_XP);
  }, 60000);

  it('normal registration (no economy fields) is unchanged — canonical defaults', async () => {
    const { userId, body } = await register();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true, level: true, xp: true },
    });

    expect(user.money).toBe(CANONICAL_STARTING_MONEY);
    expect(user.level).toBe(STARTER_LEVEL);
    expect(user.xp).toBe(STARTER_XP);

    expect(body.data.user.money).toBe(CANONICAL_STARTING_MONEY);
    expect(body.data.user.level).toBe(STARTER_LEVEL);
    expect(body.data.user.xp).toBe(STARTER_XP);
  }, 60000);

  it('a partial economy injection (money only) still cannot move the balance', async () => {
    // Defense-in-depth: even a single injected field must not slip through.
    const { userId } = await register({ money: 5000000 });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true, level: true, xp: true },
    });
    expect(user.money).toBe(CANONICAL_STARTING_MONEY);
    expect(user.level).toBe(STARTER_LEVEL);
    expect(user.xp).toBe(STARTER_XP);
  }, 60000);
});

/**
 * Controller-direct sentinel (the TRUE failing-test-first proof).
 *
 * Why a second describe that bypasses the HTTP route: at the route layer,
 * `sanitizeRequestData` already strips money/level/xp (they are not in the
 * validator's matchedData), so a full-HTTP test would PASS on pre-fix code
 * too — it would NOT prove the controller-contract change the AC demands
 * ("controller no longer reads money/level/xp from request body"). The defect
 * being fixed is in the CONTROLLER, masked by the middleware. To prove the
 * controller itself no longer trusts the body, this sentinel invokes the real
 * `register(req, res, next)` directly with a body that DOES carry the injected
 * economy fields (no sanitize step in the path). On PRE-FIX code the controller
 * honored `money === undefined ? 1000 : money` and would persist 999999+500 /
 * 99 / 99999 → this test FAILS. On POST-FIX code the controller never reads the
 * body fields → it persists the canonical defaults → this test PASSES.
 *
 * Still NO MOCKS: real controller, real Prisma create, real token/horse/email
 * side-effects (email send is non-fatal by contract). Only req/res are plain
 * stub objects, which is how the controller is invoked in production by Express.
 */
describe('SENTINEL: register() controller ignores body economy fields even without sanitize (Equoria-448du)', () => {
  const createdUserIds = [];
  const cleanup = createCleanupTracker();

  cleanup.add(
    () => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'refreshToken',
  );
  cleanup.add(
    () => prisma.emailVerificationToken.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'emailVerificationToken',
  );
  cleanup.add(
    () => prisma.horse.deleteMany({ where: { userId: { in: createdUserIds } } }),
    'horse',
  );
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');

  afterAll(() => cleanup.run(), 60000);

  it('persists canonical economy even when body carries money/level/xp and no middleware stripped them', async () => {
    const username = uniq('econdirect448du');
    const reqBody = {
      username,
      email: `${username}@test.com`,
      password: 'StrongP@ssw0rd!23',
      firstName: 'Direct',
      lastName: 'Tester',
      dateOfBirth: '1990-01-01',
      // The injected economy fields. On pre-fix code these WOULD be honored
      // because no sanitize step ran in this controller-direct path.
      money: 999999,
      level: 99,
      xp: 99999,
    };

    // Minimal Express-shaped stubs. The controller reads req.body / req.ip /
    // req.headers / req.connection and writes cookies + a JSON response.
    let capturedStatus = null;
    let capturedJson = null;
    const req = {
      body: reqBody,
      ip: '127.0.0.1',
      method: 'POST',
      path: '/api/v1/auth/register',
      originalUrl: '/api/v1/auth/register',
      protocol: 'http',
      secure: false,
      headers: { 'user-agent': 'jest-sentinel' },
      connection: { remoteAddress: '127.0.0.1' },
      cookies: {},
      signedCookies: {},
      get() {
        return undefined;
      },
    };
    const res = {
      cookie() {
        return res;
      },
      clearCookie() {
        return res;
      },
      status(code) {
        capturedStatus = code;
        return res;
      },
      json(payload) {
        capturedJson = payload;
        return res;
      },
    };
    const next = err => {
      // Surface any controller error loudly rather than swallowing it.
      if (err) {
        throw err;
      }
    };

    await register(req, res, next);

    expect(capturedStatus).toBe(201);
    const userId = capturedJson?.data?.user?.id;
    expect(userId).toBeTruthy();
    createdUserIds.push(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true, level: true, xp: true },
    });

    // The load-bearing assertions: pre-fix these would be 1000499.../99/99999.
    expect(user.money).toBe(CANONICAL_STARTING_MONEY); // NOT 999999 + 500
    expect(user.level).toBe(STARTER_LEVEL); // NOT 99
    expect(user.xp).toBe(STARTER_XP); // NOT 99999
  }, 60000);
});
