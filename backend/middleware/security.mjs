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
 * - styleSrc still allows `'unsafe-inline'`; removal is tracked separately
 *   because Radix/shadcn inject runtime style tags.
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
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
};

/**
 * Custom response headers applied on every request.
 *
 * Mounted before `helmet()` in `app.mjs` so Helmet's CSP/HSTS/COEP
 * directives take precedence where they overlap. Defense-in-depth headers
 * that Helmet does not set (Permissions-Policy, Referrer-Policy) are added
 * here explicitly.
 */
export const addSecurityHeaders = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};
