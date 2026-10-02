/**
 * Trait Interaction Matrix Service
 *
 * Analyzes how a horse's epigenetic traits interact: synergies that amplify,
 * conflicts that suppress, dominance shaped by stress and bond, stability, and
 * how the interactions evolve as the horse matures.
 *
 * Shape (Equoria-q4uem.5): the database is a thin seam and the analysis is
 * pure. loadTraitAnalysisSnapshot() reads the horse ONCE into a frozen
 * snapshot; analyzeTraitSnapshot() derives every section from that snapshot
 * and one clock, so all sections of a response describe the same horse state
 * and carry the same analysisTimestamp. Callers that need a subset call
 * generateInteractionMatrix() and pick the sections they need.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { NotFoundError } from '../../../errors/index.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import {
  MATURITY_PERIOD_DAYS,
  TRAIT_SYNERGIES,
  TRAIT_CONFLICTS,
  TRAIT_DOMINANCE,
  UNKNOWN_TRAIT_DOMINANCE,
  EMERGENT_PROPERTIES,
  TRAIT_PATTERNS,
} from './traitInteractionRules.mjs';

const RISK_RECOMMENDATIONS = {
  multiple_trait_conflicts: 'Address trait conflicts through targeted behavioral interventions',
  high_stress_environment: 'Reduce environmental stressors and increase calming activities',
  reactive_temperament: 'Use gentle, predictable approaches to minimize reactive responses',
};

/**
 * Read the horse state every trait analysis needs, once.
 * @param {number} horseId
 * @param {object} [client] Prisma client (or transaction client)
 * @returns {Promise<Readonly<{id, epigeneticFlags, stressLevel, bondScore, dateOfBirth}>>}
 * @throws {NotFoundError} when the horse does not exist
 */
export async function loadTraitAnalysisSnapshot(horseId, client = prisma) {
  const horse = await client.horse.findUnique({
    where: { id: horseId },
    select: {
      id: true,
      epigeneticFlags: true,
      stressLevel: true,
      bondScore: true,
      dateOfBirth: true,
    },
  });
  if (!horse) {
    throw new NotFoundError('Horse', horseId);
  }
  return Object.freeze({ ...horse, epigeneticFlags: Object.freeze([...horse.epigeneticFlags]) });
}

/**
 * Analyze trait interactions from one snapshot and one clock. Pure.
 * @param {{id, epigeneticFlags, stressLevel, bondScore, dateOfBirth}} snapshot
 * @param {{timeWindow?: number, now?: Date}} [options] timeWindow in days (default 30)
 * @returns {object} Complete interaction matrix; every section shares analysisTimestamp
 */
export function analyzeTraitSnapshot(snapshot, { timeWindow = 30, now = new Date() } = {}) {
  const horseId = snapshot.id;
  const traits = Object.freeze([...snapshot.epigeneticFlags]);
  const synergyPairs = findTraitSynergies(traits);
  const conflictPairs = findTraitConflicts(traits);
  const synergyScore = sumStrength(synergyPairs);
  const conflictScore = sumStrength(conflictPairs);
  const harmony = calculateHarmonyScore(synergyScore, conflictScore, traits.length);
  const traitClusters = identifyTraitClusters(traits);
  const counts = { synergies: synergyPairs.length, conflicts: conflictPairs.length };

  const traitInteractions = {
    horseId,
    traits,
    synergies: synergyPairs,
    conflicts: conflictPairs,
    overallHarmony: harmony,
    dominantTraits: identifyDominantTraits(traits),
    interactionStrength: traits.length === 0 ? 0 : (synergyScore + conflictScore) / traits.length,
    analysisTimestamp: now,
  };

  const amplification = compoundPairEffects(synergyPairs, {
    factor: 'amplificationFactor',
    strength: 'amplifiedStrength',
    count: 'synergyCount',
  });
  const synergies = {
    horseId,
    synergyPairs,
    totalSynergyStrength: synergyScore,
    amplificationEffects: amplification.effects,
    synergyCategories: amplification.categories,
    analysisTimestamp: now,
  };

  const suppression = compoundPairEffects(conflictPairs, {
    factor: 'suppressionFactor',
    strength: 'suppressedStrength',
    count: 'conflictCount',
  });
  const conflicts = {
    horseId,
    conflictPairs,
    totalConflictStrength: conflictScore,
    suppressionEffects: suppression.effects,
    conflictCategories: suppression.categories,
    analysisTimestamp: now,
  };

  const dominance = { horseId, ...evaluateDominance(snapshot, traits), analysisTimestamp: now };

  const emergentProperties = identifyEmergentProperties(traits);
  const complexInteractions = {
    horseId,
    traitClusters,
    emergentProperties,
    interactionNetworks: {
      nodes: traits.map(trait => ({ id: trait, type: 'trait' })),
      edges: [
        ...synergyPairs.map(pair => pairEdge(pair, 'synergy')),
        ...conflictPairs.map(pair => pairEdge(pair, 'conflict')),
      ],
      clusters: [],
    },
    stabilityMetrics: calculateStabilityMetrics(counts, traits.length),
    complexityScore: Math.min(
      1.0,
      traits.length * 0.1 + traitClusters.length * 0.2 + emergentProperties.length * 0.3,
    ),
    analysisTimestamp: now,
  };

  const stability = {
    horseId,
    ...assessStability(snapshot, traits, counts),
    analysisTimestamp: now,
  };

  const ageInDays = getHorseAgeDays(snapshot.dateOfBirth, now);
  const interactionEvolution = modelInteractionEvolution(timeWindow, ageInDays, {
    synergyScore,
    conflictScore,
    harmony,
  });
  const temporalModel = {
    horseId,
    timeWindow,
    interactionEvolution,
    stabilityTrends: analyzeStabilityTrends(interactionEvolution),
    emergingPatterns: identifyEmergingPatterns(traits, ageInDays),
    projectedChanges: projectFutureChanges(counts, timeWindow),
    analysisTimestamp: now,
  };

  const matrixVisualization = {
    nodes: traits.map(trait => ({
      id: trait,
      type: 'trait',
      dominance: getTraitDominanceInfo(trait).dominance_score,
    })),
    edges: [
      ...synergyPairs.map(pair => ({ ...pairEdge(pair, 'synergy'), color: 'green' })),
      ...conflictPairs.map(pair => ({ ...pairEdge(pair, 'conflict'), color: 'red' })),
    ],
    clusters: traitClusters.map(cluster => ({
      name: cluster.name,
      traits: cluster.traits,
      color: TRAIT_SYNERGIES[cluster.name].color,
    })),
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
    summary: {
      totalTraits: traits.length,
      synergyCount: counts.synergies,
      conflictCount: counts.conflicts,
      overallHarmony: harmony,
      complexityScore: complexInteractions.complexityScore,
      stabilityScore: stability.overallStability,
      dominantTrait: dominance.primaryTrait?.trait || 'none',
    },
    analysisTimestamp: now,
  };
}

/**
 * Load the horse once and analyze it.
 * @param {number} horseId
 * @param {{timeWindow?: number, now?: Date, client?: object}} [options]
 * @returns {Promise<object>} See analyzeTraitSnapshot
 * @throws {NotFoundError} when the horse does not exist
 */
export async function generateInteractionMatrix(horseId, options = {}) {
  const snapshot = await loadTraitAnalysisSnapshot(horseId, options.client);
  return analyzeTraitSnapshot(snapshot, options);
}

function sumStrength(pairs) {
  return pairs.reduce((sum, pair) => sum + pair.strength, 0);
}

function pairEdge(pair, type) {
  return { source: pair.trait1, target: pair.trait2, type, strength: pair.strength };
}

/** Pairs within each synergy cluster that the horse carries. */
function findTraitSynergies(traits) {
  const synergies = [];
  for (const cluster of identifyTraitClusters(traits)) {
    const definition = TRAIT_SYNERGIES[cluster.name];
    for (let i = 0; i < cluster.traits.length; i++) {
      for (let j = i + 1; j < cluster.traits.length; j++) {
        synergies.push({
          trait1: cluster.traits[i],
          trait2: cluster.traits[j],
          strength: definition.synergy_strength,
          amplificationFactor: definition.amplification_factor,
          category: cluster.name,
          description: definition.description,
        });
      }
    }
  }
  return synergies;
}

/** Defined conflicting pairs that the horse carries both halves of. */
function findTraitConflicts(traits) {
  const conflicts = [];
  for (const [category, conflict] of Object.entries(TRAIT_CONFLICTS)) {
    for (const [trait1, trait2] of conflict.trait_pairs) {
      if (traits.includes(trait1) && traits.includes(trait2)) {
        conflicts.push({
          trait1,
          trait2,
          strength: conflict.conflict_strength,
          suppressionFactor: conflict.suppression_factor,
          category,
          description: conflict.description,
        });
      }
    }
  }
  return conflicts;
}

/** Synergy clusters with at least two of the horse's traits. */
function identifyTraitClusters(traits) {
  const clusters = [];
  for (const [name, cluster] of Object.entries(TRAIT_SYNERGIES)) {
    const matchingTraits = traits.filter(trait => cluster.traits.includes(trait));
    if (matchingTraits.length >= 2) {
      clusters.push({
        name,
        traits: matchingTraits,
        strength: cluster.synergy_strength,
        description: cluster.description,
      });
    }
  }
  return clusters;
}

/**
 * Per-trait compounded effect of every pair the trait belongs to, plus the
 * pairs grouped by category. Synergies amplify; conflicts suppress.
 */
function compoundPairEffects(pairs, keys) {
  const effects = {};
  const categories = {};
  for (const pair of pairs) {
    for (const trait of [pair.trait1, pair.trait2]) {
      effects[trait] ??= {
        baseStrength: 1.0,
        [keys.strength]: 1.0,
        [keys.factor]: 1.0,
        [keys.count]: 0,
      };
      const effect = effects[trait];
      effect[keys.factor] *= pair[keys.factor];
      effect[keys.strength] = effect.baseStrength * effect[keys.factor];
      effect[keys.count]++;
    }
    (categories[pair.category] ??= []).push(pair);
  }
  return { effects, categories };
}

function getTraitDominanceInfo(trait) {
  for (const [level, info] of Object.entries(TRAIT_DOMINANCE)) {
    if (info.traits.includes(trait)) {
      return { dominance_score: info.dominance_score, level, description: info.description };
    }
  }
  return UNKNOWN_TRAIT_DOMINANCE;
}

/** Traits whose base dominance is above moderate, strongest first. */
function identifyDominantTraits(traits) {
  return traits
    .map(trait => {
      const info = getTraitDominanceInfo(trait);
      return { trait, dominanceScore: info.dominance_score, dominanceLevel: info.level };
    })
    .filter(t => t.dominanceScore > 0.6)
    .sort((a, b) => b.dominanceScore - a.dominanceScore);
}

/** Stress strengthens negative traits and weakens positive ones; bond lifts social traits. */
function calculateEnvironmentalDominanceModifier(snapshot, trait) {
  let modifier = 1.0;
  if (['fearful', 'reactive', 'fragile'].includes(trait)) {
    modifier += snapshot.stressLevel * 0.05;
  } else if (['brave', 'confident', 'calm'].includes(trait)) {
    modifier -= snapshot.stressLevel * 0.03;
  }
  if (['social', 'affectionate', 'trusting'].includes(trait)) {
    modifier += (snapshot.bondScore - 20) * 0.01;
  }
  return Math.max(0.5, Math.min(1.5, modifier));
}

function evaluateDominance(snapshot, traits) {
  const dominanceHierarchy = traits
    .map(trait => {
      const info = getTraitDominanceInfo(trait);
      const environmentalModifier = calculateEnvironmentalDominanceModifier(snapshot, trait);
      return {
        trait,
        baseDominanceScore: info.dominance_score,
        environmentalModifier,
        dominanceScore: info.dominance_score * environmentalModifier,
        dominanceLevel: info.level,
        description: info.description,
      };
    })
    .sort((a, b) => b.dominanceScore - a.dominanceScore);

  return {
    dominanceHierarchy,
    primaryTrait: dominanceHierarchy[0] || null,
    secondaryTraits: dominanceHierarchy.slice(1, 3),
    recessiveTraits: dominanceHierarchy.slice(3),
    // NaN (null on the wire) for a horse with no traits — pinned behaviour.
    dominanceStrength:
      dominanceHierarchy.reduce((sum, t) => sum + t.dominanceScore, 0) / traits.length,
  };
}

/** Balance between synergies and conflicts, normalized per trait to 0..1. */
function calculateHarmonyScore(synergyScore, conflictScore, traitCount) {
  if (traitCount === 0) {
    return 0.5;
  }
  const harmony = (synergyScore / traitCount - conflictScore / traitCount + 1) / 2;
  return Math.max(0, Math.min(1, harmony));
}

function identifyEmergentProperties(traits) {
  return EMERGENT_PROPERTIES.filter(property =>
    property.contributingTraits.every(trait => traits.includes(trait)),
  ).map(property => ({ ...property, contributingTraits: [...property.contributingTraits] }));
}

function calculateStabilityMetrics(counts, traitCount) {
  const synergyRatio = counts.synergies / Math.max(1, traitCount);
  const conflictRatio = counts.conflicts / Math.max(1, traitCount);
  return {
    synergyRatio,
    conflictRatio,
    stabilityIndex: synergyRatio - conflictRatio,
    coherenceScore: synergyRatio / Math.max(0.1, conflictRatio),
  };
}

function assessStability(snapshot, traits, counts) {
  const synergyStability = counts.synergies > 0 ? 0.8 : 0.5;
  const overallStability = Math.max(
    0,
    Math.min(1, synergyStability - counts.conflicts * 0.1 - snapshot.stressLevel * 0.05),
  );

  const stabilityFactors = [];
  if (counts.synergies > 0) {
    stabilityFactors.push('trait_synergies');
  }
  if (snapshot.bondScore > 30) {
    stabilityFactors.push('strong_bonding');
  }
  if (snapshot.stressLevel < 4) {
    stabilityFactors.push('low_stress');
  }

  const volatilityRisks = [];
  if (counts.conflicts > 2) {
    volatilityRisks.push('multiple_trait_conflicts');
  }
  if (snapshot.stressLevel > 7) {
    volatilityRisks.push('high_stress_environment');
  }
  if (traits.includes('reactive')) {
    volatilityRisks.push('reactive_temperament');
  }

  let baseline = 'Good stability - continue current care approach';
  if (overallStability < 0.4) {
    baseline = 'High instability detected - focus on stress reduction and consistent care';
  } else if (overallStability < 0.6) {
    baseline = 'Moderate instability - monitor for behavioral changes';
  }

  return {
    overallStability,
    stabilityFactors,
    volatilityRisks,
    stabilityTrends: {
      synergyTrend: counts.synergies > 0 ? 'stabilizing' : 'neutral',
      conflictTrend: counts.conflicts > 2 ? 'destabilizing' : 'neutral',
      overallTrend: counts.synergies > counts.conflicts ? 'improving' : 'declining',
    },
    recommendations: [baseline, ...volatilityRisks.map(risk => RISK_RECOMMENDATIONS[risk])],
  };
}

/** Weekly snapshots across the window as the horse matures. */
function modelInteractionEvolution(
  timeWindow,
  ageInDays,
  { synergyScore, conflictScore, harmony },
) {
  const evolution = [];
  for (let day = 0; day < timeWindow; day += 7) {
    const maturityFactor = Math.min(1.0, (ageInDays + day) / MATURITY_PERIOD_DAYS);
    evolution.push({
      day,
      maturityFactor,
      synergyStrength: synergyScore * maturityFactor,
      conflictStrength: conflictScore * (1 - maturityFactor * 0.3),
      stabilityScore: harmony,
    });
  }
  return evolution;
}

function analyzeStabilityTrends(evolution) {
  if (evolution.length < 2) {
    return { trend: 'insufficient_data', strength: 0 };
  }
  const lastStability = evolution[evolution.length - 1].stabilityScore;
  const change = lastStability - evolution[0].stabilityScore;
  return {
    trend: change > 0.1 ? 'improving' : change < -0.1 ? 'declining' : 'stable',
    strength: Math.abs(change),
    projectedStability: lastStability,
  };
}

function identifyEmergingPatterns(traits, ageInDays) {
  let stage = {
    pattern: 'mature_expression',
    description: 'Trait interactions have reached mature expression',
    confidence: 0.9,
  };
  if (ageInDays < 30) {
    stage = {
      pattern: 'early_development',
      description: 'Traits are still forming and highly malleable',
      confidence: 0.8,
    };
  } else if (ageInDays < MATURITY_PERIOD_DAYS) {
    stage = {
      pattern: 'stabilization_period',
      description: 'Trait interactions are beginning to stabilize',
      confidence: 0.7,
    };
  }
  const traitPatterns = TRAIT_PATTERNS.filter(entry =>
    entry.requires.every(trait => traits.includes(trait)),
  ).map(({ pattern, description, confidence }) => ({ pattern, description, confidence }));
  return [stage, ...traitPatterns];
}

function projectFutureChanges(counts, timeWindow) {
  return {
    synergyChanges: {
      expected: counts.synergies > 0 ? 'strengthening' : 'stable',
      confidence: 0.6,
      timeframe: `${timeWindow} days`,
    },
    conflictChanges: {
      expected: counts.conflicts > 2 ? 'intensifying' : 'stable',
      confidence: 0.5,
      timeframe: `${timeWindow} days`,
    },
    dominanceShifts: {
      expected: 'gradual_stabilization',
      confidence: 0.7,
      description: 'Dominant traits will become more established over time',
    },
    stabilityForecast: {
      expected: counts.synergies > counts.conflicts ? 'improving' : 'declining',
      confidence: 0.65,
      factors: ['trait_maturation', 'environmental_consistency', 'care_quality'],
    },
  };
}
