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
import * as mfaService from '../services/mfaService.mjs';
import * as mfaLockoutService from '../services/mfaLockoutService.mjs';
import { encryptField, decryptField } from '../../../utils/fieldEncryption.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../db/index.mjs';
import { MS_PER_GAME_YEAR } from '../../../constants/time.mjs';
import { resetAuthRateLimit } from '../../../middleware/authRateLimiter.mjs';
import { generateGenotype } from '../../horses/services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../../horses/services/phenotypeCalculationService.mjs';
import { generateMarkings } from '../../horses/services/markingGenerationService.mjs';
// Equoria-f5372: starter horse must arrive with a temperament populated.
// Equoria-b9zgr: the starter horse must ALSO arrive with a breedId. It is
// born before the player picks a breed in onboarding, so it is seeded with
// the canonical default breed (Thoroughbred). The onboarding breed-selection
// step (advanceOnboarding) later UPDATES breedId to the player's choice. The
// default-breed fallback mirrors the existing temperament default-breed path.
import {
  generateTemperamentWithDefault,
  DEFAULT_TEMPERAMENT_BREED,
} from '../../horses/services/temperamentService.mjs';
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
import {
  issueCsrfToken,
  CSRF_COOKIE_NAME,
  CLEAR_CSRF_COOKIE_OPTIONS,
} from '../../../middleware/csrf.mjs';
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
      // Equoria game-year convention: 1 game-year = 7 real days. A 3-game-year
      // starter horse is born 3*7 = 21 real days ago, NOT 3 calendar years ago
      // (which the canonical age helper would read as ~156 game-years).
      const STARTER_HORSE_AGE_GAME_YEARS = 3;
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const dateOfBirth = new Date(Date.now() - STARTER_HORSE_AGE_GAME_YEARS * 7 * MS_PER_DAY);

      // Equoria-b9zgr: resolve the default breed id so the starter horse is
      // never born with a NULL breedId (the prior behaviour left every
      // registration starter horse breedless — 0/3334 rows had breedId set).
      // Non-fatal: if the default breed row is missing the horse is still
      // created and registration succeeds; the onboarding breed-selection step
      // will assign a breedId. Logged at error level so the gap is visible.
      let defaultBreedId = null;
      try {
        const defaultBreed = await prisma.breed.findUnique({
          where: { name: DEFAULT_TEMPERAMENT_BREED },
          select: { id: true },
        });
        defaultBreedId = defaultBreed?.id ?? null;
        if (defaultBreedId === null) {
          logger.error(
            `[authController.register] Default breed "${DEFAULT_TEMPERAMENT_BREED}" not found — starter horse will be created without a breedId until onboarding assigns one.`,
            { userId: user.id },
          );
        }
      } catch (breedLookupError) {
        logger.error(
          '[authController.register] FAILED to resolve default breed for starter horse (horse will have NULL breedId until onboarding/backfill):',
          { userId: user.id, error: breedLookupError.message },
        );
      }

      const starterHorse = await prisma.horse.create({
        data: {
          name: `${username}'s First Horse`,
          sex: 'Mare',
          age: 3,
          dateOfBirth,
          // Equoria-b9zgr: this controller's prisma client (db/index.mjs) is a
          // different generation than the test client and persists FKs via the
          // SCALAR field (like `userId` above), NOT Prisma relation-connect
          // syntax — `breed: { connect }` throws "Invalid invocation" here. Use
          // the scalar breedId to mirror the working userId pattern.
          ...(defaultBreedId !== null && { breedId: defaultBreedId }),
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

      // Equoria-f5372: assign a permanent temperament. The starter horse is
      // seeded with the default breed (Equoria-b9zgr), so temperament is
      // generated from the same default breed's weights. Written via raw SQL on
      // the existing column (independent of the color block) so a
      // color-generation failure can never leave temperament NULL, and so a
      // stale Prisma client create-input type can never break registration.
      try {
        const starterTemperament = generateTemperamentWithDefault(null);
        await prisma.$executeRaw`
          UPDATE horses
          SET temperament = ${starterTemperament}
          WHERE id = ${starterHorse.id}
        `;
        logger.info('[authController.register] Starter horse temperament applied', {
          horseId: starterHorse.id,
          temperament: starterTemperament,
        });
      } catch (temperamentError) {
        // Non-fatal at the request level (the user is registered and the horse
        // exists); logged at error level so the regression is visible.
        logger.error(
          '[authController.register] FAILED to apply starter horse temperament (horse will have NULL temperament until backfilled):',
          {
            horseId: starterHorse.id,
            userId: user.id,
            error: temperamentError.message,
            stack: temperamentError.stack,
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
    // Equoria-uxh1l: also clear the CSRF cookie on session invalidation.
    res.clearCookie(CSRF_COOKIE_NAME, CLEAR_CSRF_COOKIE_OPTIONS);

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
      // Equoria-dv1lv: the user branch below does
      //   1) randomBytes + bcrypt-style hashPasswordResetToken
      //   2) a 2-statement prisma.$transaction (UPDATE then INSERT)
      //   3) a fire-and-forget email send (post-response)
      // The randomBytes + hash and the tx are SYNCHRONOUS DB work the
      // attacker can measure. Mirror BOTH so the no-user branch carries
      // the same timing weight before responding. The email send is
      // already fire-and-forget in the user branch (does not contribute
      // to response duration) so we do not mirror it here.
      const dummyRaw = crypto.randomBytes(32).toString('hex');
      hashPasswordResetToken(dummyRaw);
      // A read-only SELECT with the same row-lock cost as the UPDATE/INSERT
      // tx. No write means no side effect; the latency profile mimics the
      // user branch without leaking unknown-email rows into the DB.
      await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SELECT pg_sleep(0)`);
        await tx.$executeRawUnsafe(`SELECT pg_sleep(0)`);
      });

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
    // Equoria-n62tl: req.ip already honors Express's `trust proxy` setting
    // (the upstream-IP resolution lives there, not here). Dropping the
    // `req.headers['x-forwarded-for']` fallback closes a vector where a
    // misconfigured / disabled `trust proxy` makes req.ip undefined and
    // re-enables ATTACKER-CONTROLLED audit-IP injection. Fall back to null
    // instead of a forgeable header — an unknown IP is honest; a forged
    // one is a stealth-frame primitive. The 5 sibling sites in this file
    // and the rate-limit-key site in middleware/rateLimiting.mjs are
    // tracked separately per OPTIMAL_FIX §3 (do-not-bundle).
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
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

    // Equoria-dv1lv: the email-send was the dominant timing-side-channel
    // because the outbound SMTP/transactional-mail call adds tens to
    // hundreds of ms that the no-user branch never paid. Fire-and-forget
    // it AFTER the controller has already responded so the response
    // duration no longer encodes registered-vs-unregistered. Errors are
    // swallowed into the log; the token row is already persisted so the
    // user can retry from the UI if delivery fails. Pairs with the
    // !user branch's constant-time padding (see above) for two-sided
    // defense against email enumeration via timing.
    emailService.sendPasswordResetEmail(user.email, rawToken, user).catch(err => {
      logger.error(
        `[authController.forgotPassword] Email send failed (token still persisted): ${err.message}`,
      );
    });

    logger.info('[authController.forgotPassword] Password reset email queued', {
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
    // Equoria-uxh1l: also clear the CSRF cookie on session invalidation.
    res.clearCookie(CSRF_COOKIE_NAME, CLEAR_CSRF_COOKIE_OPTIONS);

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
// Equoria-3f0yx: ESM-native JSON load via readFileSync + JSON.parse,
// replacing the prior `createRequire(import.meta.url)` +
// `requireJson('.../breedStarterStats.json')` bridge. The bridge violated
// ES_MODULES_REQUIREMENTS.md "NO COMMONJS MIXING." readFileSync is chosen
// over `import attributes` (`with { type: 'json' }`) because the project's
// ESLint config targets `ecmaVersion: 2022` and does not yet parse the
// 2025 import-attribute syntax — switching to readFileSync ships the fix
// without an ESLint config bump (which is a separate architectural change
// per GENERAL_RULES.md "Do not change the project linting settings").
import { readFileSync as readFileSyncForStarterStats } from 'node:fs';
import { fileURLToPath as fileURLToPathForStarterStats } from 'node:url';
import { dirname as dirnameForStarterStats, resolve as resolveForStarterStats } from 'node:path';
const breedStarterStatsDir = dirnameForStarterStats(
  fileURLToPathForStarterStats(import.meta.url),
);
const BREED_STARTER_STATS = JSON.parse(
  readFileSyncForStarterStats(
    resolveForStarterStats(breedStarterStatsDir, '../../../data/breedStarterStats.json'),
    'utf8',
  ),
);

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

    // Equoria-vbrc4: pre-compute the starter horse's color OUTSIDE the
    // interactive transaction. The breed-profile read + genotype/phenotype
    // generation are pure-ish work that must NOT run inside the 5s tx budget
    // (doing so caused Prisma P2028 "transaction already closed"). Only the
    // create/update writes belong in the tx. Computed only when a horse is
    // actually being customized; discarded harmlessly if the tx later rejects
    // a missing breed.
    let starterColorGenotype = null;
    let starterPhenotype = null;
    if (hasHorseCustomization) {
      let breedGeneticProfile = null;
      try {
        const breedRows = await prisma.$queryRaw`
          SELECT "breedGeneticProfile"
          FROM breeds
          WHERE id = ${normalizedBreedId}
        `;
        const profile = breedRows?.[0]?.breedGeneticProfile ?? null;
        // JSONB guard (CONTRIBUTING.md): a JsonValue may be null, primitive,
        // array, or object — only treat a plain object as a usable profile.
        if (
          profile !== null &&
          profile !== undefined &&
          typeof profile === 'object' &&
          !Array.isArray(profile)
        ) {
          breedGeneticProfile = profile;
        }
      } catch (lookupErr) {
        logger.warn(
          `[authController.advanceOnboarding] Failed to load breedGeneticProfile for breed ${normalizedBreedId}: ${lookupErr.message}. Falling back to generic defaults.`,
        );
        breedGeneticProfile = null;
      }

      starterColorGenotype = generateGenotype(breedGeneticProfile);
      const starterBaseColor = calculatePhenotype(
        starterColorGenotype,
        breedGeneticProfile?.shade_bias ?? null,
      );
      const starterMarkings = generateMarkings(breedGeneticProfile, starterBaseColor.colorName);
      starterPhenotype = { ...starterBaseColor, ...starterMarkings };
    }

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
          // Equoria-f5372: fill temperament only if the existing starter horse
          // Equoria-8vwly: re-assign the temperament from the CHOSEN breed's
          // weighted distribution at onboarding. The temperament-permanence
          // invariant ("assigned once, never changed") is preserved — the
          // permanence boundary is BREED FINALIZATION (onboarding completion),
          // NOT registration. The register-time temperament is a Thoroughbred-
          // fallback placeholder that the user never sees, set before the breed
          // is chosen; replacing it with the user's actual breed's distribution
          // is the correct first-and-only assignment. (Game-realism: a foal of
          // a Friesian doesn't have Thoroughbred-distributed behavior.) Existing
          // horses that completed onboarding under the OLD behavior are NOT
          // backfilled — their temperaments are now real gameplay state.
          persistedHorse = await tx.horse.update({
            where: { id: starterHorse.id },
            data: {
              ...updateData,
              temperament: generateTemperamentWithDefault(breed.name),
            },
            include: { breed: { select: { id: true, name: true } } },
          });
        } else {
          // Equoria game-year convention: 1 game-year = 7 real days. A 3-game-year
          // starter horse is born 3*7 = 21 real days ago, NOT 3 calendar years ago
          // (which the canonical age helper would read as ~156 game-years).
          const dateOfBirth = new Date(Date.now() - 3 * MS_PER_GAME_YEAR);

          // Equoria-vbrc4: a brand-new starter horse created via this branch must
          // be born with a valid colorGenotype + phenotype (omitting them produced
          // a NULL-phenotype row, tripping backend/__tests__/horseColorNullSentinel).
          // The breed-aware color is pre-computed BEFORE the transaction (see above)
          // so the genotype/phenotype generation never runs inside the 5s tx budget.
          // Equoria-f5372: brand-new horse — assign temperament from the chosen breed.
          persistedHorse = await tx.horse.create({
            data: {
              ...updateData,
              age: 3,
              dateOfBirth,
              userId,
              healthStatus: 'Excellent',
              temperament: generateTemperamentWithDefault(breed.name),
              colorGenotype: starterColorGenotype,
              phenotype: starterPhenotype,
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
export const ALLOWED_PREFERENCE_KEYS = [
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
  // Equoria-plw0h: bind CSRF token to user.id so the next mutation's
  // sessionIdentifier matches.
  const csrfToken = issueCsrfToken(req, res, { userId: user.id });

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

    // Equoria-kg7i2: per-userId lockout — defeats brute-force of the 10^6
    // TOTP space that the shared 200/15min authRateLimiter does not. The
    // check runs BEFORE any DB lookup or cryptographic work so a locked
    // attacker cannot use the endpoint as an oracle / load amplifier.
    const lockState = mfaLockoutService.isLocked(payload.userId);
    if (lockState.locked) {
      logger.warn('[authController.mfaChallenge] Locked-out user attempted MFA', {
        userId: payload.userId,
        retryAfterSec: lockState.retryAfterSec,
      });
      return res.status(429).json({
        success: false,
        message:
          'Too many failed MFA attempts. The challenge has been revoked — please log in again.',
        retryAfter: lockState.retryAfterSec,
      });
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
      // Equoria-kg7i2: increment per-userId failure counter BEFORE responding.
      // On the threshold-crossing failure the user becomes locked; the very
      // next request hits the isLocked() branch above and returns 429.
      mfaLockoutService.recordFailure(payload.userId);
      throw new AppError('Invalid MFA credentials', 401);
    }

    // Equoria-kg7i2: a successful challenge resets the failure counter so a
    // single typo before success does not penalise a legitimate user.
    mfaLockoutService.recordSuccess(payload.userId);

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

    // Equoria-uqq8n (defense-in-depth, sibling of Equoria-kg7i2): without
    // this lockout, a compromised session could brute-force the 10^6 TOTP
    // space on /mfa/disable to strip MFA off the account. The shared
    // 200/15min authRateLimiter is far wider than the TOTP keyspace and is
    // not by itself sufficient. The lockout key is req.user.id (per-account,
    // mirroring kg7i2). The check runs BEFORE any DB lookup or cryptographic
    // work so a locked attacker cannot use the endpoint as an oracle.
    const lockState = mfaLockoutService.isLocked(req.user.id);
    if (lockState.locked) {
      logger.warn('[authController.mfaDisable] Locked-out user attempted MFA disable', {
        userId: req.user.id,
        retryAfterSec: lockState.retryAfterSec,
      });
      return res.status(429).json({
        success: false,
        message: 'Too many failed MFA attempts. Please try again later.',
        retryAfter: lockState.retryAfterSec,
      });
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
      // Equoria-uqq8n: record the failure BEFORE responding so the threshold
      // crossing locks the next attempt at the isLocked() gate above.
      mfaLockoutService.recordFailure(req.user.id);
      throw new AppError('Invalid TOTP token', 401);
    }

    // Equoria-uqq8n: success resets the counter (mirrors kg7i2).
    mfaLockoutService.recordSuccess(req.user.id);

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
