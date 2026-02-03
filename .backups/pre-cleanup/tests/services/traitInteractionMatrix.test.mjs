/**
 * Trait Interaction Matrix Tests
 *
 * Tests complex trait interaction system with synergies and conflicts.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Trait synergy detection and amplification effects
 * - Trait conflict identification and suppression effects
 * - Complex multi-trait interaction calculations
 * - Trait dominance hierarchies and expression priorities
 * - Interaction strength calculations based on trait combinations
 * - Temporal trait interaction effects over time
 * - Environmental modulation of trait interactions
 * - Trait stability and volatility in interaction contexts
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  analyzeTraitInteractions,
  calculateTraitSynergies,
  identifyTraitConflicts,
  evaluateTraitDominance,
  processComplexInteractions,
  assessInteractionStability,
  modelTemporalInteractions,
  generateInteractionMatrix,
} from '../../services/traitInteractionMatrix.mjs';

describe('Trait Interaction Matrix', () => {
  let testUser;
  let testHorses = [];

  const createTraitTestData = async () => {
    const testSuffix = `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    testUser = await prisma.user.create({
      data: {
        username: `trait_matrix_${testSuffix}`,
        email: `trait_matrix_${testSuffix}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      prisma.horse.create({
        data: {
          name: `Test Horse Synergistic ${testSuffix}`,
          sex: 'filly',
          dateOfBirth: oneMonthAgo,
          user: { connect: { id: testUser.id } },
          bondScore: 35,
          stressLevel: 3,
          epigeneticFlags: ['brave', 'confident', 'social'],
        },
      }),
      prisma.horse.create({
        data: {
          name: `Test Horse Conflicting ${testSuffix}`,
          sex: 'colt',
          dateOfBirth: oneMonthAgo,
          user: { connect: { id: testUser.id } },
          bondScore: 20,
          stressLevel: 6,
          epigeneticFlags: ['fearful', 'brave', 'reactive', 'calm'],
        },
      }),
      prisma.horse.create({
        data: {
          name: `Test Horse Complex ${testSuffix}`,
          sex: 'gelding',
          dateOfBirth: oneMonthAgo,
          user: { connect: { id: testUser.id } },
          bondScore: 28,
          stressLevel: 5,
          epigeneticFlags: ['curious', 'intelligent', 'fragile', 'social'],
        },
      }),
      prisma.horse.create({
        data: {
          name: `Test Horse Minimal ${testSuffix}`,
          sex: 'filly',
          dateOfBirth: oneMonthAgo,
          user: { connect: { id: testUser.id } },
          bondScore: 15,
          stressLevel: 7,
          epigeneticFlags: ['developing'],
        },
      }),
      prisma.horse.create({
        data: {
          name: `Test Horse Dominant ${testSuffix}`,
          sex: 'colt',
          dateOfBirth: oneMonthAgo,
          user: { connect: { id: testUser.id } },
          bondScore: 40,
          stressLevel: 2,
          epigeneticFlags: ['confident', 'brave', 'intelligent', 'social', 'curious'],
        },
      }),
    ]);
  };

  const ensureTraitTestData = async () => {
    const cleanupCurrentData = async () => {
      if (testHorses.length) {
        await prisma.horse.deleteMany({
          where: { id: { in: testHorses.map((horse) => horse.id) } },
        });
      }
      if (testUser) {
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      }
      testHorses = [];
      testUser = null;
    };

    if (!testUser || !testHorses.length) {
      await createTraitTestData();
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { id: true },
    });

    if (!existingUser) {
      await cleanupCurrentData();
      await createTraitTestData();
      return;
    }

    const horseCount = await prisma.horse.count({
      where: { id: { in: testHorses.map((horse) => horse.id) } },
    });

    if (horseCount !== testHorses.length) {
      await cleanupCurrentData();
      await createTraitTestData();
    }
  };

  beforeAll(async () => {
    await createTraitTestData();
  });

  beforeEach(async () => {
    await ensureTraitTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.horse.deleteMany({
      where: { id: { in: testHorses.map((h) => h.id) } },
    });
    await prisma.user.deleteMany({ where: { id: testUser?.id } });
  });

  describe('analyzeTraitInteractions', () => {
    test('should analyze trait interactions for synergistic traits', async () => {
      const [synergisticHorse] = testHorses; // brave + confident + social

      const interactions = await analyzeTraitInteractions(synergisticHorse.id);

      expect(interactions).toBeDefined();
      expect(interactions.horseId).toBe(synergisticHorse.id);
      expect(interactions.traits).toBeDefined();
      expect(Array.isArray(interactions.traits)).toBe(true);
      expect(interactions.synergies).toBeDefined();
      expect(Array.isArray(interactions.synergies)).toBe(true);
      expect(interactions.conflicts).toBeDefined();
      expect(Array.isArray(interactions.conflicts)).toBe(true);
      expect(interactions.overallHarmony).toBeDefined();
      expect(interactions.dominantTraits).toBeDefined();
      expect(interactions.interactionStrength).toBeDefined();

      // Should detect synergies between brave, confident, and social
      expect(interactions.synergies.length).toBeGreaterThan(0);
      expect(interactions.overallHarmony).toBeGreaterThan(0.6);
    });

    test('should analyze trait interactions for conflicting traits', async () => {
      const conflictingHorse = testHorses[1]; // fearful + brave + reactive + calm

      const interactions = await analyzeTraitInteractions(conflictingHorse.id);

      expect(interactions.conflicts.length).toBeGreaterThan(0);
      expect(interactions.overallHarmony).toBeLessThan(0.5);

      // Should detect conflicts between opposing traits
      const conflictTraits = interactions.conflicts.flatMap((c) => [c.trait1, c.trait2]);
      expect(conflictTraits).toContain('fearful');
      expect(conflictTraits).toContain('brave');
    });

    test('should handle horses with minimal traits', async () => {
      const minimalHorse = testHorses[3]; // only developing

      const interactions = await analyzeTraitInteractions(minimalHorse.id);

      expect(interactions.traits.length).toBeLessThanOrEqual(1);
      expect(interactions.synergies.length).toBe(0);
      expect(interactions.conflicts.length).toBe(0);
      expect(interactions.overallHarmony).toBeGreaterThanOrEqual(0.5); // Neutral harmony
    });
  });

  describe('calculateTraitSynergies', () => {
    test('should calculate synergies for compatible traits', async () => {
      const [synergisticHorse] = testHorses;

      const synergies = await calculateTraitSynergies(synergisticHorse.id);

      expect(synergies).toBeDefined();
      expect(synergies.horseId).toBe(synergisticHorse.id);
      expect(synergies.synergyPairs).toBeDefined();
      expect(Array.isArray(synergies.synergyPairs)).toBe(true);
      expect(synergies.totalSynergyStrength).toBeDefined();
      expect(synergies.amplificationEffects).toBeDefined();
      expect(synergies.synergyCategories).toBeDefined();

      expect(synergies.synergyPairs.length).toBeGreaterThan(0);
      expect(synergies.totalSynergyStrength).toBeGreaterThan(0);

      // Should find synergies between confidence-related traits
      const confidenceTraits = ['brave', 'confident', 'social'];
      const foundSynergies = synergies.synergyPairs.some(
        (pair) => confidenceTraits.includes(pair.trait1) && confidenceTraits.includes(pair.trait2)
      );
      expect(foundSynergies).toBe(true);
    });

    test('should calculate amplification effects correctly', async () => {
      const dominantHorse = testHorses[4]; // Multiple strong traits

      const synergies = await calculateTraitSynergies(dominantHorse.id);

      expect(synergies.amplificationEffects).toBeDefined();
      expect(Object.keys(synergies.amplificationEffects).length).toBeGreaterThan(0);

      // Should show amplification for traits with synergies
      Object.values(synergies.amplificationEffects).forEach((effect) => {
        expect(effect.baseStrength).toBeDefined();
        expect(effect.amplifiedStrength).toBeDefined();
        expect(effect.amplificationFactor).toBeDefined();
        expect(effect.amplifiedStrength).toBeGreaterThanOrEqual(effect.baseStrength);
      });
    });

    test('should categorize synergies by type', async () => {
      const complexHorse = testHorses[2]; // curious + intelligent + fragile + social

      const synergies = await calculateTraitSynergies(complexHorse.id);

      expect(synergies.synergyCategories).toBeDefined();
      expect(typeof synergies.synergyCategories).toBe('object');

      // Should categorize synergies appropriately
      const categories = Object.keys(synergies.synergyCategories);
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('identifyTraitConflicts', () => {
    test('should identify conflicts between opposing traits', async () => {
      const conflictingHorse = testHorses[1]; // fearful + brave + reactive + calm

      const conflicts = await identifyTraitConflicts(conflictingHorse.id);

      expect(conflicts).toBeDefined();
      expect(conflicts.horseId).toBe(conflictingHorse.id);
      expect(conflicts.conflictPairs).toBeDefined();
      expect(Array.isArray(conflicts.conflictPairs)).toBe(true);
      expect(conflicts.totalConflictStrength).toBeDefined();
      expect(conflicts.suppressionEffects).toBeDefined();
      expect(conflicts.conflictCategories).toBeDefined();

      expect(conflicts.conflictPairs.length).toBeGreaterThan(0);
      expect(conflicts.totalConflictStrength).toBeGreaterThan(0);

      // Should identify specific conflicts
      const conflictTypes = conflicts.conflictPairs.map((pair) => `${pair.trait1}-${pair.trait2}`);
      const hasOpposingConflict = conflictTypes.some(
        (type) =>
          (type.includes('fearful') && type.includes('brave')) ||
          (type.includes('reactive') && type.includes('calm'))
      );
      expect(hasOpposingConflict).toBe(true);
    });

    test('should calculate suppression effects', async () => {
      const conflictingHorse = testHorses[1];

      const conflicts = await identifyTraitConflicts(conflictingHorse.id);

      expect(conflicts.suppressionEffects).toBeDefined();

      // Should show suppression for conflicting traits
      Object.values(conflicts.suppressionEffects).forEach((effect) => {
        expect(effect.baseStrength).toBeDefined();
        expect(effect.suppressedStrength).toBeDefined();
        expect(effect.suppressionFactor).toBeDefined();
        expect(effect.suppressedStrength).toBeLessThanOrEqual(effect.baseStrength);
      });
    });

    test('should handle horses with no conflicts', async () => {
      const [synergisticHorse] = testHorses; // Only compatible traits

      const conflicts = await identifyTraitConflicts(synergisticHorse.id);

      expect(conflicts.conflictPairs.length).toBe(0);
      expect(conflicts.totalConflictStrength).toBe(0);
    });
  });

  describe('evaluateTraitDominance', () => {
    test('should evaluate trait dominance hierarchy', async () => {
      const dominantHorse = testHorses[4]; // Multiple strong traits

      const dominance = await evaluateTraitDominance(dominantHorse.id);

      expect(dominance).toBeDefined();
      expect(dominance.horseId).toBe(dominantHorse.id);
      expect(dominance.dominanceHierarchy).toBeDefined();
      expect(Array.isArray(dominance.dominanceHierarchy)).toBe(true);
      expect(dominance.primaryTrait).toBeDefined();
      expect(dominance.secondaryTraits).toBeDefined();
      expect(dominance.recessiveTraits).toBeDefined();
      expect(dominance.dominanceStrength).toBeDefined();

      expect(dominance.dominanceHierarchy.length).toBeGreaterThan(0);
      expect(dominance.primaryTrait).toBeDefined();

      // Hierarchy should be ordered by dominance score
      for (let i = 1; i < dominance.dominanceHierarchy.length; i++) {
        expect(dominance.dominanceHierarchy[i - 1].dominanceScore).toBeGreaterThanOrEqual(
          dominance.dominanceHierarchy[i].dominanceScore
        );
      }
    });

    test('should identify primary and secondary traits correctly', async () => {
      const complexHorse = testHorses[2];

      const dominance = await evaluateTraitDominance(complexHorse.id);

      expect(dominance.primaryTrait.trait).toBeDefined();
      expect(dominance.primaryTrait.dominanceScore).toBeDefined();
      expect(Array.isArray(dominance.secondaryTraits)).toBe(true);
      expect(Array.isArray(dominance.recessiveTraits)).toBe(true);

      // Primary trait should have highest dominance score
      if (dominance.secondaryTraits.length > 0) {
        expect(dominance.primaryTrait.dominanceScore).toBeGreaterThanOrEqual(
          dominance.secondaryTraits[0].dominanceScore
        );
      }
    });
  });

  describe('processComplexInteractions', () => {
    test('should process complex multi-trait interactions', async () => {
      const complexHorse = testHorses[2]; // curious + intelligent + fragile + social

      const complexInteractions = await processComplexInteractions(complexHorse.id);

      expect(complexInteractions).toBeDefined();
      expect(complexInteractions.horseId).toBe(complexHorse.id);
      expect(complexInteractions.traitClusters).toBeDefined();
      expect(complexInteractions.emergentProperties).toBeDefined();
      expect(complexInteractions.interactionNetworks).toBeDefined();
      expect(complexInteractions.stabilityMetrics).toBeDefined();
      expect(complexInteractions.complexityScore).toBeDefined();

      expect(Array.isArray(complexInteractions.traitClusters)).toBe(true);
      expect(Array.isArray(complexInteractions.emergentProperties)).toBe(true);
      expect(complexInteractions.complexityScore).toBeGreaterThan(0);
    });

    test('should identify emergent properties from trait combinations', async () => {
      const dominantHorse = testHorses[4]; // Multiple strong traits

      const complexInteractions = await processComplexInteractions(dominantHorse.id);

      expect(complexInteractions.emergentProperties.length).toBeGreaterThan(0);

      complexInteractions.emergentProperties.forEach((property) => {
        expect(property.name).toBeDefined();
        expect(property.description).toBeDefined();
        expect(property.contributingTraits).toBeDefined();
        expect(Array.isArray(property.contributingTraits)).toBe(true);
        expect(property.strength).toBeDefined();
      });
    });

    test('should calculate complexity scores appropriately', async () => {
      const complexHorse = testHorses[2];

      const minimalHorse = testHorses[3];

      const complexScore = await processComplexInteractions(complexHorse.id);
      const minimalScore = await processComplexInteractions(minimalHorse.id);

      // Complex horse should have higher complexity score
      expect(complexScore.complexityScore).toBeGreaterThan(minimalScore.complexityScore);
    });
  });

  describe('assessInteractionStability', () => {
    test('should assess stability of trait interactions', async () => {
      const [synergisticHorse] = testHorses;

      const stability = await assessInteractionStability(synergisticHorse.id);

      expect(stability).toBeDefined();
      expect(stability.horseId).toBe(synergisticHorse.id);
      expect(stability.overallStability).toBeDefined();
      expect(stability.stabilityFactors).toBeDefined();
      expect(stability.volatilityRisks).toBeDefined();
      expect(stability.stabilityTrends).toBeDefined();
      expect(stability.recommendations).toBeDefined();

      expect(stability.overallStability).toBeGreaterThanOrEqual(0);
      expect(stability.overallStability).toBeLessThanOrEqual(1);
      expect(Array.isArray(stability.volatilityRisks)).toBe(true);
      expect(Array.isArray(stability.recommendations)).toBe(true);
    });

    test('should identify volatility risks in conflicting traits', async () => {
      const conflictingHorse = testHorses[1];

      const stability = await assessInteractionStability(conflictingHorse.id);

      expect(stability.volatilityRisks.length).toBeGreaterThan(0);
      expect(stability.overallStability).toBeLessThan(0.7); // Lower stability due to conflicts
    });
  });

  describe('modelTemporalInteractions', () => {
    test('should model trait interactions over time', async () => {
      const [horse] = testHorses;

      const temporalModel = await modelTemporalInteractions(horse.id, 30); // 30 days

      expect(temporalModel).toBeDefined();
      expect(temporalModel.horseId).toBe(horse.id);
      expect(temporalModel.timeWindow).toBe(30);
      expect(temporalModel.interactionEvolution).toBeDefined();
      expect(temporalModel.stabilityTrends).toBeDefined();
      expect(temporalModel.emergingPatterns).toBeDefined();
      expect(temporalModel.projectedChanges).toBeDefined();

      expect(Array.isArray(temporalModel.interactionEvolution)).toBe(true);
      expect(Array.isArray(temporalModel.emergingPatterns)).toBe(true);
    });

    test('should project future interaction changes', async () => {
      const complexHorse = testHorses[2];

      const temporalModel = await modelTemporalInteractions(complexHorse.id, 60);

      expect(temporalModel.projectedChanges).toBeDefined();
      expect(temporalModel.projectedChanges.synergyChanges).toBeDefined();
      expect(temporalModel.projectedChanges.conflictChanges).toBeDefined();
      expect(temporalModel.projectedChanges.dominanceShifts).toBeDefined();
      expect(temporalModel.projectedChanges.stabilityForecast).toBeDefined();
    });
  });

  describe('generateInteractionMatrix', () => {
    test('should generate comprehensive interaction matrix', async () => {
      const horse = testHorses[4]; // Horse with multiple traits

      const matrix = await generateInteractionMatrix(horse.id);

      expect(matrix).toBeDefined();
      expect(matrix.horseId).toBe(horse.id);
      expect(matrix.traitInteractions).toBeDefined();
      expect(matrix.synergies).toBeDefined();
      expect(matrix.conflicts).toBeDefined();
      expect(matrix.dominance).toBeDefined();
      expect(matrix.complexInteractions).toBeDefined();
      expect(matrix.stability).toBeDefined();
      expect(matrix.temporalModel).toBeDefined();
      expect(matrix.matrixVisualization).toBeDefined();
      expect(matrix.summary).toBeDefined();

      // Should include all analysis components
      expect(matrix.summary.totalTraits).toBeGreaterThan(0);
      expect(matrix.summary.synergyCount).toBeDefined();
      expect(matrix.summary.conflictCount).toBeDefined();
      expect(matrix.summary.overallHarmony).toBeDefined();
      expect(matrix.summary.complexityScore).toBeDefined();
    });

    test('should create matrix visualization data', async () => {
      const horse = testHorses[2];

      const matrix = await generateInteractionMatrix(horse.id);

      expect(matrix.matrixVisualization).toBeDefined();
      expect(matrix.matrixVisualization.nodes).toBeDefined();
      expect(matrix.matrixVisualization.edges).toBeDefined();
      expect(matrix.matrixVisualization.clusters).toBeDefined();

      expect(Array.isArray(matrix.matrixVisualization.nodes)).toBe(true);
      expect(Array.isArray(matrix.matrixVisualization.edges)).toBe(true);

      // Should have nodes for each trait
      expect(matrix.matrixVisualization.nodes.length).toBeGreaterThan(0);
    });
  });
});
