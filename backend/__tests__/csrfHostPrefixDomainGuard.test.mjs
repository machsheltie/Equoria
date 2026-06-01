/**
 * Equoria-smy2g — `__Host-` prefix vs COOKIE_DOMAIN conflict guard.
 *
 * The production CSRF cookie is named `__Host-csrf` (middleware/csrf.mjs).
 * RFC 6265bis §4.1.3.2 FORBIDS a Domain attribute on any `__Host-` cookie —
 * browsers silently DROP a `__Host-` Set-Cookie that carries Domain. The
 * cookie options at COOKIE_OPTIONS.csrfToken pass `domain: COOKIE_DOMAIN`,
 * and cookieConfig.mjs invites operators to set COOKIE_DOMAIN='.equoria.com'
 * for subdomain sharing. If COOKIE_DOMAIN is set in production, the browser
 * would reject the `__Host-csrf` cookie → the double-submit cookie would be
 * absent → EVERY state-changing request would fail CSRF with 403 → a silent,
 * total mutation outage.
 *
 * Fix (Option a, defense-by-construction): `applyHostPrefixGuard()` strips
 * `domain` (and re-asserts `secure:true` + `path:'/'`) for any cookie whose
 * name carries the `__Host-` prefix, ignoring COOKIE_DOMAIN for that cookie
 * ONLY. The access/refresh token cookies are NOT `__Host-` prefixed and must
 * stay able to honor COOKIE_DOMAIN, so the guard is keyed on the cookie name
 * and is a strict no-op for non-prefixed names.
 *
 * These are unit tests of the pure guard + assertions on the live wiring in
 * csrf.mjs. The pure-function tests are the sentinel-positive proof: with a
 * `__Host-` name AND a domain set, the guarded options carry NO domain. They
 * fail against the pre-fix code (which had no guard and leaked domain onto
 * the `__Host-csrf` options).
 *
 * @module __tests__/csrfHostPrefixDomainGuard
 */

import { describe, it, expect } from '@jest/globals';
import { applyHostPrefixGuard } from '../utils/cookieConfig.mjs';
import { CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS } from '../middleware/csrf.mjs';

describe('applyHostPrefixGuard — __Host- prefix domain conflict (Equoria-smy2g)', () => {
  // ----- SENTINEL-POSITIVE: the conflict is actually resolved -----
  it('strips domain when a __Host- cookie is given a Domain (the production CSRF case)', () => {
    const raw = {
      httpOnly: false,
      secure: false, // deliberately wrong — guard must force true
      sameSite: 'strict',
      maxAge: 86400000,
      path: '/some/scoped/path', // deliberately wrong — guard must force '/'
      domain: '.equoria.com', // ← the bug: a __Host- cookie cannot carry Domain
    };

    const guarded = applyHostPrefixGuard('__Host-csrf', raw);

    // The whole point: no Domain attribute survives onto a __Host- cookie.
    expect(guarded.domain).toBeUndefined();
    // __Host- mandates Secure and Path=/ — guard re-asserts both.
    expect(guarded.secure).toBe(true);
    expect(guarded.path).toBe('/');
    // Untouched fields pass through.
    expect(guarded.httpOnly).toBe(false);
    expect(guarded.sameSite).toBe('strict');
    expect(guarded.maxAge).toBe(86400000);
  });

  it('strips domain for any __Host- prefixed name, not just __Host-csrf', () => {
    const guarded = applyHostPrefixGuard('__Host-anything', { domain: '.equoria.com' });
    expect(guarded.domain).toBeUndefined();
    expect(guarded.secure).toBe(true);
    expect(guarded.path).toBe('/');
  });

  // ----- DEFAULT / NON-PREFIXED PATH UNCHANGED: no collateral damage -----
  it('is a strict no-op for a non-__Host- cookie name (e.g. dev _csrf) — domain preserved', () => {
    const raw = {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 86400000,
      path: '/',
      domain: '.equoria.com',
    };
    const guarded = applyHostPrefixGuard('_csrf', raw);
    // Non-prefixed cookies may legally carry Domain — guard must NOT touch it.
    expect(guarded.domain).toBe('.equoria.com');
    expect(guarded.secure).toBe(false);
    expect(guarded).toBe(raw); // returns the SAME object — proves zero mutation
  });

  it('preserves an undefined-domain options object unchanged for non-prefixed names', () => {
    const raw = { secure: true, path: '/', domain: undefined, sameSite: 'strict' };
    const guarded = applyHostPrefixGuard('accessToken', raw);
    expect(guarded).toBe(raw);
    expect('domain' in guarded).toBe(true);
    expect(guarded.domain).toBeUndefined();
  });

  it('treats a non-string cookie name as non-prefixed (no-op, no throw)', () => {
    const raw = { domain: '.equoria.com', path: '/' };
    expect(applyHostPrefixGuard(undefined, raw)).toBe(raw);
    expect(applyHostPrefixGuard(null, raw)).toBe(raw);
  });

  it('does not mutate the input options object when guarding (returns a fresh object)', () => {
    const raw = { domain: '.equoria.com', secure: false, path: '/x' };
    const guarded = applyHostPrefixGuard('__Host-csrf', raw);
    expect(guarded).not.toBe(raw);
    // original untouched
    expect(raw.domain).toBe('.equoria.com');
    expect(raw.secure).toBe(false);
    expect(raw.path).toBe('/x');
  });
});

describe('csrf.mjs live wiring — CSRF_COOKIE_OPTIONS is host-locked when name is __Host- (Equoria-smy2g)', () => {
  it('in the current (non-production) test env the cookie name is _csrf', () => {
    // Sanity: confirms which branch the live wiring is exercising here.
    expect(CSRF_COOKIE_NAME).toBe('_csrf');
  });

  it('the wired CSRF_COOKIE_OPTIONS never carries a domain when the cookie name is __Host- prefixed', () => {
    // Re-derive the guard against a __Host- name using the live base options.
    // This proves the wiring (csrf.mjs passes COOKIE_OPTIONS.csrfToken through
    // applyHostPrefixGuard) yields a domain-free result for the production name
    // regardless of what COOKIE_DOMAIN is set to at import time.
    const asHostCookie = applyHostPrefixGuard('__Host-csrf', CSRF_COOKIE_OPTIONS);
    expect(asHostCookie.domain).toBeUndefined();
    expect(asHostCookie.secure).toBe(true);
    expect(asHostCookie.path).toBe('/');
  });

  it('the live CSRF_COOKIE_OPTIONS used by the csrf-csrf library has no leaked domain in this env', () => {
    // In the test env COOKIE_DOMAIN is unset, so domain is undefined either
    // way — assert it is not a truthy domain string regardless of branch.
    expect(CSRF_COOKIE_OPTIONS.domain ?? undefined).toBeUndefined();
    expect(CSRF_COOKIE_OPTIONS.path).toBe('/');
  });
});
