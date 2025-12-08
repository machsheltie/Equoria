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
 * Determine if we're in production environment
 * Used to enable strict security features like HTTPS-only cookies
 */
const isProduction = config.env === 'production';

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
  sameSite: 'strict', // CSRF protection (strictest policy)
  maxAge: 15 * 60 * 1000, // 15 minutes (900,000ms)
  path: '/', // Available to all routes
  domain: COOKIE_DOMAIN, // Subdomain sharing (if configured)
};

/**
 * Refresh Token Cookie Options
 *
 * Long-lived token for obtaining new access tokens
 * Expires: 7 days (matches JWT refreshToken expiry)
 * Path: /auth/refresh-token (scoped to cookie-based refresh endpoint only)
 *
 * @type {Object}
 */
export const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true, // Cannot be accessed by JavaScript (XSS protection)
  secure: isProduction, // HTTPS only in production (MitM protection)
  sameSite: 'strict', // CSRF protection (strictest policy)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (604,800,000ms)
  path: '/auth/refresh-token', // Only cookie-based refresh endpoint needs access (least privilege)
  domain: COOKIE_DOMAIN, // Subdomain sharing (if configured)
};

/**
 * CSRF Token Cookie Options
 *
 * Double-submit cookie pattern for CSRF protection
 * Expires: Same as access token (tied to session)
 * Path: / (all API endpoints need to validate)
 *
 * Note: httpOnly is false because client needs to read it for X-CSRF-Token header
 *
 * @type {Object}
 */
export const CSRF_TOKEN_COOKIE_OPTIONS = {
  httpOnly: false, // Client must read this to send X-CSRF-Token header
  secure: isProduction, // HTTPS only in production (MitM protection)
  sameSite: 'strict', // CSRF protection (strictest policy)
  maxAge: 15 * 60 * 1000, // 15 minutes (matches access token)
  path: '/', // Available to all routes
  domain: COOKIE_DOMAIN, // Subdomain sharing (if configured)
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
    sameSite: 'strict',
    path: '/',
    domain: COOKIE_DOMAIN,
  },
  refreshToken: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/auth/refresh-token',
    domain: COOKIE_DOMAIN,
  },
  csrfToken: {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
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
      sameSite: 'strict',
    },
    refreshToken: {
      maxAge: '7 days',
      path: '/auth/refresh-token',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
    },
    csrfToken: {
      maxAge: '15 minutes',
      path: '/',
      httpOnly: false,
      secure: isProduction,
      sameSite: 'strict',
    },
  };
}

export default COOKIE_OPTIONS;
