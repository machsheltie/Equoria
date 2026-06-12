/**
 * Shared security configuration.
 *
 * This module is the authoritative source for Helmet configuration and the
 * custom response headers applied on every request. Everything else in the
 * live security chain (CORS, rate limiting, CSRF, auth) is wired directly in
 * `backend/app.mjs`. Do not reintroduce CORS options, rate limiters, API-key
 * fallbacks, or HTTPS redirectors here — `app.mjs` owns that wiring and this
 * module should stay small enough that a reviewer can read the whole live
 * security surface in one place.
 *
 * @module middleware/security
 */

/**
 * Helmet configuration.
 *
 * ZAP scan remediation (issues #68-#71):
 * - imgSrc: removed `https:` wildcard (ZAP rule 10055 "CSP: Wildcard Directive")
 * - crossOriginEmbedderPolicy: `credentialless` (ZAP rule 90004)
 *   `credentialless` instead of `require-corp` because the SPA may load
 *   cross-origin images (horse portraits) that do not ship CORP headers.
 * - baseUri / formAction / frameAncestors added explicitly (defense in depth)
 * - styleSrc still allows `'unsafe-inline'`. This is an ACCEPTED, documented
 *   residual risk — see docs/architecture/adr-008-csp-style-src-unsafe-inline.md
 *   (Equoria-e3k9). Radix UI pulls in react-remove-scroll →
 *   react-style-singleton, which injects runtime <style> tags via
 *   document.createElement('style') after page load; with the static-SPA
 *   serving model there is no per-request nonce path, and the pinned Radix
 *   chain has no working nonce-threading. script-src stays 'self'-only so the
 *   high-severity (script-execution) XSS path remains blocked. The ADR
 *   defines the re-evaluation triggers. A sentinel in
 *   modules/services/__tests__/security.test.mjs locks this shape so it
 *   cannot silently broaden.
 */
export const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: { policy: 'credentialless' },
  // X-Frame-Options + Referrer-Policy are set HERE (authoritatively) rather
  // than in addSecurityHeaders (Equoria-kckix). Helmet runs AFTER
  // addSecurityHeaders in app.mjs, so helmet's defaults (frameguard
  // SAMEORIGIN, referrerPolicy no-referrer) would OVERWRITE anything
  // addSecurityHeaders set. To make the EMITTED value match the intended
  // (stricter) policy, the override lives in helmetConfig — the last writer
  // on the chain — so the value on the wire is the value we mean.
  // - frameguard DENY: page may not be framed by ANY origin (stricter than
  //   SAMEORIGIN; we never embed our own pages in frames). NOTE: `frameguard`
  //   is the helmet 7 option name; helmet 8 renames it to `xFrameOptions`
  //   (the pinned 7.2.0 accepts both as a mutually-exclusive union). A helmet
  //   major bump must rename this key — it is part of the helmet v7→v8
  //   API-change checklist, not casual maintenance (CLAUDE.md dependency note).
  // - referrerPolicy strict-origin-when-cross-origin: send origin (no path)
  //   cross-origin, full URL same-origin, nothing when downgrading to HTTP.
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
};

/**
 * Custom response headers applied on every request.
 *
 * Mounted before `helmet()` in `app.mjs`. Because helmet runs AFTER this
 * middleware, any header helmet ALSO sets would clobber the value set here.
 *
 * - Permissions-Policy — helmet 7 ships NO permissionsPolicy middleware, so
 *   the value set here is NOT clobbered and survives verbatim on the wire.
 *   This is the only header that proves this middleware is mounted at all.
 * - X-Content-Type-Options=nosniff — helmet's noSniff sets the SAME value,
 *   so the duplicate here is harmless (helmet re-sets it identically). Kept
 *   only as belt-and-suspenders for any path that bypasses helmet.
 *
 * X-XSS-Protection, X-Frame-Options, and Referrer-Policy were previously set
 * here too, but helmet's xXssProtection / frameguard / referrerPolicy
 * defaults run afterwards and overwrite them. They are now set authoritatively
 * by helmet — X-Frame-Options=DENY and Referrer-Policy=strict-origin-when-cross-origin
 * declared in `helmetConfig` (Equoria-kckix), and X-XSS-Protection=0 from
 * helmet's default xXssProtection middleware (Equoria-0kb9a). `0` is the modern,
 * recommended value: the legacy auditor-based X-XSS-Protection header is
 * deprecated and could itself introduce XSS, so disabling it (relying on CSP
 * instead) is best practice. The dead `addSecurityHeaders` line that set
 * `1; mode=block` was removed — it was clobbered by helmet's `0` and never
 * reached the wire. Do not re-add any of these three here — helmet would
 * clobber whatever this middleware sets.
 *
 * HSTS is emitted unconditionally by helmet's hsts from helmetConfig.hsts;
 * the production-gated copy below is harmless (helmet overwrites it with the
 * same directives) and is kept only as belt-and-suspenders for any path that
 * somehow bypasses helmet.
 */
export const addSecurityHeaders = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};
