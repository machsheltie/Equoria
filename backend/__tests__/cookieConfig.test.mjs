import { describe, it, expect, afterEach } from '@jest/globals';
import {
  accessTokenTtlMs,
  refreshTokenTtlMs,
  csrfTokenTtlMs,
  getNow,
  _setNowFn,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  csrfTokenCookieOptions,
  cookieOptions,
  clearCookieOptions,
  getCookieConfigSummary,
} from '../utils/cookieConfig.mjs';

afterEach(() => {
  _setNowFn(null);
});

describe('cookieConfig — TTL constants', () => {
  it('accessTokenTtlMs is 15 minutes in ms', () => {
    expect(accessTokenTtlMs).toBe(15 * 60 * 1000);
  });

  it('refreshTokenTtlMs is 7 days in ms', () => {
    expect(refreshTokenTtlMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('csrfTokenTtlMs is 24 hours in ms', () => {
    expect(csrfTokenTtlMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe('cookieConfig — getNow and _setNowFn', () => {
  it('getNow returns a positive number by default (real Date.now)', () => {
    expect(typeof getNow()).toBe('number');
    expect(getNow()).toBeGreaterThan(0);
  });

  it('_setNowFn with a function overrides the clock', () => {
    _setNowFn(() => 999999);
    expect(getNow()).toBe(999999);
  });

  it('_setNowFn(null) resets to Date.now — covers ?? right-branch at line 41', () => {
    _setNowFn(() => 1);
    expect(getNow()).toBe(1);
    _setNowFn(null);
    const t = getNow();
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThan(1);
  });

  it('_setNowFn(undefined) resets to Date.now — covers ?? right-branch with undefined', () => {
    _setNowFn(() => 2);
    expect(getNow()).toBe(2);
    _setNowFn(undefined);
    const t = getNow();
    expect(typeof t).toBe('number');
    expect(t).toBeGreaterThan(2);
  });
});

describe('cookieConfig — accessTokenCookieOptions', () => {
  it('httpOnly is true', () => {
    expect(accessTokenCookieOptions.httpOnly).toBe(true);
  });

  it('maxAge equals accessTokenTtlMs', () => {
    expect(accessTokenCookieOptions.maxAge).toBe(accessTokenTtlMs);
  });

  it('path is /', () => {
    expect(accessTokenCookieOptions.path).toBe('/');
  });

  it('sameSite is a non-empty string', () => {
    expect(typeof accessTokenCookieOptions.sameSite).toBe('string');
    expect(accessTokenCookieOptions.sameSite.length).toBeGreaterThan(0);
  });
});

describe('cookieConfig — refreshTokenCookieOptions', () => {
  it('httpOnly is true', () => {
    expect(refreshTokenCookieOptions.httpOnly).toBe(true);
  });

  it('maxAge equals refreshTokenTtlMs', () => {
    expect(refreshTokenCookieOptions.maxAge).toBe(refreshTokenTtlMs);
  });

  it('path is /', () => {
    expect(refreshTokenCookieOptions.path).toBe('/');
  });
});

describe('cookieConfig — csrfTokenCookieOptions', () => {
  it('httpOnly is false (client must read it)', () => {
    expect(csrfTokenCookieOptions.httpOnly).toBe(false);
  });

  it('maxAge equals csrfTokenTtlMs', () => {
    expect(csrfTokenCookieOptions.maxAge).toBe(csrfTokenTtlMs);
  });

  it('path is /', () => {
    expect(csrfTokenCookieOptions.path).toBe('/');
  });
});

describe('cookieConfig — cookieOptions aggregate', () => {
  it('cookieOptions.accessToken references accessTokenCookieOptions', () => {
    expect(cookieOptions.accessToken).toBe(accessTokenCookieOptions);
  });

  it('cookieOptions.refreshToken references refreshTokenCookieOptions', () => {
    expect(cookieOptions.refreshToken).toBe(refreshTokenCookieOptions);
  });

  it('cookieOptions.csrfToken references csrfTokenCookieOptions', () => {
    expect(cookieOptions.csrfToken).toBe(csrfTokenCookieOptions);
  });
});

describe('cookieConfig — clearCookieOptions', () => {
  it('accessToken clear options have httpOnly:true and path:/', () => {
    expect(clearCookieOptions.accessToken.httpOnly).toBe(true);
    expect(clearCookieOptions.accessToken.path).toBe('/');
  });

  it('refreshToken clear options have httpOnly:true and path:/', () => {
    expect(clearCookieOptions.refreshToken.httpOnly).toBe(true);
    expect(clearCookieOptions.refreshToken.path).toBe('/');
  });

  it('csrfToken clear options have httpOnly:false and path:/', () => {
    expect(clearCookieOptions.csrfToken.httpOnly).toBe(false);
    expect(clearCookieOptions.csrfToken.path).toBe('/');
  });
});

describe('cookieConfig — getCookieConfigSummary', () => {
  it('returns an object with required top-level fields', () => {
    const summary = getCookieConfigSummary();
    expect(summary).toBeDefined();
    expect(typeof summary.environment).toBe('string');
    expect(typeof summary.isProduction).toBe('boolean');
    expect(typeof summary.domain).toBe('string');
  });

  it('domain falls back to "same-domain" when COOKIE_DOMAIN is unset', () => {
    const summary = getCookieConfigSummary();
    expect(summary.domain).toBe('same-domain');
  });

  it('accessToken summary has maxAge "15 minutes"', () => {
    const summary = getCookieConfigSummary();
    expect(summary.accessToken.maxAge).toBe('15 minutes');
    expect(summary.accessToken.path).toBe('/');
    expect(summary.accessToken.httpOnly).toBe(true);
  });

  it('refreshToken summary has maxAge "7 days"', () => {
    const summary = getCookieConfigSummary();
    expect(summary.refreshToken.maxAge).toBe('7 days');
    expect(summary.refreshToken.httpOnly).toBe(true);
  });

  it('csrfToken summary has maxAge "24 hours" and httpOnly false', () => {
    const summary = getCookieConfigSummary();
    expect(summary.csrfToken.maxAge).toBe('24 hours');
    expect(summary.csrfToken.httpOnly).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// _setNowFn — ?? null fallback (line 41)
// ---------------------------------------------------------------------------
describe('_setNowFn — ?? null fallback (line 41)', () => {
  it('passing null uses Date.now() fallback (line 41 ?? right-branch)', async () => {
    const { _setNowFn, getNow } = await import('../utils/cookieConfig.mjs');
    // Verify custom fn works
    _setNowFn(() => 99999);
    expect(getNow()).toBe(99999);
    // null triggers ?? right-branch → _nowFn = () => Date.now()
    _setNowFn(null);
    const now = getNow();
    expect(typeof now).toBe('number');
    expect(now).toBeGreaterThan(0);
    // Restore to default
    _setNowFn(null);
  });
});
