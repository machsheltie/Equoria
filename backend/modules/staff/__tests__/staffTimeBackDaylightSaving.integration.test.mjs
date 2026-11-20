/**
 * Outage time-back across the Eastern clock changes (Equoria-puj1e.5, Codex r2
 * #4/#5/#8, docs/features/admin-time-back.md) — real HTTP, real DB, the
 * Owner's real fresh codes. Nothing is mocked.
 *
 * Game time is Eastern (owner ruling 2026-10-09). In 2026 the clocks spring
 * forward on Sunday 8 March (02:00 EST becomes 03:00 EDT, so 02:xx never
 * happens) and go back on Sunday 1 November (02:00 EDT becomes 01:00 EST, so
 * 01:xx happens twice).
 *
 * - A window time that never happened is refused; one that happened twice is
 *   refused unless the Owner says which, and the pause is real elapsed time.
 * - Weekly-bucketed unpaid fees move by whole Eastern calendar weeks, keeping
 *   their Eastern wall-clock time: a Sunday-to-Sunday week across spring-forward
 *   is one week, though only 167 hours long.
 * - Undo lists every row it skipped, including one play set back to exactly its
 *   pre-time-back value.
 *
 * The applied window (8–15 March 2026) is clear of the other time-back suites'
 * windows (the last three weeks). Apply moves every matching row in the shared
 * database, so the suite always undoes what it applied (the undo test, and the
 * afterAll safety net if a test failed first).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { URLSearchParams } from 'node:url';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { parseWindow, undoTimeBack } from '../services/timeBackService.mjs';
import { windowParams } from '../services/timeBackRules.mjs';
import {
  checkIn,
  createUserFactory,
  get,
  post,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import {
  actionCodesFor,
  freshCode,
  gameWideSuiteLock,
  gameWideSuiteWaitMs,
  restoreHold,
  snapshotHold,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbdst');
const hour = 3_600_000;
const APPLY = `${staffApi}/time-back/apply`;
const skippedWords =
  "That time doesn't exist on the night the clocks spring forward; pick a time outside 2:00–3:00 a.m.";

const preview = (query, user, device) =>
  get(`${staffApi}/time-back/preview?${new URLSearchParams(query)}`, user, device);

// One whole bank week across spring-forward: 7 game days, 167 elapsed hours.
const springWeek = { start: '2026-03-08T00:00', end: '2026-03-15T00:00' };
// Unpaid at 01:00 EST on the spring-forward night (before the clocks change):
// a week on is 01:00 EDT on 15 March, 167 hours later.
const riderUnpaid = new Date('2026-03-08T06:00:00.000Z');
const riderMoved = new Date('2026-03-15T05:00:00.000Z');
// Unpaid at 12:00 EDT on 10 March: a week on is 12:00 EDT on 17 March.
const groomUnpaid = new Date('2026-03-10T16:00:00.000Z');
const groomMoved = new Date('2026-03-17T16:00:00.000Z');

let holdBefore;
let owner;
let device;
let applied;
const made = { riderId: null, groomId: null };

const suiteLock = gameWideSuiteLock();
// First: one game-wide suite at a time (gameWideSuiteLock).
beforeAll(() => suiteLock.take(), gameWideSuiteWaitMs);

beforeAll(async () => {
  holdBefore = await snapshotHold();
  const scope = () => ({ in: createdUserIds });
  cleanup.add(() => restoreHold(holdBefore), 'job hold');
  cleanup.add(async () => {
    const ids = (await prisma.timeBack.findMany({ where: { appliedById: scope() }, select: { id: true } })).map(
      r => r.id,
    );
    await prisma.timeBackChange.deleteMany({ where: { timeBackId: { in: ids } } });
    await prisma.timeBack.deleteMany({ where: { id: { in: ids } } });
  }, 'time-backs');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: made.groomId ?? -1 } }), 'groom');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: made.riderId ?? -1 } }), 'rider');
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

  const rider = await prisma.rider.create({
    data: {
      firstName: 'TestFixture',
      lastName: `tb-dst-${uid()}`,
      personality: 'methodical',
      feeUnpaidSince: riderUnpaid,
    },
  });
  made.riderId = rider.id;
  const groom = await prisma.groom.create({
    data: {
      name: `TestFixture-tb-dst-${uid()}`,
      speciality: 'foalCare',
      personality: 'calm',
      feeUnpaidSince: groomUnpaid,
    },
  });
  made.groomId = groom.id;
}, 120_000);

// Safety net: never leave a time-back applied in the shared database.
afterAll(async () => {
  const open = await prisma.timeBack.findMany({
    where: { appliedById: { in: createdUserIds }, reversedAt: null },
    select: { id: true },
  });
  if (open.length > 0) {
    startEmailCapture();
    for (const { id } of open) {
      await requestFreshCode(owner, 'timeBackUndo');
      const proof = await checkFreshCode(owner, 'timeBackUndo', actionCodesFor(owner.email).at(-1));
      await undoTimeBack({ actor: owner, timeBackId: id, proof });
    }
    stopEmailCapture();
  }
  await cleanup.run();
}, 120_000);

// Last: the next game-wide suite may start.
afterAll(() => suiteLock.release());

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

describe('Outage window times on the nights the Eastern clocks change', () => {
  it('refuses a time the clocks skip, in plain words, at either end', async () => {
    for (const query of [
      { start: '2026-03-08T02:30', end: '2026-03-08T04:00' },
      { start: '2026-03-08T01:00', end: '2026-03-08T02:00' },
    ]) {
      const res = await preview(query, owner, device);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('timeBackTimeSkipped');
      expect(res.body.message).toBe(skippedWords);
    }
    const code = await freshCode(owner, device, 'timeBackApply');
    const res = await post(APPLY, owner, { start: '2026-03-08T02:30', end: '2026-03-08T04:00', code }, device);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('timeBackTimeSkipped');
  }, 60_000);

  it('measures a spring-forward window in real elapsed time', async () => {
    // 01:30 EST to 04:00 EDT: 2.5 hours on the wall, 1.5 hours elapsed.
    const across = await preview({ start: '2026-03-08T01:30', end: '2026-03-08T04:00' }, owner, device);
    expect(across.status).toBe(200);
    expect(across.body.data.pauseSeconds).toBe(1.5 * 3600);
    // Codex's example, entered as times that exist: 03:30 to 04:00 EDT is half an hour.
    const after = await preview({ start: '2026-03-08T03:30', end: '2026-03-08T04:00' }, owner, device);
    expect(after.status).toBe(200);
    expect(after.body.data.pauseSeconds).toBe(0.5 * 3600);
  }, 60_000);

  it('refuses a time that happens twice until the Owner says which', async () => {
    const window = { start: '2026-11-01T01:15', end: '2026-11-01T02:15' };
    for (const query of [window, { ...window, startOccurrence: 'third' }]) {
      const res = await preview(query, owner, device);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('timeBackTimeAmbiguous');
    }
    const code = await freshCode(owner, device, 'timeBackApply');
    const res = await post(APPLY, owner, { ...window, code }, device);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('timeBackTimeAmbiguous');
    // An end time that happens twice needs its own choice.
    const endTwice = await preview({ start: '2026-11-01T00:30', end: '2026-11-01T01:45' }, owner, device);
    expect(endTwice.status).toBe(400);
    expect(endTwice.body.code).toBe('timeBackTimeAmbiguous');
  }, 60_000);

  it('gives back the real elapsed time for each choice of a time that happens twice', async () => {
    const window = { start: '2026-11-01T01:15', end: '2026-11-01T02:15' };
    // Codex's example: the second 01:15 (EST) to 02:15 EST is one hour.
    const second = await preview({ ...window, startOccurrence: 'second' }, owner, device);
    expect(second.status).toBe(200);
    expect(second.body.data.pauseSeconds).toBe(3600);
    expect(new Date(second.body.data.windowStart)).toEqual(new Date('2026-11-01T06:15:00.000Z'));
    expect(new Date(second.body.data.windowEnd)).toEqual(new Date('2026-11-01T07:15:00.000Z'));
    // The first 01:15 (EDT) to 02:15 EST is two hours.
    const first = await preview({ ...window, startOccurrence: 'first' }, owner, device);
    expect(first.status).toBe(200);
    expect(first.body.data.pauseSeconds).toBe(2 * 3600);
    expect(new Date(first.body.data.windowStart)).toEqual(new Date('2026-11-01T05:15:00.000Z'));
    // Both ends in the doubled hour: first 01:10 to second 01:50 is 1 h 40 min.
    const both = parseWindow({
      start: '2026-11-01T01:10',
      startOccurrence: 'first',
      end: '2026-11-01T01:50',
      endOccurrence: 'second',
    });
    expect(both.pauseMs).toBe(hour + 40 * 60_000);
    // A choice on a time that happens once changes nothing.
    const plain = parseWindow({ start: '2026-11-01T03:00', startOccurrence: 'first', end: '2026-11-01T04:00' });
    expect(plain.pauseMs).toBe(hour);
  }, 60_000);
});

describe('Weekly unpaid fees across spring-forward, and undo’s skipped list', () => {
  it('counts days and whole weeks on the Eastern clock, not in elapsed hours', () => {
    const params = input => windowParams(parseWindow(input));
    // Sunday to Sunday across spring-forward: one week, though only 167 hours.
    expect(params(springWeek).weeks).toBe(1);
    expect(params({ ...springWeek, end: '2026-03-14T23:59' }).weeks).toBe(0);
    // Saturday 00:00 to Sunday 12:30 across spring-forward is 1.5 game days
    // (35.5 hours elapsed): calendar dates move 2 days.
    expect(params({ start: '2026-03-07T00:00', end: '2026-03-08T12:30' }).days).toBe(2);
  });

  it('counts a Sunday-to-Sunday week across spring-forward as one week', async () => {
    const res = await preview(springWeek, owner, device);
    expect(res.status).toBe(200);
    expect(res.body.data.pauseSeconds).toBe(167 * 3600);
    expect(res.body.data.pauseDays).toBe(7);
    expect(res.body.data.fields['Rider.feeUnpaidSince']).toBeGreaterThanOrEqual(1);
    expect(res.body.data.fields['Groom.feeUnpaidSince']).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('moves unpaid fees one Eastern calendar week, keeping their Eastern time of day', async () => {
    expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
    const code = await freshCode(owner, device, 'timeBackApply');
    const res = await post(APPLY, owner, { ...springWeek, code }, device);
    expect(res.status).toBe(200);
    applied = res.body.data;
    expect(applied.pauseSeconds).toBe(167 * 3600);

    const rider = await prisma.rider.findUnique({ where: { id: made.riderId } });
    expect(rider.feeUnpaidSince).toEqual(riderMoved);
    const groom = await prisma.groom.findUnique({ where: { id: made.groomId } });
    expect(groom.feeUnpaidSince).toEqual(groomMoved);
  }, 120_000);

  it('undo lists a row that play set back to exactly its old value', async () => {
    expect(applied?.id).toBeDefined();
    // Play: the groom's fee is paid, then goes unpaid at the very instant it had before.
    await prisma.groom.update({ where: { id: made.groomId }, data: { feeUnpaidSince: groomUnpaid } });

    const undoUrl = `${staffApi}/time-back/${applied.id}/undo`;
    const res = await post(undoUrl, owner, { code: await freshCode(owner, device, 'timeBackUndo') }, device);
    expect(res.status).toBe(200);
    const summary = res.body.data.reverseSummary;
    expect(summary.skipped['Groom.feeUnpaidSince']).toBeGreaterThanOrEqual(1);
    expect(summary.skippedRows['Groom.feeUnpaidSince']).toContain(String(made.groomId));
    // A restored row is never listed as skipped.
    expect(summary.restored['Rider.feeUnpaidSince']).toBeGreaterThanOrEqual(1);
    expect(summary.skippedRows['Rider.feeUnpaidSince'] ?? []).not.toContain(String(made.riderId));

    expect((await prisma.rider.findUnique({ where: { id: made.riderId } })).feeUnpaidSince).toEqual(riderUnpaid);
    expect((await prisma.groom.findUnique({ where: { id: made.groomId } })).feeUnpaidSince).toEqual(groomUnpaid);
  }, 120_000);
});
