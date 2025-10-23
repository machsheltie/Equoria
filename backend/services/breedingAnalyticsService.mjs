/**
 * Breeding Analytics Service
 *
 * Provides breeding program analytics including lineage tracking,
 * trait inheritance patterns, breeding success rates, and foal development
 * for individual users' breeding programs.
 */

import prisma from '../db/index.mjs';

/**
 * Breeding Analytics Service
 * Handles breeding program analysis and statistics
 */
export const breedingAnalyticsService = {
  /**
   * Get comprehensive breeding analytics for a user
   * @param {number} userId - User ID to analyze
   * @returns {Object} Complete breeding analytics
   */
  async getBreedingAnalytics(userId) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get all horses owned by the user
    const userHorses = await prisma.horse.findMany({
      where: { userId },
      include: {
        sire: true,
        dam: true,
      },
    });

    // If no horses, return empty analytics
    if (userHorses.length === 0) {
      return this.getEmptyAnalytics();
    }

    // Separate foals (horses with parents) from breeding stock
    const foals = userHorses.filter(horse => horse.sireId && horse.damId);
    const _breedingStock = userHorses.filter(horse => !horse.sireId && !horse.damId);

    // Calculate analytics
    const breedingPairs = this.identifyBreedingPairs(foals);
    const traitInheritance = this.analyzeTraitInheritance(foals);
    const successMetrics = this.calculateSuccessMetrics(breedingPairs, foals);
    const foalDevelopment = this.analyzeFoalDevelopment(foals);
    const parentComparison = this.compareToParents(foals);

    return {
      breedingPairs,
      traitInheritance,
      successMetrics,
      foalDevelopment,
      parentComparison,
    };
  },

  /**
   * Return empty analytics structure
   * @returns {Object} Empty analytics
   */
  getEmptyAnalytics() {
    return {
      breedingPairs: [],
      traitInheritance: {
        positiveTraits: {},
        negativeTraits: {},
        inheritanceRates: {},
      },
      successMetrics: {
        totalBreedings: 0,
        successfulBreedings: 0,
        successRate: 0,
        averageFoalsPerBreeding: 0,
      },
      foalDevelopment: {
        totalFoals: 0,
        averageStats: {},
      },
      parentComparison: {
        parentAverages: {},
        offspringAverages: {},
        improvement: {},
      },
    };
  },

  /**
   * Identify breeding pairs and their offspring
   * @param {Array} foals - Foals with parent information
   * @returns {Array} Breeding pairs with their foals
   */
  identifyBreedingPairs(foals) {
    const pairMap = new Map();

    foals.forEach(foal => {
      const pairKey = `${foal.sireId}-${foal.damId}`;

      if (!pairMap.has(pairKey)) {
        pairMap.set(pairKey, {
          stallion: foal.sire,
          mare: foal.dam,
          foals: [],
          foalCount: 0,
        });
      }

      const pair = pairMap.get(pairKey);
      pair.foals.push(foal);
      pair.foalCount++;
    });

    return Array.from(pairMap.values());
  },

  /**
   * Analyze trait inheritance patterns
   * @param {Array} foals - Foals with trait information
   * @returns {Object} Trait inheritance analysis
   */
  analyzeTraitInheritance(foals) {
    const positiveTraits = {};
    const negativeTraits = {};
    const inheritanceRates = {};

    foals.forEach(foal => {
      const modifiers = foal.epigeneticModifiers || { positive: [], negative: [] };

      // Count positive traits
      (modifiers.positive || []).forEach(trait => {
        if (!positiveTraits[trait]) { positiveTraits[trait] = 0; }
        positiveTraits[trait]++;
      });

      // Count negative traits
      (modifiers.negative || []).forEach(trait => {
        if (!negativeTraits[trait]) { negativeTraits[trait] = 0; }
        negativeTraits[trait]++;
      });
    });

    // Calculate inheritance rates as percentages
    const totalFoals = foals.length;
    if (totalFoals > 0) {
      Object.keys(positiveTraits).forEach(trait => {
        inheritanceRates[trait] = Math.round((positiveTraits[trait] / totalFoals) * 100);
      });
      Object.keys(negativeTraits).forEach(trait => {
        inheritanceRates[trait] = Math.round((negativeTraits[trait] / totalFoals) * 100);
      });
    }

    return {
      positiveTraits,
      negativeTraits,
      inheritanceRates,
    };
  },

  /**
   * Calculate breeding success metrics
   * @param {Array} breedingPairs - Identified breeding pairs
   * @param {Array} foals - All foals
   * @returns {Object} Success metrics
   */
  calculateSuccessMetrics(breedingPairs, foals) {
    const totalBreedings = breedingPairs.length;
    const successfulBreedings = breedingPairs.filter(pair => pair.foalCount > 0).length;
    const successRate = totalBreedings > 0 ? Math.round((successfulBreedings / totalBreedings) * 100) : 0;
    const averageFoalsPerBreeding = totalBreedings > 0 ? Math.round((foals.length / totalBreedings) * 10) / 10 : 0;

    return {
      totalBreedings,
      successfulBreedings,
      successRate,
      averageFoalsPerBreeding,
    };
  },

  /**
   * Analyze foal development outcomes
   * @param {Array} foals - All foals
   * @returns {Object} Foal development analysis
   */
  analyzeFoalDevelopment(foals) {
    const totalFoals = foals.length;

    if (totalFoals === 0) {
      return {
        totalFoals: 0,
        averageStats: {},
      };
    }

    // Calculate average stats
    const statTotals = {
      speed: 0,
      stamina: 0,
      agility: 0,
      balance: 0,
      precision: 0,
      intelligence: 0,
      boldness: 0,
      flexibility: 0,
      obedience: 0,
      focus: 0,
    };

    foals.forEach(foal => {
      Object.keys(statTotals).forEach(stat => {
        statTotals[stat] += foal[stat] || 0;
      });
    });

    const averageStats = {};
    Object.keys(statTotals).forEach(stat => {
      averageStats[stat] = Math.round((statTotals[stat] / totalFoals) * 10) / 10;
    });

    return {
      totalFoals,
      averageStats,
    };
  },

  /**
   * Compare offspring stats to parent averages
   * @param {Array} foals - Foals with parent information
   * @returns {Object} Parent comparison analysis
   */
  compareToParents(foals) {
    if (foals.length === 0) {
      return {
        parentAverages: {},
        offspringAverages: {},
        improvement: {},
      };
    }

    // Get unique parents
    const parents = new Map();
    foals.forEach(foal => {
      if (foal.sire) { parents.set(foal.sire.id, foal.sire); }
      if (foal.dam) { parents.set(foal.dam.id, foal.dam); }
    });

    const parentArray = Array.from(parents.values());

    // Calculate parent averages
    const parentAverages = this.calculateStatAverages(parentArray);
    const offspringAverages = this.calculateStatAverages(foals);

    // Calculate improvement (positive = better offspring, negative = worse)
    const improvement = {};
    Object.keys(parentAverages).forEach(stat => {
      improvement[stat] = Math.round((offspringAverages[stat] - parentAverages[stat]) * 10) / 10;
    });

    return {
      parentAverages,
      offspringAverages,
      improvement,
    };
  },

  /**
   * Calculate average stats for a group of horses
   * @param {Array} horses - Horses to calculate averages for
   * @returns {Object} Average stats
   */
  calculateStatAverages(horses) {
    if (horses.length === 0) { return {}; }

    const statTotals = {
      speed: 0,
      stamina: 0,
      agility: 0,
      balance: 0,
      precision: 0,
      intelligence: 0,
      boldness: 0,
      flexibility: 0,
      obedience: 0,
      focus: 0,
    };

    horses.forEach(horse => {
      Object.keys(statTotals).forEach(stat => {
        statTotals[stat] += horse[stat] || 0;
      });
    });

    const averages = {};
    Object.keys(statTotals).forEach(stat => {
      averages[stat] = Math.round((statTotals[stat] / horses.length) * 10) / 10;
    });

    return averages;
  },
};
