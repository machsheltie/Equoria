/**
 * Horse Aging Integration Test
 * Tests the complete integration of aging system with trait milestone evaluation
 *
 * 🎯 FEATURES TESTED:
 * - Complete aging workflow from cron job to trait assignment
 * - Integration between aging system and trait evaluation
 * - Real database operations with milestone processing
 * - Cron job service integration
 * - Age 1 milestone trait evaluation from foal task history
 *
 * 🔧 DEPENDENCIES:
 * - cronJobs.mjs (cron job service)
 * - horseAgingSystem.mjs (aging logic)
 * - traitEvaluation.mjs (milestone evaluation)
 *
 * 📋 BUSINESS RULES TESTED:
 * - Daily aging process triggers birthday detection
 * - Age 1 milestone automatically evaluates traits from task history
 * - Trait assignment integrates with existing epigenetic system
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
 * - No global Date mock: fixtures are anchored to live `Date.now()` offsets
 *   (sibling-suite precedent horseAgingSystem.test.mjs) instead of swapping the
 *   global Date constructor. `calculateAgeFromBirth` reads the live clock with
 *   no injection seam, so a relative dob ("7d6h ago") makes the day-delta
 *   stable regardless of when the suite runs — no clock isolation needed.
 * - Math.random: KEPT as a minimal `jest.spyOn(Math, 'random')`. The trait roll
 *   in evaluateEpigeneticTagsFromFoalTasks is `Math.random() * 100 < chance`
 *   PER trait; the production function takes only (taskLog, streak) — there is
 *   NO rng injection seam, and adding one would be a production change outside
 *   this test issue. Math.random is a JS runtime primitive (not Equoria domain
 *   code), so isolating ONLY it is the legitimate "runtime boundary" case, not
 *   a mock of our own logic. The deterministic invariants (pipeline counts,
 *   age, preserved modifiers) are asserted independently of the roll.
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
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
// Static import — no logger mock (Equoria-hg9wy).
import cronJobService from '../../../services/cronJobs.mjs';
// Equoria-dgnle: real (mockless) error-path coverage. updateHorseAge throws a
// genuine "Horse with ID X not found" Error for a non-existent id — this is the
// SAME throw the processHorseBirthdays per-horse catch (errors++, continue) is
// built to absorb. We assert it against a real id that does not exist, with no
// DB mock. See the Error Handling describe block below for the full rationale.
import { updateHorseAge } from '../../../utils/horseAgingSystem.mjs';

// One real day in ms — used to anchor fixture dateOfBirth relative to live now.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

// born `(days)d + 6h` ago: the +6h keeps the floored day-delta stable for the
// whole UTC day window in which the suite runs (no global Date mock needed).
const bornDaysAgo = days => new Date(Date.now() - (days * ONE_DAY_MS + 6 * ONE_HOUR_MS));

const randHex = () => randomBytes(4).toString('hex');

describe('Horse Aging Integration (Equoria-hg9wy — real-DB)', () => {
  let testUser, testBreed;
  const createdHorseIds = [];
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    // Restore any per-test Math.random spy from a previous case.
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
    cleanup.add(
      () => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }),
      'horses',
    );
    if (userId) {
      cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
    }
    if (breedId) {
      cleanup.add(() => prisma.breed.delete({ where: { id: breedId } }), 'breed');
    }
    await cleanup.run();
  });

  describe('Complete Aging Workflow', () => {
    it('should process foal birthday with trait milestone evaluation', async () => {
      // Math.random — minimal runtime-boundary isolation (see file header).
      // 0.15 → roll = 15; assigns any trait whose capped chance > 15%.
      jest.spyOn(Math, 'random').mockReturnValue(0.15);

      // Create foal turning 1 game-year old (7 days = 1 game-year) with a
      // comprehensive task history. dob is 7d6h ago so calculateAgeFromBirth
      // floors to exactly 7 days → calculatedAge = floor(7/7) = 1. Stored
      // age 0 → birthday fires; prevAgeInDays = 0*7 = 0 < 7 and newAge = 7 >= 7,
      // so the age-1 milestone gate (previousAge < 7 && newAge >= 7) fires.
      const foal = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-MilestoneFoal-${randHex()}`,
          sex: 'Filly',
          dateOfBirth: bornDaysAgo(7),
          age: 0, // game-year before the year-1 birthday
          userId: testUser.id,
          breedId: testBreed.id,
          bondScore: 85,
          stressLevel: 5,
          taskLog: {
            // Comprehensive foal development
            trust_building: 12, // 60 points to bonded, resilient
            desensitization: 8, // 40 points to confident
            showground_exposure: 4, // 20 points to confident, crowd_ready
            early_touch: 10, // 50 points to calm
            hoof_handling: 6, // 30 points to show_calm
            sponge_bath: 3, // 15 points to show_calm, presentation_boosted
          },
          daysGroomedInARow: 15, // Strong burnout immunity (+10 bonus)
          epigeneticModifiers: {
            positive: ['athletic'],
            negative: [],
            hidden: ['mysterious_lineage'],
          },
        },
      });
      createdHorseIds.push(foal.id);

      // Trigger the complete aging workflow through cron job service.
      const result = await cronJobService.manualHorseAging({ horseIds: [...createdHorseIds] });

      // Verify aging process results (deterministic — independent of the roll).
      expect(result.totalProcessed).toBe(1);
      expect(result.birthdaysFound).toBe(1);
      expect(result.milestonesTriggered).toBe(1);
      expect(result.errors).toBe(0);

      // Verify horse was updated in database.
      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      // Check age update (deterministic).
      expect(updatedFoal.age).toBe(1); // game-years: floor(7d / 7) = 1

      // Check trait milestone evaluation produced an epigenetic_tags array.
      const { epigeneticModifiers } = updatedFoal;
      expect(epigeneticModifiers.epigenetic_tags).toBeDefined();
      expect(Array.isArray(epigeneticModifiers.epigenetic_tags)).toBe(true);
      expect(epigeneticModifiers.epigenetic_tags.length).toBeGreaterThan(0);

      // Verify specific traits based on task history and streak bonus.
      // With roll = 15 (Math.random 0.15 * 100) and +10 streak bonus:
      // bonded: 60 + 10 = 70% (capped at 60%) > 15% ✓
      // resilient: 60 + 10 = 70% (capped at 60%) > 15% ✓
      // confident: (40 + 20) + 10 = 70% (capped at 60%) > 15% ✓
      // crowd_ready: 20 + 10 = 30% > 15% ✓
      // calm: 50 + 10 = 60% > 15% ✓
      // show_calm: (30 + 15) + 10 = 55% > 15% ✓
      // presentation_boosted: 15 + 10 = 25% > 15% ✓
      expect(epigeneticModifiers.epigenetic_tags).toContain('bonded');
      expect(epigeneticModifiers.epigenetic_tags).toContain('resilient');
      expect(epigeneticModifiers.epigenetic_tags).toContain('confident');
      expect(epigeneticModifiers.epigenetic_tags).toContain('calm');

      // Verify existing traits were preserved (deterministic).
      expect(epigeneticModifiers.positive).toContain('athletic');
      expect(epigeneticModifiers.hidden).toContain('mysterious_lineage');
    });

    it('should handle multiple horses with different milestone scenarios', async () => {
      // 0.2 → roll = 20; assigns any trait whose capped chance > 20%.
      jest.spyOn(Math, 'random').mockReturnValue(0.2);

      // Create multiple horses with different scenarios. dob offsets are live-
      // now-relative so day-deltas are stable without a Date mock.
      const horses = await Promise.all([
        // Foal turning 1 game-year old (milestone): 7d6h ago → calc 1, stored 0.
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `TestFixture-MilestoneFoal-${randHex()}`,
            sex: 'Colt',
            dateOfBirth: bornDaysAgo(7),
            age: 0, // game-year before the year-1 birthday
            userId: testUser.id,
            breedId: testBreed.id,
            taskLog: { trust_building: 6, desensitization: 4 },
            daysGroomedInARow: 8,
            epigeneticModifiers: { positive: [], negative: [], hidden: [] },
          },
        }),
        // Horse turning 3 game-years (birthday, no counted milestone): 21d6h
        // ago → calc 3, stored 2. Minimal data so milestone eligibility resolves
        // ineligible (no task_log / trait_milestones) — matches original intent.
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `TestFixture-TrainingReady-${randHex()}`,
            sex: 'Mare',
            dateOfBirth: bornDaysAgo(21),
            age: 2, // game-year before the year-3 birthday
            userId: testUser.id,
            breedId: testBreed.id,
          },
        }),
        // Horse with no birthday (correct stored age): 31d6h ago → calc 4,
        // stored 4 → calculatedAge === storedAge → not counted.
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `TestFixture-NoBirthday-${randHex()}`,
            sex: 'Stallion',
            dateOfBirth: bornDaysAgo(31),
            age: 4, // floor(31 / 7) = 4 — already current, no birthday fires
            userId: testUser.id,
            breedId: testBreed.id,
          },
        }),
      ]);
      horses.forEach(h => createdHorseIds.push(h.id));

      // Process all horses.
      const result = await cronJobService.manualHorseAging({ horseIds: [...createdHorseIds] });

      expect(result.totalProcessed).toBe(3);
      expect(result.birthdaysFound).toBe(2); // Milestone foal + training-ready horse
      expect(result.milestonesTriggered).toBe(1); // Only the age-1 milestone
      expect(result.errors).toBe(0);

      // Verify specific updates.
      const updatedHorses = await prisma.horse.findMany({
        where: { id: { in: horses.map(h => h.id) } },
        orderBy: { name: 'asc' },
      });

      // Milestone foal should have traits assigned.
      const milestoneHorse = updatedHorses.find(h => h.name.startsWith('TestFixture-MilestoneFoal-'));
      expect(milestoneHorse.age).toBe(1); // game-years: floor(7d / 7) = 1
      expect(milestoneHorse.epigeneticModifiers.epigenetic_tags).toBeDefined();
      expect(milestoneHorse.epigeneticModifiers.epigenetic_tags.length).toBeGreaterThan(0);

      // Training-ready horse should just have age updated.
      const trainingHorse = updatedHorses.find(h => h.name.startsWith('TestFixture-TrainingReady-'));
      expect(trainingHorse.age).toBe(3); // game-years: floor(21d / 7) = 3

      // No-birthday horse should remain unchanged.
      const noBirthdayHorse = updatedHorses.find(h => h.name.startsWith('TestFixture-NoBirthday-'));
      expect(noBirthdayHorse.age).toBe(4); // game-years: floor(31d / 7) = 4, unchanged
    });

    it('should handle foal with minimal task history', async () => {
      // 0.5 → roll = 50; minimal task points (5% chance) are all < 50 → no
      // trait assigned. Deterministic given the controlled roll.
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Create foal with minimal development (7d6h ago → calc 1, stored 0).
      const foal = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-MinimalFoal-${randHex()}`,
          sex: 'Colt',
          dateOfBirth: bornDaysAgo(7),
          age: 0,
          userId: testUser.id,
          breedId: testBreed.id,
          taskLog: {
            trust_building: 1, // 5 points to bonded, resilient
            early_touch: 1, // 5 points to calm
          },
          daysGroomedInARow: 2, // No burnout immunity
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      });
      createdHorseIds.push(foal.id);

      const result = await cronJobService.manualHorseAging({ horseIds: [...createdHorseIds] });

      expect(result.milestonesTriggered).toBe(1);

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      expect(updatedFoal.age).toBe(1); // game-years: floor(7d / 7) = 1

      // With minimal task history and roll = 50, no traits qualify:
      // bonded: 5% < 50% ✗ / resilient: 5% < 50% ✗ / calm: 5% < 50% ✗
      const epigeneticTags = updatedFoal.epigeneticModifiers?.epigenetic_tags || [];
      expect(epigeneticTags.length).toBe(0);
    });

    it('should handle foal with no task history', async () => {
      // No task entries → evaluateEpigeneticTagsFromFoalTasks returns [] before
      // any roll, so the Math.random value is irrelevant here. Pinned anyway to
      // keep the case fully deterministic regardless of code-path changes.
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      // Create foal with no development history (7d6h ago → calc 1, stored 0).
      const foal = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `TestFixture-NoDevFoal-${randHex()}`,
          sex: 'Filly',
          dateOfBirth: bornDaysAgo(7),
          age: 0,
          userId: testUser.id,
          breedId: testBreed.id,
          taskLog: {}, // Empty task log
          daysGroomedInARow: 0,
          epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        },
      });
      createdHorseIds.push(foal.id);

      const result = await cronJobService.manualHorseAging({ horseIds: [...createdHorseIds] });

      expect(result.milestonesTriggered).toBe(1);

      const updatedFoal = await prisma.horse.findUnique({
        where: { id: foal.id },
      });

      expect(updatedFoal.age).toBe(1); // game-years: floor(7d / 7) = 1

      // No task history = no traits.
      const epigeneticTags = updatedFoal.epigeneticModifiers?.epigenetic_tags || [];
      expect(epigeneticTags.length).toBe(0);
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
      await expect(updateHorseAge(-987654321)).rejects.toThrow(
        'Horse with ID -987654321 not found',
      );
    });

    it('a clean multi-horse aging run processes every horse and keeps errors at 0 (the "continue across the batch" half of the contract)', async () => {
      // 0.5 → roll = 50; trait outcomes are irrelevant here — this case asserts
      // the batch-traversal/error-accounting contract, not trait assignment.
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Three real horses with valid data and a real birthday each (stored age
      // below the calculated game-year), so every one exercises the real
      // updateHorseAge write path. A clean batch must process all three, count
      // each birthday, and record zero errors — proving the loop visits every
      // horse (the "continue" behaviour) rather than aborting on the first.
      const horses = await Promise.all([
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
