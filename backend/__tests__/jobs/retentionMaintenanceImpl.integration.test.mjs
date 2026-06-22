/**
 * Integration test: retention/maintenance impl module (Equoria-urqic.3.3)
 *
 * Proves the EXTRACTED impl module
 * (backend/services/jobs/impl/retentionMaintenance.mjs) is individually testable
 * against the REAL database (no mocks), independent of the CronJobService
 * orchestrator. The cronJobs singleton delegators (and the existing
 * cronJobsOvernightShowExecution.test.mjs) continue to exercise the singleton
 * entrypoints; this suite locks the free-function impls directly, focusing on
 * the TWO wrappers with non-trivial summary-shaping per the issue AC:
 *
 *   - recordDocCoverageSnapshot(): the only wrapper that SHAPES a flattened
 *     summary out of two service calls (record + purge). This suite proves the
 *     flattened { snapshotId, coveragePct, qualityScore, deletedCount,
 *     retentionDays } object is wired from the right fields and that a real
 *     DocCoverageSnapshot row is persisted.
 *   - executeOvernightShows(): proves the free function drives the real
 *     executeClosedShows pipeline (open show with past closeDate -> completed,
 *     CompetitionResult created) WITHOUT going through the CronJobService
 *     singleton.
 *
 * Scoped cleanup only (CLAUDE.md §2): every fixture row uses a TestFixture-
 * prefix or a tracked id and is deleted in FK order, scoped to the rows this
 * suite created. No unscoped deleteMany() against the canonical DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../helpers/failLoudCleanup.mjs';
import { recordDocCoverageSnapshot, executeOvernightShows } from '../../services/jobs/impl/retentionMaintenance.mjs';

const FIXTURE_PREFIX = 'TestFixture-RetMaintImpl';

describe('INTEGRATION: retentionMaintenance impl (Equoria-urqic.3.3) — real DB', () => {
  describe('recordDocCoverageSnapshot()', () => {
    // Track the snapshot rows this suite records so cleanup is id-scoped.
    const recordedSnapshotIds = [];

    afterAll(async () => {
      if (recordedSnapshotIds.length > 0) {
        await prisma.docCoverageSnapshot.deleteMany({
          where: { id: { in: recordedSnapshotIds } },
        });
      }
    }, 30000);

    it('persists a real DocCoverageSnapshot row and returns the flattened summary', async () => {
      const result = await recordDocCoverageSnapshot();

      // Track for cleanup BEFORE asserting so a failed assertion still cleans up.
      expect(result.snapshotId).toEqual(expect.any(Number));
      recordedSnapshotIds.push(result.snapshotId);

      // Summary-shaping contract: the flattened keys are present and typed.
      expect(typeof result.coveragePct).toBe('number');
      expect(typeof result.qualityScore).toBe('number');
      expect(typeof result.deletedCount).toBe('number');
      expect(typeof result.retentionDays).toBe('number');
      // Retention is clamped to a >= 7-day floor by the retention service.
      expect(result.retentionDays).toBeGreaterThanOrEqual(7);

      // A real row was persisted, and the summary fields came FROM that row.
      const persisted = await prisma.docCoverageSnapshot.findUnique({
        where: { id: result.snapshotId },
      });
      expect(persisted).not.toBeNull();
      expect(persisted.coveragePct).toBe(result.coveragePct);
      expect(persisted.qualityScore).toBe(result.qualityScore);
    }, 60000);

    it('does not purge the just-recorded recent snapshot (scoped, time-based retention)', async () => {
      const result = await recordDocCoverageSnapshot();
      recordedSnapshotIds.push(result.snapshotId);

      // The row was recorded with capturedAt = now, well inside the >=7-day
      // window, so the purge step must NOT have deleted it.
      const stillThere = await prisma.docCoverageSnapshot.findUnique({
        where: { id: result.snapshotId },
      });
      expect(stillThere).not.toBeNull();
    }, 60000);
  });

  describe('executeOvernightShows()', () => {
    const cleanup = createCleanupTracker();
    let execUser;
    let execHorse;
    let pastShowId;

    beforeAll(async () => {
      const uid = randomBytes(4).toString('hex');

      execUser = await prisma.user.create({
        data: {
          email: `${FIXTURE_PREFIX}-${uid}@test.com`,
          username: `${FIXTURE_PREFIX}-${uid}`,
          password: 'irrelevant-hash',
          firstName: 'Cron',
          lastName: 'RetMaintImpl',
          money: 10000,
          level: 1,
          xp: 0,
        },
      });

      execHorse = await prisma.horse.create({
        data: {
          ...fixtureColor(),
          name: `${FIXTURE_PREFIX}-Horse-${uid}`,
          sex: 'Mare',
          dateOfBirth: new Date('2018-01-01'),
          age: 7,
          userId: execUser.id,
          healthStatus: 'healthy',
          speed: 60,
          stamina: 60,
          agility: 60,
          balance: 60,
          precision: 60,
          boldness: 60,
        },
      });

      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      const pastShow = await prisma.show.create({
        data: {
          name: `${FIXTURE_PREFIX}-Show-${uid}`,
          discipline: 'Dressage',
          entryFee: 0,
          levelMin: 1,
          levelMax: 999,
          prize: 1000,
          runDate: pastDate,
          status: 'open',
          openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          closeDate: pastDate,
          createdByUserId: execUser.id,
        },
      });
      pastShowId = pastShow.id;

      await prisma.showEntry.create({
        data: {
          showId: pastShowId,
          horseId: execHorse.id,
          userId: execUser.id,
          feePaid: 0,
        },
      });

      // Scoped, FK-ordered, fail-loud cleanup (mirrors
      // cronJobsOvernightShowExecution.test.mjs).
      cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: pastShowId } }), 'competitionResult');
      cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: pastShowId } }), 'showEntry');
      cleanup.add(() => prisma.show.delete({ where: { id: pastShowId } }), 'show');
      cleanup.add(() => prisma.horse.delete({ where: { id: execHorse.id } }), 'horse');
      cleanup.add(() => prisma.user.delete({ where: { id: execUser.id } }), 'user');
      cleanup.add(
        () => prisma.user.deleteMany({ where: { username: { startsWith: FIXTURE_PREFIX } } }),
        'defensive-user-sweep',
      );
    }, 30000);

    afterAll(() => cleanup.run(), 30000);

    it('drives executeClosedShows: open show with past closeDate -> completed + result row', async () => {
      const beforeShow = await prisma.show.findUnique({ where: { id: pastShowId } });
      expect(beforeShow.status).toBe('open');
      expect(beforeShow.executedAt).toBeNull();

      // Call the EXTRACTED free function directly — no CronJobService singleton.
      await executeOvernightShows();

      const afterShow = await prisma.show.findUnique({ where: { id: pastShowId } });
      expect(afterShow.status).toBe('completed');
      expect(afterShow.executedAt).toBeTruthy();
      expect(Number.isFinite(new Date(afterShow.executedAt).getTime())).toBe(true);

      const results = await prisma.competitionResult.findMany({ where: { showId: pastShowId } });
      expect(results.length).toBe(1);
      expect(results[0].horseId).toBe(execHorse.id);
      expect(results[0].placement).toBe('1');
      expect(Number(results[0].prizeWon)).toBe(500);
    }, 60000);
  });
});
