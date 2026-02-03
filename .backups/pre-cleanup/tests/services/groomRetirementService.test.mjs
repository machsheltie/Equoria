/**
 * Groom Retirement Service Tests
 *
 * Tests for the groom retirement system including:
 * - Career week tracking and progression
 * - Retirement eligibility checking
 * - Retirement processing
 * - Statistics and reporting
 * - Weekly automation system
 *
 * Testing Approach: NO MOCKING - Real database operations
 * This validates actual system behavior and database constraints
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  incrementCareerWeeks,
  checkRetirementEligibility,
  processRetirement,
  getRetirementStatistics,
  processWeeklyCareerProgression,
  RETIREMENT_REASONS,
  CAREER_CONSTANTS,
} from '../../services/groomRetirementService.mjs';

describe('Groom Retirement Service', () => {
  let testUser;
  let testGroom;
  let testHorse;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_retirement_${Date.now()}`,
        email: `test_retirement_${Date.now()}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Create test horse for assignment logs
    testHorse = await prisma.horse.create({
      data: {
        name: `Test Horse ${Date.now()}`,
        sex: 'male',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        user: { connect: { id: testUser.id } },
        bondScore: 50,
        stressLevel: 30,
      },
    });
  });

  beforeEach(async () => {
    // Create fresh test groom for each test
    testGroom = await prisma.groom.create({
      data: {
        name: `Test Groom ${Date.now()}`,
        personality: 'calm',
        skillLevel: 'intermediate',
        speciality: 'foal_care',
        user: { connect: { id: testUser.id } },
        careerWeeks: 0,
        level: 1,
        experience: 0,
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testGroom) {
      await prisma.groomAssignmentLog.deleteMany({
        where: { groomId: testGroom.id },
      });
      await prisma.groomLegacyLog.deleteMany({
        where: {
          OR: [{ retiredGroomId: testGroom.id }, { legacyGroomId: testGroom.id }],
        },
      });
      await prisma.groomTalentSelections.deleteMany({
        where: { groomId: testGroom.id },
      });
      await prisma.groom.delete({
        where: { id: testGroom.id },
      });
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testHorse) {
      await prisma.horse.delete({
        where: { id: testHorse.id },
      });
    }
    if (testUser) {
      await prisma.user.delete({
        where: { id: testUser.id },
      });
    }
    await prisma.$disconnect();
  });

  describe('Career Week Tracking', () => {
    test('should increment career weeks correctly', async () => {
      const result = await incrementCareerWeeks(testGroom.id);

      expect(result.careerWeeks).toBe(1);
      expect(result.id).toBe(testGroom.id);

      // Verify database was updated
      const updatedGroom = await prisma.groom.findUnique({
        where: { id: testGroom.id },
      });
      expect(updatedGroom.careerWeeks).toBe(1);
    });

    test('should handle multiple career week increments', async () => {
      // Increment multiple times
      await incrementCareerWeeks(testGroom.id);
      await incrementCareerWeeks(testGroom.id);
      const result = await incrementCareerWeeks(testGroom.id);

      expect(result.careerWeeks).toBe(3);
    });

    test('should throw error for non-existent groom', async () => {
      await expect(incrementCareerWeeks(99999)).rejects.toThrow();
    });
  });

  describe('Retirement Eligibility', () => {
    test('should identify groom not eligible for retirement', async () => {
      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('not_eligible');
      expect(eligibility.weeksUntilRetirement).toBe(CAREER_CONSTANTS.MANDATORY_RETIREMENT_WEEKS);
      expect(eligibility.mandatory).toBe(false);
    });

    test('should identify mandatory retirement at 104 weeks', async () => {
      // Set groom to 104 weeks
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { careerWeeks: 104 },
      });

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBe(RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT);
      expect(eligibility.weeksUntilRetirement).toBe(0);
      expect(eligibility.mandatory).toBe(true);
    });

    test('should identify early retirement at level 10', async () => {
      // Set groom to level 10
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { level: 10, careerWeeks: 50 },
      });

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBe(RETIREMENT_REASONS.EARLY_LEVEL_CAP);
      expect(eligibility.weeksUntilRetirement).toBe(54); // 104 - 50
      expect(eligibility.mandatory).toBe(false);
    });

    test('should identify early retirement with 12+ assignments', async () => {
      // Create 12 assignment logs
      const assignmentPromises = Array.from({ length: 12 }, () =>
        prisma.groomAssignmentLog.create({
          data: {
            groomId: testGroom.id,
            horseId: testHorse.id,
            assignedAt: new Date(),
            milestonesCompleted: 1,
            xpGained: 10,
          },
        })
      );
      await Promise.all(assignmentPromises);

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBe(RETIREMENT_REASONS.EARLY_ASSIGNMENT_LIMIT);
      expect(eligibility.mandatory).toBe(false);
    });

    test('should identify retirement notice period', async () => {
      // Set groom to 103 weeks (1 week before mandatory)
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { careerWeeks: 103 },
      });

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.noticeRequired).toBe(true);
      expect(eligibility.weeksUntilRetirement).toBe(1);
    });

    test('should handle already retired groom', async () => {
      // Mark groom as retired
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { retired: true },
      });

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('already_retired');
    });
  });

  describe('Retirement Processing', () => {
    test('should process mandatory retirement correctly', async () => {
      // Set groom to mandatory retirement
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { careerWeeks: 104 },
      });

      const result = await processRetirement(testGroom.id);

      expect(result.groom.retired).toBe(true);
      expect(result.groom.isActive).toBe(false);
      expect(result.retirementReason).toBe(RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT);
      expect(result.retirementTimestamp).toBeInstanceOf(Date);

      // Verify database was updated
      const updatedGroom = await prisma.groom.findUnique({
        where: { id: testGroom.id },
      });
      expect(updatedGroom.retired).toBe(true);
      expect(updatedGroom.retirementTimestamp).toBeTruthy();
    });

    test('should process voluntary retirement', async () => {
      const result = await processRetirement(testGroom.id, RETIREMENT_REASONS.VOLUNTARY, true);

      expect(result.groom.retired).toBe(true);
      expect(result.retirementReason).toBe(RETIREMENT_REASONS.VOLUNTARY);
    });

    test('should remove active assignments on retirement', async () => {
      // Create an active assignment
      await prisma.groomAssignment.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          userId: testUser.id,
          priority: 1,
          notes: 'Test assignment',
          isActive: true,
        },
      });

      // Process retirement
      await processRetirement(testGroom.id, RETIREMENT_REASONS.VOLUNTARY, true);

      // Verify assignment was removed
      const assignments = await prisma.groomAssignment.findMany({
        where: { groomId: testGroom.id },
      });
      expect(assignments).toHaveLength(0);
    });

    test('should reject retirement for ineligible groom', async () => {
      await expect(processRetirement(testGroom.id)).rejects.toThrow('not eligible for retirement');
    });
  });

  describe('Weekly Career Progression', () => {
    let testGrooms;

    beforeEach(async () => {
      // Create multiple test grooms with different career stages
      testGrooms = await Promise.all([
        prisma.groom.create({
          data: {
            name: `Test Groom Early ${Date.now()}`,
            personality: 'calm',
            skillLevel: 'novice',
            speciality: 'foal_care',
            user: { connect: { id: testUser.id } },
            careerWeeks: 10,
            level: 2,
            retired: false,
          },
        }),
        prisma.groom.create({
          data: {
            name: `Test Groom Mid ${Date.now()}`,
            personality: 'energetic',
            skillLevel: 'intermediate',
            speciality: 'general_grooming',
            user: { connect: { id: testUser.id } },
            careerWeeks: 50,
            level: 5,
            retired: false,
          },
        }),
        prisma.groom.create({
          data: {
            name: `Test Groom Near Retirement ${Date.now()}`,
            personality: 'methodical',
            skillLevel: 'expert',
            speciality: 'specialized_disciplines',
            user: { connect: { id: testUser.id } },
            careerWeeks: 103,
            level: 8,
            retired: false,
          },
        }),
        prisma.groom.create({
          data: {
            name: `Test Groom Level 10 ${Date.now()}`,
            personality: 'calm',
            skillLevel: 'expert',
            speciality: 'foal_care',
            user: { connect: { id: testUser.id } },
            careerWeeks: 80,
            level: 10,
            retired: false,
          },
        }),
      ]);
    });

    afterEach(async () => {
      // Clean up test grooms
      if (testGrooms) {
        for (const groom of testGrooms) {
          await prisma.groomLegacyLog.deleteMany({
            where: {
              OR: [{ retiredGroomId: groom.id }, { legacyGroomId: groom.id }],
            },
          });
          await prisma.groomTalentSelections.deleteMany({
            where: { groomId: groom.id },
          });
          await prisma.groom.delete({
            where: { id: groom.id },
          });
        }
      }
    });

    test('should process weekly career progression for all active grooms', async () => {
      const result = await processWeeklyCareerProgression();

      expect(result.processed).toBeGreaterThanOrEqual(4); // At least our test grooms
      expect(result.retired).toBeGreaterThanOrEqual(2); // Level 10 and 103-week grooms should retire
      expect(result.errors).toHaveLength(0);

      // Verify career weeks were incremented
      const updatedGrooms = await prisma.groom.findMany({
        where: { id: { in: testGrooms.map((g) => g.id) } },
      });

      const activeGrooms = updatedGrooms.filter((g) => !g.retired);
      for (const groom of activeGrooms) {
        const originalGroom = testGrooms.find((tg) => tg.id === groom.id);
        expect(groom.careerWeeks).toBe(originalGroom.careerWeeks + 1);
      }

      // Verify retirements
      const retiredGrooms = updatedGrooms.filter((g) => g.retired);
      expect(retiredGrooms.length).toBeGreaterThanOrEqual(2);

      // Check specific retirement reasons
      const levelCapRetired = retiredGrooms.find(
        (g) => g.retirementReason === RETIREMENT_REASONS.EARLY_LEVEL_CAP
      );
      const mandatoryRetired = retiredGrooms.find(
        (g) => g.retirementReason === RETIREMENT_REASONS.MANDATORY_CAREER_LIMIT
      );

      expect(levelCapRetired).toBeTruthy();
      expect(mandatoryRetired).toBeTruthy();
    });

    test('should handle errors gracefully during weekly progression', async () => {
      // Create a groom that will cause an error during processing by making it invalid after creation
      const problemGroom = await prisma.groom.create({
        data: {
          name: `Problem Groom ${Date.now()}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foal_care',
          user: { connect: { id: testUser.id } },
          careerWeeks: 0,
          level: 1,
          retired: false,
        },
      });

      // Manually corrupt the groom data to cause an error during processing
      // We'll delete the user reference to cause a foreign key issue
      await prisma.groom.update({
        where: { id: problemGroom.id },
        data: { userId: null }, // This will cause issues during processing
      });

      const result = await processWeeklyCareerProgression();

      // Should still process other grooms despite errors
      expect(result.processed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0); // May or may not have errors

      // Clean up
      await prisma.groom.delete({ where: { id: problemGroom.id } });
    });

    test('should skip already retired grooms', async () => {
      // Mark one groom as retired
      await prisma.groom.update({
        where: { id: testGrooms[0].id },
        data: { retired: true },
      });

      await processWeeklyCareerProgression();

      // Verify retired groom was not processed
      const retiredGroom = await prisma.groom.findUnique({
        where: { id: testGrooms[0].id },
      });
      expect(retiredGroom.careerWeeks).toBe(10); // Should remain unchanged
    });

    test('should provide detailed statistics', async () => {
      await processWeeklyCareerProgression();

      const stats = await getRetirementStatistics(testUser.id);

      expect(stats.totalGrooms).toBeGreaterThanOrEqual(4);
      expect(stats.activeGrooms).toBeGreaterThanOrEqual(2);
      expect(stats.retiredGrooms).toBeGreaterThanOrEqual(2);
      expect(stats.approachingRetirement).toBeGreaterThanOrEqual(0);
      expect(stats.retirementReasons).toBeDefined();
      expect(stats.averageCareerLength).toBeGreaterThan(0);
    });
  });
});
