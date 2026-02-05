/**
 * 📧 Email Verification Service (TDD GREEN Implementation Phase)
 *
 * Implements secure email verification with cryptographic tokens, audit trail,
 * and comprehensive security features to prevent abuse and enumeration attacks.
 *
 * Security Features:
 * - 256-bit cryptographic token generation
 * - 24-hour token expiration
 * - One-time use enforcement with audit trail
 * - Rate limiting protection
 * - Email enumeration prevention (timing-safe)
 * - IP address and user agent tracking
 *
 * Phase 1, Day 6-7: Email Verification System
 */

import crypto from 'crypto';
import prisma from '../db/index.mjs';
import logger from './logger.mjs';
import { AppError } from '../errors/index.mjs';

// Email verification configuration
const EMAIL_CONFIG = {
  TOKEN_LENGTH: 32, // 32 bytes = 256 bits
  TOKEN_EXPIRY_HOURS: 24, // 24 hours
  MAX_PENDING_TOKENS: 5, // Maximum pending tokens per user
  RESEND_COOLDOWN_MINUTES: 5, // Minimum time between resend requests
};

/**
 * Generate Cryptographically Secure Verification Token
 * Creates a URL-safe token with 256-bit entropy
 *
 * @returns {string} Hex-encoded verification token
 */
export function generateVerificationToken() {
  return crypto.randomBytes(EMAIL_CONFIG.TOKEN_LENGTH).toString('hex');
}

/**
 * Create Email Verification Token
 * Generates and stores a new verification token for a user
 *
 * @param {string} userId - User ID
 * @param {string} email - Email address to verify
 * @param {Object} metadata - Optional metadata (ipAddress, userAgent)
 * @returns {Promise<Object>} Created token record with token value
 */
export async function createVerificationToken(userId, email, metadata = {}) {
  try {
    // Check for existing pending tokens
    const pendingTokens = await prisma.emailVerificationToken.count({
      where: {
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingTokens >= EMAIL_CONFIG.MAX_PENDING_TOKENS) {
      throw new AppError(
        `Maximum pending verification tokens (${EMAIL_CONFIG.MAX_PENDING_TOKENS}) reached`,
        400,
      );
    }

    // Check rate limiting (last token created within cooldown period)
    const recentToken = await prisma.emailVerificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (recentToken) {
      const cooldownMs = EMAIL_CONFIG.RESEND_COOLDOWN_MINUTES * 60 * 1000;
      const timeSinceLastToken = Date.now() - recentToken.createdAt.getTime();

      if (timeSinceLastToken < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSinceLastToken) / 1000);
        throw new AppError(
          `Please wait ${remainingSeconds} seconds before requesting another verification email`,
          429,
        );
      }
    }

    // Generate token
    const token = generateVerificationToken();

    // Calculate expiration
    const expiresAt = new Date(Date.now() + EMAIL_CONFIG.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Create token record
    const tokenRecord = await prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        email,
        expiresAt,
        ipAddress: metadata.ipAddress || null,
        userAgent: metadata.userAgent || null,
      },
    });

    logger.info('[EmailVerification] Created verification token', {
      userId,
      email,
      tokenId: tokenRecord.id,
      expiresAt,
    });

    return {
      token,
      tokenId: tokenRecord.id,
      expiresAt,
    };
  } catch (error) {
    logger.error('[EmailVerification] Error creating verification token:', error);
    throw error;
  }
}

/**
 * Verify Email Token
 * Validates and uses a verification token to mark email as verified
 *
 * @param {string} token - Verification token
 * @param {Object} metadata - Optional metadata (ipAddress, userAgent)
 * @returns {Promise<Object>} Verification result
 */
export async function verifyEmailToken(token, metadata = {}) {
  try {
    // Find token record
    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    // Timing-safe check to prevent email enumeration
    if (!tokenRecord) {
      // Simulate database delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: false,
        error: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN',
      };
    }

    // Check expiration (before transaction for performance)
    if (new Date() > tokenRecord.expiresAt) {
      return {
        success: false,
        error: 'Verification token has expired',
        code: 'TOKEN_EXPIRED',
      };
    }

    // Use transaction to ensure atomicity with race condition protection
    const result = await prisma.$transaction(async prisma => {
      // Atomic update: only update if token hasn't been used yet
      // This prevents race conditions where two requests try to use the same token
      const updateResult = await prisma.emailVerificationToken.updateMany({
        where: {
          token,
          usedAt: null, // Only update if not already used
        },
        data: { usedAt: new Date() },
      });

      // If no rows were updated, token was already used by another request
      if (updateResult.count === 0) {
        throw new AppError('Verification token has already been used', 400);
      }

      // Mark user email as verified
      const updatedUser = await prisma.user.update({
        where: { id: tokenRecord.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          emailVerifiedAt: true,
        },
      });

      return updatedUser;
    });

    logger.info('[EmailVerification] Email verified successfully', {
      userId: tokenRecord.userId,
      email: tokenRecord.email,
      tokenId: tokenRecord.id,
      ipAddress: metadata.ipAddress,
    });

    return {
      success: true,
      user: result,
      code: 'EMAIL_VERIFIED',
    };
  } catch (error) {
    logger.error('[EmailVerification] Error verifying email token:', error);

    // If it's an AppError (like TOKEN_ALREADY_USED), return its message
    if (error instanceof AppError) {
      return {
        success: false,
        error: error.message,
        code: 'TOKEN_ALREADY_USED',
      };
    }

    return {
      success: false,
      error: 'Email verification failed due to an unexpected error',
      code: 'VERIFICATION_ERROR',
    };
  }
}

/**
 * Check Verification Status
 * Checks if a user's email is verified
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Verification status
 */
export async function checkVerificationStatus(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return {
        verified: false,
        error: 'User not found',
      };
    }

    // Explicitly handle emailVerifiedAt to ensure null not undefined
    const verifiedAt = user.emailVerifiedAt !== undefined ? user.emailVerifiedAt : null;

    logger.info('[EmailVerification] Verification status check', {
      userId,
      emailVerified: user.emailVerified,
      emailVerifiedAtType: typeof user.emailVerifiedAt,
      emailVerifiedAtValue: user.emailVerifiedAt,
      verifiedAtResult: verifiedAt,
    });

    return {
      verified: user.emailVerified,
      email: user.email,
      verifiedAt,
    };
  } catch (error) {
    logger.error('[EmailVerification] Error checking verification status:', error);
    return {
      verified: false,
      error: 'Failed to check verification status',
    };
  }
}

/**
 * Resend Verification Email
 * Creates a new verification token and invalidates old ones
 *
 * @param {string} userId - User ID
 * @param {Object} metadata - Optional metadata (ipAddress, userAgent)
 * @returns {Promise<Object>} New token data
 */
export async function resendVerificationEmail(userId, metadata = {}) {
  try {
    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.emailVerified) {
      throw new AppError('Email is already verified', 500);
    }

    // Invalidate old unused tokens (optional cleanup)
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId,
        usedAt: null,
        expiresAt: { lt: new Date() },
      },
    });

    // Create new token (rate limiting handled in createVerificationToken)
    const tokenData = await createVerificationToken(userId, user.email, metadata);

    logger.info('[EmailVerification] Resent verification email', {
      userId,
      email: user.email,
    });

    return {
      success: true,
      token: tokenData.token,
      expiresAt: tokenData.expiresAt,
    };
  } catch (error) {
    logger.error('[EmailVerification] Error resending verification email:', error);
    throw error;
  }
}

/**
 * Cleanup Expired Tokens
 * Removes expired and used tokens from database
 *
 * @param {Object} options - Cleanup options
 * @returns {Promise<Object>} Cleanup statistics
 */
export async function cleanupExpiredTokens(options = {}) {
  try {
    const { olderThanDays = 30 } = options;

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // Delete expired tokens
    const expiredResult = await prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            AND: [{ usedAt: { not: null } }, { createdAt: { lt: cutoffDate } }],
          },
        ],
      },
    });

    logger.info('[EmailVerification] Token cleanup completed', {
      removedCount: expiredResult.count,
      cutoffDate,
      olderThanDays,
    });

    return {
      removedCount: expiredResult.count,
      cutoffDate,
    };
  } catch (error) {
    logger.error('[EmailVerification] Error cleaning up tokens:', error);
    return {
      removedCount: 0,
      error: error.message,
    };
  }
}

/**
 * Get Verification Token Info (for testing/debugging)
 * Retrieves token information without revealing sensitive data
 *
 * @param {string} token - Verification token
 * @returns {Promise<Object>} Token information
 */
export async function getTokenInfo(token) {
  try {
    const tokenRecord = await prisma.emailVerificationToken.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        createdAt: true,
        usedAt: true,
      },
    });

    if (!tokenRecord) {
      return null;
    }

    const isExpired = new Date() > tokenRecord.expiresAt;
    const isUsed = tokenRecord.usedAt !== null;

    return {
      id: tokenRecord.id,
      email: tokenRecord.email,
      expiresAt: tokenRecord.expiresAt,
      createdAt: tokenRecord.createdAt,
      usedAt: tokenRecord.usedAt,
      isExpired,
      isUsed,
      isValid: !isExpired && !isUsed,
    };
  } catch (error) {
    logger.error('[EmailVerification] Error getting token info:', error);
    return null;
  }
}
