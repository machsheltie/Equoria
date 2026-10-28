/**
 * Show reaper: bounded attempts and quarantine (Equoria-c7mx0.1).
 *
 * Owner ruling 2026-10-23 (Stacey): quarantine a show after 3 failed execution
 * attempts; quarantined shows are listed for Owner/Admin to resolve.
 *
 * Before: a show whose execution kept crashing was released back to 'open' and
 * re-driven by the reaper every ~2.5h forever, with an alert each time.
 * Now each stranding the reaper finds is one failed execution attempt
 * (Show.executionAttempts). The stranding that makes the third attempt sets
 * the show 'quarantined' instead of releasing it: no re-drive, no executor or
 * reaper scan selects it again, and its escrow is left exactly as it was for
 * a staff decision. Only the owner sees it, at GET /api/v1/staff/shows/
 * quarantined (Equoria-ehlbj); admins, moderators and players do not.
 *
 * Real controllers build and fund the show (createShow / enterShow), the real
 * reaper and executor run, the staff route goes through the real app with a
 * real email-code check-in. No mocks. Crash artifacts are planted the same way
 * as showExecutionReaper.integration.test.mjs.
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
import { maxExecutionAttempts, reapStaleExecutingShows } from '../services/jobs/impl/showExecutionReaper.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  startEmailCapture,
  stopEmailCapture,
} from '../modules/staff/__tests__/helpers/staffFixtures.mjs';

const prefix = 'TestFixture-c7mx0_1-quarantine';
const staffApi = '/api/v1/staff';
// Older than the reaper's 2h stale-claim threshold, as the crash suite plants.
const staleClaimAgeMs = 3 * 60 * 60 * 1000;
const prize = 1000;
const entryFee = prize / 10; // the prize is always 10x the entry fee (owner ruling 2026-10-23)
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const riderIds = [];
const showIds = [];
const staff = createUserFactory('c7mx01staff');
let creator;
let entrant;
let entrantHorse;

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

/** A show funded through the real controllers: prize and one entry fee in escrow. */
async function buildFundedShow() {
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
  return showId;
}

/** The crash artifact: the claim committed 3h ago and nothing after it. */
async function plantCrash(showId, executionAttempts) {
  await prisma.show.update({
    where: { id: showId },
    data: {
      closeDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'executing',
      claimedAt: new Date(Date.now() - staleClaimAgeMs),
      executionAttempts,
    },
  });
}

const showState = showId =>
  prisma.show.findUnique({
    where: { id: showId },
    select: {
      status: true,
      executionAttempts: true,
      claimedAt: true,
      prizeEscrow: true,
      feeEscrow: true,
      _count: { select: { competitionResults: true } },
    },
  });

beforeAll(async () => {
  creator = await makeUser(100000, 'creator');
  entrant = await makeUser(500, 'entrant');
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

afterAll(() => cleanup.run(), 60_000);

describe('Equoria-c7mx0.1 — the reaper counts failed attempts and quarantines at 3', () => {
  it('the limit is the owner ruling: 3 attempts', () => {
    expect(maxExecutionAttempts).toBe(3);
  });

  it('a first stranding is attempt 1: released and re-driven to completion', async () => {
    const showId = await buildFundedShow();
    await plantCrash(showId, 0);

    const summary = await reapStaleExecutingShows({ showIds: [showId] });

    expect(summary).toMatchObject({ staleShowsFound: 1, releasedCount: 1, recoveredCount: 1 });
    expect(summary.quarantinedShowIds).toEqual([]);
    const state = await showState(showId);
    expect(state).toMatchObject({ status: 'completed', executionAttempts: 1, prizeEscrow: 0, feeEscrow: 0 });
    expect(state._count.competitionResults).toBe(1);
  }, 60_000);

  let quarantinedId;

  it('the stranding that makes attempt 3 quarantines the show: no re-drive, escrow untouched', async () => {
    const showId = await buildFundedShow();
    quarantinedId = showId;
    await plantCrash(showId, maxExecutionAttempts - 1);
    const before = await showState(showId);

    const summary = await reapStaleExecutingShows({ showIds: [showId] });

    expect(summary).toMatchObject({ staleShowsFound: 1, releasedCount: 0, recoveredCount: 0 });
    expect(summary.quarantinedShowIds).toEqual([showId]);
    const state = await showState(showId);
    expect(state).toMatchObject({
      status: 'quarantined',
      executionAttempts: maxExecutionAttempts,
      claimedAt: null,
      prizeEscrow: before.prizeEscrow,
      feeEscrow: before.feeEscrow,
    });
    expect(state._count.competitionResults).toBe(0);
  }, 60_000);

  it('a quarantined show is never retried: not by the reaper, not by the nightly executor', async () => {
    const reaped = await reapStaleExecutingShows({ showIds: [quarantinedId] });
    expect(reaped.staleShowsFound).toBe(0);
    await executeClosedShows({ body: { showIds: [quarantinedId] } }, undefined);
    const state = await showState(quarantinedId);
    expect(state.status).toBe('quarantined');
    expect(state._count.competitionResults).toBe(0);
  }, 60_000);

  describe('GET /api/v1/staff/shows/quarantined', () => {
    beforeEach(() => startEmailCapture());
    afterEach(() => stopEmailCapture());

    // Owner ruling 2026-10-23 (Equoria-ehlbj, q29): the old contract listed these
    // for owner and admins; quarantined shows are now visible to the Owner alone.
    it('lists the quarantined show for the owner', async () => {
      const user = await staff.makeUser('owner');
      const device = await checkIn(user);
      const res = await get(`${staffApi}/shows/quarantined`, user, device);
      expect(res.status).toBe(200);
      const listed = res.body.shows.find(s => s.id === quarantinedId);
      expect(listed).toMatchObject({
        id: quarantinedId,
        executionAttempts: maxExecutionAttempts,
        prizeEscrow: prize,
        feeEscrow: entryFee,
        entryCount: 1,
      });
      expect(res.body.shows.every(s => s.status === 'quarantined')).toBe(true);
    }, 60_000);

    it('is refused to an admin and a moderator and hidden from a player', async () => {
      const admin = await staff.makeUser('admin');
      const adminDevice = await checkIn(admin);
      const asAdmin = await get(`${staffApi}/shows/quarantined`, admin, adminDevice);
      expect(asAdmin.status).toBe(403);
      expect(asAdmin.body.shows).toBeUndefined();
      const mod = await staff.makeUser('moderator');
      const modDevice = await checkIn(mod);
      const asMod = await get(`${staffApi}/shows/quarantined`, mod, modDevice);
      expect(asMod.status).toBe(403);
      expect(asMod.body.shows).toBeUndefined();
      const player = await staff.makeUser('user');
      const asPlayer = await get(`${staffApi}/shows/quarantined`, player);
      expect(asPlayer.status).toBe(404);
      expect(asPlayer.body.shows).toBeUndefined();
    }, 60_000);
  });

  it('cleanup: the quarantined show is settled through the real executor so no escrow is stranded', async () => {
    // Not a resolution feature (that is the owner's open question): this hands
    // the suite's own show back to the executor so the shared escrow account
    // stays balanced after the suite deletes its rows.
    await prisma.show.update({ where: { id: quarantinedId }, data: { status: 'open' } });
    await executeClosedShows({ body: { showIds: [quarantinedId] } }, undefined);
    expect(await showState(quarantinedId)).toMatchObject({ status: 'completed', prizeEscrow: 0, feeEscrow: 0 });
  }, 60_000);
});
