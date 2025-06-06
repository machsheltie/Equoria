/**
 * Horse Model Trait Helpers
 * Utility functions for managing horse traits safely
 */

import { logger } from './logger.mjs';

/**
 * Safely add a trait to a horse's trait collection
 * @param {Object} horse - Horse object
 * @param {string} traitName - Name of the trait to add
 * @param {Object} traitData - Trait data object
 * @returns {Object} Updated horse object
 */
export function _addTraitSafely(horse, traitName, traitData = {}) {
  try {
    if (!horse) {
      throw new Error('Horse object is required');
    }

    if (!traitName || typeof traitName !== 'string') {
      throw new Error('Valid trait name is required');
    }

    // Initialize traits if not present
    if (!horse.traits) {
      horse.traits = {};
    }

    // Ensure trait data has required structure
    const safeTraitData = {
      name: traitName,
      type: traitData.type || 'unknown',
      rarity: traitData.rarity || 'common',
      effect: traitData.effect || {},
      discoveredAt: traitData.discoveredAt || new Date().toISOString(),
      isActive: traitData.isActive !== undefined ? traitData.isActive : true,
      ...traitData,
    };

    // Add the trait
    horse.traits[traitName] = safeTraitData;

    logger.info(
      `[horseModelTraitHelpers._addTraitSafely] Added trait '${traitName}' to horse ${horse.id || 'unknown'}`,
    );

    return horse;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers._addTraitSafely] Error adding trait '${traitName}': ${error.message}`,
    );
    throw error;
  }
}

/**
 * Safely remove a trait from a horse's trait collection
 * @param {Object} horse - Horse object
 * @param {string} traitName - Name of the trait to remove
 * @returns {Object} Updated horse object
 */
export function _removeTraitSafely(horse, traitName) {
  try {
    if (!horse) {
      throw new Error('Horse object is required');
    }

    if (!traitName || typeof traitName !== 'string') {
      throw new Error('Valid trait name is required');
    }

    // Initialize traits if not present
    if (!horse.traits) {
      horse.traits = {};
      return horse;
    }

    // Check if trait exists
    if (!horse.traits[traitName]) {
      logger.warn(
        `[horseModelTraitHelpers._removeTraitSafely] Trait '${traitName}' not found on horse ${horse.id || 'unknown'}`,
      );
      return horse;
    }

    // Remove the trait
    delete horse.traits[traitName];

    logger.info(
      `[horseModelTraitHelpers._removeTraitSafely] Removed trait '${traitName}' from horse ${horse.id || 'unknown'}`,
    );

    return horse;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers._removeTraitSafely] Error removing trait '${traitName}': ${error.message}`,
    );
    throw error;
  }
}

/**
 * Get all traits from a horse
 * @param {Object} horse - Horse object
 * @returns {Object} All traits object
 */
export function _getAllTraits(horse) {
  try {
    if (!horse) {
      throw new Error('Horse object is required');
    }

    // Return empty object if no traits
    if (!horse.traits || typeof horse.traits !== 'object') {
      return {};
    }

    // Return a copy to prevent mutation
    return { ...horse.traits };
  } catch (error) {
    logger.error(`[horseModelTraitHelpers._getAllTraits] Error getting traits: ${error.message}`);
    return {};
  }
}

/**
 * Get active traits from a horse
 * @param {Object} horse - Horse object
 * @returns {Object} Active traits object
 */
export function getActiveTraits(horse) {
  try {
    const allTraits = _getAllTraits(horse);
    const activeTraits = {};

    for (const [traitName, traitData] of Object.entries(allTraits)) {
      if (traitData.isActive !== false) {
        activeTraits[traitName] = traitData;
      }
    }

    return activeTraits;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.getActiveTraits] Error getting active traits: ${error.message}`,
    );
    return {};
  }
}

/**
 * Check if horse has a specific trait
 * @param {Object} horse - Horse object
 * @param {string} traitName - Name of the trait to check
 * @returns {boolean} True if horse has the trait
 */
export function hasTrait(horse, traitName) {
  try {
    if (!horse || !traitName) {
      return false;
    }

    const traits = _getAllTraits(horse);
    return Object.prototype.hasOwnProperty.call(traits, traitName);
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.hasTrait] Error checking trait '${traitName}': ${error.message}`,
    );
    return false;
  }
}

/**
 * Get trait by name
 * @param {Object} horse - Horse object
 * @param {string} traitName - Name of the trait to get
 * @returns {Object|null} Trait data or null if not found
 */
export function getTrait(horse, traitName) {
  try {
    if (!horse || !traitName) {
      return null;
    }

    const traits = _getAllTraits(horse);
    return traits[traitName] || null;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.getTrait] Error getting trait '${traitName}': ${error.message}`,
    );
    return null;
  }
}

/**
 * Get traits by type
 * @param {Object} horse - Horse object
 * @param {string} type - Type of traits to get
 * @returns {Object} Traits of the specified type
 */
export function getTraitsByType(horse, type) {
  try {
    const allTraits = _getAllTraits(horse);
    const typeTraits = {};

    for (const [traitName, traitData] of Object.entries(allTraits)) {
      if (traitData.type === type) {
        typeTraits[traitName] = traitData;
      }
    }

    return typeTraits;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.getTraitsByType] Error getting traits by type '${type}': ${error.message}`,
    );
    return {};
  }
}

/**
 * Get traits by rarity
 * @param {Object} horse - Horse object
 * @param {string} rarity - Rarity level to filter by
 * @returns {Object} Traits of the specified rarity
 */
export function getTraitsByRarity(horse, rarity) {
  try {
    const allTraits = _getAllTraits(horse);
    const rarityTraits = {};

    for (const [traitName, traitData] of Object.entries(allTraits)) {
      if (traitData.rarity === rarity) {
        rarityTraits[traitName] = traitData;
      }
    }

    return rarityTraits;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.getTraitsByRarity] Error getting traits by rarity '${rarity}': ${error.message}`,
    );
    return {};
  }
}

/**
 * Count total traits on a horse
 * @param {Object} horse - Horse object
 * @returns {number} Number of traits
 */
export function countTraits(horse) {
  try {
    const traits = _getAllTraits(horse);
    return Object.keys(traits).length;
  } catch (error) {
    logger.error(`[horseModelTraitHelpers.countTraits] Error counting traits: ${error.message}`);
    return 0;
  }
}

/**
 * Validate trait data structure
 * @param {Object} traitData - Trait data to validate
 * @returns {boolean} True if valid
 */
export function validateTraitData(traitData) {
  try {
    if (!traitData || typeof traitData !== 'object') {
      return false;
    }

    // Required fields
    if (!traitData.name || typeof traitData.name !== 'string') {
      return false;
    }

    // Optional but should be valid if present
    if (traitData.type && typeof traitData.type !== 'string') {
      return false;
    }

    if (traitData.rarity && typeof traitData.rarity !== 'string') {
      return false;
    }

    if (traitData.isActive !== undefined && typeof traitData.isActive !== 'boolean') {
      return false;
    }

    return true;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.validateTraitData] Error validating trait data: ${error.message}`,
    );
    return false;
  }
}
