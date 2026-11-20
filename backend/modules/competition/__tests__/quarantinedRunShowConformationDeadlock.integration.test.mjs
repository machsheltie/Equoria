/**
 * The owner's Run Show against the nightly conformation settlement, over a horse
 * entered in both (Equoria-mwjst.2). It was a deadlock: Postgres aborted one side.
 *
 * Run Show claimed its quarantined ridden show, then locked the players it pays
 * FOR UPDATE, then their horses. The conformation settlement locks its horses
 * (FOR NO KEY UPDATE) and then inserts the results and Monthly totals, whose
 * foreign keys take a key-share lock on the entrant's User row. Run Show held
 * the player and wanted the horse; the settlement held the horse and wanted the
 * player.
 *
 * The interleaving is forced, not timed: a second client holds the ridden show
 * host's User row, which Run Show locks after the horse owner's (ids chosen so
 * the owner's sorts first). Run Show is held there with the owner's row in hand;
 * the settlement is then started and either finishes or is observed queued
 * behind it (pg_blocking_pids of the holder only, a fresh statement each poll).
 * Releasing lets both finish, or deadlock.
 *
 * Real controllers fund and enter the ridden show, the real conformation entry
 * route enters the horse, the real Run Show and settlement run. Real DB.
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
import { createShow, enterShow } from '../shows/showController.mjs';
import { runQuarantinedShow, testRunQuarantinedShow } from '../shows/showQuarantineResolution.mjs';
import { showFailureJobName } from '../shows/showFailureLog.mjs';
import { executeConformationShow } from '../services/conformationShowService.mjs';

const fixturePrefix = 'TestFixture-mwjst2';
const ORIGIN = 'http://localhost:3000';
const dayMs = 24 * 60 * 60 * 1000;
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

/** A player whose id starts with `first`, so the test fixes the order Run Show locks them in. */
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

async function money(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
  return Number(row.money);
}

/** A ridden Dressage show created and entered through the real controllers, then quarantined. */
async function buildQuarantinedRiddenShow(host, owner, horse) {
  const created = fakeRes();
  await createShow(
    {
      user: { id: host.id },
      body: { name: `${fixturePrefix}-ridden-${tag}`, discipline: 'Dressage', entryFee: riddenFee, level: 1 },
    },
    created,
  );
  expect(created.statusCode).toBe(201);
  const showId = created.body.data.show.id;
  showIds.push(showId);
  const entered = fakeRes();
  await enterShow({ user: { id: owner.id }, params: { id: String(showId) }, body: { horseId: horse.id } }, entered);
  expect(entered.statusCode).toBe(201);
  await prisma.show.update({
    where: { id: showId },
    data: {
      closeDate: new Date(Date.now() - dayMs),
      status: 'quarantined',
      executionAttempts: 3,
      stagedOrdering: [
        { horseId: horse.id, userId: owner.id, horseName: horse.name, score: 77, placement: 1, riderId: null },
      ],
    },
  });
  return showId;
}

/** A conformation show the horse is entered in through the real route, presented by its groom. */
async function buildConformationShow(hostId, owner, token, horse) {
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
  const openDate = new Date(Date.now() - 60 * 60 * 1000);
  const closeDate = new Date(openDate.getTime() + 7 * dayMs);
  const show = await createTestShow({
    name: `${fixturePrefix}-conformation`,
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
    createdByUserId: hostId,
  });
  conformationShowIds.push(show.id);
  const entry = await request(app)
    .post('/api/v1/competition/conformation/enter')
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId: horse.id, groomId: groom.id, showId: show.id });
  expect(entry.status).toBe(201);
  return show;
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

beforeAll(async () => {
  process.env.RAILWAY_GIT_COMMIT_SHA = 'feed5eed22222222222222222222222222222222';
  barrierClient = createBarrierClient();
  csrf = await fetchCsrf(app);
  const showScope = () => ({ in: showIds });
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
  cleanup.add(() => prisma.show.deleteMany({ where: { id: showScope() } }), 'ridden shows');
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

describe('Run Show vs conformation settlement (Equoria-mwjst.2)', () => {
  it('a horse in a quarantined ridden show and a settling conformation show: both finish', async () => {
    // The horse owner's id sorts before the ridden host's, so Run Show locks the
    // owner first and is then held on the host's row by the barrier.
    const { user: owner, token } = await makePlayer('owner', '0', riddenFee + conformationFee);
    const { user: riddenHost } = await makePlayer('riddenHost', 'f', riddenPrize);
    const { user: conformationHost } = await makePlayer('confHost', '8', startingMoney);
    const horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-horse-${tag}`,
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
    await giveEligibleRider(prisma, { horseId: horse.id, userId: owner.id }, riderIds);

    const riddenShowId = await buildQuarantinedRiddenShow(riddenHost, owner, horse);
    const conformationShow = await buildConformationShow(conformationHost.id, owner, token, horse);
    const settleAt = new Date(new Date(conformationShow.closeDate).getTime() + 1000);
    const statGainRng = () => 0.99;
    const testRun = await testRunQuarantinedShow(riddenShowId, { actor, statGainRng });
    expect(testRun.passed).toBe(true);

    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${riddenHost.id} FOR UPDATE`,
    );
    let running;
    let settling;
    let settlementWhileHeld;
    try {
      running = outcomeOf(runQuarantinedShow(riddenShowId, { actor, statGainRng }));
      await barrier.waitForQueued(1);
      // Run Show holds the horse owner's row. The settlement locks the horse,
      // then its results need a key-share lock on that owner: the old FOR UPDATE
      // queued it behind the held Run Show, which then wanted the horse.
      settling = outcomeOf(executeConformationShow(conformationShow.id, { now: settleAt }));
      settlementWhileHeld = await finishedOrQueued(settling, barrier, 2);
    } finally {
      await barrier.release();
    }
    const [ran, settled] = await Promise.all([running, settling]);

    expect(ran.error).toBeUndefined();
    expect(ran.result).toEqual({ showId: riddenShowId, status: 'completed', settled: 1 });
    expect(settled.error).toBeUndefined();
    expect(settled.result.map(r => r.horseId)).toEqual([horse.id]);
    // The owner's row held by Run Show no longer holds up a settlement that only
    // references the owner.
    expect(settlementWhileHeld).toBe('finished');

    // Each show paid as it would have alone. One entrant: the ridden winner takes
    // the first-place share, the rest of the prize and the fee go to the host.
    const riddenShow = await prisma.show.findUnique({ where: { id: riddenShowId } });
    expect(riddenShow.status).toBe('completed');
    expect(riddenShow.prizeEscrow).toBe(0);
    expect(riddenShow.feeEscrow).toBe(0);
    const riddenResult = await prisma.competitionResult.findUnique({
      where: { showIdHorseId: { showId: riddenShowId, horseId: horse.id } },
    });
    expect(riddenResult.placement).toBe(1);
    const share = Number(riddenResult.prizeWon);
    expect(share).toBe(riddenPrize / 2);
    const closed = await prisma.show.findUnique({ where: { id: conformationShow.id } });
    expect(closed.status).toBe('completed');
    expect(closed.feeEscrow).toBe(0);
    expect(await prisma.competitionResult.count({ where: { showId: conformationShow.id, horseId: horse.id } })).toBe(1);
    expect(await money(owner.id)).toBe(share);
    expect(await money(riddenHost.id)).toBe(riddenFee + (riddenPrize - share));
    expect(await money(conformationHost.id)).toBe(startingMoney + conformationFee);
  }, 120000);
});
