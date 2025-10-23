/**
 * Flag Effect Integration Tests
 *
 * Tests integration of epigenetic flag effects with competition system and breeding outcomes.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Flag effects on competition performance bonuses/penalties
 * - Flag effects on stress resistance and bonding
 * - Flag effects on training effectiveness
 * - Flag effects on breeding trait probability
 * - Cumulative flag effect calculations
 * - Flag conflict resolution in effects
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  calculateFlagEffects,
  applyFlagEffectsToCompetition,
  applyFlagEffectsToTraining,
  applyFlagEffectsToBreeding,
  resolveFlagConflicts,
} from '../../services/flagEffectIntegration.mjs';

describe('Flag Effect Integration', () => {
  let testUser;
  let testHorses = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `flageffects_${Date.now()}`,
        email: `flageffects_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Create test horses with different flag combinations
    testHorses = await Promise.all([
      // Horse with positive flags
      prisma.horse.create({
        data: {
          name: `Test Horse Positive ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months old
          ownerId: testUser.id,
          bondScore: 30,
          stressLevel: 2,
          epigeneticFlags: ['brave', 'confident', 'affectionate'],
        },
      }),
      // Horse with negative flags
      prisma.horse.create({
        data: {
          name: `Test Horse Negative ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months old
          ownerId: testUser.id,
          bondScore: 15,
          stressLevel: 8,
          epigeneticFlags: ['fearful', 'insecure', 'reactive'],
        },
      }),
      // Horse with mixed flags
      prisma.horse.create({
        data: {
          name: `Test Horse Mixed ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months old
          ownerId: testUser.id,
          bondScore: 22,
          stressLevel: 5,
          epigeneticFlags: ['brave', 'social', 'reactive'],
        },
      }),
      // Horse with no flags (control)
      prisma.horse.create({
        data: {
          name: `Test Horse Control ${Date.now()}`,
          sex: 'mare',
          dateOfBirth: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 6 months old
          ownerId: testUser.id,
          bondScore: 25,
          stressLevel: 4,
          epigeneticFlags: [],
        },
      }),
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.horse.deleteMany({
      where: { id: { in: testHorses.map(h => h.id) } },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  describe('calculateFlagEffects', () => {
    test('should calculate cumulative effects for positive flags', async () => {
      const [horse] = testHorses; // Positive flags: brave, confident, affectionate

      const effects = await calculateFlagEffects(horse);

      expect(effects).toBeDefined();
      expect(effects.competitionBonuses).toBeDefined();
      expect(effects.stressModifiers).toBeDefined();
      expect(effects.bondingModifiers).toBeDefined();
      expect(effects.trainingModifiers).toBeDefined();
      expect(effects.breedingModifiers).toBeDefined();

      // Should have positive effects
      expect(effects.stressModifiers.stressReduction).toBeGreaterThan(0);
      expect(effects.bondingModifiers.bondingBonus).toBeGreaterThan(0);
      expect(Object.keys(effects.competitionBonuses).length).toBeGreaterThan(0);
    });

    test('should calculate cumulative effects for negative flags', async () => {
      // eslint-disable-next-line prefer-destructuring
      const horse = testHorses[1]; // Negative flags: fearful, insecure, reactive

      const effects = await calculateFlagEffects(horse);

      expect(effects).toBeDefined();

      // Should have negative effects
      expect(effects.stressModifiers.stressIncrease).toBeGreaterThan(0);
      expect(effects.bondingModifiers.bondingDifficulty).toBeGreaterThan(0);
      expect(Object.keys(effects.competitionPenalties).length).toBeGreaterThan(0);
    });

    test('should handle conflicting flags appropriately', async () => {
      // eslint-disable-next-line prefer-destructuring
      const horse = testHorses[2]; // Mixed flags: brave, social, reactive

      const effects = await calculateFlagEffects(horse);

      expect(effects).toBeDefined();
      expect(effects.conflictResolution).toBeDefined();
      expect(effects.conflictResolution.conflictsDetected).toBeDefined();
      expect(effects.conflictResolution.resolutionMethod).toBeDefined();
    });

    test('should return neutral effects for horses with no flags', async () => {
      // eslint-disable-next-line prefer-destructuring
      const horse = testHorses[3]; // No flags

      const effects = await calculateFlagEffects(horse);

      expect(effects).toBeDefined();
      expect(effects.competitionBonuses).toEqual({});
      expect(effects.competitionPenalties).toEqual({});
      expect(effects.stressModifiers.stressReduction).toBe(0);
      expect(effects.bondingModifiers.bondingBonus).toBe(0);
    });
  });

  describe('applyFlagEffectsToCompetition', () => {
    test('should apply positive flag effects to competition performance', async () => {
      const [horse] = testHorses; // Positive flags
      const basePerformance = {
        discipline: 'showJumping',
        baseScore: 100,
        stats: { speed: 50, agility: 60, balance: 55 },
      };

      const result = await applyFlagEffectsToCompetition(horse, basePerformance);

      expect(result).toBeDefined();
      expect(result.modifiedScore).toBeGreaterThan(basePerformance.baseScore);
      expect(result.flagEffectsApplied).toBeDefined();
      expect(result.flagEffectsApplied.length).toBeGreaterThan(0);
      expect(result.totalBonus).toBeGreaterThan(0);
    });

    test('should apply negative flag effects to competition performance', async () => {
      // eslint-disable-next-line prefer-destructuring
      const horse = testHorses[1]; // Negative flags
      const basePerformance = {
        discipline: 'dressage',
        baseScore: 100,
        stats: { precision: 50, intelligence: 60, focus: 55 },
      };

      const result = await applyFlagEffectsToCompetition(horse, basePerformance);

      expect(result).toBeDefined();
      expect(result.modifiedScore).toBeLessThan(basePerformance.baseScore);
      expect(result.flagEffectsApplied).toBeDefined();
      expect(result.totalPenalty).toBeGreaterThan(0);
    });

    test('should handle discipline-specific flag effects', async () => {
      const [horse] = testHorses; // Brave, confident, affectionate

      // Test show jumping (should benefit from brave flag)
      const showJumpingPerformance = {
        discipline: 'showJumping',
        baseScore: 100,
        stats: { speed: 50, agility: 60, balance: 55 },
      };

      const showJumpingResult = await applyFlagEffectsToCompetition(horse, showJumpingPerformance);

      // Test dressage (should benefit from confident flag)
      const dressagePerformance = {
        discipline: 'dressage',
        baseScore: 100,
        stats: { precision: 50, intelligence: 60, focus: 55 },
      };

      const dressageResult = await applyFlagEffectsToCompetition(horse, dressagePerformance);

      expect(showJumpingResult.modifiedScore).toBeGreaterThan(100);
      expect(dressageResult.modifiedScore).toBeGreaterThan(100);

      // Both should have positive effects but potentially different magnitudes
      expect(showJumpingResult.totalBonus).toBeGreaterThan(0);
      expect(dressageResult.totalBonus).toBeGreaterThan(0);
    });
  });

  describe('applyFlagEffectsToTraining', () => {
    test('should apply flag effects to training effectiveness', async () => {
      const [horse] = testHorses; // Positive flags
      const trainingSession = {
        discipline: 'showJumping',
        baseEffectiveness: 1.0,
        duration: 60,
        groomPersonality: 'calm',
      };

      const result = await applyFlagEffectsToTraining(horse, trainingSession);

      expect(result).toBeDefined();
      expect(result.modifiedEffectiveness).toBeGreaterThan(trainingSession.baseEffectiveness);
      expect(result.flagEffectsApplied).toBeDefined();
      expect(result.stressImpact).toBeDefined();
      expect(result.bondingImpact).toBeDefined();
    });

    test('should reduce training effectiveness for negative flags', async () => {
      // eslint-disable-next-line prefer-destructuring
      const horse = testHorses[1]; // Negative flags
      const trainingSession = {
        discipline: 'dressage',
        baseEffectiveness: 1.0,
        duration: 60,
        groomPersonality: 'energetic',
      };

      const result = await applyFlagEffectsToTraining(horse, trainingSession);

      expect(result).toBeDefined();
      expect(result.modifiedEffectiveness).toBeLessThan(trainingSession.baseEffectiveness);
      expect(result.stressImpact).toBeGreaterThan(0); // More stress
    });
  });

  describe('applyFlagEffectsToBreeding', () => {
    test('should apply flag effects to breeding trait probabilities', async () => {
      const [mare] = testHorses; // Positive flags
      // eslint-disable-next-line prefer-destructuring
      const stallion = testHorses[3]; // No flags (control)

      const breedingOutcome = {
        baseTraitProbabilities: {
          confident: 0.3,
          brave: 0.2,
          fearful: 0.1,
          social: 0.25,
        },
      };

      const result = await applyFlagEffectsToBreeding(mare, stallion, breedingOutcome);

      expect(result).toBeDefined();
      expect(result.modifiedTraitProbabilities).toBeDefined();
      expect(result.flagInfluences).toBeDefined();

      // Positive flags should increase probability of positive traits
      expect(result.modifiedTraitProbabilities.confident).toBeGreaterThan(breedingOutcome.baseTraitProbabilities.confident);
      expect(result.modifiedTraitProbabilities.brave).toBeGreaterThan(breedingOutcome.baseTraitProbabilities.brave);

      // Should decrease probability of negative traits
      expect(result.modifiedTraitProbabilities.fearful).toBeLessThan(breedingOutcome.baseTraitProbabilities.fearful);
    });

    test('should handle breeding between horses with conflicting flags', async () => {
      const [mare] = testHorses; // Positive flags
      // eslint-disable-next-line prefer-destructuring
      const stallion = testHorses[1]; // Negative flags

      const breedingOutcome = {
        baseTraitProbabilities: {
          confident: 0.3,
          brave: 0.2,
          fearful: 0.15,
          insecure: 0.1,
        },
      };

      const result = await applyFlagEffectsToBreeding(mare, stallion, breedingOutcome);

      expect(result).toBeDefined();
      expect(result.conflictResolution).toBeDefined();
      expect(result.conflictResolution.method).toBeDefined();

      // Should show balanced effects from conflicting parents
      const totalPositiveChange = (result.modifiedTraitProbabilities.confident - breedingOutcome.baseTraitProbabilities.confident) +
                                  (result.modifiedTraitProbabilities.brave - breedingOutcome.baseTraitProbabilities.brave);
      const totalNegativeChange = (result.modifiedTraitProbabilities.fearful - breedingOutcome.baseTraitProbabilities.fearful) +
                                  (result.modifiedTraitProbabilities.insecure - breedingOutcome.baseTraitProbabilities.insecure);

      // Effects should be moderated due to conflicting parents
      expect(Math.abs(totalPositiveChange)).toBeLessThan(0.3);
      expect(Math.abs(totalNegativeChange)).toBeLessThan(0.3);
    });
  });

  describe('resolveFlagConflicts', () => {
    test('should identify and resolve flag conflicts', async () => {
      const conflictingFlags = ['brave', 'fearful', 'confident', 'insecure'];

      const resolution = await resolveFlagConflicts(conflictingFlags);

      expect(resolution).toBeDefined();
      expect(resolution.conflictsDetected).toBeDefined();
      expect(resolution.conflictsDetected.length).toBeGreaterThan(0);
      expect(resolution.resolutionMethod).toBeDefined();
      expect(resolution.resolvedEffects).toBeDefined();

      // Should identify brave vs fearful and confident vs insecure conflicts
      const conflicts = resolution.conflictsDetected;
      expect(conflicts.some(c => c.flags.includes('brave') && c.flags.includes('fearful'))).toBe(true);
      expect(conflicts.some(c => c.flags.includes('confident') && c.flags.includes('insecure'))).toBe(true);
    });

    test('should handle no conflicts gracefully', async () => {
      const nonConflictingFlags = ['brave', 'confident', 'social'];

      const resolution = await resolveFlagConflicts(nonConflictingFlags);

      expect(resolution).toBeDefined();
      expect(resolution.conflictsDetected).toEqual([]);
      expect(resolution.resolutionMethod).toBe('none_needed');
    });
  });
});
