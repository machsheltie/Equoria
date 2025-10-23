/**
 * Trait Interaction Matrix Service
 *
 * Implements complex trait interaction system with synergies and conflicts.
 * Analyzes how multiple epigenetic traits interact, amplify, or suppress each other
 * to create emergent behavioral patterns and characteristics.
 *
 * Business Rules:
 * - Trait synergy detection and amplification effects
 * - Trait conflict identification and suppression effects
 * - Complex multi-trait interaction calculations
 * - Trait dominance hierarchies and expression priorities
 * - Temporal trait interaction evolution over time
 * - Environmental modulation of trait interactions
 * - Emergent property identification from trait combinations
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

// Trait synergy definitions - traits that enhance each other
const TRAIT_SYNERGIES = {
  confidence_cluster: {
    traits: ['brave', 'confident', 'social'],
    synergy_strength: 0.8,
    amplification_factor: 1.3,
    description: 'Confidence and social traits reinforce each other',
  },
  intelligence_cluster: {
    traits: ['curious', 'intelligent', 'adaptable'],
    synergy_strength: 0.7,
    amplification_factor: 1.25,
    description: 'Intelligence traits create learning synergies',
  },
  stability_cluster: {
    traits: ['calm', 'patient', 'stable'],
    synergy_strength: 0.9,
    amplification_factor: 1.4,
    description: 'Stability traits create emotional balance',
  },
  social_cluster: {
    traits: ['social', 'affectionate', 'outgoing'],
    synergy_strength: 0.75,
    amplification_factor: 1.2,
    description: 'Social traits enhance interpersonal connections',
  },
  sensitivity_cluster: {
    traits: ['sensitive', 'empathetic', 'intuitive'],
    synergy_strength: 0.6,
    amplification_factor: 1.15,
    description: 'Sensitivity traits create emotional awareness',
  },
};

// Trait conflict definitions - traits that oppose each other
const TRAIT_CONFLICTS = {
  fear_confidence: {
    trait_pairs: [['fearful', 'brave'], ['fearful', 'confident'], ['insecure', 'confident']],
    conflict_strength: 0.9,
    suppression_factor: 0.6,
    description: 'Fear-based traits conflict with confidence traits',
  },
  reactive_calm: {
    trait_pairs: [['reactive', 'calm'], ['reactive', 'patient'], ['volatile', 'stable']],
    conflict_strength: 0.8,
    suppression_factor: 0.7,
    description: 'Reactive traits conflict with calm stability',
  },
  social_antisocial: {
    trait_pairs: [['social', 'antisocial'], ['outgoing', 'withdrawn'], ['affectionate', 'aloof']],
    conflict_strength: 0.85,
    suppression_factor: 0.65,
    description: 'Social and antisocial traits are mutually exclusive',
  },
  fragile_resilient: {
    trait_pairs: [['fragile', 'resilient'], ['fragile', 'hardy'], ['delicate', 'robust']],
    conflict_strength: 0.7,
    suppression_factor: 0.75,
    description: 'Physical fragility conflicts with resilience',
  },
  impulsive_methodical: {
    trait_pairs: [['impulsive', 'methodical'], ['spontaneous', 'deliberate'], ['hasty', 'careful']],
    conflict_strength: 0.6,
    suppression_factor: 0.8,
    description: 'Impulsive traits conflict with methodical approaches',
  },
};

// Trait dominance hierarchy - some traits are naturally more dominant
const TRAIT_DOMINANCE = {
  high_dominance: {
    traits: ['confident', 'brave', 'intelligent', 'dominant', 'assertive'],
    dominance_score: 0.9,
    description: 'Highly dominant traits that tend to override others',
  },
  moderate_dominance: {
    traits: ['social', 'curious', 'adaptable', 'resilient', 'stable'],
    dominance_score: 0.6,
    description: 'Moderately dominant traits with balanced expression',
  },
  low_dominance: {
    traits: ['sensitive', 'gentle', 'patient', 'submissive', 'compliant'],
    dominance_score: 0.3,
    description: 'Low dominance traits that are easily suppressed',
  },
  recessive: {
    traits: ['fearful', 'fragile', 'insecure', 'withdrawn', 'timid'],
    dominance_score: 0.1,
    description: 'Recessive traits that are often masked by others',
  },
};

/**
 * Analyze trait interactions for a horse
 * @param {number} horseId - ID of the horse to analyze
 * @returns {Object} Comprehensive trait interaction analysis
 */
export async function analyzeTraitInteractions(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { epigeneticFlags: true, stressLevel: true, bondScore: true },
    });

    if (!horse) {
      throw new Error(`Horse not found: ${horseId}`);
    }

    const traits = horse.epigeneticFlags;

    if (traits.length === 0) {
      return {
        horseId,
        traits: [],
        synergies: [],
        conflicts: [],
        overallHarmony: 0.5,
        dominantTraits: [],
        interactionStrength: 0,
        analysisTimestamp: new Date(),
      };
    }

    // Analyze synergies and conflicts
    const synergies = findTraitSynergies(traits);
    const conflicts = findTraitConflicts(traits);
    const dominantTraits = identifyDominantTraits(traits);

    // Calculate overall harmony (balance between synergies and conflicts)
    const synergyScore = synergies.reduce((sum, s) => sum + s.strength, 0);
    const conflictScore = conflicts.reduce((sum, c) => sum + c.strength, 0);
    const overallHarmony = calculateHarmonyScore(synergyScore, conflictScore, traits.length);

    // Calculate interaction strength
    const interactionStrength = (synergyScore + conflictScore) / traits.length;

    return {
      horseId,
      traits,
      synergies,
      conflicts,
      overallHarmony,
      dominantTraits,
      interactionStrength,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error analyzing trait interactions for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Calculate trait synergies and amplification effects
 * @param {number} horseId - ID of the horse
 * @returns {Object} Trait synergy analysis
 */
export async function calculateTraitSynergies(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { epigeneticFlags: true },
    });

    const traits = horse.epigeneticFlags;
    const synergyPairs = findTraitSynergies(traits);

    // Calculate amplification effects
    const amplificationEffects = {};
    const synergyCategories = {};

    synergyPairs.forEach(synergy => {
      // Track amplification for each trait
      [synergy.trait1, synergy.trait2].forEach(trait => {
        if (!amplificationEffects[trait]) {
          amplificationEffects[trait] = {
            baseStrength: 1.0,
            amplifiedStrength: 1.0,
            amplificationFactor: 1.0,
            synergyCount: 0,
          };
        }

        amplificationEffects[trait].amplificationFactor *= synergy.amplificationFactor;
        amplificationEffects[trait].amplifiedStrength =
          amplificationEffects[trait].baseStrength * amplificationEffects[trait].amplificationFactor;
        amplificationEffects[trait].synergyCount++;
      });

      // Categorize synergies
      const category = synergy.category || 'general';
      if (!synergyCategories[category]) {
        synergyCategories[category] = [];
      }
      synergyCategories[category].push(synergy);
    });

    const totalSynergyStrength = synergyPairs.reduce((sum, s) => sum + s.strength, 0);

    return {
      horseId,
      synergyPairs,
      totalSynergyStrength,
      amplificationEffects,
      synergyCategories,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error calculating trait synergies for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Identify trait conflicts and suppression effects
 * @param {number} horseId - ID of the horse
 * @returns {Object} Trait conflict analysis
 */
export async function identifyTraitConflicts(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { epigeneticFlags: true },
    });

    const traits = horse.epigeneticFlags;
    const conflictPairs = findTraitConflicts(traits);

    // Calculate suppression effects
    const suppressionEffects = {};
    const conflictCategories = {};

    conflictPairs.forEach(conflict => {
      // Track suppression for each trait
      [conflict.trait1, conflict.trait2].forEach(trait => {
        if (!suppressionEffects[trait]) {
          suppressionEffects[trait] = {
            baseStrength: 1.0,
            suppressedStrength: 1.0,
            suppressionFactor: 1.0,
            conflictCount: 0,
          };
        }

        suppressionEffects[trait].suppressionFactor *= conflict.suppressionFactor;
        suppressionEffects[trait].suppressedStrength =
          suppressionEffects[trait].baseStrength * suppressionEffects[trait].suppressionFactor;
        suppressionEffects[trait].conflictCount++;
      });

      // Categorize conflicts
      const category = conflict.category || 'general';
      if (!conflictCategories[category]) {
        conflictCategories[category] = [];
      }
      conflictCategories[category].push(conflict);
    });

    const totalConflictStrength = conflictPairs.reduce((sum, c) => sum + c.strength, 0);

    return {
      horseId,
      conflictPairs,
      totalConflictStrength,
      suppressionEffects,
      conflictCategories,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error identifying trait conflicts for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Evaluate trait dominance hierarchy
 * @param {number} horseId - ID of the horse
 * @returns {Object} Trait dominance analysis
 */
export async function evaluateTraitDominance(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { epigeneticFlags: true, stressLevel: true, bondScore: true },
    });

    const traits = horse.epigeneticFlags;

    // Calculate dominance scores for each trait
    const dominanceHierarchy = traits.map(trait => {
      const dominanceInfo = getTraitDominanceInfo(trait);
      const environmentalModifier = calculateEnvironmentalDominanceModifier(horse, trait);

      return {
        trait,
        baseDominanceScore: dominanceInfo.dominance_score,
        environmentalModifier,
        dominanceScore: dominanceInfo.dominance_score * environmentalModifier,
        dominanceLevel: dominanceInfo.level,
        description: dominanceInfo.description,
      };
    }).sort((a, b) => b.dominanceScore - a.dominanceScore);

    // Identify primary, secondary, and recessive traits
    const primaryTrait = dominanceHierarchy[0] || null;
    const secondaryTraits = dominanceHierarchy.slice(1, 3);
    const recessiveTraits = dominanceHierarchy.slice(3);

    // Calculate overall dominance strength
    const dominanceStrength = dominanceHierarchy.reduce((sum, t) => sum + t.dominanceScore, 0) / traits.length;

    return {
      horseId,
      dominanceHierarchy,
      primaryTrait,
      secondaryTraits,
      recessiveTraits,
      dominanceStrength,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error evaluating trait dominance for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Process complex multi-trait interactions
 * @param {number} horseId - ID of the horse
 * @returns {Object} Complex interaction analysis
 */
export async function processComplexInteractions(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { epigeneticFlags: true },
    });

    const traits = horse.epigeneticFlags;

    // Identify trait clusters
    const traitClusters = identifyTraitClusters(traits);

    // Identify emergent properties from trait combinations
    const emergentProperties = identifyEmergentProperties(traits);

    // Create interaction networks
    const interactionNetworks = createInteractionNetworks(traits);

    // Calculate stability metrics
    const stabilityMetrics = calculateStabilityMetrics(traits);

    // Calculate complexity score
    const complexityScore = calculateComplexityScore(traits, traitClusters, emergentProperties);

    return {
      horseId,
      traitClusters,
      emergentProperties,
      interactionNetworks,
      stabilityMetrics,
      complexityScore,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error processing complex interactions for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Assess stability of trait interactions
 * @param {number} horseId - ID of the horse
 * @returns {Object} Interaction stability analysis
 */
export async function assessInteractionStability(horseId) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { epigeneticFlags: true, stressLevel: true, bondScore: true },
    });

    const traits = horse.epigeneticFlags;
    const synergies = findTraitSynergies(traits);
    const conflicts = findTraitConflicts(traits);

    // Calculate overall stability
    const synergyStability = synergies.length > 0 ? 0.8 : 0.5;
    const conflictInstability = conflicts.length * 0.1;
    const stressInstability = horse.stressLevel * 0.05;

    const overallStability = Math.max(0, Math.min(1,
      synergyStability - conflictInstability - stressInstability,
    ));

    // Identify stability factors
    const stabilityFactors = [];
    if (synergies.length > 0) { stabilityFactors.push('trait_synergies'); }
    if (horse.bondScore > 30) { stabilityFactors.push('strong_bonding'); }
    if (horse.stressLevel < 4) { stabilityFactors.push('low_stress'); }

    // Identify volatility risks
    const volatilityRisks = [];
    if (conflicts.length > 2) { volatilityRisks.push('multiple_trait_conflicts'); }
    if (horse.stressLevel > 7) { volatilityRisks.push('high_stress_environment'); }
    if (traits.includes('reactive')) { volatilityRisks.push('reactive_temperament'); }

    // Generate recommendations
    const recommendations = generateStabilityRecommendations(overallStability, volatilityRisks);

    return {
      horseId,
      overallStability,
      stabilityFactors,
      volatilityRisks,
      stabilityTrends: calculateStabilityTrends(traits),
      recommendations,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error assessing interaction stability for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Model temporal trait interactions over time
 * @param {number} horseId - ID of the horse
 * @param {number} timeWindow - Time window in days
 * @returns {Object} Temporal interaction model
 */
export async function modelTemporalInteractions(horseId, timeWindow) {
  try {
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { epigeneticFlags: true, dateOfBirth: true },
    });

    const traits = horse.epigeneticFlags;
    const ageInDays = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Model interaction evolution over time
    const interactionEvolution = modelInteractionEvolution(traits, timeWindow, ageInDays);

    // Analyze stability trends
    const stabilityTrends = analyzeStabilityTrends(traits, timeWindow);

    // Identify emerging patterns
    const emergingPatterns = identifyEmergingPatterns(traits, ageInDays);

    // Project future changes
    const projectedChanges = projectFutureChanges(traits, timeWindow);

    return {
      horseId,
      timeWindow,
      interactionEvolution,
      stabilityTrends,
      emergingPatterns,
      projectedChanges,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error modeling temporal interactions for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Generate comprehensive interaction matrix
 * @param {number} horseId - ID of the horse
 * @returns {Object} Complete interaction matrix
 */
export async function generateInteractionMatrix(horseId) {
  try {
    const [
      traitInteractions,
      synergies,
      conflicts,
      dominance,
      complexInteractions,
      stability,
      temporalModel,
    ] = await Promise.all([
      analyzeTraitInteractions(horseId),
      calculateTraitSynergies(horseId),
      identifyTraitConflicts(horseId),
      evaluateTraitDominance(horseId),
      processComplexInteractions(horseId),
      assessInteractionStability(horseId),
      modelTemporalInteractions(horseId, 30),
    ]);

    // Create matrix visualization data
    const matrixVisualization = createMatrixVisualization(traitInteractions.traits, synergies, conflicts);

    // Generate summary
    const summary = {
      totalTraits: traitInteractions.traits.length,
      synergyCount: synergies.synergyPairs.length,
      conflictCount: conflicts.conflictPairs.length,
      overallHarmony: traitInteractions.overallHarmony,
      complexityScore: complexInteractions.complexityScore,
      stabilityScore: stability.overallStability,
      dominantTrait: dominance.primaryTrait?.trait || 'none',
    };

    return {
      horseId,
      traitInteractions,
      synergies,
      conflicts,
      dominance,
      complexInteractions,
      stability,
      temporalModel,
      matrixVisualization,
      summary,
      analysisTimestamp: new Date(),
    };

  } catch (error) {
    logger.error(`Error generating interaction matrix for horse ${horseId}:`, error);
    throw error;
  }
}

/**
 * Find trait synergies from a list of traits
 */
function findTraitSynergies(traits) {
  const synergies = [];

  Object.entries(TRAIT_SYNERGIES).forEach(([clusterName, cluster]) => {
    const matchingTraits = traits.filter(trait => cluster.traits.includes(trait));

    if (matchingTraits.length >= 2) {
      // Create synergy pairs within the cluster
      for (let i = 0; i < matchingTraits.length; i++) {
        for (let j = i + 1; j < matchingTraits.length; j++) {
          synergies.push({
            trait1: matchingTraits[i],
            trait2: matchingTraits[j],
            strength: cluster.synergy_strength,
            amplificationFactor: cluster.amplification_factor,
            category: clusterName,
            description: cluster.description,
          });
        }
      }
    }
  });

  return synergies;
}

/**
 * Find trait conflicts from a list of traits
 */
function findTraitConflicts(traits) {
  const conflicts = [];

  Object.entries(TRAIT_CONFLICTS).forEach(([conflictName, conflict]) => {
    conflict.trait_pairs.forEach(([trait1, trait2]) => {
      if (traits.includes(trait1) && traits.includes(trait2)) {
        conflicts.push({
          trait1,
          trait2,
          strength: conflict.conflict_strength,
          suppressionFactor: conflict.suppression_factor,
          category: conflictName,
          description: conflict.description,
        });
      }
    });
  });

  return conflicts;
}

/**
 * Identify dominant traits from a list
 */
function identifyDominantTraits(traits) {
  return traits.map(trait => {
    const dominanceInfo = getTraitDominanceInfo(trait);
    return {
      trait,
      dominanceScore: dominanceInfo.dominance_score,
      dominanceLevel: dominanceInfo.level,
    };
  }).filter(t => t.dominanceScore > 0.6).sort((a, b) => b.dominanceScore - a.dominanceScore);
}

/**
 * Get dominance information for a trait
 */
function getTraitDominanceInfo(trait) {
  for (const [level, info] of Object.entries(TRAIT_DOMINANCE)) {
    if (info.traits.includes(trait)) {
      return {
        dominance_score: info.dominance_score,
        level,
        description: info.description,
      };
    }
  }

  // Default for unknown traits
  return {
    dominance_score: 0.5,
    level: 'moderate_dominance',
    description: 'Unknown trait with moderate dominance',
  };
}

/**
 * Calculate environmental dominance modifier
 */
function calculateEnvironmentalDominanceModifier(horse, trait) {
  let modifier = 1.0;

  // Stress affects different traits differently
  if (['fearful', 'reactive', 'fragile'].includes(trait)) {
    modifier += horse.stressLevel * 0.05; // Stress enhances negative traits
  } else if (['brave', 'confident', 'calm'].includes(trait)) {
    modifier -= horse.stressLevel * 0.03; // Stress suppresses positive traits
  }

  // Bonding affects social traits
  if (['social', 'affectionate', 'trusting'].includes(trait)) {
    modifier += (horse.bondScore - 20) * 0.01; // Higher bond enhances social traits
  }

  return Math.max(0.5, Math.min(1.5, modifier));
}

/**
 * Calculate harmony score between synergies and conflicts
 */
function calculateHarmonyScore(synergyScore, conflictScore, traitCount) {
  if (traitCount === 0) { return 0.5; }

  const normalizedSynergy = synergyScore / traitCount;
  const normalizedConflict = conflictScore / traitCount;

  // Harmony is the balance between synergies and conflicts
  const harmony = (normalizedSynergy - normalizedConflict + 1) / 2;

  return Math.max(0, Math.min(1, harmony));
}

/**
 * Identify trait clusters
 */
function identifyTraitClusters(traits) {
  const clusters = [];

  Object.entries(TRAIT_SYNERGIES).forEach(([clusterName, cluster]) => {
    const matchingTraits = traits.filter(trait => cluster.traits.includes(trait));

    if (matchingTraits.length >= 2) {
      clusters.push({
        name: clusterName,
        traits: matchingTraits,
        strength: cluster.synergy_strength,
        description: cluster.description,
      });
    }
  });

  return clusters;
}

/**
 * Identify emergent properties from trait combinations
 */
function identifyEmergentProperties(traits) {
  const emergentProperties = [];

  // Leadership emergence
  if (traits.includes('confident') && traits.includes('intelligent') && traits.includes('social')) {
    emergentProperties.push({
      name: 'Natural Leadership',
      description: 'Combination of confidence, intelligence, and social skills creates leadership potential',
      contributingTraits: ['confident', 'intelligent', 'social'],
      strength: 0.8,
    });
  }

  // Emotional intelligence
  if (traits.includes('sensitive') && traits.includes('social') && traits.includes('intelligent')) {
    emergentProperties.push({
      name: 'Emotional Intelligence',
      description: 'Sensitivity combined with social and cognitive abilities creates emotional awareness',
      contributingTraits: ['sensitive', 'social', 'intelligent'],
      strength: 0.7,
    });
  }

  // Resilient adaptability
  if (traits.includes('adaptable') && traits.includes('calm') && traits.includes('intelligent')) {
    emergentProperties.push({
      name: 'Resilient Adaptability',
      description: 'Adaptability with calmness and intelligence creates exceptional resilience',
      contributingTraits: ['adaptable', 'calm', 'intelligent'],
      strength: 0.75,
    });
  }

  // Creative problem solving
  if (traits.includes('curious') && traits.includes('intelligent') && traits.includes('brave')) {
    emergentProperties.push({
      name: 'Creative Problem Solving',
      description: 'Curiosity, intelligence, and bravery combine for innovative solutions',
      contributingTraits: ['curious', 'intelligent', 'brave'],
      strength: 0.65,
    });
  }

  return emergentProperties;
}

/**
 * Create interaction networks
 */
function createInteractionNetworks(traits) {
  const networks = {
    nodes: traits.map(trait => ({ id: trait, type: 'trait' })),
    edges: [],
    clusters: [],
  };

  // Add synergy edges
  const synergies = findTraitSynergies(traits);
  synergies.forEach(synergy => {
    networks.edges.push({
      source: synergy.trait1,
      target: synergy.trait2,
      type: 'synergy',
      strength: synergy.strength,
    });
  });

  // Add conflict edges
  const conflicts = findTraitConflicts(traits);
  conflicts.forEach(conflict => {
    networks.edges.push({
      source: conflict.trait1,
      target: conflict.trait2,
      type: 'conflict',
      strength: conflict.strength,
    });
  });

  return networks;
}

/**
 * Calculate stability metrics
 */
function calculateStabilityMetrics(traits) {
  const synergies = findTraitSynergies(traits);
  const conflicts = findTraitConflicts(traits);

  const synergyRatio = synergies.length / Math.max(1, traits.length);
  const conflictRatio = conflicts.length / Math.max(1, traits.length);

  return {
    synergyRatio,
    conflictRatio,
    stabilityIndex: synergyRatio - conflictRatio,
    coherenceScore: synergyRatio / Math.max(0.1, conflictRatio),
  };
}

/**
 * Calculate complexity score
 */
function calculateComplexityScore(traits, clusters, emergentProperties) {
  const traitComplexity = traits.length * 0.1;
  const clusterComplexity = clusters.length * 0.2;
  const emergentComplexity = emergentProperties.length * 0.3;

  return Math.min(1.0, traitComplexity + clusterComplexity + emergentComplexity);
}

/**
 * Generate stability recommendations
 */
function generateStabilityRecommendations(stability, volatilityRisks) {
  const recommendations = [];

  if (stability < 0.4) {
    recommendations.push('High instability detected - focus on stress reduction and consistent care');
  } else if (stability < 0.6) {
    recommendations.push('Moderate instability - monitor for behavioral changes');
  } else {
    recommendations.push('Good stability - continue current care approach');
  }

  volatilityRisks.forEach(risk => {
    switch (risk) {
      case 'multiple_trait_conflicts':
        recommendations.push('Address trait conflicts through targeted behavioral interventions');
        break;
      case 'high_stress_environment':
        recommendations.push('Reduce environmental stressors and increase calming activities');
        break;
      case 'reactive_temperament':
        recommendations.push('Use gentle, predictable approaches to minimize reactive responses');
        break;
    }
  });

  return recommendations;
}

/**
 * Calculate stability trends
 */
function calculateStabilityTrends(traits) {
  const synergies = findTraitSynergies(traits);
  const conflicts = findTraitConflicts(traits);

  return {
    synergyTrend: synergies.length > 0 ? 'stabilizing' : 'neutral',
    conflictTrend: conflicts.length > 2 ? 'destabilizing' : 'neutral',
    overallTrend: synergies.length > conflicts.length ? 'improving' : 'declining',
  };
}

/**
 * Model interaction evolution over time
 */
function modelInteractionEvolution(traits, timeWindow, ageInDays) {
  const evolution = [];

  // Simulate evolution over time window
  for (let day = 0; day < timeWindow; day += 7) { // Weekly snapshots
    const maturityFactor = Math.min(1.0, (ageInDays + day) / 365); // Maturity over first year
    const synergies = findTraitSynergies(traits);
    const conflicts = findTraitConflicts(traits);

    evolution.push({
      day,
      maturityFactor,
      synergyStrength: synergies.reduce((sum, s) => sum + s.strength, 0) * maturityFactor,
      conflictStrength: conflicts.reduce((sum, c) => sum + c.strength, 0) * (1 - maturityFactor * 0.3),
      stabilityScore: calculateHarmonyScore(
        synergies.reduce((sum, s) => sum + s.strength, 0),
        conflicts.reduce((sum, c) => sum + c.strength, 0),
        traits.length,
      ),
    });
  }

  return evolution;
}

/**
 * Analyze stability trends over time
 */
function analyzeStabilityTrends(traits, timeWindow) {
  const evolution = modelInteractionEvolution(traits, timeWindow, 30); // Assume 30 days old

  if (evolution.length < 2) {
    return { trend: 'insufficient_data', strength: 0 };
  }

  const firstStability = evolution[0].stabilityScore;
  const lastStability = evolution[evolution.length - 1].stabilityScore;
  const change = lastStability - firstStability;

  return {
    trend: change > 0.1 ? 'improving' : change < -0.1 ? 'declining' : 'stable',
    strength: Math.abs(change),
    projectedStability: lastStability,
  };
}

/**
 * Identify emerging patterns
 */
function identifyEmergingPatterns(traits, ageInDays) {
  const patterns = [];

  // Age-based pattern emergence
  if (ageInDays < 30) {
    patterns.push({
      pattern: 'early_development',
      description: 'Traits are still forming and highly malleable',
      confidence: 0.8,
    });
  } else if (ageInDays < 90) {
    patterns.push({
      pattern: 'stabilization_period',
      description: 'Trait interactions are beginning to stabilize',
      confidence: 0.7,
    });
  } else {
    patterns.push({
      pattern: 'mature_expression',
      description: 'Trait interactions have reached mature expression',
      confidence: 0.9,
    });
  }

  // Trait-specific patterns
  if (traits.includes('curious') && traits.includes('intelligent')) {
    patterns.push({
      pattern: 'learning_acceleration',
      description: 'Curiosity and intelligence create accelerated learning potential',
      confidence: 0.75,
    });
  }

  if (traits.includes('social') && traits.includes('confident')) {
    patterns.push({
      pattern: 'leadership_emergence',
      description: 'Social confidence may lead to leadership behaviors',
      confidence: 0.6,
    });
  }

  return patterns;
}

/**
 * Project future changes
 */
function projectFutureChanges(traits, timeWindow) {
  const synergies = findTraitSynergies(traits);
  const conflicts = findTraitConflicts(traits);

  return {
    synergyChanges: {
      expected: synergies.length > 0 ? 'strengthening' : 'stable',
      confidence: 0.6,
      timeframe: `${timeWindow} days`,
    },
    conflictChanges: {
      expected: conflicts.length > 2 ? 'intensifying' : 'stable',
      confidence: 0.5,
      timeframe: `${timeWindow} days`,
    },
    dominanceShifts: {
      expected: 'gradual_stabilization',
      confidence: 0.7,
      description: 'Dominant traits will become more established over time',
    },
    stabilityForecast: {
      expected: synergies.length > conflicts.length ? 'improving' : 'declining',
      confidence: 0.65,
      factors: ['trait_maturation', 'environmental_consistency', 'care_quality'],
    },
  };
}

/**
 * Create matrix visualization data
 */
function createMatrixVisualization(traits, synergies, conflicts) {
  const nodes = traits.map(trait => ({
    id: trait,
    type: 'trait',
    dominance: getTraitDominanceInfo(trait).dominance_score,
  }));

  const edges = [];

  // Add synergy edges
  synergies.synergyPairs.forEach(synergy => {
    edges.push({
      source: synergy.trait1,
      target: synergy.trait2,
      type: 'synergy',
      strength: synergy.strength,
      color: 'green',
    });
  });

  // Add conflict edges
  conflicts.conflictPairs.forEach(conflict => {
    edges.push({
      source: conflict.trait1,
      target: conflict.trait2,
      type: 'conflict',
      strength: conflict.strength,
      color: 'red',
    });
  });

  // Identify clusters for visualization
  const clusters = identifyTraitClusters(traits);

  return {
    nodes,
    edges,
    clusters: clusters.map(cluster => ({
      name: cluster.name,
      traits: cluster.traits,
      color: getClusterColor(cluster.name),
    })),
  };
}

/**
 * Get cluster color for visualization
 */
function getClusterColor(clusterName) {
  const colors = {
    confidence_cluster: '#4CAF50',
    intelligence_cluster: '#2196F3',
    stability_cluster: '#9C27B0',
    social_cluster: '#FF9800',
    sensitivity_cluster: '#607D8B',
  };

  return colors[clusterName] || '#757575';
}
