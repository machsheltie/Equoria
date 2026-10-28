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
import { randomBytes } from 'node:crypto';
import {
  checkLegacyEligibility,
  generateLegacyProtege,
  getLegacyPerks,
  getUserLegacyHistory,
} from '../../modules/grooms/services/groomLegacyService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-w5n8c: serialise arrange-step create burst (jpmza sibling).
import { createSequentially } from '../helpers/createSequentially.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

describe('Groom Legacy Service', () => {
  let testUser;
  let testHorse;
  let retiredGroom;
  const testRunId = `legacy_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}_${Math.floor(Math.random() * 100000)}`;
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
        ...fixtureColor(),
        name: testHorseName,
        sex: 'Stallion',
        dateOfBirth: gameCalendarDate(new Date(), -365), // 1 year old
        userId: testUser.id,
        bondScore: 50,
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

    // Create a retired Expert groom for each test
    retiredGroom = await prisma.groom.create({
      data: {
        name: `Retired Master Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        personality: 'calm',
        skillLevel: 'expert',
        starLevel: 'expert',
        speciality: 'foalCare',
        userId: testUser.id,
        careerWeeks: 104,
        experience: 500,
        retired: true,
        retirementReason: 'mandatoryCareerLimit',
        retirementTimestamp: new Date(),
      },
    });

    // Create some assignment logs to show experience
    await createSequentially([
      () =>
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
      () =>
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
    // prisma.$disconnect() removed — global teardown handles disconnection
  });

  describe('Legacy Eligibility', () => {
    // Owner rulings 2026-10-28 (q229, q244; Equoria-2xxvd): no 1-10 level; the mentoring
    // level is the old level 1 (staffCareerStarLevel) for every groom, below Advanced, so no
    // groom mentors for now. Old contract: this level-8 groom was eligible / made a protégé.
    test('a retired Expert groom is not yet eligible to mentor (q244)', async () => {
      const eligibility = await checkLegacyEligibility(retiredGroom.id);

      expect(eligibility).toEqual({
        eligible: false,
        reason: expect.stringMatching(/^insufficient/),
        starLevel: 'expert',
        requiredStarLevel: 'advanced',
      });
    });

    test('should reject non-retired groom', async () => {
      // Create active groom
      const activeGroom = await prisma.groom.create({
        data: {
          name: `Active Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          personality: 'energetic',
          skillLevel: 'expert',
          speciality: 'generalGrooming',
          userId: testUser.id,
          retired: false,
        },
      });

      const eligibility = await checkLegacyEligibility(activeGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('not_retired');

      // Cleanup
      await prisma.groom.deleteMany({ where: { id: activeGroom.id } });
    });

    test('should reject low-level retired groom', async () => {
      // Create low-level retired groom
      const lowLevelGroom = await prisma.groom.create({
        data: {
          name: `Low Level Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          personality: 'methodical',
          skillLevel: 'intermediate',
          speciality: 'specializedDisciplines',
          userId: testUser.id,
          retired: true,
          retirementReason: 'voluntary',
        },
      });

      const eligibility = await checkLegacyEligibility(lowLevelGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('insufficient_level');

      // Cleanup
      await prisma.groom.deleteMany({ where: { id: lowLevelGroom.id } });
    });

    test('should reject groom with existing legacy', async () => {
      // Create a protégé first
      const protege = await prisma.groom.create({
        data: {
          name: `Existing Protégé ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foalCare',
          userId: testUser.id,
        },
      });

      // Create legacy log
      await prisma.groomLegacyLog.create({
        data: {
          retiredGroomId: retiredGroom.id,
          legacyGroomId: protege.id,
          inheritedPerk: 'gentle_hands',
        },
      });

      const eligibility = await checkLegacyEligibility(retiredGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('legacy_already_created');

      // Cleanup
      await prisma.groomLegacyLog.deleteMany({
        where: { retiredGroomId: retiredGroom.id },
      });
      await prisma.groom.deleteMany({ where: { id: protege.id } });
    });
  });

  describe('Protégé Generation', () => {
    // Owner rulings 2026-10-28 (q229, q244; Equoria-2xxvd): no 1-10 level; the mentoring
    // level is the old level 1 (staffCareerStarLevel) for every groom, below Advanced, so no
    // groom mentors for now. Old contract: this level-8 groom was eligible / made a protégé.
    test('a retired Expert groom makes no protégé and no legacy log (q244)', async () => {
      const protegeData = {
        name: `Young Apprentice ${randomBytes(4).toString('hex')}`,
        personality: 'energetic',
        skillLevel: 'novice',
        speciality: 'foalCare',
      };

      await expect(generateLegacyProtege(retiredGroom.id, protegeData, testUser.id)).rejects.toThrow(
        'not eligible for legacy creation',
      );

      expect(await prisma.groom.count({ where: { name: protegeData.name } })).toBe(0);
      expect(await prisma.groomLegacyLog.count({ where: { retiredGroomId: retiredGroom.id } })).toBe(0);
    });

    test('should reject generation for ineligible mentor', async () => {
      // Create ineligible groom
      const ineligibleGroom = await prisma.groom.create({
        data: {
          name: `Ineligible Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foalCare',
          userId: testUser.id,
          retired: true,
        },
      });

      const protegeData = {
        name: 'Failed Apprentice',
        personality: 'calm',
        skillLevel: 'novice',
        speciality: 'foalCare',
      };

      await expect(generateLegacyProtege(ineligibleGroom.id, protegeData, testUser.id)).rejects.toThrow(
        'not eligible for legacy creation',
      );

      // Cleanup
      await prisma.groom.deleteMany({ where: { id: ineligibleGroom.id } });
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
      // A legacy made before q244 (no groom mentors now): written directly.
      const protege = await prisma.groom.create({
        data: {
          name: 'History Test Apprentice',
          personality: 'methodical',
          skillLevel: 'novice',
          speciality: 'specializedDisciplines',
          userId: testUser.id,
        },
      });
      const legacyLog = await prisma.groomLegacyLog.create({
        data: {
          retiredGroomId: retiredGroom.id,
          legacyGroomId: protege.id,
          inheritedPerk: getLegacyPerks('calm')[0].id,
        },
      });
      const result = { legacyLog, protege };

      // Get user legacy history
      const history = await getUserLegacyHistory(testUser.id);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThanOrEqual(1);

      const legacyEntry = history.find(entry => entry.retiredGroomId === retiredGroom.id);
      expect(legacyEntry).toBeDefined();
      expect(legacyEntry.retiredGroomName).toBe(retiredGroom.name);
      expect(legacyEntry.protegeGroomName).toBe('History Test Apprentice');
      expect(legacyEntry.inheritedPerk).toBeDefined();
      // q229: stars, never the old 1-10 level.
      expect(legacyEntry.retiredGroomStarLevel).toBe('expert');
      expect(legacyEntry.protegeGroomStarLevel).toBe('rookie');
      expect(legacyEntry).not.toHaveProperty('mentorLevel');

      // Cleanup
      await prisma.groomLegacyLog.delete({ where: { id: result.legacyLog.id } });
      await prisma.groom.deleteMany({ where: { id: result.protege.id } });
    });
  });
});
