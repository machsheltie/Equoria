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

import jwt from 'jsonwebtoken';
import { doubleCsrf } from 'csrf-csrf';
import {
  COOKIE_OPTIONS,
  CLEAR_COOKIE_OPTIONS,
  applyHostPrefixGuard,
} from '../utils/cookieConfig.mjs';
import config from '../config/config.mjs';
import logger from '../utils/logger.mjs';

const CSRF_COOKIE_NAME = config.env === 'production' ? '__Host-csrf' : '_csrf';

// Equoria-smy2g: The production CSRF cookie is named `__Host-csrf`. The
// RFC 6265bis `__Host-` prefix FORBIDS a Domain attribute — browsers silently
// reject any `__Host-` cookie carrying Domain. If an operator sets
// COOKIE_DOMAIN (to share access/refresh cookies across subdomains), the raw
// COOKIE_OPTIONS.csrfToken.domain would leak onto the `__Host-csrf` Set-Cookie,
// the browser would drop it, and EVERY mutation would 403 on a missing CSRF
// cookie. Guarding by the actual cookie name (not a separate `isProduction`
// inference) eliminates drift between "is it __Host-" and "did we strip
// domain". For the non-production `_csrf` name the guard is a no-op, so a
// Domain attribute remains legal there.
const CSRF_COOKIE_OPTIONS = applyHostPrefixGuard(CSRF_COOKIE_NAME, COOKIE_OPTIONS.csrfToken);

// Equoria-q7rxy: the CLEAR (delete) path must mirror the Set path. A cookie is
// only deleted when the clearCookie attributes match the original cookie's
// attributes; a `__Host-` cookie was set with NO Domain and Path=/, so its
// deletion must also omit Domain and use Path=/. The raw
// CLEAR_COOKIE_OPTIONS.csrfToken still carries COOKIE_DOMAIN, which — if set —
// would leak onto a `res.clearCookie('__Host-csrf', ...)`, causing the browser
// to NOT match the delete to the host-locked cookie and leaving a stale CSRF
// cookie alive past logout / password change. Routing through the SAME
// applyHostPrefixGuard keyed on the actual cookie name strips Domain (and
// re-asserts secure/Path=/) for `__Host-csrf` and is a no-op for the
// non-production `_csrf` name (where a Domain attribute is legal). Auth handlers
// that clear the CSRF cookie MUST use CLEAR_CSRF_COOKIE_OPTIONS, not the raw
// CLEAR_COOKIE_OPTIONS.csrfToken.
const CLEAR_CSRF_COOKIE_OPTIONS = applyHostPrefixGuard(
  CSRF_COOKIE_NAME,
  CLEAR_COOKIE_OPTIONS.csrfToken,
);

// Fallback HMAC salt — only used for pre-login requests that have neither a
// `req.user` (auth middleware hasn't matched anything yet) nor a refreshToken
// cookie. For authenticated sessions, see `resolveSessionIdentifier` below.
const CSRF_SESSION_SALT = 'equoria-csrf-v1';

/**
 * Equoria-plw0h: per-user CSRF session binding.
 *
 * The pure double-submit pattern's primary defense is the same-origin policy
 * (cross-origin scripts can't read the cookie). The second line of defense
 * is per-user session binding — if a sub-vulnerability lets an attacker
 * plant a cookie+header pair in the victim's browser (subdomain XSS,
 * cookie injection via a sibling app on the same eTLD+1, etc.), a CSRF
 * token minted under attacker.id MUST NOT validate under victim.id.
 *
 * Resolution order (matches the AC verbatim):
 *
 *   1. `req.user.id` — auth middleware has resolved an authenticated user,
 *      OR the issuance/getCsrfToken paths have shimmed it. Token bound to
 *      the user; cross-user replay fails.
 *   2. `req.cookies.refreshToken` — secondary, covers any path that didn't
 *      populate req.user but does have the per-session refresh cookie.
 *   3. `CSRF_SESSION_SALT` — last-resort fallback for true unauthenticated
 *      requests.
 *
 * The csrf-csrf library's existing HMAC-mismatch 403 path enforces the
 * binding: an identifier change between issuance and validation rejects
 * the request. Consistency is ensured by:
 *   - `tryPopulateUserFromAccessCookie` in `getCsrfToken` (decodes the
 *     access cookie best-effort so the public route resolves to user.id).
 *   - `issueCsrfToken({ userId })` shim in register/login/refresh handlers
 *     (binds the issued token to user.id before the refresh cookie has
 *     reached the client).
 */
const resolveSessionIdentifier = req => {
  if (req && req.user && typeof req.user.id === 'string' && req.user.id) {
    return req.user.id;
  }
  if (
    req &&
    req.cookies &&
    typeof req.cookies.refreshToken === 'string' &&
    req.cookies.refreshToken
  ) {
    return req.cookies.refreshToken;
  }
  return CSRF_SESSION_SALT;
};

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
  getSessionIdentifier: req => resolveSessionIdentifier(req),
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: CSRF_COOKIE_OPTIONS,
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: req => req.headers['x-csrf-token'],
  errorConfig: {
    statusCode: 403,
    message: 'Invalid CSRF token. Please refresh the page and try again.',
    code: 'EBADCSRFTOKEN',
  },
});

export { CSRF_COOKIE_NAME, CSRF_COOKIE_OPTIONS, CLEAR_CSRF_COOKIE_OPTIONS };

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
 * @param {{ userId?: string }} [opts] — Equoria-plw0h: if the caller knows
 *   the authenticated user's id at issue time but `req.user` hasn't been
 *   populated by the auth middleware (e.g. the login/register handlers
 *   that just minted the access cookie themselves), pass it here so the
 *   issued CSRF token is bound to the same identifier the next mutation
 *   will resolve under `req.user.id`. Without this, the very next
 *   mutation request — which DOES have req.user populated — would resolve
 *   a different sessionIdentifier and 403 the legitimate flow.
 * @returns {string|undefined} the freshly generated CSRF token, or
 *   `undefined` if cookie-parser is not loaded on this app.
 */
/**
 * Best-effort access-token decode used by `getCsrfToken` (the public route
 * doesn't pass through authenticateToken). Populates `req.user.id` from the
 * httpOnly access cookie if present and verifiable, so the
 * `resolveSessionIdentifier` chain has a userId to bind to. NEVER throws
 * for an absent or invalid cookie — the /csrf-token route is intentionally
 * tolerant of unauthenticated callers (a fresh browser still needs a token).
 *
 * Equoria-plw0h: tightly scoped to the CSRF issuance flow; not a general
 * optional-auth middleware to avoid scope creep.
 */
const tryPopulateUserFromAccessCookie = req => {
  if (!req || !req.cookies || typeof req.cookies.accessToken !== 'string') {
    return;
  }
  if (req.user && typeof req.user.id === 'string' && req.user.id) {
    return; // already populated; respect upstream
  }
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return;
    }
    const decoded = jwt.verify(req.cookies.accessToken, secret, { algorithms: ['HS256'] });
    const uid = decoded?.userId || decoded?.id;
    if (typeof uid === 'string' && uid) {
      req.user = { ...(req.user || {}), id: uid };
    }
  } catch {
    // Best-effort: an expired / tampered / missing cookie just means the
    // token is bound to the fallback identifier. The mutation that follows
    // will go through authenticateToken which DOES reject invalid tokens.
  }
};

export const issueCsrfToken = (req, res, opts = {}) => {
  if (!req || typeof req.cookies !== 'object' || req.cookies === null) {
    return undefined;
  }
  // If caller supplied an explicit userId and req.user isn't already
  // populated (which is the register/login/refresh case — the request is
  // public and never traversed authenticateToken), shim req.user so
  // resolveSessionIdentifier picks it up. We intentionally do NOT clobber
  // an existing req.user — authenticated mutations remain authoritative.
  if (
    opts &&
    typeof opts.userId === 'string' &&
    opts.userId &&
    (!req.user || typeof req.user.id !== 'string' || !req.user.id)
  ) {
    req.user = { ...(req.user || {}), id: opts.userId };
  }
  // `overwrite: true` is required because register/login may receive a
  // request that still carries a stale CSRF cookie from the previous
  // anonymous session. csrf-csrf would otherwise reuse the stale cookie
  // (signed under the pre-login identifier) and the next mutation would
  // 403 against the now-userId identifier.
  return generateCsrfToken(req, res, { overwrite: true });
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
    // Equoria-plw0h: this route is public (no authenticateToken upstream).
    // If a client is already logged in, the browser still sends the
    // httpOnly access cookie — best-effort populate req.user so the issued
    // CSRF token's sessionIdentifier matches what authenticateToken will
    // resolve on the next mutation.
    tryPopulateUserFromAccessCookie(req);
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
