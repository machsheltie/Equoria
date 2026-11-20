/**
 * Show settlements that are not nightly jobs, against the nightly-job barrier
 * that time-back apply, undo and hold take exclusively (Equoria-puj1e.5.3).
 *
 * 1. The admin's run of every due show (POST /api/v1/shows/execute) against a
 *    time-back apply. It never took the barrier: its conformation settlement
 *    claimed a due show and then wanted the entered horse, which the apply held
 *    while it waited to move that show's closing date. Postgres aborted one.
 * 2. The Owner's Run Show of a quarantined show while the barrier is held
 *    exclusively (as apply, undo and hold hold it). It never took the barrier
 *    and settled the show at once.
 *
 * Each interleaving is forced, not timed: a second client holds a lock (a
 * training log the apply moves after the horses and before the shows; the
 * barrier itself) and the settlement is started and either finishes or is
 * observed queued behind the holder (pg_blocking_pids of the holder only, a
 * fresh statement each poll; equoria-lock-barrier-tests-three-traps).
 *
 * Real app: the Owner's real fresh code, hold and apply over HTTP; the admin's
 * real check-in, CSRF and execute route; the player's real conformation entry;
 * the real show create and entry routes, test run and Run Show; real undo; real DB.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock, waitForBlockedSessions } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';
import { createTestHorse as createCompetitor } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { runQuarantinedShow, testRunQuarantinedShow } from '../../competition/index.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { lockJobHoldTx } from '../services/jobHoldService.mjs';
import { undoTimeBack } from '../services/timeBackService.mjs';
import {
  checkIn,
  createUserFactory,
  post,
  preparePost,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import {
  actionCodesFor,
  easternWall,
  freshCode,
  gameWideSuiteLock,
  gameWideSuiteWaitMs,
  restoreHold,
  snapshotHold,
  toMinute,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbshow');
const ORIGIN = 'http://localhost:3000';
const APPLY = `${staffApi}/time-back/apply`;
const EXECUTE = '/api/v1/shows/execute';
const day = 86_400_000;
const conformationFee = 120;
const riddenFee = 100;
const riddenPrize = 10 * riddenFee; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const startingMoney = 1000;
const fixture = `TestFixture-tbshow-${uid()}`;
const actor = { id: randomUUID(), role: 'owner' };
const savedCommitSha = process.env.RAILWAY_GIT_COMMIT_SHA;

let holdBefore;
let owner;
let ownerDevice;
let admin;
let adminDevice;
let csrf;
let barrierClient;
const made = { grooms: [], assignments: [], logs: [], horses: [], riders: [], shows: [], players: [] };

const suiteLock = gameWideSuiteLock();
// First: one game-wide suite at a time (gameWideSuiteLock).
beforeAll(() => suiteLock.take(), gameWideSuiteWaitMs);

beforeAll(async () => {
  process.env.RAILWAY_GIT_COMMIT_SHA = 'feed5eed53535353535353535353535353535353';
  holdBefore = await snapshotHold();
  barrierClient = createBarrierClient();
  const scope = () => ({ in: createdUserIds });
  const showScope = () => ({ in: made.shows });
  cleanup.add(() => barrierClient.$disconnect(), 'barrier client');
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  // Only undone time-backs: one still applied keeps its record (and fails the
  // owner's deletion loudly) so its changes can still be reversed.
  cleanup.add(async () => {
    const ids = (
      await prisma.timeBack.findMany({
        where: { appliedById: scope(), reversedAt: { not: null } },
        select: { id: true },
      })
    ).map(r => r.id);
    await prisma.timeBackChange.deleteMany({ where: { timeBackId: { in: ids } } });
    await prisma.timeBack.deleteMany({ where: { id: { in: ids } } });
  }, 'time-backs');
  cleanup.add(
    () =>
      prisma.cronRunLog.deleteMany({
        where: { OR: made.shows.map(id => ({ summary: { path: ['showId'], equals: id } })) },
      }),
    'show failure rows',
  );
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: actor.id } }), 'Run Show log');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: made.players } } }), 'notifications');
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: showScope() } }), 'results');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: showScope() } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: showScope() } }), 'ridden shows');
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { id: { in: made.logs } } }), 'training logs');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { id: { in: made.assignments } } }), 'assignments');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: made.grooms } } }), 'grooms');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: made.riders } } }), 'riders');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: made.horses } } }), 'competitors');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: made.players } } }), 'ledger rows');
  cleanup.add(() => cleanupTestData(), 'players, horses, shows');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');

  await prisma.gameControl.deleteMany({ where: { id: 1 } });
  csrf = await fetchCsrf(app);
  startEmailCapture();
  owner = await makeUser('owner');
  ownerDevice = await checkIn(owner);
  admin = await makeUser('admin');
  adminDevice = await checkIn(admin);
  // Apply needs the nightly jobs held.
  expect((await post(`${staffApi}/jobs/hold`, owner, {}, ownerDevice)).status).toBe(200);
  stopEmailCapture();
}, 120_000);

// Safety net: never leave a time-back applied in the shared database. Newest
// first, so each undo finds the values the time-back it reverses wrote.
afterAll(async () => {
  if (savedCommitSha === undefined) {
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
  } else {
    process.env.RAILWAY_GIT_COMMIT_SHA = savedCommitSha;
  }
  const open = await prisma.timeBack.findMany({
    where: { appliedById: { in: createdUserIds }, reversedAt: null },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  startEmailCapture();
  try {
    for (const { id } of open) {
      await undo(id).catch(err => console.warn(`[cleanup] undo ${id}: ${err.message}`));
    }
  } finally {
    stopEmailCapture();
  }
  await cleanup.run();
}, 120_000);

// Last: the next game-wide suite may start.
afterAll(() => suiteLock.release());

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

/** Undo a time-back through the service with the Owner's real fresh code. */
async function undo(timeBackId) {
  await requestFreshCode(owner, 'timeBackUndo');
  const proof = await checkFreshCode(owner, 'timeBackUndo', actionCodesFor(owner.email).at(-1));
  return undoTimeBack({ actor: owner, timeBackId, proof });
}

/** Start a promise and capture its outcome instead of throwing. */
function outcomeOf(promise) {
  return promise.then(
    result => ({ result }),
    error => ({ error }),
  );
}

/**
 * Wait until `inFlight` has finished, or until `count` sessions are queued
 * behind the holder, whichever comes first. Every poll is a fresh statement
 * outside any transaction, so pg_stat_activity is never a stale snapshot.
 * @returns {Promise<'finished'|'queued'>}
 */
async function finishedOrQueued(inFlight, barrier, count, timeoutMs = 15000) {
  let finished = false;
  inFlight.then(() => {
    finished = true;
  });
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (finished) {
      return 'finished';
    }
    const queued = await waitForBlockedSessions(barrierClient, barrier.pid, count, 0).then(
      () => true,
      () => false,
    );
    if (queued) {
      return 'queued';
    }
    if (Date.now() > deadline) {
      throw new Error(`Neither finished nor ${count} session(s) queued behind pid ${barrier.pid}`);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

/**
 * A player's horse entered, through the real route and presented by its groom,
 * in a conformation show; the show is then made due (closed a minute ago).
 */
async function makeDueConformationShow() {
  const { user, token } = await createTestUser({
    username: `${fixture}-entrant-${uid()}`,
    email: `${fixture}-entrant-${uid()}@example.com`,
    money: startingMoney,
  });
  const now = new Date();
  const horse = await createTestHorse({
    name: `${fixture}-entrant-${uid()}`,
    userId: user.id,
    healthStatus: 'Excellent',
    lastFedDate: now,
    lastVettedDate: now,
  });
  const groom = await prisma.groom.create({
    data: {
      name: `${fixture}-groom`,
      speciality: 'showHandling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: user.id } },
    },
  });
  made.grooms.push(groom.id);
  const assignment = await prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groom.id } },
      foal: { connect: { id: horse.id } },
      user: { connect: { id: user.id } },
      isActive: true,
      createdAt: new Date(Date.now() - 5 * day),
    },
  });
  made.assignments.push(assignment.id);
  const { user: host } = await createTestUser({
    username: `${fixture}-host-${uid()}`,
    email: `${fixture}-host-${uid()}@example.com`,
    money: startingMoney,
  });
  const openDate = new Date(Date.now() - 60 * 60 * 1000);
  const closeDate = new Date(openDate.getTime() + 7 * day);
  const show = await createTestShow({
    name: `${fixture}-conformation`,
    discipline: 'Conformation',
    showType: 'conformation',
    status: 'open',
    entryFee: conformationFee,
    prize: 0,
    levelMin: 1,
    levelMax: 10,
    openDate,
    closeDate,
    runDate: closeDate,
    createdByUserId: host.id,
  });
  const entry = await playerPost('/api/v1/competition/conformation/enter', token, {
    horseId: horse.id,
    groomId: groom.id,
    showId: show.id,
  });
  expect(entry.status).toBe(201);
  const dueAt = new Date(Date.now() - 60 * 1000);
  await prisma.show.update({ where: { id: show.id }, data: { closeDate: dueAt, runDate: dueAt } });
  return { user, horse, show, dueAt };
}

/** A real POST as a player (Bearer token and CSRF). */
function playerPost(url, token, body) {
  return request(app)
    .post(url)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body);
}

/** A ridden show created and entered through the real routes, then quarantined with its placing staged. */
async function makeQuarantinedRiddenShow() {
  const player = async (label, money) => {
    const madeUser = await createTestUser({
      username: `${fixture}-${label}-${uid()}`,
      email: `${fixture}-${label}-${uid()}@example.com`,
      money,
    });
    made.players.push(madeUser.user.id);
    return madeUser;
  };
  const { user: rider, token: riderToken } = await player('rider', riddenFee);
  const { token: hostToken } = await player('ridden-host', riddenPrize);
  const horse = await createCompetitor(
    prisma,
    {
      name: `${fixture}-competitor-${uid()}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(),
      age: 7,
      userId: rider.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      lastVettedDate: new Date(),
    },
    made.horses,
  );
  await giveEligibleRider(prisma, { horseId: horse.id, userId: rider.id }, made.riders);
  const created = await playerPost('/api/v1/shows/create', hostToken, {
    name: `${fixture}-ridden`,
    discipline: 'Dressage',
    entryFee: riddenFee,
    level: 1,
  });
  expect(created.status).toBe(201);
  const showId = created.body.data.show.id;
  made.shows.push(showId);
  const entered = await playerPost(`/api/v1/shows/${showId}/enter`, riderToken, { horseId: horse.id });
  expect(entered.status).toBe(201);
  await prisma.show.update({
    where: { id: showId },
    data: {
      closeDate: new Date(Date.now() - day),
      status: 'quarantined',
      executionAttempts: 3,
      stagedOrdering: [
        { horseId: horse.id, userId: rider.id, horseName: horse.name, score: 77, placement: 1, riderId: null },
      ],
    },
  });
  return showId;
}

const iso = date => new Date(date).toISOString();

describe('Show settlements outside the nightly jobs take the nightly-job barrier (Equoria-puj1e.5.3)', () => {
  it("the admin's run of every due show waits for a time-back apply, and both finish", async () => {
    const now = Date.now();
    const S = toMinute(now - 6 * day);
    const E = toMinute(now - 4 * day);
    const pauseMs = E.getTime() - S.getTime();
    const due = await makeDueConformationShow();
    // Another horse's training session inside the window: the apply moves it
    // after the horses (the entered one among them) and before the shows, so
    // holding it holds the apply there with the entered horse locked.
    const other = await createTestHorse({ name: `${fixture}-trained-${uid()}`, userId: due.user.id });
    const log = await prisma.trainingLog.create({
      data: { horseId: other.id, discipline: 'Dressage', trainedAt: new Date(S.getTime() + 3_600_000) },
    });
    made.logs.push(log.id);
    const code = await freshCode(owner, ownerDevice, 'timeBackApply');
    const sendApply = await preparePost(
      APPLY,
      owner,
      { start: easternWall(S), end: easternWall(E), code },
      ownerDevice,
    );
    const sendExecute = await preparePost(EXECUTE, admin, { showIds: [due.show.id] }, adminDevice);

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "training_logs" WHERE "id" = ${log.id} FOR UPDATE`,
    );
    let applying;
    let executing;
    try {
      applying = Promise.resolve(sendApply());
      // The apply waits on the training log with the entered horse locked.
      await barrier.waitForQueued(1);
      executing = Promise.resolve(sendExecute());
      // The admin's run queues behind the apply: on the barrier now; before the
      // fix, on the entered horse, with the due show already claimed.
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [applied, executed] = await Promise.all([applying, executing]);

    expect(applied.status).toBe(200);
    expect(executed.status).toBe(200);
    // The run read the due shows after the apply had moved them: this one is
    // no longer due, so it was not settled.
    expect(executed.body.data.executed).toBe(0);
    const timeBackId = applied.body.data.id;
    const show = await prisma.show.findUnique({ where: { id: due.show.id } });
    expect(show.status).toBe('open');
    expect(iso(show.closeDate)).toBe(iso(due.dueAt.getTime() + pauseMs));
    expect(show.feeEscrow).toBe(conformationFee);
    expect(await prisma.competitionResult.count({ where: { showId: due.show.id } })).toBe(0);
    const horse = await prisma.horse.findUnique({ where: { id: due.horse.id } });
    expect(iso(horse.dateOfBirth)).not.toBe(iso(due.horse.dateOfBirth));

    // Undo puts the show's dates back.
    await undo(timeBackId);
    const restored = await prisma.show.findUnique({ where: { id: due.show.id } });
    expect(iso(restored.closeDate)).toBe(iso(due.dueAt));
  }, 120_000);

  it("the Owner's Run Show waits while the barrier is held exclusively, then settles", async () => {
    const showId = await makeQuarantinedRiddenShow();
    const statGainRng = () => 0.99;
    const testRun = await testRunQuarantinedShow(showId, { actor, statGainRng });
    expect(testRun.passed).toBe(true);

    // The barrier as apply, undo and hold take it: exclusively, first.
    const barrier = await holdLock(barrierClient, tx => lockJobHoldTx(tx));
    let running;
    let whileHeld;
    let statusWhileHeld;
    try {
      running = outcomeOf(runQuarantinedShow(showId, { actor, statGainRng }));
      whileHeld = await finishedOrQueued(running, barrier, 1);
      statusWhileHeld = (await prisma.show.findUnique({ where: { id: showId }, select: { status: true } })).status;
    } finally {
      await barrier.release();
    }
    const ran = await running;

    expect(whileHeld).toBe('queued');
    expect(statusWhileHeld).toBe('quarantined');
    expect(ran.error).toBeUndefined();
    expect(ran.result).toEqual({ showId, status: 'completed', settled: 1 });
    const show = await prisma.show.findUnique({ where: { id: showId } });
    expect(show.status).toBe('completed');
    expect(show.prizeEscrow).toBe(0);
    expect(show.feeEscrow).toBe(0);
    expect(await prisma.competitionResult.count({ where: { showId } })).toBe(1);
  }, 120_000);
});
