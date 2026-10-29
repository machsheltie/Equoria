/**
 * Pay Rider — payday is a player action (Equoria-hc96y).
 *
 * Owner rulings 2026-10-28 ("payday is handled by players. They click 'pay groom, pay
 * rider'.") and 2026-10-29 (q268): pay any time during the week; the week ends Sunday
 * midnight Eastern, then the unpaid rules apply. Still true (q131/q142): owed weeks are
 * paid together with this week before the rider rides; a full unpaid week and the rider
 * leaves.
 *
 * Real DB, real routes (supertest), real week-end settlement scoped to this file's users.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
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
import { riderRefusal } from '../../../utils/competitionEntryRules.mjs';
import { settleEndedRiderPayWeek } from '../index.mjs';
import { getRiderPayWeekEnd, getRiderPayWeekStart, riderPayWeekKey } from '../services/riderPayWeek.mjs';

const PREFIX = 'TestFixture-riderPlayerPay';
const tag = () => randomBytes(4).toString('hex');

const userIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
cleanup.add(() => prisma.riderSalaryPayment.deleteMany({ where: { userId: { in: userIds } } }), 'payments');
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
// A rider who leaves for the hire pool has no userId, so riders are also matched by name.
cleanup.add(
  () => prisma.rider.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { firstName: PREFIX }] } }),
  'riders',
);
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 30000);

async function makeUser(money) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `${PREFIX}-${t}`,
      email: `${PREFIX}-${t}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 1),
      firstName: 'Pay',
      lastName: 'Rider',
      level: 3,
      money,
    },
  });
  userIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

// Novice: 200 coins a week (owner ruling q226: the star level's price).
const makeRider = userId =>
  prisma.rider.create({
    data: {
      userId,
      firstName: PREFIX,
      lastName: `Rider-${tag()}`,
      personality: 'calm',
      weeklyRate: 200,
      starLevel: 'novice',
    },
  });

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);
const rows = (userId, status) =>
  prisma.riderSalaryPayment.findMany({ where: { userId, status }, orderBy: { id: 'asc' } });
const notices = (userId, type) => prisma.notification.findMany({ where: { userId, type } });
const thisWeek = () => getRiderPayWeekStart(new Date());
const lastWeek = () => startOfGameDayIndex(gameDayIndex(thisWeek()) - 7);
// An instant inside NEXT pay week: settling from there settles THIS week.
const nextWeekInstant = () => new Date(getRiderPayWeekEnd(thisWeek()).getTime() + 12 * 60 * 60 * 1000);
async function payRoute(token, riderId) {
  const csrf = await fetchCsrf(app);
  return request(app)
    .post(`/api/v1/riders/${riderId}/pay`)
    .set('Origin', 'http://localhost:3000')
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken);
}
const statusRoute = token => request(app).get('/api/v1/riders/pay-status').set('Authorization', `Bearer ${token}`);

describe('the rider pay week runs Sunday to Sunday, Eastern (q268)', () => {
  it('Saturday 23:59 Eastern is the old week; Sunday 00:00 Eastern starts the new one', () => {
    // 2026-11-07 is a Saturday; Eastern is EST (UTC-5).
    expect(getRiderPayWeekStart(new Date('2026-11-08T04:59:00Z')).toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(getRiderPayWeekStart(new Date('2026-11-08T05:00:00Z')).toISOString()).toBe('2026-11-08T05:00:00.000Z');
    expect(riderPayWeekKey(getRiderPayWeekStart(new Date('2026-11-11T15:00:00Z')))).toBe('2026-11-08');
  });
});

describe('Pay Rider: one click pays this week', () => {
  it('shows the fee unpaid, takes it once, and the page state updates in the response', async () => {
    const { user, token } = await makeUser(1000);
    const rider = await makeRider(user.id);

    const before = await statusRoute(token);
    expect(before.status).toBe(200);
    expect(before.body.data.weekEndsAt).toBe(getRiderPayWeekEnd(thisWeek()).toISOString());
    expect(before.body.data.riders).toEqual([
      {
        riderId: rider.id,
        weeklyFee: 200,
        owed: 0,
        amountDue: 200,
        paidThisWeek: false,
        canAfford: true,
        feeUnpaid: false,
      },
    ]);

    const paid = await payRoute(token, rider.id);
    expect(paid.status).toBe(200);
    expect(paid.body.data.paid).toEqual({ riderId: rider.id, amount: 200 });
    expect(paid.body.data.riders[0]).toMatchObject({ paidThisWeek: true, amountDue: 200 });
    expect(await moneyOf(user.id)).toBe(800);
    const paidRows = await rows(user.id, 'paid');
    expect(paidRows.map(r => [r.riderId, r.amount, r.weekKey])).toEqual([[rider.id, 200, gameDateKey(thisWeek())]]);

    const again = await payRoute(token, rider.id);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('alreadyPaid');
    expect(await moneyOf(user.id)).toBe(800);
  });

  it('two presses racing take the pay once', async () => {
    const { user, token } = await makeUser(1000);
    const rider = await makeRider(user.id);

    const results = await Promise.all([payRoute(token, rider.id), payRoute(token, rider.id)]);

    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await moneyOf(user.id)).toBe(800);
    expect(await rows(user.id, 'paid')).toHaveLength(1);
  });

  it('short of coins: refused with insufficientFunds, nothing taken, no unpaid consequence', async () => {
    const { user, token } = await makeUser(150);
    const rider = await makeRider(user.id);

    const status = await statusRoute(token);
    expect(status.body.data.riders[0]).toMatchObject({ amountDue: 200, canAfford: false });

    const res = await payRoute(token, rider.id);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('insufficientFunds');
    expect(await moneyOf(user.id)).toBe(150);
    expect(await prisma.riderSalaryPayment.count({ where: { userId: user.id } })).toBe(0);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).feeUnpaidSince).toBeNull();
  });

  it("another player's rider is not found", async () => {
    const { user: owner } = await makeUser(1000);
    const { user: other, token } = await makeUser(1000);
    const rider = await makeRider(owner.id);

    const res = await payRoute(token, rider.id);
    expect(res.status).toBe(404);
    expect(await moneyOf(owner.id)).toBe(1000);
    expect(await moneyOf(other.id)).toBe(1000);
  });

  it('a rider paid by a Monday-keyed row from before the move to Sunday weeks is not charged again', async () => {
    const { user, token } = await makeUser(1000);
    const rider = await makeRider(user.id);
    await prisma.riderSalaryPayment.create({
      data: {
        riderId: rider.id,
        userId: user.id,
        amount: 200,
        weekKey: 'legacy-monday-key',
        paymentDate: new Date(thisWeek().getTime() + 60 * 60 * 1000),
        status: 'paid',
      },
    });

    expect((await statusRoute(token)).body.data.riders[0].paidThisWeek).toBe(true);
    expect((await payRoute(token, rider.id)).status).toBe(409);
    expect(await moneyOf(user.id)).toBe(1000);
  });
});

describe('Pay Rider: owed weeks are paid with this week (q131/q142)', () => {
  it('a rider unpaid last week costs both weeks in one press, then may ride again', async () => {
    const { user, token } = await makeUser(1000);
    const rider = await makeRider(user.id);
    await prisma.rider.update({ where: { id: rider.id }, data: { feeUnpaidSince: lastWeek() } });
    await prisma.riderSalaryPayment.create({
      data: {
        riderId: rider.id,
        userId: user.id,
        amount: 200,
        weekKey: riderPayWeekKey(lastWeek()),
        paymentDate: lastWeek(),
        status: 'missed',
      },
    });

    const status = await statusRoute(token);
    expect(status.body.data.riders[0]).toMatchObject({ owed: 200, amountDue: 400, feeUnpaid: true });

    const res = await payRoute(token, rider.id);
    expect(res.status).toBe(200);
    expect(res.body.data.paid.amount).toBe(400);
    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
    expect(await rows(user.id, 'arrearsSettled')).toHaveLength(1);
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.feeUnpaidSince).toBeNull();
    expect(riderRefusal({ rider: after }, user.id)).toBeNull();
  });
});

describe('the end of the week: unpaid riders get the unpaid rules, and nothing is charged', () => {
  it('an unpaid rider cannot ride and is told once; a paid rider is left alone; nobody is charged', async () => {
    const { user, token } = await makeUser(1000);
    const unpaid = await makeRider(user.id);
    const paid = await makeRider(user.id);
    expect((await payRoute(token, paid.id)).status).toBe(200);

    const result = await settleEndedRiderPayWeek(nextWeekInstant(), { userId: user.id });

    expect(result.graced).toBe(1);
    expect(await moneyOf(user.id)).toBe(800);
    const after = await prisma.rider.findUnique({ where: { id: unpaid.id } });
    expect(after.feeUnpaidSince.toISOString()).toBe(thisWeek().toISOString());
    expect(riderRefusal({ rider: after }, user.id)).toBe('riderFeeUnpaid');
    expect((await prisma.rider.findUnique({ where: { id: paid.id } })).feeUnpaidSince).toBeNull();
    const missed = await rows(user.id, 'missed');
    expect(missed.map(r => [r.riderId, r.weekKey])).toEqual([[unpaid.id, gameDateKey(thisWeek())]]);

    await settleEndedRiderPayWeek(nextWeekInstant(), { userId: user.id });
    expect(await notices(user.id, 'riderFeeUnpaid')).toHaveLength(1);
    expect(await moneyOf(user.id)).toBe(800);
  });

  it('a rider still unpaid at the end of the next week leaves; the debt is written off', async () => {
    const { user } = await makeUser(1000);
    const rider = await makeRider(user.id);
    const weekAfterNext = new Date(nextWeekInstant().getTime() + 7 * 24 * 60 * 60 * 1000);

    await settleEndedRiderPayWeek(nextWeekInstant(), { userId: user.id });
    const result = await settleEndedRiderPayWeek(weekAfterNext, { userId: user.id });

    expect(result.released).toBe(1);
    expect(await prisma.rider.findUnique({ where: { id: rider.id } })).toMatchObject({ userId: null, retired: false });
    expect(await rows(user.id, 'arrearsWrittenOff')).toHaveLength(1);
    expect(await notices(user.id, 'riderReleased')).toHaveLength(1);
    expect(await moneyOf(user.id)).toBe(1000);
  });
});
