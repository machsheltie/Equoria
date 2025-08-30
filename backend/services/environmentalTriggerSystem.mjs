/**
 * Environmental Trigger System Service
 * 
 * Implements comprehensive environmental factors that trigger epigenetic trait expression.
 * Analyzes interaction patterns, environmental conditions, and developmental windows
 * to determine trait expression probabilities and environmental influences.
 * 
 * Business Rules:
 * - Environmental factor detection from interaction patterns and conditions
 * - Age-based trigger threshold calculations with developmental sensitivity
 * - Trait expression probability based on cumulative environmental exposure
 * - Seasonal and weather-based trigger variations
 * - Stress-based environmental trigger amplification
 * - Critical period environmental sensitivity assessment
 * - Cumulative exposure tracking and analysis
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

// Environmental trigger definitions
const ENVIRONMENTAL_TRIGGERS = {
  stress_inducing: {
    name: 'Stress Inducing Environment',
    factors: ['loud_noises', 'unfamiliar_surroundings', 'rough_handling', 'time_pressure'],
    traits_affected: ['fearful', 'reactive', 'insecure', 'fragile'],
    threshold_modifier: 0.8, // Lower threshold = more sensitive
  },
  confidence_building: {
    name: 'Confidence Building Environment',
    factors: ['calm_atmosphere', 'patient_handling', 'positive_reinforcement', 'gradual_exposure'],
    traits_affected: ['brave', 'confident', 'social', 'curious'],
    threshold_modifier: 1.2, // Higher threshold = less sensitive
  },
  social_stimulation: {
    name: 'Social Stimulation Environment',
    factors: ['multiple_handlers', 'group_activities', 'varied_interactions', 'social_exposure'],
    traits_affected: ['social', 'affectionate', 'outgoing'],
    threshold_modifier: 1.0,
  },
  isolation_stress: {
    name: 'Isolation Stress Environment',
    factors: ['limited_contact', 'minimal_interaction', 'solitary_confinement', 'neglect'],
    traits_affected: ['antisocial', 'withdrawn', 'insecure'],
    threshold_modifier: 0.7,
  },
  sensory_enrichment: {
    name: 'Sensory Enrichment Environment',
    factors: ['varied_textures', 'different_sounds', 'visual_stimulation', 'tactile_experiences'],
    traits_affected: ['curious', 'intelligent', 'adaptable'],
    threshold_modifier: 1.1,
  },
  routine_stability: {
    name: 'Routine Stability Environment',
    factors: ['consistent_schedule', 'familiar_handlers', 'predictable_environment', 'stable_routine'],
    traits_affected: ['calm', 'patient', 'stable'],
    threshold_modifier: 1.3,
  },
};

// Seasonal trigger modifiers
const SEASONAL_MODIFIERS = {
  spring: {
    factors: ['increased_daylight', 'warmer_weather', 'breeding_season', 'growth_period'],
    trait_modifiers: { curious: 1.2, energetic: 1.1, social: 1.1 },
  },
  summer: {
    factors: ['long_days', 'heat_stress', 'outdoor_activities', 'peak_activity'],
    trait_modifiers: { brave: 1.1, confident: 1.1, heat_sensitive: 1.3 },
  },
  autumn: {
    factors: ['shorter_days', 'cooler_weather', 'preparation_period', 'settling_down'],
    trait_modifiers: { calm: 1.2, patient: 1.1, anxious: 0.9 },
  },
  winter: {
    factors: ['cold_weather', 'limited_daylight', 'indoor_confinement', 'reduced_activity'],
    trait_modifiers: { withdrawn: 1.2, cold_sensitive: 1.3, calm: 1.1 },
  },
};

// Critical developmental periods (in days from birth)
const CRITICAL_PERIODS = [
  { name: 'imprinting', start: 0, end: 3, sensitivity: 1.0, description: 'Initial bonding period' },
  { name: 'early_socialization', start: 1, end: 14, sensitivity: 0.9, description: 'Primary socialization window' },
  { name: 'fear_period_1', start: 8, end: 11, sensitivity: 0.8, description: 'First fear imprint period' },
  { name: 'curiosity_development', start: 14, end: 28, sensitivity: 0.7, description: 'Exploration behavior development' },
  { name: 'fear_period_2', start: 21, end: 28, sensitivity: 0.8, description: 'Second fear imprint period' },
  { name: 'social_hierarchy', start: 30, end: 60, sensitivity: 0.6, description: 'Social structure learning' },
  { name: 'independence_development', start: 60, end: 120, sensitivity: 0.5, description: 'Independence and confidence building' },
];

/**
 * Detect environmental triggers from interaction patterns
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Detected environmental triggers
 */
export async function detectEnvironmentalTriggers(horseId) {
  try {
    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      include: {
        groom: {
          select: { groomPersonality: true, skillLevel: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (interactions.length === 0) {
      return {
        horseId,
        detectedTriggers: [],
        triggerStrength: 0,
        environmentalFactors: [],
        analysisWindow: 30,
        interactionCount: 0,
      };
    }

    const detectedTriggers = [];
    const environmentalFactors = [];
    let totalTriggerStrength = 0;

    // Analyze interaction patterns for environmental triggers
    Object.entries(ENVIRONMENTAL_TRIGGERS).forEach(([triggerType, triggerDef]) => {
      const triggerScore = calculateTriggerScore(interactions, triggerType, triggerDef);
      
      if (triggerScore > 0.3) { // Threshold for trigger detection
        detectedTriggers.push({
          type: triggerType,
          name: triggerDef.name,
          strength: triggerScore,
          affectedTraits: triggerDef.traits_affected,
          factors: identifyActiveTriggerFactors(interactions, triggerDef.factors),
        });
        
        totalTriggerStrength += triggerScore;
        environmentalFactors.push(...triggerDef.factors);
      }
    });

    // Remove duplicate factors
    const uniqueFactors = [...new Set(environmentalFactors)];

    return {
      horseId,
      detectedTriggers,
      triggerStrength: totalTriggerStrength / detectedTriggers.length || 0,
      environmentalFactors: uniqueFactors,
      analysisWindow: 30,
      interactionCount: interactions.length,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error detecting environmental triggers for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Calculate age-appropriate trigger thresholds
 * @param {number} horseId - ID of the horse
 * @returns {Object} Calculated trigger thresholds
 */
export async function calculateTriggerThresholds(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true, stressLevel: true, bondScore: true },
    });

    if (!horse) {
      throw new Error(`Horse not found: ${horseId}`);
    }

    const ageInDays = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
    
    // Base threshold (lower = more sensitive)
    let baseThreshold = 0.5;
    
    // Age modifier - younger horses are more sensitive
    let ageModifier = 1.0;
    if (ageInDays <= 7) ageModifier = 0.6; // Very young - highly sensitive
    else if (ageInDays <= 30) ageModifier = 0.7; // Young - moderately sensitive
    else if (ageInDays <= 90) ageModifier = 0.8; // Developing - somewhat sensitive
    else ageModifier = 1.0; // Mature - normal sensitivity

    // Stress modifier - stressed horses are more sensitive
    const stressModifier = Math.max(0.5, 1.0 - (horse.stressLevel / 20)); // Higher stress = lower threshold

    // Bond modifier - well-bonded horses are less sensitive to negative triggers
    const bondModifier = Math.min(1.2, 1.0 + (horse.bondScore / 100)); // Higher bond = higher threshold

    const finalThreshold = baseThreshold * ageModifier * stressModifier * bondModifier;

    return {
      horseId,
      baseThreshold,
      ageInDays,
      ageModifier,
      stressModifier,
      bondModifier,
      finalThreshold: Math.max(0.1, Math.min(1.0, finalThreshold)),
      sensitivity: 1.0 - finalThreshold, // Inverse relationship
    };

  } catch (error) {
    logger.error(`Error calculating trigger thresholds for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Evaluate trait expression probability based on environmental exposure
 * @param {number} horseId - ID of the horse
 * @param {string} traitName - Name of the trait to evaluate
 * @returns {Object} Trait expression probability analysis
 */
export async function evaluateTraitExpressionProbability(horseId, traitName) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true, stressLevel: true, bondScore: true, epigeneticFlags: true },
    });

    const triggers = await detectEnvironmentalTriggers(horseId);
    const thresholds = await calculateTriggerThresholds(horseId);

    // Base probability for trait expression
    let baseProbability = 0.1; // 10% base chance

    // Environmental modifier based on relevant triggers
    let environmentalModifier = 1.0;
    triggers.detectedTriggers.forEach(trigger => {
      if (trigger.affectedTraits.includes(traitName)) {
        environmentalModifier += trigger.strength * 0.5; // Up to 50% increase per relevant trigger
      }
    });

    // Age modifier - younger horses more likely to express new traits
    const ageInDays = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
    let ageModifier = 1.0;
    if (ageInDays <= 30) ageModifier = 1.5; // Young foals
    else if (ageInDays <= 90) ageModifier = 1.2; // Developing foals
    else ageModifier = 0.8; // Older horses

    // Stress modifier - affects different traits differently
    let stressModifier = 1.0;
    const negativeTraits = ['fearful', 'reactive', 'insecure', 'fragile', 'antisocial'];
    const positiveTraits = ['brave', 'confident', 'social', 'curious', 'calm'];
    
    if (negativeTraits.includes(traitName)) {
      stressModifier = 1.0 + (horse.stressLevel / 20); // Higher stress increases negative traits
    } else if (positiveTraits.includes(traitName)) {
      stressModifier = Math.max(0.5, 1.0 - (horse.stressLevel / 30)); // Higher stress decreases positive traits
    }

    // Calculate final probability
    const finalProbability = Math.max(0, Math.min(1, 
      baseProbability * environmentalModifier * ageModifier * stressModifier
    ));

    // Determine expression likelihood
    let expressionLikelihood;
    if (finalProbability >= 0.7) expressionLikelihood = 'very_likely';
    else if (finalProbability >= 0.5) expressionLikelihood = 'likely';
    else if (finalProbability >= 0.3) expressionLikelihood = 'possible';
    else if (finalProbability >= 0.1) expressionLikelihood = 'unlikely';
    else expressionLikelihood = 'very_unlikely';

    return {
      horseId,
      traitName,
      baseProbability,
      environmentalModifier,
      ageModifier,
      stressModifier,
      finalProbability,
      expressionLikelihood,
      relevantTriggers: triggers.detectedTriggers.filter(t => t.affectedTraits.includes(traitName)),
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error evaluating trait expression probability for horse ${horseId}, trait ${traitName}:`, error);
    throw error;
  }
}

/**
 * Process seasonal environmental triggers
 * @param {number} horseId - ID of the horse
 * @param {string} season - Current season (spring, summer, autumn, winter)
 * @returns {Object} Seasonal trigger analysis
 */
export async function processSeasonalTriggers(horseId, season) {
  try {
    const seasonalData = SEASONAL_MODIFIERS[season.toLowerCase()];

    if (!seasonalData) {
      throw new Error(`Invalid season: ${season}`);
    }

    const baseTriggers = await detectEnvironmentalTriggers(horseId);

    // Apply seasonal modifications to triggers
    const triggerModifications = {};
    const affectedTraits = [];

    Object.entries(seasonalData.trait_modifiers).forEach(([trait, modifier]) => {
      triggerModifications[trait] = modifier;
      affectedTraits.push(trait);
    });

    // Calculate seasonal influence on existing triggers
    const modifiedTriggers = baseTriggers.detectedTriggers.map(trigger => ({
      ...trigger,
      seasonalModifier: calculateSeasonalModifier(trigger, seasonalData),
      adjustedStrength: trigger.strength * calculateSeasonalModifier(trigger, seasonalData),
    }));

    return {
      horseId,
      season,
      seasonalFactors: seasonalData.factors,
      triggerModifications,
      affectedTraits,
      modifiedTriggers,
      seasonalInfluence: calculateOverallSeasonalInfluence(seasonalData),
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error processing seasonal triggers for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Analyze stress-based environmental triggers
 * @param {number} horseId - ID of the horse
 * @returns {Object} Stress-based trigger analysis
 */
export async function analyzeStressEnvironmentTriggers(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { stressLevel: true, bondScore: true },
    });

    const interactions = await prisma.groomInteraction.findMany({
      where: {
        foalId: horseId,
        stressChange: { gt: 0 }, // Only stress-increasing interactions
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const stressTriggers = [];
    let triggerIntensity = 0;

    // Analyze stress-inducing patterns
    if (interactions.length > 0) {
      const avgStressIncrease = interactions.reduce((sum, i) => sum + i.stressChange, 0) / interactions.length;
      const maxStressIncrease = Math.max(...interactions.map(i => i.stressChange));

      triggerIntensity = (avgStressIncrease + maxStressIncrease) / 2;

      // Identify specific stress triggers
      const taskTypes = {};
      interactions.forEach(interaction => {
        const taskType = interaction.taskType;
        if (!taskTypes[taskType]) {
          taskTypes[taskType] = { count: 0, totalStress: 0 };
        }
        taskTypes[taskType].count++;
        taskTypes[taskType].totalStress += interaction.stressChange;
      });

      Object.entries(taskTypes).forEach(([taskType, data]) => {
        const avgStress = data.totalStress / data.count;
        if (avgStress > 2) { // Significant stress increase
          stressTriggers.push({
            trigger: taskType,
            frequency: data.count,
            averageStressIncrease: avgStress,
            severity: avgStress > 3 ? 'high' : 'moderate',
          });
        }
      });
    }

    // Generate recommendations
    const recommendedInterventions = generateStressInterventions(horse.stressLevel, stressTriggers);

    return {
      horseId,
      stressLevel: horse.stressLevel,
      stressTriggers,
      triggerIntensity,
      stressfulInteractionCount: interactions.length,
      recommendedInterventions,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error analyzing stress environment triggers for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Track cumulative environmental exposure over time
 * @param {number} horseId - ID of the horse
 * @returns {Object} Cumulative exposure analysis
 */
export async function trackCumulativeExposure(horseId) {
  try {
    const interactions = await prisma.groomInteraction.findMany({
      where: { foalId: horseId },
      orderBy: { createdAt: 'asc' },
    });

    if (interactions.length === 0) {
      return {
        horseId,
        totalExposure: 0,
        exposureByType: {},
        exposureTimeline: [],
        cumulativeEffects: {},
      };
    }

    let totalExposure = 0;
    const exposureByType = {};
    const exposureTimeline = [];
    const cumulativeEffects = {};

    // Track exposure over time
    interactions.forEach((interaction, index) => {
      const exposureValue = calculateInteractionExposure(interaction);
      totalExposure += exposureValue;

      // Track by task type
      const taskType = interaction.taskType;
      if (!exposureByType[taskType]) {
        exposureByType[taskType] = 0;
      }
      exposureByType[taskType] += exposureValue;

      // Timeline entry
      exposureTimeline.push({
        date: interaction.createdAt,
        taskType,
        exposureValue,
        cumulativeExposure: totalExposure,
        bondingChange: interaction.bondingChange,
        stressChange: interaction.stressChange,
      });

      // Calculate cumulative effects every 5 interactions
      if ((index + 1) % 5 === 0) {
        const recentInteractions = interactions.slice(Math.max(0, index - 4), index + 1);
        cumulativeEffects[`interaction_${index + 1}`] = analyzeCumulativeEffects(recentInteractions);
      }
    });

    return {
      horseId,
      totalExposure,
      exposureByType,
      exposureTimeline,
      cumulativeEffects,
      analysisWindow: interactions.length,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error tracking cumulative exposure for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Assess critical period environmental sensitivity
 * @param {number} horseId - ID of the horse
 * @returns {Object} Critical period sensitivity analysis
 */
export async function assessCriticalPeriodSensitivity(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { dateOfBirth: true },
    });

    const currentAge = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Identify active critical periods
    const activeWindows = CRITICAL_PERIODS.filter(period =>
      currentAge >= period.start && currentAge <= period.end
    );

    // Calculate overall sensitivity level
    let sensitivityLevel = 0;
    if (activeWindows.length > 0) {
      sensitivityLevel = Math.max(...activeWindows.map(window => window.sensitivity));
    } else {
      // Calculate residual sensitivity for horses outside critical periods
      const daysSinceLastPeriod = Math.min(...CRITICAL_PERIODS.map(period =>
        currentAge > period.end ? currentAge - period.end : Infinity
      ));

      if (daysSinceLastPeriod < 30) {
        sensitivityLevel = 0.3; // Some residual sensitivity
      } else {
        sensitivityLevel = 0.1; // Minimal sensitivity
      }
    }

    // Generate recommendations based on active periods
    const recommendations = generateCriticalPeriodRecommendations(activeWindows, currentAge);

    return {
      horseId,
      currentAge,
      criticalPeriods: CRITICAL_PERIODS,
      activeWindows,
      sensitivityLevel,
      recommendations,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error assessing critical period sensitivity for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Generate comprehensive environmental analysis report
 * @param {number} horseId - ID of the horse
 * @returns {Object} Complete environmental analysis report
 */
export async function generateEnvironmentalReport(horseId) {
  try {
    const [
      environmentalTriggers,
      triggerThresholds,
      cumulativeExposure,
      criticalPeriodSensitivity
    ] = await Promise.all([
      detectEnvironmentalTriggers(horseId),
      calculateTriggerThresholds(horseId),
      trackCumulativeExposure(horseId),
      assessCriticalPeriodSensitivity(horseId)
    ]);

    // Evaluate trait expression probabilities for common traits
    const commonTraits = ['brave', 'fearful', 'confident', 'curious', 'calm', 'reactive', 'social'];
    const traitExpressionProbabilities = await Promise.all(
      commonTraits.map(trait => evaluateTraitExpressionProbability(horseId, trait))
    );

    // Generate recommendations based on analysis
    const recommendations = generateEnvironmentalRecommendations(
      environmentalTriggers,
      triggerThresholds,
      criticalPeriodSensitivity,
      traitExpressionProbabilities
    );

    return {
      horseId,
      environmentalTriggers,
      triggerThresholds,
      traitExpressionProbabilities,
      cumulativeExposure,
      criticalPeriodSensitivity,
      recommendations,
      reportTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error generating environmental report for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Calculate trigger score for a specific trigger type
 */
function calculateTriggerScore(interactions, triggerType, triggerDef) {
  let score = 0;
  let relevantInteractions = 0;

  interactions.forEach(interaction => {
    let interactionScore = 0;

    // Analyze interaction characteristics
    if (triggerType === 'stress_inducing') {
      if (interaction.stressChange > 2) interactionScore += 0.3;
      if (interaction.quality === 'poor') interactionScore += 0.2;
      if (interaction.bondingChange < 0) interactionScore += 0.2;
    } else if (triggerType === 'confidence_building') {
      if (interaction.bondingChange > 1) interactionScore += 0.3;
      if (interaction.quality === 'excellent') interactionScore += 0.2;
      if (interaction.stressChange <= 0) interactionScore += 0.2;
    } else if (triggerType === 'social_stimulation') {
      if (interaction.interactionType === 'enrichment') interactionScore += 0.2;
      if (interaction.duration > 30) interactionScore += 0.1;
    } else if (triggerType === 'isolation_stress') {
      if (interaction.bondingChange < -1) interactionScore += 0.3;
      if (interaction.duration < 15) interactionScore += 0.2;
    } else if (triggerType === 'sensory_enrichment') {
      if (interaction.taskType === 'desensitization') interactionScore += 0.3;
      if (interaction.taskType === 'showground_exposure') interactionScore += 0.2;
    } else if (triggerType === 'routine_stability') {
      // Check for consistent groom assignments
      if (interaction.groom?.groomPersonality === 'calm') interactionScore += 0.2;
      if (interaction.quality === 'good' || interaction.quality === 'excellent') interactionScore += 0.1;
    }

    if (interactionScore > 0) {
      score += interactionScore;
      relevantInteractions++;
    }
  });

  return relevantInteractions > 0 ? score / relevantInteractions : 0;
}

/**
 * Identify active trigger factors from interactions
 */
function identifyActiveTriggerFactors(interactions, possibleFactors) {
  const activeFactors = [];

  // Simple heuristic to identify which factors are present
  possibleFactors.forEach(factor => {
    let factorPresent = false;

    switch (factor) {
      case 'loud_noises':
      case 'unfamiliar_surroundings':
        factorPresent = interactions.some(i => i.stressChange > 2);
        break;
      case 'calm_atmosphere':
      case 'patient_handling':
        factorPresent = interactions.some(i => i.bondingChange > 1 && i.quality === 'excellent');
        break;
      case 'multiple_handlers':
        const uniqueGrooms = new Set(interactions.map(i => i.groomId));
        factorPresent = uniqueGrooms.size > 1;
        break;
      case 'limited_contact':
        factorPresent = interactions.length < 3;
        break;
      case 'varied_textures':
      case 'different_sounds':
        factorPresent = interactions.some(i => i.taskType === 'desensitization');
        break;
      case 'consistent_schedule':
        factorPresent = interactions.length > 5;
        break;
      default:
        factorPresent = Math.random() > 0.7; // Default probability
    }

    if (factorPresent) {
      activeFactors.push(factor);
    }
  });

  return activeFactors;
}

/**
 * Calculate seasonal modifier for a trigger
 */
function calculateSeasonalModifier(trigger, seasonalData) {
  let modifier = 1.0;

  trigger.affectedTraits.forEach(trait => {
    if (seasonalData.trait_modifiers[trait]) {
      modifier *= seasonalData.trait_modifiers[trait];
    }
  });

  return modifier;
}

/**
 * Calculate overall seasonal influence
 */
function calculateOverallSeasonalInfluence(seasonalData) {
  const modifiers = Object.values(seasonalData.trait_modifiers);
  const avgModifier = modifiers.reduce((sum, mod) => sum + mod, 0) / modifiers.length;

  return {
    strength: Math.abs(avgModifier - 1.0),
    direction: avgModifier > 1.0 ? 'enhancing' : 'suppressing',
    factorCount: seasonalData.factors.length,
  };
}

/**
 * Generate stress intervention recommendations
 */
function generateStressInterventions(stressLevel, stressTriggers) {
  const interventions = [];

  if (stressLevel > 7) {
    interventions.push('Immediate stress reduction required - use calm, experienced grooms only');
    interventions.push('Reduce interaction frequency and duration');
    interventions.push('Focus on trust-building activities');
  }

  stressTriggers.forEach(trigger => {
    if (trigger.severity === 'high') {
      interventions.push(`Avoid ${trigger.trigger} activities until stress levels improve`);
    } else {
      interventions.push(`Use extra caution with ${trigger.trigger} activities`);
    }
  });

  if (interventions.length === 0) {
    interventions.push('Continue current care routine with monitoring');
  }

  return interventions;
}

/**
 * Calculate interaction exposure value
 */
function calculateInteractionExposure(interaction) {
  let exposure = interaction.duration / 60; // Base exposure in hours

  // Modify based on interaction intensity
  if (interaction.stressChange > 2) exposure *= 1.5; // High stress = more exposure
  if (interaction.bondingChange > 2) exposure *= 1.3; // High bonding = more exposure
  if (interaction.quality === 'excellent') exposure *= 1.2;
  if (interaction.quality === 'poor') exposure *= 0.8;

  return exposure;
}

/**
 * Analyze cumulative effects of recent interactions
 */
function analyzeCumulativeEffects(interactions) {
  const totalBonding = interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0);
  const totalStress = interactions.reduce((sum, i) => sum + (i.stressChange || 0), 0);
  const avgQuality = interactions.reduce((sum, i) => {
    const qualityScore = { poor: 1, fair: 2, good: 3, excellent: 4 }[i.quality] || 2;
    return sum + qualityScore;
  }, 0) / interactions.length;

  return {
    bondingTrend: totalBonding > 0 ? 'positive' : totalBonding < 0 ? 'negative' : 'neutral',
    stressTrend: totalStress > 0 ? 'increasing' : totalStress < 0 ? 'decreasing' : 'stable',
    qualityAverage: avgQuality,
    interactionCount: interactions.length,
  };
}

/**
 * Generate critical period recommendations
 */
function generateCriticalPeriodRecommendations(activeWindows, currentAge) {
  const recommendations = [];

  activeWindows.forEach(window => {
    switch (window.name) {
      case 'imprinting':
        recommendations.push('Critical imprinting period - ensure consistent, gentle handling');
        recommendations.push('Minimize stress and focus on positive associations');
        break;
      case 'early_socialization':
        recommendations.push('Important socialization window - introduce varied but controlled experiences');
        break;
      case 'fear_period_1':
      case 'fear_period_2':
        recommendations.push('Fear imprint period - avoid traumatic experiences');
        recommendations.push('Use extra caution and patience during interactions');
        break;
      case 'curiosity_development':
        recommendations.push('Encourage safe exploration and learning');
        recommendations.push('Provide enrichment activities to develop confidence');
        break;
      case 'social_hierarchy':
        recommendations.push('Important for social development - maintain consistent boundaries');
        break;
      case 'independence_development':
        recommendations.push('Support independence while maintaining security');
        break;
    }
  });

  if (recommendations.length === 0) {
    recommendations.push('Outside critical periods - continue normal development activities');
  }

  return recommendations;
}

/**
 * Generate environmental recommendations
 */
function generateEnvironmentalRecommendations(triggers, thresholds, criticalPeriod, traitProbabilities) {
  const recommendations = [];

  // Based on trigger sensitivity
  if (thresholds.sensitivity > 0.7) {
    recommendations.push('Horse is highly sensitive to environmental triggers - use gentle approaches');
  }

  // Based on detected triggers
  triggers.detectedTriggers.forEach(trigger => {
    if (trigger.strength > 0.6) {
      recommendations.push(`Strong ${trigger.name.toLowerCase()} detected - adjust care accordingly`);
    }
  });

  // Based on critical periods
  if (criticalPeriod.sensitivityLevel > 0.7) {
    recommendations.push('Currently in critical developmental period - extra care required');
  }

  // Based on trait probabilities
  const highProbTraits = traitProbabilities.filter(t => t.finalProbability > 0.6);
  if (highProbTraits.length > 0) {
    recommendations.push(`High probability for traits: ${highProbTraits.map(t => t.traitName).join(', ')}`);
  }

  return recommendations;
}
