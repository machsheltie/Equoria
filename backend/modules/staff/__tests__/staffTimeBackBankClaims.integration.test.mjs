/**
 * Owed weekly bank claims after an outage time-back (Equoria-puj1e.5, owner
 * ruling 2026-10-12, docs/features/admin-time-back.md "Weekly bank claim") —
 * real HTTP, real DB, the Owner's real fresh codes, the real bank claim.
 * Nothing is mocked.
 *
 * The ruling: a time-back grants each player one owed claim for every bank
 * week fully covered by the outage in which they had not already claimed. The
 * normal weekly claim pays it (same amount, ledger-recorded) on top of that
 * week's own claim. Undo removes every owed claim not yet paid.
 *
 * Window: one whole bank week, Sunday 00:00 Eastern two weeks back to the
 * Sunday after (clear of the other time-back suite's window, which lies in
 * the last three days). Apply moves every matching row in the shared database,
 * so the suite always undoes what it applied (the undo test, and the afterAll
 * safety net if a test failed first).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { gameDayIndex, startOfGameDayIndex, startOfGameWeek } from '../../../utils/gameTime.mjs';
import { checkFreshCode, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import { bankWeeksInside } from '../services/timeBackBankClaims.mjs';
import { undoTimeBack } from '../services/timeBackService.mjs';
import {
  ORIGIN,
  checkIn,
  cookiesFor,
  createUserFactory,
  get,
  post,
  staffApi,
  startEmailCapture,
  stopEmailCapture,
} from './helpers/staffFixtures.mjs';
import { actionCodesFor, easternWall, freshCode, restoreHold, snapshotHold } from './helpers/timeBackFixtures.mjs';

const cleanup = createCleanupTracker();
const { makeUser, createdUserIds } = createUserFactory('sttbbank');
const day = 86_400_000;
const weeklyReward = 5_000;
const owedKey = 'User.owedWeeklyClaims';
const APPLY = `${staffApi}/time-back/apply`;
const CLAIM = '/api/v1/bank/claim';
const STATUS = '/api/v1/bank/claim-status';

const thisWeek = startOfGameWeek(new Date(), 0);
const S = startOfGameDayIndex(gameDayIndex(thisWeek) - 14);
const E = startOfGameDayIndex(gameDayIndex(thisWeek) - 7);
const weekStart = S.toISOString();
const windowBody = { start: easternWall(S), end: easternWall(E) };
const before = date => new Date(date.getTime() - day);

let holdBefore;
let owner;
let device;
const players = {};
let applied;

const settingsOf = async user => (await prisma.user.findUnique({ where: { id: user.id } })).settings;
const moneyOf = async user => (await prisma.user.findUnique({ where: { id: user.id } })).money;
const owedOf = async user => (await settingsOf(user)).owedWeeklyClaims;

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
  cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: scope() } }), 'ledger rows');
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

  const longStanding = { createdAt: before(S), money: 1_000 };
  // Lost the week: owed one claim. Will claim this week's and the owed one together.
  players.lost = await makeUser('user', longStanding);
  // Lost the week too, but already claimed this week: the claim pays only the owed one.
  players.claimedThisWeek = await makeUser('user', {
    ...longStanding,
    settings: { lastWeeklyClaimDate: new Date().toISOString() },
  });
  // Lost the week and never claims: undo takes the owed claim back.
  players.waiting = await makeUser('user', longStanding);
  // Claimed inside the week (the ledger says so): owed nothing.
  players.ledgerClaimed = await makeUser('user', longStanding);
  await prisma.userTransaction.create({
    data: {
      userId: players.ledgerClaimed.id,
      type: 'credit',
      amount: weeklyReward,
      category: 'weeklyReward',
      description: 'Weekly reward claim',
      metadata: { weekStart },
    },
  });
  // The claim marker falls inside the week: owed nothing.
  players.markerInside = await makeUser('user', {
    ...longStanding,
    settings: { lastWeeklyClaimDate: new Date(S.getTime() + 2 * day).toISOString() },
  });
  // Joined after the week ended: lost nothing.
  players.newcomer = await makeUser('user', { money: 1_000 });
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

describe('Bank weeks inside an outage', () => {
  it('counts only whole Sunday-to-Sunday weeks', () => {
    expect(bankWeeksInside(S, E)).toEqual([{ start: S, end: E }]);
    // Starting a minute late, or ending a minute early, loses the whole week.
    expect(bankWeeksInside(new Date(S.getTime() + 60_000), E)).toEqual([]);
    expect(bankWeeksInside(S, new Date(E.getTime() - 60_000))).toEqual([]);
  });
});

describe('Owed weekly bank claims (Owner time-back, player bank claim)', () => {
  it('preview counts the owed claims and grants nothing', async () => {
    const res = await get(
      `${staffApi}/time-back/preview?start=${windowBody.start}&end=${windowBody.end}`,
      owner,
      device,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.fields[owedKey]).toBeGreaterThanOrEqual(3);
    expect(await owedOf(players.lost)).toBeUndefined();
  }, 60_000);

  it('apply grants one owed claim per lost week, only to players who lost it, and records each', async () => {
    expect((await post(`${staffApi}/jobs/hold`, owner, {}, device)).status).toBe(200);
    const code = await freshCode(owner, device, 'timeBackApply');
    const res = await post(APPLY, owner, { ...windowBody, code }, device);
    expect(res.status).toBe(200);
    applied = res.body.data;
    expect(applied.summary.fields[owedKey]).toBeGreaterThanOrEqual(3);

    const claim = { timeBackId: applied.id, weekStart };
    for (const who of ['lost', 'claimedThisWeek', 'waiting']) {
      expect(await owedOf(players[who])).toEqual([claim]);
    }
    for (const who of ['ledgerClaimed', 'markerInside', 'newcomer']) {
      expect(await owedOf(players[who])).toBeUndefined();
    }
    // The other settings stay as they were.
    expect((await settingsOf(players.claimedThisWeek)).lastWeeklyClaimDate).toBeDefined();
    const changes = await prisma.timeBackChange.findMany({
      where: { timeBackId: applied.id, tableName: 'User', rowId: players.lost.id },
    });
    expect(changes).toEqual([expect.objectContaining({ field: 'owedWeeklyClaims', oldValue: null, newValue: claim })]);
    expect((await post(`${staffApi}/jobs/release`, owner, {}, device)).status).toBe(200);
  }, 120_000);

  it('the weekly claim pays this week’s reward and the owed one, each in the ledger', async () => {
    const status = await get(STATUS, players.lost);
    expect(status.status).toBe(200);
    expect(status.body.data).toMatchObject({ canClaim: true, owedClaims: 1, claimAmount: 2 * weeklyReward });

    const res = await post(CLAIM, players.lost, {});
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(2 * weeklyReward);
    expect(res.body.data.newBalance).toBe(1_000 + 2 * weeklyReward);
    expect(await moneyOf(players.lost)).toBe(1_000 + 2 * weeklyReward);
    expect(await owedOf(players.lost)).toBeUndefined();

    const ledger = await prisma.userTransaction.findMany({
      where: { userId: players.lost.id, category: 'weeklyReward' },
      orderBy: { id: 'asc' },
    });
    expect(ledger).toHaveLength(2);
    expect(ledger.map(row => row.amount)).toEqual([weeklyReward, weeklyReward]);
    expect(ledger[1].metadata).toEqual({ weekStart, owed: true });
    expect(ledger[1].balanceAfter).toBe(1_000 + 2 * weeklyReward);

    const again = await post(CLAIM, players.lost, {});
    expect(again.status).toBe(400);
    expect(await moneyOf(players.lost)).toBe(1_000 + 2 * weeklyReward);
  }, 60_000);

  it('a player who already claimed this week is paid the owed week alone', async () => {
    const status = await get(STATUS, players.claimedThisWeek);
    expect(status.body.data).toMatchObject({ canClaim: true, owedClaims: 1, claimAmount: weeklyReward });

    const res = await post(CLAIM, players.claimedThisWeek, {});
    expect(res.status).toBe(200);
    expect(res.body.data.amount).toBe(weeklyReward);
    expect(await moneyOf(players.claimedThisWeek)).toBe(1_000 + weeklyReward);
    expect((await get(STATUS, players.claimedThisWeek)).body.data).toMatchObject({
      canClaim: false,
      owedClaims: 0,
    });
  }, 60_000);

  it('a player cannot write an owed claim into their own settings', async () => {
    const url = `/api/v1/users/${players.newcomer.id}`;
    const csrf = await fetchCsrf(app, { origin: ORIGIN, extraCookies: cookiesFor(players.newcomer) });
    const res = await request(app)
      .put(url)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ settings: { owedWeeklyClaims: [{ timeBackId: 1, weekStart }] } });
    expect(res.status).toBe(400);
    expect(await owedOf(players.newcomer)).toBeUndefined();
    expect((await get(STATUS, players.newcomer)).body.data.owedClaims).toBe(0);
  }, 60_000);

  it('undo removes the owed claims still waiting and leaves the paid ones paid', async () => {
    expect(applied?.id).toBeDefined();
    const res = await post(
      `${staffApi}/time-back/${applied.id}/undo`,
      owner,
      { code: await freshCode(owner, device, 'timeBackUndo') },
      device,
    );
    expect(res.status).toBe(200);
    const summary = res.body.data.reverseSummary;
    expect(summary.restored[owedKey]).toBeGreaterThanOrEqual(1);
    expect(summary.skipped[owedKey]).toBeGreaterThanOrEqual(2);

    expect(await owedOf(players.waiting)).toBeUndefined();
    expect((await get(STATUS, players.waiting)).body.data).toMatchObject({ owedClaims: 0, claimAmount: weeklyReward });
    expect(await moneyOf(players.lost)).toBe(1_000 + 2 * weeklyReward);
    expect(await moneyOf(players.claimedThisWeek)).toBe(1_000 + weeklyReward);
  }, 120_000);
});
