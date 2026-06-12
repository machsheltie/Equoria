/**
 * Cookie security policy resolver — sentinel coverage (Equoria-46f0s).
 *
 * Proves the EXPLICIT env flags (COOKIE_SECURE / COOKIE_SAMESITE) control the
 * security-critical cookie attributes INDEPENDENT of NODE_ENV, and that the
 * historical NODE_ENV-derived defaults are preserved when the flags are unset.
 *
 * The resolver is a pure function, so NODE_ENV is held constant by passing it
 * as an explicit argument — the test never mutates process.env.NODE_ENV. This
 * is the whole point of the issue: security boundaries must be controllable by
 * an explicit variable rather than an implicit NODE_ENV check.
 */
import { describe, it, expect } from '@jest/globals';
import {
  resolveCookieSecure,
  resolveCookieSameSite,
} from '../utils/cookieSecurityPolicy.mjs';

describe('resolveCookieSecure — explicit flag controls behavior independent of NODE_ENV', () => {
  it('COOKIE_SECURE=true forces secure even when NODE_ENV is NOT production (beta over HTTPS)', () => {
    // The core sentinel: NODE_ENV held at a non-production value, yet the
    // explicit flag forces Secure cookies. Without the fix, beta cookies were
    // secure:false regardless of any operator switch.
    expect(resolveCookieSecure({ nodeEnv: 'beta', cookieSecureEnv: 'true' })).toBe(true);
    expect(resolveCookieSecure({ nodeEnv: 'development', cookieSecureEnv: 'true' })).toBe(true);
  });

  it('COOKIE_SECURE=false forces insecure even when NODE_ENV IS production', () => {
    // Proves the flag is authoritative in BOTH directions (a behind-a-TLS-
    // terminating-proxy production operator could legitimately need this).
    expect(resolveCookieSecure({ nodeEnv: 'production', cookieSecureEnv: 'false' })).toBe(false);
  });

  it('is case-insensitive and trims whitespace on the flag', () => {
    expect(resolveCookieSecure({ nodeEnv: 'beta', cookieSecureEnv: '  TRUE  ' })).toBe(true);
    expect(resolveCookieSecure({ nodeEnv: 'production', cookieSecureEnv: 'False' })).toBe(false);
  });

  describe('default (flag unset) preserves the historical NODE_ENV-derived behavior', () => {
    it('production defaults to secure:true', () => {
      expect(resolveCookieSecure({ nodeEnv: 'production' })).toBe(true);
      expect(resolveCookieSecure({ nodeEnv: 'production', cookieSecureEnv: undefined })).toBe(true);
    });

    it('beta defaults to secure:false (Playwright-over-HTTP E2E must keep working)', () => {
      expect(resolveCookieSecure({ nodeEnv: 'beta' })).toBe(false);
    });

    it('development / test default to secure:false', () => {
      expect(resolveCookieSecure({ nodeEnv: 'development' })).toBe(false);
      expect(resolveCookieSecure({ nodeEnv: 'test' })).toBe(false);
    });

    it('a garbage flag value falls back to the NODE_ENV default (not silently honored)', () => {
      // 'yes' is not 'true'/'false' → fall through to the production default.
      expect(resolveCookieSecure({ nodeEnv: 'production', cookieSecureEnv: 'yes' })).toBe(true);
      expect(resolveCookieSecure({ nodeEnv: 'beta', cookieSecureEnv: 'yes' })).toBe(false);
    });
  });
});

describe('resolveCookieSameSite — explicit flag controls behavior independent of NODE_ENV', () => {
  it('COOKIE_SAMESITE=strict forces strict even when NODE_ENV is NOT production', () => {
    expect(resolveCookieSameSite({ nodeEnv: 'beta', cookieSamesiteEnv: 'strict' })).toBe('strict');
    expect(resolveCookieSameSite({ nodeEnv: 'development', cookieSamesiteEnv: 'strict' })).toBe(
      'strict',
    );
  });

  it('COOKIE_SAMESITE=lax forces lax even when NODE_ENV IS production', () => {
    expect(resolveCookieSameSite({ nodeEnv: 'production', cookieSamesiteEnv: 'lax' })).toBe('lax');
  });

  it('accepts the three valid policies case-insensitively', () => {
    expect(resolveCookieSameSite({ nodeEnv: 'beta', cookieSamesiteEnv: 'NONE' })).toBe('none');
    expect(resolveCookieSameSite({ nodeEnv: 'beta', cookieSamesiteEnv: ' Strict ' })).toBe('strict');
  });

  describe('default (flag unset) preserves the historical NODE_ENV-derived behavior', () => {
    it('production defaults to strict', () => {
      expect(resolveCookieSameSite({ nodeEnv: 'production' })).toBe('strict');
    });

    it('beta / development / test default to lax', () => {
      expect(resolveCookieSameSite({ nodeEnv: 'beta' })).toBe('lax');
      expect(resolveCookieSameSite({ nodeEnv: 'development' })).toBe('lax');
      expect(resolveCookieSameSite({ nodeEnv: 'test' })).toBe('lax');
    });

    it('an invalid policy value falls back to the NODE_ENV default (not emitted to the browser)', () => {
      expect(resolveCookieSameSite({ nodeEnv: 'production', cookieSamesiteEnv: 'bogus' })).toBe(
        'strict',
      );
      expect(resolveCookieSameSite({ nodeEnv: 'beta', cookieSamesiteEnv: 'bogus' })).toBe('lax');
    });
  });
});
