/**
 * A placing that can never be paid is quarantined after 3 failed tries (Equoria-o1vns).
 *
 * Owner ruling 2026-10-23 (q56): the half-settled-show re-drive (Equoria-cmw85.2)
 * used to retry a permanently unpayable placing at every scan, keeping cron red
 * for ever. Now each run that leaves a placing unpaid is one failed try, counted
 * in Show.executionAttempts like the reaper's strandings; the third failed try
 * quarantines the show, which no executor or reaper scan selects. Players see
 * "Results delayed"; the owner finds it in her quarantined list.
 *
 * Real controllers fund and enter the show, the real executor runs. The
 * unpayable placing names an account that does not exist, so its payout
 * transaction fails and rolls back every run.
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
import {
  checkIn,
  createUserFactory,
  get,
  startEmailCapture,
  stopEmailCapture,
} from '../modules/staff/__tests__/helpers/staffFixtures.mjs';
import { testHorseData } from './helpers/createTestHorse.mjs';

const prefix = 'TestFixture-o1vns';
const prize = 1000;
const entryFee = 50;
const cleanup = createCleanupTracker();
const userIds = [];
const horseIds = [];
const riderIds = [];
const showIds = [];
const staff = createUserFactory('o1vnsstaff');
let creator;
let entrant;
let horses;

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
      firstName: 'Recovery',
      lastName: suffix,
      money,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeHorse(label) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${prefix}-${label}-${randomBytes(4).toString('hex')}`,
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
    }),
  });
  horseIds.push(horse.id);
  await giveEligibleRider(prisma, { horseId: horse.id, userId: entrant.id }, riderIds);
  return horse;
}

function staged(horse, userId, placement, score) {
  return { horseId: horse.id, userId, horseName: horse.name, score, placement, riderId: null };
}

/**
 * A show funded and entered through the real controllers, then left as a run
 * that paid its winner and could not pay second place: 'completed', staged
 * ordering kept, one result row.
 */
async function buildHalfSettledShow() {
  const createRes = fakeRes();
  await createShow(
    {
      user: { id: creator.id },
      body: {
        name: `${prefix}-show-${randomBytes(4).toString('hex')}`,
        discipline: 'Dressage',
        entryFee,
        prize,
        level: 1,
      },
    },
    createRes,
  );
  expect(createRes.statusCode).toBe(201);
  const showId = createRes.body.data.show.id;
  showIds.push(showId);
  for (const horse of horses) {
    const enterRes = fakeRes();
    await enterShow(
      { user: { id: entrant.id }, params: { id: String(showId) }, body: { horseId: horse.id } },
      enterRes,
    );
    expect(enterRes.statusCode).toBe(201);
  }
  await prisma.show.update({
    where: { id: showId },
    data: {
      closeDate: new Date(Date.now() - 3 * 60 * 60 * 1000),
      status: 'completed',
      executedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      stagedOrdering: [staged(horses[0], entrant.id, 1, 80), staged(horses[1], `${prefix}-no-such-user`, 2, 70)],
    },
  });
  return showId;
}

const showState = showId =>
  prisma.show.findUnique({
    where: { id: showId },
    select: { status: true, executionAttempts: true, _count: { select: { competitionResults: true } } },
  });

const redrive = showId => executeClosedShows({ body: { showIds: [showId] } }, undefined);

/** True when the run rethrew a failure (the cron records it as a failed run). */
async function redriveFails(showId) {
  try {
    await redrive(showId);
    return false;
  } catch {
    return true;
  }
}

const failureRows = showId =>
  prisma.cronRunLog.findMany({
    where: { jobName: 'showFailure', summary: { path: ['showId'], equals: showId } },
    orderBy: { id: 'asc' },
  });

beforeAll(async () => {
  const staffScope = () => ({ in: staff.createdUserIds });
  // Equoria-yqi49: the failed tries these shows record for the owner's Diagnose.
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
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: staffScope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: staffScope() } }), 'devices');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: staffScope() } }), 'staff notifications');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: staffScope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: staffScope() } }), 'staff users');

  creator = await makeUser(100000, 'creator');
  entrant = await makeUser(1000, 'entrant');
  horses = [await makeHorse('first'), await makeHorse('second')];
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('Equoria-o1vns — an unpayable placing is quarantined after 3 failed nightly tries', () => {
  let showId;

  it('each failed re-drive is one counted try; the winner is paid once and the show stays completed', async () => {
    showId = await buildHalfSettledShow();

    expect(await redriveFails(showId)).toBe(true);
    expect(await showState(showId)).toMatchObject({
      status: 'completed',
      executionAttempts: 1,
      _count: { competitionResults: 1 },
    });

    expect(await redriveFails(showId)).toBe(true);
    expect(await showState(showId)).toMatchObject({
      status: 'completed',
      executionAttempts: 2,
      _count: { competitionResults: 1 },
    });
  }, 90_000);

  it('the third failed try quarantines it, and no later run selects it', async () => {
    expect(await redriveFails(showId)).toBe(true);
    expect(await showState(showId)).toMatchObject({
      status: 'quarantined',
      executionAttempts: 3,
      _count: { competitionResults: 1 },
    });

    // Quiet from here: the nightly run no longer throws and changes nothing.
    expect(await redriveFails(showId)).toBe(false);
    expect(await showState(showId)).toMatchObject({
      status: 'quarantined',
      executionAttempts: 3,
      _count: { competitionResults: 1 },
    });
    const kept = await prisma.show.findUnique({ where: { id: showId }, select: { stagedOrdering: true } });
    expect(kept.stagedOrdering).toHaveLength(2);
  }, 90_000);

  it('every failed payout try was recorded for Diagnose with its error and stack (Equoria-yqi49)', async () => {
    const failures = await failureRows(showId);
    expect(failures).toHaveLength(3);
    for (const failure of failures) {
      expect(failure.summary).toMatchObject({ showId, source: 'nightlyPayout' });
      expect(typeof failure.errorMessage).toBe('string');
      expect(failure.summary.stack).toMatch(/modules[\\/]competition[\\/]shows[\\/]showExecutionService\.mjs/);
    }
  });

  describe('the owner finds it in her quarantined list', () => {
    beforeEach(() => startEmailCapture());
    afterEach(() => stopEmailCapture());

    it('GET /api/v1/staff/shows/quarantined lists it', async () => {
      const owner = await staff.makeUser('owner');
      const device = await checkIn(owner);
      const res = await get('/api/v1/staff/shows/quarantined', owner, device);
      expect(res.status).toBe(200);
      expect(res.body.shows.find(s => s.id === showId)).toMatchObject({ id: showId, executionAttempts: 3 });
    }, 60_000);
  });

  it('cleanup: the unpayable placing is corrected and the executor drains the escrow', async () => {
    // Not a resolution feature (the owner's Run Show is): this hands the suite's
    // own show back to the executor so the shared escrow account stays balanced
    // after the suite deletes its rows.
    await prisma.show.update({
      where: { id: showId },
      data: {
        status: 'completed',
        executionAttempts: 0,
        stagedOrdering: [staged(horses[0], entrant.id, 1, 80), staged(horses[1], entrant.id, 2, 70)],
      },
    });
    await redrive(showId);
    expect(await showState(showId)).toMatchObject({ status: 'completed', _count: { competitionResults: 2 } });
    const drained = await prisma.show.findUnique({
      where: { id: showId },
      select: { prizeEscrow: true, feeEscrow: true },
    });
    expect(drained).toEqual({ prizeEscrow: 0, feeEscrow: 0 });
  }, 90_000);
});
