/**
 * The owner's tools for a quarantined show (Equoria-ehlbj).
 *
 * Owner rulings 2026-10-23 (q29, q30, q41): quarantined shows are visible only to
 * the Owner. Diagnose exports what she can hand to Claude Code or Codex. Run Show
 * is two steps: a preview that computes placements and prize money and moves
 * nothing, then a confirm that settles once, in one transaction, can never run
 * twice, and writes an audit record. Players see "Results delayed".
 *
 * The OLD contract (Equoria-c7mx0.1) listed quarantined shows for owner and
 * admins; the owner's new ruling narrows it to the owner alone, so the list test
 * in showExecutionReaperQuarantine.integration.test.mjs changed with it.
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
import { executeClosedShows } from '../modules/competition/index.mjs';
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

const prefix = 'TestFixture-ehlbj-owner';
const api = '/api/v1/staff/shows/quarantined';
const prize = 1000;
const entryFee = prize / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const riderIds = [];
const showIds = [];
const cronRunIds = [];
const staff = createUserFactory('ehlbjstaff');
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
  const createRes = fakeRes();
  await createShow(
    {
      user: { id: creator.id },
      body: {
        name: `${prefix}-show-${randomBytes(4).toString('hex')}`,
        discipline: 'Dressage',
        entryFee,
        level: 1,
      },
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
      _count: { select: { competitionResults: true } },
    },
  });
const auditRows = showId =>
  prisma.staffActionLog.findMany({
    where: { targetType: 'show', targetId: String(showId), capability: 'shows.quarantine.resolve' },
  });

beforeAll(async () => {
  creator = await makeUser(100000, 'creator');
  entrant = await makeUser(10 * entryFee, 'entrant'); // enough for every show this suite enters
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

  const staffScope = () => ({ in: staff.createdUserIds });
  cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { id: { in: cronRunIds } } }), 'cron runs');
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
  await drainUnsettledShows();
  await cleanup.run();
}, 120_000);

beforeEach(async () => {
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

  it('every tool is refused to an admin and hidden from a player', async () => {
    const showId = await buildQuarantinedShow();
    const admin = await staff.makeUser('admin');
    const adminDevice = await checkIn(admin);
    const player = await staff.makeUser('user');
    expect((await get(api, admin, adminDevice)).status).toBe(403);
    expect((await get(`${api}/${showId}/diagnose`, admin, adminDevice)).status).toBe(403);
    expect((await post(`${api}/${showId}/preview`, admin, {}, adminDevice)).status).toBe(403);
    expect((await post(`${api}/${showId}/run`, admin, { previewDigest: 'x' }, adminDevice)).status).toBe(403);
    expect((await get(`${api}/${showId}/diagnose`, player)).status).toBe(404);
    expect((await post(`${api}/${showId}/run`, player, { previewDigest: 'x' })).status).toBe(404);
    expect((await showState(showId)).status).toBe('quarantined');
  }, 60_000);

  it('the owner sees the quarantined show in the list', async () => {
    const showId = await buildQuarantinedShow();
    const res = await get(api, owner, ownerDevice);
    expect(res.status).toBe(200);
    expect(res.body.shows.find(s => s.id === showId)).toMatchObject({ id: showId, executionAttempts: 3 });
  }, 60_000);
});

describe('Diagnose', () => {
  it('exports the show, entries, staged placements, attempts, cron errors and ledger rows, with no secrets', async () => {
    const showId = await buildQuarantinedShow();
    const cronRun = await prisma.cronRunLog.create({
      data: {
        jobName: 'showExecutionReaper',
        startedAt: new Date(),
        finishedAt: new Date(),
        status: 'error',
        errorsCount: 1,
        errorMessage: `ehlbj fixture: show ${showId} did not reach completed`,
      },
    });
    cronRunIds.push(cronRun.id);

    const res = await get(`${api}/${showId}/diagnose`, owner, ownerDevice);

    expect(res.status).toBe(200);
    const { diagnosis } = res.body;
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(diagnosis.show).toMatchObject({
      id: showId,
      status: 'quarantined',
      prizeEscrow: prize,
      feeEscrow: entryFee,
    });
    expect(diagnosis.attempts).toBe(3);
    expect(diagnosis.entries).toHaveLength(1);
    expect(diagnosis.entries[0]).toMatchObject({ horseId: entrantHorse.id, userId: entrant.id });
    expect(diagnosis.stagedPlacements).toHaveLength(1);
    expect(diagnosis.stagedPlacements[0]).toMatchObject({ horseId: entrantHorse.id, placement: 1 });
    expect(diagnosis.lastCronErrors.map(r => r.id)).toContain(cronRun.id);
    const categories = diagnosis.ledger.map(row => row.category);
    expect(categories).toContain('showCreatePrizeEscrow');
    expect(categories).toContain('showEntryFeeEscrow');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(entrant.email);
    expect(text).not.toContain(creator.email);
    expect(text.toLowerCase()).not.toMatch(/passwordhash|"password"|refreshtoken/);
  }, 60_000);

  it('refuses a show that is not quarantined', async () => {
    const showId = await buildQuarantinedShow();
    await prisma.show.update({ where: { id: showId }, data: { status: 'open' } });
    const res = await get(`${api}/${showId}/diagnose`, owner, ownerDevice);
    expect(res.status).toBe(409);
  }, 60_000);
});

describe('Run Show: preview, then confirm', () => {
  it('the preview computes placements and prize money and moves nothing', async () => {
    const showId = await buildQuarantinedShow();
    const before = {
      creator: await money(creator.id),
      entrant: await money(entrant.id),
      show: await showState(showId),
    };

    const res = await post(`${api}/${showId}/preview`, owner, {}, ownerDevice);

    expect(res.status).toBe(200);
    const { preview } = res.body;
    expect(preview.placements).toEqual([
      expect.objectContaining({ placement: 1, horseId: entrantHorse.id, prize: 500 }),
    ]);
    expect(preview.entryFeesToHost).toBe(entryFee);
    expect(preview.unpaidPrizeShareToHost).toBe(500);
    expect(typeof preview.previewDigest).toBe('string');
    expect(await money(creator.id)).toBe(before.creator);
    expect(await money(entrant.id)).toBe(before.entrant);
    expect(await showState(showId)).toEqual(before.show);
    expect(await auditRows(showId)).toHaveLength(0);
  }, 60_000);

  it('confirm without a preview digest, or with a stale one, settles nothing', async () => {
    const showId = await buildQuarantinedShow();
    const before = await showState(showId);

    const none = await post(`${api}/${showId}/run`, owner, {}, ownerDevice);
    const stale = await post(`${api}/${showId}/run`, owner, { previewDigest: 'not-what-was-previewed' }, ownerDevice);

    expect(none.status).toBe(400);
    expect(stale.status).toBe(409);
    expect(await showState(showId)).toEqual(before);
  }, 60_000);

  it('confirm settles once: prize, fees and the audit record, and a second run changes nothing', async () => {
    const showId = await buildQuarantinedShow();
    const preview = (await post(`${api}/${showId}/preview`, owner, {}, ownerDevice)).body.preview;
    const before = { creator: await money(creator.id), entrant: await money(entrant.id) };

    const run = await post(`${api}/${showId}/run`, owner, { previewDigest: preview.previewDigest }, ownerDevice);

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
    const audit = await auditRows(showId);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: owner.id, actorRole: 'owner', outcome: 'succeeded' });

    // Running twice is impossible.
    const again = await post(`${api}/${showId}/run`, owner, { previewDigest: preview.previewDigest }, ownerDevice);
    expect(again.status).toBe(409);
    expect(await money(entrant.id)).toBe(before.entrant + 500);
    expect(await money(creator.id)).toBe(before.creator + 500 + entryFee);
    expect((await showState(showId))._count.competitionResults).toBe(1);
    expect(await auditRows(showId)).toHaveLength(1);
  }, 90_000);

  it('two confirms at once settle the show exactly once', async () => {
    const showId = await buildQuarantinedShow();
    const preview = (await post(`${api}/${showId}/preview`, owner, {}, ownerDevice)).body.preview;
    const before = await money(entrant.id);
    const send = [
      await preparePost(`${api}/${showId}/run`, owner, { previewDigest: preview.previewDigest }, ownerDevice),
      await preparePost(`${api}/${showId}/run`, owner, { previewDigest: preview.previewDigest }, ownerDevice),
    ];

    const responses = await Promise.all(send.map(start => start()));

    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await money(entrant.id)).toBe(before + 500);
    expect((await showState(showId))._count.competitionResults).toBe(1);
    expect(await auditRows(showId)).toHaveLength(1);
  }, 90_000);

  it('a settlement that fails rolls everything back: still quarantined, nothing paid, the failure recorded', async () => {
    // The staged placing names an account that does not exist, so the payout
    // transaction fails after it has already written the result row.
    const showId = await buildQuarantinedShow({ stagedUserId: `${prefix}-no-such-user` });
    const preview = (await post(`${api}/${showId}/preview`, owner, {}, ownerDevice)).body.preview;
    const before = {
      creator: await money(creator.id),
      entrant: await money(entrant.id),
      show: await showState(showId),
    };

    const run = await post(`${api}/${showId}/run`, owner, { previewDigest: preview.previewDigest }, ownerDevice);

    expect(run.status).toBe(500);
    expect(run.body.code).toBe('settlementFailed');
    expect(await showState(showId)).toEqual(before.show);
    expect(await money(creator.id)).toBe(before.creator);
    expect(await money(entrant.id)).toBe(before.entrant);
    const audit = await auditRows(showId);
    expect(audit).toHaveLength(1);
    expect(audit[0].outcome).toBe('failed');
  }, 90_000);
});
