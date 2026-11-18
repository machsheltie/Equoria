/**
 * "Age every horse now" and the trait-evaluation trigger run like their
 * schedules (Equoria-puj1e.5, docs/features/admin-time-back.md "Nightly-job
 * hold") — real HTTP, real DB, nothing mocked.
 *
 * Old contract: POST /api/v1/admin/horses/age and POST /api/v1/admin/traits/evaluate
 * called the passes directly. They wrote no cron run log (so a time-back could
 * not see they had run inside an outage), ignored the owner's nightly-job hold,
 * and took no advisory lock. Now each runs through the monitor under its
 * scheduled job's name ('dailyHorseAging', 'dailyTraitEvaluation'), exactly as
 * "deliver overdue foals now" does.
 *
 * Aging every horse is never run for real here: it ages the whole shared
 * database. Its route is proved to go through the monitor by the hold (the pass
 * never starts, the skip is logged) and by its job's own advisory lock, held
 * by this suite (the run is logged as skipped and refused). The trait
 * evaluation's full 200 is the one cronJobsIntegration already runs; here it
 * also leaves a 'success' row in the run log.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { jobNameToLockKey } from '../utils/cronLock.mjs';
import { birthDateForAge } from '../utils/horseAge.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { testHorseData } from './helpers/createTestHorse.mjs';
import {
  checkIn,
  createUserFactory,
  post,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from '../modules/staff/__tests__/helpers/staffFixtures.mjs';
import { restoreHold, snapshotHold } from '../modules/staff/__tests__/helpers/timeBackFixtures.mjs';

const ageAllRoute = '/api/v1/admin/horses/age';
const evaluateRoute = '/api/v1/admin/traits/evaluate';
const jobNames = ['dailyHorseAging', 'dailyTraitEvaluation'];
const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('jobtrig');
const horses = [];
let holdBefore;
let startedAt;
let owner;
let device;

const runsOf = jobName =>
  prisma.cronRunLog.findMany({
    where: { jobName, startedAt: { gte: startedAt } },
    orderBy: { id: 'asc' },
    select: { status: true },
  });

const hold = () =>
  prisma.gameControl.create({ data: { id: 1, jobsHeld: true, heldAt: new Date(), heldById: owner.id } });

beforeAll(async () => {
  holdBefore = await snapshotHold();
  startedAt = new Date();
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  cleanup.add(
    () => prisma.cronRunLog.deleteMany({ where: { jobName: { in: jobNames }, startedAt: { gte: startedAt } } }),
    'trigger runs',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horses } } }), 'horses');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
  await prisma.gameControl.deleteMany({ where: { id: 1 } });
  startEmailCapture();
  owner = await makeUser('owner');
  device = await checkIn(owner);
  stopEmailCapture();
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

beforeEach(() => startEmailCapture());

afterEach(async () => {
  stopEmailCapture();
  await prisma.gameControl.deleteMany({ where: { id: 1 } });
});

describe('Age every horse now', () => {
  it('is refused while the nightly jobs are held: the pass never starts and the skip is logged', async () => {
    const player = await makeUser('user');
    // Stored age 0 for a horse born 5 game-years ago: any aging pass would fix it.
    const horse = await prisma.horse.create({
      data: await testHorseData(prisma, {
        name: `TestFixture-jobtrig-${uid()}`,
        sex: 'Mare',
        userId: player.id,
        age: 0,
        dateOfBirth: birthDateForAge(5),
      }),
    });
    horses.push(horse.id);
    await hold();

    const res = await post(ageAllRoute, owner, {}, device);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('jobsHeld');
    expect(await runsOf('dailyHorseAging')).toEqual([{ status: 'skipped-held' }]);
    const after = await prisma.horse.findUnique({ where: { id: horse.id }, select: { age: true } });
    expect(after.age).toBe(0);
  }, 60_000);

  it('takes the nightly aging job’s own lock: while another run holds it, it is refused and logged', async () => {
    const before = (await runsOf('dailyHorseAging')).length;
    const key = jobNameToLockKey('dailyHorseAging');
    const res = await prisma.$transaction(
      async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key}::bigint)`;
        return post(ageAllRoute, owner, {}, device);
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('jobsHeld');
    const runs = await runsOf('dailyHorseAging');
    expect(runs).toHaveLength(before + 1);
    expect(runs.at(-1)).toEqual({ status: 'skipped-locked' });
  }, 60_000);
});

describe('Trait evaluation trigger', () => {
  it('is refused while the nightly jobs are held, and the skip is logged', async () => {
    await hold();

    const res = await post(evaluateRoute, owner, {}, device);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('jobsHeld');
    expect(await runsOf('dailyTraitEvaluation')).toEqual([{ status: 'skipped-held' }]);
  }, 60_000);

  it('runs when the jobs are not held and writes its run to the log', async () => {
    const res = await post(evaluateRoute, owner, {}, device);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(await runsOf('dailyTraitEvaluation')).toEqual([{ status: 'skipped-held' }, { status: 'success' }]);
  }, 120_000);
});
