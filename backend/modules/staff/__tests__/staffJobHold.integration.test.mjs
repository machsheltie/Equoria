/**
 * The durable nightly-job hold (Equoria-puj1e.5, owner ruling q377) — real
 * HTTP, real DB, real cron monitor. Nothing is mocked.
 *
 * - Only the checked-in Owner holds and releases; admins, moderators and
 *   players are refused. Each change writes one staff log entry.
 * - A held job records 'skipped-held' and never runs its handler, through the
 *   scheduler singleton both registries use and through a brand-new monitor
 *   (a restarted process has no memory of the hold but still honours it).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import { CronJobMonitor } from '../../../services/jobs/cronJobMonitor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { capabilityRequiredCode } from '../middleware/requireStaffCapability.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import { restoreHold, snapshotHold } from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stjobhold');
const probeJob = `timeBackHoldProbe${uid()}`;
let holdBefore;

beforeAll(async () => {
  holdBefore = await snapshotHold();
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { jobName: { startsWith: probeJob } } }), 'probe runs');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
  // Start from a released hold whatever the database held before.
  await prisma.gameControl.deleteMany({ where: { id: 1 } });
});

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

/** Run a probe job through a monitor; returns how many times its handler ran. */
async function runProbe(monitor, name, opts) {
  let ran = 0;
  const result = await monitor.runWithHeartbeat(
    name,
    async () => {
      ran += 1;
      return { totalProcessed: 1 };
    },
    opts,
  );
  return { ran, result };
}

const runsOf = name =>
  prisma.cronRunLog.findMany({ where: { jobName: name }, orderBy: { id: 'asc' }, select: { status: true } });

describe('Holding the nightly jobs is the checked-in Owner alone (q377)', () => {
  it('refuses a player with the ordinary 404, and a checked-in moderator and admin', async () => {
    const player = await makeUser('user');
    expect((await post(`${staffApi}/jobs/hold`, player)).status).toBe(404);
    expect((await get(`${staffApi}/jobs/hold`, player)).status).toBe(404);

    for (const role of ['moderator', 'admin']) {
      const steward = await makeUser(role);
      const device = await checkIn(steward);
      for (const res of [
        await post(`${staffApi}/jobs/hold`, steward, {}, device),
        await post(`${staffApi}/jobs/release`, steward, {}, device),
        await get(`${staffApi}/jobs/hold`, steward, device),
      ]) {
        expect(res.status).toBe(403);
        expect(res.body.code).toBe(capabilityRequiredCode);
      }
    }
    expect(await prisma.gameControl.findUnique({ where: { id: 1 } })).toBeNull();
  }, 60_000);

  it('the Owner holds and releases; each change is logged once; repeats are refused', async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);

    const held = await post(`${staffApi}/jobs/hold`, owner, { reason: 'Server outage' }, device);
    expect(held.status).toBe(200);
    expect(held.body.data).toMatchObject({ held: true, heldById: owner.id, reason: 'Server outage' });
    expect((await get(`${staffApi}/jobs/hold`, owner, device)).body.data.held).toBe(true);

    const again = await post(`${staffApi}/jobs/hold`, owner, {}, device);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('jobsAlreadyHeld');

    const released = await post(`${staffApi}/jobs/release`, owner, {}, device);
    expect(released.status).toBe(200);
    expect(released.body.data.held).toBe(false);
    const twice = await post(`${staffApi}/jobs/release`, owner, {}, device);
    expect(twice.status).toBe(409);
    expect(twice.body.code).toBe('jobsNotHeld');

    const entries = await prisma.staffActionLog.findMany({
      where: { actorId: owner.id, capability: 'jobs.hold' },
      orderBy: { id: 'asc' },
    });
    expect(entries.map(e => e.after)).toEqual([{ held: true }, { held: false }]);
    expect(entries[0].reason).toBe('Server outage');
  }, 60_000);
});

describe('A held job skips, even after a restart (durable hold)', () => {
  it('skips through the scheduler both registries use and through a fresh monitor; runs again on release', async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);

    // The singleton CronJobService both job registries run through (registry B
    // passes its advisory lock key).
    const singleton = await runProbe(cronJobService, `${probeJob}A`, {
      applyLock: true,
      lockKey: `${probeJob}Lock`,
    });
    expect(singleton).toEqual({ ran: 0, result: null });
    expect(cronJobService.heartbeats.get(`${probeJob}A`).status).toBe('skipped-held');

    // A restarted process: a brand-new monitor with no in-memory state.
    const restarted = new CronJobMonitor();
    const afterRestart = await runProbe(restarted, `${probeJob}B`, { applyLock: true });
    expect(afterRestart).toEqual({ ran: 0, result: null });
    expect(await runsOf(`${probeJob}A`)).toEqual([{ status: 'skipped-held' }]);
    expect(await runsOf(`${probeJob}B`)).toEqual([{ status: 'skipped-held' }]);

    expect((await post(`${staffApi}/jobs/release`, owner, {}, device)).status).toBe(200);
    const released = await runProbe(new CronJobMonitor(), `${probeJob}B`, { applyLock: true });
    expect(released.ran).toBe(1);
    expect(await runsOf(`${probeJob}B`)).toEqual([{ status: 'skipped-held' }, { status: 'success' }]);
    cronJobService.heartbeats.delete(`${probeJob}A`);
  }, 60_000);
});
