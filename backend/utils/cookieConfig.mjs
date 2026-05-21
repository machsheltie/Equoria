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

/**
 * Token TTL constants — single source of truth for cookie maxAge AND the
 * getNow() injection used by tests to fast-forward the clock without waiting.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const CSRF_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
 * Determine if we're in production environment
 * Used to enable strict security features like HTTPS-only cookies
 */
const isProduction = config.env === 'production';

/**
 * SameSite policy:
 * - Production: 'strict' (maximum CSRF protection)
 * - Development: 'lax' (allows cross-port cookies between frontend:3000 and backend:3001)
 */
const SAME_SITE_POLICY = isProduction ? 'strict' : 'lax';

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
  secure: isProduction, // HTTPS only in production (MitM protection)
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
  secure: isProduction, // HTTPS only in production (MitM protection)
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
  secure: isProduction, // HTTPS only in production (MitM protection)
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
    secure: isProduction,
    sameSite: SAME_SITE_POLICY,
    path: '/',
    domain: COOKIE_DOMAIN,
  },
  refreshToken: {
    httpOnly: true,
    secure: isProduction,
    sameSite: SAME_SITE_POLICY,
    path: '/',
    domain: COOKIE_DOMAIN,
  },
  csrfToken: {
    httpOnly: false,
    secure: isProduction,
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
    domain: COOKIE_DOMAIN || 'same-domain',
    accessToken: {
      maxAge: '15 minutes',
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: SAME_SITE_POLICY,
    },
    refreshToken: {
      maxAge: '7 days',
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: SAME_SITE_POLICY,
    },
    csrfToken: {
      maxAge: '24 hours',
      path: '/',
      httpOnly: false,
      secure: isProduction,
      sameSite: SAME_SITE_POLICY,
    },
  };
}

export default COOKIE_OPTIONS;
