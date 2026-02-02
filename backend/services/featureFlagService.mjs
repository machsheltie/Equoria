/**
 * Feature Flag Service
 *
 * Centralized service for managing feature flags with support for:
 * - Environment variable flags
 * - Percentage-based rollout
 * - User targeting
 * - A/B testing variants
 *
 * @module services/featureFlagService
 */

import { FLAG_DEFINITIONS, FLAG_DEFAULTS } from '../utils/featureFlags.mjs';
import logger from '../utils/logger.mjs';

/**
 * In-memory cache for flag values
 * @type {Map<string, any>}
 */
const flagCache = new Map();

/**
 * Track flag evaluation counts for monitoring
 * @type {Map<string, { enabled: number, disabled: number }>}
 */
const evaluationCounts = new Map();

/**
 * Hash a string to a number between 0-99 for percentage rollout
 * @param {string} str - String to hash (usually `${flagName}:${userId}`)
 * @returns {number} Number between 0-99
 */
function hashToPercentage(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100;
}

/**
 * Get raw flag value from environment or defaults
 * @param {string} flagName - Name of the feature flag
 * @returns {string|boolean|number|null}
 */
function getRawFlagValue(flagName) {
  // Check environment variable first
  const envValue = process.env[flagName];
  if (envValue !== undefined) {
    // Parse boolean strings
    if (envValue.toLowerCase() === 'true') { return true; }
    if (envValue.toLowerCase() === 'false') { return false; }
    // Parse numeric strings
    if (!isNaN(Number(envValue))) { return Number(envValue); }
    return envValue;
  }

  // Fall back to defaults
  return FLAG_DEFAULTS[flagName] ?? null;
}

/**
 * Check if a feature flag is enabled
 *
 * @param {string} flagName - Name of the feature flag
 * @param {Object} context - Evaluation context
 * @param {string} [context.userId] - User ID for user targeting
 * @param {string} [context.email] - User email for domain targeting
 * @param {string} [context.environment] - Current environment
 * @returns {Promise<boolean>} Whether the flag is enabled
 *
 * @example
 * // Simple boolean check
 * if (await isFeatureEnabled('FF_AUTH_PASSWORDLESS')) {
 *   // Enable passwordless login
 * }
 *
 * @example
 * // User-targeted check
 * if (await isFeatureEnabled('FF_BETA_FEATURES', { userId: user.id })) {
 *   // Show beta features
 * }
 */
export async function isFeatureEnabled(flagName, context = {}) {
  try {
    const definition = FLAG_DEFINITIONS[flagName];
    const rawValue = getRawFlagValue(flagName);

    // Track evaluation
    trackEvaluation(flagName, false); // Will update below if enabled

    // If flag doesn't exist or is explicitly false, return false
    if (rawValue === null || rawValue === false) {
      return false;
    }

    // Simple boolean flag
    if (rawValue === true) {
      trackEvaluation(flagName, true);
      return true;
    }

    // Percentage rollout
    if (typeof rawValue === 'number' && definition?.type === 'PERCENTAGE') {
      const percentage = rawValue;
      const userId = context.userId || 'anonymous';
      const bucket = hashToPercentage(`${flagName}:${userId}`);
      const enabled = bucket < percentage;
      trackEvaluation(flagName, enabled);
      return enabled;
    }

    // User whitelist
    if (definition?.type === 'USER_LIST' && typeof rawValue === 'string') {
      const whitelist = rawValue.split(',').map((s) => s.trim());
      const enabled =
        whitelist.includes(context.userId) ||
        whitelist.includes(context.email);
      trackEvaluation(flagName, enabled);
      return enabled;
    }

    // Default to treating truthy values as enabled
    const enabled = Boolean(rawValue);
    trackEvaluation(flagName, enabled);
    return enabled;
  } catch (error) {
    logger.error('[FeatureFlag] Error evaluating flag', {
      flagName,
      error: error.message,
    });
    return false;
  }
}

/**
 * Get a feature flag's string value (for A/B variants)
 *
 * @param {string} flagName - Name of the feature flag
 * @param {string} defaultValue - Default value if flag not set
 * @returns {Promise<string>}
 *
 * @example
 * const variant = await getFeatureVariant('FF_LANDING_PAGE', 'control');
 * if (variant === 'variant_a') {
 *   // Show variant A
 * }
 */
export async function getFeatureVariant(flagName, defaultValue = '') {
  const rawValue = getRawFlagValue(flagName);
  return typeof rawValue === 'string' ? rawValue : defaultValue;
}

/**
 * Get all feature flags and their current values
 *
 * @param {Object} context - Evaluation context
 * @returns {Promise<Object>} Map of flag names to evaluated values
 */
export async function getAllFlags(context = {}) {
  const flags = {};

  for (const flagName of Object.keys(FLAG_DEFINITIONS)) {
    const definition = FLAG_DEFINITIONS[flagName];

    if (definition.type === 'STRING') {
      flags[flagName] = await getFeatureVariant(flagName);
    } else {
      flags[flagName] = await isFeatureEnabled(flagName, context);
    }
  }

  return flags;
}

/**
 * Track flag evaluation for monitoring
 * @param {string} flagName
 * @param {boolean} enabled
 */
function trackEvaluation(flagName, enabled) {
  if (!evaluationCounts.has(flagName)) {
    evaluationCounts.set(flagName, { enabled: 0, disabled: 0 });
  }

  const counts = evaluationCounts.get(flagName);
  if (enabled) {
    counts.enabled++;
  } else {
    counts.disabled++;
  }
}

/**
 * Get evaluation statistics for monitoring
 * @returns {Object} Evaluation counts per flag
 */
export function getEvaluationStats() {
  const stats = {};
  for (const [flagName, counts] of evaluationCounts) {
    stats[flagName] = {
      ...counts,
      total: counts.enabled + counts.disabled,
      enabledRate:
        counts.enabled + counts.disabled > 0
          ? (counts.enabled / (counts.enabled + counts.disabled)) * 100
          : 0,
    };
  }
  return stats;
}

/**
 * Reset evaluation stats (useful for testing)
 */
export function resetEvaluationStats() {
  evaluationCounts.clear();
}

/**
 * Override a flag value at runtime (for testing/emergency)
 * Note: This only affects in-memory state, not environment
 *
 * @param {string} flagName
 * @param {any} value
 */
export function overrideFlag(flagName, value) {
  flagCache.set(flagName, value);
  logger.warn('[FeatureFlag] Flag overridden at runtime', { flagName, value });
}

/**
 * Clear runtime flag overrides
 */
export function clearOverrides() {
  flagCache.clear();
  logger.info('[FeatureFlag] All runtime overrides cleared');
}

export default {
  isFeatureEnabled,
  getFeatureVariant,
  getAllFlags,
  getEvaluationStats,
  resetEvaluationStats,
  overrideFlag,
  clearOverrides,
};
