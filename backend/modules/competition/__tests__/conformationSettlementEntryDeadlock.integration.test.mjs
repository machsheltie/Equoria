/**
 * Conformation settlement against a conformation entry that shares its horse or
 * its groom (Equoria-qc7cx). Both were deadlocks: Postgres aborted one side.
 *
 * 1. A horse and groom presenting in a settling show, entered together into
 *    another conformation show. The settlement locked the horse FOR UPDATE,
 *    which blocks the key-share lock the entry's insert takes on the same horse
 *    (its foreign key), and then wanted the groom the entry already held.
 * 2. A groom presenting in a show at its close, entered with another horse into
 *    that same show. The entry took the groom, then the show; the settlement
 *    took the show (its claim), then the groom.
 *
 * Each interleaving is forced, not timed: a second client holds a row the
 * settlement needs before it reaches the groom, so the settlement is held there
 * with its earlier locks in hand; the entry is then started and either finishes
 * or is observed queued behind it (pg_blocking_pids of the holder only, on a
 * fresh statement each poll). Releasing lets both finish, or deadlock.
 *
 * Real app, real JWT, real CSRF, real entry route, real settlement, real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { executeConformationShow } from '../services/conformationShowService.mjs';
import { addHorseMonthlyTotals } from '../../../utils/monthlyTotals.mjs';
import {
  createBarrierClient,
  holdLock,
  horseRowLock,
  waitForBlockedSessions,
} from '../../../__tests__/helpers/rowLockBarrier.mjs';

const fixturePrefix = 'TestFixture-qc7cx-deadlock';
const ORIGIN = 'http://localhost:3000';
const dayMs = 24 * 60 * 60 * 1000;
const entryFee = 120;
const startingMoney = 1000;

const tag = randomBytes(4).toString('hex');
let csrf;
let barrierClient;
let seq = 0;
const groomIds = [];
const assignmentIds = [];

async function makePlayer(label) {
  seq += 1;
  return createTestUser({
    username: `${fixturePrefix}-${label}-${seq}-${tag}`,
    email: `${fixturePrefix}-${label}-${seq}-${tag}@example.com`,
    money: startingMoney,
  });
}

async function makeHorse(user, label) {
  seq += 1;
  const now = new Date();
  return createTestHorse({
    name: `${fixturePrefix}-${label}-${seq}-${tag}`,
    userId: user.id,
    healthStatus: 'Excellent',
    lastFedDate: now,
    lastVettedDate: now,
  });
}

async function makeGroom(user, label) {
  const groom = await prisma.groom.create({
    data: {
      name: `${fixturePrefix}-${label}-${tag}`,
      speciality: 'showHandling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: user.id } },
    },
  });
  groomIds.push(groom.id);
  return groom;
}

/** Assign `groom` to `horse`, five days ago (long enough to present it). */
async function assign(user, groom, horse) {
  const assignment = await prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groom.id } },
      foal: { connect: { id: horse.id } },
      user: { connect: { id: user.id } },
      isActive: true,
      createdAt: new Date(Date.now() - 5 * dayMs),
    },
  });
  assignmentIds.push(assignment.id);
}

async function makeShow(createdByUserId) {
  const openDate = new Date(Date.now() - 60 * 60 * 1000);
  const closeDate = new Date(openDate.getTime() + 7 * dayMs);
  return createTestShow({
    name: `${fixturePrefix}-show`,
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
    createdByUserId,
  });
}

function enterHttp(token, horse, groom, show) {
  return request(app)
    .post('/api/v1/competition/conformation/enter')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId: horse.id, groomId: groom.id, showId: show.id });
}

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

/** Start a settlement and capture its outcome instead of throwing. */
function settle(showId, now) {
  return executeConformationShow(showId, { now }).then(
    results => ({ results }),
    error => ({ error }),
  );
}

/**
 * Wait until `inFlight` has finished, or until `count` sessions are queued
 * behind the barrier, whichever comes first. Every poll is a fresh statement
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

beforeAll(async () => {
  barrierClient = createBarrierClient();
  csrf = await fetchCsrf(app);
}, 120000);

afterAll(async () => {
  await barrierClient.$disconnect();
  await prisma.groomAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
  await cleanupTestData();
}, 60000);

describe('conformation settlement vs entry deadlocks (Equoria-qc7cx)', () => {
  it('a horse and groom presenting in a settling show, entered into another show: both finish', async () => {
    const { user: owner, token } = await makePlayer('owner');
    const { user: host } = await makePlayer('host');
    const groom = await makeGroom(owner, 'groom');
    const horse = await makeHorse(owner, 'horse');
    await assign(owner, groom, horse);

    const settlingShow = await makeShow(host.id);
    expect((await enterHttp(token, horse, groom, settlingShow)).status).toBe(201);
    const nextShow = await makeShow(host.id);
    const settleAt = new Date(new Date(settlingShow.closeDate).getTime() + 1000);
    // The horse's monthly totals row, which the settlement writes after it
    // locks the horse and before it locks the groom.
    await addHorseMonthlyTotals(prisma, horse.id, { shows: 1 }, settleAt);

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "horseId" FROM "horse_monthly_totals" WHERE "horseId" = ${horse.id} FOR UPDATE`,
    );
    let settling;
    let entering;
    let entryWhileHeld;
    try {
      settling = settle(settlingShow.id, settleAt);
      await barrier.waitForQueued(1);
      // The settlement holds the horse. The entry takes the groom, then its
      // insert needs a key-share lock on the horse: the old FOR UPDATE queued
      // it behind the held settlement, which then wanted the groom.
      entering = Promise.resolve(enterHttp(token, horse, groom, nextShow));
      entryWhileHeld = await finishedOrQueued(entering, barrier, 2);
    } finally {
      await barrier.release();
    }
    const [settled, entry] = await Promise.all([settling, entering]);

    expect(settled.error).toBeUndefined();
    expect(settled.results.map(r => r.horseId)).toEqual([horse.id]);
    expect(entry.status).toBe(201);
    // The horse lock no longer holds up an entry that only references the horse.
    expect(entryWhileHeld).toBe('finished');
    const closed = await prisma.show.findUnique({ where: { id: settlingShow.id } });
    expect(closed.status).toBe('completed');
    expect(closed.feeEscrow).toBe(0);
    expect(await prisma.showEntry.count({ where: { showId: nextShow.id, horseId: horse.id } })).toBe(1);
    expect(await money(owner.id)).toBe(startingMoney - 2 * entryFee);
    expect(await money(host.id)).toBe(startingMoney + entryFee);
  }, 90000);

  it('a groom presenting in a show at its close, entered with another horse into it: both finish', async () => {
    const { user: owner, token } = await makePlayer('owner');
    const { user: host } = await makePlayer('host');
    const groom = await makeGroom(owner, 'groom');
    const shownHorse = await makeHorse(owner, 'shown');
    const lateHorse = await makeHorse(owner, 'late');
    await assign(owner, groom, shownHorse);
    await assign(owner, groom, lateHorse);

    const show = await makeShow(host.id);
    expect((await enterHttp(token, shownHorse, groom, show)).status).toBe(201);
    // The late entry reads its clock just before the close; the settlement
    // reads its clock just after it.
    const settleAt = new Date(new Date(show.closeDate).getTime() + 1000);

    // Hold the shown horse: the settlement has claimed the show when it
    // queues here, and locks the groom after it.
    const barrier = await holdLock(barrierClient, horseRowLock(shownHorse.id));
    let settling;
    let entering;
    try {
      settling = settle(show.id, settleAt);
      await barrier.waitForQueued(1);
      entering = Promise.resolve(enterHttp(token, lateHorse, groom, show));
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [settled, entry] = await Promise.all([settling, entering]);

    // The settlement scored the show as claimed; the late entry found it closed
    // and took nothing.
    expect(settled.error).toBeUndefined();
    expect(settled.results.map(r => r.horseId)).toEqual([shownHorse.id]);
    expect(entry.status).toBe(409);
    expect(entry.body.message).toBe('This show is no longer accepting entries');
    const closed = await prisma.show.findUnique({ where: { id: show.id } });
    expect(closed.status).toBe('completed');
    expect(closed.feeEscrow).toBe(0);
    expect(await prisma.showEntry.count({ where: { showId: show.id } })).toBe(1);
    expect(await money(owner.id)).toBe(startingMoney - entryFee);
    expect(await money(host.id)).toBe(startingMoney + entryFee);
  }, 90000);
});
