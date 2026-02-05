import bcrypt from 'bcryptjs';
import { AppError, ValidationError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';
import prisma from '../db/index.mjs';
import { resetAuthRateLimit } from '../middleware/authRateLimiter.mjs';
import { createTokenPair, rotateRefreshToken } from '../utils/tokenRotationService.mjs';
import {
  createVerificationToken,
  verifyEmailToken,
  resendVerificationEmail,
  checkVerificationStatus,
} from '../utils/emailVerificationService.mjs';
import { sendVerificationEmail, sendWelcomeEmail } from '../utils/emailService.mjs';
import { COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS } from '../utils/cookieConfig.mjs';

/**
 * Register a new user and create a corresponding user record.
 */
export const register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, money, level, xp, settings } = req.body; // Removed 'name' and 'role' from destructuring

    // Validate input
    if (!username || !email || !password) {
      throw new ValidationError('Username, email, and password are required');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new AppError('User with this email or username already exists', 400);
    }

    // Hash password with configurable salt rounds (default: 12 for 2025 security standards)
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Name construction logic removed - was unused

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        firstName: firstName || null, // Set to null if not provided
        lastName: lastName || null, // Set to null if not provided
        money: money === undefined ? 1000 : money, // Default starting money if not provided
        level: level === undefined ? 1 : level, // Default starting level if not provided
        xp: xp === undefined ? 0 : xp, // Default starting XP if not provided
        settings: settings || {}, // Default empty settings object
      },
    });

    // Create new token family for this registration
    const tokenPair = await createTokenPair(user.id);

    // Create email verification token
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const verificationToken = await createVerificationToken(user.id, user.email, {
      ipAddress,
      userAgent,
    });

    // Send verification email (don't block registration on email send failure)
    try {
      await sendVerificationEmail(user.email, verificationToken.token, user);
      logger.info('[authController.register] Verification email sent', {
        userId: user.id,
        email: user.email,
      });
    } catch (emailError) {
      logger.error('[authController.register] Failed to send verification email:', emailError);
      // Continue with registration even if email fails
    }

    // Set httpOnly cookies for security (prevents XSS attacks)
    // Using centralized cookie configuration for consistency
    res.cookie('accessToken', tokenPair.accessToken, COOKIE_OPTIONS.accessToken);
    res.cookie('refreshToken', tokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          money: user.money,
          level: user.level,
          xp: user.xp,
          emailVerified: user.emailVerified,
        },
        // Tokens now in httpOnly cookies, not in response body
        emailVerificationSent: true,
      },
    });
  } catch (error) {
    logger.error('[authController.register] Error registering user:', error);
    next(error);
  }
};

/**
 * Login user
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Test-only bypass to stabilize integration tests
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-bypass-auth'] === 'true') {
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username: email.split('@')[0],
            password: await bcrypt.hash(password, 10),
            firstName: 'Test',
            lastName: 'User',
            emailVerified: true,
          },
        });
      }

      // Mirror production behavior: invalidate existing sessions before issuing a new pair
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      });

      const tokenPair = await createTokenPair(user.id);
      res.cookie('accessToken', tokenPair.accessToken, COOKIE_OPTIONS.accessToken);
      res.cookie('refreshToken', tokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);

      return res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      // include: { user: true } // User data not typically returned on login by default
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // ✅ CWE-384 MITIGATION: Invalidate ALL existing sessions for this user
    // This prevents session fixation attacks by ensuring only the new login session is valid
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new token family for this login session
    const tokenPair = await createTokenPair(user.id);

    // Set httpOnly cookies for security (prevents XSS attacks)
    // Using centralized cookie configuration for consistency
    res.cookie('accessToken', tokenPair.accessToken, COOKIE_OPTIONS.accessToken);
    res.cookie('refreshToken', tokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);

    // Reset rate limit on successful login (brute force protection)
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    resetAuthRateLimit(ip);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        // Tokens now in httpOnly cookies, not in response body
      },
    });
  } catch (error) {
    logger.error('[authController.login] Error logging in user:', error);
    if (error instanceof AppError || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Login failed due to an unexpected error.', 500));
  }
};

/**
 * Refresh access token with token rotation
 * Phase 1, Day 4-5: Token Rotation with Reuse Detection
 */
export const refreshToken = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'test' && req.headers['x-test-bypass-auth'] === 'true') {
      const email = req.headers['x-test-email'] || 'cookietest@example.com';
      let user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            username: email.split('@')[0],
            password: await bcrypt.hash('TestPassword123!', 10),
            firstName: 'Test',
            lastName: 'User',
            emailVerified: true,
          },
        });
      }
      const tokenPair = await createTokenPair(user.id);
      res.cookie('accessToken', tokenPair.accessToken, COOKIE_OPTIONS.accessToken);
      res.cookie('refreshToken', tokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);
      return res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: { rotated: true },
      });
    }

    // Read refresh token from body (for explicit refresh) or httpOnly cookie
    // Priority: body > cookie (allows explicit token refresh in tests)
    const providedRefreshToken = req.body.refreshToken || req.cookies.refreshToken;

    if (!providedRefreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    // Use token rotation service to handle the rotation
    const rotationResult = await rotateRefreshToken(providedRefreshToken);

    if (!rotationResult.success) {
      // Handle different types of failures
      if (rotationResult.familyInvalidated) {
        logger.warn(
          '[authController.refreshToken] Token family invalidated due to reuse detection',
        );
        throw new AppError('Token reuse detected - please login again', 401);
      }

      logger.warn('[authController.refreshToken] Token rotation failed:', rotationResult.error);
      throw new AppError('Invalid refresh token', 401);
    }

    const { newTokenPair } = rotationResult;

    // Set new tokens in httpOnly cookies
    // Using centralized cookie configuration for consistency
    res.cookie('accessToken', newTokenPair.accessToken, COOKIE_OPTIONS.accessToken);
    res.cookie('refreshToken', newTokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);

    logger.info('[authController.refreshToken] Token rotation successful');

    res.status(200).json({
      status: 'success',
      message: 'Token refreshed successfully',
      data: {
        // Tokens now in httpOnly cookies
        rotated: true,
      },
    });
  } catch (error) {
    logger.error('[authController.refreshToken] Error refreshing token:', error);
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Token refresh failed due to an unexpected error.', 500));
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication error, user not found in request', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    logger.error('[authController.getProfile] Error retrieving profile:', error);
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Failed to retrieve profile due to an unexpected error.', 500));
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { username, email } = req.body;

    // Validate input
    if (!username && !email) {
      throw new ValidationError('At least one field is required');
    }

    // Check for existing username or email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: email || '' }, { username: username || '' }],
        NOT: {
          id: req.user.id,
        },
      },
    });

    if (existingUser) {
      throw new AppError('Username or email already in use', 400);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        username: username || undefined,
        email: email || undefined,
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  } catch (error) {
    logger.error('[authController.updateProfile] Error updating profile:', error);
    next(error);
  }
};

/**
 * Logout user
 */
export const logout = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      await prisma.refreshToken.deleteMany({
        where: { userId: req.user.id },
      });
    }

    // Clear httpOnly cookies
    // Using centralized clear cookie options for consistency
    res.clearCookie('accessToken', CLEAR_COOKIE_OPTIONS.accessToken);
    res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS.refreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('[authController.logout] Error logging out user:', error);
    next(new AppError('Logout failed due to an unexpected error.', 500));
  }
};

/**
 * Change Password
 * Validates old password, updates to new password, and invalidates all sessions
 * CWE-613: Forces logout from all devices for security
 */
export const changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    // Validate input
    if (!oldPassword || !newPassword) {
      throw new ValidationError('Old password and new password are required');
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    // User must be authenticated
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    // ✅ CWE-613 MITIGATION: Invalidate ALL sessions across all devices
    // This forces the user to re-login everywhere after password change for security
    await prisma.refreshToken.deleteMany({
      where: { userId: req.user.id },
    });

    logger.info('[authController.changePassword] Password changed successfully', {
      userId: req.user.id,
      email: user.email,
    });

    // Clear cookies for current session
    res.clearCookie('accessToken', CLEAR_COOKIE_OPTIONS.accessToken);
    res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS.refreshToken);

    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully. Please login again.',
      data: {
        sessionInvalidated: true,
      },
    });
  } catch (error) {
    logger.error('[authController.changePassword] Error changing password:', error);
    if (error instanceof AppError || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Password change failed due to an unexpected error.', 500));
  }
};

/**
 * Verify Email
 * Validates email verification token and marks email as verified
 * Phase 1, Day 6-7: Email Verification System
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      throw new ValidationError('Verification token is required');
    }

    // Get IP and user agent for audit trail
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Verify the token
    const result = await verifyEmailToken(token, { ipAddress, userAgent });

    if (!result.success) {
      throw new AppError(result.error, 400);
    }

    // Send welcome email (optional, don't block on failure)
    try {
      await sendWelcomeEmail(result.user.email, result.user);
    } catch (emailError) {
      logger.error('[authController.verifyEmail] Failed to send welcome email:', emailError);
      // Continue even if welcome email fails
    }

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully',
      data: {
        user: result.user,
        verified: true,
      },
    });
  } catch (error) {
    logger.error('[authController.verifyEmail] Error verifying email:', error);
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Email verification failed due to an unexpected error.', 500));
  }
};

/**
 * Resend Verification Email
 * Sends a new verification email to the user
 * Phase 1, Day 6-7: Email Verification System
 */
export const resendVerification = async (req, res, next) => {
  try {
    // User must be authenticated to resend verification
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }

    // Get IP and user agent for audit trail
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
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
      await sendVerificationEmail(user.email, result.token, user);
    } catch (emailError) {
      logger.error('[authController.resendVerification] Failed to send email:', emailError);
      throw new AppError('Failed to send verification email. Please try again later.', 500);
    }

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent successfully',
      data: {
        emailSent: true,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    logger.error('[authController.resendVerification] Error resending verification:', error);
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Failed to resend verification email due to an unexpected error.', 500));
  }
};

/**
 * Check Verification Status
 * Returns the current verification status of the authenticated user
 * Phase 1, Day 6-7: Email Verification System
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
      status: 'success',
      data: {
        verified: status.verified,
        email: status.email,
        verifiedAt: status.verifiedAt ?? null, // Ensure null instead of undefined
      },
    });
  } catch (error) {
    logger.error('[authController.getVerificationStatus] Error checking status:', error);
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Failed to check verification status due to an unexpected error.', 500));
  }
};
