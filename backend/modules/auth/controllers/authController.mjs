import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError, ValidationError } from '../../../errors/index.mjs';
import * as mfaService from '../services/mfaService.mjs';
import { encryptField, decryptField } from '../../../utils/fieldEncryption.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../db/index.mjs';
import { resetAuthRateLimit } from '../../../middleware/authRateLimiter.mjs';
import { generateGenotype } from '../../horses/services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../../horses/services/phenotypeCalculationService.mjs';
import { generateMarkings } from '../../horses/services/markingGenerationService.mjs';
import { createTokenPair, rotateRefreshToken } from '../../../utils/tokenRotationService.mjs';
import { canonicalizeHorseSex } from '../../../../packages/database/horseSexCanonical.mjs';
import {
  createVerificationToken,
  verifyEmailToken,
  resendVerificationEmail,
  checkVerificationStatus,
} from '../../../utils/emailVerificationService.mjs';
import emailService from '../../../utils/emailService.mjs';
import { COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import { issueCsrfToken } from '../../../middleware/csrf.mjs';
import { evictPasswordChangedAtCache } from '../../../middleware/auth.mjs';
import { HORSE_STAT_VALUES } from '../../../constants/schema.mjs';
import { meetsCoppaMinimumAge, COPPA_MIN_AGE_YEARS } from '../../../utils/humanAge.mjs';

// Starter kit seeded for every new user at registration (Story 15-2).
// Exported for test locking — see backend/modules/auth/__tests__/starterKitInventory.test.mjs
// (Equoria-oroi). Any drift in itemId / name / bonus values must be intentional.
export const STARTER_KIT_INVENTORY = [
  {
    id: 'starter-saddle',
    itemId: 'all-purpose-saddle',
    category: 'saddle',
    name: 'All Purpose Saddle',
    bonus: '+5 all disciplines',
    quantity: 1,
  },
  {
    id: 'starter-bridle',
    itemId: 'all-purpose-bridle',
    category: 'bridle',
    name: 'All Purpose Bridle',
    bonus: '+5 all disciplines',
    quantity: 1,
  },
];
// Starter crafting materials — enough to craft at least one Tier 0 recipe (4.3 fix).
// Tier 0 recipes: simple-bridle (leather:1, dye:1), basic-halter (leather:1),
//                 cloth-blanket (cloth:2, dye:2, thread:1).
// Exported for test locking (Equoria-aazk).
export const STARTER_CRAFTING_MATERIALS = { leather: 2, cloth: 2, dye: 2, metal: 0, thread: 1 };

/**
 * Build the server-authoritative starter settings for a brand-new account.
 *
 * Equoria-aazk: the prior `settings || { ...starterDefaults }` form meant ANY
 * client-supplied `settings` body skipped the entire starter grant
 * (inventory + craftingMaterials), leaving the account unable to afford a
 * Tier 0 recipe. It also let a client attempt to self-seed economy fields
 * (craftingMaterials, workshopTier, inventory) at registration.
 *
 * This builder ALWAYS seeds the economy-sensitive starter fields from server
 * constants, regardless of any client input. Registration does not honor a
 * client-supplied `settings` blob: economy state is server-owned, and the
 * route validator never whitelisted `settings` so it has never actually been
 * persisted in practice (sanitizeRequestData strips non-validated fields).
 * Keeping the grant unconditional makes the behavior explicit and removes the
 * footgun, with default-registration output byte-identical to before.
 *
 * @returns {{ completedOnboarding: boolean, inventory: object[], craftingMaterials: object }}
 */
export function buildStarterSettings() {
  return {
    completedOnboarding: false,
    inventory: STARTER_KIT_INVENTORY,
    craftingMaterials: { ...STARTER_CRAFTING_MATERIALS },
  };
}

const STARTER_BONUS_COINS = 500;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Note: password_reset_tokens table + indexes are created by migration
// 20260414001000_add_password_reset_tokens. Runtime DDL was removed
// (Equoria-v0yc) — schema is the migration's responsibility.

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Register a new user and create a corresponding user record.
 */
export const register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, dateOfBirth, money, level, xp } =
      req.body; // Removed 'name', 'role', and 'settings' (Equoria-aazk: starter settings are server-authoritative)

    // Validate input
    if (!username || !email || !password) {
      throw new ValidationError('Username, email, and password are required');
    }

    // COPPA age gate (Equoria-iqzn). Server-authoritative: enforced here,
    // BEFORE any user row (PII) is created, regardless of any client-side
    // check. meetsCoppaMinimumAge fails closed — a missing, invalid, or
    // future DOB returns false, so an unknown-age request is rejected, never
    // silently allowed. The codebase has no verifiable-parental-consent
    // flow, so the COPPA-compliant MVP is a hard age gate (rejection); a
    // consent flow is explicitly out of scope (documented in SECURITY.md
    // A07). The message is intentionally non-leaky: it does not echo the
    // submitted DOB or the computed age.
    if (!meetsCoppaMinimumAge(dateOfBirth)) {
      throw new ValidationError(
        `You must be ${COPPA_MIN_AGE_YEARS} or older to create an account`,
      );
    }

    // Check if user already exists (fast-path check; P2002 catch below handles the
    // race-condition window where two concurrent requests both pass this check)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      // Indicate which identifier conflicts so the frontend can route to the right field
      const emailConflict = existingUser.email === email;
      const conflictMsg = emailConflict
        ? 'User with this email already exists'
        : 'User with this username already exists';
      throw new AppError(conflictMsg, 409);
    }

    // Hash password with configurable salt rounds (default: 12 for 2025 security standards)
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Name construction logic removed - was unused

    // Create user with starter kit in inventory and starter bonus coins
    const startingMoney = (money === undefined ? 1000 : money) + STARTER_BONUS_COINS;
    let user;
    try {
      user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
          // Equoria-iqzn: persisted only after the COPPA age gate above
          // passed, so every stored row is >= 13. Treated as sensitive PII
          // (redacted from audit/request logs).
          dateOfBirth: new Date(dateOfBirth),
          money: startingMoney,
          level: level === undefined ? 1 : level,
          xp: xp === undefined ? 0 : xp,
          // Equoria-aazk: starter settings are ALWAYS server-seeded so a
          // client-supplied settings body can never skip the crafting grant.
          settings: buildStarterSettings(),
        },
      });
    } catch (createError) {
      // P2002 = unique constraint violation — race condition where two concurrent
      // registrations both passed the findFirst check above. Return the same
      // 409 + canonical message format so the frontend isDuplicate check fires.
      if (createError.code === 'P2002') {
        const target = Array.isArray(createError.meta?.target) ? createError.meta.target : [];
        const conflictMsg = target.includes('email')
          ? 'User with this email already exists'
          : 'User with this username already exists';
        throw new AppError(conflictMsg, 409);
      }
      throw createError;
    }

    // Create starter horse for the new user (age 3, basic balanced stats — Story 15-2)
    try {
      const today = new Date();
      const dateOfBirth = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
      const starterHorse = await prisma.horse.create({
        data: {
          name: `${username}'s First Horse`,
          sex: 'Mare',
          age: 3,
          dateOfBirth,
          userId: user.id,
          speed: 17,
          stamina: 17,
          agility: 17,
          balance: 17,
          precision: 17,
          intelligence: 17,
          boldness: 17,
          flexibility: 17,
          obedience: 17,
          focus: 17,
          endurance: 17,
          strength: 17,
          healthStatus: 'Excellent',
        },
      });
      logger.info('[authController.register] Starter horse created', { userId: user.id });

      // Apply coat color via raw SQL — bypasses stale Prisma client schema that uses old
      // field names (genotype/phenotypicMarkings) instead of current (colorGenotype/phenotype).
      try {
        const starterGenotype = generateGenotype(null);
        const starterBaseColor = calculatePhenotype(starterGenotype, null);
        const starterMarkings = generateMarkings(null, starterBaseColor.colorName);
        const starterPhenotype = { ...starterBaseColor, ...starterMarkings };
        await prisma.$executeRaw`
          UPDATE horses
          SET "colorGenotype" = ${JSON.stringify(starterGenotype)}::jsonb,
              phenotype = ${JSON.stringify(starterPhenotype)}::jsonb
          WHERE id = ${starterHorse.id}
        `;
        logger.info('[authController.register] Starter horse color applied', {
          horseId: starterHorse.id,
          color: starterBaseColor.colorName,
        });
      } catch (colorError) {
        // Equoria-a429: was logger.warn (silent fail-warn-drop pattern that
        // produced 111 NULL-phenotype stragglers in the canonical DB). Now
        // logger.error so the regression is visible in production logs +
        // Sentry. Still non-fatal at the request level — the user is
        // registered and the horse exists; the sentinel job in
        // Equoria-fhag is the long-term guard.
        logger.error(
          '[authController.register] FAILED to apply starter horse color (horse will have NULL phenotype until backfilled):',
          {
            horseId: starterHorse.id,
            userId: user.id,
            error: colorError.message,
            stack: colorError.stack,
          },
        );
      }
    } catch (horseError) {
      // Non-fatal — user is registered even if starter horse creation fails
      logger.error('[authController.register] Failed to create starter horse:', horseError);
    }

    // Create new token family for this registration.
    // Equoria-ovp9: pass role so the access token carries it and requireRole()
    // can skip the per-request DB lookup. New users always start with 'user'.
    const tokenPair = await createTokenPair(user.id, undefined, user.role ?? 'user');

    // Create email verification token
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const verificationToken = await createVerificationToken(user.id, user.email, {
      ipAddress,
      userAgent,
    });

    // Send verification email (don't block registration on email send failure)
    try {
      await emailService.sendVerificationEmail(user.email, verificationToken.token, user);
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

    // 21R-AUTH-3: seed CSRF cookie + return token in body so the very
    // first mutation after register skips the /csrf-token round-trip.
    const csrfToken = issueCsrfToken(req, res);

    res.status(201).json({
      success: true,
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
          isNewUser: true,
        },
        // Tokens now in httpOnly cookies, not in response body
        csrfToken,
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

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        money: true,
        level: true,
        xp: true,
        role: true,
        settings: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // OWASP A07 (Equoria-2vwwh): if MFA is enabled, the first factor
    // (password) is verified but NO session tokens are issued. The client
    // must complete the second factor at POST /auth/mfa/challenge with the
    // short-lived signed challenge token below. This deliberately diverges
    // from the non-MFA path so a password alone never yields a session.
    if (user.mfaEnabled) {
      const mfaChallengeToken = jwt.sign(
        { userId: user.id, type: 'mfa_challenge' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '5m' },
      );
      logger.info('[authController.login] MFA required — challenge issued', {
        userId: user.id,
      });
      return res.status(200).json({
        success: true,
        message: 'MFA verification required',
        data: {
          mfaRequired: true,
          mfaChallengeToken,
        },
      });
    }

    // ✅ CWE-384 MITIGATION: Invalidate ALL existing sessions for this user
    // This prevents session fixation attacks by ensuring only the new login session is valid
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new token family for this login session.
    // Equoria-ovp9: pass role so the access token carries it and requireRole()
    // can skip the per-request DB lookup on admin-guarded routes.
    const tokenPair = await createTokenPair(user.id, undefined, user.role);

    // Set httpOnly cookies for security (prevents XSS attacks)
    // Using centralized cookie configuration for consistency
    res.cookie('accessToken', tokenPair.accessToken, COOKIE_OPTIONS.accessToken);
    res.cookie('refreshToken', tokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);

    // 21R-AUTH-3: seed CSRF cookie + return token in body so the very
    // first mutation after login skips the /csrf-token round-trip.
    const csrfToken = issueCsrfToken(req, res);

    // Reset rate limit on successful login (brute force protection)
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    resetAuthRateLimit(ip);

    // Extract onboarding state from settings
    const loginSettings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    const loginCompletedOnboarding = loginSettings.completedOnboarding === true;
    const loginOnboardingStep =
      typeof loginSettings.onboardingStep === 'number' ? loginSettings.onboardingStep : 0;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          money: user.money,
          level: user.level,
          xp: user.xp,
          role: user.role,
          completedOnboarding: loginCompletedOnboarding,
          onboardingStep: loginOnboardingStep,
        },
        // Tokens now in httpOnly cookies, not in response body
        csrfToken,
      },
    });
  } catch (error) {
    logger.error('[authController.login] Error logging in user:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
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

    // 21R-AUTH-3: rotate the CSRF cookie alongside the access/refresh
    // rotation and return the new token in the body so the next mutation
    // after a silent refresh does not have to re-fetch /csrf-token.
    const csrfToken = issueCsrfToken(req, res);

    logger.info('[authController.refreshToken] Token rotation successful');

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        // Tokens now in httpOnly cookies
        rotated: true,
        csrfToken,
      },
    });
  } catch (error) {
    logger.error('[authController.refreshToken] Error refreshing token:', error);
    if (AppError.isAppError(error)) {
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
        money: true,
        level: true,
        xp: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Extract completedOnboarding, onboardingStep, milestones, notifications, display from settings
    const settings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    const completedOnboarding = settings.completedOnboarding === true;
    const onboardingStep =
      typeof settings.onboardingStep === 'number' ? settings.onboardingStep : 0;
    const milestones = settings.milestones ?? {};
    const notifications =
      typeof settings.notifications === 'object' && settings.notifications !== null
        ? settings.notifications
        : null;
    const display =
      typeof settings.display === 'object' && settings.display !== null ? settings.display : null;

    // Story 21S-5: flatten user preferences for the /settings page
    const preferences =
      typeof settings.preferences === 'object' && settings.preferences !== null
        ? settings.preferences
        : {};

    // Auth state changes (onboarding, balance, role) must never be served from
    // browser HTTP cache — a stale cached response causes OnboardingGuard to
    // redirect incorrectly on full-page navigations (e.g. page.goto('/bank')).
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
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
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          completedOnboarding,
          onboardingStep,
          milestones,
          notifications,
          display,
          preferences,
        },
      },
    });
  } catch (error) {
    logger.error('[authController.getProfile] Error retrieving profile:', error);
    if (AppError.isAppError(error)) {
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
    const { username, email, notifications, display } = req.body;

    const hasPreferenceUpdate =
      (notifications !== undefined && notifications !== null) ||
      (display !== undefined && display !== null);

    // Validate input
    if (!username && !email && !hasPreferenceUpdate) {
      throw new ValidationError('At least one field is required');
    }

    // Check for existing username or email (only if those are being changed)
    if (username || email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: email || '' }, { username: username || '' }],
          NOT: {
            id: req.user.id,
          },
        },
      });

      if (existingUser) {
        // Indicate which identifier conflicts. Use canonical phrasing so the
        // frontend isDuplicate check ("already exists" | "already in use" | "taken")
        // fires reliably. 409 Conflict matches the resource-conflict semantics and
        // aligns with other duplicate-resource errors in the app.
        const emailConflict = email && existingUser.email === email;
        const conflictMsg = emailConflict
          ? 'User with this email already exists'
          : 'User with this username already exists';
        throw new AppError(conflictMsg, 409);
      }
    }

    // Validate preference payloads: must be plain objects of primitives
    const isPlainPrefs = value => {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
      }
      return Object.values(value).every(
        v => typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number',
      );
    };

    if (notifications !== undefined && notifications !== null && !isPlainPrefs(notifications)) {
      throw new ValidationError('notifications must be an object of primitive values');
    }
    if (display !== undefined && display !== null && !isPlainPrefs(display)) {
      throw new ValidationError('display must be an object of primitive values');
    }

    // Merge preferences into existing settings JSON without clobbering onboarding state
    let settingsUpdate;
    if (hasPreferenceUpdate) {
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { settings: true },
      });
      const currentSettings =
        typeof currentUser?.settings === 'object' && currentUser.settings !== null
          ? currentUser.settings
          : {};
      settingsUpdate = { ...currentSettings };
      if (notifications !== undefined && notifications !== null) {
        settingsUpdate.notifications = {
          ...(currentSettings.notifications ?? {}),
          ...notifications,
        };
      }
      if (display !== undefined && display !== null) {
        settingsUpdate.display = { ...(currentSettings.display ?? {}), ...display };
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        username: username || undefined,
        email: email || undefined,
        ...(settingsUpdate ? { settings: settingsUpdate } : {}),
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
        settings: true,
      },
    });

    const updatedSettings =
      typeof updatedUser.settings === 'object' && updatedUser.settings !== null
        ? updatedUser.settings
        : {};

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          notifications: updatedSettings.notifications ?? null,
          display: updatedSettings.display ?? null,
        },
      },
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
      success: true,
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

    // Update password in database. Stamp passwordChangedAt so the JWT-verify
    // middleware (CWE-613) can reject any access tokens issued before now —
    // closes the residual ≤access-token-TTL window where a stolen token would
    // otherwise outlive the password rotation.
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    // Equoria-2bbf: evict the per-user passwordChangedAt cache so the next
    // authenticated request reads the fresh DB value immediately rather than
    // waiting up to ~30s for TTL expiry.
    evictPasswordChangedAtCache(req.user.id);

    // ✅ CWE-613 MITIGATION: Invalidate ALL refresh tokens across all devices
    // (access tokens are invalidated separately via the passwordChangedAt
    // check in authenticateToken). Forces re-login everywhere after rotation.
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
      success: true,
      message: 'Password changed successfully. Please login again.',
      data: {
        sessionInvalidated: true,
      },
    });
  } catch (error) {
    logger.error('[authController.changePassword] Error changing password:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Password change failed due to an unexpected error.', 500));
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, username: true, firstName: true },
    });

    const responseMessage =
      'If an account exists for that email, password reset instructions have been sent.';

    if (!user) {
      logger.info('[authController.forgotPassword] Password reset requested for unknown email', {
        email,
      });
      return res.status(200).json({
        success: true,
        message: responseMessage,
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashPasswordResetToken(rawToken);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const ttlSeconds = Math.floor(PASSWORD_RESET_TOKEN_TTL_MS / 1000);

    // Invalidate existing unused tokens and insert the new one atomically.
    // The password_reset_tokens table is created by migration
    // 20260414001000_add_password_reset_tokens — no runtime DDL needed.
    // expiresAt uses NOW() server-side to avoid client timezone serialization issues.
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        `UPDATE password_reset_tokens
         SET "usedAt" = NOW()
         WHERE "userId" = $1 AND "usedAt" IS NULL`,
        user.id,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO password_reset_tokens
           ("tokenHash", "userId", email, "expiresAt", "ipAddress", "userAgent")
         VALUES ($1, $2, $3, NOW() + ($4 || ' seconds')::interval, $5, $6)`,
        tokenHash,
        user.id,
        user.email,
        String(ttlSeconds),
        ipAddress,
        userAgent,
      );
    });

    await emailService.sendPasswordResetEmail(user.email, rawToken, user);

    logger.info('[authController.forgotPassword] Password reset email prepared', {
      userId: user.id,
      email: user.email,
    });

    return res.status(200).json({
      success: true,
      message: responseMessage,
    });
  } catch (error) {
    logger.error('[authController.forgotPassword] Error:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Failed to request password reset.', 500));
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, password } = req.body;
    const candidatePassword = newPassword || password;

    if (!token || !candidatePassword) {
      throw new ValidationError('Token and new password are required');
    }
    if (candidatePassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long');
    }

    const tokenHash = hashPasswordResetToken(token);
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(candidatePassword, saltRounds);

    // Look up a valid (non-expired, non-used) token — expiry checked server-side with
    // NOW() to avoid client timezone serialization issues with TIMESTAMP columns.
    const rows = await prisma.$queryRawUnsafe(
      `SELECT id, "userId"
       FROM password_reset_tokens
       WHERE "tokenHash" = $1
         AND "usedAt" IS NULL
         AND "expiresAt" > NOW()`,
      tokenHash,
    );
    const resetToken = rows[0];
    if (!resetToken) {
      throw new AppError('Password reset token is invalid or expired', 400);
    }

    // Apply writes atomically: update password, mark token used, invalidate sessions.
    // passwordChangedAt is stamped so the JWT-verify middleware (CWE-613) rejects
    // any access tokens issued before this reset — closes the residual window.
    await prisma.$transaction(async tx => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword, passwordChangedAt: new Date() },
      });
      await tx.$executeRawUnsafe(
        'UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE id = $1',
        resetToken.id,
      );
      await tx.refreshToken.deleteMany({
        where: { userId: resetToken.userId },
      });
    });

    // Equoria-2bbf: evict the per-user passwordChangedAt cache so the next
    // authenticated request reads the fresh DB value immediately.
    evictPasswordChangedAtCache(resetToken.userId);

    res.clearCookie('accessToken', CLEAR_COOKIE_OPTIONS.accessToken);
    res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS.refreshToken);

    logger.info('[authController.resetPassword] Password reset successfully', {
      userId: resetToken.userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please login again.',
    });
  } catch (error) {
    logger.error('[authController.resetPassword] Error:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    next(new AppError('Failed to reset password.', 500));
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
      await emailService.sendWelcomeEmail(result.user.email, result.user);
    } catch (emailError) {
      logger.error('[authController.verifyEmail] Failed to send welcome email:', emailError);
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
    logger.error('[authController.verifyEmail] Error verifying email:', error);
    if (AppError.isAppError(error)) {
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
      await emailService.sendVerificationEmail(user.email, result.token, user);
    } catch (emailError) {
      logger.error('[authController.resendVerification] Failed to send email:', emailError);
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
    logger.error('[authController.resendVerification] Error resending verification:', error);
    if (AppError.isAppError(error)) {
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
      success: true,
      data: {
        verified: status.verified,
        email: status.email,
        verifiedAt: status.verifiedAt ?? null, // Ensure null instead of undefined
      },
    });
  } catch (error) {
    logger.error('[authController.getVerificationStatus] Error checking status:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to check verification status due to an unexpected error.', 500));
  }
};

/**
 * POST /api/v1/auth/complete-onboarding
 * Marks the authenticated user's onboarding as complete in User.settings.
 */
export const completeOnboarding = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentSettings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};

    await prisma.user.update({
      where: { id: userId },
      data: { settings: { ...currentSettings, completedOnboarding: true } },
    });

    logger.info(`[authController.completeOnboarding] User ${userId} completed onboarding`);

    res.status(200).json({
      success: true,
      message: 'Onboarding completed',
      data: { completedOnboarding: true },
    });
  } catch (error) {
    logger.error('[authController.completeOnboarding] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to complete onboarding.', 500));
  }
};

/**
 * POST /api/v1/auth/advance-onboarding
 * Increments the authenticated user's onboarding step.
 * When the user reaches step 10, also sets completedOnboarding: true.
 * Used by the OnboardingSpotlight component to drive the 10-step guided tour.
 */
import { createRequire } from 'module';
const requireJson = createRequire(import.meta.url);
const BREED_STARTER_STATS = requireJson('../../../data/breedStarterStats.json');

/**
 * Generate breed-specific starter stats using mean + std_dev from breed data.
 * Uses normal distribution (Box-Muller) around the breed's mean for each stat.
 * Clamps each stat to [1, 100] and ensures total does not exceed 200.
 */
function generateStarterStats(breedName) {
  const statNames = HORSE_STAT_VALUES;
  const breedData = breedName ? BREED_STARTER_STATS[breedName] : null;

  const stats = {};

  if (breedData) {
    // Box-Muller transform for normal distribution
    function normalRandom(mean, std) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return Math.round(mean + z * std);
    }

    for (const stat of statNames) {
      const def = breedData[stat];
      if (def) {
        stats[stat] = Math.max(1, Math.min(100, normalRandom(def.mean, def.std)));
      } else {
        stats[stat] = Math.max(1, Math.min(100, normalRandom(15, 3)));
      }
    }

    // Enforce total cap of 200
    let total = Object.values(stats).reduce((a, b) => a + b, 0);
    while (total > 200) {
      // Reduce the highest stat by 1
      const highest = statNames.reduce((a, b) => (stats[a] >= stats[b] ? a : b));
      if (stats[highest] > 1) {
        stats[highest]--;
        total--;
      } else {
        break;
      }
    }
  } else {
    // Fallback: balanced stats, ~17 each across 12 stats
    statNames.forEach(s => {
      stats[s] = 17;
    });
  }

  return stats;
}

export const advanceOnboarding = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { horseName, breedId, gender } = req.body || {};
    const hasHorseCustomization =
      typeof horseName === 'string' || breedId !== undefined || typeof gender === 'string';
    const trimmedHorseName = typeof horseName === 'string' ? horseName.trim().slice(0, 40) : '';
    const normalizedBreedId =
      breedId !== undefined && Number.isInteger(Number(breedId)) ? Number(breedId) : null;
    // Canonicalize the client-supplied gender to Title Case. The frontend
    // currently sends Title Case ('Mare' / 'Stallion'), but the canonicalizer
    // accepts any casing so this stays robust if client typings drift.
    // Only adult sexes are valid for starter-horse selection.
    let normalizedGender = null;
    if (typeof gender === 'string') {
      try {
        const canonical = canonicalizeHorseSex(gender);
        if (canonical === 'Mare' || canonical === 'Stallion') {
          normalizedGender = canonical;
        }
      } catch {
        normalizedGender = null;
      }
    }

    if (hasHorseCustomization) {
      if (!trimmedHorseName) {
        throw new AppError('Starter horse name is required.', 400);
      }
      if (!normalizedBreedId) {
        throw new AppError('Starter horse breed is required.', 400);
      }
      if (!normalizedGender) {
        throw new AppError('Starter horse gender is required.', 400);
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentSettings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    const currentStep =
      typeof currentSettings.onboardingStep === 'number' ? currentSettings.onboardingStep : 0;
    const newStep = hasHorseCustomization ? 10 : currentStep + 1;
    const isComplete = newStep >= 10;

    const updatedSettings = {
      ...currentSettings,
      onboardingStep: newStep,
      ...(isComplete ? { completedOnboarding: true } : {}),
    };

    let persistedHorse = null;
    await prisma.$transaction(async tx => {
      if (hasHorseCustomization) {
        const breed = await tx.breed.findUnique({
          where: { id: normalizedBreedId },
          select: { id: true, name: true },
        });

        if (!breed) {
          throw new AppError('Selected starter horse breed was not found.', 400);
        }

        const updateData = {
          name: trimmedHorseName,
          breedId: breed.id,
          sex: normalizedGender,
          ...generateStarterStats(breed.name),
        };

        const starterHorse = await tx.horse.findFirst({
          where: { userId },
          orderBy: { id: 'asc' },
        });

        if (starterHorse) {
          persistedHorse = await tx.horse.update({
            where: { id: starterHorse.id },
            data: updateData,
            include: { breed: { select: { id: true, name: true } } },
          });
        } else {
          const today = new Date();
          const dateOfBirth = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
          persistedHorse = await tx.horse.create({
            data: {
              ...updateData,
              age: 3,
              dateOfBirth,
              userId,
              healthStatus: 'Excellent',
            },
            include: { breed: { select: { id: true, name: true } } },
          });
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { settings: updatedSettings },
      });
    });

    if (persistedHorse) {
      logger.info(
        `[authController.advanceOnboarding] Persisted starter horse ${persistedHorse.id} for user ${userId}`,
      );
    }

    logger.info(
      `[authController.advanceOnboarding] User ${userId} advanced to step ${newStep}${isComplete ? ' (onboarding complete)' : ''}`,
    );

    res.status(200).json({
      success: true,
      message: isComplete ? 'Onboarding complete' : 'Onboarding step advanced',
      data: {
        step: newStep,
        completed: isComplete,
        horse: persistedHorse
          ? {
              id: persistedHorse.id,
              name: persistedHorse.name,
              breedId: persistedHorse.breedId,
              breed: persistedHorse.breed?.name ?? null,
              gender: persistedHorse.sex,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('[authController.advanceOnboarding] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to advance onboarding.', 500));
  }
};

/**
 * Whitelisted preference keys persisted under `settings.preferences`.
 *
 * Shape mirrors what `frontend/src/pages/SettingsPage.tsx` renders:
 *   - Notification toggles (email/in-app)
 *   - Display toggles (accessibility + density)
 *
 * Story 21S-5 — when adding a new preference, extend this list AND the
 * frontend types; unknown keys are rejected by the validator.
 */
const ALLOWED_PREFERENCE_KEYS = [
  // Email notifications
  'emailCompetition',
  'emailBreeding',
  'emailSystem',
  // In-app notifications
  'inAppTraining',
  'inAppAchievements',
  'inAppNews',
  // Display / accessibility
  'reducedMotion',
  'highContrast',
  'compactCards',
  // Sound
  'soundEnabled',
];

/**
 * PATCH /api/v1/auth/profile/preferences
 *
 * Merges the request body into the authenticated user's stored preferences.
 * Only whitelisted keys are accepted and each value must be boolean. Returns
 * the full merged preferences object so the client can update its cache
 * without re-fetching.
 *
 * Story 21S-5: closes the /settings persistence gap.
 */
export const updateUserPreferences = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }
    const body = req.body || {};
    const submittedKeys = Object.keys(body);

    if (submittedKeys.length === 0) {
      throw new AppError('At least one preference must be provided', 400);
    }

    // Whitelist validation — reject unknown keys
    const unknownKeys = submittedKeys.filter(k => !ALLOWED_PREFERENCE_KEYS.includes(k));
    if (unknownKeys.length > 0) {
      throw new AppError(`Unknown preference key(s): ${unknownKeys.join(', ')}`, 400);
    }

    // Type validation — every allowed key must be boolean
    for (const k of submittedKeys) {
      if (typeof body[k] !== 'boolean') {
        throw new AppError(`Preference '${k}' must be a boolean`, 400);
      }
    }

    // Merge into existing settings.preferences inside a transaction.
    // The transaction provides atomicity for the read-modify-write; a SELECT
    // FOR UPDATE is omitted because pg's default READ COMMITTED isolation and
    // the update's WHERE clause provide sufficient protection for this
    // non-critical preference toggle (CodeRabbit Major 2026-04-20 original
    // concern addressed via transactional atomicity rather than row locking).
    const mergedPreferences = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({
        where: { id: req.user.id },
        select: { settings: true },
      });
      if (!user) {
        throw new AppError('User not found', 404);
      }
      const currentSettings =
        typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
      const currentPreferences =
        typeof currentSettings.preferences === 'object' && currentSettings.preferences !== null
          ? currentSettings.preferences
          : {};

      const merged = {
        ...currentPreferences,
        ...body,
      };

      const updatedSettings = {
        ...currentSettings,
        preferences: merged,
      };

      await tx.user.update({
        where: { id: req.user.id },
        data: { settings: updatedSettings },
      });

      return merged;
    });

    return res.status(200).json({
      success: true,
      data: { preferences: mergedPreferences },
    });
  } catch (error) {
    logger.error(`[authController.updateUserPreferences] Error: ${error.message}`);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to update preferences.', 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────
// TOTP MFA (OWASP A07, Equoria-2vwwh)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Issue the access/refresh/CSRF triple for a fully-authenticated user and
 * write the session payload to the response. Shared by the non-MFA login
 * path and the post-challenge path so both produce identical sessions.
 */
async function issueAuthenticatedSession(req, res, user) {
  // CWE-384: invalidate all existing sessions on a new login.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  const tokenPair = await createTokenPair(user.id, undefined, user.role);
  res.cookie('accessToken', tokenPair.accessToken, COOKIE_OPTIONS.accessToken);
  res.cookie('refreshToken', tokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);
  const csrfToken = issueCsrfToken(req, res);

  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  resetAuthRateLimit(ip);

  const loginSettings =
    typeof user.settings === 'object' && user.settings !== null ? user.settings : {};

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      money: user.money,
      level: user.level,
      xp: user.xp,
      role: user.role,
      completedOnboarding: loginSettings.completedOnboarding === true,
      onboardingStep:
        typeof loginSettings.onboardingStep === 'number' ? loginSettings.onboardingStep : 0,
    },
    csrfToken,
  };
}

/**
 * POST /api/v1/auth/mfa/enroll  (authenticated)
 *
 * Generates a fresh TOTP secret + otpauth provisioning URL and STAGES it on
 * the user (mfaSecret set, mfaEnabled stays false). MFA is not active until
 * the user proves possession via /mfa/verify-enrollment.
 */
export const mfaEnroll = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, mfaEnabled: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.mfaEnabled) {
      throw new AppError('MFA is already enabled for this account', 409);
    }

    const { secret, otpauthUrl } = mfaService.generateSecret(user.email);
    await prisma.user.update({
      where: { id: user.id },
      // Encrypt the TOTP shared secret at rest (Equoria-yi13v, A07).
      data: { mfaSecret: encryptField(secret), mfaEnabled: false },
    });

    logger.info('[authController.mfaEnroll] MFA secret staged', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'MFA secret generated. Verify a token to enable.',
      data: { secret, otpauthUrl },
    });
  } catch (error) {
    logger.error('[authController.mfaEnroll] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to start MFA enrollment.', 500));
  }
};

/**
 * POST /api/v1/auth/mfa/verify-enrollment  (authenticated)
 *
 * Confirms the staged secret by verifying a first TOTP. On success: sets
 * mfaEnabled=true and returns 10 single-use recovery codes ONCE (hashed at
 * rest). Idempotency: if already enabled, rejects.
 */
export const mfaVerifyEnrollment = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }
    const { token } = req.body || {};
    if (!token) {
      throw new AppError('TOTP token is required', 400);
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, mfaSecret: true, mfaEnabled: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (user.mfaEnabled) {
      throw new AppError('MFA is already enabled for this account', 409);
    }
    if (!user.mfaSecret) {
      throw new AppError('No MFA enrollment in progress. Call /mfa/enroll first.', 400);
    }
    if (!mfaService.verifyToken(token, decryptField(user.mfaSecret))) {
      throw new AppError('Invalid TOTP token', 401);
    }

    const { plaintext, hashed } = await mfaService.generateRecoveryCodes();
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true, mfaRecoveryCodes: hashed },
    });

    logger.info('[authController.mfaVerifyEnrollment] MFA enabled', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'MFA enabled. Store these recovery codes — they are shown only once.',
      data: { recoveryCodes: plaintext },
    });
  } catch (error) {
    logger.error('[authController.mfaVerifyEnrollment] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to verify MFA enrollment.', 500));
  }
};

/**
 * POST /api/v1/auth/mfa/challenge  (public — second factor of login)
 *
 * Consumes the short-lived signed mfaChallengeToken from /auth/login and
 * verifies EITHER a TOTP `token` OR a single-use `recoveryCode`. On success,
 * issues the real session triple (identical to non-MFA login).
 */
export const mfaChallenge = async (req, res, next) => {
  try {
    const { mfaChallengeToken, token, recoveryCode } = req.body || {};
    if (!mfaChallengeToken) {
      throw new AppError('mfaChallengeToken is required', 400);
    }
    if (!token && !recoveryCode) {
      throw new AppError('A TOTP token or a recovery code is required', 400);
    }

    let payload;
    try {
      payload = jwt.verify(mfaChallengeToken, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      });
    } catch {
      throw new AppError('MFA challenge expired or invalid. Please log in again.', 401);
    }
    if (!payload || payload.type !== 'mfa_challenge' || !payload.userId) {
      throw new AppError('MFA challenge expired or invalid. Please log in again.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        money: true,
        level: true,
        xp: true,
        role: true,
        settings: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodes: true,
      },
    });
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new AppError('MFA is not enabled for this account', 401);
    }

    let verified = false;
    if (token) {
      verified = mfaService.verifyToken(token, decryptField(user.mfaSecret));
    }
    if (!verified && recoveryCode) {
      const stored = Array.isArray(user.mfaRecoveryCodes) ? user.mfaRecoveryCodes : [];
      const result = await mfaService.verifyRecoveryCode(recoveryCode, stored);
      if (result.valid) {
        verified = true;
        // Persist single-use consumption immediately.
        await prisma.user.update({
          where: { id: user.id },
          data: { mfaRecoveryCodes: result.updatedCodes },
        });
      }
    }

    if (!verified) {
      throw new AppError('Invalid MFA credentials', 401);
    }

    const sessionData = await issueAuthenticatedSession(req, res, user);
    logger.info('[authController.mfaChallenge] MFA challenge passed', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: sessionData,
    });
  } catch (error) {
    logger.error('[authController.mfaChallenge] Error:', error);
    if (AppError.isAppError(error) || error instanceof ValidationError) {
      return next(error);
    }
    return next(new AppError('MFA challenge failed due to an unexpected error.', 500));
  }
};

/**
 * POST /api/v1/auth/mfa/disable  (authenticated)
 *
 * Disables MFA after re-verifying a current TOTP. Clears mfaSecret,
 * mfaEnabled, and mfaRecoveryCodes so re-enrollment starts clean.
 */
export const mfaDisable = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Authentication required', 401);
    }
    const { token } = req.body || {};
    if (!token) {
      throw new AppError('Current TOTP token is required to disable MFA', 400);
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    });
    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new AppError('MFA is not enabled for this account', 400);
    }
    if (!mfaService.verifyToken(token, decryptField(user.mfaSecret))) {
      throw new AppError('Invalid TOTP token', 401);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: null },
    });

    logger.info('[authController.mfaDisable] MFA disabled', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'MFA disabled',
      data: { mfaEnabled: false },
    });
  } catch (error) {
    logger.error('[authController.mfaDisable] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to disable MFA.', 500));
  }
};
