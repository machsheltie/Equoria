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
 *
 * Equoria-m9lz1 (owner ruling 2026-09-08) changed the retirement contract these
 * cases describe, and the cases changed with it rather than the other way round.
 * Retirement now fires on ONE trigger — a per-groom hidden age drawn from 50..65
 * — instead of a fixed 104 career weeks plus level-10 and 12-assignment early
 * triggers, and `checkRetirementEligibility` no longer returns
 * `weeksUntilRetirement` or `noticeRequired` because a client that knows
 * `careerWeeks` recovers the hidden age from either by subtraction. The two
 * early triggers are gone (they retired grooms at any age, contradicting "any
 * time between age 50-65"), and `statistics.approachingRetirement` is gone (it
 * announced the retirement a week early). See
 * backend/modules/grooms/__tests__/groomRetirementGameDriven.integration.test.mjs
 * for the full new-behaviour coverage.
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import { randomBytes } from 'node:crypto';
import {
  incrementCareerWeeks,
  checkRetirementEligibility,
  processRetirement,
  getRetirementStatistics,
  processWeeklyCareerProgression,
  RETIREMENT_REASONS,
  CAREER_CONSTANTS,
  ensureRetirementSchedule,
} from '../../modules/grooms/index.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
// Equoria-w5n8c: serialise arrange-step create burst (jpmza sibling).
import { createSequentially } from '../helpers/createSequentially.mjs';

describe('Groom Retirement Service', () => {
  let testUser;
  let testGroom;
  let testHorse;

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_retirement_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        email: `test_retirement_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@example.com`,
        password: 'hashedpassword123',
        firstName: 'Test',
        lastName: 'User',
      },
    });

    // Create test horse for assignment logs
    testHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `Test Horse ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
        userId: testUser.id,
        bondScore: 50,
        stressLevel: 30,
      },
    });
  });

  beforeEach(async () => {
    // Create fresh test groom for each test
    testGroom = await prisma.groom.create({
      data: {
        name: `Test Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        personality: 'calm',
        skillLevel: 'intermediate',
        speciality: 'foal_care',
        userId: testUser.id,
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
      // Equoria-m9lz1: both are Cascade children (schedule of groom,
      // notification of user) but are deleted explicitly and narrowly so a leak
      // surfaces here rather than as a mystery row later.
      await prisma.groomRetirementSchedule.deleteMany({
        where: { groomId: testGroom.id },
      });
      await prisma.notification.deleteMany({
        where: { userId: testUser.id, type: 'groom_retired' },
      });
      await prisma.groom.deleteMany({
        where: { id: testGroom.id },
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
      // Use try/catch — .rejects.toThrow() has cross-VM context issues with
      // --experimental-vm-modules where Prisma's PrismaClientKnownRequestError
      // rejection from the application VM isn't caught by Jest's .rejects handler.
      let threw = false;
      try {
        await incrementCareerWeeks(2147483647);
      } catch (e) {
        threw = true;
        expect(e).toBeDefined();
      }
      expect(threw).toBe(true);
    });
  });

  describe('Retirement Eligibility', () => {
    test('should report not_scheduled for a groom with no drawn retirement age', async () => {
      // Equoria-m9lz1: no age is invented on read. A computed-on-read age could
      // differ between two reads and the retirement week would drift.
      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('not_scheduled');
      expect(eligibility.mandatory).toBe(false);
      expect(eligibility).not.toHaveProperty('weeksUntilRetirement');
    });

    test('should identify not eligible below the groom own hidden retirement age', async () => {
      const retirementAge = await ensureRetirementSchedule(prisma, testGroom.id);
      expect(retirementAge).toBeGreaterThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MIN);
      expect(retirementAge).toBeLessThanOrEqual(CAREER_CONSTANTS.RETIREMENT_AGE_MAX);

      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { careerWeeks: retirementAge - 1 },
      });

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('not_eligible');
      expect(eligibility.mandatory).toBe(false);
      // The countdown fields are gone; they WERE the hidden age.
      expect(eligibility).not.toHaveProperty('weeksUntilRetirement');
      expect(eligibility).not.toHaveProperty('noticeRequired');
      expect(eligibility).not.toHaveProperty('retirementAge');
    });

    test('should identify retirement at the groom own hidden age', async () => {
      const retirementAge = await ensureRetirementSchedule(prisma, testGroom.id);
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { careerWeeks: retirementAge },
      });

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reason).toBe(RETIREMENT_REASONS.AGE);
      expect(eligibility.mandatory).toBe(true);
    });

    test('level 10 is NOT a retirement trigger any more', async () => {
      // Pre-m9lz1: { eligible: true, reason: 'early_level_cap' } at career week
      // 5. The ruling retires grooms between age 50 and 65; a level-10 groom in
      // its fifth week is neither.
      await ensureRetirementSchedule(prisma, testGroom.id);
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { level: 10, careerWeeks: 5 },
      });

      const eligibility = await checkRetirementEligibility(testGroom.id);

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('not_eligible');
    });

    test('12+ assignments is NOT a retirement trigger any more', async () => {
      // Create 12 assignment logs
      const assignmentThunks = Array.from(
        { length: 12 },
        () => () =>
          prisma.groomAssignmentLog.create({
            data: {
              groomId: testGroom.id,
              horseId: testHorse.id,
              assignedAt: new Date(),
              milestonesCompleted: 1,
              xpGained: 10,
            },
          }),
      );
      await createSequentially(assignmentThunks);

      const eligibility = await checkRetirementEligibility(testGroom.id);

      // Pre-m9lz1: { eligible: true, reason: 'early_assignment_limit' }. A dozen
      // re-assignments is ordinary play, so this trigger fired long before age
      // 50 and would have made the ruling's age rule almost never fire.
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('not_eligible');
      expect(eligibility.mandatory).toBe(false);
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
    test('should process age retirement correctly, and notify the groom own user', async () => {
      const retirementAge = await ensureRetirementSchedule(prisma, testGroom.id);
      await prisma.groom.update({
        where: { id: testGroom.id },
        data: { careerWeeks: retirementAge },
      });

      const result = await processRetirement(testGroom.id);

      expect(result.groom.retired).toBe(true);
      expect(result.groom.isActive).toBe(false);
      expect(result.retirementReason).toBe(RETIREMENT_REASONS.AGE);
      expect(result.retirementTimestamp).toBeInstanceOf(Date);

      // Verify database was updated
      const updatedGroom = await prisma.groom.findUnique({
        where: { id: testGroom.id },
      });
      expect(updatedGroom.retired).toBe(true);
      expect(updatedGroom.retirementTimestamp).toBeTruthy();

      // Equoria-m9lz1: the notification is written by the retirement's own
      // transaction, so a committed retirement always has one.
      const notifications = await prisma.notification.findMany({
        where: { userId: testUser.id, type: 'groom_retired' },
      });
      expect(notifications).toHaveLength(1);
      expect(notifications[0].payload).toMatchObject({ groomId: testGroom.id, reason: 'age' });
    });

    test('should process voluntary retirement', async () => {
      const result = await processRetirement(testGroom.id, RETIREMENT_REASONS.VOLUNTARY, true);

      expect(result.groom.retired).toBe(true);
      expect(result.retirementReason).toBe(RETIREMENT_REASONS.VOLUNTARY);
    });

    // Equoria-m9lz1 — THIS CASE PREVIOUSLY ASSERTED THE DEFECT.
    // It was titled "should remove active assignments on retirement" and ended
    // with `expect(assignments).toHaveLength(0)`. The implementation it locked in
    // was `groomAssignment.deleteMany({ where: { groomId } })`, whose `where`
    // matched EVERY row for the groom — active and long-since-ended alike — so
    // one retirement destroyed that groom's whole assignment history and, because
    // `groom_interactions.assignmentId` is ON DELETE SET NULL, detached every
    // past interaction from the assignment that produced it. The correct
    // behaviour is the one horseTransferReconciliation already uses: END the
    // active rows, keep every row. The assertion is inverted accordingly.
    test('should END active assignments on retirement without deleting any row', async () => {
      const historical = await prisma.groomAssignment.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          userId: testUser.id,
          priority: 1,
          notes: 'Closed assignment — history',
          isActive: false,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-02-01'),
        },
      });
      const active = await prisma.groomAssignment.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          userId: testUser.id,
          priority: 1,
          notes: 'Test assignment',
          isActive: true,
        },
      });

      await processRetirement(testGroom.id, RETIREMENT_REASONS.VOLUNTARY, true);

      const assignments = await prisma.groomAssignment.findMany({
        where: { groomId: testGroom.id },
        orderBy: { id: 'asc' },
      });
      // Both rows survive. Pre-fix this was 0.
      expect(assignments).toHaveLength(2);

      const historicalAfter = assignments.find(a => a.id === historical.id);
      expect(historicalAfter.isActive).toBe(false);
      expect(historicalAfter.endDate).toEqual(new Date('2025-02-01'));

      const activeAfter = assignments.find(a => a.id === active.id);
      expect(activeAfter.isActive).toBe(false);
      expect(activeAfter.endDate).toBeInstanceOf(Date);
    });

    test('should reject retirement for ineligible groom', async () => {
      await expect(processRetirement(testGroom.id)).rejects.toThrow('not eligible for retirement');
    });
  });

  describe('Weekly Career Progression', () => {
    let testGrooms;
    let retirementAges;

    beforeEach(async () => {
      // Create multiple test grooms with different career stages
      testGrooms = await createSequentially([
        () =>
          prisma.groom.create({
            data: {
              name: `Test Groom Early ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'calm',
              skillLevel: 'novice',
              speciality: 'foal_care',
              userId: testUser.id,
              careerWeeks: 10,
              level: 2,
              retired: false,
            },
          }),
        () =>
          prisma.groom.create({
            data: {
              name: `Test Groom Mid ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'energetic',
              skillLevel: 'intermediate',
              speciality: 'general_grooming',
              userId: testUser.id,
              careerWeeks: 50,
              level: 5,
              retired: false,
            },
          }),
        () =>
          prisma.groom.create({
            data: {
              name: `Test Groom Near Retirement ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'methodical',
              skillLevel: 'expert',
              speciality: 'specialized_disciplines',
              userId: testUser.id,
              // Equoria-m9lz1: parked one tick short of its own hidden age by the
              // post-create step below, so the pass carries it over the line.
              careerWeeks: 0,
              level: 8,
              retired: false,
            },
          }),
        () =>
          prisma.groom.create({
            data: {
              name: `Test Groom Level 10 ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'calm',
              skillLevel: 'expert',
              speciality: 'foal_care',
              userId: testUser.id,
              // Level 10 is no longer a retirement trigger (Equoria-m9lz1), so
              // this groom now retires for the same reason as every other: it
              // reaches its own hidden age during the pass.
              careerWeeks: 0,
              level: 10,
              retired: false,
            },
          }),
      ]);

      // Equoria-m9lz1: draw each groom's hidden retirement age up front so the
      // pass's own ensureRetirementSchedule is a no-op, then park the last two
      // one tick short of theirs. Retirement is now per-groom, so there is no
      // shared threshold a fixture can hard-code.
      retirementAges = new Map();
      for (const groom of testGrooms) {
        retirementAges.set(groom.id, await ensureRetirementSchedule(prisma, groom.id));
      }
      for (const groom of testGrooms.slice(2)) {
        const age = retirementAges.get(groom.id);
        await prisma.groom.update({
          where: { id: groom.id },
          data: { careerWeeks: age - 1 },
        });
        groom.careerWeeks = age - 1;
      }
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
          await prisma.groomRetirementSchedule.deleteMany({
            where: { groomId: groom.id },
          });
          await prisma.groom.deleteMany({
            where: { id: groom.id },
          });
        }
        await prisma.notification.deleteMany({
          where: { userId: testUser.id, type: 'groom_retired' },
        });
      }
    });

    test('should process weekly career progression for all active grooms', async () => {
      const result = await processWeeklyCareerProgression(testUser.id);

      expect(result.processed).toBeGreaterThanOrEqual(4); // At least our test grooms
      expect(result.retired).toBeGreaterThanOrEqual(2); // The two parked on their age
      expect(result.errors).toHaveLength(0);

      // Verify career weeks were incremented
      const updatedGrooms = await prisma.groom.findMany({
        where: { id: { in: testGrooms.map(g => g.id) } },
      });

      const activeGrooms = updatedGrooms.filter(g => !g.retired);
      for (const groom of activeGrooms) {
        const originalGroom = testGrooms.find(tg => tg.id === groom.id);
        expect(groom.careerWeeks).toBe(originalGroom.careerWeeks + 1);
      }

      // Verify retirements
      const retiredGrooms = updatedGrooms.filter(g => g.retired);
      expect(retiredGrooms.length).toBeGreaterThanOrEqual(2);

      // Equoria-m9lz1: every game-driven retirement now carries reason AGE, and
      // it fires exactly when the groom's careerWeeks reach the age drawn for it.
      for (const retired of retiredGrooms) {
        expect(retired.retirementReason).toBe(RETIREMENT_REASONS.AGE);
        expect(retired.careerWeeks).toBe(retirementAges.get(retired.id));
        expect(retired.isActive).toBe(false);
      }

      // The two grooms nowhere near their age kept working.
      const stillWorking = updatedGrooms.filter(g => !g.retired);
      expect(stillWorking.length).toBeGreaterThanOrEqual(2);

      // Each retirement announced itself to the groom's own user.
      expect(
        await prisma.notification.count({
          where: { userId: testUser.id, type: 'groom_retired' },
        }),
      ).toBe(retiredGrooms.length);
    });

    test('should handle errors gracefully during weekly progression', async () => {
      // Create a groom that will cause an error during processing by making it invalid after creation
      const problemGroom = await prisma.groom.create({
        data: {
          name: `Problem Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
          personality: 'calm',
          skillLevel: 'novice',
          speciality: 'foal_care',
          userId: testUser.id,
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

      const result = await processWeeklyCareerProgression(testUser.id);

      // Should still process other grooms despite errors
      expect(result.processed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0); // May or may not have errors

      // Clean up
      await prisma.groom.deleteMany({ where: { id: problemGroom.id } });
    });

    test('should skip already retired grooms', async () => {
      // Mark one groom as retired
      await prisma.groom.update({
        where: { id: testGrooms[0].id },
        data: { retired: true },
      });

      await processWeeklyCareerProgression(testUser.id);

      // Verify retired groom was not processed
      const retiredGroom = await prisma.groom.findUnique({
        where: { id: testGrooms[0].id },
      });
      expect(retiredGroom.careerWeeks).toBe(10); // Should remain unchanged
    });

    test('should provide detailed statistics', async () => {
      await processWeeklyCareerProgression(testUser.id);

      const stats = await getRetirementStatistics(testUser.id);

      expect(stats.totalGrooms).toBeGreaterThanOrEqual(4);
      expect(stats.activeGrooms).toBeGreaterThanOrEqual(2);
      expect(stats.retiredGrooms).toBeGreaterThanOrEqual(2);
      // Equoria-m9lz1: `approachingRetirement` is gone. A count of grooms about
      // to retire still tells the player one of them goes this week, which the
      // owner's ruling forbids.
      expect(stats).not.toHaveProperty('approachingRetirement');
      expect(stats.retirementReasons).toBeDefined();
      expect(stats.averageCareerLength).toBeGreaterThan(0);
    });
  });
});
