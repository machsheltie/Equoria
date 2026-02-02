/**
 * Weekly Flag Evaluation Service Tests
 *
 * Tests the automated weekly flag evaluation system for horses 0-3 years old.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Weekly evaluation for horses under 3 years old
 * - Pattern recognition for care consistency, bond trends, stress patterns
 * - Flag assignment based on trigger conditions
 * - Maximum 5 flags per horse enforcement
 * - Integration with existing horse aging system
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  evaluateWeeklyFlags,
  processHorseForFlagEvaluation,
  getEligibleHorsesForFlagEvaluation,
} from '../../services/weeklyFlagEvaluationService.mjs';

describe('Weekly Flag Evaluation Service', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `flagtest_${Date.now()}`,
        email: `flagtest_${Date.now()}@test.com`,
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
      prisma.groom.create({
        data: {
          name: `Test Groom Calm ${Date.now()}`,
          personality: 'calm',
          groomPersonality: 'calm',
          skillLevel: 'experienced',
          speciality: 'foal_care',
          userId: testUser.id,
          sessionRate: 25.0,
        },
      }),
      prisma.groom.create({
        data: {
          name: `Test Groom Energetic ${Date.now()}`,
          personality: 'energetic',
          groomPersonality: 'energetic',
          skillLevel: 'experienced',
          speciality: 'general_grooming',
          userId: testUser.id,
          sessionRate: 25.0,
        },
      }),
    ]);

    // Create test horses of different ages
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
    const fourYearsAgo = new Date(now.getTime() - 4 * 365 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      // Young foal (1 week old) - eligible for flag evaluation
      prisma.horse.create({
        data: {
          name: `Test Foal Week ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: oneWeekAgo,
          userId: testUser.id,
          bondScore: 15,
          stressLevel: 5,
          epigeneticFlags: [],
        },
      }),
      // Young horse (1 month old) - eligible for flag evaluation
      prisma.horse.create({
        data: {
          name: `Test Foal Month ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id,
          bondScore: 25,
          stressLevel: 3,
          epigeneticFlags: ['AFFECTIONATE'],
        },
      }),
      // 2-year-old horse - still eligible for flag evaluation
      prisma.horse.create({
        data: {
          name: `Test Horse 2yo ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: twoYearsAgo,
          userId: testUser.id,
          bondScore: 30,
          stressLevel: 2,
          epigeneticFlags: [],
        },
      }),
      // 4-year-old horse - NOT eligible for flag evaluation
      prisma.horse.create({
        data: {
          name: `Test Horse 4yo ${Date.now()}`,
          sex: 'mare',
          dateOfBirth: fourYearsAgo,
          userId: testUser.id,
          bondScore: 35,
          stressLevel: 1,
          epigeneticFlags: [],
        },
      }),
    ]);
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.groomInteraction.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groomAssignment.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groom.deleteMany({
      where: { id: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: testHorses.map(h => h.id) } },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  describe('getEligibleHorsesForFlagEvaluation', () => {
    test('should return only horses under 3 years old', async () => {
      const eligibleHorses = await getEligibleHorsesForFlagEvaluation();

      // Should include the 3 young horses but not the 4-year-old
      const testHorseIds = eligibleHorses
        .filter(horse => testHorses.some(th => th.id === horse.id))
        .map(horse => horse.id);

      expect(testHorseIds).toHaveLength(3);
      expect(testHorseIds).toContain(testHorses[0].id); // 1 week old
      expect(testHorseIds).toContain(testHorses[1].id); // 1 month old
      expect(testHorseIds).toContain(testHorses[2].id); // 2 years old
      expect(testHorseIds).not.toContain(testHorses[3].id); // 4 years old
    });

    test('should include horses with existing flags', async () => {
      const eligibleHorses = await getEligibleHorsesForFlagEvaluation();

      const horseWithFlags = eligibleHorses.find(h => h.id === testHorses[1].id);
      expect(horseWithFlags).toBeDefined();
      expect(horseWithFlags.epigeneticFlags).toContain('AFFECTIONATE');
    });
  });

  describe('processHorseForFlagEvaluation', () => {
    test('should evaluate horse for new flags based on care patterns', async () => {
      const [horse] = testHorses; // 1 week old foal

      // Create some groom interactions to establish patterns
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[0].id,
          foalId: horse.id,
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'trust_building',
          bondingChange: 5,
          stressChange: -2,
          quality: 'excellent',
          cost: 25.0,
        },
      });

      const result = await processHorseForFlagEvaluation(horse.id);

      expect(result).toBeDefined();
      expect(result.horseId).toBe(horse.id);
      expect(result.evaluated).toBe(true);
      expect(result.carePatterns).toBeDefined();
      expect(result.flagsConsidered).toBeDefined();
    });

    test('should respect maximum 5 flags per horse limit', async () => {
      // Create a horse with 5 flags already
      const horseWithMaxFlags = await prisma.horse.create({
        data: {
          name: `Test Horse Max Flags ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 1 month old
          userId: testUser.id,
          bondScore: 20,
          stressLevel: 3,
          epigeneticFlags: ['BRAVE', 'AFFECTIONATE', 'CONFIDENT', 'SOCIAL', 'CALM'],
        },
      });

      const result = await processHorseForFlagEvaluation(horseWithMaxFlags.id);

      expect(result.flagsAssigned).toHaveLength(0);
      expect(result.reason).toContain('maximum');

      // Cleanup
      await prisma.horse.delete({ where: { id: horseWithMaxFlags.id } });
    });
  });

  describe('evaluateWeeklyFlags', () => {
    test('should process all eligible horses and return summary', async () => {
      const result = await evaluateWeeklyFlags();

      expect(result).toBeDefined();
      expect(result.totalHorsesEvaluated).toBeGreaterThanOrEqual(3);
      expect(result.flagsAssigned).toBeGreaterThanOrEqual(0);
      expect(result.horsesProcessed).toBeDefined();
      expect(Array.isArray(result.horsesProcessed)).toBe(true);
    });

    test('should handle horses with no groom interactions gracefully', async () => {
      const result = await evaluateWeeklyFlags();

      // Should not throw errors even for horses with no interaction history
      expect(result.errors).toEqual([]);
      expect(result.totalHorsesEvaluated).toBeGreaterThan(0);
    });
  });
});
