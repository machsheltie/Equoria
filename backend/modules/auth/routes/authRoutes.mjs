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
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters long')
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

// POST /auth/refresh-token — cookie-based refresh alias
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
    body('newPassword')
      .optional()
      .isLength({ min: 8, max: 128 })
      .withMessage('New password must be between 8 and 128 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        'New password must contain at least one lowercase letter, one uppercase letter, and one number',
      ),
    body('password')
      .optional()
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      ),
    handleValidationErrors,
  ],
  authController.resetPassword,
);

// GET /auth/verify-email
router.get('/verify-email', authController.verifyEmail);

export default router;
