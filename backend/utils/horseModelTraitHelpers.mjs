/**
 * Horse Model Trait Helpers
 * Utility functions for managing horse traits safely with categorized trait system
 */

import logger from './logger.mjs';

/**
 * Safely add a trait to a trait collection category
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @param {string} traitName - Name of the trait to add
 * @param {string} category - Category to add to ('positive', 'negative', 'hidden')
 * @returns {Object} Updated traits object
 */
export function _addTraitSafely(traits, traitName, category) {
  try {
    if (!traits || typeof traits !== 'object') {
      throw new Error('Traits object is required');
    }

    if (!traitName || typeof traitName !== 'string') {
      throw new Error('Valid trait name is required');
    }

    if (!category || !['positive', 'negative', 'hidden'].includes(category)) {
      throw new Error('Valid category is required (positive, negative, hidden)');
    }

    // Create a deep copy to avoid mutation
    const updatedTraits = {
      positive: [...(traits.positive || [])],
      negative: [...(traits.negative || [])],
      hidden: [...(traits.hidden || [])],
    };

    // Check if trait already exists in the category
    if (!updatedTraits[category].includes(traitName)) {
      updatedTraits[category].push(traitName);
      logger.info(
        `[horseModelTraitHelpers._addTraitSafely] Added trait '${traitName}' to ${category} category`,
      );
    } else {
      logger.warn(
        `[horseModelTraitHelpers._addTraitSafely] Trait '${traitName}' already exists in ${category} category`,
      );
    }

    return updatedTraits;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers._addTraitSafely] Error adding trait '${traitName}': ${error.message}`,
    );
    throw error;
  }
}

/**
 * Safely remove a trait from a trait collection category
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @param {string} traitName - Name of the trait to remove
 * @param {string} category - Category to remove from ('positive', 'negative', 'hidden')
 * @returns {Object} Updated traits object
 */
export function _removeTraitSafely(traits, traitName, category) {
  try {
    if (!traits || typeof traits !== 'object') {
      throw new Error('Traits object is required');
    }

    if (!traitName || typeof traitName !== 'string') {
      throw new Error('Valid trait name is required');
    }

    if (!category || !['positive', 'negative', 'hidden'].includes(category)) {
      throw new Error('Valid category is required (positive, negative, hidden)');
    }

    // Create a deep copy to avoid mutation
    const updatedTraits = {
      positive: [...(traits.positive || [])],
      negative: [...(traits.negative || [])],
      hidden: [...(traits.hidden || [])],
    };

    // Remove the trait from the specified category
    const initialLength = updatedTraits[category].length;
    updatedTraits[category] = updatedTraits[category].filter(trait => trait !== traitName);

    if (updatedTraits[category].length < initialLength) {
      logger.info(
        `[horseModelTraitHelpers._removeTraitSafely] Removed trait '${traitName}' from ${category} category`,
      );
    } else {
      logger.warn(
        `[horseModelTraitHelpers._removeTraitSafely] Trait '${traitName}' not found in ${category} category`,
      );
    }

    return updatedTraits;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers._removeTraitSafely] Error removing trait '${traitName}': ${error.message}`,
    );
    throw error;
  }
}

/**
 * Get all traits from a trait collection as a flattened array
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @returns {Array} Flattened array of all traits
 */
export function _getAllTraits(traits) {
  try {
    if (!traits || typeof traits !== 'object') {
      return [];
    }

    // Flatten all trait categories into a single array
    const allTraits = [
      ...(traits.positive || []),
      ...(traits.negative || []),
      ...(traits.hidden || []),
    ];

    return allTraits;
  } catch (error) {
    logger.error(`[horseModelTraitHelpers._getAllTraits] Error getting traits: ${error.message}`);
    return [];
  }
}

/**
 * Check if a trait collection has a specific trait in any category
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @param {string} traitName - Name of the trait to check
 * @returns {boolean} True if trait exists in any category
 */
export function hasTrait(traits, traitName) {
  try {
    if (!traits || !traitName) {
      return false;
    }

    const allTraits = _getAllTraits(traits);
    return allTraits.includes(traitName);
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.hasTrait] Error checking trait '${traitName}': ${error.message}`,
    );
    return false;
  }
}

/**
 * Get the category of a specific trait
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @param {string} traitName - Name of the trait to find
 * @returns {string|null} Category name or null if not found
 */
export function getTraitCategory(traits, traitName) {
  try {
    if (!traits || !traitName) {
      return null;
    }

    if ((traits.positive || []).includes(traitName)) return 'positive';
    if ((traits.negative || []).includes(traitName)) return 'negative';
    if ((traits.hidden || []).includes(traitName)) return 'hidden';

    return null;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.getTraitCategory] Error finding trait '${traitName}': ${error.message}`,
    );
    return null;
  }
}

/**
 * Move a trait from one category to another
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @param {string} traitName - Name of the trait to move
 * @param {string} fromCategory - Source category
 * @param {string} toCategory - Destination category
 * @returns {Object} Updated traits object
 */
export function moveTraitBetweenCategories(traits, traitName, fromCategory, toCategory) {
  try {
    if (!traits || !traitName || !fromCategory || !toCategory) {
      throw new Error('All parameters are required');
    }

    if (!['positive', 'negative', 'hidden'].includes(fromCategory) ||
        !['positive', 'negative', 'hidden'].includes(toCategory)) {
      throw new Error('Invalid category specified');
    }

    // Remove from source category
    const afterRemoval = _removeTraitSafely(traits, traitName, fromCategory);

    // Add to destination category
    const afterAddition = _addTraitSafely(afterRemoval, traitName, toCategory);

    logger.info(
      `[horseModelTraitHelpers.moveTraitBetweenCategories] Moved trait '${traitName}' from ${fromCategory} to ${toCategory}`,
    );

    return afterAddition;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.moveTraitBetweenCategories] Error moving trait '${traitName}': ${error.message}`,
    );
    throw error;
  }
}

/**
 * Count total traits in a trait collection
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @returns {number} Total number of traits across all categories
 */
export function countTraits(traits) {
  try {
    if (!traits || typeof traits !== 'object') {
      return 0;
    }

    const totalTraits = (traits.positive || []).length +
                       (traits.negative || []).length +
                       (traits.hidden || []).length;

    return totalTraits;
  } catch (error) {
    logger.error(`[horseModelTraitHelpers.countTraits] Error counting traits: ${error.message}`);
    return 0;
  }
}

/**
 * Count traits in a specific category
 * @param {Object} traits - Traits object with positive, negative, hidden arrays
 * @param {string} category - Category to count ('positive', 'negative', 'hidden')
 * @returns {number} Number of traits in the specified category
 */
export function countTraitsByCategory(traits, category) {
  try {
    if (!traits || typeof traits !== 'object') {
      return 0;
    }

    if (!['positive', 'negative', 'hidden'].includes(category)) {
      throw new Error('Invalid category specified');
    }

    return (traits[category] || []).length;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.countTraitsByCategory] Error counting traits in category '${category}': ${error.message}`,
    );
    return 0;
  }
}

/**
 * Validate trait collection structure
 * @param {Object} traits - Traits object to validate
 * @returns {boolean} True if valid
 */
export function validateTraitStructure(traits) {
  try {
    if (!traits || typeof traits !== 'object') {
      return false;
    }

    // Check that all categories are arrays (or undefined)
    const categories = ['positive', 'negative', 'hidden'];
    for (const category of categories) {
      if (traits[category] !== undefined && !Array.isArray(traits[category])) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error(
      `[horseModelTraitHelpers.validateTraitStructure] Error validating trait structure: ${error.message}`,
    );
    return false;
  }
}
