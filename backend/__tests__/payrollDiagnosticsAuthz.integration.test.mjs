/**
 * The owner's payroll diagnostics and server panel (Equoria-brh8c, owner ruling
 * 2026-10-28 q158). Security gate: file-name token `Authz`.
 *
 * Owner/Head Admin only, behind the emailed staff check-in. A payroll failure is
 * recorded per groom or rider when the weekly settlement or the owner's manual
 * groom payday fails for them; the owner searches by name, sees the failures, copies
 * a report with no secrets, and re-runs only after a test run (always rolled back)
 * passed on the deployed commit. A re-run is idempotent per staff member and week.
 *
 * Real DB, real routes behind a real email-code check-in, real payroll passes,
 * scoped to this file's players. A recorded failure is a real throw: a settlement
 * whose snapshot of a groom or rider went stale before its write (the player let
 * them go mid-pass). Test run and re-run failures inside their transaction use the
 * service's afterReplay seam, as the held-show tools do.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { gameDateKey, gameDayIndex, startOfGameDayIndex } from '../utils/gameTime.mjs';
import { handleUnpaidFees } from '../modules/grooms/services/groomFeeArrearsService.mjs';
import { groomPayrollFailureRecorder } from '../modules/grooms/services/groomPayrollFailures.mjs';
import { handleUnpaidRiders } from '../modules/riders/services/riderUnpaidService.mjs';
import { riderPayrollFailureRecorder } from '../modules/riders/services/riderPayrollFailures.mjs';
import { getPayWeekStart } from '../modules/grooms/services/groomSalaryService.mjs';
import { hasCapability } from '../modules/staff/capabilities.mjs';
import { capabilityRequiredCode, checkinRequiredCode } from '../modules/staff/middleware/requireStaffCapability.mjs';
import { recordPayrollFailure } from '../modules/staff/services/payrollFailureLog.mjs';
import { rerunPayrollFailure, testRunPayrollFailure } from '../modules/staff/services/payrollDiagnosticsService.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  startEmailCapture,
  stopEmailCapture,
} from '../modules/staff/__tests__/helpers/staffFixtures.mjs';

const prefix = 'TestFixture-brh8c';
const api = '/api/v1/staff/payroll';
const health = '/api/v1/staff/server-health';
const dayMs = 24 * 60 * 60 * 1000;
const tag = () => randomBytes(4).toString('hex');
const cleanup = createCleanupTracker();
const staff = createUserFactory('brh8cstaff');
const playerIds = [];
const savedCommitSha = process.env.RAILWAY_GIT_COMMIT_SHA;
let owner;
let ownerDevice;

const thisWeek = () => getPayWeekStart(new Date());

async function makePlayer(money) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${prefix}-${t}`,
      email: `${prefix}-${t}@example.com`,
      password: 'not-a-real-hash',
      firstName: 'Payroll',
      lastName: 'Player',
      money,
    },
  });
  playerIds.push(user.id);
  return user;
}

/** A groom on the player's staff since a month ago. */
async function makeGroom(userId, starLevel) {
  const groom = await prisma.groom.create({
    data: {
      name: `${prefix}-groom-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      starLevel,
      startAge: 20,
      userId,
    },
  });
  await prisma.groomEngagement.create({
    data: { groomId: groom.id, userId, startedAt: new Date(Date.now() - 30 * dayMs) },
  });
  return groom;
}

async function makeRider(userId, starLevel) {
  return prisma.rider.create({
    data: {
      firstName: prefix,
      lastName: `Rider-${tag()}`,
      personality: 'gentle',
      skillLevel: 'developing',
      speciality: 'Dressage',
      starLevel,
      userId,
    },
  });
}

const failureRows = (staffType, staffId) =>
  prisma.cronRunLog.findMany({
    where: {
      jobName: 'payrollFailure',
      AND: [
        { summary: { path: ['staffType'], equals: staffType } },
        { summary: { path: ['staffId'], equals: staffId } },
      ],
    },
    orderBy: { id: 'asc' },
  });
const toolRows = (staffType, staffId) =>
  prisma.staffActionLog.findMany({
    where: { capability: 'payroll.diagnose', targetType: staffType, targetId: String(staffId) },
    orderBy: { id: 'asc' },
  });

/** Everything a payroll replay could write for one player and groom. */
async function groomSnapshot(userId, groomId) {
  const [user, groom, payments, notifications, ledger] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { money: true, groomSalaryGracePeriod: true },
    }),
    prisma.groom.findUnique({ where: { id: groomId }, select: { userId: true, feeUnpaidSince: true } }),
    prisma.groomSalaryPayment.findMany({ where: { groomId }, orderBy: { id: 'asc' } }),
    prisma.notification.count({ where: { userId } }),
    prisma.userTransaction.count({ where: { userId } }),
  ]);
  return { user, groom, payments, notifications, ledger };
}

async function failureIdFor(staffType, staffId, source) {
  const rows = await failureRows(staffType, staffId);
  const row = rows.find(r => r.summary.source === source);
  expect(row).toBeDefined();
  return row.id;
}

beforeAll(() => {
  const staffScope = () => ({ in: staff.createdUserIds });
  cleanup.add(async () => {
    const grooms = await prisma.groom.findMany({
      where: { name: { startsWith: prefix } },
      select: { id: true },
    });
    const riders = await prisma.rider.findMany({
      where: { firstName: prefix },
      select: { id: true },
    });
    const groomIds = grooms.map(g => g.id);
    const riderIds = riders.map(r => r.id);
    await prisma.cronRunLog.deleteMany({
      where: {
        jobName: 'payrollFailure',
        OR: [
          ...groomIds.map(id => ({
            AND: [
              { summary: { path: ['staffType'], equals: 'groom' } },
              { summary: { path: ['staffId'], equals: id } },
            ],
          })),
          ...riderIds.map(id => ({
            AND: [
              { summary: { path: ['staffType'], equals: 'rider' } },
              { summary: { path: ['staffId'], equals: id } },
            ],
          })),
        ],
      },
    });
    await prisma.groomSalaryPayment.deleteMany({ where: { groomId: { in: groomIds } } });
    await prisma.groomEngagement.deleteMany({ where: { groomId: { in: groomIds } } });
    await prisma.groom.deleteMany({ where: { id: { in: groomIds } } });
    await prisma.riderSalaryPayment.deleteMany({ where: { riderId: { in: riderIds } } });
    await prisma.rider.deleteMany({ where: { id: { in: riderIds } } });
  }, 'payroll fixtures');
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: playerIds } } }), 'notifications');
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: playerIds } } }), 'ledger');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: playerIds } } }), 'players');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: staffScope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: staffScope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: staffScope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: staffScope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: staffScope() } }), 'staff users');
});

afterAll(async () => {
  if (savedCommitSha === undefined) {
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
  } else {
    process.env.RAILWAY_GIT_COMMIT_SHA = savedCommitSha;
  }
  await cleanup.run();
}, 60_000);

beforeEach(async () => {
  process.env.RAILWAY_GIT_COMMIT_SHA = 'beef000000000000000000000000000000000001';
  startEmailCapture();
  if (!owner) {
    owner = await staff.makeUser('owner');
    ownerDevice = await checkIn(owner);
  }
});
afterEach(() => stopEmailCapture());

describe('who may use the payroll and server tools (q158)', () => {
  it('only the owner holds them; admins, moderators and players do not', () => {
    for (const cap of ['payroll.diagnose', 'server.health.view']) {
      expect(hasCapability('owner', cap)).toBe(true);
      for (const role of ['admin', 'moderator', 'user']) {
        expect(hasCapability(role, cap)).toBe(false);
      }
    }
  });

  it('every route refuses an admin and a moderator, hides from a player, and asks the owner to check in', async () => {
    const player = await makePlayer(1000);
    const groom = await makeGroom(player.id, 'rookie');
    await recordPayrollFailure({
      staffType: 'groom',
      staffId: groom.id,
      userId: player.id,
      source: 'weeklySettlement',
      weekStart: thisWeek(),
      weekKey: gameDateKey(thisWeek()),
      message: 'fixture failure',
    });
    const failureId = await failureIdFor('groom', groom.id, 'weeklySettlement');
    const before = await groomSnapshot(player.id, groom.id);
    const reads = [
      `${api}/staff?type=groom`,
      `${api}/groom/${groom.id}/failures`,
      `${api}/groom/${groom.id}/diagnose`,
      health,
    ];
    const writes = [
      `${api}/groom/${groom.id}/failures/${failureId}/test-run`,
      `${api}/groom/${groom.id}/failures/${failureId}/rerun`,
    ];
    for (const role of ['admin', 'moderator']) {
      const steward = await staff.makeUser(role);
      const device = await checkIn(steward);
      for (const url of reads) {
        const res = await get(url, steward, device);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe(capabilityRequiredCode);
      }
      for (const url of writes) {
        const res = await post(url, steward, {}, device);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe(capabilityRequiredCode);
      }
    }
    const plain = await staff.makeUser('user');
    for (const url of reads) {
      expect((await get(url, plain)).status).toBe(404);
    }
    for (const url of writes) {
      expect((await post(url, plain, {})).status).toBe(404);
    }
    // The owner herself, without the emailed check-in on this browser.
    for (const url of reads) {
      const res = await get(url, owner);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(checkinRequiredCode);
    }
    for (const url of writes) {
      const res = await post(url, owner, {});
      expect(res.status).toBe(403);
      expect(res.body.code).toBe(checkinRequiredCode);
    }
    expect(await groomSnapshot(player.id, groom.id)).toEqual(before);
    expect(await toolRows('groom', groom.id)).toHaveLength(0);
  }, 120_000);
});

const lastWeek = () => startOfGameDayIndex(gameDayIndex(thisWeek()) - 7);

/** Record a failure the way the payroll passes do, with a real thrown error. */
async function logFailure(staffType, staffId, userId, source, error = new Error('fixture: the pass failed')) {
  await recordPayrollFailure({
    staffType,
    staffId,
    userId,
    source,
    weekStart: thisWeek(),
    weekKey: gameDateKey(thisWeek()),
    error,
  });
  return failureIdFor(staffType, staffId, source);
}

describe('failures are recorded per groom and rider when a pass fails', () => {
  it('a groom the settlement cannot release (the player let them go mid-pass) is recorded, with stack and commit', async () => {
    const player = await makePlayer(1000);
    const groom = await makeGroom(player.id, 'rookie');
    // The pass read the groom on the player's staff, unpaid since last week; the
    // player then released them before the settlement's write.
    await prisma.groom.update({ where: { id: groom.id }, data: { userId: null } });

    await handleUnpaidFees(
      player.id,
      [{ groom: { ...groom, userId: player.id, feeUnpaidSince: lastWeek() }, salary: 100 }],
      thisWeek(),
      { onFailure: groomPayrollFailureRecorder('weeklySettlement', thisWeek()) },
    );

    const rows = await failureRows('groom', groom.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].errorMessage).toContain('no longer on user');
    expect(rows[0].summary).toMatchObject({
      staffType: 'groom',
      staffId: groom.id,
      userId: player.id,
      source: 'weeklySettlement',
      weekKey: gameDateKey(thisWeek()),
      commitSha: process.env.RAILWAY_GIT_COMMIT_SHA,
    });
    expect(rows[0].summary.stack).toContain('groomEngagementService.mjs');

    // Its test run finds nothing left to do: the groom is no longer on that staff.
    const testRun = await post(`${api}/groom/${groom.id}/failures/${rows[0].id}/test-run`, owner, {}, ownerDevice);
    expect(testRun.body.testRun).toMatchObject({ passed: true, outcome: 'noLongerOnStaff' });
  }, 60_000);

  it('a rider the settlement cannot send away (already off the roster) is recorded', async () => {
    const player = await makePlayer(1000);
    const rider = await makeRider(player.id, 'rookie');
    await prisma.rider.update({ where: { id: rider.id }, data: { userId: null } });

    await handleUnpaidRiders(
      player.id,
      [{ ...rider, userId: player.id, weeklyRate: 100, feeUnpaidSince: lastWeek() }],
      thisWeek(),
      { onFailure: riderPayrollFailureRecorder('weeklySettlement', thisWeek()) },
    );

    const rows = await failureRows('rider', rider.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].errorMessage).toContain('no longer on user');
    expect(rows[0].summary).toMatchObject({ source: 'weeklySettlement', userId: player.id });
  }, 60_000);
});

describe('search, failures and Diagnose', () => {
  it('the owner finds the groom by name and sees its logged failures', async () => {
    const player = await makePlayer(1000);
    const groom = await makeGroom(player.id, 'rookie');
    await logFailure('groom', groom.id, player.id, 'weeklySettlement');

    const search = await get(`${api}/staff?type=groom&q=${encodeURIComponent(groom.name)}`, owner, ownerDevice);
    expect(search.status).toBe(200);
    expect(search.body.staff).toEqual([
      expect.objectContaining({ id: groom.id, name: groom.name, failureCount: 1, onStaff: true }),
    ]);
    const recent = await get(`${api}/staff?type=groom`, owner, ownerDevice);
    expect(recent.body.staff.map(s => s.id)).toContain(groom.id);

    const failures = await get(`${api}/groom/${groom.id}/failures`, owner, ownerDevice);
    expect(failures.status).toBe(200);
    expect(failures.body.failures).toEqual([expect.objectContaining({ source: 'weeklySettlement', replayable: true })]);
    expect(failures.body.rerunReadyFailureId).toBeNull();
    expect((await get(`${api}/horse/${groom.id}/failures`, owner, ownerDevice)).status).toBe(400);
  }, 60_000);

  it('the report names the groom, each failure, its stack files and the commit, and never a secret', async () => {
    const player = await makePlayer(1000);
    const groom = await makeGroom(player.id, 'rookie');
    const secretSetting = `zz-${randomBytes(12).toString('hex')}`;
    process.env.BRH8C_FIXTURE_API_TOKEN = secretSetting;
    try {
      await logFailure(
        'groom',
        groom.id,
        player.id,
        'manualPayroll',
        new Error(
          `Cannot charge ${player.email} from 203.0.113.9 via postgresql://equoria:hunter2@db.internal:5432/equoria with Bearer abc.def.ghi password=hunter2 key ${secretSetting}`,
        ),
      );

      const res = await get(`${api}/groom/${groom.id}/diagnose`, owner, ownerDevice);

      expect(res.status).toBe(200);
      const { report, commitSha } = res.body.diagnosis;
      expect(commitSha).toBe(process.env.RAILWAY_GIT_COMMIT_SHA);
      expect(report).toContain(`groom ${groom.id}`);
      expect(report).toContain(process.env.RAILWAY_GIT_COMMIT_SHA);
      expect(report).toContain('Cannot charge [email removed]');
      expect(report).toContain('backend/__tests__/payrollDiagnosticsAuthz.integration.test.mjs');
      expect(report).toContain("Owner's manual groom payday");
      for (const leak of [player.email, '203.0.113.9', 'hunter2', 'db.internal', 'abc.def.ghi', secretSetting]) {
        expect(report).not.toContain(leak);
      }
    } finally {
      delete process.env.BRH8C_FIXTURE_API_TOKEN;
    }
  }, 60_000);
});

describe('Test run and Re-run: the weekly settlement', () => {
  it('a test run persists nothing; Re-run waits for a passed test run on this commit and runs once', async () => {
    const player = await makePlayer(1000);
    const groom = await makeGroom(player.id, 'rookie');
    const failureId = await logFailure('groom', groom.id, player.id, 'weeklySettlement');
    const url = `${api}/groom/${groom.id}/failures/${failureId}`;
    const actor = { id: owner.id, role: 'owner' };
    const untouched = await groomSnapshot(player.id, groom.id);

    // Not fixed yet: the test run fails inside its transaction, is recorded, changes nothing.
    const failing = await testRunPayrollFailure('groom', groom.id, failureId, {
      actor,
      afterReplay: async () => {
        throw new Error('fixture: still broken');
      },
    });
    expect(failing).toMatchObject({ passed: false });
    expect((await failureRows('groom', groom.id)).map(r => r.summary.source)).toEqual(['weeklySettlement', 'testRun']);
    expect(await groomSnapshot(player.id, groom.id)).toEqual(untouched);
    const locked = await post(`${url}/rerun`, owner, {}, ownerDevice);
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe('testRunRequired');

    // Fixed: the test run passes, says what would happen, and is undone.
    const passing = await post(`${url}/test-run`, owner, {}, ownerDevice);
    expect(passing.body.testRun).toMatchObject({ passed: true, outcome: 'cannotWork', amount: 0 });
    expect(await groomSnapshot(player.id, groom.id)).toEqual(untouched);
    const ready = await get(`${api}/groom/${groom.id}/failures`, owner, ownerDevice);
    expect(ready.body.rerunReadyFailureId).toBe(failureId);

    // A new deploy locks Re-run again.
    process.env.RAILWAY_GIT_COMMIT_SHA = 'beef000000000000000000000000000000000002';
    const stale = await post(`${url}/rerun`, owner, {}, ownerDevice);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('testRunStale');
    expect(await groomSnapshot(player.id, groom.id)).toEqual(untouched);

    expect((await post(`${url}/test-run`, owner, {}, ownerDevice)).body.testRun.passed).toBe(true);
    const rerun = await post(`${url}/rerun`, owner, {}, ownerDevice);
    expect(rerun.status).toBe(200);
    expect(rerun.body.result).toMatchObject({ outcome: 'cannotWork' });
    const settled = await groomSnapshot(player.id, groom.id);
    expect(settled.groom.feeUnpaidSince?.getTime()).toBe(thisWeek().getTime());
    expect(settled.payments.map(p => [p.status, p.weekKey])).toEqual([
      ['missedInsufficientFunds', gameDateKey(thisWeek())],
    ]);
    expect(settled.user.money).toBe(untouched.user.money);

    // Idempotent: a second press is locked, and a fresh test run finds nothing to do.
    const again = await post(`${url}/rerun`, owner, {}, ownerDevice);
    expect(again.body.code).toBe('testRunRequired');
    const retest = await post(`${url}/test-run`, owner, {}, ownerDevice);
    expect(retest.body.testRun).toMatchObject({ passed: true, outcome: 'alreadySettled' });
    expect((await post(`${url}/rerun`, owner, {}, ownerDevice)).body.result.outcome).toBe('alreadySettled');
    expect(await groomSnapshot(player.id, groom.id)).toEqual(settled);

    expect((await toolRows('groom', groom.id)).map(r => [r.after.action, r.outcome])).toEqual([
      ['testRun', 'failed'],
      ['testRun', 'succeeded'],
      ['testRun', 'succeeded'],
      ['rerun', 'succeeded'],
      ['testRun', 'succeeded'],
      ['rerun', 'succeeded'],
    ]);
  }, 120_000);

  it('a rider settlement re-runs the same way', async () => {
    const player = await makePlayer(1000);
    const rider = await makeRider(player.id, 'rookie');
    const failureId = await logFailure('rider', rider.id, player.id, 'weeklySettlement');
    const url = `${api}/rider/${rider.id}/failures/${failureId}`;

    const testRun = await post(`${url}/test-run`, owner, {}, ownerDevice);
    expect(testRun.body.testRun).toMatchObject({ passed: true, outcome: 'cannotRide' });
    expect(await prisma.riderSalaryPayment.count({ where: { riderId: rider.id } })).toBe(0);

    const rerun = await post(`${url}/rerun`, owner, {}, ownerDevice);
    expect(rerun.body.result).toMatchObject({ outcome: 'cannotRide' });
    const rows = await prisma.riderSalaryPayment.findMany({ where: { riderId: rider.id } });
    expect(rows.map(r => [r.status, r.weekKey])).toEqual([['missed', gameDateKey(thisWeek())]]);
  }, 60_000);
});

describe("Test run and Re-run: the owner's manual payday", () => {
  it('pays the week once, in one transaction; a failed re-run moves nothing and locks again', async () => {
    const player = await makePlayer(1000);
    const groom = await makeGroom(player.id, 'rookie');
    const failureId = await logFailure('groom', groom.id, player.id, 'manualPayroll');
    const actor = { id: owner.id, role: 'owner' };
    const fixedState = await groomSnapshot(player.id, groom.id);

    const testRun = await testRunPayrollFailure('groom', groom.id, failureId, { actor });
    expect(testRun).toMatchObject({ passed: true, outcome: 'paid', amount: 100 });
    expect(await groomSnapshot(player.id, groom.id)).toEqual(fixedState);

    // A failure inside the re-run's transaction rolls the payment back.
    await expect(
      rerunPayrollFailure('groom', groom.id, failureId, {
        actor,
        afterReplay: async () => {
          throw new Error('fixture: the database went away mid re-run');
        },
      }),
    ).rejects.toMatchObject({ code: 'rerunFailed' });
    expect(await groomSnapshot(player.id, groom.id)).toEqual(fixedState);
    expect((await failureRows('groom', groom.id)).at(-1).summary).toMatchObject({
      source: 'rerun',
      detail: { failureId },
    });
    await expect(rerunPayrollFailure('groom', groom.id, failureId, { actor })).rejects.toMatchObject({
      code: 'testRunRequired',
    });

    await testRunPayrollFailure('groom', groom.id, failureId, { actor });
    const result = await rerunPayrollFailure('groom', groom.id, failureId, { actor });
    expect(result).toMatchObject({ outcome: 'paid', amount: 100 });
    const paid = await groomSnapshot(player.id, groom.id);
    expect(paid.user.money).toBe(fixedState.user.money - 100);
    expect(paid.payments.filter(p => p.status === 'paid')).toHaveLength(1);

    // The same week again: nothing more is taken.
    const retest = await testRunPayrollFailure('groom', groom.id, failureId, { actor });
    expect(retest.outcome).toBe('alreadyPaid');
    await rerunPayrollFailure('groom', groom.id, failureId, { actor });
    expect(await groomSnapshot(player.id, groom.id)).toEqual(paid);
  }, 90_000);
});

describe("the server's memory and speed", () => {
  it('the owner reads it in plain words with a copyable report; an admin is refused', async () => {
    const secretSetting = `zz-${randomBytes(12).toString('hex')}`;
    process.env.BRH8C_FIXTURE_SECRET = secretSetting;
    try {
      // One timed request first, so the speed list has a route in it.
      await get(`${api}/staff?type=rider`, owner, ownerDevice);
      const res = await get(health, owner, ownerDevice);
      expect(res.status).toBe(200);
      const { memory, speed, report } = res.body.health;
      expect(memory.usedMb).toBeGreaterThan(0);
      expect(memory.percentUsed).toBeGreaterThan(0);
      expect(speed.requests).toBeGreaterThan(0);
      expect(speed.slowestRoutes.map(r => r.route)).toContain('GET /api/v1/staff/payroll/staff');
      expect(report).toContain('## Memory');
      expect(report).toContain('Slowest routes');
      expect(report).not.toContain(secretSetting);
      expect(report).not.toMatch(/\?type=/);

      const admin = await staff.makeUser('admin');
      const device = await checkIn(admin);
      expect((await get(health, admin, device)).status).toBe(403);
    } finally {
      delete process.env.BRH8C_FIXTURE_SECRET;
    }
  }, 60_000);
});
