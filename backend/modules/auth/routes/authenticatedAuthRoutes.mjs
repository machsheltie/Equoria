/**
 * Authenticated auth routes.
 *
 * Mounted on `authRouter` in `app.mjs`, which applies `authenticateToken` +
 * `csrfProtection` globally. Every route here is a state-changing or
 * identity-scoped operation that MUST traverse both auth and CSRF.
 *
 * Do NOT mount this router on `publicRouter`. Do NOT add `authenticateToken`
 * per-route here; `authRouter` already enforces it.
 */

import express from 'express';
import { body } from 'express-validator';
import {
  handleValidationErrors,
  sanitizeRequestData,
} from '../../../middleware/validationErrorHandler.mjs';
import { authRateLimiter } from '../../../middleware/authRateLimiter.mjs';
import { profileRateLimiter } from '../../../middleware/rateLimiting.mjs';
import * as authController from '../controllers/authController.mjs';

const router = express.Router();

// GET /auth/profile, /auth/me
router.get('/profile', profileRateLimiter, authController.getProfile);
router.get('/me', profileRateLimiter, authController.getProfile);

// PUT /auth/profile
router.put(
  '/profile',
  profileRateLimiter,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters')
      .escape(),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters')
      .escape(),
    body('username')
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage('Username must be between 3 and 30 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers, and underscores')
      .trim()
      .escape(),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must be 500 characters or less')
      .escape(),
    handleValidationErrors,
    sanitizeRequestData,
  ],
  authController.updateProfile,
);

// POST /auth/logout
router.post('/logout', authController.logout);

// POST /auth/change-password
router.post(
  '/change-password',
  authRateLimiter,
  [
    body('oldPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage(
        'New password must contain at least one lowercase letter, one uppercase letter, and one number',
      ),
    handleValidationErrors,
  ],
  authController.changePassword,
);

// POST /auth/resend-verification
router.post('/resend-verification', authController.resendVerification);

// GET /auth/verification-status
router.get('/verification-status', authController.getVerificationStatus);

// POST /auth/complete-onboarding
router.post('/complete-onboarding', profileRateLimiter, authController.completeOnboarding);

// POST /auth/advance-onboarding
router.post('/advance-onboarding', profileRateLimiter, authController.advanceOnboarding);

// PATCH /auth/profile/preferences
router.patch('/profile/preferences', profileRateLimiter, authController.updateUserPreferences);

export default router;
