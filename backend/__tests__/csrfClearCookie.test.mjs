/**
 * Equoria-q7rxy — CSRF clear-cookie `__Host-` prefix guard
 *
 * Sibling of Equoria-smy2g (which guarded the Set-Cookie path). The clear
 * (delete) path for a `__Host-` prefixed cookie must ALSO omit the Domain
 * attribute and use Path=/, because browsers match a cookie deletion to the
 * original cookie's attributes. If `clearCookieOptions.csrfToken` carried a
 * Domain (from COOKIE_DOMAIN), the `res.clearCookie('__Host-csrf', ...)` would
 * fail to clear the host-locked cookie, leaking a stale CSRF cookie past
 * logout / password change.
 *
 * These tests prove the SAME guard (`applyHostPrefixGuard`) is reused for the
 * clear path, and that the non-`__Host-` (default `_csrf`) path is unchanged.
 */
import { describe, it, expect } from '@jest/globals';
import { applyHostPrefixGuard, clearCookieOptions } from '../utils/cookieConfig.mjs';
import { csrfCookieName, clearCsrfCookieOptions } from '../middleware/csrf.mjs';

describe('Equoria-q7rxy — CSRF clear-cookie __Host- guard', () => {
  it('clear options for a __Host- cookie carry NO domain and use Path=/, Secure', () => {
    const guarded = applyHostPrefixGuard('__Host-csrf', clearCookieOptions.csrfToken);
    expect(guarded.domain).toBeUndefined();
    expect(guarded.path).toBe('/');
    expect(guarded.secure).toBe(true);
    // httpOnly preserved from the source (false — client reads the CSRF cookie)
    expect(guarded.httpOnly).toBe(false);
  });

  it('clear options for a non-__Host- cookie are unchanged (default _csrf path honors COOKIE_DOMAIN)', () => {
    const guarded = applyHostPrefixGuard('_csrf', clearCookieOptions.csrfToken);
    // Guard is a no-op for non-prefixed names: same reference, untouched fields.
    expect(guarded).toBe(clearCookieOptions.csrfToken);
    expect(guarded.domain).toBe(clearCookieOptions.csrfToken.domain);
    expect(guarded.path).toBe('/');
  });

  it('csrf.mjs exports clearCsrfCookieOptions routed through applyHostPrefixGuard for the live cookie name', () => {
    // Whatever the active env's cookie name is, the exported clear options must
    // equal the guard applied to the raw clear options for that exact name —
    // i.e. the clear path is wired through the SAME guard as the Set path.
    const expected = applyHostPrefixGuard(csrfCookieName, clearCookieOptions.csrfToken);
    expect(clearCsrfCookieOptions).toEqual(expected);

    if (csrfCookieName.startsWith('__Host-')) {
      // production: domain MUST be stripped so the delete matches the host-locked cookie
      expect(clearCsrfCookieOptions.domain).toBeUndefined();
      expect(clearCsrfCookieOptions.path).toBe('/');
      expect(clearCsrfCookieOptions.secure).toBe(true);
    } else {
      // non-production: no-op guard, raw clear options preserved
      expect(clearCsrfCookieOptions).toBe(clearCookieOptions.csrfToken);
    }
  });
});
