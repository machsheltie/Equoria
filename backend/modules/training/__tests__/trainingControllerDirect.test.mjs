/**
 * INTEGRATION TEST: Training controller functions against the real test database
 * (canTrain, trainHorse, getTrainingStatus, getTrainableHorses, trainRouteHandler).
 *
 * Rules covered: 3+ years to train; one global 7-day cooldown per horse (not per
 * discipline); a successful session awards the player 5 XP, writes a training log and
 * claims the cooldown; the status and trainable lists reflect age and cooldown.
 * Nothing is mocked. trainRouteHandler is driven with a plain req/res pair.
 */

import { jest, describe, beforeAll, beforeEach, afterAll, expect, it } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { invalidateCache } from '../../../utils/cacheHelper.mjs';

// Import the actual controller - no complex mocking
import {
  canTrain,
  trainHorse,
  getTrainingStatus,
  getTrainableHorses,
  trainRouteHandler,
} from '../controllers/trainingController.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { assignTestTrainer, cleanupTestTrainers } from '../../../tests/helpers/assignTrainer.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

afterAll(() => cleanupTestTrainers(), 60000);

// Test data setup
let testUser;
let testBreedId;
let testHorseEligible;
let testHorseAdult;
let testHorse4Years;
let testHorseYoung;
let testHorseRecentTraining;

// Equoria-h40y6: every fixture's cleanup is registered the moment it exists, scoped
// to this suite's own user and breed ids, so a setup that fails part-way still
// removes what it created (the old afterAll read testHorseAdult.id and threw before
// deleting anything, leaking the TrainingTestBreed_* row and its first horse).
const cleanup = createCleanupTracker();

// A fresh 4 game-year-old horse with a trainer, owned by the suite's user. Tests that
// need their own horse create it here and delete it when done.
async function createFreshAdultHorse(name, sex = 'Stallion') {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name,
      dateOfBirth: birthDateForAge(4), // 4 game-years (28 days) — Equoria-vdw5/ffsi
      sex,
      userId: testUser.id,
      breedId: testBreedId,
      speed: 50,
      stamina: 50,
      agility: 50,
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
    }),
  });
  await assignTestTrainer(horse);
  return horse;
}

describe('🏋️ UNIT: Training Controller - Horse Training Business Logic', () => {
  beforeAll(async () => {
    // Create test user (unique username to avoid conflicts)
    const timestamp = Date.now();
    testUser = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `test-training-user-${timestamp}`,
        email: `training-${timestamp}@test.com`,
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
        xp: 100,
        level: 2,
        money: 5000,
      },
    });
    const testUserId = testUser.id;
    // FK order: training logs, then horses (their trainer assignments cascade),
    // then the breed the horses reference, then the user.
    cleanup.add(() => prisma.trainingLog.deleteMany({ where: { horse: { userId: testUserId } } }), 'trainingLogs');
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: testUserId } }), 'horses');
    cleanup.add(() => (testBreedId ? prisma.breed.deleteMany({ where: { id: testBreedId } }) : undefined), 'breed');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: testUserId } }), 'user');

    // Create test breed (required for foreign key constraint)
    // Use a unique name to avoid collisions with parallel test suites
    const testBreed = await prisma.breed.create({
      data: {
        name: `TrainingTestBreed_${timestamp}`,
        description: 'Test breed for training tests',
      },
    });
    testBreedId = testBreed.id;

    // Game-year aging (Equoria-vdw5/ffsi): 1 game-year = 7 real days, so dateOfBirth is
    // back-dated in GAME-years; birthDateForAge stores the Eastern game date, so the age
    // holds at any hour (Equoria-4urzd). 4 game-years old: eligible (age >= 3).
    const fourYearsAgo = birthDateForAge(4);

    testHorseEligible = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: 'Eligible Horse',
        dateOfBirth: fourYearsAgo,
        age: 4,
        sex: 'Stallion',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 50,
        stamina: 50,
        agility: 50,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      }),
    });
    await assignTestTrainer(testHorseEligible);
    testHorse4Years = testHorseEligible;

    // Create additional adult horse (3 game-years old): 21 days ago (eligible)
    const threeYearsAgo = birthDateForAge(3);

    testHorseAdult = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: 'Adult Horse',
        dateOfBirth: threeYearsAgo,
        age: 3,
        sex: 'Mare',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 45,
        stamina: 45,
        agility: 45,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      }),
    });
    await assignTestTrainer(testHorseAdult);

    // Create young horse (2 game-years old, under the age:3 training gate).
    // 14 days = exactly 2 game-years; add a 1-day buffer (15 days) so floor()
    // reliably returns 2 and never rounds down to 1 near the boundary, while
    // staying below 21 days (3 game-years) so the horse remains under-age.
    const twoYearsAgo = gameCalendarDate(new Date(), -15);

    testHorseYoung = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: 'Young Horse',
        dateOfBirth: twoYearsAgo,
        age: 2,
        sex: 'Mare',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 40,
        stamina: 40,
        agility: 40,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      }),
    });
    await assignTestTrainer(testHorseYoung);

    // Create horse with recent training
    testHorseRecentTraining = await prisma.horse.create({
      data: await testHorseData(prisma, {
        ...fixtureColor(),
        name: 'Recently Trained Horse',
        dateOfBirth: fourYearsAgo,
        age: 4,
        sex: 'Stallion',
        userId: testUser.id,
        breedId: testBreedId,
        speed: 60,
        stamina: 60,
        agility: 60,
        healthStatus: 'Excellent',
        lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      }),
    });
    await assignTestTrainer(testHorseRecentTraining);

    // Add recent training log (3 days ago)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await prisma.trainingLog.create({
      data: {
        horseId: testHorseRecentTraining.id,
        discipline: 'Racing',
        trainedAt: threeDaysAgo,
      },
    });
    // Equoria-w0qb7: a real train call also claims Horse.trainingCooldown, the one
    // cooldown source the readers use (old contract: they read the latest TrainingLog).
    await prisma.horse.update({
      where: { id: testHorseRecentTraining.id },
      data: { trainingCooldown: new Date(threeDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000) },
    });
  });

  afterAll(() => cleanup.run(), 60000);

  beforeEach(async () => {
    // Reset any state changes between tests
    jest.clearAllMocks();
    await prisma.trainingLog.deleteMany({
      where: {
        horseId: {
          in: [testHorseEligible.id, testHorseAdult.id],
        },
      },
    });

    // Equoria-0ihyi: trainHorse's gate persists the cooldown atomically; reset it alongside
    // the trainingLog purge so each test starts with a clean cooldown window.
    await prisma.horse.updateMany({
      where: { id: { in: [testHorseEligible.id, testHorseAdult.id] } },
      data: { trainingCooldown: null },
    });

    // The trainable list is cached for 5 minutes; drop it so no test reads a stale list.
    await invalidateCache(`user:trainable:${testUser.id}`);
  });

  describe('canTrain', () => {
    it('should return eligible true for horse that meets all requirements', async () => {
      const result = await canTrain(testHorseEligible.id, 'Dressage');

      expect(result).toEqual({
        eligible: true,
        reason: null,
      });
    });

    it('should return eligible false for horse under 3 years old', async () => {
      const result = await canTrain(testHorseYoung.id, 'Dressage');

      expect(result).toEqual({
        eligible: false,
        reason: 'Horse is under age',
      });
    });

    it('should return eligible false for horse with recent training in any discipline', async () => {
      const result = await canTrain(testHorseRecentTraining.id, 'Dressage');

      expect(result).toEqual({
        eligible: false,
        reason: 'Training cooldown active for this horse',
      });
    });

    it('should return eligible true for horse with old training (8+ days ago)', async () => {
      // Create a horse with old training
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const oldTrainingHorse = await createFreshAdultHorse('Old Training Horse', 'Stallion');

      await prisma.trainingLog.create({
        data: {
          horseId: oldTrainingHorse.id,
          discipline: 'Racing',
          trainedAt: eightDaysAgo,
        },
      });

      const result = await canTrain(oldTrainingHorse.id, 'Dressage');

      expect(result).toEqual({
        eligible: true,
        reason: null,
      });

      // Cleanup
      await prisma.trainingLog.deleteMany({
        where: { horseId: oldTrainingHorse.id },
      });
      await prisma.horse.delete({
        where: { id: oldTrainingHorse.id },
      });
    });

    it('should return eligible false for non-existent horse', async () => {
      // Use non-existent horse ID 999999999 (well above current DB sequence ceiling)
      const result = await canTrain(999999999, 'Dressage');

      expect(result).toEqual({
        eligible: false,
        reason: 'Horse not found',
      });
    });

    it('should throw error for invalid horse ID', async () => {
      await expect(canTrain('invalid', 'Dressage')).rejects.toThrow('Horse ID must be a positive integer');
    });

    it('should throw error for missing discipline', async () => {
      await expect(canTrain(1, '')).rejects.toThrow('Discipline is required');
    });

    it('should throw error for missing horse ID', async () => {
      await expect(canTrain(null, 'Dressage')).rejects.toThrow('Horse ID is required');
    });

    it('should calculate cooldown correctly for edge case (exactly 7 days)', async () => {
      // Create a horse with training exactly 7 days and 2 seconds ago (just over 7 days)
      // Use ms arithmetic to guarantee the timestamp is strictly > 7 * 24 * 60 * 60 * 1000 ms
      // in the past regardless of test execution timing (avoids setDate/setSeconds drift)
      const exactlySevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 + 2000));

      const edgeCaseHorse = await createFreshAdultHorse('Edge Case Horse', 'Mare');

      await prisma.trainingLog.create({
        data: {
          horseId: edgeCaseHorse.id,
          discipline: 'Racing',
          trainedAt: exactlySevenDaysAgo,
        },
      });

      const result = await canTrain(edgeCaseHorse.id, 'Dressage');

      expect(result).toEqual({
        eligible: true,
        reason: null,
      });

      // Cleanup
      await prisma.trainingLog.deleteMany({
        where: { horseId: edgeCaseHorse.id },
      });
      await prisma.horse.delete({
        where: { id: edgeCaseHorse.id },
      });
    });
  });

  describe('trainHorse', () => {
    it('should successfully train eligible horse', async () => {
      // Use the eligible test horse (4 years old, no recent training)
      const result = await trainHorse(testHorseEligible.id, 'Racing');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Horse trained successfully in Racing');
      expect(result.updatedHorse.name).toBe('Eligible Horse');
      expect(result.nextEligible).toBeDefined();
      expect(result.traitEffects).toBeDefined();

      // Verify training log was created
      const trainingLog = await prisma.trainingLog.findFirst({
        where: {
          horseId: testHorseEligible.id,
          discipline: 'Racing',
        },
      });
      expect(trainingLog).toBeTruthy();
      expect(trainingLog.discipline).toBe('Racing');
    });

    it('should reject training for ineligible horse (under age)', async () => {
      // Use the young test horse (2 years old, fails age requirement)
      const result = await trainHorse(testHorseYoung.id, 'Racing');

      expect(result).toEqual({
        success: false,
        reason: 'Horse is under age',
        updatedHorse: null,
        message: 'Training not allowed: Horse is under age',
        nextEligible: null,
      });
    });

    it('should reject training for horse in cooldown', async () => {
      // Use the horse with recent training (3 days ago, within 7-day cooldown)
      const result = await trainHorse(testHorseRecentTraining.id, 'Racing');

      expect(result).toEqual({
        success: false,
        reason: 'Training cooldown active for this horse',
        updatedHorse: null,
        message: 'Training not allowed: Training cooldown active for this horse',
        nextEligible: null,
      });
    });

    it('should award +5 XP after successful training', async () => {
      // Get initial XP for comparison
      const userBefore = await prisma.user.findUnique({
        where: { id: testUser.id },
      });

      // Use the eligible test horse for training
      const result = await trainHorse(testHorseEligible.id, 'Dressage');

      // Verify training success
      expect(result.success).toBe(true);
      expect(result.message).toContain('Horse trained successfully in Dressage');
      expect(result.updatedHorse.name).toBe('Eligible Horse');

      // Verify XP was awarded (+5 for training)
      const userAfter = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(userAfter.xp).toBe(userBefore.xp + 5);
    });

    // Merged from the former controller business-logic suite (Equoria-k1vly).
    it('should refuse a horse that does not exist', async () => {
      const result = await trainHorse(999999999, 'Dressage');

      expect(result).toEqual(
        expect.objectContaining({ success: false, message: expect.stringContaining('Horse not found') }),
      );
    });

    it('should throw when the discipline is empty', async () => {
      await expect(trainHorse(testHorseEligible.id, '')).rejects.toThrow('Discipline is required');
    });

    it('should carry a horse through open status, training, log and cooldown status', async () => {
      const before = await getTrainingStatus(testHorseEligible.id, 'Racing');
      expect(before).toEqual(
        expect.objectContaining({
          eligible: true,
          reason: null,
          horseAge: expect.any(Number),
          lastTrainingDate: null,
          cooldown: null,
        }),
      );

      const trained = await trainHorse(testHorseEligible.id, 'Racing');
      expect(trained).toEqual(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
          updatedHorse: expect.objectContaining({
            id: testHorseEligible.id,
            disciplineScores: expect.objectContaining({ Racing: expect.any(Number) }),
          }),
        }),
      );

      const log = await prisma.trainingLog.findFirst({
        where: { horseId: testHorseEligible.id, discipline: 'Racing' },
        orderBy: { trainedAt: 'desc' },
      });
      expect(log).not.toBeNull();
      expect(log.discipline).toBe('Racing');
      // Cross-VM-realm safe Date check: toBeInstanceOf(Date) fails with --experimental-vm-modules.
      expect(Object.prototype.toString.call(log.trainedAt)).toBe('[object Date]');

      const after = await getTrainingStatus(testHorseEligible.id, 'Racing');
      expect(Object.prototype.toString.call(after.lastTrainingDate)).toBe('[object Date]');
      expect(after).toEqual(
        expect.objectContaining({
          eligible: false,
          reason: expect.any(String),
          horseAge: expect.any(Number),
          cooldown: expect.objectContaining({ active: true, remainingDays: expect.any(Number) }),
        }),
      );
    });
  });

  describe('getTrainingStatus', () => {
    // No mock setup needed - using real test data

    it('should return complete status for eligible horse with no training history', async () => {
      // Use the eligible test horse (4 years old, no training history)
      const result = await getTrainingStatus(testHorseEligible.id, 'Racing');
      // The horse's stored Racing score (an earlier case in this file trains it).
      const { disciplineScores } = await prisma.horse.findUnique({
        where: { id: testHorseEligible.id },
        select: { disciplineScores: true },
      });

      expect(result).toEqual({
        eligible: true,
        reason: null,
        horseAge: 4, // testHorseEligible is 4 years old
        // Equoria-t6rdk: the status carries the horse's score in the discipline
        // (old contract: no score field, so the popup previewed 0 + 5).
        score: disciplineScores?.Racing ?? 0,
        lastTrainingDate: null,
        nextEligibleDate: null,
        cooldown: null,
      });
    });

    it('should return complete status for horse in active cooldown', async () => {
      // Use the horse with recent training (3 days ago, within 7-day cooldown)
      const result = await getTrainingStatus(testHorseRecentTraining.id, 'Dressage');

      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Training cooldown active for this horse');
      expect(result.horseAge).toBe(4);
      expect(result.lastTrainingDate).toBe(null); // No training in Dressage specifically
      expect(result.cooldown.active).toBe(true);
      expect(result.cooldown.remainingDays).toBeGreaterThan(0);
      expect(result.cooldown.lastTrainingDate).toBeDefined(); // Should have the training date from Racing
    });

    it('should return complete status for horse with expired cooldown', async () => {
      // Create a horse with training 8 days ago (expired cooldown)
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

      const expiredCooldownHorse = await createFreshAdultHorse('Expired Cooldown Horse', 'Stallion');

      await prisma.trainingLog.create({
        data: {
          horseId: expiredCooldownHorse.id,
          discipline: 'Racing',
          trainedAt: eightDaysAgo,
        },
      });

      const result = await getTrainingStatus(expiredCooldownHorse.id, 'Racing');

      expect(result.eligible).toBe(true);
      expect(result.reason).toBe(null);
      expect(result.horseAge).toBe(4);
      expect(result.lastTrainingDate).toBeDefined();
      expect(result.cooldown.active).toBe(false);
      expect(result.cooldown.remainingDays).toBe(0);

      // Cleanup
      await prisma.trainingLog.deleteMany({
        where: { horseId: expiredCooldownHorse.id },
      });
      await prisma.horse.delete({
        where: { id: expiredCooldownHorse.id },
      });
    });

    it('should return status for ineligible horse (under age)', async () => {
      // Use the young test horse (2 years old, fails age requirement)
      const result = await getTrainingStatus(testHorseYoung.id, 'Racing');

      expect(result).toEqual({
        eligible: false,
        reason: 'Horse is under age',
        horseAge: 2,
        score: 0, // Equoria-t6rdk: the horse's score in the discipline
        lastTrainingDate: null,
        nextEligibleDate: null,
        cooldown: null,
      });
    });

    // Merged from the former controller business-logic suite (Equoria-k1vly).
    it('should report the last training date for a horse in cooldown in that same discipline', async () => {
      const result = await getTrainingStatus(testHorseRecentTraining.id, 'Racing');

      expect(Object.prototype.toString.call(result.lastTrainingDate)).toBe('[object Date]');
      expect(result).toEqual(
        expect.objectContaining({
          eligible: false,
          reason: expect.any(String),
          horseAge: expect.any(Number),
          cooldown: expect.objectContaining({ active: true, remainingDays: expect.any(Number) }),
        }),
      );
    });

    it('should report Horse not found for a horse that does not exist', async () => {
      const result = await getTrainingStatus(999999999, 'Dressage');

      expect(result).toEqual(expect.objectContaining({ eligible: false, reason: 'Horse not found' }));
    });
  });

  describe('Integration scenarios', () => {
    // No mock setup needed - using real test data

    it('should handle different disciplines with global cooldown', async () => {
      // Use horse with recent training (3 days ago in Racing, within 7-day cooldown)
      const racingResult = await canTrain(testHorseRecentTraining.id, 'Racing');
      const jumpingResult = await canTrain(testHorseRecentTraining.id, 'Show Jumping');

      // Both should be blocked due to global cooldown (global 7-day rule)
      expect(racingResult.eligible).toBe(false);
      expect(racingResult.reason).toBe('Training cooldown active for this horse');

      expect(jumpingResult.eligible).toBe(false);
      expect(jumpingResult.reason).toBe('Training cooldown active for this horse');
    });
  });

  describe('getTrainableHorses', () => {
    // No mock setup needed - using real test data

    it('should return all horses for user with eligibility info', async () => {
      // Returns ALL horses (including young and on-cooldown) with eligibility data
      const result = await getTrainableHorses(testUser.id);

      // Should return all 4 horses with eligibility status
      expect(result).toHaveLength(4);

      // Verify all horses are present
      const horseIds = result.map(horse => horse.horseId).sort();
      expect(horseIds).toEqual(
        [testHorseAdult.id, testHorse4Years.id, testHorseYoung.id, testHorseRecentTraining.id].sort(),
      );

      // Eligible horses have disciplines and no nextEligibleAt
      const adultHorse = result.find(h => h.horseId === testHorseAdult.id);
      // All 22 standard disciplines (Gaited excluded — requires Gaited trait)
      expect(adultHorse.trainableDisciplines).not.toContain('Gaited');
      expect(adultHorse.trainableDisciplines.length).toBeGreaterThanOrEqual(20);
      expect(adultHorse.trainableDisciplines).toContain('Racing');
      expect(adultHorse.trainableDisciplines).toContain('Dressage');
      expect(adultHorse.trainableDisciplines).toContain('Show Jumping');
      expect(adultHorse.trainableDisciplines).toContain('Barrel Racing');
      expect(adultHorse.nextEligibleAt).toBeNull();
    });

    it('should return empty array for player with no horses', async () => {
      // Create a user with no horses for this test scenario
      const userWithNoHorses = await prisma.user.create({
        data: {
          emailVerified: true,
          username: 'nohorsesuser',
          email: 'nohorsesuser@example.com',
          password: 'hashedpassword',
          firstName: 'No',
          lastName: 'Horses',
          money: 1000,
          xp: 0,
          level: 1,
        },
      });

      const result = await getTrainableHorses(userWithNoHorses.id);

      expect(result).toEqual([]);

      // Cleanup
      await prisma.user.delete({
        where: { id: userWithNoHorses.id },
      });
    });

    it('should return empty array for non-existent player', async () => {
      // Use a non-existent user ID (UUID format but doesn't exist in database)
      const nonExistentUserId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'; // UUID that doesn't exist

      const result = await getTrainableHorses(nonExistentUserId);

      expect(result).toEqual([]);
    });

    it('should include young horses with empty trainableDisciplines', async () => {
      // testHorseYoung (2 years old) is included but marked ineligible
      const result = await getTrainableHorses(testUser.id);

      // All horses returned including young ones
      expect(result).toHaveLength(4);

      // Young horse is present but has empty trainableDisciplines
      const youngHorse = result.find(h => h.horseId === testHorseYoung.id);
      expect(youngHorse).toBeDefined();
      expect(youngHorse.trainableDisciplines).toEqual([]);
      expect(youngHorse.age).toBe(2);

      // Adult horses are included with full disciplines
      const horseIds = result.map(horse => horse.horseId);
      expect(horseIds).toContain(testHorseAdult.id);
      expect(horseIds).toContain(testHorse4Years.id);
    });

    it('should include horses with recent training but set nextEligibleAt', async () => {
      // testHorseRecentTraining has training from 3 days ago (within 7-day cooldown)
      // It is included but with nextEligibleAt set to a future date
      const result = await getTrainableHorses(testUser.id);

      // All horses returned
      expect(result).toHaveLength(4);

      // Recently trained horse is present with a future nextEligibleAt
      const recentlyTrained = result.find(h => h.horseId === testHorseRecentTraining.id);
      expect(recentlyTrained).toBeDefined();
      expect(recentlyTrained.nextEligibleAt).not.toBeNull();
      expect(new Date(recentlyTrained.nextEligibleAt).getTime()).toBeGreaterThan(Date.now());

      // Untrained horses have null nextEligibleAt (ready to train)
      const adultHorse = result.find(h => h.horseId === testHorseAdult.id);
      expect(adultHorse.nextEligibleAt).toBeNull();
    });

    // Merged from the former controller business-logic suite (Equoria-k1vly).
    it('should name each horse and give its age and its trainable disciplines', async () => {
      const result = await getTrainableHorses(testUser.id);

      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            horseId: testHorseAdult.id,
            name: 'Adult Horse',
            age: 3,
            trainableDisciplines: expect.arrayContaining(['Racing', 'Dressage']),
          }),
        ]),
      );
    });

    it('should set nextEligibleAt once trainHorse has trained the horse', async () => {
      await trainHorse(testHorseAdult.id, 'Dressage');

      const result = await getTrainableHorses(testUser.id);

      const trained = result.find(h => h.horseId === testHorseAdult.id);
      expect(trained).toBeDefined();
      expect(trained.nextEligibleAt).not.toBeNull();
      expect(new Date(trained.nextEligibleAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('should throw error for missing player ID', async () => {
      await expect(getTrainableHorses('')).rejects.toThrow('User ID is required'); // Fixed: match actual error message
      await expect(getTrainableHorses(null)).rejects.toThrow('User ID is required'); // Fixed: match actual error message
    });
  });

  // Merged from the former controller business-logic suite (Equoria-k1vly): the handler is driven with a
  // plain req/res pair against the real database.
  describe('trainRouteHandler', () => {
    const createRes = () => ({
      statusCode: 200,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
    });
    const callHandler = async (horseId, discipline) => {
      const res = createRes();
      await trainRouteHandler({ body: { horseId, discipline }, user: { id: testUser.id } }, res);
      return res;
    };

    it('should answer a valid request with the trained discipline and the new score', async () => {
      const res = await callHandler(testHorseAdult.id, 'Show Jumping');

      expect(res.body).toMatchObject({
        success: true,
        message: expect.stringContaining('trained in Show Jumping'),
        updatedScore: expect.any(Number),
      });
    });

    it('should answer 400 for a horse that is under age', async () => {
      const res = await callHandler(testHorseYoung.id, 'Dressage');

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ success: false, message: expect.stringContaining('Horse is under age') });
    });

    it('should answer 400 for a horse in cooldown', async () => {
      const res = await callHandler(testHorseRecentTraining.id, 'Dressage');

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ success: false, message: expect.stringContaining('Training cooldown active') });
    });

    it('should answer 400 for a horse that does not exist', async () => {
      const res = await callHandler(999999999, 'Dressage');

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ success: false, message: expect.stringContaining('Horse not found') });
    });

    it('should answer 500 for an empty discipline', async () => {
      const res = await callHandler(testHorseAdult.id, '');

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({ success: false, message: 'Failed to train horse' });
    });
  });

  // NOTE (Equoria-fefh2.10): placeholder-only DB-error stubs that asserted expect(true) were deleted;
  // training-complete.test.mjs and training.test.mjs cover the HTTP and data-integrity behavior.
});
