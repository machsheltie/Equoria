/**
 * Owner time-back apply against a player's show entry over the same horse,
 * show and account (Equoria-puj1e.5.2). Both were deadlocks: Postgres aborted
 * the apply.
 *
 * 1. The apply locked every young horse FOR UPDATE (birth date) before the open
 *    shows. An entry holding its show inserts a ShowEntry, whose foreign key
 *    needs a key-share lock on the horse, which FOR UPDATE blocks: the entry
 *    waited for the apply's horse, the apply for the entry's show.
 * 2. The apply took the accounts it grants an owed bank week last, after the
 *    shows. An entry takes its player's account first, then the show: the
 *    entry waited for the apply's show, the apply for the entry's account.
 *
 * Each interleaving is forced, not timed: a second client holds a row the apply
 * needs after its earlier locks (a training log; a Hall of Fame round), so the
 * apply is held there with them in hand; the entry is then started and either
 * finishes or is observed queued behind the holder (pg_blocking_pids of the
 * holder only, a fresh statement each poll). Releasing lets both finish, or
 * deadlock.
 *
 * Real app: the Owner's real fresh code, hold and apply over HTTP; the player's
 * real JWT, CSRF and conformation entry route; real undo; real DB. Apply moves
 * every matching row in the shared database, so each scenario undoes its
 * time-back (and the afterAll safety net undoes any left, newest first).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createBarrierClient, holdLock, waitForBlockedSessions } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { gameDayIndex, startOfGameDayIndex, startOfGameWeek } from '../../../utils/gameTime.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
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
  restoreHold,
  snapshotHold,
  toMinute,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbentry');
const ORIGIN = 'http://localhost:3000';
const APPLY = `${staffApi}/time-back/apply`;
const day = 86_400_000;
const entryFee = 120;
const startingMoney = 1000;
const fixture = `TestFixture-tbentry-${uid()}`;
// Far past every Hall of Fame suite's synthetic weeks, so no round runner closes it.
const farEnd = new Date(Date.UTC(2200, 0, 1));

let holdBefore;
let owner;
let device;
let csrf;
let barrierClient;
const made = { grooms: [], assignments: [], logs: [], rounds: [] };

beforeAll(async () => {
  holdBefore = await snapshotHold();
  barrierClient = createBarrierClient();
  const scope = () => ({ in: createdUserIds });
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
  cleanup.add(() => prisma.trainingLog.deleteMany({ where: { id: { in: made.logs } } }), 'training logs');
  cleanup.add(() => prisma.hallOfFameRound.deleteMany({ where: { id: { in: made.rounds } } }), 'rounds');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { id: { in: made.assignments } } }), 'assignments');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: made.grooms } } }), 'grooms');
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
  device = await checkIn(owner);
  // Apply needs the nightly jobs held.
  expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
  stopEmailCapture();
}, 120_000);

// Safety net: never leave a time-back applied in the shared database. Newest
// first, so each undo finds the values the time-back it reverses wrote.
afterAll(async () => {
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

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

/** Undo a time-back through the service with the Owner's real fresh code. */
async function undo(timeBackId) {
  await requestFreshCode(owner, 'timeBackUndo');
  const proof = await checkFreshCode(owner, 'timeBackUndo', actionCodesFor(owner.email).at(-1));
  return undoTimeBack({ actor: owner, timeBackId, proof });
}

/** A player with a horse, a groom assigned to it five days ago, and an open conformation show to enter. */
async function makeEntrant(label, userExtra = {}) {
  const { user, token } = await createTestUser({
    username: `${fixture}-${label}-${uid()}`,
    email: `${fixture}-${label}-${uid()}@example.com`,
    money: startingMoney,
  });
  if (userExtra.createdAt) {
    await prisma.user.update({ where: { id: user.id }, data: { createdAt: userExtra.createdAt } });
  }
  const now = new Date();
  const horse = await createTestHorse({
    name: `${fixture}-${label}-${uid()}`,
    userId: user.id,
    healthStatus: 'Excellent',
    lastFedDate: now,
    lastVettedDate: now,
  });
  const groom = await prisma.groom.create({
    data: {
      name: `${fixture}-${label}`,
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
    name: `${fixture}-show`,
    discipline: 'Conformation',
    showType: 'conformation',
    status: 'open',
    entryFee,
    prize: 0,
    levelMin: 1,
    levelMax: 10,
    openDate,
    closeDate,
    runDate: closeDate,
    createdByUserId: host.id,
  });
  const enter = () =>
    request(app)
      .post('/api/v1/competition/conformation/enter')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, groomId: groom.id, showId: show.id });
  return { user, horse, show, enter };
}

/**
 * Wait until `inFlight` has finished, or until `count` sessions are queued
 * behind the holder, whichever comes first. Every poll is a fresh statement
 * outside any transaction, so pg_stat_activity is never a stale snapshot.
 * @returns {Promise<'finished'|'queued'>}
 */
async function finishedOrQueued(inFlight, barrier, count, timeoutMs = 15000) {
  let finished = false;
  inFlight.then(
    () => {
      finished = true;
    },
    () => {
      finished = true;
    },
  );
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

/** The change a time-back recorded for one row's field, as stored. */
async function changeOf(timeBackId, tableName, rowId, field) {
  return prisma.timeBackChange.findFirst({
    where: { timeBackId, tableName, rowId: String(rowId), field },
    select: { oldValue: true, newValue: true },
  });
}

const iso = date => new Date(date).toISOString();
const asIsoInstant = value => new Date(`${String(value).replace(/Z?$/, 'Z')}`).toISOString();

describe('Owner time-back apply vs a player show entry (Equoria-puj1e.5.2)', () => {
  it('an entry for a horse the apply holds finishes at once, and both commit', async () => {
    const now = Date.now();
    const S = toMinute(now - 6 * day);
    const E = toMinute(now - 4 * day);
    const pauseMs = E.getTime() - S.getTime();
    const entrant = await makeEntrant('horse');
    // Another horse's training session inside the window: the apply moves it
    // after the horses and before the shows, so holding it holds the apply there.
    const other = await createTestHorse({ name: `${fixture}-trained-${uid()}`, userId: entrant.user.id });
    const log = await prisma.trainingLog.create({
      data: { horseId: other.id, discipline: 'Dressage', trainedAt: new Date(S.getTime() + 3_600_000) },
    });
    made.logs.push(log.id);
    const code = await freshCode(owner, device, 'timeBackApply');
    const sendApply = await preparePost(APPLY, owner, { start: easternWall(S), end: easternWall(E), code }, device);

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "training_logs" WHERE "id" = ${log.id} FOR UPDATE`,
    );
    let applying;
    let entering;
    let entryWhileHeld;
    try {
      applying = Promise.resolve(sendApply());
      // The apply waits on the training log with every young horse locked.
      await barrier.waitForQueued(1);
      entering = Promise.resolve(entrant.enter());
      entryWhileHeld = await finishedOrQueued(entering, barrier, 2);
    } finally {
      await barrier.release();
    }
    const [applied, entry] = await Promise.all([applying, entering]);

    expect(entry.status).toBe(201);
    expect(applied.status).toBe(200);
    // The apply's horse lock does not hold up an entry that only references the horse.
    expect(entryWhileHeld).toBe('finished');
    const timeBackId = applied.body.data.id;

    // The apply wrote what it read on the locked rows, and recorded it.
    const show = await prisma.show.findUnique({ where: { id: entrant.show.id } });
    expect(show.feeEscrow).toBe(entryFee);
    expect(iso(show.closeDate)).toBe(iso(entrant.show.closeDate.getTime() + pauseMs));
    const closeChange = await changeOf(timeBackId, 'shows', entrant.show.id, 'closeDate');
    expect(asIsoInstant(closeChange.oldValue)).toBe(iso(entrant.show.closeDate));
    expect(asIsoInstant(closeChange.newValue)).toBe(iso(show.closeDate));
    const horse = await prisma.horse.findUnique({ where: { id: entrant.horse.id } });
    const birthChange = await changeOf(timeBackId, 'horses', entrant.horse.id, 'dateOfBirth');
    expect(birthChange.oldValue).toBe(iso(entrant.horse.dateOfBirth).slice(0, 10));
    expect(birthChange.newValue).toBe(iso(horse.dateOfBirth).slice(0, 10));
    expect(birthChange.newValue).not.toBe(birthChange.oldValue);
    expect(await prisma.showEntry.count({ where: { showId: entrant.show.id, horseId: entrant.horse.id } })).toBe(1);

    // Undo puts back exactly what the record says.
    await undo(timeBackId);
    const restoredShow = await prisma.show.findUnique({ where: { id: entrant.show.id } });
    expect(iso(restoredShow.closeDate)).toBe(iso(entrant.show.closeDate));
    const restoredHorse = await prisma.horse.findUnique({ where: { id: entrant.horse.id } });
    expect(iso(restoredHorse.dateOfBirth)).toBe(iso(entrant.horse.dateOfBirth));
  }, 120_000);

  it('an entry by a player the apply owes a bank week waits for the apply, and both commit', async () => {
    const thisWeek = startOfGameWeek(new Date(), 0);
    // One whole bank week, three weeks back (clear of the other time-back suites' windows).
    const S = startOfGameDayIndex(gameDayIndex(thisWeek) - 21);
    const E = startOfGameDayIndex(gameDayIndex(thisWeek) - 14);
    const pauseMs = E.getTime() - S.getTime();
    // A player since before the outage, so the apply owes them the lost bank week.
    const entrant = await makeEntrant('account', { createdAt: new Date(S.getTime() - day) });
    // An open Hall of Fame round: the apply moves it after the shows, so
    // holding it holds the apply there.
    const round = await prisma.hallOfFameRound.create({
      data: { startsAt: new Date(Date.now() + day), endsAt: farEnd },
    });
    made.rounds.push(round.id);
    const code = await freshCode(owner, device, 'timeBackApply');
    const sendApply = await preparePost(APPLY, owner, { start: easternWall(S), end: easternWall(E), code }, device);

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "HallOfFameRound" WHERE "id" = ${round.id} FOR UPDATE`,
    );
    let applying;
    let entering;
    try {
      applying = Promise.resolve(sendApply());
      await barrier.waitForQueued(1);
      entering = Promise.resolve(entrant.enter());
      // The entry needs the player's account and the show; the held apply has one of them.
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [applied, entry] = await Promise.all([applying, entering]);

    expect(applied.status).toBe(200);
    expect(entry.status).toBe(201);
    const timeBackId = applied.body.data.id;
    const owed = [{ timeBackId, weekStart: S.toISOString() }];
    const player = await prisma.user.findUnique({ where: { id: entrant.user.id } });
    expect(player.settings.owedWeeklyClaims).toEqual(owed);
    expect(Number(player.money)).toBe(startingMoney - entryFee);
    const show = await prisma.show.findUnique({ where: { id: entrant.show.id } });
    expect(show.feeEscrow).toBe(entryFee);
    expect(iso(show.closeDate)).toBe(iso(entrant.show.closeDate.getTime() + pauseMs));
    const closeChange = await changeOf(timeBackId, 'shows', entrant.show.id, 'closeDate');
    expect(asIsoInstant(closeChange.oldValue)).toBe(iso(entrant.show.closeDate));
    expect(await prisma.showEntry.count({ where: { showId: entrant.show.id, horseId: entrant.horse.id } })).toBe(1);

    await undo(timeBackId);
    const restored = await prisma.user.findUnique({ where: { id: entrant.user.id } });
    expect(restored.settings.owedWeeklyClaims ?? []).toEqual([]);
    expect(iso((await prisma.show.findUnique({ where: { id: entrant.show.id } })).closeDate)).toBe(
      iso(entrant.show.closeDate),
    );
  }, 120_000);
});
