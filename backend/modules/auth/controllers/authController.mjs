import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError, ValidationError } from '../../../errors/index.mjs';

// Equoria-gm4fg: Constant-time placeholder hash used when `email` does not
// match any user. We always run `bcrypt.compare(password, FAKE_HASH)` so the
// unknown-email path has the same wall-clock cost as the known-email/wrong-
// password path. Without this, an attacker can enumerate registered emails by
// measuring response time (no-user ~ instant, real-user ~ 80–150ms).
//
// The placeholder is a real bcrypt hash of a random ~16-byte secret generated
// at module import. It is NEVER comparable to any real password (the
// passphrase is never persisted and only the hash is retained), so a
// successful compare here is structurally impossible. Cost is fixed to 12 to
// match the production `BCRYPT_SALT_ROUNDS` default (see lines 151, 853, 993)
// — the env override is intentionally NOT read here, because the timing
// envelope must depend only on the static-cost-12 path and not vary with
// per-deploy configuration changes that could re-introduce the oracle.
const FAKE_BCRYPT_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
// Equoria-vhv3i: mfaService / mfaLockoutService / mfaReplayProtectionService /
// fieldEncryption imports moved to mfaController.mjs with the MFA endpoints.
// Only the login handler below still touches MFA (it issues the short-lived
// mfaChallengeToken JWT when user.mfaEnabled is true), which only needs `jwt`.
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { resetAuthRateLimit } from '../../../middleware/authRateLimiter.mjs';
import { createTokenPair, rotateRefreshToken } from '../../../utils/tokenRotationService.mjs';
// Equoria-vhv3i: starter-horse creation extracted into
// services/onboardingService.mjs (AC item 2). register() now calls
// createStarterHorseForNewUser() instead of inlining the breed lookup +
// horse create + raw SQL color/temperament updates. The horse-color and
// temperament-generator imports moved with it. The MS_PER_GAME_YEAR /
// canonicalizeHorseSex / HORSE_STAT_VALUES / evictPasswordChangedAtCache
// imports moved to the sub-controllers that own them (onboardingController +
// passwordController).
import { createStarterHorseForNewUser } from '../services/onboardingService.mjs';
// Equoria-vhv3i: verifyEmailToken / resendVerificationEmail /
// checkVerificationStatus moved to emailVerificationController.mjs.
// Only `createVerificationToken` is still needed here (register issues
// the first verification token at signup).
import { createVerificationToken } from '../../../utils/emailVerificationService.mjs';
import emailService from '../../../utils/emailService.mjs';
import { COOKIE_OPTIONS, CLEAR_COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import {
  issueCsrfToken,
  CSRF_COOKIE_NAME,
  CLEAR_CSRF_COOKIE_OPTIONS,
} from '../../../middleware/csrf.mjs';
import { meetsCoppaMinimumAge, COPPA_MIN_AGE_YEARS } from '../../../utils/humanAge.mjs';
// Equoria-vhv3i: shared constants moved to ../constants/authConstants.mjs so
// settingsValidation.mjs (and the crafting-backfill script) can import the
// canonical lists without dragging the controller's prisma/bcrypt/jwt graph.
// Re-exported below for backward compatibility (existing tests still import
// from this controller module by path).
import {
  STARTER_KIT_INVENTORY,
  STARTER_CRAFTING_MATERIALS,
  STARTER_BONUS_COINS,
  // Equoria-448du: server-authoritative starting economy. Registration
  // never reads money/level/xp from the request body — these constants are
  // the canonical start for every new account.
  STARTER_MONEY,
  STARTER_LEVEL,
  STARTER_XP,
} from '../constants/authConstants.mjs';

export {
  STARTER_KIT_INVENTORY,
  STARTER_CRAFTING_MATERIALS,
  ALLOWED_PREFERENCE_KEYS,
} from '../constants/authConstants.mjs';

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

/**
 * Register a new user and create a corresponding user record.
 */
export const register = async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, dateOfBirth } = req.body;
    // Equoria-448du: money / level / xp are NO LONGER read from req.body.
    // They are server-authoritative (STARTER_MONEY / STARTER_LEVEL /
    // STARTER_XP below) so a submitted economy field can never affect a new
    // account's balance/level/xp — this no longer depends on
    // sanitizeRequestData stripping the fields upstream.
    // (Earlier: 'name', 'role', and 'settings' were also removed —
    // Equoria-aazk: starter settings are server-authoritative.)

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
      throw new ValidationError(`You must be ${COPPA_MIN_AGE_YEARS} or older to create an account`);
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

    // Create user with starter kit in inventory and starter bonus coins.
    // Equoria-448du: starting balance is ALWAYS the server-authoritative
    // STARTER_MONEY + STARTER_BONUS_COINS (1000 + 500 = 1500), regardless of
    // any client-supplied money field (which is no longer read).
    const startingMoney = STARTER_MONEY + STARTER_BONUS_COINS;
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
          // Equoria-448du: server-authoritative economy. NOT sourced from
          // req.body — a client cannot self-seed money/level/xp at signup.
          money: startingMoney,
          level: STARTER_LEVEL,
          xp: STARTER_XP,
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

    // Equoria-vhv3i: starter-horse creation extracted to
    // services/onboardingService.mjs (AC item 2). Non-fatal by contract —
    // the service catches and logs failures so registration always succeeds.
    await createStarterHorseForNewUser(user);

    // Create new token family for this registration.
    // Equoria-ovp9: pass role so the access token carries it and requireRole()
    // can skip the per-request DB lookup. New users always start with 'user'.
    const tokenPair = await createTokenPair(user.id, undefined, user.role ?? 'user');

    // Create email verification token
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
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
    // Equoria-plw0h: pass user.id so the issued token is bound to the
    // same identifier authenticateToken will resolve on the next mutation.
    const csrfToken = issueCsrfToken(req, res, { userId: user.id });

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

    // Equoria-gm4fg: timing-oracle fix. Always run bcrypt.compare regardless
    // of whether the user exists, so the wall-clock cost of "unknown email"
    // matches "known email + wrong password". The unknown-email branch runs
    // the compare against FAKE_BCRYPT_HASH (a hash of a random secret that
    // no submitted password can match) before returning the same 401. Do NOT
    // short-circuit on !user — that re-introduces the enumeration oracle.
    const hashToCompare = user ? user.password : FAKE_BCRYPT_HASH;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isPasswordValid) {
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
    // Equoria-plw0h: bind to user.id so next mutation's identifier matches.
    const csrfToken = issueCsrfToken(req, res, { userId: user.id });

    // Reset rate limit on successful login (brute force protection)
    const ip = req.ip || req.connection?.remoteAddress || null;
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
    // Equoria-plw0h: bind to the rotated session's userId.
    const csrfToken = issueCsrfToken(req, res, { userId: rotationResult.userId });

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
// ─────────────────────────────────────────────────────────────────────────
// Equoria-vhv3i: getProfile + updateProfile + updateUserPreferences moved
// to profileController.mjs. Re-exported here so existing routes
// (authenticatedAuthRoutes) and tests that import { getProfile,
// updateProfile, updateUserPreferences } from this module keep working
// unchanged.
// ─────────────────────────────────────────────────────────────────────────
export { getProfile, updateProfile, updateUserPreferences } from './profileController.mjs';

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
    // Equoria-uxh1l: also clear the CSRF cookie on session end. Uses the guarded
    // clear options so a `__Host-csrf` cookie is deleted with no Domain / Path=/.
    res.clearCookie(CSRF_COOKIE_NAME, CLEAR_CSRF_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('[authController.logout] Error logging out user:', error);
    next(new AppError('Logout failed due to an unexpected error.', 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Equoria-vhv3i: password lifecycle endpoints moved to passwordController.mjs.
// changePassword, forgotPassword, and resetPassword are re-exported here so
// existing routes (authRoutes / authenticatedAuthRoutes) and tests that
// import { changePassword, forgotPassword, resetPassword } from this module
// keep working unchanged. The PASSWORD_RESET_TOKEN_TTL_MS constant and the
// hashPasswordResetToken helper also moved — they had no other consumers.
// ─────────────────────────────────────────────────────────────────────────
export { changePassword, forgotPassword, resetPassword } from './passwordController.mjs';

// ─────────────────────────────────────────────────────────────────────────
// Equoria-vhv3i: email-verification endpoints moved to
// emailVerificationController.mjs. verifyEmail, resendVerification, and
// getVerificationStatus are re-exported here so existing routes
// (authRoutes / authenticatedAuthRoutes) and tests keep working unchanged.
// ─────────────────────────────────────────────────────────────────────────
export {
  verifyEmail,
  resendVerification,
  getVerificationStatus,
} from './emailVerificationController.mjs';

// ─────────────────────────────────────────────────────────────────────────
// Equoria-vhv3i: onboarding endpoints moved to onboardingController.mjs.
// completeOnboarding and advanceOnboarding are re-exported here so existing
// routes (authenticatedAuthRoutes) and tests keep working unchanged.
// The generateStarterStats helper + BREED_STARTER_STATS data loader moved
// alongside (no other consumers).
// ─────────────────────────────────────────────────────────────────────────
export { completeOnboarding, advanceOnboarding } from './onboardingController.mjs';

// ─────────────────────────────────────────────────────────────────────────
// TOTP MFA (OWASP A07, Equoria-2vwwh)
// ─────────────────────────────────────────────────────────────────────────
// Equoria-vhv3i: the four MFA endpoints (enroll, verify-enrollment,
// challenge, disable) plus the shared issueAuthenticatedSession helper
// moved to mfaController.mjs + services/authSessionService.mjs. Re-exported
// here so existing routes (authRoutes / authenticatedAuthRoutes) and tests
// that import { mfaEnroll, mfaChallenge, ... } from this module keep
// working unchanged.
export { mfaEnroll, mfaVerifyEnrollment, mfaChallenge, mfaDisable } from './mfaController.mjs';
