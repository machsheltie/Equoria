/**
 * 🎯 Field Selection Helper Utilities
 *
 * Predefined field selection presets for Prisma queries
 * Features:
 * - Avoid SELECT * and over-fetching
 * - Model-specific field presets (list, detail, minimal, marketplace, etc.)
 * - Relationship field selection
 * - Dynamic field selection based on context
 * - Exclude large JSONB columns from list views
 *
 * Usage in controllers:
 * ```javascript
 * import { buildSelectObject } from '../utils/fieldSelectionHelper.mjs';
 *
 * const horses = await prisma.horse.findMany({
 *   where: { forSale: true },
 *   select: buildSelectObject('Horse', 'list'), // Only list fields
 *   include: buildIncludeObject('Horse', 'list')
 * });
 * ```
 */

import logger from './logger.mjs';

/**
 * Field selection presets for all models
 * Organized by model and context
 */
export const FIELD_PRESETS = {
  /**
   * Horse model field presets
   */
  Horse: {
    /**
     * Minimal fields - For dropdowns, references, IDs only
     * ~1KB per record
     */
    minimal: {
      id: true,
      name: true,
    },

    /**
     * List view fields - For browsing/search results
     * ~5KB per record (excludes large JSONB columns)
     */
    list: {
      id: true,
      name: true,
      age: true,
      healthStatus: true,
      forSale: true,
      salePrice: true,
      breedId: true,
      ownerId: true,
      stats: true, // Base stats (10 fields)
      // Exclude large JSONB: genotype, epigeneticModifiers, ultraRareTraits, phenotypicMarkings, tack
    },

    /**
     * Marketplace fields - For horses for sale
     * ~8KB per record
     */
    marketplace: {
      id: true,
      name: true,
      age: true,
      salePrice: true,
      breedId: true,
      ownerId: true,
      stats: true,
      healthStatus: true,
      disciplineScores: true, // Show performance potential
      phenotypicMarkings: true, // Visual appearance
      // Exclude: genotype, epigeneticModifiers, ultraRareTraits
    },

    /**
     * Detail view fields - For single horse view
     * ~15KB per record (includes some JSONB but not all)
     */
    detail: {
      id: true,
      name: true,
      age: true,
      healthStatus: true,
      forSale: true,
      salePrice: true,
      breedId: true,
      ownerId: true,
      stats: true,
      disciplineScores: true,
      phenotypicMarkings: true,
      tack: true,
      trainingCooldown: true,
      lastTrained: true,
      stableId: true,
      createdAt: true,
      // Still exclude ultra-large JSONB: genotype, epigeneticModifiers, ultraRareTraits
    },

    /**
     * Full fields - For breeding/genetics view (owner only)
     * ~50KB per record (everything)
     */
    full: {
      id: true,
      name: true,
      age: true,
      healthStatus: true,
      forSale: true,
      salePrice: true,
      breedId: true,
      ownerId: true,
      stats: true,
      disciplineScores: true,
      phenotypicMarkings: true,
      tack: true,
      genotype: true, // Large JSONB (genetic data)
      epigeneticModifiers: true, // Large JSONB
      ultraRareTraits: true, // Large JSONB
      epigeneticFlags: true,
      trainingCooldown: true,
      lastTrained: true,
      stableId: true,
      createdAt: true,
      updatedAt: true,
    },

    /**
     * Training view - For training screens
     * ~10KB per record
     */
    training: {
      id: true,
      name: true,
      age: true,
      stats: true,
      disciplineScores: true,
      trainingCooldown: true,
      lastTrained: true,
      healthStatus: true,
    },

    /**
     * Competition view - For competition entries
     * ~12KB per record
     */
    competition: {
      id: true,
      name: true,
      age: true,
      breedId: true,
      ownerId: true,
      stats: true,
      disciplineScores: true,
      tack: true,
      healthStatus: true,
    },
  },

  /**
   * User model field presets
   */
  User: {
    /**
     * Minimal fields - For references
     */
    minimal: {
      id: true,
      username: true,
    },

    /**
     * List view - For user lists, leaderboards
     * ~2KB per record
     */
    list: {
      id: true,
      username: true,
      level: true,
      experience: true,
      totalHorses: true,
      totalCompetitionsWon: true,
      // Exclude: email, password, refreshToken, emailVerificationToken, etc.
    },

    /**
     * Leaderboard view - Specific to leaderboards
     * ~2KB per record
     */
    leaderboard: {
      id: true,
      username: true,
      level: true,
      experience: true,
      totalHorses: true,
      totalCompetitionsWon: true,
      totalCompetitionsEntered: true,
      createdAt: true, // For "member since"
    },

    /**
     * Profile view - For profile pages (owner)
     * ~5KB per record
     */
    profile: {
      id: true,
      username: true,
      email: true,
      level: true,
      experience: true,
      coins: true,
      totalHorses: true,
      totalCompetitionsWon: true,
      totalCompetitionsEntered: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      // Exclude: password, refreshToken, emailVerificationToken, resetPasswordToken
    },

    /**
     * Full fields - For authentication/admin only
     */
    full: {
      id: true,
      username: true,
      email: true,
      level: true,
      experience: true,
      coins: true,
      totalHorses: true,
      totalCompetitionsWon: true,
      totalCompetitionsEntered: true,
      emailVerified: true,
      emailVerificationToken: true,
      resetPasswordToken: true,
      resetPasswordExpires: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      // Exclude: password (never include in select)
    },
  },

  /**
   * Groom model field presets
   */
  Groom: {
    /**
     * Minimal fields
     */
    minimal: {
      id: true,
      name: true,
    },

    /**
     * List view
     * ~3KB per record
     */
    list: {
      id: true,
      name: true,
      speciality: true,
      experience: true,
      skill_level: true,
      personality: true,
      hourly_rate: true,
      is_active: true,
      // Exclude: availability (JSONB), bio, image_url
    },

    /**
     * Detail view
     * ~5KB per record
     */
    detail: {
      id: true,
      name: true,
      speciality: true,
      experience: true,
      skill_level: true,
      personality: true,
      hourly_rate: true,
      availability: true, // JSONB
      bio: true,
      image_url: true,
      is_active: true,
      hired_date: true,
      createdAt: true,
    },

    /**
     * Marketplace view - For hiring grooms
     * ~4KB per record
     */
    marketplace: {
      id: true,
      name: true,
      speciality: true,
      experience: true,
      skill_level: true,
      personality: true,
      hourly_rate: true,
      bio: true,
      image_url: true,
      is_active: true,
    },
  },

  /**
   * Breed model field presets
   */
  Breed: {
    /**
     * Minimal fields
     */
    minimal: {
      id: true,
      name: true,
    },

    /**
     * List view
     */
    list: {
      id: true,
      name: true,
      rarity: true,
      description: true,
      // Exclude: baseStats (JSONB)
    },

    /**
     * Detail view
     */
    detail: {
      id: true,
      name: true,
      rarity: true,
      description: true,
      baseStats: true, // JSONB with breed base stats
      createdAt: true,
    },
  },

  /**
   * Competition/Show model field presets
   */
  Show: {
    /**
     * List view
     */
    list: {
      id: true,
      name: true,
      discipline: true,
      difficulty: true,
      entryFee: true,
      prizePool: true,
      maxEntries: true,
      status: true,
      showDate: true,
    },

    /**
     * Detail view
     */
    detail: {
      id: true,
      name: true,
      discipline: true,
      difficulty: true,
      entryFee: true,
      prizePool: true,
      maxEntries: true,
      status: true,
      showDate: true,
      description: true,
      requirements: true, // JSONB with entry requirements
      createdAt: true,
    },
  },

  /**
   * CompetitionResult model field presets
   */
  CompetitionResult: {
    /**
     * List view
     */
    list: {
      id: true,
      placement: true,
      finalScore: true,
      prizeMoney: true,
      runDate: true,
      showId: true,
      horseId: true,
      userId: true,
    },

    /**
     * Detail view
     */
    detail: {
      id: true,
      placement: true,
      finalScore: true,
      prizeMoney: true,
      runDate: true,
      showId: true,
      horseId: true,
      userId: true,
      scoreBreakdown: true, // JSONB with detailed scoring
      statGains: true, // JSONB
      traitBonuses: true, // JSONB
      createdAt: true,
    },
  },
};

/**
 * Include (relationship) presets for models
 */
export const INCLUDE_PRESETS = {
  Horse: {
    /**
     * List view - Minimal related data
     */
    list: {
      breed: {
        select: FIELD_PRESETS.Breed.minimal,
      },
      owner: {
        select: FIELD_PRESETS.User.minimal,
      },
    },

    /**
     * Detail view - More complete related data
     */
    detail: {
      breed: {
        select: FIELD_PRESETS.Breed.list,
      },
      owner: {
        select: FIELD_PRESETS.User.minimal,
      },
      stable: {
        select: {
          id: true,
          name: true,
        },
      },
    },

    /**
     * Full view - Complete related data
     */
    full: {
      breed: true,
      owner: {
        select: FIELD_PRESETS.User.minimal,
      },
      stable: true,
      assignments: {
        include: {
          groom: {
            select: FIELD_PRESETS.Groom.list,
          },
        },
      },
    },
  },

  User: {
    /**
     * Profile view - User's horses
     */
    profile: {
      horses: {
        select: FIELD_PRESETS.Horse.list,
        take: 20, // Limit horses shown
      },
    },
  },

  Show: {
    /**
     * Detail view - Show entries
     */
    detail: {
      entries: {
        include: {
          horse: {
            select: FIELD_PRESETS.Horse.competition,
          },
          user: {
            select: FIELD_PRESETS.User.minimal,
          },
        },
        take: 100, // Limit entries shown
      },
    },
  },
};

/**
 * Build Prisma select object from preset
 *
 * @param {string} modelName - Model name (e.g., 'Horse', 'User')
 * @param {string} preset - Preset name (e.g., 'list', 'detail', 'minimal')
 * @param {Object} customFields - Additional fields to include/exclude
 * @returns {Object} Prisma select object
 *
 * @example
 * const select = buildSelectObject('Horse', 'list');
 * const horses = await prisma.horse.findMany({ select });
 */
export function buildSelectObject(modelName, preset = 'list', customFields = {}) {
  const modelPresets = FIELD_PRESETS[modelName];

  if (!modelPresets) {
    logger.warn(`[fieldSelectionHelper] No presets found for model: ${modelName}, using default`);
    return undefined; // Let Prisma return all fields
  }

  const presetFields = modelPresets[preset];

  if (!presetFields) {
    logger.warn(`[fieldSelectionHelper] No preset "${preset}" found for model: ${modelName}, using "list"`);
    return modelPresets.list || undefined;
  }

  // Merge preset fields with custom fields
  return {
    ...presetFields,
    ...customFields,
  };
}

/**
 * Build Prisma include object from preset
 *
 * @param {string} modelName - Model name
 * @param {string} preset - Preset name
 * @param {Object} customIncludes - Additional includes
 * @returns {Object} Prisma include object
 */
export function buildIncludeObject(modelName, preset = 'list', customIncludes = {}) {
  const modelIncludes = INCLUDE_PRESETS[modelName];

  if (!modelIncludes) {
    logger.debug(`[fieldSelectionHelper] No includes found for model: ${modelName}`);
    return undefined;
  }

  const presetIncludes = modelIncludes[preset];

  if (!presetIncludes) {
    logger.debug(`[fieldSelectionHelper] No include preset "${preset}" for model: ${modelName}`);
    return undefined;
  }

  // Merge preset includes with custom includes
  return {
    ...presetIncludes,
    ...customIncludes,
  };
}

/**
 * Build combined select + include for Prisma query
 *
 * @param {string} modelName - Model name
 * @param {string} preset - Preset name
 * @param {Object} options - Custom fields and includes
 * @returns {Object} Combined Prisma query params
 *
 * @example
 * const params = buildQueryParams('Horse', 'list', {
 *   customFields: { customField: true },
 *   customIncludes: { customRelation: true }
 * });
 * const horses = await prisma.horse.findMany({ ...params });
 */
export function buildQueryParams(modelName, preset = 'list', options = {}) {
  const { customFields = {}, customIncludes = {} } = options;

  const select = buildSelectObject(modelName, preset, customFields);
  const include = buildIncludeObject(modelName, preset, customIncludes);

  return {
    select,
    include,
  };
}

/**
 * Get estimated response size for a preset
 *
 * @param {string} modelName - Model name
 * @param {string} preset - Preset name
 * @returns {Object} Size estimation
 */
export function getPresetSizeEstimate(modelName, preset = 'list') {
  const estimates = {
    Horse: {
      minimal: { bytes: 1024, description: '~1KB - ID and name only' },
      list: { bytes: 5120, description: '~5KB - List view (no large JSONB)' },
      marketplace: { bytes: 8192, description: '~8KB - Marketplace view' },
      detail: { bytes: 15360, description: '~15KB - Detail view (some JSONB)' },
      full: { bytes: 51200, description: '~50KB - Full data (all JSONB)' },
      training: { bytes: 10240, description: '~10KB - Training view' },
      competition: { bytes: 12288, description: '~12KB - Competition view' },
    },
    User: {
      minimal: { bytes: 512, description: '~0.5KB - ID and username' },
      list: { bytes: 2048, description: '~2KB - List view' },
      leaderboard: { bytes: 2048, description: '~2KB - Leaderboard view' },
      profile: { bytes: 5120, description: '~5KB - Profile view' },
      full: { bytes: 8192, description: '~8KB - Full data (no password)' },
    },
    Groom: {
      minimal: { bytes: 512, description: '~0.5KB - ID and name' },
      list: { bytes: 3072, description: '~3KB - List view' },
      detail: { bytes: 5120, description: '~5KB - Detail view' },
      marketplace: { bytes: 4096, description: '~4KB - Marketplace view' },
    },
  };

  return estimates[modelName]?.[preset] || { bytes: 0, description: 'Unknown' };
}

/**
 * Calculate potential bandwidth savings
 *
 * @param {string} modelName - Model name
 * @param {number} recordCount - Number of records
 * @param {string} fromPreset - Original preset (e.g., 'full')
 * @param {string} toPreset - Optimized preset (e.g., 'list')
 * @returns {Object} Savings calculation
 */
export function calculateBandwidthSavings(modelName, recordCount, fromPreset, toPreset) {
  const fromSize = getPresetSizeEstimate(modelName, fromPreset);
  const toSize = getPresetSizeEstimate(modelName, toPreset);

  const originalBytes = fromSize.bytes * recordCount;
  const optimizedBytes = toSize.bytes * recordCount;
  const savedBytes = originalBytes - optimizedBytes;
  const savingsPercent = ((savedBytes / originalBytes) * 100).toFixed(1);

  return {
    recordCount,
    originalSize: formatBytes(originalBytes),
    optimizedSize: formatBytes(optimizedBytes),
    savedBytes: formatBytes(savedBytes),
    savingsPercent: `${savingsPercent}%`,
  };
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) { return '0 Bytes'; }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Default export
export default {
  FIELD_PRESETS,
  INCLUDE_PRESETS,
  buildSelectObject,
  buildIncludeObject,
  buildQueryParams,
  getPresetSizeEstimate,
  calculateBandwidthSavings,
};
