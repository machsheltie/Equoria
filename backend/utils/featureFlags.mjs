/**
 * Feature Flag Definitions and Defaults
 *
 * Central registry of all feature flags used in Equoria.
 *
 * Naming Convention:
 * FF_<SCOPE>_<FEATURE_NAME>
 *
 * Types:
 * - BOOLEAN: Simple on/off toggle
 * - PERCENTAGE: Gradual rollout (0-100)
 * - STRING: A/B variant selection
 * - USER_LIST: Comma-separated user IDs/emails
 *
 * @module utils/featureFlags
 */

/**
 * Feature flag definitions with metadata
 * @type {Object.<string, {type: string, description: string, defaultValue: any}>}
 */
export const FLAG_DEFINITIONS = {
  // ============================================
  // Authentication Flags
  // ============================================
  FF_AUTH_PASSWORDLESS_LOGIN: {
    type: 'BOOLEAN',
    description: 'Enable passwordless login via magic link',
    defaultValue: false,
  },
  FF_AUTH_MFA_ENABLED: {
    type: 'BOOLEAN',
    description: 'Enable multi-factor authentication',
    defaultValue: false,
  },
  FF_AUTH_SOCIAL_LOGIN: {
    type: 'BOOLEAN',
    description: 'Enable social login (Google, Apple, etc.)',
    defaultValue: false,
  },

  // ============================================
  // Breeding System Flags
  // ============================================
  FF_BREEDING_EPIGENETICS: {
    type: 'BOOLEAN',
    description: 'Enable advanced epigenetics system',
    defaultValue: true, // Already implemented
  },
  FF_BREEDING_NEW_UI: {
    type: 'PERCENTAGE',
    description: 'Percentage rollout for new breeding interface',
    defaultValue: 0,
  },
  FF_BREEDING_RARE_TRAITS: {
    type: 'BOOLEAN',
    description: 'Enable ultra-rare exotic traits',
    defaultValue: true, // Already implemented
  },

  // ============================================
  // Competition System Flags
  // ============================================
  FF_COMPETITION_TEAM_EVENTS: {
    type: 'BOOLEAN',
    description: 'Enable team-based competition events',
    defaultValue: false,
  },
  FF_COMPETITION_LIVE_SCORING: {
    type: 'BOOLEAN',
    description: 'Enable real-time competition scoring',
    defaultValue: false,
  },
  FF_COMPETITION_SEASONAL: {
    type: 'BOOLEAN',
    description: 'Enable seasonal championships',
    defaultValue: false,
  },

  // ============================================
  // Training System Flags
  // ============================================
  FF_TRAINING_NEW_ALGORITHM: {
    type: 'PERCENTAGE',
    description: 'Percentage rollout for new training stat algorithm',
    defaultValue: 0,
  },
  FF_TRAINING_MINI_GAMES: {
    type: 'BOOLEAN',
    description: 'Enable training mini-games',
    defaultValue: false,
  },

  // ============================================
  // Groom System Flags
  // ============================================
  FF_GROOM_SPECIALIZATION: {
    type: 'BOOLEAN',
    description: 'Enable groom specialization system',
    defaultValue: true, // Already implemented
  },
  FF_GROOM_LEVELING: {
    type: 'BOOLEAN',
    description: 'Enable groom experience and leveling',
    defaultValue: true, // Already implemented
  },

  // ============================================
  // UI/UX Flags
  // ============================================
  FF_UI_DARK_MODE: {
    type: 'BOOLEAN',
    description: 'Enable dark mode UI option',
    defaultValue: false,
  },
  FF_UI_ANIMATIONS: {
    type: 'BOOLEAN',
    description: 'Enable UI animations',
    defaultValue: true,
  },
  FF_UI_NEW_DASHBOARD: {
    type: 'PERCENTAGE',
    description: 'Percentage rollout for new dashboard design',
    defaultValue: 0,
  },

  // ============================================
  // Marketplace Flags
  // ============================================
  FF_MARKETPLACE_ENABLED: {
    type: 'BOOLEAN',
    description: 'Enable horse marketplace',
    defaultValue: false,
  },
  FF_MARKETPLACE_AUCTIONS: {
    type: 'BOOLEAN',
    description: 'Enable auction functionality',
    defaultValue: false,
  },

  // ============================================
  // Beta/Labs Flags
  // ============================================
  FF_BETA_FEATURES: {
    type: 'USER_LIST',
    description: 'Comma-separated list of beta tester user IDs',
    defaultValue: '',
  },
  FF_LABS_ENABLED: {
    type: 'BOOLEAN',
    description: 'Enable /labs experimental endpoints',
    defaultValue: true, // Already active
  },

  // ============================================
  // Performance/Debug Flags
  // ============================================
  FF_DEBUG_LOGGING: {
    type: 'BOOLEAN',
    description: 'Enable verbose debug logging',
    defaultValue: false,
  },
  FF_PERFORMANCE_TRACING: {
    type: 'BOOLEAN',
    description: 'Enable performance tracing',
    defaultValue: false,
  },

  // ============================================
  // A/B Test Flags
  // ============================================
  FF_AB_LANDING_PAGE: {
    type: 'STRING',
    description: 'Landing page variant (control, variant_a, variant_b)',
    defaultValue: 'control',
  },
  FF_AB_ONBOARDING_FLOW: {
    type: 'STRING',
    description: 'Onboarding flow variant',
    defaultValue: 'control',
  },
};

/**
 * Default values for all flags (derived from definitions)
 * @type {Object.<string, any>}
 */
export const FLAG_DEFAULTS = Object.fromEntries(
  Object.entries(FLAG_DEFINITIONS).map(([key, def]) => [key, def.defaultValue]),
);

/**
 * Get flag definition
 * @param {string} flagName
 * @returns {Object|undefined}
 */
export function getFlagDefinition(flagName) {
  return FLAG_DEFINITIONS[flagName];
}

/**
 * Check if a flag name is valid/defined
 * @param {string} flagName
 * @returns {boolean}
 */
export function isFlagDefined(flagName) {
  return flagName in FLAG_DEFINITIONS;
}

/**
 * Get all flag names by type
 * @param {string} type - BOOLEAN, PERCENTAGE, STRING, or USER_LIST
 * @returns {string[]}
 */
export function getFlagsByType(type) {
  return Object.entries(FLAG_DEFINITIONS)
    .filter(([, def]) => def.type === type)
    .map(([name]) => name);
}

/**
 * Get all flags in a category (by prefix)
 * @param {string} category - e.g., 'AUTH', 'BREEDING', 'UI'
 * @returns {string[]}
 */
export function getFlagsByCategory(category) {
  const prefix = `FF_${category}_`;
  return Object.keys(FLAG_DEFINITIONS).filter((name) =>
    name.startsWith(prefix),
  );
}

export default {
  FLAG_DEFINITIONS,
  FLAG_DEFAULTS,
  getFlagDefinition,
  isFlagDefined,
  getFlagsByType,
  getFlagsByCategory,
};
