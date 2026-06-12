/**
 * cookieConfig — explicit-flag WIRING integration (Equoria-46f0s).
 *
 * Unlike cookieSecurityPolicy.test.mjs (which exercises the pure resolver),
 * this suite proves the explicit flags are actually WIRED into the real
 * cookieConfig module: setting COOKIE_SECURE / COOKIE_SAMESITE in the
 * environment and re-importing the module (jest.isolateModulesAsync, so the
 * module-level constants re-evaluate against the freshly-set env) flips the
 * `secure` / `sameSite` attributes on the EXPORTED cookie option objects that
 * the auth controllers and CSRF middleware actually hand to `res.cookie()`.
 *
 * NODE_ENV is whatever the jest runner sets ('test'); the flag overrides it.
 * That is the security property under test: the boundary is controlled by the
 * explicit variable, not by the ambient NODE_ENV.
 *
 * No DB is touched: cookieConfig has no DB dependency. The "real path" being
 * verified is the concrete exported config the request handlers consume — the
 * resolver-in-isolation test cannot prove the wiring landed; this does.
 */
import { describe, it, expect, afterEach, jest } from '@jest/globals';

const ORIGINAL_SECURE = process.env.COOKIE_SECURE;
const ORIGINAL_SAMESITE = process.env.COOKIE_SAMESITE;

afterEach(() => {
  if (ORIGINAL_SECURE === undefined) {
    delete process.env.COOKIE_SECURE;
  } else {
    process.env.COOKIE_SECURE = ORIGINAL_SECURE;
  }
  if (ORIGINAL_SAMESITE === undefined) {
    delete process.env.COOKIE_SAMESITE;
  } else {
    process.env.COOKIE_SAMESITE = ORIGINAL_SAMESITE;
  }
  jest.resetModules();
});

async function loadCookieConfigWith({ secure, sameSite }) {
  if (secure === undefined) {
    delete process.env.COOKIE_SECURE;
  } else {
    process.env.COOKIE_SECURE = secure;
  }
  if (sameSite === undefined) {
    delete process.env.COOKIE_SAMESITE;
  } else {
    process.env.COOKIE_SAMESITE = sameSite;
  }

  let mod;
  await jest.isolateModulesAsync(async () => {
    mod = await import('../utils/cookieConfig.mjs');
  });
  return mod;
}

describe('cookieConfig wiring — COOKIE_SECURE overrides the exported cookie options under NODE_ENV=test', () => {
  it('COOKIE_SECURE=true makes every exported cookie option secure:true (despite NODE_ENV=test)', async () => {
    const mod = await loadCookieConfigWith({ secure: 'true' });

    expect(mod.ACCESS_TOKEN_COOKIE_OPTIONS.secure).toBe(true);
    expect(mod.REFRESH_TOKEN_COOKIE_OPTIONS.secure).toBe(true);
    expect(mod.CSRF_TOKEN_COOKIE_OPTIONS.secure).toBe(true);
    // Clear options must mirror the set options so logout actually deletes the
    // Secure cookie (browsers match deletion on the Secure/SameSite attrs).
    expect(mod.CLEAR_COOKIE_OPTIONS.accessToken.secure).toBe(true);
    expect(mod.CLEAR_COOKIE_OPTIONS.refreshToken.secure).toBe(true);
    expect(mod.CLEAR_COOKIE_OPTIONS.csrfToken.secure).toBe(true);
    expect(mod.getCookieConfigSummary().secureCookies).toBe(true);
  });

  it('default (COOKIE_SECURE unset) keeps secure:false under NODE_ENV=test — dev/test default unbroken', async () => {
    const mod = await loadCookieConfigWith({ secure: undefined });

    expect(mod.ACCESS_TOKEN_COOKIE_OPTIONS.secure).toBe(false);
    expect(mod.REFRESH_TOKEN_COOKIE_OPTIONS.secure).toBe(false);
    expect(mod.CSRF_TOKEN_COOKIE_OPTIONS.secure).toBe(false);
    expect(mod.getCookieConfigSummary().secureCookies).toBe(false);
  });
});

describe('cookieConfig wiring — COOKIE_SAMESITE overrides the exported cookie options under NODE_ENV=test', () => {
  it('COOKIE_SAMESITE=strict makes every exported cookie option sameSite:strict (despite NODE_ENV=test)', async () => {
    const mod = await loadCookieConfigWith({ sameSite: 'strict' });

    expect(mod.ACCESS_TOKEN_COOKIE_OPTIONS.sameSite).toBe('strict');
    expect(mod.REFRESH_TOKEN_COOKIE_OPTIONS.sameSite).toBe('strict');
    expect(mod.CSRF_TOKEN_COOKIE_OPTIONS.sameSite).toBe('strict');
    expect(mod.CLEAR_COOKIE_OPTIONS.accessToken.sameSite).toBe('strict');
    expect(mod.getCookieConfigSummary().sameSite).toBe('strict');
  });

  it('default (COOKIE_SAMESITE unset) keeps sameSite:lax under NODE_ENV=test — dev/test default unbroken', async () => {
    const mod = await loadCookieConfigWith({ sameSite: undefined });

    expect(mod.ACCESS_TOKEN_COOKIE_OPTIONS.sameSite).toBe('lax');
    expect(mod.getCookieConfigSummary().sameSite).toBe('lax');
  });
});
