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
 * transaction's backend from pg_locks (the job's own advisory lock) and, on a
 * separate client, one fresh statement per poll, waits until the hold, apply or
 * undo is observed waiting for the barrier (equoria-lock-barrier-tests-three-traps).
 *
 * Owner ruling q398 (2026-11-20, Equoria-puj1e.5.2): a job that starts while
 * the hold is still waiting runs normally, and the hold waits for it too. It
 * used to queue behind the waiting hold, holding a pooled connection, and then
 * skip as held.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { CronJobMonitor } from '../../../services/jobs/cronJobMonitor.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { lockJobHoldTx, takeJobBarrierSharedTx } from '../services/jobHoldService.mjs';
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
 * How many sessions other than the running job's wait for the nightly-job
 * barrier in exclusive mode: inside a transaction whose latest statement takes
 * that lock, either queued on it behind the job or between tries. One fresh
 * statement outside any transaction.
 */
async function barrierWaiters(jobPid) {
  const [{ n }] = await observer.$queryRaw`
    SELECT count(*)::int AS n FROM pg_stat_activity
    WHERE datname = current_database() AND pid <> pg_backend_pid() AND pid <> ${jobPid}::int
      AND xact_start IS NOT NULL
      AND query ~ '^SELECT pg_(try_)?advisory_xact_lock[(]'
      AND ((state = 'active' AND ${jobPid}::int = ANY (pg_blocking_pids(pid)))
        OR state = 'idle in transaction')`;
  return n;
}

/**
 * Wait until the hold, apply or undo is seen waiting for the barrier while the
 * job holding `jobPid` runs; throws if `returned` settles first (the request
 * did not wait for the job).
 */
async function waitingForJob(jobPid, returned, label) {
  let settled = false;
  const mark = () => {
    settled = true;
  };
  returned.then(mark, mark);
  const deadline = Date.now() + 15_000;
  for (;;) {
    if (settled) {
      throw new Error(`${label} returned mid-run`);
    }
    if ((await barrierWaiters(jobPid)) > 0) {
      return 'waiting';
    }
    if (Date.now() > deadline) {
      throw new Error(`${label} was never seen waiting for the barrier`);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

/**
 * 'admitted while the hold waits' when `started` settles while the hold is
 * still waiting for the barrier behind the job holding `jobPid`; otherwise
 * what happened instead (the hold answered first, or stopped waiting).
 */
async function admittedWhileHoldWaits(started, hold, jobPid) {
  const first = await Promise.race([
    started.then(() => 'started'),
    hold.then(res => `hold returned ${res.status} first`),
  ]);
  if (first !== 'started') {
    return first;
  }
  return waitingForJob(jobPid, hold, 'hold').then(
    () => 'admitted while the hold waits',
    error => error.message,
  );
}

/** Start a staff request and record in `events` when it returns. */
const sendTracked = (send, events, name) =>
  Promise.resolve(send()).then(res => {
    events.push(`${name}Returned`);
    return res;
  });

describe('The hold waits for a running job, and no job body starts once it commits', () => {
  it('a job that starts while the hold waits runs normally; the hold waits for it too; later jobs skip', async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    const sendHold = await preparePost(`${staffApi}/jobs/hold`, owner, { reason: 'Outage' }, device);
    const events = [];

    const jobA = startBlockingJob(`${probeJob}A`, events);
    let jobB;
    let hold;
    let bStart;
    let holdWhileB;
    try {
      await jobA.started;
      const pidA = await jobLockHolderPid(`${probeJob}A`);
      // The Owner holds while job A's body is mid-run: the hold must not commit yet.
      hold = sendTracked(sendHold, events, 'hold');
      await waitingForJob(pidA, hold, 'hold');

      // Job B starts now, before the hold commits: it is admitted at once.
      jobB = startBlockingJob(`${probeJob}B`, events);
      bStart = await admittedWhileHoldWaits(jobB.started, hold, pidA);
      if (bStart === 'admitted while the hold waits') {
        const pidB = await jobLockHolderPid(`${probeJob}B`);
        await endJob(jobA);
        // Job A has finished; the hold still waits, now for job B.
        holdWhileB = await waitingForJob(pidB, hold, 'hold').catch(error => error.message);
      }
    } finally {
      await endJob(jobA);
      if (jobB) {
        await endJob(jobB);
      }
    }
    const [a, b, held] = await Promise.all([jobA.done, jobB.done, hold]);

    expect(bStart).toBe('admitted while the hold waits');
    expect(holdWhileB).toBe('waiting');
    expect(held.status).toBe(200);
    expect(held.body.data.held).toBe(true);
    expect(a).toEqual({ result: { totalProcessed: 1 }, ran: 1 });
    expect(b).toEqual({ result: { totalProcessed: 1 }, ran: 1 });
    expect(events).toEqual([
      `${probeJob}A:bodyStart`,
      `${probeJob}B:bodyStart`,
      `${probeJob}A:bodyEnd`,
      `${probeJob}B:bodyEnd`,
      'holdReturned',
    ]);
    expect(await runsOf(`${probeJob}A`)).toEqual([{ status: 'success' }]);
    expect(await runsOf(`${probeJob}B`)).toEqual([{ status: 'success' }]);

    // Once the hold has committed, a job that starts skips as held.
    let kRan = 0;
    const k = await new CronJobMonitor().runWithHeartbeat(
      `${probeJob}K`,
      async () => {
        kRan += 1;
        return { totalProcessed: 1 };
      },
      { applyLock: true },
    );
    expect(k).toBeNull();
    expect(kRan).toBe(0);
    expect(await runsOf(`${probeJob}K`)).toEqual([{ status: 'skipped-held' }]);
  }, 60_000);

  it('a show settlement that starts while the hold waits takes the barrier at once', async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    const sendHold = await preparePost(`${staffApi}/jobs/hold`, owner, {}, device);
    const events = [];

    const jobS = startBlockingJob(`${probeJob}S`, events);
    let hold;
    let settlement;
    let admitted;
    try {
      await jobS.started;
      const pidS = await jobLockHolderPid(`${probeJob}S`);
      hold = sendTracked(sendHold, events, 'hold');
      await waitingForJob(pidS, hold, 'hold');

      // The barrier as the admin's run of due shows and the Owner's Run Show take it.
      settlement = prisma.$transaction(async tx => {
        await takeJobBarrierSharedTx(tx);
        events.push('settlementAdmitted');
      });
      admitted = await admittedWhileHoldWaits(settlement, hold, pidS);
    } finally {
      await endJob(jobS);
    }
    const [s, held] = await Promise.all([jobS.done, hold, settlement]);

    expect(admitted).toBe('admitted while the hold waits');
    expect(held.status).toBe(200);
    expect(s.ran).toBe(1);
    expect(events).toEqual([`${probeJob}S:bodyStart`, 'settlementAdmitted', `${probeJob}S:bodyEnd`, 'holdReturned']);
  }, 60_000);

  it('refuses with a plain 409 when a job that started during its wait runs past it; nothing changes', async () => {
    const owner = await makeUser('owner');
    const device = await checkIn(owner);
    const sendHold = await preparePost(`${staffApi}/jobs/hold`, owner, {}, device);
    const events = [];

    const jobF = startBlockingJob(`${probeJob}F`, events);
    let jobG;
    let hold;
    let gStart;
    let refused;
    try {
      await jobF.started;
      const pidF = await jobLockHolderPid(`${probeJob}F`);
      hold = sendTracked(sendHold, events, 'hold');
      await waitingForJob(pidF, hold, 'hold');
      jobG = startBlockingJob(`${probeJob}G`, events);
      gStart = await admittedWhileHoldWaits(jobG.started, hold, pidF);
      // Job F finishes; job G keeps running past the hold's bounded wait.
      await endJob(jobF);
      refused = await hold;
    } finally {
      await endJob(jobF);
      if (jobG) {
        await endJob(jobG);
      }
    }

    expect(gStart).toBe('admitted while the hold waits');
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('jobsRunning');
    expect(await prisma.gameControl.findFirst({ where: { id: 1, jobsHeld: true } })).toBeNull();
    expect(await prisma.staffActionLog.count({ where: { actorId: owner.id, capability: 'jobs.hold' } })).toBe(0);
    expect(await jobG.done).toEqual({ result: { totalProcessed: 1 }, ran: 1 });
    expect(events).toEqual([
      `${probeJob}F:bodyStart`,
      `${probeJob}G:bodyStart`,
      `${probeJob}F:bodyEnd`,
      'holdReturned',
      `${probeJob}G:bodyEnd`,
    ]);
    expect(await runsOf(`${probeJob}F`)).toEqual([{ status: 'success' }]);
    expect(await runsOf(`${probeJob}G`)).toEqual([{ status: 'success' }]);
  }, 60_000);

  it('while apply or undo holds the barrier, a job that starts waits for it, then runs', async () => {
    const events = [];
    // The barrier exactly as apply and undo take it, first in their transaction.
    const barrier = await holdLock(observer, tx => lockJobHoldTx(tx));
    let late;
    let whileHeld;
    try {
      late = new CronJobMonitor().runWithHeartbeat(
        `${probeJob}H`,
        async () => {
          events.push('jobBody');
          return { totalProcessed: 1 };
        },
        { applyLock: true },
      );
      whileHeld = await Promise.race([
        barrier.waitForQueued(1).then(() => 'queued'),
        late.then(() => 'job ran while the barrier was held'),
      ]);
      events.push('barrierReleased');
    } finally {
      await barrier.release();
    }

    expect(whileHeld).toBe('queued');
    expect(await late).toEqual({ totalProcessed: 1 });
    expect(events).toEqual(['barrierReleased', 'jobBody']);
    expect(await runsOf(`${probeJob}H`)).toEqual([{ status: 'success' }]);
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

      apply = sendTracked(sendApply, events, 'apply');
      await waitingForJob(holderPid, apply, 'apply');
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

      undo = sendTracked(sendUndo, events, 'undo');
      await waitingForJob(holderPid, undo, 'undo');
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
