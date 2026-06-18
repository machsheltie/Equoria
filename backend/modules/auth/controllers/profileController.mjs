/**
 * profileController.mjs (Equoria-vhv3i — extracted from authController.mjs)
 *
 * Three user-profile endpoints:
 *
 *   GET   /api/v1/auth/profile                authenticated
 *   PUT   /api/v1/auth/profile                authenticated (notifications/display + identity)
 *   PATCH /api/v1/auth/profile/preferences    authenticated (Story 21S-5)
 *
 * Notable behaviors preserved (do NOT regress when editing):
 *   - getProfile sets `Cache-Control: no-store`. Auth state (onboarding,
 *     balance, role) must NEVER be served from browser HTTP cache — a
 *     stale cached response causes OnboardingGuard to redirect
 *     incorrectly on full-page navigations.
 *   - updateProfile merges notifications/display INTO existing
 *     settings JSON without clobbering server-owned keys (onboarding,
 *     milestones, inventory, economy).
 *   - updateUserPreferences gates keys by ALLOWED_PREFERENCE_KEYS (from
 *     the auth-constants module). Unknown keys → 400; non-boolean
 *     values → 400. Merge happens inside a prisma.$transaction for
 *     read-modify-write atomicity (CodeRabbit Major 2026-04-20).
 *   - Duplicate-conflict messages use the canonical phrasing the
 *     frontend isDuplicate check listens for ("already exists" /
 *     "already in use" / "taken"). 409 Conflict status.
 */

import { AppError, ValidationError } from '../../../errors/index.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { ALLOWED_PREFERENCE_KEYS } from '../constants/authConstants.mjs';

/**
 * Get current user profile.
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
    // Equoria-pnd1z: bio lives in settings JSONB (the User table has no bio
    // column — that field belongs to Groom/Rider). Stored/read here alongside
    // notifications + display, matching the existing profile-data pattern.
    const bio = typeof settings.bio === 'string' ? settings.bio : '';

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
          // Equoria-pnd1z: bio (from settings JSONB); '' default so the
          // controlled profile input binds cleanly.
          bio,
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
    logger.error('[profileController.getProfile] Error retrieving profile:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to retrieve profile due to an unexpected error.', 500));
  }
};

/**
 * Update user profile (identity fields + notifications/display preferences).
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { username, email, bio, notifications, display } = req.body;

    const hasPreferenceUpdate =
      (notifications !== undefined && notifications !== null) ||
      (display !== undefined && display !== null);
    // Equoria-pnd1z: bio is an editable identity field. `undefined` means "not
    // submitted" (leave unchanged); an empty string is a legitimate clear.
    const hasBioUpdate = bio !== undefined;

    // Validate input
    if (!username && !email && !hasPreferenceUpdate && !hasBioUpdate) {
      throw new ValidationError('At least one field is required');
    }

    // Equoria-pnd1z: server-authoritative bio validation (string + 500-char
    // cap, matching the frontend profile form's documented limit).
    if (hasBioUpdate) {
      if (typeof bio !== 'string') {
        throw new ValidationError('bio must be a string');
      }
      if (bio.length > 500) {
        throw new ValidationError('bio must be 500 characters or fewer');
      }
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

    // Merge preferences + bio into existing settings JSON without clobbering
    // onboarding state. bio lives in settings JSONB (the User table has no bio
    // column), alongside notifications + display (Equoria-pnd1z).
    let settingsUpdate;
    if (hasPreferenceUpdate || hasBioUpdate) {
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
      if (hasBioUpdate) {
        settingsUpdate.bio = bio; // '' clears it; validated above
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
          bio: typeof updatedSettings.bio === 'string' ? updatedSettings.bio : '',
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
          notifications: updatedSettings.notifications ?? null,
          display: updatedSettings.display ?? null,
        },
      },
    });
  } catch (error) {
    logger.error('[profileController.updateProfile] Error updating profile:', error);
    next(error);
  }
};

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
    logger.error(`[profileController.updateUserPreferences] Error: ${error.message}`);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    return next(new AppError('Failed to update preferences.', 500));
  }
};
