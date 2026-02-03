/**
 * Enhanced Flag Assignment Engine Tests
 *
 * Tests advanced flag assignment logic with personality-based modifiers and sophisticated trigger conditions.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Personality-based trigger condition modifiers
 * - Advanced pattern recognition for complex flags
 * - Groom personality compatibility effects
 * - Age-based trigger sensitivity adjustments
 * - Multi-factor flag assignment scoring
 * - Temporal pattern analysis for flag triggers
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  evaluateFlagTriggers,
  evaluatePersonalityModifiedTriggers,
  calculateFlagAssignmentScore,
  analyzeTemporalPatterns,
} from '../../services/flagAssignmentEngine.mjs';

describe('Enhanced Flag Assignment Engine', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];

  beforeAll(async () => {
    // Create test horses of different ages for age-based trigger testing
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Create test user
      testUser = await tx.user.create({
        data: {
          username: `flagengine_${Date.now()}`,
          email: `flagengine_${Date.now()}@test.com`,
          password: 'test_hash',
          firstName: 'Test',
          lastName: 'User',
          money: 1000,
          xp: 0,
          level: 1,
        },
      });

      // Create test grooms with different personalities
      testGrooms = await Promise.all([
        tx.groom.create({
          data: {
            name: `Test Groom Calm ${Date.now()}`,
            personality: 'calm',
            groomPersonality: 'calm',
            skillLevel: 'experienced',
            speciality: 'foal_care',
            user: { connect: { id: testUser.id } },
            sessionRate: 25.0,
          },
        }),
        tx.groom.create({
          data: {
            name: `Test Groom Energetic ${Date.now()}`,
            personality: 'energetic',
            groomPersonality: 'energetic',
            skillLevel: 'experienced',
            speciality: 'general_grooming',
            user: { connect: { id: testUser.id } },
            sessionRate: 25.0,
          },
        }),
        tx.groom.create({
          data: {
            name: `Test Groom Methodical ${Date.now()}`,
            personality: 'methodical',
            groomPersonality: 'methodical',
            skillLevel: 'expert',
            speciality: 'foal_care',
            user: { connect: { id: testUser.id } },
            sessionRate: 30.0,
          },
        }),
      ]);

      testHorses = await Promise.all([
        // Very young foal (1 week) - high sensitivity to triggers
        tx.horse.create({
          data: {
            name: `Test Foal Week ${Date.now()}`,
            sex: 'filly',
            dateOfBirth: oneWeekAgo,
            user: { connect: { id: testUser.id } },
            bondScore: 10,
            stressLevel: 8,
            epigeneticFlags: [],
          },
        }),
        // Young foal (1 month) - moderate sensitivity
        tx.horse.create({
          data: {
            name: `Test Foal Month ${Date.now()}`,
            sex: 'colt',
            dateOfBirth: oneMonthAgo,
            user: { connect: { id: testUser.id } },
            bondScore: 20,
            stressLevel: 5,
            epigeneticFlags: [],
          },
        }),
        // Older foal (6 months) - lower sensitivity
        tx.horse.create({
          data: {
            name: `Test Foal 6mo ${Date.now()}`,
            sex: 'gelding',
            dateOfBirth: sixMonthsAgo,
            user: { connect: { id: testUser.id } },
            bondScore: 35,
            stressLevel: 3,
            epigeneticFlags: [],
          },
        }),
      ]);
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.groomInteraction.deleteMany({
      where: { groomId: { in: testGrooms.map((g) => g.id) } },
    });
    await prisma.groomAssignment.deleteMany({
      where: { groomId: { in: testGrooms.map((g) => g.id) } },
    });
    await prisma.groom.deleteMany({
      where: { id: { in: testGrooms.map((g) => g.id) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: testHorses.map((h) => h.id) } },
    });
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  describe('evaluatePersonalityModifiedTriggers', () => {
    test('should apply calm groom personality modifiers correctly', async () => {
      const [horse] = testHorses; // Very young, high stress foal

      // Create interactions with calm groom
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[0].id, // Calm groom
          foalId: horse.id,
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'trust_building',
          bondingChange: 3,
          stressChange: -3,
          quality: 'good',
          cost: 25.0,
        },
      });

      const carePatterns = {
        groomConsistency: {
          uniqueGroomsCount: 1,
          groomChanges: 0,
          consistencyScore: 1.0,
        },
        bondTrends: {
          trend: 'improving',
          averageChange: 3,
          positiveRatio: 1.0,
        },
        stressPatterns: {
          averageReduction: -3,
          stressSpikes: [],
        },
      };

      const result = await evaluatePersonalityModifiedTriggers(horse, carePatterns);

      expect(result).toBeDefined();
      expect(result.personalityModifiers).toBeDefined();
      expect(result.personalityModifiers.calm).toBeDefined();
      expect(result.adjustedTriggers).toBeDefined();
    });

    test('should apply energetic groom personality modifiers correctly', async () => {
      const horse = testHorses[1]; // 1 month old foal

      // Create interactions with energetic groom
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[1].id, // Energetic groom
          foalId: horse.id,
          interactionType: 'grooming',
          duration: 25,
          taskType: 'desensitization',
          bondingChange: 2,
          stressChange: 1, // Slight stress increase from energetic approach
          quality: 'good',
          cost: 25.0,
        },
      });

      const carePatterns = {
        groomConsistency: {
          uniqueGroomsCount: 1,
          groomChanges: 0,
          consistencyScore: 1.0,
        },
        bondTrends: {
          trend: 'improving',
          averageChange: 2,
          positiveRatio: 1.0,
        },
        stressPatterns: {
          averageReduction: 1,
          stressSpikes: [],
        },
        taskDiversity: {
          diversity: 0.6,
          excellentQualityRatio: 0.7,
        },
        consistency: {
          consistencyScore: 0.8,
        },
      };

      const result = await evaluatePersonalityModifiedTriggers(horse, carePatterns);

      expect(result).toBeDefined();
      expect(result.personalityModifiers).toBeDefined();
      expect(result.personalityModifiers.energetic).toBeDefined();
    });
  });

  describe('calculateFlagAssignmentScore', () => {
    test('should calculate comprehensive flag assignment scores', async () => {
      const [horse] = testHorses;
      const flagName = 'brave';

      const carePatterns = {
        consistency: { consistencyScore: 0.8 },
        bondTrends: { averageChange: 2.5, positiveRatio: 0.9 },
        stressPatterns: { averageReduction: -2, stressSpikes: [] },
        taskDiversity: { diversity: 0.7, excellentQualityRatio: 0.6 },
      };

      const score = await calculateFlagAssignmentScore(horse, flagName, carePatterns);

      expect(score).toBeDefined();
      expect(typeof score.totalScore).toBe('number');
      expect(score.components).toBeDefined();
      expect(score.components.baseScore).toBeDefined();
      expect(score.components.ageModifier).toBeDefined();
      expect(score.components.personalityModifier).toBeDefined();
      expect(score.threshold).toBeDefined();
      expect(typeof score.shouldAssign).toBe('boolean');
    });

    test('should apply age-based sensitivity modifiers', async () => {
      const [youngHorse] = testHorses; // 1 week old

      const olderHorse = testHorses[2]; // 6 months old

      const carePatterns = {
        consistency: { consistencyScore: 0.6 },
        bondTrends: { averageChange: 1, positiveRatio: 0.7 },
        stressPatterns: { averageReduction: -1, stressSpikes: [] },
        taskDiversity: { diversity: 0.5, excellentQualityRatio: 0.4 },
      };

      const youngScore = await calculateFlagAssignmentScore(youngHorse, 'brave', carePatterns);
      const olderScore = await calculateFlagAssignmentScore(olderHorse, 'brave', carePatterns);

      // Younger horses should be more sensitive to triggers
      expect(youngScore.components.ageModifier).toBeGreaterThan(olderScore.components.ageModifier);
    });
  });

  describe('analyzeTemporalPatterns', () => {
    test('should analyze temporal patterns in care quality', async () => {
      const horse = testHorses[1];

      // Create a series of interactions over time with varying quality
      const interactions = [];
      for (let i = 0; i < 5; i++) {
        const interaction = await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'trust_building',
            bondingChange: 3 - i, // Declining quality over time
            stressChange: -2 + i, // Increasing stress over time
            quality: i < 2 ? 'excellent' : i < 4 ? 'good' : 'poor',
            cost: 25.0,
          },
        });
        interactions.push(interaction);
      }

      const patterns = await analyzeTemporalPatterns(horse.id);

      expect(patterns).toBeDefined();
      expect(patterns.trendAnalysis).toBeDefined();
      expect(patterns.trendAnalysis.bondTrend).toBeDefined();
      expect(patterns.trendAnalysis.stressTrend).toBeDefined();
      expect(patterns.trendAnalysis.qualityTrend).toBeDefined();
      expect(patterns.periodicPatterns).toBeDefined();
      expect(patterns.criticalPeriods).toBeDefined();
    });

    test('should identify critical periods for flag assignment', async () => {
      const [horse] = testHorses; // Very young foal

      // Create interactions that simulate a critical period
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[1].id, // Energetic groom
          foalId: horse.id,
          interactionType: 'enrichment',
          duration: 45,
          taskType: 'showground_exposure',
          bondingChange: -2, // Negative bonding
          stressChange: 5, // High stress
          quality: 'poor',
          cost: 25.0,
        },
      });

      const patterns = await analyzeTemporalPatterns(horse.id);

      expect(patterns.criticalPeriods).toBeDefined();
      expect(Array.isArray(patterns.criticalPeriods)).toBe(true);

      if (patterns.criticalPeriods.length > 0) {
        expect(patterns.criticalPeriods[0]).toHaveProperty('period');
        expect(patterns.criticalPeriods[0]).toHaveProperty('severity');
        expect(patterns.criticalPeriods[0]).toHaveProperty('flagRisk');
      }
    });
  });

  describe('Advanced Flag Assignment Integration', () => {
    test('should integrate all enhancement features for comprehensive evaluation', async () => {
      const horse = testHorses[2]; // 6 months old

      // Create a complex care pattern with multiple grooms and varying quality
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id, // Calm
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'trust_building',
            bondingChange: 4,
            stressChange: -2,
            quality: 'excellent',
            cost: 25.0,
          },
        }),
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[2].id, // Methodical
            foalId: horse.id,
            interactionType: 'grooming',
            duration: 40,
            taskType: 'hoof_handling',
            bondingChange: 3,
            stressChange: -1,
            quality: 'excellent',
            cost: 30.0,
          },
        }),
      ]);

      const carePatterns = {
        consistency: { consistencyScore: 0.9 },
        bondTrends: { trend: 'improving', averageChange: 3.5, positiveRatio: 1.0 },
        stressPatterns: { averageReduction: -1.5, stressSpikes: [] },
        taskDiversity: { diversity: 0.8, excellentQualityRatio: 1.0 },
        groomConsistency: { uniqueGroomsCount: 2, groomChanges: 1, consistencyScore: 0.8 },
      };

      const evaluation = await evaluateFlagTriggers(horse, carePatterns);

      expect(evaluation).toBeDefined();
      expect(evaluation.eligibleFlags).toBeDefined();
      expect(Array.isArray(evaluation.eligibleFlags)).toBe(true);
      expect(evaluation.triggerConditions).toBeDefined();

      // Should identify positive flags due to excellent care
      const positiveFlags = evaluation.eligibleFlags.filter((flag) =>
        ['brave', 'confident', 'affectionate', 'social'].includes(flag)
      );
      expect(positiveFlags.length).toBeGreaterThan(0);
    });
  });
});
