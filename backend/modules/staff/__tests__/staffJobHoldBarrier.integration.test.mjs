/**
 * The nightly-job hold is a quiescence barrier (Equoria-puj1e.5, Codex r2 #1;
 * docs/features/admin-time-back.md "Nightly-job hold") — real HTTP, real DB,
 * real cron monitor and real job locks. Nothing is mocked.
 *
 * The race this closes: a job read "not held", then the Owner held the jobs
 * (and could give time back), and the job's body ran anyway, changing what the
 * time-back had just adjusted and logging 'success' while the page said held.
 *
 * Each scenario keeps a probe job's body running (it waits on the test), so the
 * job is genuinely mid-run inside its own lock transaction. The test finds that
 * transaction's backend from pg_locks (the job's own advisory lock) and counts
 * only sessions blocked by THAT pid, on a separate client, one fresh statement
 * per poll (equoria-lock-barrier-tests-three-traps).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { CronJobMonitor } from '../../../services/jobs/cronJobMonitor.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, waitForBlockedSessions } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import {
  checkIn,
  createUserFactory,
  preparePost,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import {
  easternWall,
  freshCode,
  gameWideSuiteLock,
  gameWideSuiteWaitMs,
  restoreHold,
  snapshotHold,
  toMinute,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('stjobbar');
const probeJob = `jobHoldBarrierProbe${uid()}`;
const day = 86_400_000;
let holdBefore;
let observer;

const suiteLock = gameWideSuiteLock();
// First: one game-wide suite at a time (gameWideSuiteLock).
beforeAll(() => suiteLock.take(), gameWideSuiteWaitMs);

beforeAll(async () => {
  holdBefore = await snapshotHold();
  observer = createBarrierClient();
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => observer.$disconnect(), 'observer client');
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { jobName: { startsWith: probeJob } } }), 'probe runs');
  cleanup.add(() => prisma.timeBack.deleteMany({ where: { appliedById: scope() } }), 'time-backs');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
});

afterAll(() => cleanup.run(), 60_000);

// Last: the next game-wide suite may start.
afterAll(() => suiteLock.release());

beforeEach(async () => {
  startEmailCapture();
  // Every scenario starts with the jobs running (not held).
  await prisma.gameControl.deleteMany({ where: { id: 1 } });
});

afterEach(() => stopEmailCapture());

const runsOf = name =>
  prisma.cronRunLog.findMany({ where: { jobName: name }, orderBy: { id: 'asc' }, select: { status: true } });

/**
 * Start a probe job through a real monitor with its production advisory lock.
 * Its body records 'bodyStart', waits until `finish()` is called, then records
 * 'bodyEnd'. Resolves `started` once the body is running.
 */
function startBlockingJob(name, events) {
  let finish;
  let entered;
  const gate = new Promise(r => {
    finish = r;
  });
  const started = new Promise(r => {
    entered = r;
  });
  let ran = 0;
  const done = new CronJobMonitor()
    .runWithHeartbeat(
      name,
      async () => {
        ran += 1;
        events.push(`${name}:bodyStart`);
        entered();
        await gate;
        events.push(`${name}:bodyEnd`);
        return { totalProcessed: 1 };
      },
      { applyLock: true },
    )
    .then(result => ({ result, ran }));
  return { started, done, finish: () => finish() };
}

/** Let a probe job finish whatever happened, so no lock transaction outlives its test. */
async function endJob(job) {
  job.finish();
  await job.done.catch(err => console.warn(`[cleanup] probe job: ${err.message}`));
}

/** The backend pid of the transaction holding `lockName`'s job advisory lock. */
async function jobLockHolderPid(lockName) {
  const key = BigInt.asUintN(64, jobNameToLockKey(lockName));
  const classid = Number(key >> 32n);
  const objid = Number(key & 0xffffffffn);
  const deadline = Date.now() + 15_000;
  for (;;) {
    const rows = await observer.$queryRaw`
      SELECT pid::int AS pid FROM pg_locks
      WHERE locktype = 'advisory' AND granted
        AND classid = ${classid}::oid AND objid = ${objid}::oid AND objsubid = 1`;
    if (rows.length === 1) {
      return Number(rows[0].pid);
    }
    if (Date.now() > deadline) {
      throw new Error(`no session holds the advisory lock of ${lockName}`);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

/**
 * Wait until `count` sessions are blocked by the running job's transaction, or
 * until `returned` settles first: then the request did not wait for the job.
 */
async function queuedBehindJob(holderPid, count, returned, label) {
  const queued = waitForBlockedSessions(observer, holderPid, count).then(
    () => 'queued',
    error => error,
  );
  const first = await Promise.race([queued, returned.then(() => `${label} returned mid-run`)]);
  expect(first).toBe('queued');
}

describe('The hold waits for a running job, and no job body starts once it commits', () => {
  it('a job mid-run when the Owner holds finishes first; a job that started meanwhile skips as held', async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    const sendHold = await preparePost(`${staffApi}/jobs/hold`, owner, { reason: 'Outage' }, device);
    const events = [];

    const running = startBlockingJob(`${probeJob}A`, events);
    let hold;
    let late;
    let bRan = 0;
    try {
      await running.started;
      const holderPid = await jobLockHolderPid(`${probeJob}A`);

      // The Owner holds while job A's body is mid-run: the hold must not commit yet.
      hold = Promise.resolve(sendHold()).then(res => {
        events.push('holdReturned');
        return res;
      });
      await queuedBehindJob(holderPid, 1, hold, 'hold');

      // Job B starts now, before the hold commits: it waits behind the queued hold.
      late = new CronJobMonitor().runWithHeartbeat(
        `${probeJob}B`,
        async () => {
          bRan += 1;
          events.push(`${probeJob}B:bodyStart`);
          return { totalProcessed: 1 };
        },
        { applyLock: true },
      );
      await queuedBehindJob(holderPid, 2, Promise.race([hold, late]), 'hold or job B');
    } finally {
      await endJob(running);
    }
    const [a, held, b] = await Promise.all([running.done, hold, late]);

    expect(held.status).toBe(200);
    expect(held.body.data.held).toBe(true);
    expect(a).toEqual({ result: { totalProcessed: 1 }, ran: 1 });
    expect(b).toBeNull();
    expect(bRan).toBe(0);
    expect(events).toEqual([`${probeJob}A:bodyStart`, `${probeJob}A:bodyEnd`, 'holdReturned']);
    expect(await runsOf(`${probeJob}A`)).toEqual([{ status: 'success' }]);
    expect(await runsOf(`${probeJob}B`)).toEqual([{ status: 'skipped-held' }]);
  }, 60_000);

  it('gives up with a plain 409 when a job runs past the wait, holds nothing, and the job finishes', async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    const sendHold = await preparePost(`${staffApi}/jobs/hold`, owner, {}, device);
    const events = [];

    const running = startBlockingJob(`${probeJob}C`, events);
    let refused;
    try {
      await running.started;
      refused = await sendHold();
    } finally {
      await endJob(running);
    }
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('jobsRunning');
    expect(refused.body.message).toMatch(/nightly job is running/i);
    expect(await prisma.gameControl.findFirst({ where: { id: 1, jobsHeld: true } })).toBeNull();
    expect(await prisma.staffActionLog.count({ where: { actorId: owner.id, capability: 'jobs.hold' } })).toBe(0);
    expect(await running.done).toEqual({ result: { totalProcessed: 1 }, ran: 1 });
    expect(await runsOf(`${probeJob}C`)).toEqual([{ status: 'success' }]);
  }, 60_000);
});

describe('Giving time back never overlaps a running job', () => {
  it("apply's transaction cannot pass its hold check while a job body is mid-run", async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    const now = Date.now();
    const body = {
      start: easternWall(toMinute(now - 3 * day)),
      end: easternWall(toMinute(now - day)),
      code: await freshCode(owner, device, 'timeBackApply'),
    };
    const sendApply = await preparePost(`${staffApi}/time-back/apply`, owner, body, device);
    const events = [];

    const running = startBlockingJob(`${probeJob}D`, events);
    let apply;
    try {
      await running.started;
      const holderPid = await jobLockHolderPid(`${probeJob}D`);

      apply = Promise.resolve(sendApply()).then(res => {
        events.push('applyReturned');
        return res;
      });
      await queuedBehindJob(holderPid, 1, apply, 'apply');
    } finally {
      await endJob(running);
    }
    const [d, refused] = await Promise.all([running.done, apply]);
    // Not held, so apply refuses — but only after the running job finished.
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('timeBackJobsNotHeld');
    expect(d.ran).toBe(1);
    expect(events).toEqual([`${probeJob}D:bodyStart`, `${probeJob}D:bodyEnd`, 'applyReturned']);
    expect(await prisma.timeBack.count({ where: { appliedById: owner.id } })).toBe(0);
  }, 60_000);

  it("undo's transaction waits for a running job body before it restores anything", async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    const now = Date.now();
    // An applied time-back with nothing recorded: undo has nothing to restore, only to mark.
    const record = await prisma.timeBack.create({
      data: {
        windowStart: toMinute(now - 3 * day),
        windowEnd: toMinute(now - day),
        pauseSeconds: (2 * day) / 1000,
        appliedById: owner.id,
        summary: {},
      },
    });
    const code = await freshCode(owner, device, 'timeBackUndo');
    const sendUndo = await preparePost(`${staffApi}/time-back/${record.id}/undo`, owner, { code }, device);
    const events = [];

    const running = startBlockingJob(`${probeJob}E`, events);
    let undo;
    try {
      await running.started;
      const holderPid = await jobLockHolderPid(`${probeJob}E`);

      undo = Promise.resolve(sendUndo()).then(res => {
        events.push('undoReturned');
        return res;
      });
      await queuedBehindJob(holderPid, 1, undo, 'undo');
    } finally {
      await endJob(running);
    }
    const [e, undone] = await Promise.all([running.done, undo]);
    expect(undone.status).toBe(200);
    expect(undone.body.data.reversedAt).not.toBeNull();
    expect(e.ran).toBe(1);
    expect(events).toEqual([`${probeJob}E:bodyStart`, `${probeJob}E:bodyEnd`, 'undoReturned']);
  }, 60_000);
});
