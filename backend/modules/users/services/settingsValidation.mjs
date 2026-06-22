/**
 * 🔒 SETTINGS SHAPE VALIDATION (Equoria-bddjw, CWE-915 nested-write hardening)
 *
 * The `PUT /api/v1/users/:id` self-update path accepts a top-level `settings`
 * key (gated by USER_UPDATE_ALLOWLIST from the prior C1 / Equoria-qia4j fix)
 * but historically wrote the CONTENTS of `settings` verbatim into the
 * `User.settings` JSON column. Prototype pollution is blocked globally
 * (rejectPollutedRequestBody), but a client could still write arbitrary
 * nested keys and unbounded-size blobs into the column — and could clobber
 * server-owned state (economy, onboarding, milestones, inventory).
 *
 * This module constrains the client-writable surface of `settings` to the
 * SAME known structure the sibling auth paths allow:
 *   - PATCH /auth/profile/preferences → `preferences` keys ∈ ALLOWED_PREFERENCE_KEYS
 *   - PUT   /auth/profile            → `notifications` / `display` (plain prefs)
 *
 * It deliberately imports `ALLOWED_PREFERENCE_KEYS` from the auth-module
 * constants (the single source of truth) so the two paths can NOT drift —
 * adding a preference key in one place updates both. Equoria-vhv3i moved
 * the constant out of the controller into a dedicated constants module so
 * the cross-module import no longer crosses a controller boundary.
 */

import { ALLOWED_PREFERENCE_KEYS } from '../../auth/index.mjs';
import AppError from '../../../errors/AppError.mjs';

/**
 * Top-level keys a client is permitted to set inside `settings` via the
 * generic /users/:id self-update. Everything else in `settings` is either
 * server-owned (onboarding/milestones/inventory/economy) and must NOT be
 * client-writable here, or unknown and must be rejected. These three mirror
 * exactly what the /auth/profile + /auth/profile/preferences paths expose.
 */
export const ALLOWED_SETTINGS_KEYS = Object.freeze(['preferences', 'notifications', 'display']);

/**
 * Hard cap on the serialized size of the client-supplied `settings` payload.
 * Guards against unbounded-blob DoS / column bloat. The legitimate surface
 * (a handful of boolean/string/number toggles) is well under 1 KB; 4 KB is a
 * generous ceiling that still rejects multi-megabyte abuse.
 */
export const MAX_SETTINGS_BYTES = 4096;

/**
 * A plain object of primitive values (boolean | string | number). Mirrors
 * `isPlainPrefs` in authController.updateProfile. Rejects arrays, null, and
 * nested objects — the client-writable preference surface is intentionally flat.
 */
function isPlainPrefs(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    v => typeof v === 'boolean' || typeof v === 'string' || typeof v === 'number',
  );
}

/**
 * Validate a client-supplied `settings` payload for the /users/:id path.
 *
 * Throws AppError(400) on:
 *   - non-object / array / null settings
 *   - oversized serialized payload (> MAX_SETTINGS_BYTES)
 *   - unknown top-level settings key (not in ALLOWED_SETTINGS_KEYS)
 *   - non-flat-primitive notifications/display object
 *   - unknown preference key (not in ALLOWED_PREFERENCE_KEYS)
 *   - non-flat-primitive preferences object
 *
 * Returns the validated (sanitized) settings object — only allow-listed
 * top-level keys survive, so this both rejects the bad shapes above AND
 * strips anything outside the known surface. The caller is responsible for
 * MERGING this into the stored settings so server-owned keys are preserved.
 *
 * @param {unknown} settings - the raw `settings` value from req.body
 * @returns {Record<string, unknown>} validated, allow-listed settings subset
 */
export function validateSettingsPayload(settings) {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new AppError('settings must be an object', 400);
  }

  // Size guard — reject unbounded blobs before any further work.
  let serializedBytes;
  try {
    serializedBytes = Buffer.byteLength(JSON.stringify(settings), 'utf8');
  } catch {
    // Circular structure or non-serializable value → reject (fail closed).
    throw new AppError('settings is not serializable', 400);
  }
  if (serializedBytes > MAX_SETTINGS_BYTES) {
    throw new AppError(`settings payload too large (max ${MAX_SETTINGS_BYTES} bytes)`, 400);
  }

  const submittedKeys = Object.keys(settings);
  const unknownTopLevel = submittedKeys.filter(k => !ALLOWED_SETTINGS_KEYS.includes(k));
  if (unknownTopLevel.length > 0) {
    throw new AppError(`Unknown settings key(s): ${unknownTopLevel.join(', ')}`, 400);
  }

  const validated = {};

  // notifications / display — plain objects of primitives (matches /auth/profile)
  for (const key of ['notifications', 'display']) {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      const value = settings[key];
      if (!isPlainPrefs(value)) {
        throw new AppError(`settings.${key} must be an object of primitive values`, 400);
      }
      validated[key] = value;
    }
  }

  // preferences — keys gated by ALLOWED_PREFERENCE_KEYS (matches /auth/profile/preferences)
  if (Object.prototype.hasOwnProperty.call(settings, 'preferences')) {
    const preferences = settings.preferences;
    if (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences)) {
      throw new AppError('settings.preferences must be an object', 400);
    }
    const prefKeys = Object.keys(preferences);
    const unknownPrefs = prefKeys.filter(k => !ALLOWED_PREFERENCE_KEYS.includes(k));
    if (unknownPrefs.length > 0) {
      throw new AppError(`Unknown preference key(s): ${unknownPrefs.join(', ')}`, 400);
    }
    if (!isPlainPrefs(preferences)) {
      throw new AppError('settings.preferences must be an object of primitive values', 400);
    }
    validated.preferences = preferences;
  }

  return validated;
}
