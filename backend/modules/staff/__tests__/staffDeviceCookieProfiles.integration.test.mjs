/**
 * staff_device cookie attributes in every environment profile (verification
 * gap 5).
 *
 * STAFF_DEVICE_COOKIE_OPTIONS (controllers/staffCheckinController.mjs) is
 * frozen at import from the access-token cookie options in
 * utils/cookieConfig.mjs, which resolve secure / sameSite / domain from
 * NODE_ENV (config/config.mjs) and the explicit COOKIE_SECURE,
 * COOKIE_SAMESITE and COOKIE_DOMAIN flags (utils/cookieSecurityPolicy.mjs).
 * Each profile below sets that environment, re-imports the controller in a
 * fresh module registry (jest.isolateModulesAsync, the reload technique of
 * __tests__/cookieConfigSecurityFlag.integration.test.mjs) so both modules
 * re-evaluate under it, and restores the whole environment in `finally`.
 *
 * The last case is a real check-in over HTTP in the test profile, reading the
 * Set-Cookie header the browser would receive.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { ACCESS_TOKEN_COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  STAFF_API,
  createUserFactory,
  deviceCookieFrom,
  latestCode,
  post,
  startEmailCapture,
  stopEmailCapture,
} from './helpers/staffFixtures.mjs';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
// Deployable profiles (production, beta) refuse to boot on the committed test
// JWT secrets; config.mjs needs real-looking ones to load at all.
const DEPLOYABLE_SECRETS = {
  JWT_SECRET: 'profile-test-jwt-secret-0123456789abcdefghij',
  JWT_REFRESH_SECRET: 'profile-test-refresh-secret-0123456789abcdef',
};
const COOKIE_FLAGS = ['COOKIE_SECURE', 'COOKIE_SAMESITE', 'COOKIE_DOMAIN'];

const PROFILES = [
  { name: 'production', env: { NODE_ENV: 'production', ...DEPLOYABLE_SECRETS }, secure: true, sameSite: 'strict' },
  {
    name: 'production with a shared cookie domain',
    env: { NODE_ENV: 'production', COOKIE_DOMAIN: '.equoria.test', ...DEPLOYABLE_SECRETS },
    secure: true,
    sameSite: 'strict',
    domain: '.equoria.test',
  },
  {
    name: 'beta over HTTPS (explicit COOKIE_SECURE / COOKIE_SAMESITE)',
    env: { NODE_ENV: 'beta', COOKIE_SECURE: 'true', COOKIE_SAMESITE: 'strict', ...DEPLOYABLE_SECRETS },
    secure: true,
    sameSite: 'strict',
  },
  {
    name: 'beta Playwright over HTTP',
    env: { NODE_ENV: 'beta', ...DEPLOYABLE_SECRETS },
    secure: false,
    sameSite: 'lax',
  },
  { name: 'beta-readiness', env: { NODE_ENV: 'beta-readiness' }, secure: false, sameSite: 'lax' },
  { name: 'test', env: { NODE_ENV: 'test' }, secure: false, sameSite: 'lax' },
  { name: 'development', env: { NODE_ENV: 'development' }, secure: false, sameSite: 'lax' },
];

/** Import the controller and cookieConfig fresh under `env`; env restored after. */
async function loadUnder(env) {
  const saved = { ...process.env };
  try {
    for (const key of COOKIE_FLAGS) {
      delete process.env[key];
    }
    Object.assign(process.env, env);
    let staff;
    let cookies;
    await jest.isolateModulesAsync(async () => {
      cookies = await import('../../../utils/cookieConfig.mjs');
      staff = await import('../controllers/staffCheckinController.mjs');
    });
    return {
      device: staff.STAFF_DEVICE_COOKIE_OPTIONS,
      auth: cookies.ACCESS_TOKEN_COOKIE_OPTIONS,
      env: cookies.getCookieConfigSummary().environment,
    };
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in saved)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, saved);
  }
}

describe('staff_device cookie options follow the auth cookie in every profile (verification gap 5)', () => {
  afterEach(() => jest.resetModules());

  it.each(PROFILES)('$name', async profile => {
    const { device, auth, env } = await loadUnder(profile.env);

    expect(env).toBe(profile.env.NODE_ENV);
    expect(device.httpOnly).toBe(true);
    expect(device.secure).toBe(auth.secure);
    expect(device.secure).toBe(profile.secure);
    expect(device.sameSite).toBe(auth.sameSite);
    expect(device.sameSite).toBe(profile.sameSite);
    expect(device.domain).toBe(auth.domain);
    expect(device.domain).toBe(profile.domain);
    expect(device.path).toBe('/api/v1/staff');
    expect(device.maxAge).toBe(THIRTY_DAYS_MS);
    expect(Object.isFrozen(device)).toBe(true);
  });
});

describe('staff_device Set-Cookie over real HTTP in the test profile (verification gap 5)', () => {
  const cleanup = createCleanupTracker();
  const { makeUser, createdUserIds } = createUserFactory('stdevcookie');

  beforeAll(() => {
    const scope = () => ({ in: createdUserIds });
    cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
    cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
    cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
  });

  afterAll(() => cleanup.run(), 60_000);

  beforeEach(() => startEmailCapture());

  afterEach(() => stopEmailCapture());

  it('carries HttpOnly, the auth Secure / SameSite / Domain, the staff path and 30 days', async () => {
    const mod = await makeUser('moderator');
    expect((await post(`${STAFF_API}/checkin/request`, mod)).status).toBe(202);
    const res = await post(`${STAFF_API}/checkin/verify`, mod, { code: latestCode(mod.email) });
    expect(res.status).toBe(200);

    const [, ...parts] = deviceCookieFrom(res)
      .split(';')
      .map(p => p.trim());
    const attrs = Object.fromEntries(
      parts.map(p => {
        const [k, ...v] = p.split('=');
        return [k.toLowerCase(), v.join('=') || true];
      }),
    );

    expect(attrs.httponly).toBe(true);
    expect(Boolean(attrs.secure)).toBe(ACCESS_TOKEN_COOKIE_OPTIONS.secure);
    expect(attrs.samesite.toLowerCase()).toBe(ACCESS_TOKEN_COOKIE_OPTIONS.sameSite);
    expect(attrs.domain).toBe(ACCESS_TOKEN_COOKIE_OPTIONS.domain);
    expect(attrs.path).toBe('/api/v1/staff');
    expect(attrs['max-age']).toBe(String(THIRTY_DAYS_MS / 1000));
    // The test profile itself: plain-HTTP cookie, lax, host-only.
    expect(ACCESS_TOKEN_COOKIE_OPTIONS).toMatchObject({ secure: false, sameSite: 'lax', domain: undefined });
  }, 60_000);
});
