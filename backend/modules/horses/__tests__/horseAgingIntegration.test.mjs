/**
 * Horse Aging Integration Test
 * Tests the aging system end to end through the cron entrypoint
 *
 * 🎯 FEATURES TESTED:
 * - Complete aging workflow from cron job to the stored age
 * - Real database operations with milestone processing
 * - Cron job service integration
 * - The 7-day mark is no milestone: a first birthday ages the foal and touches no trait
 *
 * 🔧 DEPENDENCIES:
 * - cronJobs.mjs (cron job service)
 * - horseAgingSystem.mjs (aging logic)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Daily aging process triggers birthday detection
 * - A first birthday ages the foal and leaves its traits and task log as they were
 * - Cron job service orchestrates the complete workflow
 * - Real-world foal development scenarios
 *
 * 🧪 TESTING APPROACH (Equoria-hg9wy de-mock — CLAUDE.md §3 no-mocks):
 * - Real DB: every horse/user/breed fixture is created in the canonical DB
 *   via `...fixtureColor()` + `TestFixture-` names, exercised through the real
 *   cron → aging → milestone → trait pipeline, asserted against real DB state,
 *   and removed by scoped, FK-ordered, fail-loud cleanup.
 * - No logger mock: the previous `jest.unstable_mockModule('utils/logger.mjs')`
 *   block was removed. Logging on the exercised paths is incidental
 *   (info/error status lines) — the production code's behaviour is unchanged
 *   by whether the logger is real, so the real logger is used (arepn precedent,
 *   commit c69a315b1). The error-path assertion that previously inspected
 *   `mockLogger.error` is replaced by the deterministic observable it stands in
 *   for: `result.errors === 1` (errors++ and logger.error sit on the same
 *   branch in processHorseBirthdays).
 * - No global Date mock: fixture dobs are Eastern dates N game days before
 *   today (gameCalendarDate, Equoria-1lk00) instead of swapping the global
 *   Date constructor. `calculateAgeFromBirth` counts Eastern game days, so the
 *   age is exactly N whenever the suite runs — no clock isolation needed.
 * - Error path (Equoria-dgnle de-mock — CLAUDE.md §3 no-mocks-of-our-DB):
 *   the previous Error Handling test isolated `prisma.horse.update` via
 *   `mockRejectedValueOnce` to simulate a DB write failure — an isolation of
 *   OUR database, forbidden by Principle 3. That mock is REMOVED. The
 *   `errors++ / continue` branch in processHorseBirthdays is triggered ONLY by
 *   updateHorseAge throwing, and updateHorseAge's only real throw is its
 *   "Horse with ID X not found" guard (the age UPDATE itself cannot fail
 *   mocklessly for an existing row — `age` is a plain nullable Int with no
 *   CHECK/trigger, and the written value is always a small valid integer). That
 *   "not found" throw is NOT reachable from inside a single manualHorseAging
 *   call (processHorseBirthdays snapshots horses via findMany, then each
 *   updateHorseAge re-reads the same row via findUnique against the same live
 *   DB with no concurrency seam to delete the row mid-call), so the integration
 *   `errors` counter cannot be driven above 0 without mocking. We therefore
 *   assert the error contract at the level where it IS real: the unit-level
 *   `updateHorseAge(<missing id>)` rejection (the exact throw the integration
 *   catch absorbs), plus the integration-level "continue" half of the contract
 *   (a clean multi-horse run keeps errors === 0 and processes every horse).
 *   Full rationale + the chosen alternative is recorded in the report for
 *   Equoria-dgnle.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-w5n8c: serialise arrange-step create burst (jpmza sibling).
import { createSequentially } from '../../../tests/helpers/createSequentially.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
// Equoria-fefh2.6: canonical fixture helper (injects colorGenotype/phenotype)
// + id-scoped cleanup for the retirement-milestone tests.
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
// Static import — no logger mock (Equoria-hg9wy).
import cronJobService from '../../../services/cronJobs.mjs';
// Equoria-dgnle: real (mockless) error-path coverage. updateHorseAge throws a
// genuine "Horse with ID X not found" Error for a non-existent id — this is the
// SAME throw the processHorseBirthdays per-horse catch (errors++, continue) is
// built to absorb. We assert it against a real id that does not exist, with no
// DB mock. See the Error Handling describe block below for the full rationale.
import { updateHorseAge } from '../../../utils/horseAgingSystem.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

// born `days` Eastern game days ago, as a date-only value (Equoria-1lk00).
const bornDaysAgo = days => gameCalendarDate(new Date(), -days);

const randHex = () => randomBytes(4).toString('hex');

describe('Horse Aging Integration (Equoria-hg9wy — real-DB)', () => {
  let testUser, testBreed;
  const createdHorseIds = [];
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    // Restore any per-test spy from a previous case.
    jest.restoreAllMocks();
    createdHorseIds.length = 0;

    // Create test user (TestFixture-scoped via unique email/username).
    testUser = await prisma.user.create({
      data: {
        username: `agingint_${randHex()}_${randHex()}`,
        email: `agingint_${randHex()}_${randHex()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Aging',
        lastName: 'Integration',
        money: 1000,
      },
    });

    // Create test breed.
    testBreed = await prisma.breed.create({
      data: {
        name: `TestFixture-IntBreed-${randHex()}_${randHex()}`,
        description: 'Test breed for aging integration',
      },
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    // Scoped, FK-ordered, fail-loud cleanup (CLAUDE.md §2): horses (by the ids
    // this test created) BEFORE the user (Horse.userId onDelete:Restrict) and
    // BEFORE the breed (Horse.breedId references it).
    const horseIds = [...createdHorseIds];
    const userId = testUser?.id;
    const breedId = testBreed?.id;
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    if (userId) {
      cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
    }
    if (breedId) {
      cleanup.add(() => prisma.breed.delete({ where: { id: breedId } }), 'breed');
    }
    await cleanup.run();
  });

  describe('Complete Aging Workflow', () => {
    // Old contract: the age-1 birthday ran the foal's task log through the legacy task map and
    // wrote an 'epigenetic_tags' list (bonded, calm, ...) that nothing read; the old cases
    // asserted those tags. Those names are off the owner's 2026-10-27 trait roster, so the
    // evaluation is removed (Equoria-qw4kp): the birthday ages the horse and nothing else.
    it('ages a foal on its first birthday, records no milestone, and leaves its traits and task log alone', async () => {
      const taskLog = { trust_building: 12, desensitization: 8, early_touch: 10 };
      const traits = { positive: ['athletic'], negative: [], hidden: ['mysteriousLineage'] };
      // dob is 7 game days ago so calculatedAge = floor(7 / 7) = 1 against a stored age of 0.
      const foal = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-MilestoneFoal-${randHex()}`,
          sex: 'Filly',
          dateOfBirth: bornDaysAgo(7),
          age: 0,
          userId: testUser.id,
          breedId: testBreed.id,
          bondScore: 85,
          taskLog,
          daysGroomedInARow: 15,
          epigeneticModifiers: traits,
        },
      });
      createdHorseIds.push(foal.id);

      const result = await cronJobService.manualHorseAging({ horseIds: [...createdHorseIds] });

      expect(result.totalProcessed).toBe(1);
      expect(result.birthdaysFound).toBe(1);
      expect(result.milestonesTriggered).toBe(0);
      expect(result.errors).toBe(0);

      const updatedFoal = await prisma.horse.findUnique({ where: { id: foal.id } });
      expect(updatedFoal.age).toBe(1); // game-years: floor(7d / 7) = 1
      expect(updatedFoal.epigeneticModifiers).toEqual(traits);
      expect(updatedFoal.taskLog).toEqual(taskLog);
    });

    it('should handle multiple horses with different birthday scenarios', async () => {
      // dob offsets are live-now-relative so day-deltas are stable without a Date mock.
      const horses = await createSequentially([
        // Foal turning 1 game-year old: 7 game days ago → calc 1, stored 0.
        () =>
          prisma.horse.create({
            data: {
              ...fixtureColor(),
              name: `TestFixture-MilestoneFoal-${randHex()}`,
              sex: 'Colt',
              dateOfBirth: bornDaysAgo(7),
              age: 0,
              userId: testUser.id,
              breedId: testBreed.id,
              taskLog: { trust_building: 6, desensitization: 4 },
              daysGroomedInARow: 8,
              epigeneticModifiers: { positive: [], negative: [], hidden: [] },
            },
          }),
        // Horse turning 3 game-years: 21 game days ago → calc 3, stored 2.
        () =>
          prisma.horse.create({
            data: {
              ...fixtureColor(),
              name: `TestFixture-TrainingReady-${randHex()}`,
              sex: 'Mare',
              dateOfBirth: bornDaysAgo(21),
              age: 2,
              userId: testUser.id,
              breedId: testBreed.id,
            },
          }),
        // Horse with no birthday (correct stored age): 31 game days ago → calc 4,
        // stored 4 → calculatedAge === storedAge → not counted.
        () =>
          prisma.horse.create({
            data: {
              ...fixtureColor(),
              name: `TestFixture-NoBirthday-${randHex()}`,
              sex: 'Stallion',
              dateOfBirth: bornDaysAgo(31),
              age: 4,
              userId: testUser.id,
              breedId: testBreed.id,
            },
          }),
      ]);
      horses.forEach(h => createdHorseIds.push(h.id));

      const result = await cronJobService.manualHorseAging({ horseIds: [...createdHorseIds] });

      expect(result.totalProcessed).toBe(3);
      expect(result.birthdaysFound).toBe(2); // the foal and the training-ready horse
      expect(result.milestonesTriggered).toBe(0); // neither birthday is a milestone
      expect(result.errors).toBe(0);

      const updatedHorses = await prisma.horse.findMany({
        where: { id: { in: horses.map(h => h.id) } },
        orderBy: { name: 'asc' },
      });

      const milestoneHorse = updatedHorses.find(h => h.name.startsWith('TestFixture-MilestoneFoal-'));
      expect(milestoneHorse.age).toBe(1); // game-years: floor(7d / 7) = 1
      expect(milestoneHorse.epigeneticModifiers).toEqual({ positive: [], negative: [], hidden: [] });

      const trainingHorse = updatedHorses.find(h => h.name.startsWith('TestFixture-TrainingReady-'));
      expect(trainingHorse.age).toBe(3); // game-years: floor(21d / 7) = 3

      const noBirthdayHorse = updatedHorses.find(h => h.name.startsWith('TestFixture-NoBirthday-'));
      expect(noBirthdayHorse.age).toBe(4); // game-years: floor(31d / 7) = 4, unchanged
    });
  });

  describe('Retirement Milestone — age 21 / 147 days (Equoria-fefh2.6)', () => {
    // Retirement has no persisted flag: enforcement is the shared entry
    // rules' age gate (backend/utils/competitionEntryRules.mjs ageRefusal →
    // AGE_TOO_OLD past 20 game-years). These tests pin the observable contract of the milestone
    // itself: the 140→147-day crossing fires exactly one milestone
    // ('retirement') and the horse lands at 21 game-years. No Math.random
    // pin is needed — no trait gate (7/14/21-day) sits inside 140→147, so
    // no probabilistic roll is reachable on this path.
    const retirementHorseIds = [];

    // Inner afterEach runs BEFORE the outer one (Jest unwinds inner-first),
    // so these horses are gone before the outer hook deletes user/breed
    // (Horse.userId is onDelete:Restrict). Id-scoped — never broad.
    afterEach(() => cleanupTestHorses(prisma, retirementHorseIds));

    it('ages a 147-day-old horse to 21 game-years and counts the retirement milestone via the cron entrypoint', async () => {
      // dob 147 game days ago → ageInDays floors to 147 → calculatedAge = floor(147/7)
      // = 21. Stored age 20 → birthday fires with prevAgeInDays = 20*7 = 140
      // and newAge = 147, so the retirement gate (previousAge < 147 &&
      // newAge >= 147) fires — and it is the ONLY gate in that window.
      const horse = await createTestHorse(
        prisma,
        {
          name: `TestFixture-retire-${randHex()}`,
          sex: 'Mare',
          dateOfBirth: bornDaysAgo(147),
          age: 20, // game-year before the year-21 birthday
          userId: testUser.id,
          breedId: testBreed.id,
        },
        retirementHorseIds,
      );

      const result = await cronJobService.manualHorseAging({ horseIds: [...retirementHorseIds] });

      expect(result.totalProcessed).toBe(1);
      expect(result.birthdaysFound).toBe(1);
      expect(result.milestonesTriggered).toBe(1); // the retirement milestone — no other gate sits in 140→147
      expect(result.errors).toBe(0);

      // Verify the persisted age landed at retirement age.
      const updatedHorse = await prisma.horse.findUnique({ where: { id: horse.id } });
      expect(updatedHorse.age).toBe(21); // game-years: floor(147d / 7) = 21
    });

    it('updateHorseAge reports the retirement milestone token at the 140→147-day crossing', async () => {
      // Same fixture shape, asserted through the per-horse entrypoint the
      // cron path delegates to — this pins the literal 'retirement' token in
      // milestonesTriggered (the cron-level result only exposes a count).
      const horse = await createTestHorse(
        prisma,
        {
          name: `TestFixture-retire-${randHex()}`,
          sex: 'Stallion',
          dateOfBirth: bornDaysAgo(147),
          age: 20, // game-year before the year-21 birthday
          userId: testUser.id,
          breedId: testBreed.id,
        },
        retirementHorseIds,
      );

      const result = await updateHorseAge(horse.id);

      expect(result.hadBirthday).toBe(true);
      expect(result.newAge).toBe(21);
      expect(result.milestonesTriggered).toContain('retirement');
    });
  });

  describe('Error Handling (Equoria-dgnle — real-DB, no DB mock)', () => {
    // WHY THIS IS NOT A `prisma.horse.update` MOCK ANYMORE
    // ---------------------------------------------------
    // The original test isolated the first prisma.horse.update via
    // mockRejectedValueOnce to fabricate a DB write failure and assert
    // result.errors === 1. That mocks OUR OWN database — forbidden by
    // CLAUDE.md §3. We removed it. The substance the test was protecting is
    // the processHorseBirthdays per-horse catch branch (errors++, logger.error,
    // continue). That branch fires ONLY when updateHorseAge throws, and the
    // only genuine (mockless) throw updateHorseAge produces is its
    // "Horse with ID X not found" guard — the age UPDATE write itself cannot
    // fail mocklessly for an existing row (the `age` column is a plain nullable
    // Int with no CHECK constraint or trigger, and calculatedAge is always a
    // small valid integer well inside int4 range).
    //
    // That real throw is unreachable from WITHIN one manualHorseAging call:
    // processHorseBirthdays snapshots the horses with findMany, then each
    // updateHorseAge re-reads the same row with findUnique against the same
    // live connection pool (no read-replica and no query cache in the Prisma
    // client), and there is no concurrency seam to delete the row between those
    // two sequential awaits. So the integration `errors` counter cannot be
    // driven above zero without mocking. Rather than keep the mock, we assert
    // the error contract at the two levels where it is genuinely real:

    it('updateHorseAge rejects (real throw) for a horse id that does not exist — the exact failure the aging catch absorbs', async () => {
      // No mock: this is the real findUnique → null → `throw new Error(...)`
      // path in updateHorseAge (horseAgingSystem.mjs:124-126). A negative id
      // cannot collide with a real autoincrement row, so this is deterministic
      // against the canonical DB and creates/leaks nothing.
      await expect(updateHorseAge(-987654321)).rejects.toThrow('Horse with ID -987654321 not found');
    });

    it('a clean multi-horse aging run processes every horse and keeps errors at 0 (the "continue across the batch" half of the contract)', async () => {
      // Three real horses with valid data and a real birthday each (stored age
      // below the calculated game-year), so every one exercises the real
      // updateHorseAge write path. A clean batch must process all three, count
      // each birthday, and record zero errors — proving the loop visits every
      // horse (the "continue" behaviour) rather than aborting on the first.
      const horses = await createSequentially([
        () =>
          prisma.horse.create({
            data: {
              ...fixtureColor(),
              name: `TestFixture-CleanBatch-A-${randHex()}`,
              sex: 'Colt',
              dateOfBirth: bornDaysAgo(7),
              age: 0, // floor(7/7)=1 > 0 → birthday
              userId: testUser.id,
              breedId: testBreed.id,
              taskLog: {},
              epigeneticModifiers: { positive: [], negative: [], hidden: [] },
            },
          }),
        () =>
          prisma.horse.create({
            data: {
              ...fixtureColor(),
              name: `TestFixture-CleanBatch-B-${randHex()}`,
              sex: 'Mare',
              dateOfBirth: bornDaysAgo(21),
              age: 2, // floor(21/7)=3 > 2 → birthday
              userId: testUser.id,
              breedId: testBreed.id,
            },
          }),
        () =>
          prisma.horse.create({
            data: {
              ...fixtureColor(),
              name: `TestFixture-CleanBatch-C-${randHex()}`,
              sex: 'Stallion',
              dateOfBirth: bornDaysAgo(14),
              age: 1, // floor(14/7)=2 > 1 → birthday
              userId: testUser.id,
              breedId: testBreed.id,
            },
          }),
      ]);
      horses.forEach(h => createdHorseIds.push(h.id));

      const result = await cronJobService.manualHorseAging({ horseIds: [...createdHorseIds] });

      // Every horse visited (the loop did not abort early), every birthday
      // counted, and the error counter — the deterministic observable the old
      // mock asserted on — stayed at 0 on a clean run.
      expect(result.totalProcessed).toBe(3);
      expect(result.birthdaysFound).toBe(3);
      expect(result.errors).toBe(0);

      // Confirm the real writes landed for all three (continue → all updated).
      const updated = await prisma.horse.findMany({
        where: { id: { in: horses.map(h => h.id) } },
        orderBy: { name: 'asc' },
      });
      expect(updated.map(h => h.age)).toEqual([1, 3, 2]); // A:7d→1, B:21d→3, C:14d→2
    });
  });
});
