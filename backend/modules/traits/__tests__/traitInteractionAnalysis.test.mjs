/**
 * Pure trait interaction analysis (Equoria-q4uem.5).
 *
 * analyzeTraitSnapshot takes a plain horse snapshot and a clock and returns
 * every analysis section. No database: these tests build snapshots as object
 * literals, which is exactly what the loader hands the analyzer in production.
 */

import { describe, it, expect } from '@jest/globals';
import { analyzeTraitSnapshot } from '../services/traitInteractionMatrix.mjs';

const NOW = new Date('2026-06-01T12:00:00Z');

function snapshot(overrides = {}) {
  return Object.freeze({
    id: 41,
    epigeneticFlags: Object.freeze(['brave', 'confident', 'fearful']),
    stressLevel: 2,
    bondScore: 50,
    // 90 whole UTC days before NOW: the module's maturity boundary.
    dateOfBirth: new Date('2026-03-03T00:00:00Z'),
    ...overrides,
  });
}

describe('analyzeTraitSnapshot', () => {
  it('derives every section from the one snapshot and stamps all of them with the same clock', () => {
    const matrix = analyzeTraitSnapshot(snapshot(), { now: NOW });

    expect(matrix.horseId).toBe(41);
    const sections = [
      matrix.traitInteractions,
      matrix.synergies,
      matrix.conflicts,
      matrix.dominance,
      matrix.complexInteractions,
      matrix.stability,
      matrix.temporalModel,
    ];
    for (const section of sections) {
      expect(section.horseId).toBe(41);
      expect(section.analysisTimestamp).toBe(NOW);
    }
    expect(matrix.analysisTimestamp).toBe(NOW);
  });

  it('works on a frozen snapshot, does not mutate it, and returns a frozen trait list', () => {
    const input = snapshot();
    const matrix = analyzeTraitSnapshot(input, { now: NOW });

    expect(input.epigeneticFlags).toEqual(['brave', 'confident', 'fearful']);
    expect(Object.isFrozen(matrix.traitInteractions.traits)).toBe(true);
    expect(matrix.traitInteractions.traits).toEqual(['brave', 'confident', 'fearful']);
  });

  it('finds cluster synergies and their amplification effects', () => {
    const { synergies, traitInteractions } = analyzeTraitSnapshot(snapshot(), { now: NOW });

    expect(synergies.synergyPairs).toEqual([
      {
        trait1: 'brave',
        trait2: 'confident',
        strength: 0.8,
        amplificationFactor: 1.3,
        category: 'confidence_cluster',
        description: 'Confidence and social traits reinforce each other',
      },
    ]);
    expect(traitInteractions.synergies).toEqual(synergies.synergyPairs);
    expect(synergies.totalSynergyStrength).toBeCloseTo(0.8, 10);
    expect(synergies.amplificationEffects.brave).toEqual({
      baseStrength: 1,
      amplifiedStrength: 1.3,
      amplificationFactor: 1.3,
      synergyCount: 1,
    });
    expect(Object.keys(synergies.synergyCategories)).toEqual(['confidence_cluster']);
  });

  it('finds conflicting pairs and compounds suppression per trait', () => {
    const { conflicts } = analyzeTraitSnapshot(snapshot(), { now: NOW });

    expect(conflicts.conflictPairs.map(c => [c.trait1, c.trait2])).toEqual([
      ['fearful', 'brave'],
      ['fearful', 'confident'],
    ]);
    expect(conflicts.totalConflictStrength).toBeCloseTo(1.8, 10);
    expect(conflicts.suppressionEffects.fearful.conflictCount).toBe(2);
    expect(conflicts.suppressionEffects.fearful.suppressionFactor).toBeCloseTo(0.36, 10);
    expect(conflicts.suppressionEffects.brave.suppressedStrength).toBeCloseTo(0.6, 10);
  });

  it('scores harmony and interaction strength from synergies against conflicts', () => {
    const { traitInteractions } = analyzeTraitSnapshot(snapshot(), { now: NOW });

    expect(traitInteractions.overallHarmony).toBeCloseTo((0.8 / 3 - 1.8 / 3 + 1) / 2, 10);
    expect(traitInteractions.interactionStrength).toBeCloseTo(2.6 / 3, 10);
    expect(traitInteractions.dominantTraits.map(t => t.trait)).toEqual(['brave', 'confident']);
  });

  it('modulates dominance by stress and bond from the snapshot', () => {
    const { dominance } = analyzeTraitSnapshot(snapshot(), { now: NOW });

    expect(dominance.dominanceHierarchy.map(t => [t.trait, t.environmentalModifier])).toEqual([
      ['brave', 0.94],
      ['confident', 0.94],
      ['fearful', 1.1],
    ]);
    expect(dominance.primaryTrait.trait).toBe('brave');
    expect(dominance.primaryTrait.dominanceScore).toBeCloseTo(0.846, 10);

    const bonded = analyzeTraitSnapshot(snapshot({ epigeneticFlags: ['social'], stressLevel: 0, bondScore: 80 }), {
      now: NOW,
    });
    // (80 - 20) * 0.01 = +0.6, clamped to the 1.5 ceiling.
    expect(bonded.dominance.primaryTrait.environmentalModifier).toBe(1.5);
  });

  it('assesses stability from conflicts, stress and bond', () => {
    const calm = analyzeTraitSnapshot(snapshot(), { now: NOW }).stability;
    expect(calm.overallStability).toBeCloseTo(0.5, 10);
    expect(calm.stabilityFactors).toEqual(['trait_synergies', 'strong_bonding', 'low_stress']);
    expect(calm.volatilityRisks).toEqual([]);
    expect(calm.recommendations).toEqual(['Moderate instability - monitor for behavioral changes']);

    const stressed = analyzeTraitSnapshot(
      snapshot({
        epigeneticFlags: ['fearful', 'brave', 'reactive', 'calm', 'social', 'antisocial'],
        stressLevel: 9,
        bondScore: 2,
      }),
      { now: NOW },
    ).stability;
    expect(stressed.overallStability).toBeCloseTo(0.8 - 0.3 - 0.45, 10);
    expect(stressed.stabilityFactors).toEqual(['trait_synergies']);
    expect(stressed.volatilityRisks).toEqual([
      'multiple_trait_conflicts',
      'high_stress_environment',
      'reactive_temperament',
    ]);
    expect(stressed.recommendations).toHaveLength(4);
  });

  it('models temporal evolution from the age at the analysis clock and the requested window', () => {
    const { temporalModel } = analyzeTraitSnapshot(snapshot(), { now: NOW, timeWindow: 60 });

    expect(temporalModel.timeWindow).toBe(60);
    expect(temporalModel.interactionEvolution.map(step => step.day)).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56]);
    expect(temporalModel.interactionEvolution[0].maturityFactor).toBe(1);
    expect(temporalModel.emergingPatterns[0].pattern).toBe('mature_expression');
    expect(temporalModel.projectedChanges.synergyChanges.timeframe).toBe('60 days');

    const dayBefore = analyzeTraitSnapshot(snapshot(), {
      now: new Date('2026-05-31T12:00:00Z'),
    }).temporalModel;
    expect(dayBefore.timeWindow).toBe(30);
    expect(dayBefore.emergingPatterns[0].pattern).toBe('stabilization_period');
    expect(dayBefore.interactionEvolution[0].maturityFactor).toBeCloseTo(89 / 90, 10);
  });

  it('builds clusters, emergent properties and visualization from the same trait list', () => {
    const traits = ['confident', 'intelligent', 'social', 'curious', 'brave'];
    const matrix = analyzeTraitSnapshot(snapshot({ epigeneticFlags: traits }), { now: NOW });

    expect(matrix.complexInteractions.traitClusters.map(c => c.name)).toEqual([
      'confidence_cluster',
      'intelligence_cluster',
    ]);
    expect(matrix.complexInteractions.emergentProperties.map(p => p.name)).toEqual([
      'Natural Leadership',
      'Creative Problem Solving',
    ]);
    expect(matrix.complexInteractions.complexityScore).toBe(1);
    expect(matrix.matrixVisualization.clusters).toEqual([
      { name: 'confidence_cluster', traits: ['confident', 'social', 'brave'], color: '#4CAF50' },
      { name: 'intelligence_cluster', traits: ['intelligent', 'curious'], color: '#2196F3' },
    ]);
    expect(matrix.matrixVisualization.nodes.map(n => n.id)).toEqual(traits);
    expect(matrix.summary).toEqual({
      totalTraits: 5,
      synergyCount: 4,
      conflictCount: 0,
      overallHarmony: matrix.traitInteractions.overallHarmony,
      complexityScore: 1,
      stabilityScore: matrix.stability.overallStability,
      dominantTrait: 'intelligent',
    });
  });

  it('returns the neutral analysis for a horse with no traits', () => {
    const matrix = analyzeTraitSnapshot(snapshot({ epigeneticFlags: [] }), { now: NOW });

    expect(matrix.traitInteractions).toEqual({
      horseId: 41,
      traits: [],
      synergies: [],
      conflicts: [],
      overallHarmony: 0.5,
      dominantTraits: [],
      interactionStrength: 0,
      analysisTimestamp: NOW,
    });
    expect(matrix.dominance.primaryTrait).toBeNull();
    expect(matrix.summary.dominantTrait).toBe('none');
    expect(matrix.matrixVisualization).toEqual({ nodes: [], edges: [], clusters: [] });
  });
});
