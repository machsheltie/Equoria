/**
 * Facility Management Service
 *
 * Provides stable environment optimization with facility upgrades, environmental mitigation,
 * and effectiveness tracking for horse management and environmental impact reduction.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Get available facility types with specifications
 * @returns {Array} Available facility types
 */
export function getFacilityTypes() {
  return [
    {
      id: 'basic_stable',
      name: 'Basic Stable',
      description: 'Entry-level facility with essential upgrades for horse care and training',
      baseCost: 2500,
      maxLevel: 5,
      baseEffectiveness: 60,
      availableUpgrades: ['advanced_training', 'automated_care', 'medical_center', 'stable_management'],
      maintenanceMultiplier: 1.0,
      capacity: 10, // Max horses
      specialization: 'general',
    },
    {
      id: 'training_center',
      name: 'Advanced Training Center',
      description: 'Specialized facility focused on training excellence and horse development',
      baseCost: 8500,
      maxLevel: 8,
      baseEffectiveness: 80,
      availableUpgrades: ['advanced_training', 'recovery_center', 'specialized_grounds', 'feed_laboratory', 'tack_workshop', 'stable_management'],
      maintenanceMultiplier: 1.4,
      capacity: 20,
      specialization: 'training',
    },
    {
      id: 'breeding_complex',
      name: 'Elite Breeding Complex',
      description: 'Premier facility with cutting-edge breeding research and genetic capabilities',
      baseCost: 18000,
      maxLevel: 10,
      baseEffectiveness: 95,
      availableUpgrades: ['breeding_optimization', 'genetic_analysis', 'foal_development', 'feed_laboratory', 'medical_center', 'visitor_center'],
      maintenanceMultiplier: 2.0,
      capacity: 35,
      specialization: 'breeding',
    },
    {
      id: 'competition_complex',
      name: 'Elite Competition Complex',
      description: 'Ultimate facility with competition hosting and prestige capabilities',
      baseCost: 25000,
      maxLevel: 12,
      baseEffectiveness: 100,
      availableUpgrades: ['competition_hosting', 'prestige_stable', 'tack_workshop', 'specialized_grounds', 'recovery_center', 'visitor_center', 'stable_management'],
      maintenanceMultiplier: 2.5,
      capacity: 40,
      specialization: 'competition',
    },
    {
      id: 'master_facility',
      name: 'Master Equestrian Facility',
      description: 'The ultimate facility with access to all upgrade types and maximum capacity',
      baseCost: 45000,
      maxLevel: 15,
      baseEffectiveness: 100,
      availableUpgrades: ['advanced_training', 'recovery_center', 'specialized_grounds', 'automated_care', 'medical_center', 'feed_laboratory', 'breeding_optimization', 'genetic_analysis', 'foal_development', 'stable_management', 'competition_hosting', 'prestige_stable', 'tack_workshop', 'visitor_center'],
      maintenanceMultiplier: 3.0,
      capacity: 75,
      specialization: 'master',
    },
  ];
}

/**
 * Get user facilities with current status
 * @param {number} userId - User ID
 * @returns {Array} User facilities with environmental mitigation data
 */
export async function getUserFacilities(userId) {
  try {
    logger.info(`[facilityManagementService.getUserFacilities] Getting facilities for user ${userId}`);

    const facilities = await prisma.facility.findMany({
      where: { userId },
      include: {
        upgrades_history: {
          orderBy: { purchaseDate: 'desc' },
        },
      },
    });

    // Calculate environmental mitigation for each facility
    const facilitiesWithMitigation = facilities.map(facility => {
      const environmentalMitigation = calculateEnvironmentalMitigation(facility, {
        temperature: 25, // Standard conditions for baseline
        humidity: 60,
        windSpeed: 10,
        conditions: 'cloudy',
      });

      return {
        ...facility,
        environmentalMitigation,
      };
    });

    return facilitiesWithMitigation;

  } catch (error) {
    logger.error(`[facilityManagementService.getUserFacilities] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate upgrade cost for facility improvements
 * @param {number} facilityId - Facility ID
 * @param {string} upgradeType - Type of upgrade
 * @param {number} currentLevel - Current upgrade level
 * @param {number} targetLevel - Target upgrade level
 * @returns {Object} Upgrade cost breakdown
 */
export function calculateUpgradeCost(facilityId, upgradeType, currentLevel, targetLevel) {
  try {
    logger.info(`[facilityManagementService.calculateUpgradeCost] Calculating cost for ${upgradeType} upgrade from ${currentLevel} to ${targetLevel}`);

    if (targetLevel <= currentLevel) {
      throw new Error('Target level must be higher than current level');
    }

    const upgradeSpecs = getUpgradeSpecifications();
    if (!upgradeSpecs[upgradeType]) {
      throw new Error(`Invalid upgrade type: ${upgradeType}`);
    }

    const spec = upgradeSpecs[upgradeType];
    let totalCost = 0;
    const breakdown = [];
    let totalTime = 0;

    for (let level = currentLevel + 1; level <= targetLevel; level++) {
      const levelCost = spec.baseCost * Math.pow(spec.costMultiplier, level - 1);
      const levelTime = spec.baseTime * level;
      const materials = calculateMaterialsForLevel(upgradeType, level);

      breakdown.push({
        level,
        cost: Math.round(levelCost),
        time: levelTime,
        materials,
      });

      totalCost += levelCost;
      totalTime += levelTime;
    }

    // Check prerequisites
    const prerequisites = checkUpgradePrerequisites(upgradeType, targetLevel);

    return {
      totalCost: Math.round(totalCost),
      breakdown,
      timeRequired: totalTime,
      prerequisites,
    };

  } catch (error) {
    logger.error(`[facilityManagementService.calculateUpgradeCost] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Purchase facility upgrade
 * @param {number} userId - User ID
 * @param {number} facilityId - Facility ID
 * @param {string} upgradeType - Type of upgrade
 * @param {number} targetLevel - Target upgrade level
 * @returns {Object} Purchase result
 */
export async function purchaseFacilityUpgrade(userId, facilityId, upgradeType, targetLevel) {
  try {
    logger.info(`[facilityManagementService.purchaseFacilityUpgrade] User ${userId} purchasing ${upgradeType} upgrade to level ${targetLevel}`);

    // Verify facility ownership
    const facility = await prisma.facility.findFirst({
      where: {
        id: facilityId,
        userId,
      },
    });

    if (!facility) {
      return {
        success: false,
        error: 'Facility not found or access denied',
      };
    }

    // Get current upgrade level
    const currentLevel = facility.upgrades[upgradeType] || 0;

    // Calculate cost
    const costCalculation = calculateUpgradeCost(facilityId, upgradeType, currentLevel, targetLevel);

    // Check user funds
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true },
    });

    if (user.money < costCalculation.totalCost) {
      return {
        success: false,
        error: 'insufficient funds for this upgrade',
      };
    }

    // Process purchase in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Deduct money
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { money: { decrement: costCalculation.totalCost } },
      });

      // Update facility upgrades
      const newUpgrades = { ...facility.upgrades };
      newUpgrades[upgradeType] = targetLevel;

      const updatedFacility = await tx.facility.update({
        where: { id: facilityId },
        data: {
          upgrades: newUpgrades,
          effectiveness: calculateFacilityEffectiveness(newUpgrades),
        },
      });

      // Record upgrade history
      const upgrade = await tx.facilityUpgrade.create({
        data: {
          facilityId,
          upgradeType,
          previousLevel: currentLevel,
          newLevel: targetLevel,
          cost: costCalculation.totalCost,
          purchaseDate: new Date(),
          effectiveness: calculateUpgradeEffectiveness(upgradeType, targetLevel),
        },
      });

      return {
        upgrade,
        updatedFacility,
        remainingMoney: updatedUser.money,
      };
    });

    return {
      success: true,
      upgrade: result.upgrade,
      newFacilityStatus: result.updatedFacility,
      costPaid: costCalculation.totalCost,
      remainingMoney: result.remainingMoney,
    };

  } catch (error) {
    logger.error(`[facilityManagementService.purchaseFacilityUpgrade] Error: ${error.message}`);
    return {
      success: false,
      error: 'Failed to process upgrade purchase',
    };
  }
}

/**
 * Calculate environmental mitigation effects
 * @param {Object} facility - Facility data
 * @param {Object} environmentalConditions - Current environmental conditions
 * @returns {Object} Mitigation effects
 */
export function calculateEnvironmentalMitigation(facility, environmentalConditions) {
  try {
    const upgrades = facility.upgrades || {};

    // Calculate mitigation for each environmental factor
    const temperatureMitigation = calculateTemperatureMitigation(upgrades, environmentalConditions.temperature);
    const humidityMitigation = calculateHumidityMitigation(upgrades, environmentalConditions.humidity);
    const windMitigation = calculateWindMitigation(upgrades, environmentalConditions.windSpeed);
    const stormMitigation = calculateStormMitigation(upgrades, environmentalConditions.conditions);

    // Calculate overall mitigation effectiveness
    const overall = Math.round((temperatureMitigation + humidityMitigation + windMitigation + stormMitigation) / 4);

    // Calculate facility effectiveness based on upgrades
    const effectiveness = calculateFacilityEffectiveness(upgrades);

    return {
      overall: Math.min(100, overall),
      temperatureMitigation: Math.round(temperatureMitigation),
      humidityMitigation: Math.round(humidityMitigation),
      windMitigation: Math.round(windMitigation),
      stormMitigation: Math.round(stormMitigation),
      effectiveness: Math.round(effectiveness),
    };

  } catch (error) {
    logger.error(`[facilityManagementService.calculateEnvironmentalMitigation] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Assess facility effectiveness comprehensively
 * @param {number} facilityId - Facility ID
 * @returns {Object} Effectiveness assessment
 */
export async function assessFacilityEffectiveness(facilityId) {
  try {
    logger.info(`[facilityManagementService.assessFacilityEffectiveness] Assessing facility ${facilityId}`);

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        upgrades_history: true,
      },
    });

    if (!facility) {
      throw new Error('Facility not found');
    }

    const upgrades = facility.upgrades || {};

    // Calculate overall effectiveness
    const overallEffectiveness = calculateFacilityEffectiveness(upgrades);

    // Calculate upgrade-specific effectiveness
    const upgradeEffectiveness = {};
    Object.keys(upgrades).forEach(upgradeType => {
      upgradeEffectiveness[upgradeType] = calculateUpgradeEffectiveness(upgradeType, upgrades[upgradeType]);
    });

    // Assess maintenance status
    const maintenanceStatus = assessMaintenanceStatus(facility);

    // Calculate environmental performance
    const environmentalPerformance = calculateEnvironmentalPerformance(upgrades);

    // Calculate cost efficiency
    const costEfficiency = calculateCostEfficiency(facility);

    // Generate recommendations
    const recommendations = generateEffectivenessRecommendations(facility, upgradeEffectiveness);

    return {
      overallEffectiveness: Math.round(overallEffectiveness),
      upgradeEffectiveness,
      maintenanceStatus,
      environmentalPerformance: Math.round(environmentalPerformance),
      costEfficiency: Math.round(costEfficiency),
      recommendations,
    };

  } catch (error) {
    logger.error(`[facilityManagementService.assessFacilityEffectiveness] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate facility recommendations for a user
 * @param {number} userId - User ID
 * @returns {Object} Categorized recommendations
 */
export async function generateFacilityRecommendations(userId) {
  try {
    logger.info(`[facilityManagementService.generateFacilityRecommendations] Generating recommendations for user ${userId}`);

    const facilities = await getUserFacilities(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true },
    });

    const recommendations = {
      priority: [],
      costEffective: [],
      environmental: [],
      maintenance: [],
    };

    for (const facility of facilities) {
      const facilityRecs = await generateFacilitySpecificRecommendations(facility, user.money);

      recommendations.priority.push(...facilityRecs.priority);
      recommendations.costEffective.push(...facilityRecs.costEffective);
      recommendations.environmental.push(...facilityRecs.environmental);
      recommendations.maintenance.push(...facilityRecs.maintenance);
    }

    // Sort recommendations by priority and cost-benefit
    recommendations.priority.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    recommendations.costEffective.sort((a, b) => b.benefit - a.benefit);

    return recommendations;

  } catch (error) {
    logger.error(`[facilityManagementService.generateFacilityRecommendations] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate maintenance costs for a facility
 * @param {number} facilityId - Facility ID
 * @returns {Object} Maintenance cost breakdown
 */
export async function calculateMaintenanceCosts(facilityId) {
  try {
    logger.info(`[facilityManagementService.calculateMaintenanceCosts] Calculating maintenance for facility ${facilityId}`);

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
    });

    if (!facility) {
      throw new Error('Facility not found');
    }

    const upgrades = facility.upgrades || {};
    const facilityTypes = getFacilityTypes();
    const facilityType = facilityTypes.find(t => t.id === facility.type);

    let monthlyCost = facility.maintenanceCost || 100;
    const breakdown = [];

    // Base maintenance
    breakdown.push({
      category: 'Base Facility',
      cost: Math.round(monthlyCost * 0.4),
      frequency: 'monthly',
    });

    // Upgrade maintenance costs
    Object.entries(upgrades).forEach(([upgradeType, level]) => {
      const upgradeCost = calculateUpgradeMaintenanceCost(upgradeType, level);
      monthlyCost += upgradeCost;

      breakdown.push({
        category: `${upgradeType.charAt(0).toUpperCase() + upgradeType.slice(1)} System`,
        cost: upgradeCost,
        frequency: 'monthly',
      });
    });

    // Apply facility type multiplier
    if (facilityType) {
      monthlyCost *= facilityType.maintenanceMultiplier;
    }

    // Calculate next maintenance date
    const nextMaintenance = new Date();
    nextMaintenance.setMonth(nextMaintenance.getMonth() + 1);

    return {
      monthly: Math.round(monthlyCost),
      annual: Math.round(monthlyCost * 12),
      breakdown,
      nextMaintenance: nextMaintenance.toISOString(),
    };

  } catch (error) {
    logger.error(`[facilityManagementService.calculateMaintenanceCosts] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Get facility upgrade history
 * @param {number} facilityId - Facility ID
 * @returns {Array} Upgrade history
 */
export async function getFacilityUpgradeHistory(facilityId) {
  try {
    logger.info(`[facilityManagementService.getFacilityUpgradeHistory] Getting history for facility ${facilityId}`);

    const history = await prisma.facilityUpgrade.findMany({
      where: { facilityId },
      orderBy: { purchaseDate: 'desc' },
    });

    return history;

  } catch (error) {
    logger.error(`[facilityManagementService.getFacilityUpgradeHistory] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate facility return on investment
 * @param {number} facilityId - Facility ID
 * @returns {Object} ROI analysis
 */
export async function calculateFacilityROI(facilityId) {
  try {
    logger.info(`[facilityManagementService.calculateFacilityROI] Calculating ROI for facility ${facilityId}`);

    const facility = await prisma.facility.findUnique({
      where: { id: facilityId },
      include: {
        upgrades_history: true,
      },
    });

    if (!facility) {
      throw new Error('Facility not found');
    }

    // Calculate total investment
    const facilityTypes = getFacilityTypes();
    const facilityType = facilityTypes.find(t => t.id === facility.type);
    let totalInvestment = facilityType ? facilityType.baseCost : 5000;

    // Add upgrade costs
    const upgradeHistory = await getFacilityUpgradeHistory(facilityId);
    const upgradeCosts = upgradeHistory.reduce((sum, upgrade) => sum + upgrade.cost, 0);
    totalInvestment += upgradeCosts;

    // Calculate monthly benefits
    const benefitBreakdown = calculateFacilityBenefits(facility);
    const monthlyBenefit = Object.values(benefitBreakdown).reduce((sum, benefit) => sum + benefit, 0);

    // Calculate ROI metrics
    const roundedMonthlyBenefit = Math.round(monthlyBenefit);
    const annualBenefit = roundedMonthlyBenefit * 12;
    const paybackPeriod = totalInvestment / monthlyBenefit; // months
    const roiPercentage = ((annualBenefit - (totalInvestment / 5)) / totalInvestment) * 100; // 5-year ROI

    return {
      totalInvestment: Math.round(totalInvestment),
      monthlyBenefit: roundedMonthlyBenefit,
      annualBenefit,
      paybackPeriod: Math.round(paybackPeriod * 10) / 10,
      roiPercentage: Math.round(roiPercentage * 10) / 10,
      benefitBreakdown: {
        environmentalMitigation: Math.round(benefitBreakdown.environmentalMitigation),
        horseHealthImprovement: Math.round(benefitBreakdown.horseHealthImprovement),
        trainingEfficiency: Math.round(benefitBreakdown.trainingEfficiency),
        maintenanceReduction: Math.round(benefitBreakdown.maintenanceReduction),
      },
    };

  } catch (error) {
    logger.error(`[facilityManagementService.calculateFacilityROI] Error: ${error.message}`);
    throw error;
  }
}

// ===== HELPER FUNCTIONS =====

/**
 * Get upgrade specifications with meaningful gameplay benefits
 * @returns {Object} Upgrade specifications
 */
function getUpgradeSpecifications() {
  return {
    advanced_training: {
      name: 'Advanced Training Equipment',
      baseCost: 3000,
      costMultiplier: 1.6,
      baseTime: 48,
      maxLevel: 5,
      effectiveness: 1.0,
      benefits: {
        trainingEffectiveness: 0.20, // +20% per level
        specializedMethods: true, // Unlock specialized training
        description: 'Improves training effectiveness and unlocks specialized training methods',
      },
    },
    recovery_center: {
      name: 'Recovery Center',
      baseCost: 4500,
      costMultiplier: 1.7,
      baseTime: 60,
      maxLevel: 4,
      effectiveness: 1.1,
      benefits: {
        stressRecovery: 0.50, // +50% faster stress recovery per level
        trainingFrequency: 0.25, // +25% more frequent training per level
        description: 'Accelerates horse recovery and enables more frequent training',
      },
    },
    specialized_grounds: {
      name: 'Specialized Training Grounds',
      baseCost: 8000,
      costMultiplier: 1.8,
      baseTime: 96,
      maxLevel: 3,
      effectiveness: 1.3,
      benefits: {
        disciplineBonus: 0.15, // +15% bonus for chosen disciplines per level
        unlockSpecialized: true, // Unlock discipline-specific training
        description: 'Provides discipline-specific training bonuses for chosen specializations',
      },
    },
    automated_care: {
      name: 'Automated Care Systems',
      baseCost: 2500,
      costMultiplier: 1.5,
      baseTime: 36,
      maxLevel: 4,
      effectiveness: 0.9,
      benefits: {
        careCostReduction: 0.40, // -40% daily care costs per level
        groomCostReduction: 0.30, // -30% groom labor costs per level
        description: 'Reduces daily care and groom labor costs through automation',
      },
    },
    medical_center: {
      name: 'Medical Center',
      baseCost: 3500,
      costMultiplier: 1.6,
      baseTime: 48,
      maxLevel: 4,
      effectiveness: 1.0,
      benefits: {
        vetCostReduction: 0.60, // -60% veterinary costs per level
        injuryRecovery: 0.50, // +50% faster injury recovery per level
        preventiveCare: 0.25, // +25% injury prevention per level
        description: 'Reduces veterinary costs, speeds recovery, and provides preventive care',
      },
    },
    feed_laboratory: {
      name: 'Specialized Feed Laboratory',
      baseCost: 4200,
      costMultiplier: 1.6,
      baseTime: 60,
      maxLevel: 4,
      effectiveness: 1.1,
      benefits: {
        specializedFeeds: true, // Unlock specialized feed creation
        statBoostChance: 0.05, // 5% chance per level for stat increases from feeds
        feedEffectiveness: 0.25, // +25% feed effectiveness per level
        description: 'Create specialized feeds with stat-boosting properties and enhanced effectiveness',
      },
    },
    breeding_optimization: {
      name: 'Breeding Optimization Lab',
      baseCost: 6000,
      costMultiplier: 2.0,
      baseTime: 96,
      maxLevel: 3,
      effectiveness: 1.3,
      benefits: {
        positiveTraitChance: 0.30, // +30% chance for positive trait expression per level
        traitOptimization: true, // Optimize breeding for desired traits
        description: 'Increases positive trait expression and optimizes breeding outcomes (breeding always succeeds when horses are healthy)',
      },
    },
    genetic_analysis: {
      name: 'Genetic Analysis Center',
      baseCost: 12000,
      costMultiplier: 2.2,
      baseTime: 120,
      maxLevel: 2,
      effectiveness: 1.4,
      benefits: {
        geneticInsight: true, // See detailed genetic potential before breeding
        breedingOptimization: true, // Optimize pairings for best outcomes
        hiddenTraitDetection: 0.50, // +50% chance to detect hidden traits per level
        description: 'Provides detailed genetic analysis and breeding optimization',
      },
    },
    foal_development: {
      name: 'Foal Development Center',
      baseCost: 5000,
      costMultiplier: 1.8,
      baseTime: 72,
      maxLevel: 3,
      effectiveness: 1.2,
      benefits: {
        foalDevelopmentBonus: 0.25, // +25% foal development bonuses per level
        earlyCareBonus: 0.30, // +30% early care effectiveness per level
        description: 'Enhances foal development and early care outcomes',
      },
    },
    stable_management: {
      name: 'Stable Management System',
      baseCost: 3000,
      costMultiplier: 1.6,
      baseTime: 48,
      maxLevel: 4,
      effectiveness: 1.0,
      benefits: {
        batchOperations: true, // Enable batch operations
        autoScheduling: true, // Automatic scheduling features
        micromanagementReduction: 0.40, // -40% time spent on routine tasks per level
        description: 'Reduces micromanagement through batch operations and auto-scheduling',
      },
    },
    competition_hosting: {
      name: 'Competition Hosting Facility',
      baseCost: 15000,
      costMultiplier: 2.0,
      baseTime: 168,
      maxLevel: 3,
      effectiveness: 1.5,
      benefits: {
        hostingRevenue: 3000, // Base hosting revenue per event per level
        attractBetterHorses: true, // Attract higher quality horses for sale
        prestigeBonus: 0.20, // +20% prestige gain per level
        description: 'Enables hosting competitions, earning fees, and attracting quality horses',
      },
    },
    prestige_stable: {
      name: 'Prestige Stable',
      baseCost: 10000,
      costMultiplier: 1.9,
      baseTime: 96,
      maxLevel: 3,
      effectiveness: 1.3,
      benefits: {
        prizeMoney: 0.20, // +20% prize money from competitions per level
        sponsorshipDeals: true, // Attract sponsorship opportunities
        reputationBonus: 0.25, // +25% reputation gain per level
        description: 'Increases prize money and attracts lucrative sponsorship deals',
      },
    },
    tack_workshop: {
      name: 'Tack & Equipment Workshop',
      baseCost: 4000,
      costMultiplier: 1.7,
      baseTime: 60,
      maxLevel: 4,
      effectiveness: 1.1,
      benefits: {
        customTack: true, // Craft custom tack with stat bonuses
        equipmentCostReduction: 0.35, // -35% equipment costs per level
        tackBonuses: 0.10, // +10% tack effectiveness per level
        description: 'Craft custom tack with bonuses and reduce equipment costs',
      },
    },

    visitor_center: {
      name: 'Visitor Center',
      baseCost: 6000,
      costMultiplier: 1.8,
      baseTime: 72,
      maxLevel: 3,
      effectiveness: 1.2,
      benefits: {
        passiveIncome: 500, // $500 passive income per month per level
        reputationGain: 0.30, // +30% reputation gain per level
        tourRevenue: 200, // Additional $200 per tour per level
        description: 'Generates passive income from tours and increases stable reputation',
      },
    },
  };
}

/**
 * Calculate materials needed for upgrade level
 * @param {string} upgradeType - Upgrade type
 * @param {number} level - Upgrade level
 * @returns {Array} Required materials
 */
function calculateMaterialsForLevel(upgradeType, level) {
  const baseMaterials = {
    training_efficiency: ['training_equipment', 'monitoring_systems', 'safety_gear'],
    performance_analytics: ['computers', 'sensors', 'analysis_software'],
    recovery_systems: ['medical_equipment', 'therapy_devices', 'monitoring_systems'],
    automated_care: ['automation_hardware', 'feeding_systems', 'cleaning_equipment'],
    medical_facility: ['medical_equipment', 'diagnostic_tools', 'pharmaceuticals'],
    breeding_research: ['laboratory_equipment', 'genetic_testing_kits', 'research_software'],
    genetic_laboratory: ['advanced_lab_equipment', 'genetic_sequencers', 'specialized_software'],
    ai_optimization: ['ai_hardware', 'machine_learning_software', 'data_storage'],
    environmental_control: ['climate_systems', 'environmental_sensors', 'control_software'],
    competition_hosting: ['event_infrastructure', 'timing_systems', 'spectator_facilities'],
  };

  const materials = baseMaterials[upgradeType] || ['basic_materials'];
  const costMultiplier = {
    training_efficiency: 100,
    performance_analytics: 250,
    recovery_systems: 200,
    automated_care: 150,
    medical_facility: 180,
    breeding_research: 300,
    genetic_laboratory: 500,
    ai_optimization: 400,
    environmental_control: 175,
    competition_hosting: 800,
  };

  return materials.map(material => ({
    type: material,
    quantity: level * 2,
    cost: level * (costMultiplier[upgradeType] || 100),
  }));
}

/**
 * Check upgrade prerequisites
 * @param {string} upgradeType - Upgrade type
 * @param {number} targetLevel - Target level
 * @returns {Array} Prerequisites
 */
function checkUpgradePrerequisites(upgradeType, targetLevel) {
  const prerequisites = [];

  // Performance Analytics requires basic training infrastructure
  if (upgradeType === 'performance_analytics' && targetLevel > 1) {
    prerequisites.push('Training Efficiency Center level 2 or higher required');
  }

  // AI Optimization requires performance analytics foundation
  if (upgradeType === 'ai_optimization') {
    prerequisites.push('Performance Analytics Lab level 2 required');
    prerequisites.push('Training Efficiency Center level 3 required');
  }

  // Genetic Laboratory requires breeding research foundation
  if (upgradeType === 'genetic_laboratory') {
    prerequisites.push('Breeding Research Center level 2 required');
  }

  // Competition Hosting requires multiple advanced systems
  if (upgradeType === 'competition_hosting') {
    prerequisites.push('Performance Analytics Lab level 2 required');
    prerequisites.push('Medical Facility level 2 required');
    prerequisites.push('Environmental Control level 2 required');
  }

  // Advanced Recovery Systems require medical facility
  if (upgradeType === 'recovery_systems' && targetLevel > 2) {
    prerequisites.push('Medical Facility level 2 or higher required');
  }

  return prerequisites;
}

/**
 * Calculate facility effectiveness based on upgrades
 * @param {Object} upgrades - Facility upgrades
 * @returns {number} Effectiveness percentage
 */
function calculateFacilityEffectiveness(upgrades) {
  let effectiveness = 60; // Base effectiveness

  Object.entries(upgrades).forEach(([upgradeType, level]) => {
    const specs = getUpgradeSpecifications();
    if (specs[upgradeType]) {
      effectiveness += level * specs[upgradeType].effectiveness * 10;
    }
  });

  return Math.min(100, effectiveness);
}

/**
 * Calculate upgrade effectiveness
 * @param {string} upgradeType - Upgrade type
 * @param {number} level - Upgrade level
 * @returns {number} Effectiveness percentage
 */
function calculateUpgradeEffectiveness(upgradeType, level) {
  const specs = getUpgradeSpecifications();
  if (!specs[upgradeType]) { return 0; }

  return Math.min(100, level * specs[upgradeType].effectiveness * 20);
}

/**
 * Calculate temperature mitigation
 * @param {Object} upgrades - Facility upgrades
 * @param {number} temperature - Current temperature
 * @returns {number} Mitigation percentage
 */
function calculateTemperatureMitigation(upgrades, _temperature) {
  let mitigation = 20; // Base facility protection

  // Environmental Control provides comprehensive temperature management
  if (upgrades.environmental_control) {
    const specs = getUpgradeSpecifications();
    const benefit = specs.environmental_control.benefits.weatherProtection;
    mitigation += upgrades.environmental_control * benefit * 100;
  }

  // Recovery Systems help horses cope with temperature stress
  if (upgrades.recovery_systems) {
    mitigation += upgrades.recovery_systems * 10;
  }

  // Medical Facility provides emergency temperature-related care
  if (upgrades.medical_facility) {
    mitigation += upgrades.medical_facility * 8;
  }

  return Math.min(100, mitigation);
}

/**
 * Calculate humidity mitigation
 * @param {Object} upgrades - Facility upgrades
 * @param {number} humidity - Current humidity
 * @returns {number} Mitigation percentage
 */
function calculateHumidityMitigation(upgrades, _humidity) {
  let mitigation = 15; // Base facility protection

  // Environmental Control provides comprehensive humidity management
  if (upgrades.environmental_control) {
    const specs = getUpgradeSpecifications();
    const benefit = specs.environmental_control.benefits.weatherProtection;
    mitigation += upgrades.environmental_control * benefit * 80; // Slightly less effective for humidity
  }

  // Automated Care systems include humidity monitoring
  if (upgrades.automated_care) {
    mitigation += upgrades.automated_care * 12;
  }

  // Medical Facility helps with humidity-related health issues
  if (upgrades.medical_facility) {
    mitigation += upgrades.medical_facility * 8;
  }

  return Math.min(100, mitigation);
}

/**
 * Calculate wind mitigation
 * @param {Object} upgrades - Facility upgrades
 * @param {number} windSpeed - Current wind speed
 * @returns {number} Mitigation percentage
 */
function calculateWindMitigation(upgrades, _windSpeed) {
  let mitigation = 50; // Base shelter provides some wind protection

  // Environmental Control provides wind resistance
  if (upgrades.environmental_control) {
    const specs = getUpgradeSpecifications();
    const benefit = specs.environmental_control.benefits.weatherProtection;
    mitigation += upgrades.environmental_control * benefit * 60;
  }

  // Competition Hosting facilities are built to higher structural standards
  if (upgrades.competition_hosting) {
    mitigation += upgrades.competition_hosting * 15;
  }

  return Math.min(100, mitigation);
}

/**
 * Calculate storm mitigation
 * @param {Object} upgrades - Facility upgrades
 * @param {string} conditions - Weather conditions
 * @returns {number} Mitigation percentage
 */
function calculateStormMitigation(upgrades, conditions) {
  let mitigation = 40; // Base shelter

  if (conditions === 'stormy') {
    // Environmental Control provides comprehensive storm protection
    if (upgrades.environmental_control) {
      const specs = getUpgradeSpecifications();
      const benefit = specs.environmental_control.benefits.weatherProtection;
      mitigation += upgrades.environmental_control * benefit * 100;
    }

    // AI Optimization can help manage systems during storms
    if (upgrades.ai_optimization) {
      mitigation += upgrades.ai_optimization * 20;
    }

    // Medical Facility provides emergency care during storms
    if (upgrades.medical_facility) {
      mitigation += upgrades.medical_facility * 15;
    }

    // Recovery Systems help horses cope with storm stress
    if (upgrades.recovery_systems) {
      mitigation += upgrades.recovery_systems * 12;
    }
  }

  return Math.min(100, mitigation);
}

/**
 * Assess maintenance status
 * @param {Object} facility - Facility data
 * @returns {Object} Maintenance status
 */
function assessMaintenanceStatus(facility) {
  const lastMaintenance = facility.lastMaintenance || facility.createdAt;
  const daysSinceMaintenance = Math.floor((new Date() - new Date(lastMaintenance)) / (1000 * 60 * 60 * 24));

  let status = 'good';
  let urgency = 'low';

  if (daysSinceMaintenance > 90) {
    status = 'overdue';
    urgency = 'high';
  } else if (daysSinceMaintenance > 60) {
    status = 'due_soon';
    urgency = 'medium';
  } else if (daysSinceMaintenance > 30) {
    status = 'scheduled';
    urgency = 'low';
  }

  return {
    status,
    urgency,
    daysSinceMaintenance,
    nextMaintenanceRecommended: daysSinceMaintenance > 30,
  };
}

/**
 * Calculate environmental performance
 * @param {Object} upgrades - Facility upgrades
 * @returns {number} Environmental performance score
 */
function calculateEnvironmentalPerformance(upgrades) {
  let score = 50; // Base score

  // Each upgrade contributes to environmental performance
  Object.entries(upgrades).forEach(([upgradeType, level]) => {
    const contribution = {
      ventilation: 8,
      heating: 6,
      cooling: 7,
      lighting: 4,
      security: 3,
      automation: 9,
      climate_control: 12,
      air_filtration: 10,
    };

    score += (contribution[upgradeType] || 5) * level;
  });

  return Math.min(100, score);
}

/**
 * Calculate cost efficiency
 * @param {Object} facility - Facility data
 * @returns {number} Cost efficiency score
 */
function calculateCostEfficiency(facility) {
  const effectiveness = facility.effectiveness || 60;
  const maintenanceCost = facility.maintenanceCost || 100;

  // Higher effectiveness with lower maintenance cost = better efficiency
  const efficiency = (effectiveness / (maintenanceCost / 100)) * 10;

  return Math.min(100, efficiency);
}

/**
 * Generate effectiveness recommendations
 * @param {Object} facility - Facility data
 * @param {Object} upgradeEffectiveness - Upgrade effectiveness ratings
 * @returns {Array} Recommendations
 */
function generateEffectivenessRecommendations(facility, upgradeEffectiveness) {
  const recommendations = [];
  const upgrades = facility.upgrades || {};

  // Check for low-performing upgrades
  Object.entries(upgradeEffectiveness).forEach(([upgradeType, effectiveness]) => {
    if (effectiveness < 60) {
      recommendations.push({
        type: 'upgrade_improvement',
        upgradeType,
        currentEffectiveness: effectiveness,
        recommendation: `Consider upgrading ${upgradeType} system for better performance`,
        priority: effectiveness < 40 ? 'high' : 'medium',
      });
    }
  });

  // Check for missing critical upgrades
  if (!upgrades.ventilation || upgrades.ventilation < 2) {
    recommendations.push({
      type: 'missing_upgrade',
      upgradeType: 'ventilation',
      recommendation: 'Improve ventilation for better air quality and humidity control',
      priority: 'high',
    });
  }

  if (facility.effectiveness < 70) {
    recommendations.push({
      type: 'overall_improvement',
      recommendation: 'Overall facility effectiveness is below optimal - consider comprehensive upgrades',
      priority: 'medium',
    });
  }

  return recommendations;
}

/**
 * Calculate upgrade maintenance cost for new upgrade types
 * @param {string} upgradeType - Upgrade type
 * @param {number} level - Upgrade level
 * @returns {number} Monthly maintenance cost
 */
function calculateUpgradeMaintenanceCost(upgradeType, level) {
  const baseCosts = {
    training_efficiency: 50,      // Training equipment maintenance
    performance_analytics: 120,   // High-tech equipment maintenance
    recovery_systems: 80,         // Medical equipment maintenance
    automated_care: 90,           // Automation system maintenance
    medical_facility: 100,        // Medical facility maintenance
    breeding_research: 150,       // Research equipment maintenance
    genetic_laboratory: 300,      // Advanced lab equipment maintenance
    ai_optimization: 200,         // AI system maintenance
    environmental_control: 70,    // Environmental system maintenance
    competition_hosting: 250,      // Event facility maintenance
  };

  const baseCost = baseCosts[upgradeType] || 50;
  return Math.round(baseCost * level * 1.2);
}

/**
 * Generate facility-specific recommendations
 * @param {Object} facility - Facility data
 * @param {number} userMoney - User's available money
 * @returns {Object} Categorized recommendations
 */
async function generateFacilitySpecificRecommendations(facility, userMoney) {
  const recommendations = {
    priority: [],
    costEffective: [],
    environmental: [],
    maintenance: [],
  };

  const upgrades = facility.upgrades || {};
  const upgradeSpecs = getUpgradeSpecifications();

  // Analyze each possible upgrade
  Object.entries(upgradeSpecs).forEach(([upgradeType, spec]) => {
    const currentLevel = upgrades[upgradeType] || 0;

    if (currentLevel < spec.maxLevel) {
      const targetLevel = currentLevel + 1;
      const cost = calculateUpgradeCost(facility.id, upgradeType, currentLevel, targetLevel);

      if (cost.totalCost <= userMoney) {
        const benefit = calculateUpgradeBenefit(upgradeType, targetLevel);
        const priority = determineUpgradePriority(upgradeType, currentLevel, facility);

        const recommendation = {
          facilityId: facility.id,
          upgradeType,
          currentLevel,
          recommendedLevel: targetLevel,
          cost: cost.totalCost,
          benefit,
          priority,
          reasoning: generateUpgradeReasoning(upgradeType, currentLevel, facility),
        };

        recommendations.priority.push(recommendation);

        if (benefit > cost.totalCost * 0.1) {
          recommendations.costEffective.push(recommendation);
        }

        if (['ventilation', 'air_filtration', 'climate_control'].includes(upgradeType)) {
          recommendations.environmental.push(recommendation);
        }
      }
    }
  });

  // Add maintenance recommendations
  const maintenanceStatus = assessMaintenanceStatus(facility);
  if (maintenanceStatus.urgency !== 'low') {
    recommendations.maintenance.push({
      facilityId: facility.id,
      type: 'maintenance',
      urgency: maintenanceStatus.urgency,
      daysSince: maintenanceStatus.daysSinceMaintenance,
      recommendation: 'Schedule facility maintenance',
      priority: maintenanceStatus.urgency,
    });
  }

  return recommendations;
}

/**
 * Calculate facility benefits with meaningful gameplay value
 * @param {Object} facility - Facility data
 * @returns {Object} Benefit breakdown
 */
function calculateFacilityBenefits(facility) {
  const upgrades = facility.upgrades || {};
  const specs = getUpgradeSpecifications();
  const benefits = {
    trainingEfficiencyBonus: 0,
    competitionPerformanceBonus: 0,
    costReductions: 0,
    recoverySpeedBonus: 0,
    breedingOptimizationBonus: 0,
    hostingRevenue: 0,
  };

  // Calculate benefits from each upgrade
  Object.entries(upgrades).forEach(([upgradeType, level]) => {
    const spec = specs[upgradeType];
    if (!spec || !spec.benefits) { return; }

    const upgradeBenefits = spec.benefits;

    // Training efficiency benefits
    if (upgradeBenefits.trainingEffectiveness) {
      benefits.trainingEfficiencyBonus += level * upgradeBenefits.trainingEffectiveness * 1000; // $1000 per 100% improvement
    }

    // Competition performance benefits
    if (upgradeBenefits.competitionPerformance) {
      benefits.competitionPerformanceBonus += level * upgradeBenefits.competitionPerformance * 2000; // $2000 per 100% improvement
    }

    // Cost reduction benefits
    if (upgradeBenefits.careCostReduction) {
      benefits.costReductions += level * upgradeBenefits.careCostReduction * 500; // $500 per 100% reduction
    }
    if (upgradeBenefits.groomCostReduction) {
      benefits.costReductions += level * upgradeBenefits.groomCostReduction * 300; // $300 per 100% reduction
    }
    if (upgradeBenefits.vetCostReduction) {
      benefits.costReductions += level * upgradeBenefits.vetCostReduction * 400; // $400 per 100% reduction
    }

    // Recovery speed benefits
    if (upgradeBenefits.stressRecovery) {
      benefits.recoverySpeedBonus += level * upgradeBenefits.stressRecovery * 300; // $300 per 100% improvement
    }
    if (upgradeBenefits.healthRecovery) {
      benefits.recoverySpeedBonus += level * upgradeBenefits.healthRecovery * 400; // $400 per 100% improvement
    }

    // Breeding optimization benefits (trait expression, not success rate)
    if (upgradeBenefits.positiveTraitChance) {
      benefits.breedingOptimizationBonus += level * upgradeBenefits.positiveTraitChance * 600; // $600 per 30% trait improvement
    }

    // Hosting revenue
    if (upgradeBenefits.hostingRevenue) {
      benefits.hostingRevenue += level * upgradeBenefits.hostingRevenue; // Direct revenue
    }
  });

  return benefits;
}

/**
 * Calculate upgrade benefit with meaningful gameplay value
 * @param {string} upgradeType - Upgrade type
 * @param {number} level - Upgrade level
 * @returns {number} Benefit value in dollars per month
 */
function calculateUpgradeBenefit(upgradeType, level) {
  const specs = getUpgradeSpecifications();
  const spec = specs[upgradeType];

  if (!spec || !spec.benefits) { return 100 * level; }

  let monthlyBenefit = 0;
  const { benefits } = spec;

  // Training efficiency benefits
  if (benefits.trainingEffectiveness) {
    monthlyBenefit += level * benefits.trainingEffectiveness * 1000; // $1000 per 100% improvement
  }

  // Competition performance benefits
  if (benefits.competitionPerformance) {
    monthlyBenefit += level * benefits.competitionPerformance * 2000; // $2000 per 100% improvement
  }

  // Cost reduction benefits
  if (benefits.careCostReduction) {
    monthlyBenefit += level * benefits.careCostReduction * 500; // $500 per 100% reduction
  }
  if (benefits.groomCostReduction) {
    monthlyBenefit += level * benefits.groomCostReduction * 300; // $300 per 100% reduction
  }
  if (benefits.vetCostReduction) {
    monthlyBenefit += level * benefits.vetCostReduction * 400; // $400 per 100% reduction
  }

  // Recovery speed benefits
  if (benefits.stressRecovery) {
    monthlyBenefit += level * benefits.stressRecovery * 300; // $300 per 100% improvement
  }
  if (benefits.healthRecovery) {
    monthlyBenefit += level * benefits.healthRecovery * 400; // $400 per 100% improvement
  }

  // Breeding optimization benefits (trait expression, not success rate)
  if (benefits.positiveTraitChance) {
    monthlyBenefit += level * benefits.positiveTraitChance * 600; // $600 per 30% trait improvement
  }

  // Hosting revenue
  if (benefits.hostingRevenue) {
    monthlyBenefit += level * benefits.hostingRevenue * 0.5; // Assume 0.5 events per month
  }

  // Special benefits for boolean upgrades
  if (benefits.autoOptimization && level > 0) {
    monthlyBenefit += 1500; // $1500/month for automation convenience
  }
  if (benefits.advancedBreeding && level > 0) {
    monthlyBenefit += 2000; // $2000/month for advanced breeding access
  }

  return Math.round(monthlyBenefit);
}

/**
 * Determine upgrade priority based on gameplay impact
 * @param {string} upgradeType - Upgrade type
 * @param {number} currentLevel - Current level
 * @param {Object} facility - Facility data
 * @returns {string} Priority level
 */
function determineUpgradePriority(upgradeType, currentLevel, facility) {
  if (currentLevel === 0) {
    // Missing critical upgrades that provide immediate gameplay benefits
    if (['training_efficiency', 'medical_facility'].includes(upgradeType)) {
      return 'high'; // Essential for basic operations
    }
    if (['automated_care', 'environmental_control'].includes(upgradeType)) {
      return 'medium'; // Important for cost savings and convenience
    }
    if (['performance_analytics', 'recovery_systems'].includes(upgradeType)) {
      return 'medium'; // Valuable for competitive advantage
    }
    if (['breeding_research', 'ai_optimization'].includes(upgradeType)) {
      return 'low'; // Advanced features for established players
    }
    if (['genetic_laboratory', 'competition_hosting'].includes(upgradeType)) {
      return 'low'; // Elite features requiring prerequisites
    }
    return 'medium';
  }

  // For existing upgrades, consider facility effectiveness and specialization
  if (facility.effectiveness < 70) {
    // Focus on core improvements first
    if (['training_efficiency', 'performance_analytics', 'recovery_systems'].includes(upgradeType)) {
      return 'high';
    }
    return 'medium';
  }

  // High-effectiveness facilities can focus on advanced features
  if (facility.effectiveness >= 85) {
    if (['genetic_laboratory', 'ai_optimization', 'competition_hosting'].includes(upgradeType)) {
      return 'medium';
    }
  }

  return 'low';
}

/**
 * Generate upgrade reasoning with specific gameplay benefits
 * @param {string} upgradeType - Upgrade type
 * @param {number} currentLevel - Current level
 * @param {Object} facility - Facility data
 * @returns {string} Reasoning text
 */
function generateUpgradeReasoning(upgradeType, currentLevel, facility) {
  const specs = getUpgradeSpecifications();
  const spec = specs[upgradeType];

  if (!spec) {
    return `Upgrading ${upgradeType} will improve facility capabilities`;
  }

  if (currentLevel === 0) {
    // First-time installation reasoning with specific benefits
    const reasoningMap = {
      training_efficiency: `Adding Training Efficiency Center will boost training effectiveness by ${spec.benefits.trainingEffectiveness * 100}% and reduce cooldowns by ${spec.benefits.trainingCooldownReduction} day`,
      performance_analytics: `Installing Performance Analytics Lab will increase competition performance by ${spec.benefits.competitionPerformance * 100}% and provide race predictions`,
      recovery_systems: `Adding Recovery Systems will accelerate stress recovery by ${spec.benefits.stressRecovery * 100}% and health recovery by ${spec.benefits.healthRecovery * 100}%`,
      automated_care: `Installing Automated Care will reduce daily care costs by ${spec.benefits.careCostReduction * 100}% and groom costs by ${spec.benefits.groomCostReduction * 100}%`,
      medical_facility: `Adding Medical Facility will cut veterinary costs by ${spec.benefits.vetCostReduction * 100}% and speed injury recovery by ${spec.benefits.injuryRecovery * 100}%`,
      breeding_research: `Installing Breeding Research Center will boost breeding success by ${spec.benefits.breedingSuccess * 100}% and improve trait predictions by ${spec.benefits.traitPrediction * 100}%`,
      genetic_laboratory: `Adding Genetic Laboratory will unlock advanced breeding techniques and increase beneficial trait expression by ${spec.benefits.traitManipulation * 100}%`,
      ai_optimization: `Installing AI Optimization will enable automatic training scheduling and boost efficiency by ${spec.benefits.trainingEfficiency * 100}%`,
      environmental_control: `Adding Environmental Control will provide ${spec.benefits.weatherProtection * 100}% weather protection with automatic management`,
      competition_hosting: `Installing Competition Hosting Facility will generate $${spec.benefits.hostingRevenue} per event and boost prestige by ${spec.benefits.prestigeBonus * 100}%`,
    };

    return reasoningMap[upgradeType] || `Adding ${spec.name} will provide significant gameplay advantages`;
  }

  // Upgrade reasoning for existing systems
  if (facility.effectiveness < 70) {
    return `Upgrading ${spec.name} to level ${currentLevel + 1} will multiply current benefits and improve overall facility effectiveness`;
  }

  return `Enhanced ${spec.name} will provide even greater strategic advantages and competitive edge`;
}
