/**
 * The owner's tools for a quarantined show (Equoria-ehlbj, Equoria-yqi49).
 *
 * Owner rulings 2026-10-23 (q29, q30, q41): quarantined shows are visible only to
 * the Owner. Diagnose gives her something to hand to Claude Code or Codex; Run
 * Show settles once, in one transaction, can never run twice, and writes an audit
 * record. Players see "Results delayed".
 *
 * OLD contract (Equoria-ehlbj): Diagnose downloaded a JSON export; Run Show was
 * a preview (computed, moved nothing) then a confirm carrying the preview digest.
 * NEW ruling (q29 safeguards, Equoria-yqi49): Diagnose is a copyable text report
 * with every failed try's error and stack and the deployed commit, and never a
 * secret; the preview became a Test run that executes the real settlement in a
 * transaction that is always rolled back; Run Show is refused until a test run
 * has passed on the commit the server runs now, and aborts on a coin-count
 * mismatch. The preview/confirm tests changed with that ruling.
 *
 * Real controllers fund the show (createShow / enterShow), the real staff routes
 * run behind a real email-code check-in, the real settlement code pays. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { competitionDateOfBirth, giveEligibleRider } from './helpers/eligibleCompetitor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { createShow, enterShow } from '../modules/competition/shows/showController.mjs';
import {
  executeClosedShows,
  recordShowFailure,
  runQuarantinedShow,
  testRunQuarantinedShow,
} from '../modules/competition/index.mjs';
import { hasCapability } from '../modules/staff/capabilities.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  preparePost,
  startEmailCapture,
  stopEmailCapture,
} from '../modules/staff/__tests__/helpers/staffFixtures.mjs';

const prefix = 'TestFixture-yqi49-owner';
const api = '/api/v1/staff/shows/quarantined';
const prize = 1000;
const entryFee = prize / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const riderIds = [];
const showIds = [];
const staff = createUserFactory('yqi49staff');
const savedCommitSha = process.env.RAILWAY_GIT_COMMIT_SHA;
let creator;
let entrant;
let entrantHorse;
let owner;
let ownerDevice;

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

async function makeUser(money, suffix) {
  const tag = randomBytes(4).toString('hex');
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${suffix}-${tag}`,
      email: `${prefix}-${suffix}-${tag}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Quarantine',
      lastName: suffix,
      money,
    },
  });
  userIds.push(user.id);
  return user;
}

/** A show funded through the real controllers, then quarantined with a staged ordering. */
async function buildQuarantinedShow({ stagedUserId } = {}) {
  // A fresh host per show: one host may only create so many shows a week.
  creator = await makeUser(100000, 'creator');
  const createRes = fakeRes();
  await createShow(
    {
      user: { id: creator.id },
      body: { name: `${prefix}-show-${randomBytes(4).toString('hex')}`, discipline: 'Dressage', entryFee, level: 1 },
    },
    createRes,
  );
  expect(createRes.statusCode).toBe(201);
  const showId = createRes.body.data.show.id;
  showIds.push(showId);
  const enterRes = fakeRes();
  await enterShow(
    { user: { id: entrant.id }, params: { id: String(showId) }, body: { horseId: entrantHorse.id } },
    enterRes,
  );
  expect(enterRes.statusCode).toBe(201);
  await prisma.show.update({
    where: { id: showId },
    data: {
      closeDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'quarantined',
      executionAttempts: 3,
      stagedOrdering: [
        {
          horseId: entrantHorse.id,
          userId: stagedUserId ?? entrant.id,
          horseName: entrantHorse.name,
          score: 77,
          placement: 1,
          riderId: null,
        },
      ],
    },
  });
  return showId;
}

const money = id => prisma.user.findUnique({ where: { id }, select: { money: true } }).then(u => u.money);
const showState = showId =>
  prisma.show.findUnique({
    where: { id: showId },
    select: {
      status: true,
      prizeEscrow: true,
      feeEscrow: true,
      stagedOrdering: true,
      executedAt: true,
      _count: { select: { competitionResults: true } },
    },
  });
const toolRows = showId =>
  prisma.staffActionLog.findMany({
    where: { targetType: 'show', targetId: String(showId), capability: 'shows.quarantine.resolve' },
    orderBy: { id: 'asc' },
  });
const failureRows = showId =>
  prisma.cronRunLog.findMany({
    where: { jobName: 'showFailure', summary: { path: ['showId'], equals: showId } },
    orderBy: { id: 'asc' },
  });

/** Everything a settlement could write, for the rows and balances this suite owns. */
async function gameSnapshot(showId) {
  const [show, users, horse, results, ledger, xpEvents, notifications, escrow] = await Promise.all([
    showState(showId),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      orderBy: { id: 'asc' },
      select: { id: true, money: true, xp: true, settings: true },
    }),
    prisma.horse.findUnique({
      where: { id: entrantHorse.id },
      select: { horseXp: true, totalEarnings: true, availableStatPoints: true },
    }),
    prisma.competitionResult.count({ where: { showId } }),
    prisma.userTransaction.count({ where: { userId: { in: userIds } } }),
    prisma.horseXpEvent.count({ where: { horseId: entrantHorse.id } }),
    prisma.notification.count({ where: { userId: { in: userIds } } }),
    prisma.systemAccount.findUnique({ where: { name: 'showEscrow' }, select: { balance: true } }),
  ]);
  return { show, users, horse, results, ledger, xpEvents, notifications, escrow };
}

beforeAll(async () => {
  const staffScope = () => ({ in: staff.createdUserIds });
  cleanup.add(
    () =>
      prisma.cronRunLog.deleteMany({
        where: { jobName: 'showFailure', OR: showIds.map(id => ({ summary: { path: ['showId'], equals: id } })) },
      }),
    'show failure rows',
  );
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
  cleanup.add(() => prisma.competitionResult.deleteMany({ where: { showId: { in: showIds } } }), 'results');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'transactions');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: staffScope() } }), 'action log');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: staffScope() } }), 'staff notifications');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: staffScope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: staffScope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: staffScope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: staffScope() } }), 'staff users');

  entrant = await makeUser(12 * entryFee, 'entrant'); // enough for every show this suite enters
  entrantHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${prefix}-horse-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: competitionDateOfBirth(),
      age: 7,
      userId: entrant.id,
      healthStatus: 'Excellent',
      lastFedDate: new Date(),
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
  });
  horseIds.push(entrantHorse.id);
  await giveEligibleRider(prisma, { horseId: entrantHorse.id, userId: entrant.id }, riderIds);
}, 60_000);

/**
 * Hand every show this suite left unsettled to the real executor, so the shared
 * escrow account stays balanced once the suite deletes its rows.
 */
async function drainUnsettledShows() {
  const unsettled = await prisma.show.findMany({
    where: { id: { in: showIds }, status: { not: 'completed' } },
    select: { id: true },
  });
  const ids = unsettled.map(s => s.id);
  if (ids.length === 0) {
    return;
  }
  await prisma.show.updateMany({ where: { id: { in: ids } }, data: { status: 'open' } });
  await prisma.$executeRaw`UPDATE "shows" SET "stagedOrdering" = NULL WHERE "id" = ANY(${ids})`;
  await executeClosedShows({ body: { showIds: ids } }, undefined);
}

afterAll(async () => {
  if (savedCommitSha === undefined) {
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
  } else {
    process.env.RAILWAY_GIT_COMMIT_SHA = savedCommitSha;
  }
  await drainUnsettledShows();
  await cleanup.run();
}, 120_000);

beforeEach(async () => {
  process.env.RAILWAY_GIT_COMMIT_SHA = 'c0ffee1111111111111111111111111111111111';
  startEmailCapture();
  if (!owner) {
    owner = await staff.makeUser('owner');
    ownerDevice = await checkIn(owner);
  }
});
afterEach(() => stopEmailCapture());

describe('who may use the quarantine tools', () => {
  it('only the owner holds the capability; admins and moderators do not', () => {
    expect(hasCapability('owner', 'shows.quarantine.resolve')).toBe(true);
    expect(hasCapability('admin', 'shows.quarantine.resolve')).toBe(false);
    expect(hasCapability('moderator', 'shows.quarantine.resolve')).toBe(false);
    expect(hasCapability('owner', 'shows.quarantine.view')).toBe(true);
    expect(hasCapability('admin', 'shows.quarantine.view')).toBe(false);
  });

  it('every tool is refused to an admin and a moderator and hidden from a player', async () => {
    const showId = await buildQuarantinedShow();
    const before = await gameSnapshot(showId);
    const player = await staff.makeUser('user');
    for (const role of ['admin', 'moderator']) {
      const steward = await staff.makeUser(role);
      const device = await checkIn(steward);
      expect((await get(api, steward, device)).status).toBe(403);
      expect((await get(`${api}/${showId}/diagnose`, steward, device)).status).toBe(403);
      expect((await post(`${api}/${showId}/test-run`, steward, {}, device)).status).toBe(403);
      expect((await post(`${api}/${showId}/run`, steward, {}, device)).status).toBe(403);
    }
    expect((await get(`${api}/${showId}/diagnose`, player)).status).toBe(404);
    expect((await post(`${api}/${showId}/test-run`, player, {})).status).toBe(404);
    expect((await post(`${api}/${showId}/run`, player, {})).status).toBe(404);
    expect(await gameSnapshot(showId)).toEqual(before);
    expect(await toolRows(showId)).toHaveLength(0);
  }, 90_000);

  it('the owner sees the quarantined show in the list, with Run Show locked', async () => {
    const showId = await buildQuarantinedShow();
    const res = await get(api, owner, ownerDevice);
    expect(res.status).toBe(200);
    expect(res.body.shows.find(s => s.id === showId)).toMatchObject({
      id: showId,
      executionAttempts: 3,
      lastTestRun: null,
      runShowReady: false,
    });
  }, 60_000);
});

describe('Diagnose', () => {
  it('a copyable report: show, entry ids, every failed try with message and stack, files, commit; no secrets', async () => {
    const showId = await buildQuarantinedShow();
    const secretSetting = `zz-${randomBytes(12).toString('hex')}`;
    process.env.YQI49_FIXTURE_API_TOKEN = secretSetting;
    try {
      const leaky = new Error(
        `Cannot pay ${entrant.email} from 203.0.113.77 via postgresql://equoria:hunter2@db.internal:5432/equoria with Bearer abc.def.ghi password=hunter2 key ${secretSetting} at fe80::1ff:fe23:4567:890a`,
      );
      await recordShowFailure(showId, { source: 'nightlyRun', error: leaky });
      await recordShowFailure(showId, {
        source: 'reaperStranded',
        message: 'The run stopped part-way through this show',
      });

      const res = await get(`${api}/${showId}/diagnose`, owner, ownerDevice);

      expect(res.status).toBe(200);
      const { report, commitSha } = res.body.diagnosis;
      expect(commitSha).toBe(process.env.RAILWAY_GIT_COMMIT_SHA);
      expect(report).toContain(`quarantined show ${showId}`);
      expect(report).toContain(`Commit: ${process.env.RAILWAY_GIT_COMMIT_SHA}`);
      const entry = await prisma.showEntry.findFirst({ where: { showId } });
      expect(report).toContain(`Entry ids: ${entry.id}`);
      expect(report).toContain('Failed tries counted: 3');
      expect(report).toContain('Failed tries (2, newest first)');
      expect(report).toContain('Show reaper (the run stopped mid-show)');
      expect(report).toContain('Nightly show run');
      // The stack of the recorded error, with repository-relative paths.
      expect(report).toContain('backend/__tests__/quarantinedShowOwnerTools.integration.test.mjs');
      expect(report).toMatch(
        /## Source files named in the stacks\n- backend\/__tests__\/quarantinedShowOwnerTools\.integration\.test\.mjs:\d+/,
      );
      expect(report).toContain('[email removed]');
      for (const secret of [
        entrant.email,
        creator.email,
        '203.0.113.77',
        'hunter2',
        'postgresql://',
        'abc.def.ghi',
        secretSetting,
        'fe80::1ff',
        entrant.username,
      ]) {
        expect(report).not.toContain(secret);
      }
      expect(report.toLowerCase()).not.toMatch(/passwordhash|refreshtoken/);
    } finally {
      delete process.env.YQI49_FIXTURE_API_TOKEN;
    }
  }, 60_000);

  it('refuses a show that is not quarantined', async () => {
    const showId = await buildQuarantinedShow();
    await prisma.show.update({ where: { id: showId }, data: { status: 'open' } });
    const res = await get(`${api}/${showId}/diagnose`, owner, ownerDevice);
    expect(res.status).toBe(409);
  }, 60_000);
});

describe('Test run', () => {
  it('runs the real settlement and keeps nothing: rows and balances identical, the result reported', async () => {
    const showId = await buildQuarantinedShow();
    const before = await gameSnapshot(showId);

    const res = await post(`${api}/${showId}/test-run`, owner, {}, ownerDevice);

    expect(res.status).toBe(200);
    const { testRun } = res.body;
    expect(testRun).toMatchObject({
      showId,
      passed: true,
      commitSha: process.env.RAILWAY_GIT_COMMIT_SHA,
      entryFeesToHost: entryFee,
      unpaidPrizeShareToHost: 500,
      prizeToPlacings: 500,
      coinsIn: prize + entryFee,
      coinsOut: prize + entryFee,
    });
    expect(testRun.placements).toEqual([
      expect.objectContaining({ placement: 1, horseId: entrantHorse.id, prize: 500 }),
    ]);
    expect(await gameSnapshot(showId)).toEqual(before);
    // Only the record of the test run itself is kept.
    const rows = await toolRows(showId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorId: owner.id, outcome: 'succeeded' });
    expect(rows[0].after).toMatchObject({ action: 'testRun', commitSha: process.env.RAILWAY_GIT_COMMIT_SHA });
    const list = await get(api, owner, ownerDevice);
    expect(list.body.shows.find(s => s.id === showId)).toMatchObject({ runShowReady: true });
  }, 90_000);

  it('a test run that fails reports it, keeps nothing, and the failure joins the diagnosis', async () => {
    // The staged placing names an account that does not exist: the payout fails.
    const showId = await buildQuarantinedShow({ stagedUserId: `${prefix}-no-such-user` });
    const before = await gameSnapshot(showId);

    const res = await post(`${api}/${showId}/test-run`, owner, {}, ownerDevice);

    expect(res.status).toBe(200);
    expect(res.body.testRun).toMatchObject({ showId, passed: false });
    expect(await gameSnapshot(showId)).toEqual(before);
    const failures = await failureRows(showId);
    expect(failures).toHaveLength(1);
    expect(failures[0].summary).toMatchObject({ source: 'testRun' });
    expect(typeof failures[0].summary.stack).toBe('string');
    const report = (await get(`${api}/${showId}/diagnose`, owner, ownerDevice)).body.diagnosis.report;
    expect(report).toContain("Owner's Test run");
    expect(report).toMatch(/Test run: failed on commit c0ffee/);
    expect((await post(`${api}/${showId}/run`, owner, {}, ownerDevice)).status).toBe(409);
  }, 90_000);
});

describe('Run Show', () => {
  it('is refused without a test run, and after the deployed commit changed, and settles nothing', async () => {
    const showId = await buildQuarantinedShow();
    const before = await gameSnapshot(showId);

    const none = await post(`${api}/${showId}/run`, owner, {}, ownerDevice);
    expect(none.status).toBe(409);
    expect(none.body.code).toBe('testRunRequired');

    expect((await post(`${api}/${showId}/test-run`, owner, {}, ownerDevice)).body.testRun.passed).toBe(true);
    process.env.RAILWAY_GIT_COMMIT_SHA = 'deadbeef22222222222222222222222222222222';
    const stale = await post(`${api}/${showId}/run`, owner, {}, ownerDevice);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('testRunStale');
    const list = await get(api, owner, ownerDevice);
    expect(list.body.shows.find(s => s.id === showId)).toMatchObject({
      runShowReady: false,
      lastTestRun: expect.objectContaining({ passed: true, sameCommit: false }),
    });
    expect(await gameSnapshot(showId)).toEqual(before);
  }, 90_000);

  it('after a passed test run it settles once: prize, fees, audit record; a second run changes nothing', async () => {
    const showId = await buildQuarantinedShow();
    await post(`${api}/${showId}/test-run`, owner, {}, ownerDevice);
    const before = { creator: await money(creator.id), entrant: await money(entrant.id) };

    const run = await post(`${api}/${showId}/run`, owner, {}, ownerDevice);

    expect(run.status).toBe(200);
    expect(run.body.result).toMatchObject({ showId, status: 'completed', settled: 1 });
    expect(await showState(showId)).toMatchObject({
      status: 'completed',
      prizeEscrow: 0,
      feeEscrow: 0,
      stagedOrdering: null,
      _count: { competitionResults: 1 },
    });
    // The winner is paid half the prize; the host gets the unpaid half back and all the entry fees.
    expect(await money(entrant.id)).toBe(before.entrant + 500);
    expect(await money(creator.id)).toBe(before.creator + 500 + entryFee);
    const rows = await toolRows(showId);
    expect(rows.map(r => [r.after.action, r.outcome])).toEqual([
      ['testRun', 'succeeded'],
      ['runShow', 'succeeded'],
    ]);
    expect(rows[1].after).toMatchObject({ coinsIn: prize + entryFee, coinsOut: prize + entryFee });

    const again = await post(`${api}/${showId}/run`, owner, {}, ownerDevice);
    expect(again.status).toBe(409);
    expect(await money(entrant.id)).toBe(before.entrant + 500);
    expect(await money(creator.id)).toBe(before.creator + 500 + entryFee);
    expect((await showState(showId))._count.competitionResults).toBe(1);
    expect(await toolRows(showId)).toHaveLength(2);
  }, 90_000);

  it('two runs at once settle the show exactly once', async () => {
    const showId = await buildQuarantinedShow();
    await post(`${api}/${showId}/test-run`, owner, {}, ownerDevice);
    const before = await money(entrant.id);
    const send = [
      await preparePost(`${api}/${showId}/run`, owner, {}, ownerDevice),
      await preparePost(`${api}/${showId}/run`, owner, {}, ownerDevice),
    ];

    const responses = await Promise.all(send.map(start => start()));

    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await money(entrant.id)).toBe(before + 500);
    expect((await showState(showId))._count.competitionResults).toBe(1);
    expect((await toolRows(showId)).filter(r => r.after.action === 'runShow')).toHaveLength(1);
  }, 90_000);

  it('a coin-count mismatch aborts and rolls back: still quarantined, nothing paid, the failure recorded', async () => {
    const showId = await buildQuarantinedShow();
    await post(`${api}/${showId}/test-run`, owner, {}, ownerDevice);
    const before = await gameSnapshot(showId);
    // A defect that mints coins inside the settlement transaction.
    const mintCoins = tx => tx.user.update({ where: { id: entrant.id }, data: { money: { increment: 7 } } });

    await expect(
      runQuarantinedShow(showId, { actor: { id: owner.id, role: 'owner' }, afterSettle: mintCoins }),
    ).rejects.toMatchObject({ code: 'settlementFailed' });

    expect(await gameSnapshot(showId)).toEqual(before);
    const failures = await failureRows(showId);
    expect(failures).toHaveLength(1);
    expect(failures[0].summary).toMatchObject({ source: 'runShow' });
    expect(failures[0].errorMessage).toMatch(/Coin count mismatch/);
    // The failed run locks Run Show again until a new test run passes.
    expect((await post(`${api}/${showId}/run`, owner, {}, ownerDevice)).body.code).toBe('testRunRequired');
    // The same defect fails a test run too.
    const testRun = await testRunQuarantinedShow(showId, {
      actor: { id: owner.id, role: 'owner' },
      afterSettle: mintCoins,
    });
    expect(testRun).toMatchObject({ passed: false });
    expect(testRun.error).toMatch(/Coin count mismatch/);
    expect(await gameSnapshot(showId)).toEqual(before);
  }, 90_000);

  it('a settlement that fails rolls everything back and adds the failure to the diagnosis', async () => {
    const showId = await buildQuarantinedShow();
    await post(`${api}/${showId}/test-run`, owner, {}, ownerDevice);
    // After the passed test run, the staged placing is broken (an account that does not exist).
    // The digest covers placements, not owners, so the run proceeds and fails mid-payout.
    const staged = (await showState(showId)).stagedOrdering;
    await prisma.show.update({
      where: { id: showId },
      data: { stagedOrdering: [{ ...staged[0], userId: `${prefix}-no-such-user` }] },
    });
    const before = await gameSnapshot(showId);

    const run = await post(`${api}/${showId}/run`, owner, {}, ownerDevice);

    expect(run.status).toBe(500);
    expect(run.body.code).toBe('settlementFailed');
    expect(await gameSnapshot(showId)).toEqual(before);
    const rows = await toolRows(showId);
    expect(rows.at(-1)).toMatchObject({ outcome: 'failed' });
    expect(rows.at(-1).after).toMatchObject({ action: 'runShow' });
    const report = (await get(`${api}/${showId}/diagnose`, owner, ownerDevice)).body.diagnosis.report;
    expect(report).toContain("Owner's Run Show");
  }, 90_000);
});
