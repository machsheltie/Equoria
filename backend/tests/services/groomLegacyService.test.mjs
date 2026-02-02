/**
 * Groom Legacy Service Tests
 *
 * Tests for the groom legacy replacement system including:
 * - Legacy eligibility checking
 * - Protégé generation
 * - Perk inheritance
 * - Legacy tracking
 *
 * Testing Approach: NO MOCKING - Real database operations
 * This validates actual system behavior and database constraints
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  checkLegacyEligibility,
  generateLegacyProtege,
  getLegacyPerks,
  getUserLegacyHistory,
} from '../../services/groomLegacyService.mjs';

describe('Groom Legacy Service', () => {
  let testUser;
  let testHorse;
  let retiredGroom;
  const testRunId = `legacy_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const testUserData = {
    username: `testuser_legacy_${testRunId}`,
    email: `test_legacy_${testRunId}@example.com`,
    password: 'hashedpassword123',
    firstName: 'Test',
    lastName: 'User',
  };
  const testHorseName = `Test Horse ${testRunId}`;

  const ensureTestUser = async () => {
    testUser = await prisma.user.upsert({
      where: { email: testUserData.email },
      update: {},
      create: testUserData,
    });
  };

  const ensureTestHorse = async () => {
    const existingHorse = await prisma.horse.findFirst({
      where: { name: testHorseName, userId: testUser.id },
    });
    if (existingHorse) {
      testHorse = existingHorse;
      return;
    }
    testHorse = await prisma.horse.create({
      data: {
        name: testHorseName,
        sex: 'male',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        userId: testUser.id ,
        bondScore: 50,
        stressLevel: 30,
      },
    });
  };

  beforeAll(async () => {
    await ensureTestUser();
    await ensureTestHorse();
  });

  beforeEach(async () => {
    await ensureTestUser();
    await ensureTestHorse();

    // Create a retired high-level groom for each test
    retiredGroom = await prisma.groom.create({
      data: {
        name: `Retired Master Groom ${Date.now()}`,
        personality: 'calm',
        skillLevel: 'expert',
        speciality: 'foal_care',
        userId: testUser.id ,
        careerWeeks: 104,
        level: 8,
        experience: 500,
        retired: true,
        retirementReason: 'mandatory_career_limit',
        retirementTimestamp: new Date(),
      },
    });

    // Create some assignment logs to show experience
    await Promise.all([
      prisma.groomAssignmentLog.create({
        data: {
          groomId: retiredGroom.id,
          horseId: testHorse.id,
          assignedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          unassignedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          milestonesCompleted: 3,
          traitsShaped: ['calm', 'focused'],
          xpGained: 50,
        },
      }),
      prisma.groomAssignmentLog.create({
        data: {
          groomId: retiredGroom.id,
          horseId: testHorse.id,
          assignedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          unassignedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          milestonesCompleted: 5,
          traitsShaped: ['intelligent', 'obedient'],
          xpGained: 75,
        },
      }),
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    if (retiredGroom) {
      await prisma.groomLegacyLog.deleteMany({
        where: {
          OR: [{ retiredGroomId: retiredGroom.id }, { legacyGroomId: retiredGroom.id }],
        },
      });
      await prisma.groomAssignmentLog.deleteMany({
        where: { groomId: retiredGroom.id },
      });
      await prisma.groomTalentSelections.deleteMany({
        where: { groomId: retiredGroom.id },
      });
      await prisma.groom.deleteMany({
        where: { id: retiredGroom.id },
      });
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testHorse) {
      await prisma.horse.deleteMany({
        where: { id: testHorse.id },
      });
    }
    if (testUser) {
      await prisma.user.deleteMany({
        where: { id: testUser.id },
      });
    }
    await prisma.$disconnect();
  });

  describe('Legacy Eligibility', () => {
    test('should identify eligible retired groom', async () => {
      const eligibility = await checkLegacyEligibility(retiredGroom.id);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.level).toBe(8);
      expect(eligibility.experience).toBe(500);
      expect(eligibility.assignmentCount).toBe(2);
      expect(eligibility.availablePerks).toBeInstanceOf(Array);
      expect(eligibility.availablePerks.length).toBeGreaterThan(0);
    });

    test('should reject non-retired groom', async () => {
      // Create active groom
      const activeGroom = await prisma.groom.create({
        data: {
          name: `Active Groom ${Date.now()}`,
          personality: 'energetic',
          skillLevel: 'expert',
          speciality: 'general_grooming',
          userId: testUser.id ,
          level: 9,
          retired: false,
        },
      });

      const eligibility = await checkLegacyEligibility(activeGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('not_retired');

      // Cleanup
      await prisma.groom.delete({ where: { id: activeGroom.id } });
    });

    test('should reject low-level retired groom', async () => {
      // Create low-level retired groom
      const lowLevelGroom = await prisma.groom.create({
        data: {
          name: `Low Level Groom ${Date.now()}`,
          personality: 'methodical',
          skillLevel: 'intermediate',
          speciality: 'specialized_disciplines',
          userId: testUser.id ,
          level: 5,
          retired: true,
          retirementReason: 'voluntary',
        },
      });

      const eligibility = await checkLegacyEligibility(lowLevelGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('insufficient_level');

      // Cleanup
      await prisma.groom.delete({ where: { id: lowLevelGroom.id } });
    });

    test('should reject groom with existing legacy', async () => {
      // Create a protégé first
      const protege = await prisma.groom.create({
        data: {
          name: `Existing Protégé ${Date.now()}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foal_care',
          userId: testUser.id ,
          level: 1,
        },
      });

      // Create legacy log
      await prisma.groomLegacyLog.create({
        data: {
          retiredGroomId: retiredGroom.id,
          legacyGroomId: protege.id,
          inheritedPerk: 'gentle_hands',
          mentorLevel: retiredGroom.level,
        },
      });

      const eligibility = await checkLegacyEligibility(retiredGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('legacy_already_created');

      // Cleanup
      await prisma.groomLegacyLog.deleteMany({
        where: { retiredGroomId: retiredGroom.id },
      });
      await prisma.groom.delete({ where: { id: protege.id } });
    });
  });

  describe('Protégé Generation', () => {
    test('should generate protégé with inherited perks', async () => {
      const protegeData = {
        name: 'Young Apprentice',
        personality: 'energetic',
        skillLevel: 'novice',
        speciality: 'foal_care',
      };

      const result = await generateLegacyProtege(retiredGroom.id, protegeData, testUser.id);

      expect(result.protege).toBeDefined();
      expect(result.protege.name).toBe('Young Apprentice');
      expect(result.protege.personality).toBe('energetic');
      expect(result.inheritedPerk).toBeDefined();
      expect(result.legacyLog).toBeDefined();

      // Verify protégé has bonus from inheritance
      expect(result.protege.experience).toBeGreaterThan(0);

      // Verify legacy log was created
      const legacyLog = await prisma.groomLegacyLog.findUnique({
        where: { id: result.legacyLog.id },
      });
      expect(legacyLog.retiredGroomId).toBe(retiredGroom.id);
      expect(legacyLog.legacyGroomId).toBe(result.protege.id);

      // Cleanup
      await prisma.groomLegacyLog.delete({ where: { id: result.legacyLog.id } });
      await prisma.groom.delete({ where: { id: result.protege.id } });
    });

    test('should reject generation for ineligible mentor', async () => {
      // Create ineligible groom
      const ineligibleGroom = await prisma.groom.create({
        data: {
          name: `Ineligible Groom ${Date.now()}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foal_care',
          userId: testUser.id ,
          level: 3,
          retired: true,
        },
      });

      const protegeData = {
        name: 'Failed Apprentice',
        personality: 'calm',
        skillLevel: 'novice',
        speciality: 'foal_care',
      };

      await expect(generateLegacyProtege(ineligibleGroom.id, protegeData, testUser.id)).rejects.toThrow(
        'not eligible for legacy creation',
      );

      // Cleanup
      await prisma.groom.delete({ where: { id: ineligibleGroom.id } });
    });
  });

  describe('Legacy Perks', () => {
    test('should get available perks for personality type', async () => {
      const calmPerks = getLegacyPerks('calm');
      const energeticPerks = getLegacyPerks('energetic');
      const methodicalPerks = getLegacyPerks('methodical');

      expect(calmPerks).toBeInstanceOf(Array);
      expect(energeticPerks).toBeInstanceOf(Array);
      expect(methodicalPerks).toBeInstanceOf(Array);

      expect(calmPerks.length).toBeGreaterThan(0);
      expect(energeticPerks.length).toBeGreaterThan(0);
      expect(methodicalPerks.length).toBeGreaterThan(0);

      // Verify perks have required structure
      calmPerks.forEach(perk => {
        expect(perk).toHaveProperty('id');
        expect(perk).toHaveProperty('name');
        expect(perk).toHaveProperty('description');
        expect(perk).toHaveProperty('effect');
      });
    });

    test('should handle unknown personality type', async () => {
      const unknownPerks = getLegacyPerks('unknown');
      expect(unknownPerks).toBeInstanceOf(Array);
      expect(unknownPerks.length).toBe(0);
    });
  });

  describe('Legacy History', () => {
    test('should track user legacy history', async () => {
      // Create a protégé to establish history
      const protegeData = {
        name: 'History Test Apprentice',
        personality: 'methodical',
        skillLevel: 'novice',
        speciality: 'specialized_disciplines',
      };

      const result = await generateLegacyProtege(retiredGroom.id, protegeData, testUser.id);

      // Get user legacy history
      const history = await getUserLegacyHistory(testUser.id);

      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThanOrEqual(1);

      const legacyEntry = history.find(entry => entry.retiredGroomId === retiredGroom.id);
      expect(legacyEntry).toBeDefined();
      expect(legacyEntry.retiredGroomName).toBe(retiredGroom.name);
      expect(legacyEntry.protegeGroomName).toBe('History Test Apprentice');
      expect(legacyEntry.inheritedPerk).toBeDefined();

      // Cleanup
      await prisma.groomLegacyLog.delete({ where: { id: result.legacyLog.id } });
      await prisma.groom.delete({ where: { id: result.protege.id } });
    });
  });
});
