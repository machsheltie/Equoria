/**
 * Groom Progression & Personality System Tests
 *
 * Tests the complete groom progression system including:
 * - XP gain and leveling mechanics
 * - Groom-horse synergy tracking
 * - Assignment history logging
 * - Enhanced profile API
 *
 * Following TDD approach with NO MOCKING as specified in project guidelines.
 * Tests validate real system behavior with actual database operations.
 */

import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.js';
import {
  awardGroomXP,
  calculateGroomLevel,
  updateGroomSynergy,
  logGroomAssignment,
  getGroomProfile,
} from '../services/groomProgressionService.mjs';

const prisma = new PrismaClient();

describe('Groom Progression System', () => {
  let testUser;
  let testGroom;
  let testHorse;
  const testUserId = 'test-user-progression';
  const testBreedName = 'Test Breed';

  const cleanupProgressionData = async () => {
    const grooms = await prisma.groom.findMany({
      where: { userId: testUserId },
      select: { id: true },
    });
    const horses = await prisma.horse.findMany({
      where: { userId: testUserId },
      select: { id: true },
    });

    const groomIds = grooms.map(groom => groom.id);
    const horseIds = horses.map(horse => horse.id);

    if (groomIds.length || horseIds.length) {
      await prisma.groomAssignmentLog.deleteMany({
        where: {
          OR: [
            ...(groomIds.length ? [{ groomId: { in: groomIds } }] : []),
            ...(horseIds.length ? [{ horseId: { in: horseIds } }] : []),
          ],
        },
      });
      await prisma.groomHorseSynergy.deleteMany({
        where: {
          OR: [
            ...(groomIds.length ? [{ groomId: { in: groomIds } }] : []),
            ...(horseIds.length ? [{ horseId: { in: horseIds } }] : []),
          ],
        },
      });
      await prisma.groomAssignment.deleteMany({
        where: {
          OR: [
            ...(groomIds.length ? [{ groomId: { in: groomIds } }] : []),
            ...(horseIds.length ? [{ foalId: { in: horseIds } }] : []),
          ],
        },
      });
    }

    await prisma.groom.deleteMany({ where: { userId: testUserId } });
    await prisma.horse.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.breed.deleteMany({ where: { name: testBreedName } });
  };

  beforeEach(async () => {
    await cleanupProgressionData();

    await prisma.$transaction(async tx => {
      testUser = await tx.user.create({
        data: {
          id: testUserId,
          username: 'progressiontest',
          email: 'progression@test.com',
          firstName: 'Test',
          lastName: 'User',
          password: 'TestPassword123!',
          money: 5000,
        },
      });

      const testBreed = await tx.breed.create({
        data: {
          name: testBreedName,
          description: 'A test breed for progression tests',
        },
      });

      testGroom = await tx.groom.create({
        data: {
          name: 'Test Groom',
          speciality: 'foal_care',
          experience: 0,
          level: 1,
          skillLevel: 'novice',
          personality: 'gentle',
          groomPersonality: 'calm',
          sessionRate: 25.0,
          userId: testUser.id,
        },
      });

      testHorse = await tx.horse.create({
        data: {
          name: 'Test Foal',
          sex: 'Filly',
          dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
          userId: testUser.id,
          breedId: testBreed.id,
        },
      });
    });
  });

  afterEach(async () => {
    await cleanupProgressionData();
  });

  describe('XP and Leveling System', () => {
    test('Should award XP for milestone completion', async () => {
      const result = await awardGroomXP(testGroom.id, 'milestone_completion', 20);

      expect(result.success).toBe(true);
      expect(result.xpGained).toBe(20);
      expect(result.newExperience).toBe(20);
      expect(result.levelUp).toBe(false);
      expect(result.newLevel).toBe(1);
    });

    test('Should award XP for trait shaping', async () => {
      const result = await awardGroomXP(testGroom.id, 'trait_shaped', 10);

      expect(result.success).toBe(true);
      expect(result.xpGained).toBe(10);
      expect(result.newExperience).toBe(10);
    });

    test('Should award XP for show wins', async () => {
      const result = await awardGroomXP(testGroom.id, 'show_win', 15);

      expect(result.success).toBe(true);
      expect(result.xpGained).toBe(15);
      expect(result.newExperience).toBe(15);
    });

    test('Should level up when reaching XP threshold', async () => {
      // Award 100 XP to reach level 2 (100 * 1 = 100 XP required)
      const result = await awardGroomXP(testGroom.id, 'milestone_completion', 100);

      expect(result.success).toBe(true);
      expect(result.xpGained).toBe(100);
      expect(result.newExperience).toBe(100);
      expect(result.levelUp).toBe(true);
      expect(result.newLevel).toBe(2);
    });

    test('Should calculate correct level from experience', () => {
      expect(calculateGroomLevel(0)).toBe(1);
      expect(calculateGroomLevel(50)).toBe(1);
      expect(calculateGroomLevel(100)).toBe(2);
      expect(calculateGroomLevel(300)).toBe(3); // 100 + 200 = 300
      expect(calculateGroomLevel(600)).toBe(4); // 100 + 200 + 300 = 600
      expect(calculateGroomLevel(1000)).toBe(5); // 100 + 200 + 300 + 400 = 1000
    });

    test('Should cap level at 10', async () => {
      // Award massive XP to test level cap
      const result = await awardGroomXP(testGroom.id, 'milestone_completion', 10000);

      expect(result.newLevel).toBeLessThanOrEqual(10);
    });
  });

  describe('Groom-Horse Synergy System', () => {
    test('Should create synergy record for new groom-horse pair', async () => {
      const result = await updateGroomSynergy(testGroom.id, testHorse.id, 'milestone_completed', 1);

      expect(result.success).toBe(true);
      expect(result.synergyGained).toBe(1);
      expect(result.newSynergyScore).toBe(1);
      expect(result.sessionsTogether).toBe(1);
    });

    test('Should award correct synergy for different actions', async () => {
      // Test milestone completion (+1)
      await updateGroomSynergy(testGroom.id, testHorse.id, 'milestone_completed', 1);

      // Test trait shaped (+2)
      const traitResult = await updateGroomSynergy(testGroom.id, testHorse.id, 'trait_shaped', 1);
      expect(traitResult.newSynergyScore).toBe(3); // 1 + 2

      // Test rare trait influenced (+3)
      const rareResult = await updateGroomSynergy(testGroom.id, testHorse.id, 'rare_trait_influenced', 1);
      expect(rareResult.newSynergyScore).toBe(6); // 3 + 3
    });

    test('Should penalize synergy for reassignment', async () => {
      // Build up some synergy first
      await updateGroomSynergy(testGroom.id, testHorse.id, 'milestone_completed', 5);

      // Test reassignment penalty (-5)
      const result = await updateGroomSynergy(testGroom.id, testHorse.id, 'reassigned_early', 1);
      expect(result.newSynergyScore).toBe(0); // 5 - 5, minimum 0
    });

    test('Should track sessions together', async () => {
      await updateGroomSynergy(testGroom.id, testHorse.id, 'milestone_completed', 1);
      await updateGroomSynergy(testGroom.id, testHorse.id, 'trait_shaped', 1);

      const synergy = await prisma.groomHorseSynergy.findFirst({
        where: { groomId: testGroom.id, horseId: testHorse.id },
      });

      expect(synergy.sessionsTogether).toBe(2);
    });
  });

  describe('Assignment History Logging', () => {
    test('Should log assignment start', async () => {
      const result = await logGroomAssignment(testGroom.id, testHorse.id, 'assigned');

      expect(result.success).toBe(true);
      expect(result.assignmentLog).toBeDefined();
      expect(result.assignmentLog.assignedAt).toBeDefined();
      expect(result.assignmentLog.unassignedAt).toBeNull();
    });

    test('Should log assignment completion with performance data', async () => {
      // Start assignment
      await logGroomAssignment(testGroom.id, testHorse.id, 'assigned');

      // Complete assignment with performance data
      const result = await logGroomAssignment(testGroom.id, testHorse.id, 'unassigned', {
        milestonesCompleted: 2,
        traitsShaped: ['confident', 'calm'],
        xpGained: 30,
      });

      expect(result.success).toBe(true);
      expect(result.assignmentLog.unassignedAt).toBeDefined();
      expect(result.assignmentLog.milestonesCompleted).toBe(2);
      expect(result.assignmentLog.traitsShaped).toEqual(['confident', 'calm']);
      expect(result.assignmentLog.xpGained).toBe(30);
    });
  });

  describe('Enhanced Groom Profile API', () => {
    test('Should return comprehensive groom profile', async () => {
      // Set up some progression data
      await awardGroomXP(testGroom.id, 'milestone_completion', 150); // Level 2
      await updateGroomSynergy(testGroom.id, testHorse.id, 'milestone_completed', 3);
      await logGroomAssignment(testGroom.id, testHorse.id, 'assigned');

      const profile = await getGroomProfile(testGroom.id);

      expect(profile.success).toBe(true);
      expect(profile.groom).toBeDefined();
      expect(profile.groom.id).toBe(testGroom.id);
      expect(profile.groom.personality).toBe('gentle');
      expect(profile.groom.experience).toBe(150);
      expect(profile.groom.level).toBe(2);
      expect(profile.groom.synergyRecords).toBeDefined();
      expect(profile.groom.assignmentHistory).toBeDefined();
      expect(profile.groom.currentAssignments).toBeDefined();
    });

    test('Should include synergy effects in profile', async () => {
      // Build synergy to trigger effects - need to call multiple times to reach 25
      // milestone_completed gives +1 each time, so call 25 times
      for (let i = 0; i < 25; i++) {
        await updateGroomSynergy(testGroom.id, testHorse.id, 'milestone_completed');
      }

      const profile = await getGroomProfile(testGroom.id);
      const synergyRecord = profile.groom.synergyRecords.find(s => s.horseId === testHorse.id);

      expect(synergyRecord.synergyScore).toBe(25);
      expect(synergyRecord.effects).toBeDefined();
      expect(synergyRecord.effects.bondGrowthBonus).toBe(5); // +5% at 25 synergy
    });
  });
});
