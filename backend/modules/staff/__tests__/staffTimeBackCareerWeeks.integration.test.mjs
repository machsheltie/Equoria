/**
 * Outage time-back gives back only the career weeks a weekly staff pass really
 * added (Equoria-puj1e.5, Codex r2 #2/#3; docs/features/admin-time-back.md,
 * rule 3). Real DB, the real weekly passes run through the real cron monitor
 * with their production locks, the Owner's real fresh codes. Nothing is mocked.
 *
 * The defects this closes: the reversal took every current groom, rider and
 * trainer created before a logged run and took a week off each, so an inactive
 * groom the pass skips, or one whose own increment failed, lost a week it never
 * gained; and it trusted the run log alone, which can be missing (written after
 * the pass commits, insert failures swallowed) or say 'error' after riders had
 * already aged.
 *
 * A pass happens now, so its window is the minutes around it and the service is
 * called with a clock a minute past the window's end (its `now` parameter: the
 * HTTP route always uses the real clock, and a window may not end in the
 * future). Apply moves every matching row in the database, so each scenario
 * undoes what it applied, and afterAll undoes anything a failed test left.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { CronJobMonitor } from '../../../services/jobs/cronJobMonitor.mjs';
import { processWeeklyCareerProgression } from '../../grooms/index.mjs';
import { incrementWeeklyCareerWeeks } from '../../trainers/index.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { setJobHold } from '../services/jobHoldService.mjs';
import { applyTimeBack, previewTimeBack, undoTimeBack } from '../services/timeBackService.mjs';
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
const { makeUser, createdUserIds } = createUserFactory('sttbweeks');
const minute = 60_000;
const day = 86_400_000;
// A career count whose next week overflows the column: that staff member's increment fails.
const intMax = 2_147_483_647;
const counterKeys = ['Groom.careerWeeks', 'Rider.careerWeeks', 'Trainer.careerWeeks'];

let holdBefore;
let owner;
const made = { grooms: [], riders: [], trainers: [], runLogs: [] };

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
  cleanup.add(() => prisma.cronRunLog.deleteMany({ where: { id: { in: made.runLogs } } }), 'run logs');
  cleanup.add(
    () => prisma.groomRetirementSchedule.deleteMany({ where: { groomId: { in: made.grooms } } }),
    'schedules',
  );
  cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: made.grooms } } }), 'grooms');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: made.riders } } }), 'riders');
  cleanup.add(() => prisma.trainer.deleteMany({ where: { id: { in: made.trainers } } }), 'trainers');
  cleanup.add(() => prisma.staffActionLog.deleteMany({ where: { actorId: scope() } }), 'action log');
  cleanup.add(() => prisma.staffCheckinCode.deleteMany({ where: { userId: scope() } }), 'checkin codes');
  cleanup.add(() => prisma.staffTrustedDevice.deleteMany({ where: { userId: scope() } }), 'devices');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: scope() } }), 'refresh tokens');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: scope() } }), 'users');
}, 60_000);

afterAll(() => cleanup.run(), 120_000);

beforeEach(async () => {
  startEmailCapture();
  // Each scenario has its own Owner, so no scenario meets another's code limit.
  owner = await makeUser('owner');
  // Every scenario starts with the jobs running (not held).
  await prisma.gameControl.deleteMany({ where: { id: 1 } });
});

// Safety net: a scenario that failed never leaves its time-back applied in the
// shared database, or in the way of the next scenario's window.
afterEach(async () => {
  const open = await prisma.timeBack.findMany({
    where: { appliedById: { in: createdUserIds }, reversedAt: null },
    select: { id: true },
  });
  for (const { id } of open) {
    await undoTimeBack({ actor: owner, timeBackId: id, proof: await ownerProof('timeBackUndo') });
  }
  stopEmailCapture();
}, 60_000);

async function ownerProof(purpose) {
  await requestFreshCode(owner, purpose);
  return checkFreshCode(owner, purpose, actionCodesFor(owner.email).at(-1));
}

async function makeGroom(userId, careerWeeks, extra = {}) {
  const row = await prisma.groom.create({
    data: {
      name: `TestFixture-tbw-${uid()}`,
      speciality: 'foalCare',
      personality: 'calm',
      userId,
      careerWeeks,
      startAge: 20,
      ...extra,
    },
  });
  made.grooms.push(row.id);
  return row;
}

async function makeRider(userId, careerWeeks) {
  const row = await prisma.rider.create({
    data: { firstName: 'TestFixture', lastName: `tbw-${uid()}`, personality: 'methodical', userId, careerWeeks },
  });
  made.riders.push(row.id);
  return row;
}

async function makeTrainer(userId, careerWeeks) {
  const row = await prisma.trainer.create({
    data: {
      firstName: 'TestFixture',
      lastName: `tbw-${uid()}`,
      personality: 'focused',
      skillLevel: 'novice',
      speciality: 'Dressage',
      userId,
      careerWeeks,
    },
  });
  made.trainers.push(row.id);
  return row;
}

const weeksOf = async (model, rows) =>
  Promise.all(rows.map(async r => (await prisma[model].findUnique({ where: { id: r.id } })).careerWeeks));

const changesOf = (timeBackId, tableName, rows) =>
  prisma.timeBackChange.findMany({
    where: { timeBackId, tableName, rowId: { in: rows.map(r => String(r.id)) } },
    select: { rowId: true, oldValue: true, newValue: true },
  });

/**
 * Run one weekly pass through a real monitor, and give back the window of
 * minutes around it: from the minute it started to two minutes after it ended.
 */
async function passInWindow(jobName, body) {
  const before = Date.now();
  const outcome = await new CronJobMonitor().runWithHeartbeat(jobName, body, { applyLock: true }).then(
    result => ({ result }),
    error => ({ error }),
  );
  const after = Date.now();
  const runs = await prisma.cronRunLog.findMany({
    where: { jobName, startedAt: { gte: new Date(before - 1000) } },
    select: { id: true, status: true },
  });
  made.runLogs.push(...runs.map(r => r.id));
  const end = new Date(toMinute(after).getTime() + 2 * minute);
  return {
    outcome,
    runs,
    input: { start: easternWall(toMinute(before)), end: easternWall(end) },
    now: new Date(end.getTime() + minute),
  };
}

async function applyHeld(input, now) {
  await setJobHold({ actor: owner, held: true, reason: 'Outage test' });
  return applyTimeBack({ actor: owner, input, proof: await ownerProof('timeBackApply') }, now);
}

async function undoAndRelease(timeBackId) {
  await undoTimeBack({ actor: owner, timeBackId, proof: await ownerProof('timeBackUndo') });
  await setJobHold({ actor: owner, held: false });
}

describe('Time-back gives back only the career weeks a weekly pass added', () => {
  it('a groom the pass skipped (inactive) or failed to age keeps its weeks; the aged one gives one back', async () => {
    const player = await makeUser('user');
    const aged = await makeGroom(player.id, 3);
    const inactive = await makeGroom(player.id, 4, { isActive: false });
    const failing = await makeGroom(player.id, intMax);
    const grooms = [aged, inactive, failing];

    const pass = await passInWindow('groomCareerProgression', () => processWeeklyCareerProgression(player.id));
    expect(pass.outcome.result.processed).toBe(1);
    expect(pass.outcome.result.errors).toEqual([expect.objectContaining({ groomId: failing.id })]);
    expect(pass.runs).toEqual([expect.objectContaining({ status: 'success' })]);
    expect(await weeksOf('groom', grooms)).toEqual([4, 4, intMax]);

    const preview = await previewTimeBack(pass.input, pass.now);
    expect(preview.fields['Groom.careerWeeks']).toBeGreaterThanOrEqual(1);

    const applied = await applyHeld(pass.input, pass.now);
    expect(await weeksOf('groom', grooms)).toEqual([3, 4, intMax]);
    expect(await changesOf(applied.id, 'grooms', grooms)).toEqual([
      { rowId: String(aged.id), oldValue: 4, newValue: 3 },
    ]);
    expect(preview.unprovableCounters).toEqual([]);
    expect(applied.summary.unprovableCounters).toEqual([]);

    await undoAndRelease(applied.id);
    expect(await weeksOf('groom', grooms)).toEqual([4, 4, intMax]);
  }, 120_000);

  it('a pass whose run-log row was never written is still given back', async () => {
    const player = await makeUser('user');
    const groom = await makeGroom(player.id, 6);

    const pass = await passInWindow('groomCareerProgression', () => processWeeklyCareerProgression(player.id));
    expect(pass.outcome.result.processed).toBe(1);
    // The monitor writes the run log after the pass commits and swallows a
    // failed insert: this is the run log such a failure leaves.
    await prisma.cronRunLog.deleteMany({ where: { id: { in: pass.runs.map(r => r.id) } } });
    expect(await weeksOf('groom', [groom])).toEqual([7]);

    const preview = await previewTimeBack(pass.input, pass.now);
    expect(preview.jobRuns.filter(r => r.jobName === 'groomCareerProgression')).toEqual([]);

    const applied = await applyHeld(pass.input, pass.now);
    expect(await weeksOf('groom', [groom])).toEqual([6]);
    expect(preview.fields['Groom.careerWeeks']).toBeGreaterThanOrEqual(1);
    expect(applied.summary.fields['Groom.careerWeeks']).toBeGreaterThanOrEqual(1);

    await undoAndRelease(applied.id);
    expect(await weeksOf('groom', [groom])).toEqual([7]);
  }, 120_000);

  it('riders that aged before the trainers failed give their week back; the trainers keep theirs', async () => {
    const player = await makeUser('user');
    const rider = await makeRider(player.id, 5);
    const trainer = await makeTrainer(player.id, 5);
    // Its week overflows, so the trainers' half of the pass fails after the riders' commits.
    const overflowing = await makeTrainer(player.id, intMax);
    const trainers = [trainer, overflowing];

    const pass = await passInWindow('weeklyRiderTrainerCareerWeeks', () => incrementWeeklyCareerWeeks());
    expect(pass.outcome.error).toBeDefined();
    expect(pass.runs).toEqual([expect.objectContaining({ status: 'error' })]);
    expect(await weeksOf('rider', [rider])).toEqual([6]);
    expect(await weeksOf('trainer', trainers)).toEqual([5, intMax]);

    const applied = await applyHeld(pass.input, pass.now);
    expect(await weeksOf('rider', [rider])).toEqual([5]);
    expect(await weeksOf('trainer', trainers)).toEqual([5, intMax]);
    expect(await changesOf(applied.id, 'riders', [rider])).toEqual([
      { rowId: String(rider.id), oldValue: 6, newValue: 5 },
    ]);
    expect(await changesOf(applied.id, 'trainers', trainers)).toEqual([]);

    await undoAndRelease(applied.id);
    expect(await weeksOf('rider', [rider])).toEqual([6]);
  }, 120_000);

  it('a window older than the career-week record leaves every career count alone and says so', async () => {
    const device = await checkIn(owner);
    const [{ completeSince }] = await prisma.$queryRaw`
      SELECT "completeSince" FROM "staff_career_tick_ledger" WHERE "id" = 1`;
    const S = toMinute(completeSince.getTime() - 2 * day);
    const E = toMinute(completeSince.getTime() - day);
    const window = { start: easternWall(S), end: easternWall(E) };
    const player = await makeUser('user');
    const groom = await makeGroom(player.id, 3, { createdAt: new Date(S.getTime() - day) });
    // The run log says a groom pass succeeded inside the window; nothing says which grooms aged.
    const run = await prisma.cronRunLog.create({
      data: {
        jobName: 'groomCareerProgression',
        startedAt: new Date(S.getTime() + 3_600_000),
        finishedAt: new Date(S.getTime() + 3_601_000),
        status: 'success',
      },
    });
    made.runLogs.push(run.id);

    const res = await get(`${staffApi}/time-back/preview?start=${window.start}&end=${window.end}`, owner, device);
    expect(res.status).toBe(200);
    expect(res.body.data.unprovableCounters).toEqual(counterKeys);
    for (const key of counterKeys) {
      expect(res.body.data.fields[key]).toBe(0);
    }

    expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
    const code = await freshCode(owner, device, 'timeBackApply');
    const applied = await post(`${staffApi}/time-back/apply`, owner, { ...window, code }, device);
    expect(applied.status).toBe(200);
    expect(await weeksOf('groom', [groom])).toEqual([3]);
    const { summary } = applied.body.data;
    expect(summary.unprovableCounters).toEqual(counterKeys);
    for (const key of counterKeys) {
      expect(summary.fields[key]).toBe(0);
    }

    const undoUrl = `${staffApi}/time-back/${applied.body.data.id}/undo`;
    const undone = await post(undoUrl, owner, { code: await freshCode(owner, device, 'timeBackUndo') }, device);
    expect(undone.status).toBe(200);
    expect((await post(`${staffApi}/jobs/release`, owner, {}, device)).status).toBe(200);
  }, 120_000);
});
