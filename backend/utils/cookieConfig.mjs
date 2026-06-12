/**
 * 🍪 CENTRALIZED COOKIE CONFIGURATION
 *
 * Standardizes cookie security settings across all authentication cookies.
 * Ensures consistent security properties for httpOnly, secure, sameSite, maxAge, and path.
 *
 * 🔒 SECURITY PROPERTIES:
 * - httpOnly: true - Prevents JavaScript access (XSS mitigation)
 * - secure: true (production) - HTTPS only (MitM mitigation)
 * - sameSite: 'strict' - CSRF protection
 * - maxAge: Matches token expiry (session management)
 * - path: Scoped appropriately (least privilege)
 *
 * 📋 COMPLIANCE:
 * - CWE-384: Session Fixation mitigation
 * - CWE-613: Insufficient Session Expiration mitigation
 * - OWASP API Security Top 10 compliance
 *
 * @module utils/cookieConfig
 */

import config from '../config/config.mjs';
import { MS_PER_MINUTE, MS_PER_DAY, MS_PER_WEEK } from '../constants/time.mjs';
import { resolveCookieSecure, resolveCookieSameSite } from './cookieSecurityPolicy.mjs';

/**
 * Token TTL constants — single source of truth for cookie maxAge AND the
 * getNow() injection used by tests to fast-forward the clock without waiting.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * MS_PER_MINUTE; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = MS_PER_WEEK; // 7 days
export const CSRF_TOKEN_TTL_MS = MS_PER_DAY; // 24 hours

/**
 * Mockable clock — defaults to Date.now in production/test.
 * Tests that need to simulate token expiry without waiting real time can call
 * _setNowFn(() => Date.now() + REFRESH_TOKEN_TTL_MS + 1) to advance the clock.
 * Reset with _setNowFn(null) or _setNowFn(() => Date.now()) after each test.
 */
let _nowFn = () => Date.now();
export const getNow = () => _nowFn();
export const _setNowFn = fn => {
  _nowFn = fn ?? (() => Date.now());
};

/**
 * Determine if we're in production environment.
 * Retained for `getCookieConfigSummary()` and as the historical default
 * source; the security-critical `secure` / `sameSite` attributes are now
 * resolved through explicit env flags (see below).
 */
const isProduction = config.env === 'production';

/**
 * Security-critical cookie attributes — EXPLICIT-FLAG resolution (Equoria-46f0s).
 *
 * `secure` and `sameSite` are no longer derived implicitly from
 * `config.env === 'production'`. They are resolved by
 * `utils/cookieSecurityPolicy.mjs` from the explicit env vars `COOKIE_SECURE`
 * and `COOKIE_SAMESITE`, falling back to the historical NODE_ENV-derived
 * default when the flag is unset. This lets an operator deploying over HTTPS
 * under a non-`production` NODE_ENV (e.g. `NODE_ENV=beta` on a real HTTPS
 * host) force `Secure` cookies + `SameSite=Strict` WITHOUT relying on an
 * implicit NODE_ENV check that would otherwise emit insecure cookies.
 *
 * Defaults are unchanged from the pre-flag behavior so dev/test and the beta
 * Playwright-over-HTTP profile keep `secure:false` / `sameSite:'lax'` unless
 * the operator opts in. See cookieSecurityPolicy.mjs for the full rationale.
 */
const IS_SECURE_COOKIE = resolveCookieSecure({
  nodeEnv: config.env,
  cookieSecureEnv: process.env.COOKIE_SECURE,
});

/**
 * SameSite policy:
 * - Explicit COOKIE_SAMESITE=strict|lax|none overrides.
 * - Default: 'strict' in production, 'lax' elsewhere (dev cross-port sharing).
 */
const SAME_SITE_POLICY = resolveCookieSameSite({
  nodeEnv: config.env,
  cookieSamesiteEnv: process.env.COOKIE_SAMESITE,
});

/**
 * Cookie domain configuration
 * Set to undefined for same-domain cookies (default)
 * Set to '.yourdomain.com' for subdomain cookies
 *
 * @example
 * // For app.equoria.com and api.equoria.com to share cookies:
 * COOKIE_DOMAIN='.equoria.com'
 */
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

/**
 * Access Token Cookie Options
 *
 * Short-lived token for API authentication
 * Expires: 15 minutes (matches JWT accessToken expiry)
 * Path: / (all API endpoints need access)
 *
 * @type {Object}
 */
export const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
  secure: IS_SECURE_COOKIE, // HTTPS-only — COOKIE_SECURE override, defaults to production (MitM protection)
  sameSite: SAME_SITE_POLICY, // CSRF protection (strictest policy)
  maxAge: ACCESS_TOKEN_TTL_MS,
  path: '/', // Available to all routes
  domain: COOKIE_DOMAIN, // Subdomain sharing (if configured)
};

/**
 * Refresh Token Cookie Options
 *
 * Long-lived token for obtaining new access tokens
 * Expires: 7 days (matches JWT refreshToken expiry)
 * Path: / (21R-AUTH-1: must cover both /auth/refresh-token and /api/v1/auth/refresh-token mount points)
 *
 * @type {Object}
 */
export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
  secure: IS_SECURE_COOKIE, // HTTPS-only — COOKIE_SECURE override, defaults to production (MitM protection)
  sameSite: SAME_SITE_POLICY, // CSRF protection (strictest policy)
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: '/', // Must cover both /auth/refresh-token and /api/v1/auth/refresh-token mount points (21R-AUTH-1)
  domain: COOKIE_DOMAIN, // Subdomain sharing (if configured)
};

/**
 * `__Host-` cookie-prefix guard (RFC 6265bis §4.1.3.2).
 *
 * Equoria-smy2g: A cookie whose name begins with the `__Host-` prefix is
 * REJECTED by every standards-compliant browser unless it is sent with
 * `Secure`, `Path=/`, and NO `Domain` attribute. The production CSRF cookie
 * is named `__Host-csrf` (see middleware/csrf.mjs). If an operator sets
 * `COOKIE_DOMAIN` (e.g. `.equoria.com`) to share auth cookies across
 * subdomains, the `Domain` attribute would silently leak onto the
 * `__Host-csrf` Set-Cookie, the browser would drop it, the double-submit
 * cookie would be absent, and EVERY state-changing request would fail CSRF
 * with a 403 — a silent, hard-to-diagnose total mutation outage.
 *
 * This guard makes the conflict impossible by construction: for any cookie
 * carrying the `__Host-` prefix we force `domain: undefined`, `path: '/'`,
 * and `secure: true`, ignoring `COOKIE_DOMAIN` for that cookie ONLY. The
 * `__Host-` prefix and subdomain-shared cookies are mutually exclusive — a
 * `__Host-` cookie is host-locked by definition, so subdomain sharing of the
 * CSRF cookie is not a supported configuration. The access/refresh token
 * cookies are NOT `__Host-` prefixed and are intentionally left untouched so
 * they can still honor `COOKIE_DOMAIN` for legitimate subdomain sharing.
 *
 * Rejected alternative (Option b — fail-fast at startup if production &&
 * COOKIE_DOMAIN set): rejected because it turns a recoverable misconfig into
 * a hard boot failure and forces operators to choose between "no subdomain
 * sharing at all" and "no app boot", even though access/refresh sharing is
 * still perfectly valid. Defense-by-construction keeps the CSRF cookie
 * working AND lets the other cookies keep COOKIE_DOMAIN.
 *
 * @param {string} cookieName  the literal cookie name (e.g. `__Host-csrf`)
 * @param {Object} options     the cookie options to guard
 * @returns {Object} a new options object, host-locked if `__Host-` prefixed
 */
export function applyHostPrefixGuard(cookieName, options) {
  if (typeof cookieName === 'string' && cookieName.startsWith('__Host-')) {
    return {
      ...options,
      domain: undefined, // __Host- forbids Domain
      path: '/', // __Host- requires Path=/
      secure: true, // __Host- requires Secure
    };
  }
  return options;
}

/**
 * CSRF Token Cookie Options
 *
 * Double-submit cookie pattern for CSRF protection
 * Expires: 24 hours (21R-AUTH-2: decoupled from access-token lifetime so a
 *   user keeps a valid CSRF cookie across silent access-token refreshes; the
 *   csrf-csrf library's HMAC binds the token to JWT_SECRET, not to session
 *   identity, so a longer cookie lifetime does not weaken CSRF protection)
 * Path: / (all API endpoints need to validate)
 *
 * Note: httpOnly is false because client needs to read it for X-CSRF-Token header
 *
 * Equoria-smy2g: `domain` here is the operator-configured COOKIE_DOMAIN, but
 * the production CSRF cookie uses the `__Host-` prefix. middleware/csrf.mjs
 * passes these options through `applyHostPrefixGuard()` keyed on the actual
 * cookie name, which strips `domain` (and re-asserts secure/path) for the
 * `__Host-csrf` cookie. The raw `domain` retained here is harmless: it only
 * survives onto the non-prefixed `_csrf` cookie used in non-production envs,
 * where a Domain attribute is legal.
 *
 * @type {Object}
 */
export const CSRF_TOKEN_COOKIE_OPTIONS = {
  httpOnly: false, // Client must read this to send X-CSRF-Token header
  secure: IS_SECURE_COOKIE, // HTTPS-only — COOKIE_SECURE override, defaults to production (MitM protection)
  sameSite: SAME_SITE_POLICY, // CSRF protection (strictest policy)
  maxAge: CSRF_TOKEN_TTL_MS, // 24 hours (21R-AUTH-2: decoupled from access token's 15-min lifetime)
  path: '/', // Available to all routes
  domain: COOKIE_DOMAIN, // Subdomain sharing (if configured) — stripped for __Host- cookies via applyHostPrefixGuard
};

/**
 * Centralized cookie options object
 * Import this for consistent cookie configuration
 *
 * @example
 * import { COOKIE_OPTIONS } from './utils/cookieConfig.mjs';
 *
 * res.cookie('accessToken', token, COOKIE_OPTIONS.accessToken);
 * res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS.refreshToken);
 */
export const COOKIE_OPTIONS = {
  accessToken: ACCESS_TOKEN_COOKIE_OPTIONS,
  refreshToken: REFRESH_TOKEN_COOKIE_OPTIONS,
  csrfToken: CSRF_TOKEN_COOKIE_OPTIONS,
};

/**
 * Clear Cookie Options
 *
 * Used when clearing cookies (logout, token invalidation)
 * Must match the original cookie options (especially path and domain)
 * to properly delete the cookie
 *
 * @example
 * res.clearCookie('accessToken', CLEAR_COOKIE_OPTIONS.accessToken);
 * res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS.refreshToken);
 */
export const CLEAR_COOKIE_OPTIONS = {
  accessToken: {
    httpOnly: true,
    secure: IS_SECURE_COOKIE,
    sameSite: SAME_SITE_POLICY,
    path: '/',
    domain: COOKIE_DOMAIN,
  },
  refreshToken: {
    httpOnly: true,
    secure: IS_SECURE_COOKIE,
    sameSite: SAME_SITE_POLICY,
    path: '/',
    domain: COOKIE_DOMAIN,
  },
  // Equoria-q7rxy: the production CSRF cookie is `__Host-csrf`, which forbids a
  // Domain attribute. To DELETE a `__Host-` cookie the clear options must ALSO
  // omit Domain and use Path=/ (browsers match the deletion to the original
  // cookie's attributes). The raw `domain: COOKIE_DOMAIN` retained here is the
  // operator-configured value; middleware/csrf.mjs routes these options through
  // `applyHostPrefixGuard()` (exported as CLEAR_CSRF_COOKIE_OPTIONS) keyed on
  // the actual cookie name, stripping `domain` for `__Host-csrf`. Auth handlers
  // that clear the CSRF cookie MUST use that guarded export, not this raw
  // object directly, or logout/clear of the host-locked cookie will silently
  // fail when COOKIE_DOMAIN is set. The raw domain is harmless here: it only
  // survives onto the non-prefixed `_csrf` cookie used in non-production envs.
  csrfToken: {
    httpOnly: false,
    secure: IS_SECURE_COOKIE,
    sameSite: SAME_SITE_POLICY,
    path: '/',
    domain: COOKIE_DOMAIN,
  },
};

/**
 * Configuration Summary
 * Useful for logging and debugging
 *
 * @returns {Object} Cookie configuration summary
 */
export function getCookieConfigSummary() {
  return {
    environment: config.env,
    isProduction,
    // Resolved security-critical attributes (reflect COOKIE_SECURE /
    // COOKIE_SAMESITE overrides, not the raw isProduction default).
    secureCookies: IS_SECURE_COOKIE,
    sameSite: SAME_SITE_POLICY,
    domain: COOKIE_DOMAIN || 'same-domain',
    accessToken: {
      maxAge: '15 minutes',
      path: '/',
      httpOnly: true,
      secure: IS_SECURE_COOKIE,
      sameSite: SAME_SITE_POLICY,
    },
    refreshToken: {
      maxAge: '7 days',
      path: '/',
      httpOnly: true,
      secure: IS_SECURE_COOKIE,
      sameSite: SAME_SITE_POLICY,
    },
    csrfToken: {
      maxAge: '24 hours',
      path: '/',
      httpOnly: false,
      secure: IS_SECURE_COOKIE,
      sameSite: SAME_SITE_POLICY,
    },
  };
}

export default COOKIE_OPTIONS;
