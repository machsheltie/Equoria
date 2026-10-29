/**
 * Groom Progression & Personality System Tests
 *
 * Tests the complete groom progression system including:
 * - Groom-horse synergy tracking
 * - Assignment history logging
 * - Enhanced profile API
 *
 * Following TDD approach with NO MOCKING as specified in project guidelines.
 * Tests validate real system behavior with actual database operations.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { updateGroomSynergy, logGroomAssignment, getGroomProfile } from '../services/groomProgressionService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

describe('Groom Progression System', () => {
  let testUser;
  let testGroom;
  let testHorse;
  const testUserId = 'test-user-progression';
  const testBreedName = 'GroomProgressionSuite_Breed'; // suite-unique to avoid cross-suite deletes (Equoria-cqry)

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
          emailVerified: true,
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
          speciality: 'foalCare',
          experience: 0,
          skillLevel: 'novice',
          personality: 'gentle',
          epigeneticInfluenceType: 'calm',
          sessionRate: 25.0,
          userId: testUser.id,
        },
      });

      testHorse = await tx.horse.create({
        data: await testHorseData(tx, {
          ...fixtureColor(),
          name: 'Test Foal',
          sex: 'Filly',
          dateOfBirth: gameCalendarDate(new Date(), -365), // 1 year old
          userId: testUser.id,
          breedId: testBreed.id,
        }),
      });
    });
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterEach(async () => {
    await cleanupProgressionData();
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  // Owner ruling 2026-10-21 (Equoria-dea06): grooms are fixed NPCs that never
  // earn XP and keep their generated level. Old contract: an 'XP and Leveling
  // System' block here pinned awardGroomXP (milestone/trait/show XP, level-ups,
  // the level-10 cap) and calculateGroomLevel. Both were removed with the
  // ruling; staffAreFixedNpcs.integration.test.mjs pins the new contract.

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
      // Set up some progression data. Owner ruling 2026-10-21 (Equoria-dea06):
      // a groom's experience/level are generated, never earned (old contract:
      // awardGroomXP(150) raised it to level 2), so set them as generation would.
      await prisma.groom.update({ where: { id: testGroom.id }, data: { experience: 150, starLevel: 'novice' } });
      await updateGroomSynergy(testGroom.id, testHorse.id, 'milestone_completed', 3);
      await logGroomAssignment(testGroom.id, testHorse.id, 'assigned');

      const profile = await getGroomProfile(testGroom.id);

      expect(profile.success).toBe(true);
      expect(profile.groom).toBeDefined();
      expect(profile.groom.id).toBe(testGroom.id);
      expect(profile.groom.personality).toBe('gentle');
      expect(profile.groom.experience).toBe(150);
      // Owner ruling 2026-10-28 (q229): grooms carry a star level, not the old 1-10 level.
      expect(profile.groom.starLevel).toBe('novice');
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
