/**
 * Feature Flag Middleware
 *
 * Express middleware for feature flag evaluation at request level.
 * Attaches evaluated flags to the request object for use in handlers.
 *
 * @module middleware/featureFlagMiddleware
 */

import {
  isFeatureEnabled,
  getAllFlags,
  getEvaluationStats,
} from '../services/featureFlagService.mjs';
import { FLAG_DEFINITIONS } from '../utils/featureFlags.mjs';
import logger from '../utils/logger.mjs';

/**
 * Middleware to attach feature flag evaluator to request
 *
 * Adds `req.featureFlags` object with:
 * - `isEnabled(flagName)`: Check if flag is enabled for this request
 * - `getAll()`: Get all flags evaluated for this request
 *
 * @returns {Function} Express middleware
 *
 * @example
 * // In route handler
 * app.get('/api/breeding', async (req, res) => {
 *   if (await req.featureFlags.isEnabled('FF_BREEDING_NEW_UI')) {
 *     return res.json({ ui: 'new' });
 *   }
 *   return res.json({ ui: 'legacy' });
 * });
 */
export function featureFlagMiddleware() {
  return async (req, res, next) => {
    // Build context from request
    const context = {
      userId: req.user?.id?.toString(),
      email: req.user?.email,
      environment: process.env.NODE_ENV,
      ip: req.ip,
    };

    // Attach feature flag evaluator to request
    req.featureFlags = {
      /**
       * Check if a specific flag is enabled
       * @param {string} flagName
       * @returns {Promise<boolean>}
       */
      isEnabled: (flagName) => isFeatureEnabled(flagName, context),

      /**
       * Get all flags for this request
       * @returns {Promise<Object>}
       */
      getAll: () => getAllFlags(context),

      /**
       * Get the evaluation context
       * @returns {Object}
       */
      getContext: () => ({ ...context }),
    };

    next();
  };
}

/**
 * Create a middleware that gates a route behind a feature flag
 *
 * @param {string} flagName - Feature flag to check
 * @param {Object} options
 * @param {number} [options.statusCode=404] - HTTP status if flag is disabled
 * @param {string} [options.message='Feature not available'] - Error message
 * @returns {Function} Express middleware
 *
 * @example
 * // Gate an entire route
 * router.use('/marketplace', requireFeature('FF_MARKETPLACE_ENABLED'));
 *
 * // Gate a specific endpoint
 * router.post('/breed', requireFeature('FF_BREEDING_EPIGENETICS'), breedHandler);
 */
export function requireFeature(flagName, options = {}) {
  const { statusCode = 404, message = 'Feature not available' } = options;

  return async (req, res, next) => {
    // Ensure featureFlagMiddleware has been applied
    if (!req.featureFlags) {
      logger.error('[FeatureFlag] requireFeature used without middleware');
      return res.status(500).json({ error: 'Internal server error' });
    }

    const enabled = await req.featureFlags.isEnabled(flagName);

    if (!enabled) {
      logger.info('[FeatureFlag] Access denied - flag disabled', {
        flagName,
        userId: req.user?.id,
        path: req.path,
      });
      return res.status(statusCode).json({ error: message });
    }

    next();
  };
}

/**
 * Internal admin endpoint handlers for feature flag management
 * These should be protected by authentication and authorization
 */
export const featureFlagAdminHandlers = {
  /**
   * GET /api/internal/feature-flags
   * List all flags and their current values
   */
  listFlags: async (req, res) => {
    try {
      const flags = await req.featureFlags.getAll();
      const definitions = FLAG_DEFINITIONS;

      const response = Object.entries(flags).map(([name, value]) => ({
        name,
        value,
        type: definitions[name]?.type,
        description: definitions[name]?.description,
      }));

      res.json({ flags: response });
    } catch (error) {
      logger.error('[FeatureFlag] Error listing flags', {
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to list feature flags' });
    }
  },

  /**
   * GET /api/internal/feature-flags/stats
   * Get evaluation statistics
   */
  getStats: async (req, res) => {
    try {
      const stats = getEvaluationStats();
      res.json({ stats });
    } catch (error) {
      logger.error('[FeatureFlag] Error getting stats', {
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to get statistics' });
    }
  },

  /**
   * GET /api/internal/feature-flags/:flagName
   * Get a specific flag's status and definition
   */
  getFlag: async (req, res) => {
    try {
      const { flagName } = req.params;
      const definition = FLAG_DEFINITIONS[flagName];

      if (!definition) {
        return res.status(404).json({ error: 'Flag not found' });
      }

      const enabled = await req.featureFlags.isEnabled(flagName);

      res.json({
        name: flagName,
        enabled,
        ...definition,
      });
    } catch (error) {
      logger.error('[FeatureFlag] Error getting flag', {
        error: error.message,
        flagName: req.params.flagName,
      });
      res.status(500).json({ error: 'Failed to get feature flag' });
    }
  },
};

/**
 * A/B test middleware - assigns user to a variant and tracks
 *
 * @param {string} flagName - A/B test flag name
 * @param {string[]} variants - Possible variants
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/landing',
 *   abTestMiddleware('FF_AB_LANDING_PAGE', ['control', 'variant_a', 'variant_b']),
 *   (req, res) => {
 *     res.render(req.abVariant); // Renders assigned variant
 *   }
 * );
 */
export function abTestMiddleware(flagName, variants) {
  return async (req, res, next) => {
    if (!req.featureFlags) {
      return next();
    }

    // Get configured variant from flag
    const envValue = process.env[flagName];

    if (envValue && variants.includes(envValue)) {
      req.abVariant = envValue;
    } else {
      // Default to first variant (control)
      req.abVariant = variants[0];
    }

    // Log for analytics
    logger.info('[ABTest] Variant assigned', {
      flagName,
      variant: req.abVariant,
      userId: req.user?.id,
    });

    next();
  };
}

export default {
  featureFlagMiddleware,
  requireFeature,
  featureFlagAdminHandlers,
  abTestMiddleware,
};
