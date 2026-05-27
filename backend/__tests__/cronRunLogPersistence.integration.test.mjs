/**
 * Equoria-9wby — Persistent CronRunLog integration test.
 *
 * Validates that:
 *   1. CronJobService.runWithHeartbeat persists exactly ONE CronRunLog row
 *      per cycle on success — with typed counter columns mapped from the
 *      handler's summary payload (horsesProcessed, birthdaysFound, etc.).
 *   2. CronJobService.runWithHeartbeat persists exactly ONE CronRunLog row
 *      per cycle on error — with status='error' and errorMessage populated.
 *   3. CronJobService.getHealthWithHistory exposes recentRuns[N] per job in
 *      the response, sorted by startedAt DESC — answering the AC literally:
 *      "/api/admin/cron/health snapshot now includes recentRuns[5] per job".
 *
 * Real DB. No mocks. No bypass headers. Test fixtures are scoped by a unique
 * jobName tag so cleanup never touches real cron rows.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import cronJobService from '../services/cronJobs.mjs';
import prisma from '../../packages/database/prismaClient.mjs';

/**
 * Equoria-s20o: realm-safe "is this a valid Date" assertion.
 *
 * `expect(x).toBeInstanceOf(Date)` is fragile here: the Prisma client this
 * test imports (`../../packages/database/prismaClient.mjs`) and the one the
 * service-under-test imports (`../db/index.mjs`) can resolve `@prisma/client`
 * through different module realms (worktree node_modules junction / dual
 * import paths), so a Date returned by Prisma is a *different realm's* Date
 * and fails `instanceof` against jest's `Date` global even though it IS a
 * Date. `Object.prototype.toString` tagging is realm-independent and is the
 * correct cross-realm Date check. The persisted value is genuinely a Date —
 * this asserts that without the realm coupling.
 */
function expectValidDate(value) {
  expect(Object.prototype.toString.call(value)).toBe('[object Date]');
  expect(Number.isNaN(new Date(value).getTime())).toBe(false);
}

const TAG = `9wby-${randomBytes(4).toString('hex')}`;
const JOB_SUCCESS = `${TAG}-success`;
const JOB_ERROR = `${TAG}-error`;
const JOB_HEALTH = `${TAG}-health`;

describe('Equoria-9wby: CronRunLog persistence', () => {
  beforeAll(async () => {
    // Sanity: confirm the table is reachable before the suite begins.
    // If the migration hasn't been applied, this will throw early with a
    // clear schema-not-found error rather than producing confusing test
    // failures further down.
    await prisma.cronRunLog.findMany({
      where: { jobName: JOB_SUCCESS },
      take: 1,
    });
  });

  afterAll(async () => {
    // Scoped cleanup: only delete rows tagged by this test run.
    await prisma.cronRunLog.deleteMany({
      where: { jobName: { startsWith: TAG } },
    });
  });

  beforeEach(() => {
    // Reset in-memory heartbeat state to avoid cross-test bleed.
    cronJobService.heartbeats.clear();
    // Ensure the test job names are seeded in this.jobs so getHealth()
    // surfaces them (it iterates this.jobs.keys()).
    cronJobService.jobs.set(JOB_SUCCESS, { running: false, scheduled: false });
    cronJobService.jobs.set(JOB_ERROR, { running: false, scheduled: false });
    cronJobService.jobs.set(JOB_HEALTH, { running: false, scheduled: false });
  });

  it('persists exactly one CronRunLog row on a successful run, with typed counters', async () => {
    const result = await cronJobService.runWithHeartbeat(JOB_SUCCESS, async () => ({
      totalProcessed: 7,
      birthdaysFound: 3,
      milestonesEvaluated: 2,
      errors: 0,
      opened: 1,
      closed: 4,
    }));

    expect(result.totalProcessed).toBe(7);

    const rows = await prisma.cronRunLog.findMany({ where: { jobName: JOB_SUCCESS } });
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.status).toBe('success');
    expectValidDate(row.finishedAt);
    expectValidDate(row.startedAt);
    expect(row.horsesProcessed).toBe(7); // totalProcessed maps to horsesProcessed column
    expect(row.birthdaysFound).toBe(3);
    expect(row.milestonesEvaluated).toBe(2);
    expect(row.electionsOpened).toBe(1);
    expect(row.electionsClosed).toBe(4);
    expect(row.errorsCount).toBe(0);
    expect(row.errorMessage).toBeNull();
    expect(row.summary).toMatchObject({
      totalProcessed: 7,
      birthdaysFound: 3,
    });
  });

  it('persists exactly one CronRunLog row on an errored run, with errorMessage', async () => {
    await expect(
      cronJobService.runWithHeartbeat(JOB_ERROR, async () => {
        throw new Error('9wby-synthetic-failure');
      }),
    ).rejects.toThrow('9wby-synthetic-failure');

    const rows = await prisma.cronRunLog.findMany({ where: { jobName: JOB_ERROR } });
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.status).toBe('error');
    expect(row.errorMessage).toBe('9wby-synthetic-failure');
    expectValidDate(row.finishedAt);
    expect(row.horsesProcessed).toBeNull();
    expect(row.summary).toBeNull();
  });

  it('getHealthWithHistory returns recentRuns[N] per job, sorted by startedAt DESC', async () => {
    // Plant 3 runs for the health-test job so we can assert ordering + the
    // recentRuns limit.
    await cronJobService.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 1 }));
    await cronJobService.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 2 }));
    await cronJobService.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 3 }));

    const health = await cronJobService.getHealthWithHistory({ recentRunsLimit: 5 });
    const jobBlock = health.jobs[JOB_HEALTH];
    expect(jobBlock).toBeDefined();
    expect(Array.isArray(jobBlock.recentRuns)).toBe(true);
    expect(jobBlock.recentRuns.length).toBe(3);
    // Sorted by startedAt DESC — most recent (totalProcessed=3) first.
    expect(jobBlock.recentRuns[0].horsesProcessed).toBe(3);
    expect(jobBlock.recentRuns[1].horsesProcessed).toBe(2);
    expect(jobBlock.recentRuns[2].horsesProcessed).toBe(1);
    // Equoria-s20o: recentRuns[].startedAt/finishedAt are contractually ISO
    // strings (this feeds the JSON /api/admin/cron/health response). Assert
    // both that the type is string AND that it round-trips as a valid ISO
    // timestamp — a sentinel for the realm-safe serialization in
    // getHealthWithHistory (a regression to the `instanceof Date` guard would
    // leak a raw Date object and fail the typeof check here).
    const { startedAt, finishedAt } = jobBlock.recentRuns[0];
    expect(typeof startedAt).toBe('string');
    expect(startedAt).toBe(new Date(startedAt).toISOString());
    expect(typeof finishedAt).toBe('string');
    expect(finishedAt).toBe(new Date(finishedAt).toISOString());
  });

  it('orders recentRuns deterministically by id when startedAt ties', async () => {
    // Sentinel for the intermittent shard-4 flake at the recentRuns ordering
    // assertion: when two runs share a startedAt millisecond,
    // `orderBy: { startedAt: 'desc' }` alone returns ties in arbitrary physical
    // order, so recentRuns[0] was nondeterministic. With the secondary
    // `id desc` tiebreak, the last-inserted (highest id) row must sort first.
    // This plants 3 rows with an IDENTICAL startedAt to force the tie on every
    // run (not just when the clock happens to collide).
    const JOB_TIE = `${TAG}-tie`;
    cronJobService.jobs.set(JOB_TIE, { running: false, scheduled: false });
    const sharedStart = new Date('2026-05-01T00:00:00.000Z');
    // Insert ascending so ascending id == ascending horsesProcessed; the
    // tiebreak must surface horsesProcessed=3 (highest id) first.
    for (const n of [1, 2, 3]) {
      await prisma.cronRunLog.create({
        data: {
          jobName: JOB_TIE,
          startedAt: sharedStart,
          finishedAt: sharedStart,
          status: 'success',
          horsesProcessed: n,
        },
      });
    }

    const health = await cronJobService.getHealthWithHistory({ recentRunsLimit: 5 });
    const recent = health.jobs[JOB_TIE].recentRuns;
    expect(recent.length).toBe(3);
    expect(recent[0].horsesProcessed).toBe(3);
    expect(recent[1].horsesProcessed).toBe(2);
    expect(recent[2].horsesProcessed).toBe(1);
  });

  it('getHealthWithHistory respects the recentRunsLimit argument', async () => {
    await cronJobService.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 1 }));
    await cronJobService.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 2 }));
    await cronJobService.runWithHeartbeat(JOB_HEALTH, async () => ({ totalProcessed: 3 }));

    const health = await cronJobService.getHealthWithHistory({ recentRunsLimit: 2 });
    expect(health.jobs[JOB_HEALTH].recentRuns.length).toBe(2);
  });
});
