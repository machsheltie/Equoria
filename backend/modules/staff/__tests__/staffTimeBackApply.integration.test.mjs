/**
 * Outage time-back preview, apply and undo (Equoria-puj1e.5, owner rulings
 * q377/q378, docs/features/admin-time-back.md) — real HTTP, real DB, the
 * Owner's real fresh codes. Nothing is mocked.
 *
 * Apply moves every matching row in the database, not only this suite's
 * fixtures, so the suite always undoes what it applied (the undo test, and the
 * afterAll safety net if a test failed first): rows nobody touched in between
 * end exactly as they started.
 *
 * Window: from 3 days ago to 1 day ago (a 2-day pause), in Eastern wall time.
 *
 * Owner ruling q383 (2026-11-18): hunger, riders' free-agent time, rider
 * retirement notices, Hall of Fame voting rounds and a foal's final development
 * day get the time back like every other clock. (Rider unpaid fees move by
 * whole pay weeks, so the 7-day bank suite covers them.)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { undoTimeBack } from '../services/timeBackService.mjs';
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
  easternWall,
  freshCode,
  restoreHold,
  snapshotHold,
  toMinute,
} from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbapply');
const day = 86_400_000;
const pauseMs = 2 * day;
const APPLY = `${staffApi}/time-back/apply`;

const now = Date.now();
const S = toMinute(now - 3 * day);
const E = toMinute(now - day);
const windowBody = { start: easternWall(S), end: easternWall(E) };
const plus = (date, ms) => new Date(date.getTime() + ms);

let holdBefore;
let owner;
let device;
const made = { horses: [], groomId: null, showId: null, runLogId: null, riders: [], rounds: [] };
let foal;
let elder;
let ancient;
let applied;
// q383 fixtures: in each pair the first is restored by undo, the second is
// changed by play after apply and left alone.
let riderKept;
let riderRehired;
let roundKept;
let roundChanged;
let roundClosed;
// Far past every Hall of Fame suite's synthetic weeks, so no round runner closes it.
const farEnd = new Date(Date.UTC(2200, 0, 1));

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
  cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { id: made.runLogId ?? -1 } }), 'planted run');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: made.showId ?? -1 } }), 'show');
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: made.groomId ?? -1 } }), 'groom');
  cleanup.add(() => prisma.hallOfFameRound.deleteMany({ where: { id: { in: made.rounds } } }), 'rounds');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: made.riders } } }), 'riders');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: made.horses } } }), 'horses');
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

  const horse = async data => {
    const row = await prisma.horse.create({
      data: await testHorseData(prisma, { name: `TestFixture-tb-${uid()}`, userId: player.id, ...data }),
    });
    made.horses.push(row.id);
    return row;
  };
  // A five-day-old foal: groomed just before the outage, fed during it, a
  // training cooldown still ahead, shod after it.
  foal = await horse({
    sex: 'Filly',
    dateOfBirth: gameCalendarDate(new Date(now), -5),
    lastGroomed: plus(S, -3_600_000),
    lastFedDate: plus(S, 3_600_000),
    trainingCooldown: new Date(now + day),
    lastShod: new Date(now - 3_600_000),
    hungerSince: plus(S, -2 * day),
  });
  // Her final development day was evaluated during the outage (q383).
  await prisma.foalDevelopment.create({
    data: { foalId: foal.id, currentDay: 5, finalDayEvaluatedAt: plus(S, 3_600_000) },
  });
  // Turned 21 during the outage: goes back to 20. Her cooldown passed before it.
  elder = await horse({
    sex: 'Mare',
    age: 21,
    dateOfBirth: gameCalendarDate(new Date(now), -147),
    inFoalSinceDate: plus(S, -2 * day),
    trainingCooldown: plus(S, -day),
    hungerSince: plus(S, -day),
  });
  // Already 21 before the outage: never moves.
  ancient = await horse({ sex: 'Mare', age: 24, dateOfBirth: gameCalendarDate(new Date(now), -170) });
  await prisma.foalDevelopment.create({
    data: { foalId: ancient.id, currentDay: 6, finalDayEvaluatedAt: plus(S, -day) },
  });

  // On the player's staff (not in the hiring pool), each with a retirement notice.
  const rider = async (freeAgentSince, noticeSentAt) => {
    const row = await prisma.rider.create({
      data: {
        firstName: 'TestFixture',
        lastName: `tb-${uid()}`,
        personality: 'methodical',
        startAge: 20,
        userId: player.id,
        freeAgentSince,
        riderRetirementSchedule: { create: { retirementAge: 60, noticeSentAt } },
      },
    });
    made.riders.push(row.id);
    return row;
  };
  riderKept = await rider(plus(S, -day), plus(S, 3_600_000));
  riderRehired = await rider(plus(S, -2 * day), plus(S, -day));

  // Hall of Fame rounds that open after the outage began (no player sees them yet).
  const round = async data => {
    const row = await prisma.hallOfFameRound.create({
      data: { startsAt: new Date(now + day), endsAt: farEnd, ...data },
    });
    made.rounds.push(row.id);
    return row;
  };
  roundKept = await round({});
  roundChanged = await round({});
  roundClosed = await round({ closedAt: new Date(now) });

  const groom = await prisma.groom.create({
    data: {
      name: `TestFixture-tb-${uid()}`,
      speciality: 'foalCare',
      personality: 'calm',
      careerWeeks: 3,
      createdAt: plus(S, -day),
    },
  });
  made.groomId = groom.id;
  const run = await prisma.cronRunLog.create({
    data: {
      jobName: 'groomCareerProgression',
      startedAt: plus(S, 2 * 3_600_000),
      finishedAt: plus(S, 2 * 3_600_000 + 1000),
      status: 'success',
    },
  });
  made.runLogId = run.id;
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-tb-${uid()}${uid()}`,
      discipline: 'Dressage',
      runDate: new Date(now + 7 * day),
      prize: 100,
      entryFee: 10,
      levelMin: 1,
      levelMax: 10,
      status: 'open',
    },
  });
  made.showId = show.id;
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

beforeEach(() => startEmailCapture());

afterEach(() => stopEmailCapture());

const reload = id => prisma.horse.findUnique({ where: { id } });
const reloadDev = foalId => prisma.foalDevelopment.findUnique({ where: { foalId } });
const reloadRider = id => prisma.rider.findUnique({ where: { id }, include: { riderRetirementSchedule: true } });
const reloadRound = id => prisma.hallOfFameRound.findUnique({ where: { id } });
const newClocks = [
  'Horse.hungerSince',
  'FoalDevelopment.finalDayEvaluatedAt',
  'Rider.freeAgentSince',
  'RiderRetirementSchedule.noticeSentAt',
  'HallOfFameRound.startsAt',
  'HallOfFameRound.endsAt',
];

describe('Outage time-back (Owner, fresh code each time)', () => {
  it('preview names what would change and writes nothing', async () => {
    const before = await Promise.all(made.horses.map(reload));
    const res = await get(
      `${staffApi}/time-back/preview?start=${windowBody.start}&end=${windowBody.end}`,
      owner,
      device,
    );
    expect(res.status).toBe(200);
    const preview = res.body.data;
    expect(preview.pauseSeconds).toBe(pauseMs / 1000);
    expect(preview.pauseDays).toBe(2);
    expect(preview.fields['Horse.lastGroomed']).toBeGreaterThanOrEqual(1);
    expect(preview.fields['Horse.dateOfBirth']).toBeGreaterThanOrEqual(2);
    expect(preview.fields['Groom.careerWeeks']).toBeGreaterThanOrEqual(1);
    expect(preview.horsesUnretired).toBeGreaterThanOrEqual(1);
    expect(preview.jobRuns).toEqual(
      expect.arrayContaining([expect.objectContaining({ jobName: 'groomCareerProgression' })]),
    );
    // q383: the newer clocks are counted as moved; nothing is left unruled.
    for (const key of newClocks) {
      expect(preview.fields[key]).toBeGreaterThanOrEqual(key.startsWith('HallOfFame') ? 2 : 1);
    }
    expect(preview.unruledFields).toEqual([]);
    expect(await Promise.all(made.horses.map(reload))).toEqual(before);
    expect(await prisma.timeBack.count({ where: { appliedById: owner.id } })).toBe(0);
  }, 60_000);

  it('refuses without a hold, with a future end and over 30 days, and spends no code', async () => {
    const code = await freshCode(owner, device, 'timeBackApply');
    const unheld = await post(APPLY, owner, { ...windowBody, code }, device);
    expect(unheld.status).toBe(409);
    expect(unheld.body.code).toBe('timeBackJobsNotHeld');

    expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
    const future = await post(
      APPLY,
      owner,
      { start: easternWall(toMinute(now - 3_600_000)), end: easternWall(toMinute(now + 3 * 3_600_000)), code },
      device,
    );
    expect(future.status).toBe(400);
    expect(future.body.code).toBe('timeBackEndInFuture');
    const long = await post(
      APPLY,
      owner,
      { start: easternWall(toMinute(now - 40 * day)), end: windowBody.end, code },
      device,
    );
    expect(long.status).toBe(400);
    expect(long.body.code).toBe('timeBackWindowTooLong');

    expect(await prisma.timeBack.count({ where: { appliedById: owner.id } })).toBe(0);
    expect(
      await prisma.staffCheckinCode.count({
        where: { userId: owner.id, purpose: 'timeBackApply', usedAt: { not: null } },
      }),
    ).toBe(0);
  }, 60_000);

  it('applies every rule once, consumes the code, logs it, and refuses a replay and an overlap', async () => {
    const code = await freshCode(owner, device, 'timeBackApply');
    const res = await post(APPLY, owner, { ...windowBody, code }, device);
    expect(res.status).toBe(200);
    applied = res.body.data;
    expect(applied.pauseSeconds).toBe(pauseMs / 1000);

    const [f, el, an] = await Promise.all([foal.id, elder.id, ancient.id].map(reload));
    // Rule 1: past events move by the pause; one inside the window lands on its end.
    expect(f.dateOfBirth).toEqual(new Date(foal.dateOfBirth.getTime() + 2 * day));
    expect(f.lastGroomed).toEqual(plus(foal.lastGroomed, pauseMs));
    expect(f.lastFedDate).toEqual(E);
    expect(f.lastShod).toEqual(foal.lastShod);
    expect(el.inFoalSinceDate).toEqual(plus(elder.inFoalSinceDate, pauseMs));
    // Rule 2: a deadline still ahead moves; one already passed stays passed.
    expect(f.trainingCooldown).toEqual(plus(foal.trainingCooldown, pauseMs));
    expect(el.trainingCooldown).toEqual(elder.trainingCooldown);
    // A horse that turned 21 inside the window is 20 again; one 21 before it is untouched.
    expect(el.dateOfBirth).toEqual(new Date(elder.dateOfBirth.getTime() + 2 * day));
    expect(el.age).toBe(20);
    expect(an.dateOfBirth).toEqual(ancient.dateOfBirth);
    expect(an.age).toBe(24);
    // Derived and job counters.
    expect((await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } })).currentDay).toBe(3);
    expect((await prisma.groom.findUnique({ where: { id: made.groomId } })).careerWeeks).toBe(2);
    const show = await prisma.show.findUnique({ where: { id: made.showId } });
    expect(show.runDate.getTime()).toBe(now + 7 * day + pauseMs);

    // q383 clocks. Hunger and free-agent time are past events (rule 1).
    expect(f.hungerSince).toEqual(plus(foal.hungerSince, pauseMs));
    expect(el.hungerSince).toEqual(plus(elder.hungerSince, pauseMs));
    // A final development day evaluated inside the window lands on its end.
    expect((await reloadDev(foal.id)).finalDayEvaluatedAt).toEqual(E);
    expect((await reloadDev(ancient.id)).finalDayEvaluatedAt).toEqual(plus(S, pauseMs - day));
    const [rk, rr] = await Promise.all([riderKept.id, riderRehired.id].map(reloadRider));
    expect(rk.freeAgentSince).toEqual(plus(riderKept.freeAgentSince, pauseMs));
    expect(rr.freeAgentSince).toEqual(plus(riderRehired.freeAgentSince, pauseMs));
    expect(rk.riderRetirementSchedule.noticeSentAt).toEqual(E);
    expect(rr.riderRetirementSchedule.noticeSentAt).toEqual(plus(S, pauseMs - day));
    // A round still being voted on is a pending deadline (rule 2); a decided one stays.
    for (const r of [roundKept, roundChanged]) {
      const moved = await reloadRound(r.id);
      expect(moved.startsAt).toEqual(plus(r.startsAt, pauseMs));
      expect(moved.endsAt).toEqual(plus(farEnd, pauseMs));
    }
    expect(await reloadRound(roundClosed.id)).toEqual(roundClosed);
    for (const key of newClocks) {
      expect(applied.summary.fields[key]).toBeGreaterThanOrEqual(1);
    }
    expect(applied.summary.unruledFields).toEqual([]);
    const noticeChange = await prisma.timeBackChange.findMany({
      where: { timeBackId: applied.id, tableName: 'rider_retirement_schedules', rowId: String(riderKept.id) },
    });
    expect(noticeChange).toEqual([expect.objectContaining({ field: 'noticeSentAt' })]);

    expect(applied.summary.fields['Horse.lastGroomed']).toBeGreaterThanOrEqual(1);
    expect(applied.summary.horsesUnretired).toBeGreaterThanOrEqual(1);
    const changes = await prisma.timeBackChange.findMany({
      where: { timeBackId: applied.id, tableName: 'horses', rowId: String(foal.id), field: 'lastGroomed' },
    });
    expect(changes).toHaveLength(1);
    const logs = await prisma.staffActionLog.findMany({ where: { actorId: owner.id, capability: 'time-back' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe(applied.applyLogId);

    const replay = await post(APPLY, owner, { ...windowBody, code }, device);
    expect(replay.status).toBe(403);
    expect(replay.body.code).toBe('staffFreshCodeInvalid');
    const overlap = await post(
      APPLY,
      owner,
      { ...windowBody, code: await freshCode(owner, device, 'timeBackApply') },
      device,
    );
    expect(overlap.status).toBe(409);
    expect(overlap.body.code).toBe('timeBackOverlaps');
    expect(await prisma.timeBack.count({ where: { appliedById: owner.id } })).toBe(1);
  }, 120_000);

  it('undo restores what it wrote, leaves what a player changed since, and runs once', async () => {
    expect(applied?.id).toBeDefined();
    // A player grooms the foal after the time-back.
    const groomedNow = new Date();
    await prisma.horse.update({ where: { id: foal.id }, data: { lastGroomed: groomedNow } });
    // q383: play changes one value of each newer clock after the time-back.
    const fedNow = new Date();
    await prisma.horse.update({ where: { id: elder.id }, data: { hungerSince: fedNow } });
    const evaluatedNow = new Date();
    await prisma.foalDevelopment.update({
      where: { foalId: ancient.id },
      data: { finalDayEvaluatedAt: evaluatedNow },
    });
    await prisma.rider.update({ where: { id: riderRehired.id }, data: { freeAgentSince: null } });
    const noticedNow = new Date();
    await prisma.riderRetirementSchedule.update({
      where: { riderId: riderRehired.id },
      data: { noticeSentAt: noticedNow },
    });
    const rescheduled = { startsAt: new Date(now + 2 * day), endsAt: new Date(now + 9 * day) };
    await prisma.hallOfFameRound.update({ where: { id: roundChanged.id }, data: rescheduled });

    const undoUrl = `${staffApi}/time-back/${applied.id}/undo`;
    const res = await post(undoUrl, owner, { code: await freshCode(owner, device, 'timeBackUndo') }, device);
    expect(res.status).toBe(200);
    const summary = res.body.data.reverseSummary;
    expect(summary.skipped['Horse.lastGroomed']).toBeGreaterThanOrEqual(1);
    expect(summary.skippedRows['Horse.lastGroomed']).toContain(String(foal.id));
    const skippedByPlay = {
      'Horse.hungerSince': elder.id,
      'FoalDevelopment.finalDayEvaluatedAt': (await reloadDev(ancient.id)).id,
      'Rider.freeAgentSince': riderRehired.id,
      'RiderRetirementSchedule.noticeSentAt': riderRehired.id,
      'HallOfFameRound.startsAt': roundChanged.id,
      'HallOfFameRound.endsAt': roundChanged.id,
    };
    for (const [key, rowId] of Object.entries(skippedByPlay)) {
      expect(summary.restored[key]).toBeGreaterThanOrEqual(1);
      expect(summary.skippedRows[key]).toContain(String(rowId));
    }

    const [f, el] = await Promise.all([foal.id, elder.id].map(reload));
    expect(f.lastGroomed).toEqual(groomedNow);
    expect(f.dateOfBirth).toEqual(foal.dateOfBirth);
    expect(f.lastFedDate).toEqual(foal.lastFedDate);
    expect(f.trainingCooldown).toEqual(foal.trainingCooldown);
    expect(el.dateOfBirth).toEqual(elder.dateOfBirth);
    expect(el.age).toBe(21);
    expect((await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } })).currentDay).toBe(5);
    expect((await prisma.groom.findUnique({ where: { id: made.groomId } })).careerWeeks).toBe(3);
    expect((await prisma.show.findUnique({ where: { id: made.showId } })).runDate.getTime()).toBe(now + 7 * day);

    // q383: untouched values are restored; the ones play changed keep play's value.
    expect(f.hungerSince).toEqual(foal.hungerSince);
    expect(el.hungerSince).toEqual(fedNow);
    expect((await reloadDev(foal.id)).finalDayEvaluatedAt).toEqual(plus(S, 3_600_000));
    expect((await reloadDev(ancient.id)).finalDayEvaluatedAt).toEqual(evaluatedNow);
    const [rk, rr] = await Promise.all([riderKept.id, riderRehired.id].map(reloadRider));
    expect(rk.freeAgentSince).toEqual(riderKept.freeAgentSince);
    expect(rk.riderRetirementSchedule.noticeSentAt).toEqual(plus(S, 3_600_000));
    expect(rr.freeAgentSince).toBeNull();
    expect(rr.riderRetirementSchedule.noticeSentAt).toEqual(noticedNow);
    expect(await reloadRound(roundKept.id)).toEqual(roundKept);
    expect(await reloadRound(roundChanged.id)).toMatchObject(rescheduled);
    expect(await reloadRound(roundClosed.id)).toEqual(roundClosed);

    const reversal = await prisma.staffActionLog.findFirst({ where: { reversesId: applied.applyLogId } });
    expect(reversal).toMatchObject({ actorId: owner.id, capability: 'time-back' });

    const again = await post(undoUrl, owner, { code: await freshCode(owner, device, 'timeBackUndo') }, device);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('timeBackAlreadyUndone');
  }, 120_000);
});
