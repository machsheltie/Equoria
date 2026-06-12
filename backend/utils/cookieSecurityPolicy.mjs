/**
 * 🍪🔒 COOKIE SECURITY POLICY — explicit-flag resolution (Equoria-46f0s)
 *
 * Centralizes the resolution of the two security-critical cookie attributes
 * (`secure` and `sameSite`) so they can be controlled by EXPLICIT environment
 * variables (`COOKIE_SECURE`, `COOKIE_SAMESITE`) instead of being implicitly
 * derived from `NODE_ENV`.
 *
 * WHY (the structural defect class):
 *   The cookie `secure` / `sameSite` flags were gated solely on
 *   `config.env === 'production'`. An operator deploying over HTTPS under a
 *   NON-`production` NODE_ENV (e.g. `NODE_ENV=beta` on a real Railway HTTPS
 *   host, or a staging env that reuses an existing NODE_ENV) would silently
 *   receive `secure: false` + `sameSite: 'lax'` cookies — auth/refresh/CSRF
 *   cookies sent without the Secure attribute and with a weaker CSRF posture,
 *   a real MitM / CSRF exposure that NO explicit operator switch could
 *   correct. This mirrors the implicit-NODE_ENV problem already solved for
 *   rate limiting (`RATE_LIMIT_REQUIRE_REDIS`, Equoria-4kfbh), the query cache
 *   (`CACHE_REQUIRE_REDIS`, Equoria-1tu03), and admin MFA (`ADMIN_MFA_REQUIRED`):
 *   default to the historical NODE_ENV-derived value, but let an explicit env
 *   var override it independently of NODE_ENV.
 *
 * DEFAULTS (unchanged from the pre-flag behavior — do NOT break dev/test/beta-E2E):
 *   - `secure`   default: `nodeEnv === 'production'`  → true only in production.
 *   - `sameSite` default: `nodeEnv === 'production' ? 'strict' : 'lax'`.
 *   The `beta` Playwright E2E profile drives the app over `http://localhost`,
 *   so the DEFAULT for `beta` MUST remain `secure:false` / `sameSite:'lax'`
 *   (a `secure:true` cookie is dropped by the browser over plain HTTP and
 *   would break every authenticated E2E flow). An operator running beta over
 *   real HTTPS opts in explicitly via `COOKIE_SECURE=true`.
 *
 * EXPLICIT OVERRIDES:
 *   - `COOKIE_SECURE`   = 'true' | 'false' (case-insensitive) → forces secure.
 *   - `COOKIE_SAMESITE` = 'strict' | 'lax' | 'none' (case-insensitive) →
 *                          forces sameSite. ('none' REQUIRES secure per
 *                          RFC 6265bis; callers that set 'none' must also set
 *                          COOKIE_SECURE=true — this resolver does not couple
 *                          them, it only resolves each attribute.)
 *
 * This module is PURE (no NODE_ENV reads of its own beyond the explicit
 * arguments passed in) so it is unit-testable independent of the ambient
 * environment — the resolver is exercised by passing nodeEnv + flag values
 * directly, which is how the sentinel test proves the flag controls the
 * behavior with NODE_ENV held constant.
 *
 * @module utils/cookieSecurityPolicy
 */

const VALID_SAMESITE = new Set(['strict', 'lax', 'none']);

/**
 * Resolve the cookie `secure` attribute.
 *
 * @param {object}  params
 * @param {string}  [params.nodeEnv]          the deployment NODE_ENV (default value source)
 * @param {string}  [params.cookieSecureEnv]  raw COOKIE_SECURE env value (explicit override)
 * @returns {boolean} whether cookies should carry the Secure attribute
 */
export function resolveCookieSecure({ nodeEnv, cookieSecureEnv } = {}) {
  if (typeof cookieSecureEnv === 'string') {
    const normalized = cookieSecureEnv.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    // Any other non-empty value is an operator typo — fall through to the
    // NODE_ENV-derived default rather than silently honoring garbage.
  }
  // Default preserves the historical behavior: Secure only in production.
  return nodeEnv === 'production';
}

/**
 * Resolve the cookie `sameSite` attribute.
 *
 * @param {object} params
 * @param {string} [params.nodeEnv]            the deployment NODE_ENV (default value source)
 * @param {string} [params.cookieSamesiteEnv]  raw COOKIE_SAMESITE env value (explicit override)
 * @returns {'strict'|'lax'|'none'} the resolved SameSite policy
 */
export function resolveCookieSameSite({ nodeEnv, cookieSamesiteEnv } = {}) {
  if (typeof cookieSamesiteEnv === 'string') {
    const normalized = cookieSamesiteEnv.trim().toLowerCase();
    if (VALID_SAMESITE.has(normalized)) {
      return normalized;
    }
    // Invalid value — fall through to the NODE_ENV-derived default rather than
    // emitting an attribute the browser will reject.
  }
  // Default preserves the historical behavior: 'strict' in production, 'lax'
  // elsewhere (dev/test cross-port cookie sharing relies on 'lax').
  return nodeEnv === 'production' ? 'strict' : 'lax';
}
