/**
 * Pay Groom — payday is a player action (Equoria-hc96y).
 *
 * Owner rulings 2026-10-28 ("Users have to pay them. My goal is not to automate work for
 * players." / "payday is handled by players. They click 'pay groom, pay rider'.") and
 * 2026-10-29 (q268): pay any time during the week; the week ends Sunday midnight Eastern,
 * then the unpaid rules apply — the week is owed and the groom cannot work until paid;
 * a groom unpaid for a full week leaves for the grooms-for-hire pool.
 *
 * Real DB, real routes (supertest), real week-end settlement scoped to this file's users.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import config from '../../../config/config.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { gameDateKey, gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { systemAccountBurn } from '../../economy/index.mjs';
import { settleEndedGroomPayWeek } from '../index.mjs';
import { getPayWeekStart } from '../services/groomSalaryService.mjs';
import { checkGroomMayWork } from '../services/groomEngagementService.mjs';

const PREFIX = 'TestFixture-groomPlayerPay';
const tag = () => randomBytes(4).toString('hex');
const dayMs = 24 * 60 * 60 * 1000;

const userIds = [];
const cleanup = createCleanupTracker();
cleanup.add(async () => {
  const grooms = await prisma.groom.findMany({
    where: { OR: [{ userId: { in: userIds } }, { name: { startsWith: PREFIX } }] },
    select: { id: true },
  });
  const ids = grooms.map(g => g.id);
  await prisma.groomSalaryPayment.deleteMany({
    where: { OR: [{ groomId: { in: ids } }, { userId: { in: userIds } }] },
  });
  await prisma.groomEngagement.deleteMany({ where: { groomId: { in: ids } } });
  await prisma.groom.deleteMany({ where: { id: { in: ids } } });
}, 'grooms');
cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 30000);

beforeAll(async () => {
  await prisma.systemAccount.upsert({
    where: { name: systemAccountBurn },
    create: { name: systemAccountBurn, balance: 0 },
    update: {},
  });
});

async function makeUser(money) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${PREFIX}-${t}`.slice(0, 30),
      email: `${PREFIX}-${t}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Pay',
      lastName: 'Groom',
      money,
    },
  });
  userIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

const thisWeek = () => getPayWeekStart(new Date());
const lastWeek = () => startOfGameDayIndex(gameDayIndex(thisWeek()) - 7);
const nextWeekStart = () => startOfGameDayIndex(gameDayIndex(thisWeek()) + 7);
// An instant inside NEXT pay week: settling from there settles THIS week.
const nextWeekInstant = () => new Date(nextWeekStart().getTime() + 12 * 60 * 60 * 1000);

/** A Rookie groom (100 a week) hired a month ago, or at `hiredAt`. */
async function makeGroom(userId, hiredAt = new Date(Date.now() - 30 * dayMs)) {
  const groom = await prisma.groom.create({
    data: {
      name: `${PREFIX}-${tag()}`,
      speciality: 'general',
      personality: 'gentle',
      skillLevel: 'novice',
      starLevel: 'rookie',
      startAge: 20,
      userId,
    },
  });
  await prisma.groomEngagement.create({ data: { groomId: groom.id, userId, startedAt: hiredAt } });
  return groom;
}

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);
const payments = (userId, status) =>
  prisma.groomSalaryPayment.findMany({ where: { userId, status }, orderBy: { id: 'asc' } });
async function payRoute(token, groomId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(`/api/v1/groom-salaries/grooms/${groomId}/pay`)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
}
const statusRoute = token =>
  request(app).get('/api/v1/groom-salaries/pay-status').set('Authorization', `Bearer ${token}`);

describe('the groom pay week runs Sunday to Sunday, Eastern (q268)', () => {
  it('Saturday 23:59 Eastern is the old week; Sunday 00:00 Eastern starts the new one', () => {
    // 2026-11-07 is a Saturday; Eastern is EST (UTC-5) from 2026-11-01.
    expect(getPayWeekStart(new Date('2026-11-08T04:59:00Z')).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(getPayWeekStart(new Date('2026-11-08T05:00:00Z')).toISOString()).toBe('2026-11-08T05:00:00.000Z');
  });
});

describe('Pay Groom: one click pays this week', () => {
  it('shows the fee unpaid, takes it once, and answers with the updated state', async () => {
    const { user, token } = await makeUser(1000);
    const groom = await makeGroom(user.id);

    const before = await statusRoute(token);
    expect(before.status).toBe(200);
    expect(before.body.data.weekEndsAt).toBe(nextWeekStart().toISOString());
    expect(before.body.data.grooms).toEqual([
      {
        groomId: groom.id,
        weeklyFee: 100,
        owed: 0,
        amountDue: 100,
        paidThisWeek: false,
        canAfford: true,
        feeUnpaid: false,
      },
    ]);

    const paid = await payRoute(token, groom.id);
    expect(paid.status).toBe(200);
    expect(paid.body.data.paid).toEqual({ groomId: groom.id, amount: 100 });
    expect(paid.body.data.grooms[0]).toMatchObject({ paidThisWeek: true, amountDue: 100 });
    expect(await moneyOf(user.id)).toBe(900);
    const rows = await payments(user.id, 'paid');
    expect(rows.map(r => [r.groomId, r.amount, r.weekKey])).toEqual([[groom.id, 100, gameDateKey(thisWeek())]]);

    const again = await payRoute(token, groom.id);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('alreadyPaid');
    expect(await moneyOf(user.id)).toBe(900);
  });

  it('two presses racing take the fee once', async () => {
    const { user, token } = await makeUser(1000);
    const groom = await makeGroom(user.id);

    const results = await Promise.all([payRoute(token, groom.id), payRoute(token, groom.id)]);

    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await moneyOf(user.id)).toBe(900);
    expect(await payments(user.id, 'paid')).toHaveLength(1);
  });

  it('paying one groom does not pay the others', async () => {
    const { user, token } = await makeUser(1000);
    const a = await makeGroom(user.id);
    const b = await makeGroom(user.id);

    expect((await payRoute(token, a.id)).status).toBe(200);

    const status = (await statusRoute(token)).body.data.grooms;
    expect(status.find(g => g.groomId === a.id).paidThisWeek).toBe(true);
    expect(status.find(g => g.groomId === b.id).paidThisWeek).toBe(false);
    expect(await moneyOf(user.id)).toBe(900);
  });

  it('short of coins: refused with insufficientFunds, nothing taken, no unpaid consequence', async () => {
    const { user, token } = await makeUser(50);
    const groom = await makeGroom(user.id);

    expect((await statusRoute(token)).body.data.grooms[0]).toMatchObject({ amountDue: 100, canAfford: false });
    const res = await payRoute(token, groom.id);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficientFunds');
    expect(await moneyOf(user.id)).toBe(50);
    expect(await prisma.groomSalaryPayment.count({ where: { userId: user.id } })).toBe(0);
    expect((await prisma.groom.findUnique({ where: { id: groom.id } })).feeUnpaidSince).toBeNull();
  });

  it("another player's groom is not found", async () => {
    const { user: owner } = await makeUser(1000);
    const { token } = await makeUser(1000);
    const groom = await makeGroom(owner.id);

    expect((await payRoute(token, groom.id)).status).toBe(404);
    expect(await moneyOf(owner.id)).toBe(1000);
  });

  it('a groom hired this week is already paid by the hire fee', async () => {
    const { user, token } = await makeUser(1000);
    const groom = await makeGroom(user.id, new Date());

    expect((await statusRoute(token)).body.data.grooms[0].paidThisWeek).toBe(true);
    expect((await payRoute(token, groom.id)).status).toBe(409);
    expect(await moneyOf(user.id)).toBe(1000);
  });
});

describe('Pay Groom: an owed week is paid with this week (Equoria-bgdfb)', () => {
  it('a groom unpaid last week costs both weeks in one press and works again', async () => {
    const { user, token } = await makeUser(1000);
    const groom = await makeGroom(user.id);
    await prisma.groom.update({ where: { id: groom.id }, data: { feeUnpaidSince: lastWeek() } });
    await prisma.groomSalaryPayment.create({
      data: {
        groomId: groom.id,
        userId: user.id,
        amount: 100,
        paymentDate: lastWeek(),
        weekKey: gameDateKey(lastWeek()),
        paymentType: 'weeklySalary',
        status: 'missedInsufficientFunds',
      },
    });
    expect(checkGroomMayWork({ ...groom, feeUnpaidSince: lastWeek() }).code).toBe('feeUnpaid');

    expect((await statusRoute(token)).body.data.grooms[0]).toMatchObject({
      owed: 100,
      amountDue: 200,
      feeUnpaid: true,
    });
    const res = await payRoute(token, groom.id);
    expect(res.status).toBe(200);
    expect(res.body.data.paid.amount).toBe(200);
    expect(await moneyOf(user.id)).toBe(800);
    expect(await payments(user.id, 'missedInsufficientFunds')).toHaveLength(0);
    const after = await prisma.groom.findUnique({ where: { id: groom.id } });
    expect(after.feeUnpaidSince).toBeNull();
    expect(checkGroomMayWork(after).allowed).toBe(true);
  });
});

describe('the end of the week: unpaid grooms get the unpaid rules, and nothing is charged', () => {
  it('an unpaid groom cannot work and is told once; paid and newly hired grooms are left alone', async () => {
    const { user, token } = await makeUser(1000);
    const unpaid = await makeGroom(user.id);
    const paid = await makeGroom(user.id);
    const hiredThisWeek = await makeGroom(user.id, new Date());
    expect((await payRoute(token, paid.id)).status).toBe(200);

    const result = await settleEndedGroomPayWeek(nextWeekInstant(), { userId: user.id });

    expect(result.graced).toBe(1);
    expect(await moneyOf(user.id)).toBe(900);
    const after = await prisma.groom.findUnique({ where: { id: unpaid.id } });
    expect(after.feeUnpaidSince.toISOString()).toBe(thisWeek().toISOString());
    expect(checkGroomMayWork(after).code).toBe('feeUnpaid');
    for (const id of [paid.id, hiredThisWeek.id]) {
      expect((await prisma.groom.findUnique({ where: { id } })).feeUnpaidSince).toBeNull();
    }
    const owed = await payments(user.id, 'missedInsufficientFunds');
    expect(owed.map(r => [r.groomId, r.weekKey])).toEqual([[unpaid.id, gameDateKey(thisWeek())]]);

    await settleEndedGroomPayWeek(nextWeekInstant(), { userId: user.id });
    expect(await prisma.notification.count({ where: { userId: user.id, type: 'groomFeeUnpaid' } })).toBe(1);
    expect(await moneyOf(user.id)).toBe(900);
  });

  it('a groom still unpaid at the end of the next week leaves for the grooms-for-hire pool', async () => {
    const { user } = await makeUser(1000);
    const groom = await makeGroom(user.id);
    const weekAfterNext = new Date(nextWeekInstant().getTime() + 7 * dayMs);

    await settleEndedGroomPayWeek(nextWeekInstant(), { userId: user.id });
    const result = await settleEndedGroomPayWeek(weekAfterNext, { userId: user.id });

    expect(result.released).toBe(1);
    expect((await prisma.groom.findUnique({ where: { id: groom.id } })).userId).toBeNull();
    expect(await payments(user.id, 'terminatedNonPayment')).toHaveLength(1);
    expect(await moneyOf(user.id)).toBe(1000);
  });
});
