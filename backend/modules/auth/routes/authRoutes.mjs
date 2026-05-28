/**
 * Public auth routes.
 *
 * Mounted on `publicRouter` in `app.mjs`. Every route here MUST be reachable
 * without a JWT (registration, login, password recovery, email verification,
 * CSRF token acquisition).
 *
 * Authenticated auth endpoints (profile, logout, change-password, onboarding,
 * preferences, etc.) live in `authenticatedAuthRoutes.mjs` and are mounted on
 * `authRouter` so they inherit the global authenticate + CSRF stack.
 */

import express from 'express';
import { body } from 'express-validator';
import {
  handleValidationErrors,
  sanitizeRequestData,
} from '../../../middleware/validationErrorHandler.mjs';
import { authRateLimiter } from '../../../middleware/authRateLimiter.mjs';
import * as authController from '../controllers/authController.mjs';
import { getCsrfToken } from '../../../middleware/csrf.mjs';

const router = express.Router();

// GET /auth/csrf-token — public endpoint, issues the CSRF token + cookie pair.
router.get('/csrf-token', getCsrfToken);

// POST /auth/register
router.post(
  '/register',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail().trim(),
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .trim()
      .escape(),
    body('password')
      // Equoria-ie4wc: bumped min from 8 → 12 (OWASP ASVS L1). Registration
      // already required all 4 character classes; this commit only raises
      // the length floor here so the three password-write sites
      // (register/reset-password.newPassword/reset-password.password) all
      // match the same ASVS L1 policy.
      .isLength({ min: 12, max: 128 })
      .withMessage('Password must be between 12 and 128 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage(
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)',
      ),
    body('firstName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters')
      .escape(),
    body('lastName')
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters')
      .escape(),
    // COPPA age gate (Equoria-iqzn). DOB is mandatory and must be a real
    // date. The authoritative under-13 rejection lives in the controller
    // (server-side, fail-closed) — this validator only ensures the field is
    // present and parseable so the controller's age math has valid input.
    body('dateOfBirth')
      .notEmpty()
      .withMessage('Date of birth is required')
      .bail()
      .isISO8601()
      .withMessage('Date of birth must be a valid date (YYYY-MM-DD)'),
    handleValidationErrors,
    sanitizeRequestData,
  ],
  authController.register,
);

// POST /auth/login
router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],
  authController.login,
);

// POST /auth/refresh
router.post(
  '/refresh',
  authRateLimiter,
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
    handleValidationErrors,
  ],
  authController.refreshToken,
);

// POST /auth/refresh-token — INTENTIONAL, KEPT (Equoria-kph0s).
// This is the canonical cookie-based refresh path the frontend actually
// calls (frontend/src/lib/api-client.ts uses /api/v1/auth/refresh-token, not
// /refresh). It is NOT a "legacy alias removed in 21R-AUTH-7": 21R-AUTH-7
// (Equoria-grt) removed only the unversioned /api/auth backward-compat MOUNT
// — every auth route, including this one, was kept under /api/v1/auth. The
// handler reads the refresh token from req.cookies.refreshToken (no body
// validator needed); the sibling /refresh above is the body-driven variant
// used by explicit-token callers/tests. Both target authController.refreshToken.
router.post('/refresh-token', authRateLimiter, authController.refreshToken);

// POST /auth/forgot-password
router.post(
  '/forgot-password',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail().trim(),
    handleValidationErrors,
  ],
  authController.forgotPassword,
);

// POST /auth/reset-password
router.post(
  '/reset-password',
  authRateLimiter,
  [
    body('token').isLength({ min: 32 }).withMessage('Reset token is required').trim(),
    // Equoria-ie4wc: reset-password previously only required 3 character
    // classes and min length 8 — below OWASP ASVS L1 and inconsistent with
    // the register endpoint (which has required 4 classes for a while).
    // This commit aligns both newPassword and password fields with the
    // register policy: min length 12, 4 character classes (lower/upper/
    // digit/special). Existing 8-char passwords still log in (bcrypt
    // compare doesn't re-validate); users only hit this on reset.
    body('newPassword')
      .optional()
      .isLength({ min: 12, max: 128 })
      .withMessage('New password must be between 12 and 128 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage(
        'New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)',
      ),
    body('password')
      .optional()
      .isLength({ min: 12, max: 128 })
      .withMessage('Password must be between 12 and 128 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage(
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)',
      ),
    handleValidationErrors,
  ],
  authController.resetPassword,
);

// GET /auth/verify-email
router.get('/verify-email', authController.verifyEmail);

// POST /auth/mfa/challenge — public second factor of the login flow
// (Equoria-2vwwh, OWASP A07). Consumes the short-lived signed challenge token
// issued by /auth/login when the account has MFA enabled.
router.post(
  '/mfa/challenge',
  authRateLimiter,
  [
    body('mfaChallengeToken').notEmpty().withMessage('mfaChallengeToken is required'),
    handleValidationErrors,
  ],
  authController.mfaChallenge,
);

export default router;
