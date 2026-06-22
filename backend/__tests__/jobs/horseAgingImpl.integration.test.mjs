/**
 * Integration test: horse-aging impl module (Equoria-urqic.3.1)
 *
 * Proves the EXTRACTED impl module
 * (backend/services/jobs/impl/horseAging.mjs) is individually testable against
 * the REAL database (no mocks), independent of the CronJobService orchestrator.
 * cronJobs.test.mjs continues to exercise the singleton delegators
 * (cronJobService.processHorseAging / .manualHorseAging); this suite locks the
 * free-function entrypoints + the `service`-handle re-entry contract that the
 * split depends on.
 *
 * Age math is NOT exercised here directly — processHorseAging is purely the
 * cron wrapper around processHorseBirthdays() (utils/horseAgingSystem.mjs),
 * which owns the game-year arithmetic. This suite proves the wrapper drives
 * that owner correctly and re-enters logAgingSummary via the service handle.
 *
 * All work is scoped to a horseIds filter built from THIS suite's fixtures, so
 * the real-DB run never touches other players' horses. Scoped cleanup only
 * (CLAUDE.md §2): we delete exactly the rows this suite created, in FK order.
 */

import { describe, beforeAll, afterAll, expect, it, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import * as horseAgingImpl from '../../services/jobs/impl/horseAging.mjs';

const randHex = () => randomBytes(6).toString('hex');
const DAYS_PER_GAME_YEAR = 7;

/** A thin `service` handle whose logAgingSummary forwards back into the impl,
 * mirroring how the CronJobService delegators forward `this`. */
function makeServiceHandle() {
  const service = {
    logAgingSummary: summary => horseAgingImpl.logAgingSummary(summary),
  };
  return service;
}

describe('INTEGRATION: horseAging impl module (Equoria-urqic.3.1) — real DB', () => {
  let user;
  const createdHorseIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `tf-urqic31-${randHex()}`,
        email: `tf-urqic31-${randHex()}@example.com`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Fixture',
      },
    });
  }, 120000);

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horses');
    if (user) {
      cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
    }
    await cleanup.run();
  }, 120000);

  /** Create a horse born `gameYears * 7` days ago with a deliberately stale
   * stored age, so the aging run detects a birthday. A +12h buffer is added so
   * the computed game-year age sits comfortably INSIDE the year rather than
   * exactly on the floor() boundary (where sub-day clock granularity could flip
   * the result). */
  async function makeStaleHorse(gameYears, storedAge) {
    const halfDayMs = 12 * 60 * 60 * 1000;
    const dob = new Date(Date.now() - (gameYears * DAYS_PER_GAME_YEAR * 24 * 60 * 60 * 1000 + halfDayMs));
    return createTestHorse(
      prisma,
      {
        name: `TestFixture-aging-${randHex()}`,
        sex: 'Mare',
        dateOfBirth: dob,
        age: storedAge,
        userId: user.id,
      },
      createdHorseIds,
    );
  }

  describe('processHorseAging(service, options)', () => {
    it('ages a horse whose stored age is stale and re-enters logAgingSummary via the service handle', async () => {
      // Born 21 days ago (3 game-years) but stored age 0 → birthday found.
      const horse = await makeStaleHorse(3, 0);

      const service = makeServiceHandle();
      const summarySpy = jest.spyOn(service, 'logAgingSummary');

      const result = await horseAgingImpl.processHorseAging(service, {
        horseIds: [horse.id],
      });

      // Drove processHorseBirthdays over exactly our scoped horse.
      expect(result.totalProcessed).toBe(1);
      expect(result.birthdaysFound).toBeGreaterThanOrEqual(1);
      expect(typeof result.errors).toBe('number');
      expect(typeof result.duration).toBe('number');

      // The horse's stored age was actually updated in the DB.
      const updated = await prisma.horse.findUnique({ where: { id: horse.id } });
      expect(updated.age).toBe(3);

      // `service`-handle re-entry contract: processHorseAging MUST call
      // service.logAgingSummary (a singleton spy still observes the call).
      expect(summarySpy).toHaveBeenCalledTimes(1);
      const summaryArg = summarySpy.mock.calls[0][0];
      expect(summaryArg.totalProcessed).toBe(1);
      expect(summaryArg.timestamp).toBeInstanceOf(Date);
      expect(typeof summaryArg.duration).toBe('number');
    }, 120000);

    it('finds no birthday when the stored age already matches the computed game-year age', async () => {
      // Born 14 days ago (2 game-years) and stored age already 2 → no change.
      const horse = await makeStaleHorse(2, 2);

      const service = makeServiceHandle();
      const summarySpy = jest.spyOn(service, 'logAgingSummary');

      const result = await horseAgingImpl.processHorseAging(service, {
        horseIds: [horse.id],
      });

      expect(result.totalProcessed).toBe(1);
      expect(result.birthdaysFound).toBe(0);

      const updated = await prisma.horse.findUnique({ where: { id: horse.id } });
      expect(updated.age).toBe(2);

      // logAgingSummary is still called once per run, even on a no-birthday run.
      expect(summarySpy).toHaveBeenCalledTimes(1);
    }, 120000);

    it('returns a zero-result summary when the scoped horseIds filter matches nothing', async () => {
      const service = makeServiceHandle();
      const summarySpy = jest.spyOn(service, 'logAgingSummary');

      const result = await horseAgingImpl.processHorseAging(service, {
        horseIds: [-999999], // no such horse
      });

      expect(result.totalProcessed).toBe(0);
      expect(result.birthdaysFound).toBe(0);
      expect(summarySpy).toHaveBeenCalledTimes(1);
    }, 120000);
  });

  describe('logAgingSummary(summary)', () => {
    it('serializes the timestamp and is best-effort (does not throw on a well-formed summary)', async () => {
      await expect(
        horseAgingImpl.logAgingSummary({
          timestamp: new Date(),
          totalProcessed: 5,
          birthdaysFound: 2,
          milestonesTriggered: 1,
          errors: 0,
          duration: 12,
        }),
      ).resolves.toBeUndefined();
    });

    it('swallows a malformed summary (timestamp.toISOString missing) rather than throwing', async () => {
      // Best-effort logging: a bad summary must NOT abort the aging flow.
      await expect(horseAgingImpl.logAgingSummary({ timestamp: 'not-a-date' })).resolves.toBeUndefined();
    });
  });
});
