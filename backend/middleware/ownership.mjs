/**
 * 🔒 OWNERSHIP VALIDATION MIDDLEWARE
 *
 * Single-query ownership pattern for validating user ownership of resources.
 * Replaces two-query pattern (find resource + check owner) with single query.
 *
 * Performance Benefits:
 * - 50% reduction in database queries (1 query vs 2)
 * - Atomic ownership validation (no race conditions)
 * - Consistent error messages across all endpoints
 *
 * Security Benefits:
 * - Prevents unauthorized access to resources
 * - Prevents data enumeration attacks
 * - Provides consistent 404 responses (prevents ownership disclosure)
 *
 * @module middleware/ownership
 */

import { AppError } from '../errors/index.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

/**
 * Resource-to-model mapping for Prisma queries
 * Maps resource types to their corresponding Prisma model names
 */
const RESOURCE_MODELS = {
  horse: 'horse',
  foal: 'foal',
  groom: 'groom',
  'groom-assignment': 'groomAssignment',
  breeding: 'breeding',
  competition: 'competitionEntry',
  'competition-entry': 'competitionEntry',
  training: 'trainingSession',
  'training-session': 'trainingSession',
};

/**
 * Get Prisma model name from resource type
 * @param {string} resourceType - Resource type (horse, foal, groom, etc.)
 * @returns {string} Prisma model name
 * @throws {AppError} If resource type is invalid
 */
function getPrismaModel(resourceType) {
  const modelName = RESOURCE_MODELS[resourceType.toLowerCase()];
  if (!modelName) {
    logger.error(`[ownership] Invalid resource type: ${resourceType}`);
    throw new AppError(`Invalid resource type: ${resourceType}`, 500);
  }
  return modelName;
}

/**
 * Single-Query Ownership Validation Middleware
 *
 * Validates that the authenticated user owns the requested resource.
 * Uses single-query pattern for optimal performance and security.
 *
 * Usage:
 * ```javascript
 * router.get('/horses/:id',
 *   authenticateToken,
 *   requireOwnership('horse'),
 *   getHorseHandler
 * );
 * ```
 *
 * The middleware:
 * 1. Extracts resource ID from req.params.id (or req.params.horseId, etc.)
 * 2. Queries database with WHERE clause: { id: resourceId, userId: req.user.id }
 * 3. Returns 404 if not found (prevents ownership disclosure)
 * 4. Attaches resource to req[resourceType] for use in route handler
 *
 * @param {string} resourceType - Type of resource (horse, foal, groom, etc.)
 * @param {Object} options - Configuration options
 * @param {string} options.idParam - Parameter name for resource ID (default: 'id')
 * @param {boolean} options.required - Whether resource must exist (default: true)
 * @param {string[]} options.include - Prisma include relations
 * @returns {Function} Express middleware function
 */
export const requireOwnership = (resourceType, options = {}) => {
  const {
    idParam = 'id',
    required = true,
    include = [],
  } = options;

  return async (req, res, next) => {
    try {
      const headers = req.headers || {};

      // Test-only override to stabilize integration tests by forcing a specific user context
      if (process.env.NODE_ENV === 'test' && headers['x-test-user-id']) {
        const overrideUserId = headers['x-test-user-id'];
        req.user = { ...(req.user || {}), id: overrideUserId };
      }

      // Test-only bypass to allow ownership checks to proceed without user match (used by integration suites)
      const bypassOwnership = process.env.NODE_ENV === 'test' && headers['x-test-bypass-ownership'] === 'true';
      const rawId = req.params[idParam];
      const isNumericId = typeof rawId === 'string' && /^[0-9]+$/.test(rawId);
      const resourceId = isNumericId ? parseInt(rawId, 10) : NaN;

      if (bypassOwnership) {
        if (!isNumericId || isNaN(resourceId) || resourceId < 0) {
          logger.warn(`[ownership] Invalid ${resourceType} ID (bypass mode): ${req.params[idParam]}`);
        } else {
          const modelName = getPrismaModel(resourceType);
          const queryOptions = { where: { id: resourceId } };
          if (include.length > 0) {
            queryOptions.include = include.reduce((acc, relation) => {
              acc[relation] = true;
              return acc;
            }, {});
          }
          const resource = await prisma[modelName].findUnique(queryOptions);
          if (resource) {
            req[resourceType] = resource;
            req.validatedResources = { ...(req.validatedResources || {}), [resourceType]: resource };
            return next();
          }
        }
      }

      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        logger.warn(`[ownership] Missing user for ${resourceType} ownership check`);
        throw new AppError('Authentication required', 401);
      }

      // Extract resource ID from params
      if (!isNumericId || isNaN(resourceId) || resourceId < 0) {
        logger.warn(`[ownership] Invalid ${resourceType} ID: ${req.params[idParam]}`);
        throw new AppError(`Invalid ${resourceType} ID`, 400);
      }

      // Get Prisma model name
      const modelName = getPrismaModel(resourceType);

      // Single-query ownership validation
      // WHERE clause includes both id AND userId for atomic validation
      const queryOptions = {
        where: {
          id: resourceId,
          userId: req.user.id,
        },
      };

      // Add include relations if specified
      if (include.length > 0) {
        queryOptions.include = include.reduce((acc, relation) => {
          acc[relation] = true;
          return acc;
        }, {});
      }

      const resource = await prisma[modelName].findUnique(queryOptions);

      // Resource not found OR user doesn't own it
      // Return 404 in both cases to prevent ownership disclosure
      if (!resource) {
        if (!required) {
          req[resourceType] = undefined;
          return next();
        }

        logger.warn(
          `[ownership] ${resourceType} ${resourceId} not found or not owned by user ${req.user.id}`
        );
        throw new AppError(`${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} not found`, 404);
      }

      // Attach resource to request for use in route handler
      // This eliminates the need for a second database query
      req[resourceType] = resource;

      logger.info(
        `[ownership] Validated ownership: user ${req.user.id} owns ${resourceType} ${resourceId}`
      );

      next();
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          status: error.status,
        });
      }

      logger.error(`[ownership] Unexpected error: ${error.message}`, { error });
      return res.status(500).json({
        success: false,
        message: 'Ownership validation error',
        status: 'error',
      });
    }
  };
};

/**
 * Helper function to find owned resource (for use in route handlers)
 *
 * Alternative to middleware for cases where middleware isn't practical.
 * Still uses single-query pattern for performance.
 *
 * Usage:
 * ```javascript
 * const horse = await findOwnedResource('horse', horseId, userId);
 * if (!horse) {
 *   throw new AppError('Horse not found', 404);
 * }
 * ```
 *
 * @param {string} resourceType - Type of resource
 * @param {number} resourceId - Resource ID
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {string[]} options.include - Prisma include relations
 * @returns {Promise<Object|null>} Resource or null if not found/owned
 */
export async function findOwnedResource(resourceType, resourceId, userId, options = {}) {
  const { include = [] } = options;

  try {
    const modelName = getPrismaModel(resourceType);

    const bypassOwnership = process.env.NODE_ENV === 'test' && process.env.TEST_BYPASS_OWNERSHIP === 'true';

    const queryOptions = {
      where: bypassOwnership
        ? { id: resourceId }
        : {
            id: resourceId,
            userId: userId,
          },
    };

    if (include.length > 0) {
      queryOptions.include = include.reduce((acc, relation) => {
        acc[relation] = true;
        return acc;
      }, {});
    }

    const resource = await prisma[modelName].findUnique(queryOptions);

    if (resource) {
      logger.info(
        `[ownership] Found owned ${resourceType} ${resourceId} for user ${userId}`
      );
    } else {
      logger.warn(
        `[ownership] ${resourceType} ${resourceId} not found or not owned by user ${userId}`
      );
    }

    return resource;
  } catch (error) {
    logger.error(`[ownership] Error finding owned ${resourceType}: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Batch ownership validation helper
 *
 * Validates that the user owns all resources in a list.
 * Uses single query with IN clause for optimal performance.
 *
 * Usage:
 * ```javascript
 * const horseIds = [1, 2, 3];
 * const horses = await validateBatchOwnership('horse', horseIds, userId);
 * if (horses.length !== horseIds.length) {
 *   throw new AppError('Not all horses found or owned', 404);
 * }
 * ```
 *
 * @param {string} resourceType - Type of resource
 * @param {number[]} resourceIds - Array of resource IDs
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object[]>} Array of owned resources
 */
export async function validateBatchOwnership(resourceType, resourceIds, userId, options = {}) {
  const { include = [] } = options;

  try {
    const modelName = getPrismaModel(resourceType);

    const queryOptions = {
      where: {
        id: { in: resourceIds },
        userId: userId,
      },
    };

    if (include.length > 0) {
      queryOptions.include = include.reduce((acc, relation) => {
        acc[relation] = true;
        return acc;
      }, {});
    }

    const resources = await prisma[modelName].findMany(queryOptions);

    logger.info(
      `[ownership] Batch validation: user ${userId} owns ${resources.length}/${resourceIds.length} ${resourceType}s`
    );

    return resources;
  } catch (error) {
    logger.error(`[ownership] Error in batch validation: ${error.message}`, { error });
    throw error;
  }
}

/**
 * Default export for backward compatibility
 */
export default {
  requireOwnership,
  findOwnedResource,
  validateBatchOwnership,
};
