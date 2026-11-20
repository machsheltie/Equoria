/**
 * Outage time-back and a foal's final development day (Equoria-oyayo, owner
 * ruling q391, 2026-11-20): "After an outage, if a foal finished its last
 * development day during the outage, should it stay finished when you give the
 * time back?" — "Set it back and let the final day run again."
 *
 * Real HTTP apply and undo with the Owner's real fresh codes, then the real
 * nightly foal pass (cronJobService.evaluateFoalTraits, exactly as the nightly
 * evaluateDailyFoalTraits issues it for each foal) against the real test
 * database. Nothing is mocked.
 *
 * Window: from 3 days ago to 1 day ago (a 2-day pause), in Eastern wall time.
 *
 * - finishedInWindow: final day evaluated inside the outage. The time-back sets
 *   it back (not finished), and the next nightly pass evaluates the final day
 *   again. Before the fix it stayed finished and the pass skipped it.
 * - untouchedInWindow: the same, but no pass runs before undo, so undo puts its
 *   original finish time back.
 * - finishedBefore: final day evaluated before the outage. It stays finished
 *   (the time moves by the pause) and the pass still skips it.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import cronJobService from '../../../services/cronJobs.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { undoTimeBack } from '../services/timeBackService.mjs';
import {
  checkIn,
  createUserFactory,
  post,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
  uid,
} from './helpers/staffFixtures.mjs';
import {
  actionCodesFor,
  easternWall,
  freshCode,
  gameWideSuiteLock,
  gameWideSuiteWaitMs,
  restoreHold,
  snapshotHold,
  toMinute,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbfoal');
const day = 86_400_000;
const pauseMs = 2 * day;

const now = Date.now();
const S = toMinute(now - 3 * day);
const E = toMinute(now - day);
const windowBody = { start: easternWall(S), end: easternWall(E) };
const plus = (date, ms) => new Date(date.getTime() + ms);
const inWindowFinish = plus(S, 3_600_000);
const beforeWindowFinish = plus(S, -day);

let holdBefore;
let owner;
let device;
const madeHorses = [];
let finishedInWindow;
let untouchedInWindow;
let finishedBefore;
let applied;

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
  cleanup.add(() => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: madeHorses } } }), 'development');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: madeHorses } } }), 'horses');
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
  const player = await makeUser('user');

  // A foal `daysOld` Eastern game days old whose day 6 was evaluated at `finishedAt`.
  const finishedFoal = async (daysOld, finishedAt) => {
    const row = await prisma.horse.create({
      data: await testHorseData(prisma, {
        name: `TestFixture-tbfoal-${uid()}`,
        sex: 'Filly',
        age: 1,
        dateOfBirth: gameCalendarDate(new Date(now), -daysOld),
        userId: player.id,
      }),
    });
    madeHorses.push(row.id);
    await prisma.foalDevelopment.create({
      data: { foalId: row.id, currentDay: 6, finalDayEvaluatedAt: finishedAt },
    });
    return row;
  };
  // Seven days old at the outage start: its final day was due and evaluated inside it.
  finishedInWindow = await finishedFoal(10, inWindowFinish);
  untouchedInWindow = await finishedFoal(10, inWindowFinish);
  // Finished the day before the outage began.
  finishedBefore = await finishedFoal(12, beforeWindowFinish);
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

const reloadDev = foalId => prisma.foalDevelopment.findUnique({ where: { foalId } });
const loadFoal = foalId => prisma.horse.findUnique({ where: { id: foalId }, include: { foalDevelopment: true } });
/** One nightly pass for one foal, exactly as evaluateDailyFoalTraits issues it. */
const nightlyPass = async foalId => cronJobService.evaluateFoalTraits(await loadFoal(foalId));
const finalDayKey = 'FoalDevelopment.finalDayEvaluatedAt';

describe('Outage time-back sets back a foal that finished during the outage (q391)', () => {
  it('apply sets back a foal that finished inside the outage; one that finished before stays finished', async () => {
    expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
    const code = await freshCode(owner, device, 'timeBackApply');
    const res = await post(`${staffApi}/time-back/apply`, owner, { ...windowBody, code }, device);
    expect(res.status).toBe(200);
    applied = res.body.data;
    expect(applied.summary.fields[finalDayKey]).toBeGreaterThanOrEqual(3);

    for (const foal of [finishedInWindow, untouchedInWindow]) {
      const dev = await reloadDev(foal.id);
      expect(dev.finalDayEvaluatedAt).toBeNull();
      expect(dev.currentDay).toBe(6);
      // Recorded like every other change, so undo can put it back.
      const changes = await prisma.timeBackChange.findMany({
        where: {
          timeBackId: applied.id,
          tableName: 'foal_development',
          rowId: String(dev.id),
          field: 'finalDayEvaluatedAt',
        },
      });
      expect(changes).toHaveLength(1);
      expect(new Date(`${changes[0].oldValue}Z`)).toEqual(inWindowFinish);
      expect(changes[0].newValue).toBeNull();
    }
    expect((await reloadDev(finishedBefore.id)).finalDayEvaluatedAt).toEqual(plus(beforeWindowFinish, pauseMs));
  }, 120_000);

  it('the next nightly pass evaluates the final day again, once; a foal finished before stays skipped', async () => {
    expect(applied?.id).toBeDefined();
    expect((await post(`${staffApi}/jobs/release`, owner, {}, device)).status).toBe(200);

    const rerun = await nightlyPass(finishedInWindow.id);
    expect(rerun.reason).toBe('noNewTraits');
    const dev = await reloadDev(finishedInWindow.id);
    expect(dev.currentDay).toBe(6);
    expect(dev.finalDayEvaluatedAt).not.toBeNull();
    expect(new Date(dev.finalDayEvaluatedAt).getTime()).toBeGreaterThan(E.getTime());
    // Evaluated once: the following night it is finished again.
    expect(await nightlyPass(finishedInWindow.id)).toEqual({ traitsRevealed: 0, reason: 'developmentComplete' });
    expect(await reloadDev(finishedInWindow.id)).toEqual(dev);

    expect(await nightlyPass(finishedBefore.id)).toEqual({ traitsRevealed: 0, reason: 'developmentComplete' });
    expect((await reloadDev(finishedBefore.id)).finalDayEvaluatedAt).toEqual(plus(beforeWindowFinish, pauseMs));
  }, 60_000);

  it('undo restores untouched finish times and lists the one the nightly pass evaluated again', async () => {
    expect(applied?.id).toBeDefined();
    const rerunAt = (await reloadDev(finishedInWindow.id)).finalDayEvaluatedAt;
    const undoUrl = `${staffApi}/time-back/${applied.id}/undo`;
    const res = await post(undoUrl, owner, { code: await freshCode(owner, device, 'timeBackUndo') }, device);
    expect(res.status).toBe(200);
    const summary = res.body.data.reverseSummary;

    const untouched = await reloadDev(untouchedInWindow.id);
    expect(untouched.finalDayEvaluatedAt).toEqual(inWindowFinish);
    expect(untouched.currentDay).toBe(6);
    expect((await reloadDev(finishedBefore.id)).finalDayEvaluatedAt).toEqual(beforeWindowFinish);
    for (const foal of [finishedInWindow, untouchedInWindow, finishedBefore]) {
      expect((await prisma.horse.findUnique({ where: { id: foal.id } })).dateOfBirth).toEqual(foal.dateOfBirth);
    }
    expect(summary.restored[finalDayKey]).toBeGreaterThanOrEqual(2);
    // The final day ran again after the time-back, so undo leaves that and names the row.
    expect((await reloadDev(finishedInWindow.id)).finalDayEvaluatedAt).toEqual(rerunAt);
    expect(summary.skippedRows[finalDayKey]).toContain(String((await reloadDev(finishedInWindow.id)).id));
    expect(summary.skippedRows[finalDayKey] ?? []).not.toContain(String(untouched.id));
  }, 120_000);
});
