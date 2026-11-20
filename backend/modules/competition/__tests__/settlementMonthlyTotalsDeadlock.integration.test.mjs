/**
 * Ridden payouts against the conformation settlement over the players' Monthly
 * totals rows (Equoria-mwjst.4). Each was a deadlock: Postgres aborted one side.
 *
 * Both settlements add to the same player_monthly_totals row (month, 'shows',
 * owner). The ridden payout (nightly and Run Show) takes the show escrow account
 * (its prize debit) and writes the owner's totals after it; the conformation
 * settlement wrote its owners' totals first and took the escrow account last
 * (its fee settlement). Same owner, DIFFERENT horses (the horse lock no longer
 * keeps them apart): the payout held the escrow account and wanted the totals
 * row; the settlement held the totals row and wanted the escrow account.
 *
 * Run Show pays several placings in one transaction and wrote each owner's
 * totals as it paid them, in placing order, while the conformation settlement
 * writes its owners' totals in ascending id order: with two owners in both shows
 * and no escrow account between them (a free conformation show), each held the
 * row the other wanted next.
 *
 * The interleaving is forced, not timed: a second client holds a row the first
 * side locks part-way through (a presenting groom, or a placing's rider), the
 * second side is started and either finishes or is observed queued behind it
 * (pg_blocking_pids of the holder only, a fresh statement each poll). Releasing
 * lets both finish, or deadlock.
 *
 * Real controllers create, fund and enter the ridden shows, the real
 * conformation entry route enters the horses, the real Run Show, nightly
 * executor and settlement run. Real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes, randomUUID } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';
import { createBarrierClient, holdLock, waitForBlockedSessions } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { gameMonthKey } from '../../../utils/gameTime.mjs';
import { createShow, enterShow } from '../shows/showController.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { readShowFailures, showFailureJobName } from '../shows/showFailureLog.mjs';
import { runQuarantinedShow, testRunQuarantinedShow } from '../shows/showQuarantineResolution.mjs';
import { executeConformationShow } from '../services/conformationShowService.mjs';

const fixturePrefix = 'TestFixture-mwjst4';
const ORIGIN = 'http://localhost:3000';
const hourMs = 60 * 60 * 1000;
const dayMs = 24 * hourMs;
const riddenFee = 100;
const riddenPrize = 10 * riddenFee; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const conformationFee = 120;
const startingMoney = 1000;

const tag = randomBytes(4).toString('hex');
const actor = { id: randomUUID(), role: 'owner' };
const savedCommitSha = process.env.RAILWAY_GIT_COMMIT_SHA;
const cleanup = createCleanupTracker();
const horseIds = [];
const riderIds = [];
const showIds = [];
const conformationShowIds = [];
const userIds = [];
const groomIds = [];
const assignmentIds = [];
let csrf;
let barrierClient;
let seq = 0;

function fakeRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

/** A player whose id starts with `first`, so the test fixes the order players are locked in. */
async function makePlayer(label, first, money) {
  seq += 1;
  const made = await createTestUser({
    id: `${first}${randomUUID().slice(1)}`,
    username: `${fixturePrefix}-${label}-${seq}-${tag}`,
    email: `${fixturePrefix}-${label}-${seq}-${tag}@example.com`,
    money,
  });
  userIds.push(made.user.id);
  return made;
}

async function makeHorse(owner, label) {
  seq += 1;
  return createTestHorse(
    prisma,
    {
      name: `${fixturePrefix}-${label}-${seq}-${tag}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(),
      age: 7,
      userId: owner.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      lastVettedDate: new Date(),
    },
    horseIds,
  );
}

/** A horse ready to ride: its rider, for the staged placing. */
async function makeRiddenHorse(owner, label) {
  const horse = await makeHorse(owner, label);
  const { rider } = await giveEligibleRider(prisma, { horseId: horse.id, userId: owner.id }, riderIds);
  return { horse, rider };
}

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

/** The owner's Monthly totals of `month`, by category. */
async function playerTotals(playerId, month) {
  const rows = await prisma.playerMonthlyTotal.findMany({ where: { playerId, month } });
  return Object.fromEntries(rows.map(r => [r.category, r.value]));
}

async function horseTotals(horseId, month) {
  const rows = await prisma.horseMonthlyTotal.findMany({ where: { horseId, month } });
  return Object.fromEntries(rows.filter(r => r.category !== 'points').map(r => [r.category, r.value]));
}

/** A ridden Dressage show created and entered through the real controllers, closed an hour ago. */
async function buildRiddenShow(host, entrants) {
  seq += 1;
  const created = fakeRes();
  await createShow(
    {
      user: { id: host.id },
      body: { name: `${fixturePrefix}-ridden-${seq}-${tag}`, discipline: 'Dressage', entryFee: riddenFee, level: 1 },
    },
    created,
  );
  expect(created.statusCode).toBe(201);
  const showId = created.body.data.show.id;
  showIds.push(showId);
  for (const { owner, horse } of entrants) {
    const entered = fakeRes();
    await enterShow({ user: { id: owner.id }, params: { id: String(showId) }, body: { horseId: horse.id } }, entered);
    expect(entered.statusCode).toBe(201);
  }
  await prisma.show.update({ where: { id: showId }, data: { closeDate: new Date(Date.now() - hourMs) } });
  return showId;
}

/** Quarantine a ridden show with the given placings staged, as the reaper leaves it. */
async function quarantine(showId, placings) {
  await prisma.show.update({
    where: { id: showId },
    data: {
      status: 'quarantined',
      executionAttempts: 3,
      stagedOrdering: placings.map(({ owner, horse, rider }, i) => ({
        horseId: horse.id,
        userId: owner.id,
        horseName: horse.name,
        score: 90 - i,
        placement: i + 1,
        riderId: rider.id,
      })),
    },
  });
}

/**
 * A conformation show the horses are entered in through the real route, each
 * presented by its owner's groom, then closed an hour ago. Returns the show and
 * the grooms in entrant order.
 */
async function buildConformationShow(hostId, entrants, entryFee) {
  const openDate = new Date(Date.now() - hourMs);
  const show = await createTestShow({
    name: `${fixturePrefix}-conformation`,
    discipline: 'Conformation',
    showType: 'conformation',
    status: 'open',
    entryFee,
    prize: 0,
    levelMin: 1,
    levelMax: 10,
    openDate,
    closeDate: new Date(openDate.getTime() + 7 * dayMs),
    runDate: new Date(openDate.getTime() + 7 * dayMs),
    createdByUserId: hostId,
  });
  conformationShowIds.push(show.id);
  const grooms = [];
  for (const { owner, token, horse } of entrants) {
    const groom = await prisma.groom.create({
      data: {
        name: `${fixturePrefix}-groom-${tag}`,
        speciality: 'showHandling',
        personality: 'gentle',
        skillLevel: 'expert',
        user: { connect: { id: owner.id } },
      },
    });
    groomIds.push(groom.id);
    grooms.push(groom);
    const assignment = await prisma.groomAssignment.create({
      data: {
        groom: { connect: { id: groom.id } },
        foal: { connect: { id: horse.id } },
        user: { connect: { id: owner.id } },
        isActive: true,
        createdAt: new Date(Date.now() - 5 * dayMs),
      },
    });
    assignmentIds.push(assignment.id);
    const entry = await request(app)
      .post('/api/v1/competition/conformation/enter')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id, groomId: groom.id, showId: show.id });
    expect(entry.status).toBe(201);
  }
  await prisma.show.update({ where: { id: show.id }, data: { closeDate: new Date(Date.now() - hourMs) } });
  return { show, grooms };
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
 * behind the barrier, whichever comes first. Every poll is a fresh statement
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

/** Hold `lock`, start `first`, wait for it to queue, start `second`, see whether it finished while held. */
async function raceAroundBarrier(lock, first, second) {
  const barrier = await holdLock(barrierClient, lock);
  let firstRun;
  let secondRun;
  let secondWhileHeld;
  try {
    firstRun = outcomeOf(first());
    await barrier.waitForQueued(1);
    secondRun = outcomeOf(second());
    secondWhileHeld = await finishedOrQueued(secondRun, barrier, 2);
  } finally {
    await barrier.release();
  }
  const [firstDone, secondDone] = await Promise.all([firstRun, secondRun]);
  return { firstDone, secondDone, secondWhileHeld };
}

/** One owner, one horse in a ridden show and another in a paid conformation show. */
async function sameOwnerTwoHorses() {
  const { user: owner, token } = await makePlayer('owner', '0', riddenFee + conformationFee);
  const { user: riddenHost } = await makePlayer('riddenHost', 'f', riddenPrize);
  const { user: conformationHost } = await makePlayer('confHost', '8', startingMoney);
  const ridden = await makeRiddenHorse(owner, 'riddenHorse');
  const shown = await makeHorse(owner, 'shownHorse');
  const riddenShowId = await buildRiddenShow(riddenHost, [{ owner, horse: ridden.horse }]);
  const { show: conformationShow, grooms } = await buildConformationShow(
    conformationHost.id,
    [{ owner, token, horse: shown }],
    conformationFee,
  );
  return { owner, riddenHost, conformationHost, ridden, shown, riddenShowId, conformationShow, groom: grooms[0] };
}

/** Each show paid and recorded as it would have alone: one entrant each, both first. */
async function expectBothSettledAlone(fixture, month) {
  const { owner, riddenHost, conformationHost, ridden, shown, riddenShowId, conformationShow } = fixture;
  const riddenShow = await prisma.show.findUnique({ where: { id: riddenShowId } });
  expect(riddenShow.status).toBe('completed');
  expect(riddenShow.prizeEscrow).toBe(0);
  expect(riddenShow.feeEscrow).toBe(0);
  const riddenResult = await prisma.competitionResult.findUnique({
    where: { showIdHorseId: { showId: riddenShowId, horseId: ridden.horse.id } },
  });
  expect(riddenResult.placement).toBe(1);
  const share = Number(riddenResult.prizeWon);
  expect(share).toBe(riddenPrize / 2);
  const closed = await prisma.show.findUnique({ where: { id: conformationShow.id } });
  expect(closed.status).toBe('completed');
  expect(closed.feeEscrow).toBe(0);
  expect(await prisma.competitionResult.count({ where: { showId: conformationShow.id } })).toBe(1);
  expect(await money(owner.id)).toBe(share);
  expect(await money(riddenHost.id)).toBe(riddenFee + (riddenPrize - share));
  expect(await money(conformationHost.id)).toBe(startingMoney + conformationFee);

  // Both shows counted once on the owner's Monthly row, each horse on its own.
  expect(await playerTotals(owner.id, month)).toEqual(expect.objectContaining({ shows: 2, wins: 2, earnings: share }));
  expect(await horseTotals(ridden.horse.id, month)).toEqual({
    shows: 1,
    wins: 1,
    earnings: share,
    'disciplineWins:Dressage': 1,
  });
  expect(await horseTotals(shown.id, month)).toEqual({ shows: 1, wins: 1, 'disciplineWins:conformation': 1 });
}

beforeAll(async () => {
  process.env.RAILWAY_GIT_COMMIT_SHA = 'feed5eed44444444444444444444444444444444';
  barrierClient = createBarrierClient();
  csrf = await fetchCsrf(app);
  const everyShowScope = () => ({ in: [...showIds, ...conformationShowIds] });
  cleanup.add(
    () =>
      prisma.cronRunLog.deleteMany({
        where: { jobName: showFailureJobName, OR: showIds.map(id => ({ summary: { path: ['showId'], equals: id } })) },
      }),
    'show failure rows',
  );
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: actor.id } }), 'action log');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: everyShowScope() } }), 'results');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: everyShowScope() } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'ridden shows');
  cleanup.add(() => prisma.groomAssignment.deleteMany({ where: { id: { in: assignmentIds } } }), 'assignments');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: groomIds } } }), 'grooms');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'transactions');
}, 120000);

afterAll(async () => {
  if (savedCommitSha === undefined) {
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
  } else {
    process.env.RAILWAY_GIT_COMMIT_SHA = savedCommitSha;
  }
  await barrierClient.$disconnect();
  await cleanup.run();
  await cleanupTestData();
}, 60000);

describe('ridden payouts vs conformation settlement over Monthly totals (Equoria-mwjst.4)', () => {
  it("Run Show and a paid conformation show, the same owner's different horses: both finish", async () => {
    const fixture = await sameOwnerTwoHorses();
    const now = new Date();
    const statGainRng = () => 0.99;
    await quarantine(fixture.riddenShowId, [{ owner: fixture.owner, ...fixture.ridden }]);
    const testRun = await testRunQuarantinedShow(fixture.riddenShowId, { actor, now, statGainRng });
    expect(testRun.passed).toBe(true);

    // Hold the presenting groom: the settlement claims its show, locks its horse,
    // writes its results and queues here. Run Show then pays the owner; the old
    // settlement already held the owner's totals row and, released, wanted the
    // escrow account Run Show locked first.
    const {
      firstDone: settled,
      secondDone: ran,
      secondWhileHeld,
    } = await raceAroundBarrier(
      tx => tx.$queryRaw`SELECT "id" FROM "grooms" WHERE "id" = ${fixture.groom.id} FOR UPDATE`,
      () => executeConformationShow(fixture.conformationShow.id, { now }),
      () => runQuarantinedShow(fixture.riddenShowId, { actor, now, statGainRng }),
    );

    expect(settled.error).toBeUndefined();
    expect(settled.result.map(r => r.horseId)).toEqual([fixture.shown.id]);
    expect(ran.error).toBeUndefined();
    expect(ran.result).toEqual({ showId: fixture.riddenShowId, status: 'completed', settled: 1 });
    // A settlement held before any coin moves holds nothing Run Show writes.
    expect(secondWhileHeld).toBe('finished');
    await expectBothSettledAlone(fixture, gameMonthKey(now));
  }, 120000);

  it("the nightly payout and a paid conformation show, the same owner's different horses: both finish", async () => {
    const fixture = await sameOwnerTwoHorses();
    const now = new Date();
    const payoutRes = fakeRes();

    const {
      firstDone: settled,
      secondDone: paid,
      secondWhileHeld,
    } = await raceAroundBarrier(
      tx => tx.$queryRaw`SELECT "id" FROM "grooms" WHERE "id" = ${fixture.groom.id} FOR UPDATE`,
      () => executeConformationShow(fixture.conformationShow.id, { now }),
      () => executeClosedShows({ body: { showIds: [fixture.riddenShowId] } }, payoutRes, { statGainRng: () => 0.99 }),
    );

    expect(settled.error).toBeUndefined();
    expect(settled.result.map(r => r.horseId)).toEqual([fixture.shown.id]);
    expect(paid.error).toBeUndefined();
    expect((await readShowFailures(fixture.riddenShowId)).map(f => f.message)).toEqual([]);
    expect(payoutRes.statusCode).toBe(200);
    expect(secondWhileHeld).toBe('finished');
    await expectBothSettledAlone(fixture, gameMonthKey(now));
  }, 120000);

  it('Run Show paying two owners and a free conformation show of the same two: both finish', async () => {
    // Owner a's id sorts first; the conformation settlement writes a's totals, then b's.
    const { user: ownerA, token: tokenA } = await makePlayer('ownerA', '0', riddenFee);
    const { user: ownerB, token: tokenB } = await makePlayer('ownerB', '1', riddenFee);
    const { user: riddenHost } = await makePlayer('riddenHost', 'f', riddenPrize);
    const { user: conformationHost } = await makePlayer('confHost', '8', startingMoney);
    const riddenA = await makeRiddenHorse(ownerA, 'riddenA');
    const riddenB = await makeRiddenHorse(ownerB, 'riddenB');
    const shownA = await makeHorse(ownerA, 'shownA');
    const shownB = await makeHorse(ownerB, 'shownB');
    const riddenShowId = await buildRiddenShow(riddenHost, [
      { owner: ownerA, horse: riddenA.horse },
      { owner: ownerB, horse: riddenB.horse },
    ]);
    // Owner b places first, so Run Show pays b before a.
    await quarantine(riddenShowId, [
      { owner: ownerB, ...riddenB },
      { owner: ownerA, ...riddenA },
    ]);
    const { show: conformationShow } = await buildConformationShow(
      conformationHost.id,
      [
        { owner: ownerA, token: tokenA, horse: shownA },
        { owner: ownerB, token: tokenB, horse: shownB },
      ],
      0,
    );
    const now = new Date();
    const statGainRng = () => 0.99;
    const testRun = await testRunQuarantinedShow(riddenShowId, { actor, now, statGainRng });
    expect(testRun.passed).toBe(true);

    // Hold owner a's rider: Run Show pays b (the old code wrote b's totals then),
    // and queues paying a. The settlement then writes a's totals and wants b's.
    const {
      firstDone: ran,
      secondDone: settled,
      secondWhileHeld,
    } = await raceAroundBarrier(
      tx => tx.$queryRaw`SELECT "id" FROM "riders" WHERE "id" = ${riddenA.rider.id} FOR UPDATE`,
      () => runQuarantinedShow(riddenShowId, { actor, now, statGainRng }),
      () => executeConformationShow(conformationShow.id, { now }),
    );

    expect(ran.error).toBeUndefined();
    expect(ran.result).toEqual({ showId: riddenShowId, status: 'completed', settled: 2 });
    expect(settled.error).toBeUndefined();
    expect(settled.result.map(r => r.horseId).sort((x, y) => x - y)).toEqual(
      [shownA.id, shownB.id].sort((x, y) => x - y),
    );
    expect(secondWhileHeld).toBe('finished');

    // Paid as alone: 50% to b, 30% to a, the unpaid 20% and both fees to the host.
    const placed = await prisma.competitionResult.findMany({
      where: { showId: riddenShowId },
      select: { horseId: true, placement: true, prizeWon: true },
    });
    const byHorse = new Map(placed.map(r => [r.horseId, [r.placement, Number(r.prizeWon)]]));
    expect(byHorse.get(riddenB.horse.id)).toEqual([1, 500]);
    expect(byHorse.get(riddenA.horse.id)).toEqual([2, 300]);
    expect(await money(ownerB.id)).toBe(500);
    expect(await money(ownerA.id)).toBe(300);
    expect(await money(riddenHost.id)).toBe(2 * riddenFee + 200);
    expect(await money(conformationHost.id)).toBe(startingMoney);
    expect((await prisma.show.findUnique({ where: { id: conformationShow.id } })).status).toBe('completed');

    // Each owner counted once per show; the earnings are the ridden prize only.
    const month = gameMonthKey(now);
    const a = await playerTotals(ownerA.id, month);
    const b = await playerTotals(ownerB.id, month);
    expect(a.shows).toBe(2);
    expect(b.shows).toBe(2);
    expect(a.earnings).toBe(300);
    expect(b.earnings).toBe(500);
    expect((a.wins ?? 0) + (b.wins ?? 0)).toBe(2); // b won the ridden show; one of them the conformation show
    expect(b.wins).toBeGreaterThanOrEqual(1);
  }, 120000);
});
