import { describe, it, expect, afterEach } from '@jest/globals';
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  CSRF_TOKEN_TTL_MS,
  getNow,
  _setNowFn,
  ACCESS_TOKEN_COOKIE_OPTIONS,
  REFRESH_TOKEN_COOKIE_OPTIONS,
  CSRF_TOKEN_COOKIE_OPTIONS,
  COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
  getCookieConfigSummary,
} from '../../utils/cookieConfig.mjs';

afterEach(() => {
  _setNowFn(null);
});

describe('cookieConfig — TTL constants', () => {
  it('ACCESS_TOKEN_TTL_MS is 15 minutes in ms', () => {
    expect(ACCESS_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('REFRESH_TOKEN_TTL_MS is 7 days in ms', () => {
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('CSRF_TOKEN_TTL_MS is 24 hours in ms', () => {
    expect(CSRF_TOKEN_TTL_MS).toBe(24 * 60 * 60 * 1000);
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

describe('cookieConfig — ACCESS_TOKEN_COOKIE_OPTIONS', () => {
  it('httpOnly is true', () => {
    expect(ACCESS_TOKEN_COOKIE_OPTIONS.httpOnly).toBe(true);
  });

  it('maxAge equals ACCESS_TOKEN_TTL_MS', () => {
    expect(ACCESS_TOKEN_COOKIE_OPTIONS.maxAge).toBe(ACCESS_TOKEN_TTL_MS);
  });

  it('path is /', () => {
    expect(ACCESS_TOKEN_COOKIE_OPTIONS.path).toBe('/');
  });

  it('sameSite is a non-empty string', () => {
    expect(typeof ACCESS_TOKEN_COOKIE_OPTIONS.sameSite).toBe('string');
    expect(ACCESS_TOKEN_COOKIE_OPTIONS.sameSite.length).toBeGreaterThan(0);
  });
});

describe('cookieConfig — REFRESH_TOKEN_COOKIE_OPTIONS', () => {
  it('httpOnly is true', () => {
    expect(REFRESH_TOKEN_COOKIE_OPTIONS.httpOnly).toBe(true);
  });

  it('maxAge equals REFRESH_TOKEN_TTL_MS', () => {
    expect(REFRESH_TOKEN_COOKIE_OPTIONS.maxAge).toBe(REFRESH_TOKEN_TTL_MS);
  });

  it('path is /', () => {
    expect(REFRESH_TOKEN_COOKIE_OPTIONS.path).toBe('/');
  });
});

describe('cookieConfig — CSRF_TOKEN_COOKIE_OPTIONS', () => {
  it('httpOnly is false (client must read it)', () => {
    expect(CSRF_TOKEN_COOKIE_OPTIONS.httpOnly).toBe(false);
  });

  it('maxAge equals CSRF_TOKEN_TTL_MS', () => {
    expect(CSRF_TOKEN_COOKIE_OPTIONS.maxAge).toBe(CSRF_TOKEN_TTL_MS);
  });

  it('path is /', () => {
    expect(CSRF_TOKEN_COOKIE_OPTIONS.path).toBe('/');
  });
});

describe('cookieConfig — COOKIE_OPTIONS aggregate', () => {
  it('COOKIE_OPTIONS.accessToken references ACCESS_TOKEN_COOKIE_OPTIONS', () => {
    expect(COOKIE_OPTIONS.accessToken).toBe(ACCESS_TOKEN_COOKIE_OPTIONS);
  });

  it('COOKIE_OPTIONS.refreshToken references REFRESH_TOKEN_COOKIE_OPTIONS', () => {
    expect(COOKIE_OPTIONS.refreshToken).toBe(REFRESH_TOKEN_COOKIE_OPTIONS);
  });

  it('COOKIE_OPTIONS.csrfToken references CSRF_TOKEN_COOKIE_OPTIONS', () => {
    expect(COOKIE_OPTIONS.csrfToken).toBe(CSRF_TOKEN_COOKIE_OPTIONS);
  });
});

describe('cookieConfig — CLEAR_COOKIE_OPTIONS', () => {
  it('accessToken clear options have httpOnly:true and path:/', () => {
    expect(CLEAR_COOKIE_OPTIONS.accessToken.httpOnly).toBe(true);
    expect(CLEAR_COOKIE_OPTIONS.accessToken.path).toBe('/');
  });

  it('refreshToken clear options have httpOnly:true and path:/', () => {
    expect(CLEAR_COOKIE_OPTIONS.refreshToken.httpOnly).toBe(true);
    expect(CLEAR_COOKIE_OPTIONS.refreshToken.path).toBe('/');
  });

  it('csrfToken clear options have httpOnly:false and path:/', () => {
    expect(CLEAR_COOKIE_OPTIONS.csrfToken.httpOnly).toBe(false);
    expect(CLEAR_COOKIE_OPTIONS.csrfToken.path).toBe('/');
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
    const { _setNowFn, getNow } = await import('../../utils/cookieConfig.mjs');
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
