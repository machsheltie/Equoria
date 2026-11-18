/**
 * "Deliver overdue foals now" (Equoria-puj1e.5, docs/features/admin-time-back.md;
 * owner ruling 2026-10-05: foals wait the full 7 days) — real HTTP, real DB.
 *
 * Old contract: POST /api/v1/admin/foaling/trigger ran the foaling job with the
 * clock moved forward (8 days by default, `advanceDays` up to 365), so a mare
 * bred today foaled at once. The owner-approved design removes the
 * fast-forward: the trigger runs at the real time, through the same run log and
 * nightly-job hold as the scheduled job.
 *
 * The refusals below never run the job. The last case runs it at the real time
 * and proves a mare bred two days ago is still in foal afterwards.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
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

const TRIGGER = '/api/v1/admin/foaling/trigger';
const day = 86_400_000;
const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('foaltrig');
const horses = [];
let holdBefore;
let startedAt;
let owner;
let device;

beforeAll(async () => {
  holdBefore = await snapshotHold();
  startedAt = new Date();
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  cleanup.add(
    () => prisma.cronRunLog.deleteMany({ where: { jobName: 'foaling', startedAt: { gte: startedAt } } }),
    'foaling runs',
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

afterEach(() => stopEmailCapture());

describe('Deliver overdue foals now', () => {
  it('refuses any clock fast-forward', async () => {
    for (const advanceDays of [8, 0, '3']) {
      const res = await post(TRIGGER, owner, { advanceDays }, device);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('foalingFastForwardRemoved');
    }
  }, 60_000);

  it('is refused while the owner holds the nightly jobs, and the skip is logged', async () => {
    await prisma.gameControl.create({ data: { id: 1, jobsHeld: true, heldAt: new Date(), heldById: owner.id } });
    const res = await post(TRIGGER, owner, {}, device);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('jobsHeld');
    const runs = await prisma.cronRunLog.findMany({
      where: { jobName: 'foaling', startedAt: { gte: startedAt } },
      select: { status: true },
    });
    expect(runs).toEqual([{ status: 'skipped-held' }]);
    await prisma.gameControl.deleteMany({ where: { id: 1 } });
  }, 60_000);

  it('runs at the real time: a mare bred two days ago is still in foal, and the run is logged', async () => {
    const player = await makeUser('user');
    const sire = await prisma.horse.create({
      data: await testHorseData(prisma, { name: `TestFixture-foaltrig-${uid()}`, sex: 'Stallion', userId: player.id }),
    });
    horses.push(sire.id);
    const bredAt = new Date(Date.now() - 2 * day);
    const mare = await prisma.horse.create({
      data: await testHorseData(prisma, {
        name: `TestFixture-foaltrig-${uid()}`,
        sex: 'Mare',
        userId: player.id,
        inFoalSinceDate: bredAt,
        pregnancySireId: sire.id,
      }),
    });
    horses.push(mare.id);

    const res = await post(TRIGGER, owner, {}, device);
    expect(res.status).toBe(200);
    const after = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(after.inFoalSinceDate).toEqual(bredAt);
    expect(after.pregnancySireId).toBe(sire.id);
    const runs = await prisma.cronRunLog.findMany({
      where: { jobName: 'foaling', startedAt: { gte: startedAt }, status: 'success' },
    });
    expect(runs).toHaveLength(1);
  }, 60_000);
});
