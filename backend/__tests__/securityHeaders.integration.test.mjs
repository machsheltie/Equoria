/**
 * 🔒 Security Headers — HTTP-chain integration sentinel (Equoria-cxr40)
 *
 * The existing unit suite (security.test.mjs) asserts the SHAPE of
 * `helmetConfig` and that `addSecurityHeaders` sets each header when called
 * directly with a stub req/res. That proves the config object and the lone
 * middleware function are correct in isolation — but it does NOT prove the
 * server actually EMITS those headers on a real response.
 *
 * The gap that leaves: if someone deleted `app.use(helmet(helmetConfig))` or
 * `app.use(addSecurityHeaders)` from backend/app.mjs (a one-line wiring
 * regression), every assertion in security.test.mjs would STILL pass while
 * the live server shipped zero CSP / HSTS / nosniff headers. That is exactly
 * the "green test that hides a broken feature" failure mode the constitution
 * (§3) exists to prevent.
 *
 * This suite closes it: it drives a REAL request through the FULL Express
 * middleware chain (supertest against the imported app — no mocks, no bypass
 * headers) and asserts the security headers are present on the actual
 * response. It is the sentinel for "Helmet is wired in and producing
 * headers," not merely "the config object is well-formed."
 *
 * Endpoint choice: `/health` is a lightweight public handler (no auth, no DB
 * query — DB readiness lives separately at /ready). The same endpoint is used
 * by crossSystemValidation.test.mjs and rate-limit-enforcement.test.mjs, so
 * it is a proven, DB-free 200 surface. The `Origin` header satisfies the
 * no-origin CORS policy on the public chain.
 *
 * Testing approach: real HTTP, real app, no mocks (CLAUDE.md §3).
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import app from '../app.mjs';

const ORIGIN = 'http://localhost:3000';

describe('Security headers — live HTTP response (Equoria-cxr40)', () => {
  let res;

  beforeAll(async () => {
    res = await request(app).get('/health').set('Origin', ORIGIN);
  });

  it('returns 200 from the public /health endpoint (sanity)', () => {
    expect(res.status).toBe(200);
  });

  // ── Helmet-provided headers (proves app.use(helmet(helmetConfig)) is wired) ──

  it('sets a Content-Security-Policy header with the expected core directives', () => {
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    // Directives sourced from helmetConfig — if Helmet were unwired, csp would
    // be undefined and these would fail.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('CSP does not contain a wildcard scheme or bare * (anti-broadening on the live header)', () => {
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    // ZAP 10055 / ADR-008 invariants, asserted on the EMITTED header (not just
    // the config object): no scheme wildcard in img-src, no bare * anywhere.
    expect(csp).not.toContain('https:');
    expect(csp).not.toContain('http:');
    // script-src must never gain unsafe-inline/eval (high-sev XSS path).
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-eval'");
  });

  it('sets X-Content-Type-Options=nosniff (Helmet)', () => {
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets Cross-Origin-Embedder-Policy=credentialless (Helmet, ZAP 90004)', () => {
    expect(res.headers['cross-origin-embedder-policy']).toBe('credentialless');
  });

  it('sets Strict-Transport-Security with the configured HSTS directives (Helmet)', () => {
    // helmet emits HSTS from helmetConfig.hsts unconditionally (it does NOT
    // gate on NODE_ENV), so the header is present even in the test env. This
    // is the AC-named HSTS requirement asserted on the real response.
    const hsts = res.headers['strict-transport-security'];
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).toContain('preload');
  });

  it('removes the X-Powered-By fingerprint header (Helmet default)', () => {
    // Helmet strips Express's default `X-Powered-By: Express`. Its absence on
    // the live response is a positive signal Helmet ran.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  // ── addSecurityHeaders-provided defense-in-depth headers (proves that
  //    middleware is mounted too, not just helmet) ──

  it('sets X-Frame-Options=SAMEORIGIN (Helmet default; clickjacking protection present)', () => {
    // NOTE on the LIVE value vs. the config intent: addSecurityHeaders runs
    // BEFORE helmet and sets `DENY`, but helmet's xFrameOptions middleware
    // (default SAMEORIGIN, not overridden in helmetConfig) runs AFTER and
    // overwrites it. So the value actually emitted on the wire is SAMEORIGIN.
    // This sentinel asserts the REAL emitted header (CLAUDE.md §3 — honest
    // signal), which is exactly the discrepancy a config-only unit test
    // (security.test.mjs asserts DENY on the isolated middleware) cannot see.
    // The clickjacking protection is present either way; the framing policy
    // delta (DENY vs SAMEORIGIN) is filed as a follow-up, not silently
    // "corrected" by reordering middleware in this headers-presence task.
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('sets a privacy-preserving Referrer-Policy header', () => {
    // Same clobber dynamic as X-Frame-Options: addSecurityHeaders sets
    // `strict-origin-when-cross-origin`, but helmet's referrerPolicy
    // middleware (default `no-referrer`, not overridden in helmetConfig) runs
    // AFTER and wins on the wire. Both values are privacy-preserving and
    // satisfy "a referrer policy is present", so this sentinel asserts the
    // header is present and is one of the known-secure policies rather than
    // pinning the exact clobbered value. The DENY/strict-origin intent vs.
    // helmet-default delta is surfaced as a follow-up (not silently fixed by
    // reordering middleware, which is out of scope for a headers-presence
    // task).
    const referrerPolicy = res.headers['referrer-policy'];
    expect(referrerPolicy).toBeDefined();
    expect([
      'no-referrer',
      'strict-origin-when-cross-origin',
      'same-origin',
      'strict-origin',
    ]).toContain(referrerPolicy);
  });

  it('sets Permissions-Policy locking down camera/microphone/geolocation', () => {
    // helmet 7 ships no permissionsPolicy middleware, so the value set by
    // addSecurityHeaders is NOT clobbered and survives verbatim on the wire.
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  // ── Robustness: the headers are present on a NON-health path too, proving
  //    they are applied globally (the middleware runs before route matching),
  //    not special-cased on one endpoint. A 404 still traverses the security
  //    middleware, so the headers must be there. ──

  it('applies security headers even on an unmatched route (global middleware, not per-route)', async () => {
    const notFound = await request(app)
      .get('/__no_such_route_security_headers_sentinel__')
      .set('Origin', ORIGIN);
    // We deliberately do NOT assert the status (could be 404/401/etc depending
    // on chain) — only that the security headers traversed the chain.
    expect(notFound.headers['x-content-type-options']).toBe('nosniff');
    expect(notFound.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(notFound.headers['content-security-policy']).toBeDefined();
  });
});
