/**
 * Integration test: epigenetic-flag impl module (Equoria-urqic.3.2)
 *
 * Proves the EXTRACTED impl module
 * (backend/services/jobs/impl/flagEvaluation.mjs) is individually testable
 * against the REAL database (no mocks), independent of the CronJobService
 * orchestrator. The two cron wrappers — evaluateWeeklyFlags (weekly epigenetic
 * flag evaluation) and sweepExpiredTemporaryFlagsJob (daily temporary-flag
 * expiry sweep) — are PLAIN free functions (no `service` handle), mirroring the
 * electionTransition split: neither re-enters a sibling CronJobService method.
 *
 * cronJobs.test.mjs continues to exercise the singleton delegators
 * (cronJobService.evaluateWeeklyFlags / .sweepExpiredTemporaryFlags); this
 * suite locks the free-function entrypoints the registry handlers ultimately
 * drive, and proves the modules/traits barrel import the impl now OWNS
 * (resolving the orchestrator's prior name collision) wires correctly.
 *
 * All work is scoped to THIS suite's fixtures (one user, its horses). Scoped
 * cleanup only (CLAUDE.md §2): we delete exactly the rows this suite created,
 * in FK order — never an unscoped bulk delete.
 *
 * NO age math is inlined here (CLAUDE.md / GENERAL_RULES): the weekly path
 * defers age-window logic to getEligibleHorses + evaluateHorseFlags; the sweep
 * keys off each temp-flag entry's stored expiresAt.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { getEligibleHorses } from '../../utils/flagEvaluationEngine.mjs';
import * as flagEvaluationImpl from '../../services/jobs/impl/flagEvaluation.mjs';

const randHex = () => randomBytes(6).toString('hex');
const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('INTEGRATION: flagEvaluation impl module (Equoria-urqic.3.2) — real DB', () => {
  let user;
  const createdHorseIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `tf-urqic32-${randHex()}`,
        email: `tf-urqic32-${randHex()}@example.com`,
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

  describe('evaluateWeeklyFlags()', () => {
    it('returns a well-formed summary and includes a freshly-born eligible foal in the eligible set', async () => {
      // Born "today" → 0 game-years, inside the 0-3 evaluation window and under
      // the per-horse flag cap → must be eligible. We assert structure + that
      // our scoped horse is counted, not exact global totals (the canonical DB
      // holds other players' horses, so `evaluated` is >= 1, not == 1).
      const foal = await createTestHorse(
        prisma,
        {
          name: `TestFixture-flag-eligible-${randHex()}`,
          sex: 'Colt',
          dateOfBirth: new Date(),
          age: 0,
          userId: user.id,
        },
        createdHorseIds,
      );

      // Non-vacuous eligibility lock: prove OUR specific foal is in the engine's
      // eligible set (not merely that some unrelated DB horse made the count >0),
      // so this test fails if the impl ever stops feeding eligible foals through.
      const eligibleIds = await getEligibleHorses(new Date());
      expect(eligibleIds).toContain(foal.id);

      const summary = await flagEvaluationImpl.evaluateWeeklyFlags();

      // Summary shape contract (flows into the heartbeat/health layer).
      expect(typeof summary.evaluated).toBe('number');
      expect(typeof summary.succeeded).toBe('number');
      expect(typeof summary.flagsAssigned).toBe('number');
      expect(typeof summary.errors).toBe('number');

      // Internal consistency: succeeded + errors never exceeds evaluated.
      expect(summary.succeeded + summary.errors).toBeLessThanOrEqual(summary.evaluated);

      // The impl evaluated AT LEAST every eligible horse — so our foal counts.
      expect(summary.evaluated).toBeGreaterThanOrEqual(eligibleIds.length);
      expect(summary.evaluated).toBeGreaterThanOrEqual(1);

      // The foal still exists (the evaluation never deletes horses) and is the
      // one we created.
      const stillThere = await prisma.horse.findUnique({ where: { id: foal.id } });
      expect(stillThere).not.toBeNull();
    }, 120000);
  });

  describe('sweepExpiredTemporaryFlagsJob()', () => {
    it('removes an already-expired temporary flag from a scoped horse and reports it in the summary', async () => {
      // Plant a temp flag whose expiresAt is in the PAST so the sweep must drop
      // it. We write the JSONB entry directly (deterministic, no clock race).
      const horse = await createTestHorse(
        prisma,
        {
          name: `TestFixture-flag-expired-${randHex()}`,
          sex: 'Mare',
          dateOfBirth: new Date(),
          age: 1,
          userId: user.id,
        },
        createdHorseIds,
      );

      const pastExpiry = new Date(Date.now() - 5 * MS_PER_DAY).toISOString();
      await prisma.horse.update({
        where: { id: horse.id },
        data: {
          temporaryEpigeneticFlags: [{ flag: 'startled', expiresAt: pastExpiry, source: 'test_fixture' }],
        },
      });

      const summary = await flagEvaluationImpl.sweepExpiredTemporaryFlagsJob();

      // Summary shape contract.
      expect(typeof summary.horsesScanned).toBe('number');
      expect(typeof summary.horsesUpdated).toBe('number');
      expect(typeof summary.flagsRemoved).toBe('number');

      // At least our scoped horse was scanned, updated, and its flag removed.
      expect(summary.horsesScanned).toBeGreaterThanOrEqual(1);
      expect(summary.horsesUpdated).toBeGreaterThanOrEqual(1);
      expect(summary.flagsRemoved).toBeGreaterThanOrEqual(1);

      // The expired flag is gone from OUR horse in the DB.
      const after = await prisma.horse.findUnique({
        where: { id: horse.id },
        select: { temporaryEpigeneticFlags: true },
      });
      const remaining = Array.isArray(after.temporaryEpigeneticFlags) ? after.temporaryEpigeneticFlags : [];
      expect(remaining.find(e => e.flag === 'startled')).toBeUndefined();
    }, 120000);

    it('retains a not-yet-expired temporary flag (idempotent on fresh flags)', async () => {
      // A future expiresAt must SURVIVE the sweep — proves the sweep removes
      // only what is actually expired, not every temp flag.
      const horse = await createTestHorse(
        prisma,
        {
          name: `TestFixture-flag-future-${randHex()}`,
          sex: 'Mare',
          dateOfBirth: new Date(),
          age: 1,
          userId: user.id,
        },
        createdHorseIds,
      );

      const futureExpiry = new Date(Date.now() + 5 * MS_PER_DAY).toISOString();
      await prisma.horse.update({
        where: { id: horse.id },
        data: {
          temporaryEpigeneticFlags: [{ flag: 'unsettled', expiresAt: futureExpiry, source: 'test_fixture' }],
        },
      });

      await flagEvaluationImpl.sweepExpiredTemporaryFlagsJob();

      const after = await prisma.horse.findUnique({
        where: { id: horse.id },
        select: { temporaryEpigeneticFlags: true },
      });
      const remaining = Array.isArray(after.temporaryEpigeneticFlags) ? after.temporaryEpigeneticFlags : [];
      expect(remaining.find(e => e.flag === 'unsettled')).toBeDefined();
    }, 120000);
  });
});
