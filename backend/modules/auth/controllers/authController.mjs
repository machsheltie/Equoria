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
// Equoria-vhv3i: MS_PER_GAME_YEAR / canonicalizeHorseSex / HORSE_STAT_VALUES /
// evictPasswordChangedAtCache imports moved to the sub-controllers that own
// them (onboardingController + passwordController). Only register still uses
// the horse-color/temperament generators below — kept.
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
  ALLOWED_PREFERENCE_KEYS,
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
          // Equoria-b9zgr: this controller's prisma client
          // (packages/database/prismaClient.mjs) is a different generation than
          // the test client and persists FKs via the SCALAR field (like
          // `userId` above), NOT Prisma relation-connect syntax — `breed:
          // { connect }` throws "Invalid invocation" here. Use the scalar
          // breedId to mirror the working userId pattern.
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

// ─────────────────────────────────────────────────────────────────────────
// Equoria-vhv3i: password lifecycle endpoints moved to passwordController.mjs.
// changePassword, forgotPassword, and resetPassword are re-exported here so
// existing routes (authRoutes / authenticatedAuthRoutes) and tests that
// import { changePassword, forgotPassword, resetPassword } from this module
// keep working unchanged. The PASSWORD_RESET_TOKEN_TTL_MS constant and the
// hashPasswordResetToken helper also moved — they had no other consumers.
// ─────────────────────────────────────────────────────────────────────────
export { changePassword, forgotPassword, resetPassword } from './passwordController.mjs';

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

// ─────────────────────────────────────────────────────────────────────────
// Equoria-vhv3i: onboarding endpoints moved to onboardingController.mjs.
// completeOnboarding and advanceOnboarding are re-exported here so existing
// routes (authenticatedAuthRoutes) and tests keep working unchanged.
// The generateStarterStats helper + BREED_STARTER_STATS data loader moved
// alongside (no other consumers).
// ─────────────────────────────────────────────────────────────────────────
export { completeOnboarding, advanceOnboarding } from './onboardingController.mjs';

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
// Equoria-vhv3i: the four MFA endpoints (enroll, verify-enrollment,
// challenge, disable) plus the shared issueAuthenticatedSession helper
// moved to mfaController.mjs + services/authSessionService.mjs. Re-exported
// here so existing routes (authRoutes / authenticatedAuthRoutes) and tests
// that import { mfaEnroll, mfaChallenge, ... } from this module keep
// working unchanged.
export { mfaEnroll, mfaVerifyEnrollment, mfaChallenge, mfaDisable } from './mfaController.mjs';
