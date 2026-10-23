/**
 * Equoria-cmw85.9 — the five cronJobService-registry jobs (weeklySalaries,
 * tokenCleanup, foaling, riderTrainerRetirement, userRankSnapshot) used to run
 * only under an advisory lock: no heartbeat, no CronRunLog row, and
 * /api/admin/cron/health never listed them, so a silent stall of the salary job
 * raised no signal.
 *
 * Real node-cron tasks, real DB, no mocks. The scheduled callback is invoked
 * through node-cron's own `execute()`, so this proves the wiring the scheduler
 * uses, not a helper the scheduler might bypass.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import cron from 'node-cron';
import prisma from '../../packages/database/prismaClient.mjs';
import { initializeCronJobs, stopCronJobs } from '../services/cronJobService.mjs';
import cronJobService from '../services/cronJobs.mjs';
import serviceRegistry from '../services/cron-job-service-jobs/index.mjs';
import { snapshotCronSingleton, restoreCronSingleton } from './helpers/cronSingletonIsolation.mjs';

const registryNames = serviceRegistry.map(job => job.jobName);

describe('cronJobService registry heartbeat coverage (Equoria-cmw85.9)', () => {
  let cronSnapshot;
  let suiteStart;

  beforeAll(() => {
    cronSnapshot = snapshotCronSingleton();
    suiteStart = new Date();
    cronJobService.heartbeats.clear();
  });

  afterAll(async () => {
    stopCronJobs();
    // Only the rows this suite's own scheduled run wrote (name + start window).
    await prisma.cronRunLog.deleteMany({
      where: { jobName: { in: registryNames }, startedAt: { gte: suiteStart } },
    });
    restoreCronSingleton(cronSnapshot);
  });

  afterEach(() => {
    stopCronJobs();
  });

  it('every registry descriptor declares a staleness budget', () => {
    for (const job of serviceRegistry) {
      expect({ jobName: job.jobName, ok: Number.isFinite(job.staleAfterMs) && job.staleAfterMs > 0 }).toEqual({
        jobName: job.jobName,
        ok: true,
      });
    }
  });

  it('cron health lists all five registry jobs once the service is initialised', () => {
    initializeCronJobs();
    const health = cronJobService.getHealth();
    for (const jobName of registryNames) {
      expect(health.jobs).toHaveProperty(jobName);
      expect(health.jobs[jobName].stalenessMs).toBe(serviceRegistry.find(job => job.jobName === jobName).staleAfterMs);
    }
  });

  it('a scheduled registry run records a heartbeat and a CronRunLog row', async () => {
    initializeCronJobs();
    const tokenCleanup = serviceRegistry.find(job => job.jobName === 'tokenCleanup');
    const task = [...cron.getTasks().values()].find(t => t.getPattern() === tokenCleanup.schedule);
    expect(task).toBeDefined();

    await task.execute();

    const health = await cronJobService.getHealthWithHistory({ recentRunsLimit: 5 });
    expect(health.jobs.tokenCleanup.status).toBe('success');
    expect(health.jobs.tokenCleanup.stale).toBe(false);
    expect(health.jobs.tokenCleanup.lockHeld).toBe(false);
    expect(health.jobs.tokenCleanup.lastLockAcquired).toBe(true);

    const rows = await prisma.cronRunLog.findMany({
      where: { jobName: 'tokenCleanup', startedAt: { gte: suiteStart } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('success');
  });
});
