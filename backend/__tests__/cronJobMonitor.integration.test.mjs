/**
 * Equoria-urqic.3.5 — CronJobMonitor collaborator integration test.
 *
 * The run-observability concern (heartbeat liveness, CronRunLog persistence,
 * the /api/admin/cron/health snapshot, the stale-alert debounce) was extracted
 * out of CronJobService into a dedicated CronJobMonitor collaborator. This
 * suite exercises that collaborator IN ISOLATION — a FRESH `new CronJobMonitor()`
 * (NOT the shared singleton), so it proves the unit is independently testable
 * and cannot leak state into sibling suites that touch the singleton.
 *
 * Coverage:
 *   1. Heartbeat liveness: runWithHeartbeat records startedAt/finishedAt/status
 *      on success, status=error + message on failure (and re-throws), and a
 *      non-object result summarizes to null.
 *   2. Run-log persistence: exactly one CronRunLog row per cycle, with typed
 *      counter columns mapped from the summary, on both success and error.
 *   3. getHealth shape + staleness: never-run → stale, fresh success → not
 *      stale, old finish (> threshold) → stale; serviceRunning flag honored.
 *   4. getHealthWithHistory: recentRuns[N] per job, ISO-string timestamps,
 *      sorted by startedAt DESC, limit respected.
 *
 * Real DB. No mocks. CronRunLog fixtures scoped by a unique jobName tag so
 * cleanup never touches real cron rows. The monitor instance is local — no
 * singleton snapshot/restore is needed.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { CronJobMonitor, STALE_ALERT_THRESHOLD_MS } from '../services/jobs/cronJobMonitor.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

const TAG = `urqic35-${randomBytes(4).toString('hex')}`;
const JOB_SUCCESS = `${TAG}-success`;
const JOB_ERROR = `${TAG}-error`;
const JOB_HEALTH = `${TAG}-health`;

/**
 * Realm-safe "is this a valid Date" assertion (mirrors the cronRunLog suite).
 * `instanceof Date` is fragile across worktree-junction Prisma realms; the
 * Object.prototype.toString tag check is realm-independent.
 */
function expectValidDate(value) {
  expect(Object.prototype.toString.call(value)).toBe('[object Date]');
  expect(Number.isNaN(new Date(value).getTime())).toBe(false);
}

describe('Equoria-urqic.3.5: CronJobMonitor (isolated collaborator)', () => {
  beforeAll(async () => {
    // Sanity: confirm the table is reachable before the suite begins.
    await prisma.cronRunLog.findMany({ where: { jobName: JOB_SUCCESS }, take: 1 });
  });

  afterAll(async () => {
    // Scoped cleanup: only rows this run tagged.
    await prisma.cronRunLog.deleteMany({ where: { jobName: { startsWith: TAG } } });
  });

  describe('heartbeat liveness (runWithHeartbeat)', () => {
    it('records startedAt + finishedAt + status=success on a successful run', async () => {
      const monitor = new CronJobMonitor();
      const result = await monitor.runWithHeartbeat(JOB_SUCCESS, async () => ({
        totalProcessed: 5,
        birthdaysFound: 2,
        errors: 0,
      }));

      expect(result.totalProcessed).toBe(5);
      const hb = monitor.heartbeats.get(JOB_SUCCESS);
      expect(hb).toBeDefined();
      expect(hb.status).toBe('success');
      expectValidDate(hb.startedAt);
      expectValidDate(hb.finishedAt);
      expect(hb.summary).toEqual(expect.objectContaining({ totalProcessed: 5, birthdaysFound: 2, errors: 0 }));
      expect(hb.error).toBeNull();
    });

    it('records status=error + message on a failed run, and re-throws', async () => {
      const monitor = new CronJobMonitor();
      await expect(
        monitor.runWithHeartbeat(JOB_ERROR, async () => {
          throw new Error('urqic35-synthetic-failure');
        }),
      ).rejects.toThrow('urqic35-synthetic-failure');

      const hb = monitor.heartbeats.get(JOB_ERROR);
      expect(hb.status).toBe('error');
      expect(hb.error).toBe('urqic35-synthetic-failure');
      expectValidDate(hb.finishedAt);
    });

    it('summarizes a non-object result to null without crashing', async () => {
      const monitor = new CronJobMonitor();
      await monitor.runWithHeartbeat(JOB_SUCCESS, async () => undefined);
      const hb = monitor.heartbeats.get(JOB_SUCCESS);
      expect(hb.status).toBe('success');
      expect(hb.summary).toBeNull();
    });
  });

  describe('run-log persistence (CronRunLog)', () => {
    it('persists exactly one row on success with typed counters', async () => {
      const monitor = new CronJobMonitor();
      const jobName = `${TAG}-persist-ok`;
      await monitor.runWithHeartbeat(jobName, async () => ({
        totalProcessed: 7,
        birthdaysFound: 3,
        milestonesEvaluated: 2,
        errors: 0,
        opened: 1,
        closed: 4,
      }));

      const rows = await prisma.cronRunLog.findMany({ where: { jobName } });
      expect(rows.length).toBe(1);
      const row = rows[0];
      expect(row.status).toBe('success');
      expect(row.horsesProcessed).toBe(7); // totalProcessed → horsesProcessed column
      expect(row.birthdaysFound).toBe(3);
      expect(row.milestonesEvaluated).toBe(2);
      expect(row.electionsOpened).toBe(1);
      expect(row.electionsClosed).toBe(4);
      expect(row.errorsCount).toBe(0);
      expect(row.errorMessage).toBeNull();
      expect(row.summary).toMatchObject({ totalProcessed: 7, birthdaysFound: 3 });
    });

    it('persists exactly one row on error with errorMessage', async () => {
      const monitor = new CronJobMonitor();
      const jobName = `${TAG}-persist-err`;
      await expect(
        monitor.runWithHeartbeat(jobName, async () => {
          throw new Error('urqic35-persist-failure');
        }),
      ).rejects.toThrow('urqic35-persist-failure');

      const rows = await prisma.cronRunLog.findMany({ where: { jobName } });
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('error');
      expect(rows[0].errorMessage).toBe('urqic35-persist-failure');
      expect(rows[0].summary).toBeNull();
    });
  });

  describe('getHealth shape + staleness', () => {
    it('flags a never-run job as STALE and reports serviceRunning', () => {
      const monitor = new CronJobMonitor();
      const health = monitor.getHealth([JOB_HEALTH], { serviceRunning: true });
      expect(health.serviceRunning).toBe(true);
      expect(health.anyStale).toBe(true);
      const block = health.jobs[JOB_HEALTH];
      expect(block.stale).toBe(true);
      expect(block.lastFinishedAt).toBeNull();
      expect(block.status).toBe('never-run');
    });

    it('clears STALE after a fresh successful run', async () => {
      const monitor = new CronJobMonitor();
      await monitor.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 1 }));
      const health = monitor.getHealth([JOB_HEALTH], { serviceRunning: true });
      const block = health.jobs[JOB_HEALTH];
      expect(block.stale).toBe(false);
      expect(block.status).toBe('success');
      expect(block.lastFinishedAt).not.toBeNull();
    });

    it('flags STALE when the last finish is older than the threshold', () => {
      const monitor = new CronJobMonitor();
      // 48h ago — daily-job default threshold is 30h.
      const longAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      monitor.recordHeartbeat(JOB_HEALTH, {
        startedAt: longAgo,
        finishedAt: longAgo,
        status: 'success',
      });
      const health = monitor.getHealth([JOB_HEALTH], { serviceRunning: false });
      expect(health.serviceRunning).toBe(false);
      expect(health.jobs[JOB_HEALTH].stale).toBe(true);
      expect(health.anyStale).toBe(true);
    });

    it('STALE_ALERT_THRESHOLD_MS is exactly 25 hours', () => {
      expect(STALE_ALERT_THRESHOLD_MS).toBe(25 * 60 * 60 * 1000);
    });
  });

  describe('getHealthWithHistory recentRuns', () => {
    it('returns recentRuns[N] per job, ISO timestamps, sorted by startedAt DESC', async () => {
      const monitor = new CronJobMonitor();
      const jobName = `${TAG}-history`;
      await monitor.runWithHeartbeat(jobName, async () => ({ totalProcessed: 1 }));
      await monitor.runWithHeartbeat(jobName, async () => ({ totalProcessed: 2 }));
      await monitor.runWithHeartbeat(jobName, async () => ({ totalProcessed: 3 }));

      const health = await monitor.getHealthWithHistory([jobName], {
        serviceRunning: true,
        recentRunsLimit: 5,
      });
      const block = health.jobs[jobName];
      expect(Array.isArray(block.recentRuns)).toBe(true);
      expect(block.recentRuns.length).toBe(3);
      // Most recent (totalProcessed=3) first.
      expect(block.recentRuns[0].horsesProcessed).toBe(3);
      expect(block.recentRuns[2].horsesProcessed).toBe(1);
      // ISO-string contract (the /api/admin/cron/health JSON response).
      const { startedAt, finishedAt } = block.recentRuns[0];
      expect(typeof startedAt).toBe('string');
      expect(startedAt).toBe(new Date(startedAt).toISOString());
      expect(typeof finishedAt).toBe('string');
      expect(finishedAt).toBe(new Date(finishedAt).toISOString());
    });

    it('respects the recentRunsLimit argument', async () => {
      const monitor = new CronJobMonitor();
      const jobName = `${TAG}-limit`;
      await monitor.runWithHeartbeat(jobName, async () => ({ totalProcessed: 1 }));
      await monitor.runWithHeartbeat(jobName, async () => ({ totalProcessed: 2 }));
      await monitor.runWithHeartbeat(jobName, async () => ({ totalProcessed: 3 }));

      const health = await monitor.getHealthWithHistory([jobName], { recentRunsLimit: 2 });
      expect(health.jobs[jobName].recentRuns.length).toBe(2);
    });
  });
});
