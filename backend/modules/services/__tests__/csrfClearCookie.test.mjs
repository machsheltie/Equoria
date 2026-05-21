/**
 * Equoria-q7rxy — CSRF clear-cookie `__Host-` prefix guard
 *
 * Sibling of Equoria-smy2g (which guarded the Set-Cookie path). The clear
 * (delete) path for a `__Host-` prefixed cookie must ALSO omit the Domain
 * attribute and use Path=/, because browsers match a cookie deletion to the
 * original cookie's attributes. If `CLEAR_COOKIE_OPTIONS.csrfToken` carried a
 * Domain (from COOKIE_DOMAIN), the `res.clearCookie('__Host-csrf', ...)` would
 * fail to clear the host-locked cookie, leaking a stale CSRF cookie past
 * logout / password change.
 *
 * These tests prove the SAME guard (`applyHostPrefixGuard`) is reused for the
 * clear path, and that the non-`__Host-` (default `_csrf`) path is unchanged.
 */
import { describe, it, expect } from '@jest/globals';
import { applyHostPrefixGuard, CLEAR_COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import { CSRF_COOKIE_NAME, CLEAR_CSRF_COOKIE_OPTIONS } from '../../../middleware/csrf.mjs';

describe('Equoria-q7rxy — CSRF clear-cookie __Host- guard', () => {
  it('clear options for a __Host- cookie carry NO domain and use Path=/, Secure', () => {
    const guarded = applyHostPrefixGuard('__Host-csrf', CLEAR_COOKIE_OPTIONS.csrfToken);
    expect(guarded.domain).toBeUndefined();
    expect(guarded.path).toBe('/');
    expect(guarded.secure).toBe(true);
    // httpOnly preserved from the source (false — client reads the CSRF cookie)
    expect(guarded.httpOnly).toBe(false);
  });

  it('clear options for a non-__Host- cookie are unchanged (default _csrf path honors COOKIE_DOMAIN)', () => {
    const guarded = applyHostPrefixGuard('_csrf', CLEAR_COOKIE_OPTIONS.csrfToken);
    // Guard is a no-op for non-prefixed names: same reference, untouched fields.
    expect(guarded).toBe(CLEAR_COOKIE_OPTIONS.csrfToken);
    expect(guarded.domain).toBe(CLEAR_COOKIE_OPTIONS.csrfToken.domain);
    expect(guarded.path).toBe('/');
  });

  it('csrf.mjs exports CLEAR_CSRF_COOKIE_OPTIONS routed through applyHostPrefixGuard for the live cookie name', () => {
    // Whatever the active env's cookie name is, the exported clear options must
    // equal the guard applied to the raw clear options for that exact name —
    // i.e. the clear path is wired through the SAME guard as the Set path.
    const expected = applyHostPrefixGuard(CSRF_COOKIE_NAME, CLEAR_COOKIE_OPTIONS.csrfToken);
    expect(CLEAR_CSRF_COOKIE_OPTIONS).toEqual(expected);

    if (CSRF_COOKIE_NAME.startsWith('__Host-')) {
      // production: domain MUST be stripped so the delete matches the host-locked cookie
      expect(CLEAR_CSRF_COOKIE_OPTIONS.domain).toBeUndefined();
      expect(CLEAR_CSRF_COOKIE_OPTIONS.path).toBe('/');
      expect(CLEAR_CSRF_COOKIE_OPTIONS.secure).toBe(true);
    } else {
      // non-production: no-op guard, raw clear options preserved
      expect(CLEAR_CSRF_COOKIE_OPTIONS).toBe(CLEAR_COOKIE_OPTIONS.csrfToken);
    }
  });
});
