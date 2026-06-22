/**
 * Integration test: foal-trait-evaluation impl module (Equoria-urqic.3)
 *
 * Proves the EXTRACTED impl module
 * (backend/services/jobs/impl/foalTraitEvaluation.mjs) is individually testable
 * against the REAL database (no mocks), independent of the CronJobService
 * orchestrator. The pre-existing singleton-driven suites
 * (foalDevelopmentDayAdvance, foalTraitRevealHistoryLog,
 * foalTraitRevealNotification) continue to exercise the delegator surface; this
 * suite locks the free-function entrypoints + the `service`-handle re-entry
 * contract that the split depends on.
 *
 * Scoped cleanup only (CLAUDE.md §2): we delete exactly the rows this suite
 * created (foalDevelopment by foalId, horses by id, the user by id), in FK
 * order, fail-loud.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { createTestHorse, cleanupTestHorses } from '../helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import * as foalTraitImpl from '../../services/jobs/impl/foalTraitEvaluation.mjs';

const randHex = () => randomBytes(6).toString('hex');

describe('INTEGRATION: foalTraitEvaluation impl module (Equoria-urqic.3)', () => {
  let user;
  const createdHorseIds = [];
  const createdFoalDevFoalIds = [];

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        username: `tf-urqic3-${randHex()}`,
        email: `tf-urqic3-${randHex()}@example.com`,
        password: 'x',
        firstName: 'Test',
        lastName: 'Fixture',
      },
    });
  }, 120000);

  afterAll(async () => {
    const cleanup = createCleanupTracker();
    if (createdFoalDevFoalIds.length) {
      cleanup.add(
        () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalDevFoalIds } } }),
        'foalDevelopment',
      );
    }
    cleanup.add(() => cleanupTestHorses(prisma, createdHorseIds), 'horses');
    if (user) {
      cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
    }
    await cleanup.run();
  }, 120000);

  async function makeFoal(currentDay, { bondScore = 50, stressLevel = 20 } = {}) {
    const foal = await createTestHorse(
      prisma,
      {
        name: `TestFixture-urqic3-${randHex()}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: user.id,
        bondScore,
        stressLevel,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
      createdHorseIds,
    );
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, currentDay } });
    createdFoalDevFoalIds.push(foal.id);
    return foal;
  }

  const reload = foalId => prisma.horse.findUnique({ where: { id: foalId }, include: { foalDevelopment: true } });

  describe('evaluateFoalTraits(service, foal)', () => {
    it('returns development_complete for a foal past the final development day (day 7)', async () => {
      // Pure branch — no DB write needed; uses a synthetic foal object.
      const result = await foalTraitImpl.evaluateFoalTraits(
        {
          // stub the re-entry methods so a mistaken advance/notify call would throw
          advanceFoalDevelopmentDay: () => {
            throw new Error('should not advance a development-complete foal');
          },
        },
        {
          id: 999801,
          name: 'TestFixture-urqic3-complete',
          foalDevelopment: { currentDay: 7 },
          epigeneticModifiers: null,
        },
      );
      expect(result).toEqual({ traitsRevealed: 0, reason: 'development_complete' });
    });

    it('advances currentDay 0 -> 1 on a real run via the impl function', async () => {
      const foal = await makeFoal(0);
      const before = await reload(foal.id);
      expect(before.foalDevelopment.currentDay).toBe(0);

      // Pass a real `service` handle: the impl re-enters service.* — here we use
      // a thin handle whose methods forward back into the impl's free functions,
      // exactly mirroring the class delegators.
      const service = {
        evaluateFoalTraits: f => foalTraitImpl.evaluateFoalTraits(service, f),
        advanceFoalDevelopmentDay: (id, day) => foalTraitImpl.advanceFoalDevelopmentDay(id, day),
        notifyTraitRevelation: (f, t, d) => foalTraitImpl.notifyTraitRevelation(f, t, d),
        logTraitRevelation: (id, n, t, d, f) => foalTraitImpl.logTraitRevelation(id, n, t, d, f),
        logAuditSummary: s => foalTraitImpl.logAuditSummary(s),
      };

      await foalTraitImpl.evaluateFoalTraits(service, before);

      const after = await reload(foal.id);
      expect(after.foalDevelopment.currentDay).toBe(1);
    }, 60000);
  });

  describe('advanceFoalDevelopmentDay(foalId, currentDay)', () => {
    it('upserts and steps the day forward by one', async () => {
      const foal = await makeFoal(2);
      const newDay = await foalTraitImpl.advanceFoalDevelopmentDay(foal.id, 2);
      expect(newDay).toBe(3);
      const after = await reload(foal.id);
      expect(after.foalDevelopment.currentDay).toBe(3);
    }, 60000);

    it('is capped at the final development day (6) and does not advance a complete foal', async () => {
      const foal = await makeFoal(6);
      const newDay = await foalTraitImpl.advanceFoalDevelopmentDay(foal.id, 6);
      expect(newDay).toBe(6);
      const after = await reload(foal.id);
      expect(after.foalDevelopment.currentDay).toBe(6);
    }, 60000);
  });

  describe('logTraitRevelation(...)', () => {
    it('persists each revealed trait to TraitHistoryLog with sourceType daily_evaluation', async () => {
      const foal = await makeFoal(2, { bondScore: 60, stressLevel: 25 });
      const reloaded = await reload(foal.id);

      await foalTraitImpl.logTraitRevelation(
        foal.id,
        foal.name,
        { positive: ['resilient'], negative: [], hidden: [] },
        2,
        reloaded,
      );

      const rows = await prisma.traitHistoryLog.findMany({ where: { horseId: foal.id } });
      const daily = rows.filter(r => r.sourceType === 'daily_evaluation');
      expect(daily.length).toBeGreaterThanOrEqual(1);
      expect(daily.some(r => r.traitName === 'resilient')).toBe(true);

      // scoped cleanup of the history rows this assertion created
      await prisma.traitHistoryLog.deleteMany({ where: { horseId: foal.id } });
    }, 60000);
  });

  describe('notifyTraitRevelation(...)', () => {
    it('writes a trait_discovery notification for the owner when visible traits revealed', async () => {
      const foal = await makeFoal(1);
      await foalTraitImpl.notifyTraitRevelation(
        { id: foal.id, name: foal.name, userId: user.id },
        { positive: ['bold'], negative: [], hidden: [] },
        1,
      );
      const notes = await prisma.notification.findMany({
        where: { userId: user.id, type: 'trait_discovery' },
      });
      expect(notes.length).toBeGreaterThanOrEqual(1);
      await prisma.notification.deleteMany({ where: { userId: user.id } });
    }, 60000);

    it('does NOT notify when only hidden traits are revealed', async () => {
      const foal = await makeFoal(2);
      await foalTraitImpl.notifyTraitRevelation(
        { id: foal.id, name: foal.name, userId: user.id },
        { positive: [], negative: [], hidden: ['intelligent'] },
        2,
      );
      const notes = await prisma.notification.findMany({
        where: { userId: user.id, type: 'trait_discovery' },
      });
      expect(notes.length).toBe(0);
    }, 60000);

    it('skips notification for an ownerless foal (userId null) without throwing', async () => {
      await expect(
        foalTraitImpl.notifyTraitRevelation(
          { id: 999802, name: 'TestFixture-urqic3-ownerless', userId: null },
          { positive: ['calm'], negative: [], hidden: [] },
          1,
        ),
      ).resolves.toBeUndefined();
    });
  });
});
