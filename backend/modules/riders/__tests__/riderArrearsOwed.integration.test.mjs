/**
 * Rider owed weeks (owner q131, 2026-10-27): a rider's missed week is OWED, like grooms.
 * The next payday collects the missed weeks in the same debit; a rider who leaves after a
 * full unpaid week has the debt written off. Real DB, real pay pass, real roster route
 * (supertest). Pay weeks are fixed dates in 2032 and every pass is scoped to this suite's
 * own fixture users.
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
import { processWeeklyRiderSalaries } from '../index.mjs';
import { getRiderPayWeekStart } from '../services/riderPayWeek.mjs';
import { handleUnpaidRiders } from '../services/riderUnpaidService.mjs';

const PREFIX = 'TestFixture-riderArrears';
const tag = () => randomBytes(4).toString('hex');
// Wednesday 2032-03-03 -> pay week Monday 2032-03-01.
const week1 = new Date('2032-03-03T15:00:00Z');
const week2 = new Date('2032-03-10T15:00:00Z');
const week3 = new Date('2032-03-17T15:00:00Z');

const userIds = [];
const cleanup = createCleanupTracker();
cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }), 'notifications');
cleanup.add(() => prisma.riderSalaryPayment.deleteMany({ where: { userId: { in: userIds } } }), 'payments');
cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId: { in: userIds } } }), 'ledger');
cleanup.add(() => prisma.rider.deleteMany({ where: { userId: { in: userIds } } }), 'riders');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 30000);

async function makeUser(money) {
  const t = tag();
  const user = await prisma.user.create({
    data: {
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
    },
  });

const moneyOf = async userId =>
  Number((await prisma.user.findUnique({ where: { id: userId }, select: { money: true } })).money);
const setMoney = (userId, money) => prisma.user.update({ where: { id: userId }, data: { money } });
const pass = (userId, now) => processWeeklyRiderSalaries(now, { userId });
const rows = (userId, status) =>
  prisma.riderSalaryPayment.findMany({ where: { userId, status }, orderBy: { id: 'asc' } });

describe('rider owed weeks: a missed week is collected with the next payday', () => {
  it('a missed week followed by a paid week collects both, once, and the rider stays', async () => {
    const { user, token } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await pass(user.id, week1);
    expect(await rows(user.id, 'missed')).toHaveLength(1);
    await setMoney(user.id, 1000);

    const result = await pass(user.id, week2);

    expect(result.successful).toBe(1);
    expect(result.totalAmount).toBe(400);
    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
    const settled = await rows(user.id, 'arrearsSettled');
    expect(settled.map(r => [r.riderId, r.amount, r.weekKey])).toEqual([[rider.id, 200, '2032-03-01']]);
    expect(await rows(user.id, 'paid')).toHaveLength(1);

    // the settled week is never collected again
    await pass(user.id, week3);
    expect(await moneyOf(user.id)).toBe(400);

    // the roster the Staff page reads shows the rider paid
    const listed = await request(app).get(`/api/v1/riders/user/${user.id}`).set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].id).toBe(rider.id);
    expect(listed.body.data[0].feeUnpaidSince).toBeNull();
  });

  it('two missed weeks (a failed pass never releases) are both collected on the next payday', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await pass(user.id, week1);
    // Week 2 fails for OUR reason: the rider stays in grace and the week is still owed.
    const roster = await prisma.rider.findMany({ where: { userId: user.id } });
    await handleUnpaidRiders(user.id, roster, getRiderPayWeekStart(week2), { allowLeave: false });
    await handleUnpaidRiders(user.id, roster, getRiderPayWeekStart(week2), { allowLeave: false });
    expect(await rows(user.id, 'missed')).toHaveLength(2);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).retired).toBe(false);

    await setMoney(user.id, 1000);
    const result = await pass(user.id, week3);

    expect(result.totalAmount).toBe(600);
    expect(await moneyOf(user.id)).toBe(400);
    expect(await rows(user.id, 'arrearsSettled')).toHaveLength(2);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
  });

  it('a wallet that covers this week but not the debt pays this week; the debt stays owed', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await pass(user.id, week1);
    await setMoney(user.id, 250);
    await pass(user.id, week2);

    expect(await moneyOf(user.id)).toBe(50);
    expect(await rows(user.id, 'missed')).toHaveLength(1);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).feeUnpaidSince).toBeNull();

    await setMoney(user.id, 1000);
    await pass(user.id, week3);
    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
  });

  it('a rider who leaves after a full unpaid week is not charged afterwards; the debt is written off', async () => {
    const { user } = await makeUser(10);
    const rider = await makeRider(user.id, 200);

    await pass(user.id, week1);
    const result = await pass(user.id, week2);
    expect(result.released).toBe(1);
    expect(await rows(user.id, 'missed')).toHaveLength(0);
    expect(await rows(user.id, 'arrearsWrittenOff')).toHaveLength(1);

    await setMoney(user.id, 1000);
    await pass(user.id, week3);
    expect(await moneyOf(user.id)).toBe(1000);
    expect(await rows(user.id, 'paid')).toHaveLength(0);
    expect((await prisma.rider.findUnique({ where: { id: rider.id } })).retired).toBe(true);
  });

  it('a second pass in the collection week charges nothing more', async () => {
    const { user } = await makeUser(10);
    await makeRider(user.id, 200);

    await pass(user.id, week1);
    await setMoney(user.id, 1000);
    await pass(user.id, week2);
    await pass(user.id, week2);

    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'arrearsSettled')).toHaveLength(1);
  });

  it('two passes racing for the collection week take the owed week once', async () => {
    const { user } = await makeUser(10);
    await makeRider(user.id, 200);

    await pass(user.id, week1);
    await setMoney(user.id, 1000);
    await Promise.all([pass(user.id, week2), pass(user.id, week2)]);

    expect(await moneyOf(user.id)).toBe(600);
    expect(await rows(user.id, 'arrearsSettled')).toHaveLength(1);
    expect(await rows(user.id, 'paid')).toHaveLength(1);
  });
});
