/**
 * 🛡️ CSRF TOKEN PROTECTION MIDDLEWARE
 *
 * Implements double-submit cookie pattern for CSRF protection
 * Validates CSRF tokens on all state-changing operations (POST/PUT/DELETE/PATCH)
 *
 * 🔒 SECURITY PATTERN:
 * - Token generated and stored in cookie
 * - Client reads cookie and sends token in X-CSRF-Token header
 * - Middleware validates header matches cookie
 * - Prevents cross-site request forgery attacks
 *
 * 📋 COMPLIANCE:
 * - OWASP API Security Top 10
 * - Defense-in-depth with SameSite cookies
 *
 * @module middleware/csrf
 */

import { doubleCsrf } from 'csrf-csrf';
import { COOKIE_OPTIONS } from '../utils/cookieConfig.mjs';
import config from '../config/config.mjs';
import logger from '../utils/logger.mjs';

/**
 * Initialize CSRF protection with double-submit cookie pattern
 *
 * Cookie name:
 * - Production: __Host-csrf (strict security with __Host- prefix)
 * - Development/Test: _csrf (simple name for local testing)
 */
const {
  generateCsrfToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => process.env.JWT_SECRET || 'fallback-secret-for-dev',
  // Use IP address consistently for session identifier since /auth/csrf-token
  // is on publicRouter (no authentication) but tokens are used on authenticated routes
  // Security comes from double-submit cookie pattern, not session binding
  getSessionIdentifier: (req) => req.ip || 'test-session',
  cookieName: config.env === 'production' ? '__Host-csrf' : '_csrf',
  cookieOptions: COOKIE_OPTIONS.csrfToken,
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'],
});

/**
 * CSRF protection middleware using cookie-based tokens
 *
 * @type {Function}
 */
export const csrfProtection = doubleCsrfProtection;

/**
 * Endpoint to get CSRF token
 * Frontend calls this on app initialization to obtain token
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getCsrfToken = (req, res) => {
  try {
    const token = generateCsrfToken(req, res);

    logger.info('[CSRF] Token generated', {
      userId: req.user?.id,
      ip: req.ip
    });

    res.json({
      success: true,
      csrfToken: token
    });
  } catch (error) {
    logger.error('[CSRF] Token generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate CSRF token'
    });
  }
};

/**
 * Error handler for CSRF validation failures
 *
 * Provides clear error message and logs security event
 *
 * @param {Error} err - Error object from middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const csrfErrorHandler = (err, req, res, next) => {
  // Check for CSRF errors (csrf-csrf library throws ForbiddenError)
  // Also support legacy EBADCSRFTOKEN code for backwards compatibility
  const isCsrfError =
    err.code === 'EBADCSRFTOKEN' ||
    err.message?.includes('invalid csrf token') ||
    err.message?.includes('CSRF');

  if (isCsrfError) {
    logger.warn('[CSRF] Invalid token detected', {
      userId: req.user?.id,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
      error: err.message
    });

    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token. Please refresh the page and try again.',
      code: 'INVALID_CSRF_TOKEN'
    });
  }

  // Not a CSRF error, pass to next error handler
  next(err);
};

/**
 * Conditional CSRF protection middleware
 *
 * Only applies CSRF protection to state-changing HTTP methods
 * GET requests don't need CSRF protection
 *
 * Usage in server.mjs:
 * ```javascript
 * app.use(applyCsrfProtection);
 * ```
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const applyCsrfProtection = (req, res, next) => {
  // Apply CSRF protection only to state-changing methods
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }

  // GET, HEAD, OPTIONS don't need CSRF protection
  next();
};
