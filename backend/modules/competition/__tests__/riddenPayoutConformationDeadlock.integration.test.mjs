/**
 * The nightly ridden placement payout against the conformation settlement, over
 * a horse entered in both (Equoria-mwjst.3). It was a deadlock: Postgres
 * aborted one side.
 *
 * The payout took the show escrow account (the prize debit) and only then the
 * horse (its lifetime winnings). The conformation settlement locks its horses
 * (FOR NO KEY UPDATE), then its grooms, and takes the escrow account last (the
 * fee settlement). The payout held the escrow account and wanted the horse; the
 * settlement held the horse and wanted the escrow account.
 *
 * The interleaving is forced, not timed: a second client holds the presenting
 * groom's row, which the settlement locks after its horses. The settlement is
 * held there with the horse in hand; the payout is then started and observed
 * queued behind it (pg_blocking_pids of the holder only, a fresh statement each
 * poll). Releasing lets both finish, or deadlock.
 *
 * Real controllers create, fund and enter the ridden show, the real
 * conformation entry route enters the horse, the real nightly executor and
 * settlement run. Real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';
import { createBarrierClient, holdLock } from '../../../__tests__/helpers/rowLockBarrier.mjs';
import { createShow, enterShow } from '../shows/showController.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { readShowFailures, showFailureJobName } from '../shows/showFailureLog.mjs';
import { executeConformationShow } from '../services/conformationShowService.mjs';

const fixturePrefix = 'TestFixture-mwjst3';
const ORIGIN = 'http://localhost:3000';
const dayMs = 24 * 60 * 60 * 1000;
const riddenFee = 100;
const riddenPrize = 10 * riddenFee; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const conformationFee = 120;
const startingMoney = 1000;

const tag = randomBytes(4).toString('hex');
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

async function makePlayer(label, money) {
  seq += 1;
  const made = await createTestUser({
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

/** A ridden Dressage show created and entered through the real controllers. */
async function buildRiddenShow(host, owner, horse) {
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
  return { show, groom };
}

/** Start a promise and capture its outcome instead of throwing. */
function outcomeOf(promise) {
  return promise.then(
    result => ({ result }),
    error => ({ error }),
  );
}

beforeAll(async () => {
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
  await barrierClient.$disconnect();
  await cleanup.run();
  await cleanupTestData();
}, 60000);

describe('ridden placement payout vs conformation settlement (Equoria-mwjst.3)', () => {
  it('a horse placing in a paying ridden show and in a settling conformation show: both finish', async () => {
    const { user: owner, token } = await makePlayer('owner', riddenFee + conformationFee);
    const { user: riddenHost } = await makePlayer('riddenHost', riddenPrize);
    const { user: conformationHost } = await makePlayer('confHost', startingMoney);
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

    const riddenShowId = await buildRiddenShow(riddenHost, owner, horse);
    const { show: conformationShow, groom } = await buildConformationShow(conformationHost.id, owner, token, horse);
    await prisma.show.update({
      where: { id: riddenShowId },
      data: { closeDate: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const settleAt = new Date(new Date(conformationShow.closeDate).getTime() + 1000);

    // Hold the presenting groom: the settlement claims its show, locks the
    // horse, writes its results and queues here, the horse in hand. The payout
    // then queues on that horse. Released, the settlement wants the escrow
    // account for its fees: the old payout already held it, waiting for the horse.
    const barrier = await holdLock(
      barrierClient,
      tx => tx.$queryRaw`SELECT "id" FROM "grooms" WHERE "id" = ${groom.id} FOR UPDATE`,
    );
    let settling;
    let paying;
    const payoutRes = fakeRes();
    try {
      settling = outcomeOf(executeConformationShow(conformationShow.id, { now: settleAt }));
      await barrier.waitForQueued(1);
      paying = outcomeOf(
        executeClosedShows({ body: { showIds: [riddenShowId] } }, payoutRes, { statGainRng: () => 0.99 }),
      );
      await barrier.waitForQueued(2);
    } finally {
      await barrier.release();
    }
    const [settled, paid] = await Promise.all([settling, paying]);

    // Neither side was a deadlock victim.
    expect(settled.error).toBeUndefined();
    expect(settled.result.map(r => r.horseId)).toEqual([horse.id]);
    expect(paid.error).toBeUndefined();
    expect((await readShowFailures(riddenShowId)).map(f => f.message)).toEqual([]);
    expect(payoutRes.statusCode).toBe(200);

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
    const paidHorse = await prisma.horse.findUnique({ where: { id: horse.id }, select: { totalEarnings: true } });
    expect(paidHorse.totalEarnings).toBe(share);
    const closed = await prisma.show.findUnique({ where: { id: conformationShow.id } });
    expect(closed.status).toBe('completed');
    expect(closed.feeEscrow).toBe(0);
    expect(await prisma.competitionResult.count({ where: { showId: conformationShow.id, horseId: horse.id } })).toBe(1);
    expect(await money(owner.id)).toBe(share);
    expect(await money(riddenHost.id)).toBe(riddenFee + (riddenPrize - share));
    expect(await money(conformationHost.id)).toBe(startingMoney + conformationFee);
  }, 120000);
});
