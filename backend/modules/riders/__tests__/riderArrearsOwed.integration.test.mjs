/**
 * Rider owed weeks (owner q131 and q142, 2026-10-27): a rider's missed week is OWED, like grooms.
 * The next payday collects the missed weeks in the same debit; a rider who leaves after a
 * full unpaid week has the debt written off. Owner rulings 2026-10-28 and 2026-10-29
 * (q268, Equoria-hc96y): payday is the player's Pay Rider press, and the week-end
 * settlement marks the unpaid weeks. Old contract: a weekly pass took the pay every
 * Monday; it was removed (Equoria-kw60x) and these cases moved onto Pay Rider.
 *
 * Real DB, real Pay Rider service with an injected clock, real week-end settlement, real
 * roster route (supertest). Pay weeks are fixed dates in 2032 and every settlement is
 * scoped to this suite's own fixture users.
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
import { settleEndedRiderPayWeek } from '../index.mjs';
import { payRider } from '../services/riderPlayerPayService.mjs';
import { getRiderPayWeekStart } from '../services/riderPayWeek.mjs';
import { riderRefusal } from '../../../utils/competitionEntryRules.mjs';
import { handleUnpaidRiders } from '../services/riderUnpaidService.mjs';

const PREFIX = 'TestFixture-riderArrears';
const tag = () => randomBytes(4).toString('hex');
// Owner ruling 2026-10-29 (q268, Equoria-hc96y): the pay week ends Sunday midnight Eastern,
// so it starts on Sunday. Old contract: the pay week started on Monday.
// Wednesday 2032-03-03 -> pay week Sunday 2032-02-29.
const week1 = new Date('2032-03-03T15:00:00Z');
const week2 = new Date('2032-03-10T15:00:00Z');
const week3 = new Date('2032-03-17T15:00:00Z');

const userIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
cleanup.add(() => prisma.riderSalaryPayment.deleteMany({ where: { userId: { in: userIds } } }), 'payments');
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
// A rider who leaves for the hire pool (owner ruling 2026-10-28, q177) has no userId, so
// this file's riders are also matched by their fixture first name.
cleanup.add(
  () =>
    prisma.rider.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { firstName: PREFIX }] },
    }),
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
      firstName: 'Owed',
      lastName: 'Weeks',
      level: 3,
      money,
    },
  });
  userIds.push(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '1h' });
  return { user, token };
}

// Owner ruling 2026-10-28 (q226, Equoria-nawn5): a rider's weekly pay is their star
// level's price, so each fixture rider carries the level whose price is its rate.
const starLevelForRate = rate => {
  const level = { 100: 'rookie', 200: 'novice', 300: 'intermediate', 400: 'advanced', 500: 'expert' }[rate];
  if (!level) {
    throw new Error(`no star level is priced at ${rate}`);
  }
  return level;
};

const makeRider = (userId, weeklyRate) =>
  prisma.rider.create({
    data: {
      userId,
      firstName: PREFIX,
      lastName: `Rider-${tag()}`,
      personality: 'calm',
      skillLevel: 'experienced',
      speciality: 'Show Jumping',
      weeklyRate,
      starLevel: starLevelForRate(weeklyRate),
    },
  });

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);
const setMoney = (userId, money) => prisma.user.update({ where: { id: userId }, data: { money } });
// The player presses Pay Rider at `now`.
const pay = (userId, riderId, now) => payRider(userId, riderId, now);
// The week-end settlement run from an instant in the NEXT pay week settles the week before.
const settle = (userId, now) => settleEndedRiderPayWeek(now, { userId });
const insufficientFunds = { status: 400, code: 'insufficientFunds' };
const alreadyPaid = { status: 409, code: 'alreadyPaid' };
const rows = (userId, status) =>
  prisma.riderSalaryPayment.findMany({ where: { userId, status }, orderBy: { id: 'asc' } });

describe('rider owed weeks: a missed week is collected with the next payday', () => {
  it('a missed week followed by a paid week collects both, once, and the rider stays', async () => {
    const { user, token } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await expect(pay(user.id, rider.id, week1)).rejects.toMatchObject(insufficientFunds);
    await settle(user.id, week2);
    expect(await rows(user.id, 'missed')).toHaveLength(1);
    await setMoney(user.id, 1000);

    const result = await pay(user.id, rider.id, week2);

    expect(result).toEqual({ riderId: rider.id, amount: 400 });
    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
    const settled = await rows(user.id, 'arrearsSettled');
    expect(settled.map(r => [r.riderId, r.amount, r.weekKey])).toEqual([[rider.id, 200, '2032-02-29']]);
    expect(await rows(user.id, 'paid')).toHaveLength(1);

    // the settled week is never collected again
    expect((await pay(user.id, rider.id, week3)).amount).toBe(200);
    expect(await moneyOf(user.id)).toBe(400);

    // the roster the Staff page reads shows the rider paid
    const listed = await request(app).get(`/api/v1/riders/user/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].id).toBe(rider.id);
    expect(listed.body.data[0].feeUnpaidSince).toBeNull();
  });

  it('two missed weeks (a failed settlement never releases) are both collected on the next payday', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await settle(user.id, week2);
    // Week 2 fails for OUR reason: the rider stays in grace and the week is still owed.
    const roster = await prisma.rider.findMany({ where: { userId: user.id } });
    await handleUnpaidRiders(user.id, roster, getRiderPayWeekStart(week2), { allowLeave: false });
    await handleUnpaidRiders(user.id, roster, getRiderPayWeekStart(week2), { allowLeave: false });
    expect(await rows(user.id, 'missed')).toHaveLength(2);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).retired).toBe(false);

    await setMoney(user.id, 1000);
    const result = await pay(user.id, rider.id, week3);

    expect(result.amount).toBe(600);
    expect(await moneyOf(user.id)).toBe(400);
    expect(await rows(user.id, 'arrearsSettled')).toHaveLength(2);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
  });

  // Owner q142 (2026-10-27), "Owed weeks first": this week AND every owed week are one
  // debit. The old contract (q131) fell back to this week alone and left the debt owed.
  it('a wallet that covers this week but not the debt takes nothing; the week is missed and the rider cannot ride', async () => {
    const { user } = await makeUser(250);
    const rider = await makeRider(user.id, 200);
    // An owed week with the rider not yet marked unpaid (a fixture row, not a settlement).
    await prisma.riderSalaryPayment.create({
      data: {
        riderId: rider.id,
        userId: user.id,
        amount: 200,
        weekKey: '2032-02-29',
        paymentDate: getRiderPayWeekStart(week1),
        status: 'missed',
      },
    });

    await expect(pay(user.id, rider.id, week2)).rejects.toMatchObject(insufficientFunds);
    // the end of that week finds it unpaid
    await settle(user.id, week3);

    expect(await moneyOf(user.id)).toBe(250);
    expect(await rows(user.id, 'paid')).toHaveLength(0);
    expect((await rows(user.id, 'missed')).map(r => r.weekKey)).toEqual(['2032-02-29', '2032-03-07']);
    const after = await prisma.rider.findUnique({ where: { id: rider.id } });
    expect(after.retired).toBe(false);
    expect(after.feeUnpaidSince).toEqual(getRiderPayWeekStart(week2));
    expect(riderRefusal({ rider: after }, user.id)).toBe('riderFeeUnpaid');
  });

  it('a wallet that covers this week but not the debt, after a full unpaid week, sees the rider leave and the debt written off', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await settle(user.id, week2);
    await setMoney(user.id, 250);
    await expect(pay(user.id, rider.id, week2)).rejects.toMatchObject(insufficientFunds);
    const result = await settle(user.id, week3);

    expect(result.released).toBe(1);
    expect(await moneyOf(user.id)).toBe(250);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
    expect(await rows(user.id, 'arrearsWrittenOff')).toHaveLength(1);
    // Owner ruling 2026-10-28 (q177, Equoria-xlw03) changed this contract: a rider who
    // leaves after a full unpaid week returns to the riders-for-hire pool (old contract:
    // the rider was retired).
    expect(await prisma.rider.findUnique({ where: { id: rider.id } })).toMatchObject({
      retired: false,
      userId: null,
    });
  });

  it('a rider who leaves after a full unpaid week is not charged afterwards; the debt is written off', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await settle(user.id, week2);
    const result = await settle(user.id, week3);
    expect(result.released).toBe(1);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
    expect(await rows(user.id, 'arrearsWrittenOff')).toHaveLength(1);

    await setMoney(user.id, 1000);
    await expect(pay(user.id, rider.id, week3)).rejects.toMatchObject({ status: 404, code: 'riderNotFound' });
    expect(await moneyOf(user.id)).toBe(1000);
    expect(await rows(user.id, 'paid')).toHaveLength(0);
    // Owner ruling 2026-10-28 (q177, Equoria-xlw03) changed this contract: a rider who
    // leaves after a full unpaid week returns to the riders-for-hire pool (old contract:
    // the rider was retired).
    expect(await prisma.rider.findUnique({ where: { id: rider.id } })).toMatchObject({
      retired: false,
      userId: null,
    });
  });

  it('a second press in the collection week is refused and charges nothing more', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await settle(user.id, week2);
    await setMoney(user.id, 1000);
    await pay(user.id, rider.id, week2);
    await expect(pay(user.id, rider.id, week2)).rejects.toMatchObject(alreadyPaid);

    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'arrearsSettled')).toHaveLength(1);
  });

  it('two presses racing in the collection week take the owed week once', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await settle(user.id, week2);
    await setMoney(user.id, 1000);
    const results = await Promise.allSettled([pay(user.id, rider.id, week2), pay(user.id, rider.id, week2)]);

    expect(results.map(r => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(results.find(r => r.status === 'rejected').reason).toMatchObject(alreadyPaid);

    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'arrearsSettled')).toHaveLength(1);
    expect(await rows(user.id, 'paid')).toHaveLength(1);
  });
});
