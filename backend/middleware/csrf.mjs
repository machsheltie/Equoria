/**
 * CSRF TOKEN PROTECTION MIDDLEWARE
 *
 * Single live path. Double-submit cookie pattern via the `csrf-csrf` library.
 * Token generation and validation share one contract — the library manages
 * both the cookie it issues and the cookie it reads, in every environment.
 *
 * Contract:
 * - Cookie name: `__Host-csrf` in production, `_csrf` otherwise.
 * - Token is issued by `GET /auth/csrf-token` (response body + Set-Cookie).
 * - Clients send the token in `X-CSRF-Token` on mutations; the browser sends
 *   the cookie automatically. The library HMACs and compares them.
 * - No server-side session state. No `req.session` dependency.
 * - No prototype mutation. No test-bypass awareness in this module.
 *
 * @module middleware/csrf
 */

import { doubleCsrf } from 'csrf-csrf';
import { COOKIE_OPTIONS } from '../utils/cookieConfig.mjs';
import config from '../config/config.mjs';
import logger from '../utils/logger.mjs';

const CSRF_COOKIE_NAME = config.env === 'production' ? '__Host-csrf' : '_csrf';

// Stable HMAC salt. The pure double-submit security guarantee comes from the
// same-origin policy preventing cross-origin scripts from reading the cookie,
// not from session binding. A constant salt keeps generation and validation
// aligned when a user's IP/UA changes between the token fetch and the mutation.
const CSRF_SESSION_SALT = 'equoria-csrf-v1';

// Equoria-uy73 (2026-04-23): no fallback secret. If JWT_SECRET is missing at
// runtime, config.mjs has already thrown before this module loads. Keeping a
// literal fallback here would silently re-enable predictable CSRF HMACs in any
// misconfigured environment that bypassed config.mjs (e.g., a partial import
// graph). Throwing instead surfaces the misconfiguration immediately.
const requireJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error(
      '[CSRF] JWT_SECRET is not set. CSRF protection cannot be initialized. ' +
        'Set JWT_SECRET via environment manager (do NOT commit placeholder secrets).',
    );
  }
  return secret;
};

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => requireJwtSecret(),
  getSessionIdentifier: () => CSRF_SESSION_SALT,
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: COOKIE_OPTIONS.csrfToken,
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: req => req.headers['x-csrf-token'],
  errorConfig: {
    statusCode: 403,
    message: 'Invalid CSRF token. Please refresh the page and try again.',
    code: 'EBADCSRFTOKEN',
  },
});

export { CSRF_COOKIE_NAME };

/**
 * Issue a CSRF token + matching cookie on the current response.
 *
 * 21R-AUTH-3: Auth handlers (register, login, refresh-token) call this
 * piggyback so the very first authenticated mutation after session-start
 * can skip the separate `GET /auth/csrf-token` round-trip — the cookie
 * has already been set on the auth response and the token is returned in
 * the response body for the client to cache.
 *
 * The csrf-csrf library reads `req.cookies` to look for an existing
 * cookie. Production always has `cookie-parser` mounted (see app.mjs),
 * so `req.cookies` is always defined. A handful of legacy unit-style
 * tests build minimal Express apps that bypass cookie-parser; for those,
 * `issueCsrfToken` is a documented no-op (returns `undefined`) rather
 * than 500ing the underlying auth call. The seeding is best-effort —
 * the client can always fall back to GET /auth/csrf-token.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {string|undefined} the freshly generated CSRF token, or
 *   `undefined` if cookie-parser is not loaded on this app.
 */
export const issueCsrfToken = (req, res) => {
  if (!req || typeof req.cookies !== 'object' || req.cookies === null) {
    return undefined;
  }
  return generateCsrfToken(req, res);
};

/**
 * GET /auth/csrf-token
 *
 * Public endpoint. Issues a token (response body) and the matching cookie
 * (Set-Cookie). The client caches the token and sends it in X-CSRF-Token on
 * subsequent mutations; the browser returns the cookie automatically.
 */
export const getCsrfToken = (req, res) => {
  try {
    const token = generateCsrfToken(req, res);

    logger.info('[CSRF] Token generated', {
      userId: req.user?.id,
      ip: req.ip,
    });

    return res.json({
      success: true,
      csrfToken: token,
      code: 'CSRF_TOKEN_CREATED',
    });
  } catch (error) {
    logger.error('[CSRF] Token generation failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate CSRF token',
    });
  }
};

/**
 * The single live CSRF enforcement middleware.
 *
 * Mounted on every authenticated and admin router. Rejects POST/PUT/PATCH/DELETE
 * requests that lack a matching cookie+header pair with a 403.
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * Error handler for CSRF validation failures. Converts the library's
 * HttpError into the API's canonical error envelope.
 */
export const csrfErrorHandler = (err, req, res, next) => {
  const isCsrfError =
    err?.code === 'EBADCSRFTOKEN' ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('csrf'));

  if (isCsrfError) {
    logger.warn('[CSRF] Invalid token detected', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers?.['user-agent'],
      error: err.message,
    });

    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token. Please refresh the page and try again.',
      code: 'INVALID_CSRF_TOKEN',
    });
  }

  next(err);
};
