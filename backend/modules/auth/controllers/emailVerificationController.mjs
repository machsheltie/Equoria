/**
 * emailVerificationController.mjs (Equoria-vhv3i — extracted from authController.mjs)
 *
 * Three email-verification endpoints (Phase 1, Day 6-7):
 *
 *   GET  /api/v1/auth/verify-email           public (token in query string)
 *   POST /api/v1/auth/resend-verification    authenticated
 *   GET  /api/v1/auth/verification-status    authenticated
 *
 * Token issuance + storage + lookup live in
 * `backend/utils/emailVerificationService.mjs` — this controller is a thin
 * HTTP veneer over that service, plus the fire-and-forget welcome /
 * verification email send via `backend/utils/emailService.mjs`.
 */

import { AppError, ValidationError } from '../../../errors/index.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  verifyEmailToken,
  resendVerificationEmail,
  checkVerificationStatus,
} from '../../../utils/emailVerificationService.mjs';
import emailService from '../../../utils/emailService.mjs';

/**
 * Verify Email
 * Validates email verification token and marks email as verified.
 * Phase 1, Day 6-7: Email Verification System.
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    // Get IP and user agent for audit trail
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'];

    // Verify the token
    const result = await verifyEmailToken(token, { ipAddress, userAgent });

    if (!result.success) {
      throw new AppError(result.error, 400);
    }

    // Send welcome email (optional, don't block on failure)
    try {
      await emailService.sendWelcomeEmail(result.user.email, result.user);
    } catch (emailError) {
      logger.error(
        '[emailVerificationController.verifyEmail] Failed to send welcome email:',
        emailError,
      );
      // Continue even if welcome email fails
    }

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: result.user,
        verified: true,
      },
    });
  } catch (error) {
    logger.error('[emailVerificationController.verifyEmail] Error verifying email:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Email verification failed due to an unexpected error.', 500));
  }
};

/**
 * Resend Verification Email
 * Sends a new verification email to the user.
 * Phase 1, Day 6-7: Email Verification System.
 */
export const resendVerification = async (req, res, next) => {
  try {
    // User must be authenticated to resend verification
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    // Get IP and user agent for audit trail
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'];

    // Resend verification email
    const result = await resendVerificationEmail(req.user.id, { ipAddress, userAgent });

    // Get user data for email
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        username: true,
      },
    });

    // Send verification email (don't block on failure)
    try {
      await emailService.sendVerificationEmail(user.email, result.token, user);
    } catch (emailError) {
      logger.error(
        '[emailVerificationController.resendVerification] Failed to send email:',
        emailError,
      );
      throw new AppError('Failed to send verification email. Please try again later.', 500);
    }

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully',
      data: {
        emailSent: true,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    logger.error(
      '[emailVerificationController.resendVerification] Error resending verification:',
      error,
    );
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to resend verification email due to an unexpected error.', 500));
  }
};

/**
 * Check Verification Status
 * Returns the current verification status of the authenticated user.
 * Phase 1, Day 6-7: Email Verification System.
 */
export const getVerificationStatus = async (req, res, next) => {
  try {
    // User must be authenticated
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    const status = await checkVerificationStatus(req.user.id);

    if (status.error) {
      throw new AppError(status.error, 404);
    }

    res.status(200).json({
      success: true,
      data: {
        verified: status.verified,
        email: status.email,
        verifiedAt: status.verifiedAt ?? null, // Ensure null instead of undefined
      },
    });
  } catch (error) {
    logger.error(
      '[emailVerificationController.getVerificationStatus] Error checking status:',
      error,
    );
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to check verification status due to an unexpected error.', 500));
  }
};
